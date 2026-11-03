import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {frozenInputs} from '../research-lab/data.mjs';
import {createFreshWorld} from '../policy-lab/fresh-world.mjs';
import {pairedEstimate} from '../policy-lab/benchmark-stats.mjs';
import {assertFrozen} from '../campaign-controller/benchmark.mjs';
import {trainingRows,fitIncrementalFamily,FAMILIES} from './incremental.mjs';

export const ROOT=resolve(import.meta.dirname,'../..'),BASE=resolve(ROOT,'docs/agent-mesh/growth-lab');
export const SCENARIOS=['steady','rival_sale','budget_squeeze','supply_delay','returns_wave'];
export const CONFIG=Object.freeze({priorSeeds:[106001,106002,106003],developmentSeeds:[107001,107002],probeSeeds:[108001,108002,108003],testSeeds:[109001,109002,109003,109004,109005,109006,109007,109008],agentSeeds:[109001,109002],developmentScenarios:SCENARIOS.slice(0,4),heldOutScenario:'returns_wave',cutoff:45,days:100,customers:100,probeBudget:2,modelBudgetUSD:1});
export const sha=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
export const save=async(name,x)=>{const p=resolve(BASE,name);await mkdir(resolve(p,'..'),{recursive:true});await writeFile(p+'.tmp',JSON.stringify(x,null,2)+'\n');await(await import('node:fs/promises')).rename(p+'.tmp',p);};
export const read=async name=>JSON.parse(await readFile(resolve(BASE,name),'utf8'));
const none=()=>({id:'none',strategy:'observe',audience:'all',merchantIndices:[],maxOfferPct:0,duration:7,penalty:0,epsilon:0});
export const RECIPES=[
  {name:'reward-recommend',family:'reward',audience:'all',maxOfferPct:0},
  {name:'eligible-recommend',family:'eligible',audience:'all',maxOfferPct:0},
  {name:'incremental-recommend',family:'incremental',audience:'all',maxOfferPct:0},
  {name:'incremental-reactivate',family:'incremental',audience:'lapsed',maxOfferPct:0},
  {name:'incremental-coupon',family:'incremental',audience:'lapsed',maxOfferPct:5},
  {name:'eligible-coupon',family:'eligible',audience:'lapsed',maxOfferPct:5}
].map(r=>({...r,merchantIndices:[0,1,2],durationDays:7,penaltyUSD:0}));

export function observed({seed,scenario,catalog}){
  const r=createFreshWorld({id:`GROWTH-OBS-${seed}-${scenario}`,seed,scenario,catalog,startedAt:'2026-10-26T01:00:00.000Z',settings:{customerCount:100,days:100,budgetCents:30000}});
  while(r.world.tick<CONFIG.cutoff)r.step();return r;
}
export function validateSpec(s){
  const keys=['family','audience','merchantIndices','maxOfferPct','durationDays','penaltyUSD'];
  if(!s||keys.some(k=>!Object.hasOwn(s,k))||Object.keys(s).some(k=>!keys.includes(k))||!FAMILIES.includes(s.family)||!['all','lapsed'].includes(s.audience)||!Array.isArray(s.merchantIndices)||!s.merchantIndices.length||new Set(s.merchantIndices).size!==s.merchantIndices.length||s.merchantIndices.some(i=>![0,1,2].includes(i))||![0,5].includes(s.maxOfferPct)||![3,7].includes(s.durationDays)||![0,.05,.1].includes(s.penaltyUSD))throw Error('INVALID_EXPERIMENT_SPEC');
  return {...s,merchantIndices:[...s.merchantIndices].sort()};
}
export const specOf=r=>validateSpec(Object.fromEntries(['family','audience','merchantIndices','maxOfferPct','durationDays','penaltyUSD'].map(k=>[k,r[k]])));

