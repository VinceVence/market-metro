import {readFile,writeFile,mkdir,access,rename,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createFreshWorld,unchangedRules,POLICY_OPTIONS,defaultPlan} from './fresh-world.mjs';
import {makeFreshAgent} from './fresh-agent.mjs';
import {compareBranches,pairedEstimate,benchmarkGates} from './benchmark-stats.mjs';

const ROOT=resolve(import.meta.dirname,'../..'),BASE=resolve(ROOT,'docs/policy-lab/benchmarks/v2');
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const hash=x=>createHash('sha256').update(x).digest('hex');
const write=async(path,value)=>{await mkdir(resolve(path,'..'),{recursive:true});await writeFile(path+'.tmp',JSON.stringify(value,null,2)+'\n');await rename(path+'.tmp',path);};
const originalLock=await read(resolve(ROOT,'docs/policy-lab/benchmarks/v1/lock.json'));
const originalProtocol=await read(resolve(ROOT,'docs/policy-lab/benchmarks/v1/protocol.json'));
const inputs=await read(resolve(ROOT,'docs/policy-lab/benchmarks/v1/inputs.json'));
export const BRANCHES=['organic','rules_fast','rules_matched','conservative_code','fresh_gemini'];
const LABELS={organic:'No campaign',rules_fast:'Original rules · immediate',rules_matched:'Original rules · matched latency',conservative_code:'Conservative code · no LLM',fresh_gemini:'Fresh Gemini team v2'};
const newFiles=['scripts/policy-lab/fresh-world.mjs','scripts/policy-lab/fresh-agent.mjs','scripts/policy-lab/fresh-benchmark.mjs'];

export async function verifyFrozenOriginal(){
  for(const [file,expected]of Object.entries(originalLock.code))if(hash(await readFile(resolve(ROOT,file)))!==expected)throw Error('ORIGINAL_BENCHMARK_CHANGED: '+file);
  if(hash(await readFile(resolve(ROOT,'docs/policy-lab/benchmarks/v1/inputs.json')))!==originalLock.inputsHash)throw Error('ORIGINAL_CATALOG_CHANGED');
  return originalLock.benchmarkHash;
}
async function fingerprint(){
  const entries=await Promise.all(newFiles.map(async p=>[p,hash(await readFile(resolve(ROOT,p)))]));
  return Object.fromEntries(entries);
}
async function suiteStatus(){const l=await read(resolve(ROOT,'.local/gcp/model-spend.json'));return {lifetimeUSD:l.entries.reduce((n,e)=>n+e.chargedMicros,0)/1e6,suiteUSD:l.entries.filter(e=>e.runId.startsWith('market-FRESH2-')).reduce((n,e)=>n+e.chargedMicros,0)/1e6,circuit:l.circuit,unsettled:l.entries.filter(e=>e.status!=='settled').length};}

function developmentPrior(){return {scope:'Development only:15 worlds across3 reused development seeds, not the current market. These policies were selected from17 initial variants; estimates have selection bias.',
  rows:[{policyId:'observe',deltaPlatformUSD:0},{policyId:'recommend_selective',deltaPlatformUSD:.132},{policyId:'reactivate_short',deltaPlatformUSD:-1.036},{policyId:'recommend_short',deltaPlatformUSD:-3.8013},{policyId:'coupon_probe',deltaPlatformUSD:-5.928}],
  limit:'Uncertainty is substantial. None has demonstrated reliable economic lift. A campaign is an experiment, not assured extra revenue.'};}

