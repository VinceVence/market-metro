import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {openCommerceHarnessV2} from '../commerce-expanded/harness-v2/controller.mjs';
import {createTrialTool,verifyEconomy} from '../commerce-expanded/harness-v2/trials.mjs';
import {canonicalHash,MODEL_CAP_MICROS} from '../commerce-expanded/harness-v2/contracts.mjs';
import {read,scoreCampaign,assertBinding} from '../commerce-expanded/harness-v2/tools.mjs';
import {runCoordinatedCase} from '../commerce-expanded/runner.mjs';
import {observeGrowthWorld} from '../commerce-expanded/environment.mjs';
import {openAllocator} from '../commerce-deadlines/solver.mjs';
import {withPlannerFeed} from './planner-gate.mjs';
import {observedMarket} from './planner-demo.mjs';
import {llmTrainingAdvisor} from './planner-training.mjs';

if(!process.argv.includes('--run'))throw Error('Use --run for two capped, fresh Gemini reviews and one matched campaign.');
const id='ontology-llm-campaign-1',root=join('.local',id),folder='docs/ontology/live';
await mkdir(root,{recursive:true});await mkdir(folder,{recursive:true});
const protocol={id,settings:{seed:92111706,regime:'reactivation'},reviewDay:30,settlementDay:126,
  arms:['fixed','planner','ontology'],reviewsPerPlanner:1,decisionsPerReview:6,modelCheck:true,
  route:'first_review_pro',perPlannerCapMicros:MODEL_CAP_MICROS,studyCapMicros:MODEL_CAP_MICROS*2,
  overallUserCapUSD:50,selection:'Original judge seed, chosen before either fresh decision. No selection or reruns based on the outcome.',
  comparison:'Same frozen market and financial verifier. Planner selects datasets and two conventional model recipes. Ontology planner selects a dataset and exact admissible features for a product-contact model, alongside a conventional control. Both propose and can revise campaigns. Each tested publication is held through settlement.',
  limitations:'One paired scenario. Counterfactual campaigns have independent fresh LLM decisions. Financial outcomes are simulated. Native PayPal calls are disabled.'};
const [environment,{view,runId},prior,development]=await Promise.all([
  verifyEconomy(),observedMarket(),read('docs/commerce-growth/team-1/training/model.json'),read('docs/commerce-growth/team-1/development/results.json')
]);
const fixed=development.selectedFixed;
const paths=[...new Set([...Object.keys(environment.economyHashes),...Object.keys(environment.implementationHashes),
  'scripts/ontology/live-campaign.mjs','scripts/ontology/planner-training.mjs','scripts/ontology/training-advisor.mjs',
  'scripts/ontology/training.mjs','scripts/ontology/train-features.py','scripts/ontology/planner-gate.mjs',
  'scripts/commerce-expanded/harness-v2/model-check.mjs','scripts/commerce-expanded/harness-v2/controller.mjs',
  'scripts/agent-mesh/model-client.mjs','benchmark/vertex.mjs','docs/commerce-growth/autonomy-1/funding-training/dataset.json'])];
const fingerprints=async()=>Object.fromEntries(await Promise.all(paths.map(async path=>
  [path,createHash('sha256').update(await readFile(path)).digest('hex')])));
const registration={protocol,sources:await fingerprints(),economyHash:canonicalHash(environment.economyHashes),
  snapshotHash:canonicalHash(view),fixed,priorHash:canonicalHash(prior)};