export function rollout({seed,scenario,catalog,spec=null,model=null,costMicros=0,trace=false}){
  if(spec&&!model)throw Error('ACTIVE_CAMPAIGN_MODEL_REQUIRED');
  const r=observed({seed,scenario,catalog}),start=CONFIG.cutoff+1;
  r.step(); // Common, fixed publication delay. No wall-clock advantage.
  if(spec){spec=validateSpec(spec);r.publish({id:'CAMPAIGN-'+sha({spec,model:model.modelId}).slice(0,16),strategy:spec.maxOfferPct?'mixed':'recommendations',audience:spec.audience,merchantIndices:spec.merchantIndices,maxOfferPct:spec.maxOfferPct,duration:spec.durationDays,penalty:spec.penaltyUSD,epsilon:0},model,CONFIG.cutoff);r.world.goal.budgetCents=r.world.live.spendCents+r.world.live.discountCents+500;}
  else r.publish(none(),null,CONFIG.cutoff);
  while(r.world.tick<114){if(spec&&r.world.tick===start+spec.durationDays)r.world.goal.budgetCents=30000;r.step();}
  const score=r.result(spec?'candidate':'organic');if(Object.values(score.checks).some(v=>v!==0))throw Error('SIMULATOR_INVARIANT_FAILED');
  return {...score,costMicros,platformAfterInferenceUSD:score.platformProxyCents/100-costMicros/1e6,
    trace:trace?r.actions.filter(a=>a.day>=start&&(a.selected_action!=='none'||a.order_id)).slice(0,60).map(a=>({day:a.day,customerId:a.customer_id,action:a.selected_action,orderId:a.order_id,rewardCents:a.reward_cents,modelId:a.model_id,order:a.order_id?r.orders.get(a.order_id):null})):undefined};
}
function delta(score,control){return {...score,deltaUSD:score.platformAfterInferenceUSD-control.platformAfterInferenceUSD,merchantDeltaUSD:(score.merchantContributionCents-control.merchantContributionCents)/100,volumeDeltaUSD:(score.retainedCents-control.retainedCents)/100,platformGrowthPct:100*(score.platformAfterInferenceUSD-control.platformAfterInferenceUSD)/control.platformAfterInferenceUSD};}
export async function prepare(){
  await assertFrozen(JSON.parse(await readFile(resolve(ROOT,'docs/policy-lab/benchmarks/v5/protocol.json'))));
  const {catalog,originalBenchmarkHash}=await frozenInputs(),rows=[];
  for(const seed of CONFIG.priorSeeds)rows.push(...trainingRows(observed({seed,scenario:'steady',catalog}),CONFIG.cutoff));
  return {catalog,priorRows:rows,engineHash:originalBenchmarkHash};
}
export function caseContext({seed,scenario,catalog,priorRows}){
  const r=observed({seed,scenario,catalog}),rows=[...priorRows,...trainingRows(r,CONFIG.cutoff)],models=new Map();
  return {evidence:r.evidence(),rows,model(family){if(!models.has(family))models.set(family,fitIncrementalFamily(family,rows,{cutoffDay:CONFIG.cutoff}));return models.get(family);}};
}
export function probe({spec,model,scenario,catalog}){
  const rows=CONFIG.probeSeeds.map(seed=>{const control=rollout({seed,scenario,catalog}),treatment=rollout({seed,scenario,catalog,spec,model});return {seed,deltaUSD:treatment.platformAfterInferenceUSD-control.platformAfterInferenceUSD,merchantDeltaUSD:(treatment.merchantContributionCents-control.merchantContributionCents)/100};});
  const estimate=pairedEstimate(rows,'deltaUSD'),merchant=pairedEstimate(rows,'merchantDeltaUSD');
  const artifact={spec,modelId:model.modelId,modelHash:sha(model),scenario,estimate,merchant,rows,scope:'Three disjoint development-probe seeds; scenario adaptation allowed. Selection feedback, not final-test evidence.'};
  return {...artifact,id:'PROBE-'+sha(artifact).slice(0,16),launchable:estimate.mean>0&&merchant.mean>=0&&estimate.worst>=-5};
}
export function summarize(rows,methods){
  return methods.map(method=>{const xs=rows.filter(x=>x.method===method);return {method,platform:pairedEstimate(xs,'deltaUSD'),merchant:pairedEstimate(xs,'merchantDeltaUSD'),growth:pairedEstimate(xs,'platformGrowthPct'),volume:pairedEstimate(xs,'volumeDeltaUSD'),scenarios:SCENARIOS.map(s=>{const sub=xs.filter(x=>x.scenario===s);return {scenario:s,cases:sub.length,meanUSD:sub.reduce((n,x)=>n+x.deltaUSD,0)/Math.max(1,sub.length)};})};});
}
async function protocol(input){
  const code=Object.fromEntries(await Promise.all(['growth-lab','incremental'].map(async f=>[f,sha(await readFile(resolve(import.meta.dirname,f+'.mjs'),'utf8'))])));
  const p={version:1,config:CONFIG,code,engineHash:input.engineHash,catalogHash:sha(input.catalog),priorHash:sha(input.priorRows),recipes:RECIPES,
    primaryMetric:'Paired modeled platform contribution after inference versus no campaign; not actual PayPal profit.',
    materialGrowthTargetPct:10,positiveGate:'Mean and lower95 seed-cluster interval above zero; merchant lower95 not below zero. Ten-percent target reported separately.',
    fairness:'Same frozen economics, exogenous draws,100 shoppers,100 shopping days,14-day tail,45-day evidence,one-day publication delay and$5/7-day campaign envelope. Prior and current mature randomized training only. Agents and numeric selector get at most2 probes of3 independent seeds. No arbitrary SQL or hidden evaluation outcomes.',
    scenarioTransfer:'returns_wave excluded from human development/tuning. During evaluation, runtime agents may test their proposal on separate probe seeds in the current scenario; this is adaptation, not zero-shot transfer.',
    phases:'One six-recipe development pass; freeze before40 numerical holdout cases and10 fresh-agent cases. No tuning after opening test outcomes.',
    modelCost:'At most$1 new model usage for this study, within existing$8 local/$50 user ceiling; no native payments.'};p.hash=sha(p);
  try{if((await read('protocol.json')).hash!==p.hash)throw Error('GROWTH_PROTOCOL_CHANGED');}catch(e){if(e.code!=='ENOENT')throw e;await save('protocol.json',p);}return p;
}
async function main(){
  const input=await prepare(),p=await protocol(input);
  if(!process.argv.includes('--development')&&!process.argv.includes('--evaluate')){console.log(JSON.stringify({ready:true,hash:p.hash,heldoutCases:40,freshAgentCases:10}));return;}
  if(process.argv.includes('--development')){
    try{const prior=await read('development.json');console.log(JSON.stringify({alreadyCompleted:true,ranking:prior.ranking}));return;}catch(e){if(e.code!=='ENOENT')throw e;}
    const rows=[];
    for(const seed of CONFIG.developmentSeeds)for(const scenario of CONFIG.developmentScenarios){
      const c=caseContext({...input,seed,scenario}),control=rollout({...input,seed,scenario});
      for(const recipe of RECIPES){const score=rollout({...input,seed,scenario,spec:specOf(recipe),model:c.model(recipe.family)});const {daily,fits,publications,...small}=delta(score,control);rows.push({method:recipe.name,...small});}
      console.log(JSON.stringify({phase:'development',seed,scenario,completed:rows.length}));
    }
    const ranking=RECIPES.map(r=>({name:r.name,...pairedEstimate(rows.filter(x=>x.method===r.name),'deltaUSD')})).sort((a,b)=>b.mean-a.mean);
    await save('development.json',{protocolHash:p.hash,rows,ranking});console.log(JSON.stringify({ranking}));return;
  }
  const dev=await read('development.json');if(dev.protocolHash!==p.hash)throw Error('DEVELOPMENT_PROTOCOL_CHANGED');
  const candidates=dev.ranking.slice(0,2).map(x=>RECIPES.find(r=>r.name===x.name)),methods=[...RECIPES.map(r=>r.name),'numeric-selector','organic'];
  const rows=[];
  for(const seed of CONFIG.testSeeds)for(const scenario of SCENARIOS){
    const file=`numeric/${seed}-${scenario}.json`;let record;
    try{record=await read(file);if(record.protocolHash!==p.hash)throw Error('EVALUATION_PROTOCOL_CHANGED');}catch(e){
      if(e.code!=='ENOENT')throw e;
      const c=caseContext({...input,seed,scenario}),control=rollout({...input,seed,scenario}),scores=[];
      for(const recipe of RECIPES){const score=rollout({...input,seed,scenario,spec:specOf(recipe),model:c.model(recipe.family)});const {daily,fits,publications,...small}=delta(score,control);scores.push({method:recipe.name,...small});}
      const pilots=candidates.map(r=>probe({...input,scenario,spec:specOf(r),model:c.model(r.family)}));
      const best=pilots.filter(x=>x.launchable).sort((a,b)=>b.estimate.mean-a.estimate.mean)[0];
      const selected=best?rollout({...input,seed,scenario,spec:best.spec,model:c.model(best.spec.family)}):control;
      for(const [method,result]of [['numeric-selector',selected],['organic',control]]){const {daily,fits,publications,...small}=delta(result,control);scores.push({method,...small});}
      record={protocolHash:p.hash,seed,scenario,scores,probeIds:pilots.map(p=>p.id),selectedProbe:best?.id||null};await save(file,record);
    }
    rows.push(...record.scores);console.log(JSON.stringify({phase:'holdout',completedCases:rows.length/methods.length,totalCases:40}));
  }
  const result={protocolHash:p.hash,scope:'NUMERICAL_METHODS_ONLY_FRESH_AGENTS_SEPARATE',rows,summary:summarize(rows,methods),modelCalls:0,localComputeUnpriced:true};await save('numeric-result.json',result);console.log(JSON.stringify({summary:result.summary.map(x=>({method:x.method,mean:x.platform.mean,low:x.platform.low,high:x.platform.high,growthPct:x.growth.mean}))}));
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