async function freeze(){
  await verifyFrozenOriginal();try{await access(resolve(BASE,'protocol.json'));throw Error('V2_PROTOCOL_ALREADY_FROZEN');}catch(e){if(e.code!=='ENOENT')throw e;}
  const code=await fingerprint(),budget=await suiteStatus();
  const protocol={id:'fresh-gemini-policy-v2',evidenceClass:'FRESH_GEMINI_DECISIONS',createdAt:new Date().toISOString(),originalBenchmarkHash:originalLock.benchmarkHash,
    originalCode:originalLock.code,code,settings:originalProtocol.settings,startedAt:originalProtocol.startedAt,
    evaluationSeeds:[31001,31002,31003,31004,31005,31006],scenarios:originalProtocol.scenarios,
    developmentSeeds:originalProtocol.developmentSeeds,reviewDays:[30,55,80],dayMs:1500,branches:BRANCHES,policyMenu:POLICY_OPTIONS,developmentEvidence:developmentPrior(),
    suiteCapUSD:1,perCaseCapUSD:.25,wholeHackathonCapUSD:50,budgetAtFreeze:budget,
    measurement:'Same platform reward and 14-day maturity as v1. Deduct actual metered Gemini costs, including rejected attempts; local compute/labor remain unpriced.',
    clock:'All branches advance together every1.5 seconds while Gemini is reasoning. Original rules act at scheduled cutoffs; matched rules and conservative code publish at the fresh team completion day. Outside reasoning, days advance locally without waiting. Wall-clock publication variability is part of this measured pilot.',
    failures:'A failed reasoning review keeps the prior bounded policy, is recorded, and remains in intention-to-treat outcomes. Uncertain billing stops the suite; never discard a completed case because it loses.',
    uncertainty:'95% percentile bootstrap over6 seed clusters, with5 fixed scenarios kept together. Small pilot, not a powered confirmatory study; no repeated LLM draw per condition.',
    thresholds:originalProtocol.gates,primaryMetric:originalProtocol.primaryMetric.replace('allocated model cost','actual model cost'),
    caveats:['World dynamics and original rules remain unchanged. V2 changes policy controls and evidence checks only.','Fresh team versus conservative code isolates whether model decisions improve beyond a cheap bounded policy; agent-count advantage versus a single LLM is not tested.','The v1 saved-plan benchmark is historical context, not a same-seed causal comparator.','No fresh PayPal calls: all evaluation transactions are simulated. PayPal value remains a model proxy, not real-world ROI.'],
    assumptionHash:hash(JSON.stringify(originalProtocol.assumptions)),catalogHash:hash(JSON.stringify(inputs.catalog))};
  protocol.protocolHash=hash(JSON.stringify(protocol));await write(resolve(BASE,'protocol.json'),protocol);console.log(JSON.stringify({status:'FROZEN',hash:protocol.protocolHash,cases:30,suiteCapUSD:1,budget},null,2));
}