async function optional(path){try{return await read(path);}catch(e){if(e.code!=='ENOENT')throw e;return null;}}
async function save(path,value){await writeFile(path+'.tmp',JSON.stringify(value,null,2)+'\n');await rename(path+'.tmp',path);}
const registered=await optional(folder+'/registration.json');
if(registered)assert.deepEqual(registration,registered,'Registered method changed');
else await writeFile(folder+'/registration.json',JSON.stringify(registration,null,2)+'\n',{flag:'wx'});
const prefix='market-HARNESS-V2-'+id+'-';
async function spending(){
  const ledger=await read('.local/gcp/model-spend.json');
  assert.equal(ledger.projectId,'supply-yard-pilot-261021');
  assert.ok(!ledger.circuit&&ledger.entries.every(e=>e.status==='settled'),'Unresolved provider charge');
  const entries=ledger.entries.filter(e=>e.runId.startsWith(prefix));
  const total=list=>list.reduce((sum,e)=>sum+e.chargedMicros,0);
  const project=total(ledger.entries),study=total(entries);
  assert.ok(project<=Math.min(ledger.lifetimeCapMicros,protocol.overallUserCapUSD*1e6));
  assert.ok(study<=protocol.studyCapMicros);
  return {entries,project,study,available:Math.min(ledger.lifetimeCapMicros,protocol.overallUserCapUSD*1e6)-project};
}
const initial=await spending();
assert.ok(initial.available>=protocol.studyCapMicros-initial.study,'Insufficient budget to complete both arms');
const trialTool=await createTrialTool({fixed,prior,marketProfile:'expanded-12x600'}),reviews={};
for(const arm of ['planner','ontology']){
  const dir=join(root,arm),lockPath=join(dir,'review.json');await mkdir(dir,{recursive:true});
  const cached=await optional(lockPath);
  if(cached){assert.equal(cached.registrationHash,canonicalHash(registration));reviews[arm]=cached;continue;}
  let state=await optional(join(dir,'checkpoints.json'));
  const already=(await spending()).entries.some(e=>e.runId===prefix+arm);
  if(state||already){assert.ok(state&&!state.pending,'Partly completed review requires recovery from its checkpoints');}
  else{
    console.log('Fresh Gemini review',arm);
    const planner=await openCommerceHarnessV2({id:id+'-'+arm,dir,mode:'single',modelCheck:true,prior,incumbent:fixed.config,
      trainingAdvisor:arm==='ontology'?{...llmTrainingAdvisor,required:true}:null,trialFactory:async()=>trialTool,
      onCheckpoint:async()=>{
        const s=await read(join(dir,'checkpoints.json')),cp=s.checkpoints.at(-1);
        if(cp?.status==='VALIDATED')console.log(arm,cp.toolName,cp.output.rationale);
        if(cp?.status==='COMPLETED'&&['LOCAL_TRAINING_TOOL','TRUSTED_PUBLISHER'].includes(cp.actor))console.log(arm,cp.actor,cp.output.modelId??cp.output.decision);
      }});
    const gated=withPlannerFeed(planner,{runId,mapping:'warehouse'});
    try{await gated.plan(structuredClone(view));}finally{await gated.close();}
    state=await read(join(dir,'checkpoints.json'));
  }
  const decisions=state.checkpoints.filter(c=>c.actor==='GEMINI'),events=decisions.flatMap(c=>c.provider??[]);
  const ledger=(await spending()).entries.filter(e=>e.runId===prefix+arm);
  assert.deepEqual(events.map(e=>e.reservationId).sort(),ledger.map(e=>e.id).sort());
  const paidMicros=ledger.reduce((s,e)=>s+e.chargedMicros,0);
  assert.equal(events.reduce((s,e)=>s+e.modelCostMicros,0),paidMicros);
  assert.ok(events.every(e=>['settled','rejected'].includes(e.status)));
  const contract=state.schedule.at(-1)??null,models={};
  for(const cp of state.checkpoints.filter(c=>c.actor==='LOCAL_TRAINING_TOOL'&&c.status==='COMPLETED')){
    const model=await read(cp.output.artifactFile);models[model.modelHash]=model;
  }
  if(contract){assert.equal(contract.context.snapshotHash,registration.snapshotHash);assertBinding(contract,models[contract.modelHash]);}
  const result={arm,registrationHash:canonicalHash(registration),paidMicros,contract,models,
    complete:!state.failed&&decisions.length===6&&decisions.every(c=>c.status==='VALIDATED'),
    decisions:decisions.map(c=>({tool:c.toolName,status:c.status,input:c.input,choice:c.output,error:c.error,
      provider:(c.provider??[]).map(e=>({id:e.reservationId,responseId:e.responseId,model:e.configuredModel,version:e.modelVersion,status:e.status,micros:e.modelCostMicros}))})),
    toolResults:state.checkpoints.filter(c=>c.actor!=='GEMINI').map(c=>({actor:c.actor,status:c.status,input:c.input,output:c.output,error:c.error}))};
  await save(lockPath,result);reviews[arm]=result;
  console.log('Review locked',arm,'USD',paidMicros/1e6,'complete',result.complete);
  if(!events.length)throw Error('No provider inference completed; preserved review before stopping.');
}
assert.deepEqual(await fingerprints(),registration.sources);
const responseIds=Object.values(reviews).flatMap(r=>r.decisions.flatMap(d=>d.provider.filter(e=>e.status==='settled').map(e=>e.responseId)));
assert.ok(responseIds.every(Boolean)&&new Set(responseIds).size===responseIds.length,'Model responses must be fresh');
const allocator=openAllocator(),rows={},daily={},examples={};
let identity;
try{
  for(const arm of protocol.arms){
    const review=reviews[arm],contract=review?.contract;
    const controller=contract?{plan:v=>scoreCampaign(v,{contract,model:review.models[contract.modelHash],prior})}:null;
    const projection=w=>{const v=observeGrowthWorld(w);if(v.day===protocol.reviewDay)assert.equal(canonicalHash(v),registration.snapshotHash);return v;};
    const result=await runCoordinatedCase(protocol.settings,fixed,{prior,allocator,controller,trace:true,observationProjector:projection});
    const factors=[result.initialHash,result.opportunityHash,result.consentHash,result.incomeCents];
    identity??=factors;assert.deepEqual(factors,identity);assert.equal(result.unpaidLiabilities,0);assert.ok(result.reliability.invariantsPassed);
    await save(join(root,arm+'-settled.json'),result);
    const cost=(review?.paidMicros??0)/1e6;
    rows[arm]={paypal:result.platformUSD-cost,paypalBeforeAI:result.platformUSD,merchants:result.retailerUSD,
      purchases:result.retainedPurchases,volume:result.retainedVolumeUSD,contacts:result.contactCount,
      recommendations:result.recommendationsSent,exactProductBaskets:result.recommendationPurchases,
      outreachCost:result.outreachCostUSD,aiCost:cost,unpaidLiabilities:result.unpaidLiabilities};
    const orders=new Map(result.trace.orders.map(o=>[o.requestId,o]));
    daily[arm]=result.trace.decisions.map(d=>({day:d.day+1,contacts:d.contacts.length,recommendations:d.contacts.filter(c=>c.kind==='recommend').length,
      captured:d.commerce.captured,retained:d.results.filter(c=>{const o=orders.get(c.requestId);return o&&!['SETTLED','PENDING_FUNDS'].includes(o.refundStatus);}).length}));
    examples[arm]=result.trace.contacts.filter(c=>orders.has(c.requestId)).slice(0,8).map(c=>{
      const order=orders.get(c.requestId);return {contactDay:c.day+1,customerId:c.customerId,kind:c.kind,catalogId:c.catalogId,
        responded:c.responded,immediateFunding:c.authorized,orderId:order.id,captureDay:order.day+1,grossUSD:order.grossCents/100,
        retained:!['SETTLED','PENDING_FUNDS'].includes(order.refundStatus),feeUSD:order.feeCents/100};
    });
    console.log('Settled',arm,JSON.stringify(rows[arm]));
  }
}finally{allocator.close();}
const finalSpend=await spending();assert.deepEqual(await fingerprints(),registration.sources);await verifyEconomy();
const round=n=>Math.round(n*1e6)/1e6;
const delta=(a,b)=>Object.fromEntries(['paypal','merchants','purchases','volume'].map(k=>[k,round(rows[a][k]-rows[b][k])]));
const result={protocol,registrationHash:canonicalHash(registration),identity,rows,daily,examples,
  reviews:Object.fromEntries(Object.entries(reviews).map(([arm,{models,...r}])=>[arm,{...r,models:Object.values(models).map(m=>({id:m.id,modelHash:m.modelHash,spec:m.artifact.spec,fields:m.artifact.trainingFields??m.artifact.featureNames,report:m.report}))}])),
  comparisons:{plannerVsFixed:delta('planner','fixed'),ontologyVsFixed:delta('ontology','fixed'),ontologyVsPlanner:delta('ontology','planner')},
  cost:{studyUSD:finalSpend.study/1e6,projectUSD:finalSpend.project/1e6,capUSD:protocol.studyCapMicros/1e6,basis:'Provider usage tokens at the existing ledger price. Billing invoice may differ.'},
  calls:responseIds.length,nativePayments:0,scope:'One complete simulated campaign per policy on the original judge seed. Fresh Gemini decisions, real local training, modeled financial settlement.'};
await save('demo/data/ontology-live-campaign.json',result);
console.log('Campaign comparison complete',JSON.stringify({rows,comparisons:result.comparisons,cost:result.cost}));
