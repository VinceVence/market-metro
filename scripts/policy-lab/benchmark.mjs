import {readFile,writeFile,mkdir,rename,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {simulateBenchmarkWorld} from './benchmark-world.mjs';
import {compareBranches,pairedEstimate,benchmarkGates,mean,recoveryMetric} from './benchmark-stats.mjs';
import {agentAudit} from './benchmark-audit.mjs';
import {validityChecks} from './benchmark-validity.mjs';
import {ASSUMPTIONS} from './economy.mjs';

const ROOT=resolve(import.meta.dirname,'../..'),OUT=resolve(ROOT,'docs/policy-lab/benchmarks/v1');
const SOURCE='GARDEN-LAB-df43cd08499c0c0a';
export const POLICIES=['organic','rules_matched','rules_fast','recorded_v1'];
const LABELS={organic:'No campaign',rules_matched:'Rules · matched timing',rules_fast:'Rules · immediate',recorded_v1:'Saved agent plan + refits'};
const readJSON=async p=>JSON.parse(await readFile(p,'utf8'));
const hash=x=>createHash('sha256').update(x).digest('hex');
const files=['scripts/policy-lab/economy.mjs','scripts/policy-lab/learner.mjs','scripts/policy-lab/service.mjs',
  'scripts/marketing/economy.mjs','scripts/marketing/contract.mjs','demo/market/engine.mjs',
  'scripts/policy-lab/benchmark-world.mjs','scripts/policy-lab/benchmark-stats.mjs','scripts/policy-lab/benchmark-audit.mjs','scripts/policy-lab/benchmark-validity.mjs','scripts/policy-lab/benchmark.mjs'];
async function atomic(path,value){await mkdir(resolve(path,'..'),{recursive:true});const tmp=path+'.tmp';await writeFile(tmp,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');await rename(tmp,path);}
async function fingerprints(){return Object.fromEntries(await Promise.all(files.map(async f=>[f,hash(await readFile(resolve(ROOT,f)))])));}
export function assertFrozen(expected,current){if(JSON.stringify(expected)!==JSON.stringify(current))throw Error('FROZEN_BENCHMARK_CHANGED: create a new protocol/version; do not overwrite this evaluation.');}

async function initialize(){
  try{await access(resolve(OUT,'protocol.json'));throw Error('PROTOCOL_ALREADY_EXISTS');}catch(e){if(e.code!=='ENOENT')throw e;}
  const report=await readJSON(resolve(ROOT,'docs/policy-lab/runs',SOURCE,'report.json'));
  const db=new DatabaseSync(resolve(ROOT,'.local/market-metro.sqlite'),{readOnly:true});let catalog;
  try{catalog=db.prepare('SELECT * FROM products WHERE run_id=? ORDER BY rowid LIMIT 3').all(SOURCE).map(p=>({currency:p.currency,priceCents:p.price_cents,channel3Id:p.channel3_product_id,title:p.title,brand:p.brand,category:p.category,source:p.source,sourceUrl:p.source_url,imageUrl:p.image_url,retrievedAt:p.retrieved_at}));}finally{db.close();}
  const schedule=report.checkpoints.filter(c=>c.output?.status==='PUBLISHED').map(c=>c.output.policy);
  const protocol={id:'policy-lab-transfer-v1',version:'v1',createdAt:new Date().toISOString(),sourceRunId:SOURCE,
    question:'Do previously selected campaign plans generalize economically when their local learner is refitted on new synthetic markets?',
    evidenceClass:'SAVED_PLAN_TRANSFER',settings:{customerCount:100,days:100,budgetCents:30000},startedAt:'2026-10-24T01:00:00.000Z',
    warmupDays:30,returnWindowDays:14,scenarios:['steady','rival_sale','budget_squeeze','supply_delay','returns_wave'],
    developmentSeeds:[314,2718,1618],evaluationSeeds:Array.from({length:20},(_,i)=>9001+i),
    scenarioWeights:'Equal weight, then average within seed; bootstrap whole seed clusters.',
    policies:POLICIES,sourceModelCostUSD:report.modelCostMicros/1e6,
    costSchedule:report.checkpoints.filter(c=>c.actor==='GEMINI_3_1_FLASH_LITE').map(c=>({day:c.day,micros:c.cost_micros})),
    costAccounting:'Every saved-plan world is charged the full source-run token estimate, including rejected attempts and final review. This is an allocation sensitivity, not a new bill. Rules use no model API. Local CPU seconds are measured; electricity/hardware/labor are unpriced, not assumed free.',
    primaryMetric:'Paired modeled platform contribution after allocated model cost versus no campaign and matched rules, USD per 100 shoppers over days31–100, matured through day114.',
    secondaryMetrics:['Merchant contribution','Retained payment volume','Reactivation of fixed day30 lapsed cohort','Worst observed and worst-decile loss','Post-shock cumulative loss','Model MSE versus constant'],
    gates:{minimumGainUSD:0,maxMerchantLossUSD:0,maxWorstCaseLossUSD:50},
    gateDisclosure:'Engineering starting targets, not PayPal requirements or a power calculation. Strict lower bound above $0 establishes statistical direction only; business materiality remains to be agreed.',
    resamples:2000,confidenceLevel:.95,
    exclusions:'No failed case may be silently omitted. No native payments, cloud calls or scenario-specific policy tuning.',
    reuse:'Seeds are held out from source-policy selection at v1. Once results are inspected they become a regression suite; later confirmatory claims need a fresh preregistered split.',
    assumptions:ASSUMPTIONS,notEstablished:['Fresh multi-agent adaptation','Advantage over a single planner','Real-world ROI','Behavioral calibration','Global regret optimality']};
  await atomic(resolve(OUT,'protocol.json'),protocol);
  await atomic(resolve(OUT,'inputs.json'),{sourceRunId:SOURCE,catalog,schedule,sourceReportHash:hash(JSON.stringify(report)),originalBranches:report.branches,audit:agentAudit(report)});
  console.log('Protocol and source inputs written. Freeze after adapter validation; no held-out outcomes have been generated.');
}

async function freeze(){
  try{await access(resolve(OUT,'lock.json'));throw Error('LOCK_ALREADY_EXISTS');}catch(e){if(e.code!=='ENOENT')throw e;}
  const code=await fingerprints(),protocolHash=hash(await readFile(resolve(OUT,'protocol.json'))),inputsHash=hash(await readFile(resolve(OUT,'inputs.json')));
  await atomic(resolve(OUT,'lock.json'),{createdAt:new Date().toISOString(),code,protocolHash,inputsHash,benchmarkHash:hash(JSON.stringify({code,protocolHash,inputsHash}))});
  console.log('Benchmark frozen. Code, protocol and catalog/plan hashes are pinned.');
}

async function checkLock(){const lock=await readJSON(resolve(OUT,'lock.json'));assertFrozen(lock.code,await fingerprints());if(lock.protocolHash!==hash(await readFile(resolve(OUT,'protocol.json')))||lock.inputsHash!==hash(await readFile(resolve(OUT,'inputs.json'))))throw Error('FROZEN_INPUTS_CHANGED');return lock;}

export function evaluateCase(seed,scenario,protocol,inputs){
  return compareBranches(POLICIES.map(policy=>simulateBenchmarkWorld({seed,scenario,policy,protocol,catalog:inputs.catalog,schedule:inputs.schedule})));
}

function summarize(cases,protocol,inputs,lock,runtimeSeconds){
  const rows=cases.flat(),fields=['deltaPlatformUSD','deltaVsRulesUSD','deltaMerchantUSD','deltaVolumeUSD','deltaReactivated'];
  const summaries=POLICIES.filter(p=>p!=='organic').map(policy=>({policy,label:LABELS[policy],
    metrics:Object.fromEntries(fields.map(f=>[f,pairedEstimate(rows.filter(r=>r.policy===policy),f,{resamples:protocol.resamples})]))}));
  const scenarioResults=protocol.scenarios.map(scenario=>({scenario,policies:POLICIES.filter(p=>p!=='organic').map(policy=>({policy,...pairedEstimate(rows.filter(r=>r.policy===policy&&r.scenario===scenario),'deltaPlatformUSD',{resamples:protocol.resamples})}))}));
  const curves=POLICIES.filter(p=>p!=='organic').map(policy=>({policy,points:Array.from({length:70},(_,i)=>({day:i+31,...pairedEstimate(rows.filter(r=>r.policy===policy).map(r=>({seed:r.seed,value:r.daily[i].deltaPlatformUSD})),'value',{resamples:protocol.resamples})}))}));
  const violations=Object.fromEntries(Object.keys(rows[0].checks).map(k=>[k,rows.reduce((n,r)=>n+r.checks[k],0)]));
  const pairedWarmup=cases.every(branches=>new Set(branches.map(b=>b.cohortLapsed)).size===1);
  const probes=validityChecks(protocol,inputs.catalog,inputs.schedule);
  const agent=summaries.find(s=>s.policy==='recorded_v1'),allChecks=Object.values(violations).every(v=>v===0)&&pairedWarmup&&probes.every(p=>p.passed);
  const adaptation=POLICIES.filter(p=>p!=='organic').map(policy=>({policy,scenarios:protocol.scenarios.filter(s=>s!=='steady').map(scenario=>{
    const rs=rows.filter(r=>r.policy===policy&&r.scenario===scenario);
    const recovery=rs.map(r=>recoveryMetric(r.daily)),recovered=recovery.filter(r=>r.status==='RECOVERED');
    return {scenario,postShockLossUSD:mean(rs.map(r=>r.daily.slice(5).reduce((n,d,i)=>{const previous=r.daily[i+4].deltaPlatformUSD;return n+Math.max(0,previous-d.deltaPlatformUSD);},0))),
      recoveredCases:recovered.length,censoredCases:recovery.filter(r=>r.status==='CENSORED').length,noObservedShortfallCases:recovery.filter(r=>r.status==='NO_OBSERVED_SHORTFALL').length,
      meanDaysToConfirmedRecovery:recovered.length?mean(recovered.map(r=>r.daysToConfirmation)):null,
      note:'Recovery: trailing 7-day mean paired increment is nonnegative for 14 consecutive days after a negative window. Retrospective, descriptive, and censored at day100; not proof of shock detection.'};
  })}));
  return {schema:'policy-lab-benchmark-v1',generatedAt:new Date().toISOString(),benchmarkHash:lock.benchmarkHash,protocolId:protocol.id,version:protocol.version,
    sourceRunId:inputs.sourceRunId,evidenceClass:protocol.evidenceClass,scenarioCount:protocol.scenarios.length,seedCount:protocol.evaluationSeeds.length,
    pairedCases:cases.length,worlds:rows.length,shopperDays:rows.length*protocol.settings.days*protocol.settings.customerCount,
    labels:LABELS,summaries,scenarioResults,curves,adaptation,
    integrity:{violations,pairedWarmup,allMature:rows.every(r=>r.matureOutcomes===7000),probes,passed:allChecks},
    goals:benchmarkGates(agent.metrics,protocol.gates,allChecks),audit:inputs.audit,
    costs:{newModelCalls:0,newPaymentCalls:0,newPaidAPICostUSD:0,sourceModelCostUSD:protocol.sourceModelCostUSD,
      allocatedModelCostPerSavedPlanWorldUSD:protocol.sourceModelCostUSD,runtimeSeconds,
      evaluatedWorldSeconds:rows.reduce((n,r)=>n+r.runtimeMs,0)/1000,localFitMs:rows.reduce((n,r)=>n+r.fits.reduce((s,f)=>s+f.runtimeMs,0),0),unpriced:['Local electricity','Hardware depreciation','Operator labor'],basis:protocol.costAccounting},
    limitations:['Plans and their observed publication delays are replayed; Gemini does not inspect new test evidence. Local coefficients are freshly fitted.',
      'Intervals reflect seed variation under five fixed behavioral scenarios; they do not cover model misspecification, fresh LLM variability or production customers.',
      'All cumulative curves use fully matured sale cohorts, reconstructed after day114; they are not information available to agents on that day.',
      'Local compute time is measured but not priced; API estimates are not billing invoices.',
      'Full source model cost is allocated to each saved-plan world; no new API cost was incurred.',
      'No single-planner comparator has been run; this cannot establish the value of agent count.',
      'No seed-specific tuning. Once viewed these evaluation seeds are regression cases, not reusable untouched holdouts.'],
    rows};
}

async function run(pilot){
  const protocol=await readJSON(resolve(OUT,'protocol.json')),inputs=await readJSON(resolve(OUT,'inputs.json'));
  const lock=pilot?{benchmarkHash:'PILOT-'+hash(JSON.stringify(await fingerprints()))}:await checkLock(),seeds=pilot?[314]:protocol.evaluationSeeds,scenarios=pilot?['rival_sale']:protocol.scenarios;
  const start=performance.now(),cases=[],cache=resolve(ROOT,'.local/policy-benchmarks',lock.benchmarkHash);
  for(const seed of seeds)for(const scenario of scenarios){
    const path=resolve(cache,`${seed}-${scenario}.json`);let branches;
    try{branches=await readJSON(path);}catch(e){if(e.code!=='ENOENT')throw e;branches=evaluateCase(seed,scenario,protocol,inputs);await atomic(path,branches);}
    if(branches.length!==POLICIES.length||branches.some(r=>r.seed!==seed||r.scenario!==scenario||!POLICIES.includes(r.policy)))throw Error('INVALID_CACHED_CASE');
    cases.push(branches);console.log(`${cases.length}/${seeds.length*scenarios.length} ${seed} ${scenario}: saved-plan delta $${branches.find(r=>r.policy==='recorded_v1').deltaPlatformUSD.toFixed(2)}`);
  }
  if(pilot){
    const b=cases[0].find(r=>r.policy==='recorded_v1'),original=inputs.originalBranches.find(r=>r.branch==='mesh');
    const differences=['purchases','platformProxyCents','retainedCents','merchantContributionCents','jointBudgetSpentCents'].filter(k=>b[k]!==original[k]).map(k=>({metric:k,adapter:b[k],recorded:original[k]}));
    const result={seconds:(performance.now()-start)/1000,matchedSource:!differences.length,differences,checks:cases[0].map(r=>({policy:r.policy,checks:r.checks})),actualNewAPIUSD:0};
    await atomic(resolve(OUT,'adapter-validation.json'),result);console.log(JSON.stringify(result,null,2));if(differences.length)throw Error('ADAPTER_PARITY_FAILED');return;
  }
  await checkLock(); // Detect concurrent edits before publishing any measured claim.
  const result=summarize(cases,protocol,inputs,lock,(performance.now()-start)/1000);
  await atomic(resolve(OUT,'result.json'),result);
  const cols=['seed','scenario','policy','purchases','platformProxyCents','allocatedModelUSD','deltaPlatformUSD','deltaVsRulesUSD','merchantContributionCents','deltaMerchantUSD','retainedCents','deltaVolumeUSD','cohortLapsed','reactivatedCustomers','deltaReactivated','offers','redemptions','runtimeMs'];
  await atomic(resolve(OUT,'cases.csv'),cols.join(',')+'\n'+result.rows.map(r=>cols.map(k=>r[k]).join(',')).join('\n')+'\n');
  await atomic(resolve(OUT,'goals.json'),{protocol:protocol.id,goals:result.goals});
  const historyPath=resolve(OUT,'versions.json');let history=[];try{history=await readJSON(historyPath);}catch(e){if(e.code!=='ENOENT')throw e;}
  const entry={version:protocol.version,benchmarkHash:lock.benchmarkHash,evidenceClass:protocol.evidenceClass,seedCount:seeds.length,pairedCases:cases.length,
    ...result.summaries.find(s=>s.policy==='recorded_v1').metrics.deltaPlatformUSD,generatedAt:result.generatedAt};
  if(history.some(h=>h.version===entry.version&&h.benchmarkHash!==entry.benchmarkHash))throw Error('VERSION_HISTORY_CONFLICT');
  history=history.filter(h=>h.version!==entry.version);history.push(entry);await atomic(historyPath,history);
  console.log(JSON.stringify({pairedCases:result.pairedCases,worlds:result.worlds,goals:result.goals,newPaidAPICostUSD:0,runtimeSeconds:result.costs.runtimeSeconds},null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const mode=process.argv[2];if(mode==='--init')await initialize();else if(mode==='--freeze')await freeze();else if(mode==='--pilot')await run(true);else if(mode==='--run')await run(false);else throw Error('Use --init, --pilot, --freeze or --run. No command calls paid APIs.');
}