export async function runFreshCase({seed,scenario,protocol,pilot=false,agentFactory=makeFreshAgent,dayMs=protocol.dayMs}){
  const caseId='FRESH2-'+(pilot?'DEV-':'')+hash([seed,scenario,protocol.protocolHash||'DEV'].join(':')).slice(0,16),directory=resolve(BASE,pilot?'pilot':'cases',caseId);
  try{const prior=await read(resolve(directory,'result.json'));if(prior.completed)return prior;}catch(e){if(e.code!=='ENOENT')throw e;}
  const runners=Object.fromEntries(BRANCHES.map(branch=>[branch,createFreshWorld({id:caseId+'-'+branch,seed,scenario,settings:protocol.settings,catalog:inputs.catalog,startedAt:protocol.startedAt})]));
  const team=runners.fresh_gemini,errors=[],reviews=[];let pending=null;
  const agent=await agentFactory({caseId,directory,development:protocol.developmentEvidence,suiteCapUSD:protocol.suiteCapUSD});
  function advance(){
    if(team.world.tick>=114)return;
    for(const runner of Object.values(runners))runner.step();
    if(protocol.reviewDays.includes(team.world.tick)){
      const fast=runners.rules_fast,plan=unchangedRules(fast.evidence());fast.publish(plan,fast.fit());
    }
  }
  try{
    while(team.world.tick<114){
      const cutoff=team.world.tick;
      if(protocol.reviewDays.includes(cutoff)){
        const rules=runners.rules_matched,code=runners.conservative_code;
        const rulesPlan=unchangedRules(rules.evidence()),rulesModel=rules.fit();
        const codePlan={...POLICY_OPTIONS.find(p=>p.id==='recommend_selective'),merchantIndices:[0,1,2],windowDays:42},codeModel=code.fit();
        const reviewPath=resolve(directory,'publication-'+cutoff+'.json');let saved;
        try{saved=await read(reviewPath);}catch(e){if(e.code!=='ENOENT')throw e;}
        if(saved&&saved.status!=='COMPLETED')throw Error('INCOMPLETE_REVIEW_REQUIRES_INSPECTION');
        const started=performance.now();
        if(saved){
          while(team.world.tick<saved.publishedDay)advance();pending=saved.pending;
          if(saved.error)errors.push(saved.error);
        }else{
          await write(reviewPath,{status:'REQUESTING',cutoff});
          const timer=dayMs>0?setInterval(advance,dayMs):null;
          try{pending=await agent.review(team);}catch(e){errors.push({cutoff,error:e.message});pending=null;}finally{clearInterval(timer);}
          await write(reviewPath,{status:'COMPLETED',cutoff,publishedDay:team.world.tick,pending,error:errors.find(e=>e.cutoff===cutoff)||null,latencySeconds:(performance.now()-started)/1000});
        }
        const publishedDay=team.world.tick;
        if(publishedDay<100&&publishedDay-cutoff<=20){
          if(pending)team.publish(pending.plan,pending.model,cutoff);
          rules.publish(rulesPlan,rulesModel,cutoff);code.publish(codePlan,codeModel,cutoff);
        }
        reviews.push({cutoff,publishedDay,latencySeconds:saved?.latencySeconds??(performance.now()-started)/1000,publicationStatus:publishedDay<100&&publishedDay-cutoff<=20?(pending?'PUBLISHED':'TEAM_FAILED_PRIOR_POLICY_RETAINED'):'STALE_NOT_PUBLISHED',decisions:pending?{analyst:pending.analyst,scientist:pending.science,reviewer:pending.review}:null});
        if(errors.length){const s=await suiteStatus();if(s.circuit||s.unsettled)throw Error('SPEND_UNCERTAIN_STOP_SUITE');}
      }
      advance();
    }
  }finally{await agent.close();}
  const ledger=await read(resolve(ROOT,'.local/gcp/model-spend.json')),charges=ledger.entries.filter(e=>e.runId==='market-'+caseId);
  const charged=charges.reduce((n,c)=>n+c.chargedMicros,0)/1e6;
  const records=await Promise.all((await readdir(directory)).filter(f=>f.startsWith(caseId)&&f.endsWith('.json')).map(f=>read(resolve(directory,f))));
  team.charge(charged,charges.length);
  const branches=compareBranches(BRANCHES.map(b=>runners[b].result(b))),fresh=branches.find(b=>b.policy==='fresh_gemini'),code=branches.find(b=>b.policy==='conservative_code'),fast=branches.find(b=>b.policy==='rules_fast');
  fresh.deltaVsCodeUSD=(fresh.platformProxyCents-code.platformProxyCents)/100-charged;fresh.deltaVsImmediateRulesUSD=(fresh.platformProxyCents-fast.platformProxyCents)/100-charged;
  const traces=team.actions.filter(a=>a.day>=30&&a.selected_action!=='none').slice(0,20).map(a=>({...a,order:a.order_id?team.orders.get(a.order_id):null}));
  const result={completed:true,caseId,seed,scenario,protocolHash:protocol.protocolHash,pilot,branches,reviews,errors,
    modelCostUSD:charged,modelCalls:charges.length,invalidAttempts:records.filter(c=>c.status==='REJECTED').length,
    providerModels:[...new Set(records.map(c=>c.provider?.modelVersion).filter(Boolean))],traces};
  await write(resolve(directory,'result.json'),result);return result;
}

async function verifyV2(p){await verifyFrozenOriginal();if(JSON.stringify(await fingerprint())!==JSON.stringify(p.code))throw Error('V2_POLICY_CHANGED_AFTER_FREEZE');const {protocolHash,...payload}=p;if(hash(JSON.stringify(payload))!==protocolHash)throw Error('PROTOCOL_CHANGED');}

