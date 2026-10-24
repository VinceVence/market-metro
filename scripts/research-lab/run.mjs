import {readFile,access,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {ROOT,BASE,frozenInputs,sha,readJSON,saveJSON,runPolicy} from './data.mjs';
import {createWorkspace,runFixedWorkflow,LIMITS} from './workspace.mjs';
import {createMeteredSession,interpretBrief,runResearchPlanner,validateResearchReview} from './agent.mjs';
import {pairedEstimate} from '../policy-lab/benchmark-stats.mjs';

const FILES=['scripts/research-lab/data.mjs','scripts/research-lab/workspace.mjs','scripts/research-lab/agent.mjs','scripts/research-lab/run.mjs'];
const METHODS=['fixed','automl','research'];
const NONE={id:'observe',strategy:'observe',audience:'all',merchantIndices:[],maxOfferPct:0,duration:0,penalty:0,epsilon:0,windowDays:42};
const briefs=[
  {brief:'Investigate whether recommendations can add retained PayPal contribution. Use all three merchants and any shoppers. Do not issue discount coupons. Limit this single campaign to7 days and a simulated outreach budget of$30. Inspect the data, fit a local candidate, and test at least one development pilot before choosing a bounded campaign or observe.',contract:{budgetCents:3000,maxCouponPct:0,maxDurationDays:7,audience:'all',allowedMerchantIndices:[0,1,2]}},
  {brief:'Research reactivation for previous buyers who have not purchased for7 days. Only Oak & Ink and Corner Supply may participate. A campaign can last up to14 days, spend at most$50 of simulated joint funding, and offer no more than5% off. Optimize mature retained PayPal contribution, not redemptions. Inspect the data, fit and test a candidate before committing or observing.',contract:{budgetCents:5000,maxCouponPct:5,maxDurationDays:14,audience:'lapsed',allowedMerchantIndices:[1,2]}},
  {brief:'Design a very small recommendation experiment for Willow Goods and Corner Supply, open to all shoppers. No coupons. The campaign must end within3 days and may spend at most$10 in simulated funding. Account for refunds and fees. Query the warehouse, compare a local model and run a development pilot; observe if there is insufficient support for outreach.',contract:{budgetCents:1000,maxCouponPct:0,maxDurationDays:3,audience:'all',allowedMerchantIndices:[0,2]}}
];
export const TASKS=[
  {seed:52001,scenario:'steady',briefIndex:0},
  {seed:52002,scenario:'rival_sale',briefIndex:1},
  {seed:52003,scenario:'budget_squeeze',briefIndex:2},
  {seed:52004,scenario:'supply_delay',briefIndex:0},
  {seed:52005,scenario:'returns_wave',briefIndex:1},
  {seed:52006,scenario:'steady',briefIndex:2}
].map((t,i)=>({...t,...briefs[t.briefIndex],taskId:'mission-'+(i+1)}));
async function fingerprint(){return Object.fromEntries(await Promise.all(FILES.map(async p=>[p,sha(await readFile(resolve(ROOT,p)))])));}
export async function spend(){const ledger=await readJSON(resolve(ROOT,'.local/gcp/model-spend.json'));return {suiteUSD:ledger.entries.filter(e=>e.runId.startsWith('market-RSCH3-')).reduce((n,e)=>n+e.chargedMicros,0)/1e6,lifetimeUSD:ledger.entries.reduce((n,e)=>n+e.chargedMicros,0)/1e6,circuit:ledger.circuit,unsettled:ledger.entries.filter(e=>e.status!=='settled').length};}
async function freeze(){
  const frozen=await frozenInputs();try{await access(resolve(BASE,'protocol.json'));throw Error('RESEARCH_PROTOCOL_EXISTS');}catch(e){if(e.code!=='ENOENT')throw e;}
  const protocol={id:'research-workflow-v3',createdAt:new Date().toISOString(),code:await fingerprint(),originalBenchmarkHash:frozen.originalBenchmarkHash,v2ProtocolHash:frozen.v2ProtocolHash,
    tasks:TASKS,methods:METHODS,limits:LIMITS,model:'gemini-3.1-flash-lite',suiteCapUSD:1,perCaseCapUSD:.25,wholeHackathonCeilingUSD:50,
    snapshotDay:45,shoppingDays:100,returnTailDays:14,pilotSeeds:[[61001,61002,61003],[61011,61012,61013]],
    experiment:'One bounded campaign per research mission. All branches use identical frozen market dynamics, the same observed snapshot and a shared Gemini interpretation. Final outcomes remain unavailable until the research decision and independent review are committed.',
    pilots:'Replicated paired development simulations, not real-customer randomized trials. They expose permitted training feedback, not final test seeds. Their small, adaptively selected estimates are not confirmatory evidence.',
    baselines:'Fixed workflow and bounded automated model comparison use the same parser result, schema, query API, model fitter, pilot API, authority constraints and tool ceilings. They make deterministic planning decisions; the adaptive planner has model-call costs on top.',
    modelScope:'Generated linear feature expressions over the existing seven observable inputs, compiled to the frozen policy interface. Two local model families: action means and ridge. No arbitrary Python or nonlinear model deployment.',
    metric:'Additional modeled platform contribution versus no campaign after all allocated parser/planner/reviewer costs. Baselines each receive the same full shared-reader cost allocation; actual provider billing is counted only once.',
    uncertainty:'Six different seed/brief/scenario combinations; paired bootstrap intervals are exploratory. Not a powered or representative production ROI study.',
    opportunityAuditHash:sha(await readFile(resolve(BASE,'opportunity-results.json'))),budgetAtFreeze:await spend()};
  protocol.hash=sha(protocol);await saveJSON(resolve(BASE,'protocol.json'),protocol);console.log(JSON.stringify({status:'FROZEN',hash:protocol.hash,missions:TASKS.length,budget:protocol.budgetAtFreeze},null,2));
}
async function verify(protocol){await frozenInputs();const {hash,...p}=protocol;if(sha(p)!==hash||sha(await fingerprint())!==sha(protocol.code)||sha(await readFile(resolve(BASE,'opportunity-results.json')))!==protocol.opportunityAuditHash)throw Error('RESEARCH_POLICY_CHANGED_AFTER_FREEZE');}

async function runMission(task,protocol,pilot=false){
  const id='RSCH3-'+(pilot?'DEV-':'')+sha({task:task.taskId,seed:task.seed,protocol:protocol.hash}).slice(0,16),directory=resolve(BASE,pilot?'pilot':'missions',id);
  try{const r=await readJSON(resolve(directory,'result.json'));if(r.completed)return r;}catch(e){if(e.code!=='ENOENT')throw e;}
  const {catalog}=await frozenInputs(),session=await createMeteredSession({id,directory,suiteCapUSD:protocol.suiteCapUSD}),outcomes=[],failures=[];
  let contract,review;
  try{
    contract=await interpretBrief(session,task);
    await saveJSON(resolve(directory,'shared-brief.json'),{taskId:task.taskId,brief:task.brief,contract,source:'ONE_REAL_GEMINI_INTERPRETATION_SHARED_IDENTICALLY_BY_ALL_METHODS'});
    for(const method of METHODS){
      const workspace=await createWorkspace({directory:resolve(directory,method),id:id+'-'+method,task,catalog,contract});
      if(!workspace.state.completed){
        try{if(method==='research')review=await runResearchPlanner(workspace,session);else await runFixedWorkflow(workspace,{search:method==='automl'});}
        catch(e){failures.push({method,error:e.message});const budget=await spend();if(budget.circuit||budget.unsettled)throw e;}
      }else if(method==='research'){
        try{const r=await readJSON(resolve(directory,id+'-research-REVIEW.json'));if(r.status!=='COMPLETED'||r.response?.name!=='review_commit')throw Error('UNFINISHED_REVIEW');review=validateResearchReview(r.response.args,workspace);}catch(e){if(e.code!=='ENOENT')failures.push({method,error:e.message});}
      }
      const result=workspace.finalPolicy();if(method==='research'&&(!review||review.verdict==='observe')){result.plan=NONE;result.artifact=null;}
      if(method==='research')await saveJSON(resolve(directory,'review.json'),review||{verdict:'observe',error:'Review unavailable; safe observation retained.'});
      outcomes.push({method,workspaceId:workspace.state.id,completed:workspace.state.completed&&!(method==='research'&&!review),policy:result,toolCalls:workspace.state.journal.length,toolFailures:workspace.state.journal.filter(j=>j.status==='FAILED').length,
        counts:{queries:workspace.state.journal.filter(j=>j.action==='query_warehouse').length,models:workspace.state.models.length,pilots:workspace.state.pilots.length},
        journal:workspace.state.journal,models:workspace.state.models.map(({artifact,rawArtifact,vectors,...m})=>m),pilots:workspace.state.pilots});
    }
  }finally{await session.close();}
  // This evaluator is deliberately outside the agent's tool interface.
  const ledger=await readJSON(resolve(ROOT,'.local/gcp/model-spend.json')),charges=ledger.entries.filter(e=>e.runId==='market-'+id),readerUSD=charges.filter(e=>e.stage==='research_shared_reader').reduce((n,e)=>n+e.chargedMicros,0)/1e6,actualUSD=charges.reduce((n,e)=>n+e.chargedMicros,0)/1e6;
  const control=runPolicy({id:id+'-CONTROL',seed:task.seed,scenario:task.scenario,catalog,plan:NONE,artifact:null,budgetCents:contract.budgetCents});
  const rows=outcomes.map(outcome=>{
    const score=runPolicy({id:id+'-'+outcome.method,seed:task.seed,scenario:task.scenario,catalog,...outcome.policy,budgetCents:contract.budgetCents,includeTrace:true});
    const allocatedUSD=outcome.method==='research'?actualUSD:readerUSD;
    const {artifact,...policy}=outcome.policy;
    return {...outcome,policy,seed:task.seed,scenario:task.scenario,score,allocatedModelUSD:allocatedUSD,deltaPlatformUSD:(score.platformProxyCents-control.platformProxyCents)/100-allocatedUSD,
      deltaMerchantUSD:(score.merchantContributionCents-control.merchantContributionCents)/100,deltaVolumeUSD:(score.retainedCents-control.retainedCents)/100};
  });
  const nativeRecords=(await readdir(directory)).filter(f=>f.endsWith('.json')&&!['result.json','shared-brief.json','review.json'].includes(f));
  const modelRecords=(await Promise.all(nativeRecords.map(f=>readJSON(resolve(directory,f))))).filter(r=>r.provider);
  const result={completed:true,id,taskId:task.taskId,brief:task.brief,contract,seed:task.seed,scenario:task.scenario,protocolHash:protocol.hash,
    methods:rows,control,failures,review,costs:{actualModelUSD:actualUSD,sharedReaderUSD:readerUSD,modelCalls:charges.length,methodCostAllocation:'Each method includes the same shared reader cost; only the research method includes its planning and review calls. Actual spend is never multiplied by the number of methods.'},providerModels:[...new Set(modelRecords.map(r=>r.provider.modelVersion).filter(Boolean))]};
  await saveJSON(resolve(directory,'result.json'),result);return result;
}

async function run(pilot=false){
  const protocol=pilot?{hash:'DEV-'+sha(await fingerprint()),suiteCapUSD:1}:await readJSON(resolve(BASE,'protocol.json'));
  if(!pilot)await verify(protocol);
  const tasks=pilot?[{...TASKS[0],seed:314,scenario:'rival_sale',taskId:'development-mission'}]:TASKS,missions=[];
  for(const task of tasks){if(!pilot)await verify(protocol);const result=await runMission(task,protocol,pilot);missions.push(result);console.log(JSON.stringify({progress:`${missions.length}/${tasks.length}`,id:result.id,cost:result.costs,methods:result.methods.map(m=>({method:m.method,completed:m.completed,tools:m.toolCalls,counts:m.counts,deltaUSD:m.deltaPlatformUSD,decision:m.policy.plan.strategy})),failures:result.failures}));await saveJSON(resolve(BASE,pilot?'pilot-progress.json':'progress.json'),{status:'RUNNING',completed:missions.length,total:tasks.length,missionIds:missions.map(m=>m.id)});}
  if(pilot)return;
  const estimate=(rows,key)=>({...pairedEstimate(rows,key),interval:'95% paired bootstrap over6 authored mission/seed cases; exploratory, not market-general'});
  const rows=missions.flatMap(m=>m.methods),summary=METHODS.map(method=>({method,completed:rows.filter(r=>r.method===method&&r.completed).length,metrics:Object.fromEntries(['deltaPlatformUSD','deltaMerchantUSD','deltaVolumeUSD'].map(k=>[k,estimate(rows.filter(r=>r.method===method),k)]))}));
  const research=rows.filter(r=>r.method==='research').map(r=>({...r,vsFixedUSD:r.deltaPlatformUSD-rows.find(b=>b.seed===r.seed&&b.method==='fixed').deltaPlatformUSD,vsAutoMLUSD:r.deltaPlatformUSD-rows.find(b=>b.seed===r.seed&&b.method==='automl').deltaPlatformUSD}));
  const result={schema:'research-workflow-v3',generatedAt:new Date().toISOString(),protocolHash:protocol.hash,missions:missions.length,summary,
    contrasts:{vsFixed:estimate(research,'vsFixedUSD'),vsAutoML:estimate(research,'vsAutoMLUSD')},
    costs:{actualModelUSD:missions.reduce((n,m)=>n+m.costs.actualModelUSD,0),modelCalls:missions.reduce((n,m)=>n+m.costs.modelCalls,0),...await spend()},
    integrity:{frozenEngineVerified:true,allOutcomesMature:rows.every(r=>r.score.matureOutcomes===7000),allAccountingChecksPassed:rows.every(r=>Object.values(r.score.checks).every(v=>v===0)),interpretations:missions.length},
    limitations:['Six-task capability pilot with authored business briefs, not real merchant requests or a representative ROI trial.','Development pilots are paired simulator experiments with independent random draws, not live-customer RCTs.','Feature engineering is bounded linear composition over seven observed inputs; no arbitrary code execution or nonlinear feature deployment.','The previous live demo is unchanged; this is a separate research workspace and evaluation runner.','Additional model cost is included. Local compute and operator labor are unpriced.','One agent-count ablation is not included: the design uses a planning LLM and an independent final reviewer.'],cases:missions};
  await verify(protocol);await saveJSON(resolve(BASE,'result.json'),result);await saveJSON(resolve(BASE,'progress.json'),{status:'COMPLETE',completed:missions.length,total:missions.length});console.log(JSON.stringify({status:'COMPLETE',summary,costs:result.costs},null,2));
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  if(process.argv[2]==='--freeze')await freeze();else if(process.argv[2]==='--pilot')await run(true);else if(process.argv[2]==='--run')await run();else throw Error('Use --pilot, --freeze or --run. Paid modes use the existing guarded Gemini client.');
}