async function run(pilot=false){
  const protocol=pilot?{protocolHash:'DEV-'+hash(JSON.stringify(await fingerprint())),settings:originalProtocol.settings,startedAt:originalProtocol.startedAt,reviewDays:[30,55,80],dayMs:1500,developmentEvidence:developmentPrior(),suiteCapUSD:1}:await read(resolve(BASE,'protocol.json'));
  if(!pilot)await verifyV2(protocol);
  const results=[],seeds=pilot?[314]:protocol.evaluationSeeds,scenarios=pilot?['rival_sale']:protocol.scenarios;
  for(const seed of seeds)for(const scenario of scenarios){
    if(!pilot)await verifyV2(protocol);
    const result=await runFreshCase({seed,scenario,protocol,pilot});results.push(result);
    const fresh=result.branches.find(b=>b.policy==='fresh_gemini');
    console.log(JSON.stringify({progress:`${results.length}/${seeds.length*scenarios.length}`,caseId:result.caseId,seed,scenario,calls:result.modelCalls,costUSD:result.modelCostUSD,deltaUSD:fresh.deltaPlatformUSD,vsRulesUSD:fresh.deltaVsRulesUSD,errors:result.errors,plans:fresh.publications.map(p=>p.policy)}));
    await write(resolve(BASE,pilot?'pilot-progress.json':'progress.json'),{status:'RUNNING',completed:results.length,total:seeds.length*scenarios.length,cases:results.map(r=>({caseId:r.caseId,seed:r.seed,scenario:r.scenario,modelCostUSD:r.modelCostUSD,modelCalls:r.modelCalls}))});
  }
  if(pilot)return;
  const rows=results.flatMap(r=>r.branches),fields=['deltaPlatformUSD','deltaVsRulesUSD','deltaMerchantUSD','deltaVolumeUSD','deltaReactivated'];
  const summaries=BRANCHES.filter(p=>p!=='organic').map(policy=>({policy,label:LABELS[policy],metrics:Object.fromEntries(fields.map(f=>[f,pairedEstimate(rows.filter(r=>r.policy===policy),f)]))}));
  const fresh=rows.filter(r=>r.policy==='fresh_gemini'),agent=summaries.find(s=>s.policy==='fresh_gemini');
  agent.metrics.deltaVsCodeUSD=pairedEstimate(fresh,'deltaVsCodeUSD');agent.metrics.deltaVsImmediateRulesUSD=pairedEstimate(fresh,'deltaVsImmediateRulesUSD');
  const passed=rows.every(r=>Object.values(r.checks).every(v=>v===0)&&r.matureOutcomes===7000);
  const result={schema:'fresh-policy-v2',generatedAt:new Date().toISOString(),protocolHash:protocol.protocolHash,originalBenchmarkHash:protocol.originalBenchmarkHash,evidenceClass:'FRESH_GEMINI_DECISIONS',
    completedCases:results.length,seedCount:seeds.length,scenarioCount:scenarios.length,worlds:rows.length,labels:LABELS,summaries,
    scenarioResults:scenarios.map(scenario=>({scenario,policies:BRANCHES.filter(p=>p!=='organic').map(policy=>({policy,...pairedEstimate(rows.filter(r=>r.scenario===scenario&&r.policy===policy),'deltaPlatformUSD')}))})),
    goals:benchmarkGates(agent.metrics,protocol.thresholds,passed),integrityPassed:passed,
    costs:{newModelCalls:results.reduce((n,r)=>n+r.modelCalls,0),newModelUSD:results.reduce((n,r)=>n+r.modelCostUSD,0),newPaymentCalls:0,...await suiteStatus()},
    invalidAttempts:results.reduce((n,r)=>n+r.invalidAttempts,0),failedReviews:results.reduce((n,r)=>n+r.errors.length,0),cases:results.map(({traces,...r})=>r),rows,
    disclosure:protocol.caveats};
  await verifyV2(protocol);await write(resolve(BASE,'result.json'),result);await write(resolve(BASE,'progress.json'),{status:'COMPLETE',completed:results.length,total:results.length});
  console.log(JSON.stringify({status:'COMPLETE',summary:agent.metrics,costs:result.costs},null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const mode=process.argv[2];if(mode==='--freeze')await freeze();else if(mode==='--pilot')await run(true);else if(mode==='--run')await run();else throw Error('Use --pilot, --freeze or --run. --pilot and --run call Gemini under the shared ledger.');
}
