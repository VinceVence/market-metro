import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {frozenInputs} from '../research-lab/data.mjs';
import {assertFrozen} from '../campaign-controller/benchmark.mjs';
import {createFreshWorld} from '../policy-lab/fresh-world.mjs';
import {ACTIONS} from '../policy-lab/economy.mjs';
import {pairedEstimate} from '../policy-lab/benchmark-stats.mjs';

export const ROOT=resolve(import.meta.dirname,'../..'),BASE=resolve(ROOT,'docs/agent-mesh/aggressive-policy');
export const SCENARIOS=['steady','rival_sale','budget_squeeze','supply_delay','returns_wave'];
export const POLICIES=[
 {id:'organic',floor:0,loyal:false,risk:false,weekdays:null},
 {id:'broad-full-price',floor:0,loyal:true,risk:false,weekdays:null},
 {id:'high-value',floor:.5,loyal:false,risk:false,weekdays:null},
 {id:'high-value-loyal',floor:.5,loyal:true,risk:false,weekdays:null},
 {id:'high-value-weekly',floor:.5,loyal:true,risk:false,weekdays:[0,1]},
 {id:'return-aware',floor:0,loyal:true,risk:true,weekdays:null},
 {id:'high-value-return-aware',floor:.5,loyal:true,risk:true,weekdays:null},
 {id:'high-value-weekly-return-aware',floor:.5,loyal:true,risk:true,weekdays:[0,1]}
];
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const read=async f=>JSON.parse(await readFile(resolve(BASE,f),'utf8'));
export const save=async(f,x)=>{const p=resolve(BASE,f);await mkdir(resolve(p,'..'),{recursive:true});await writeFile(p+'.tmp',JSON.stringify(x,null,2)+'\n');await rename(p+'.tmp',p);};
export function matureMerchantRisk(runner){
 const w=runner.world;
 return w.merchants.map((m,index)=>{
  const mature=[...runner.orders.values()].filter(o=>o.merchant_id===m.merchant_id&&Date.parse(o.event_ts)<=Date.parse(w.startedAt)+(w.tick-14)*86400000);
  const returned=mature.filter(o=>o.refund>0).length;
  return {index,matureOrders:mature.length,returns:returned,posteriorReturnRate:(returned+1)/(mature.length+20),excluded:mature.length>=20&&(returned+1)/(mature.length+20)>.1};
 });
}
export function scheduleModel(policy){
 return {modelId:'AUTHORED-'+policy.id,type:'transparent_catalog_rule',cutoffDay:30,arms:Object.fromEntries(ACTIONS.map(action=>[action,{count:0,coef:action==='none'?[0,0,0,0,0,0,0]:action.startsWith('recommend:')?[-policy.floor,0,0,0,1,policy.loyal?.01:0,0]:[-10000,0,0,0,0,0,0],inverse:Array.from({length:7},()=>Array(7).fill(0))}])),
  disclosure:'Authored transparent policy, not an LLM or trained model. Scores rank catalog price and optional observed merchant familiarity; they are not predicted dollars.'};
}
export function runAggressive({seed,scenario,catalog,policy,trace=false}){
 const runner=createFreshWorld({id:`AGGRESSIVE-${seed}-${scenario}-${policy.id}`,seed,scenario,catalog,startedAt:'2026-10-26T01:00:00.000Z',settings:{customerCount:100,days:100,budgetCents:5000}}),model=scheduleModel(policy),decisions=[];
 while(runner.world.tick<114){
  const w=runner.world,day=w.tick;
  if(day>=30&&day<100&&policy.id!=='organic'){
   const risk=matureMerchantRisk(runner),indices=risk.filter(m=>!policy.risk||!m.excluded).map(m=>m.index),active=!policy.weekdays||policy.weekdays.includes(day%7);
   const plan={id:policy.id,strategy:active?'recommendations':'observe',audience:'all',merchantIndices:active?indices:[],maxOfferPct:0,duration:1,penalty:0,epsilon:0};
   runner.publish(plan,model,day);
   if(day===30||day%7===0||risk.some(m=>m.excluded))decisions.push({day,active,merchantIndices:plan.merchantIndices,risk,actor:'CODE_EXECUTION_OF_PREDECLARED_POLICY'});
  }
  runner.step();
 }
 const score=runner.result(policy.id);if(Object.values(score.checks).some(x=>x!==0))throw Error('POLICY_INVARIANT_FAILED');
 return {...score,decisions:trace?decisions:undefined,trace:trace?runner.actions.filter(a=>a.day>=30&&a.selected_action!=='none').slice(0,100).map(a=>({day:a.day,customerId:a.customer_id,action:a.selected_action,orderId:a.order_id,rewardCents:a.reward_cents,order:a.order_id?runner.orders.get(a.order_id):null})):undefined};
}
async function main(){
 await assertFrozen(JSON.parse(await readFile(resolve(ROOT,'docs/policy-lab/benchmarks/v5/protocol.json'))));
 const {catalog,originalBenchmarkHash}=await frozenInputs();
 const p={version:1,codeHash:hash(await readFile(import.meta.filename,'utf8')),engineHash:originalBenchmarkHash,catalogHash:hash(catalog),policies:POLICIES,developmentSeeds:[110001,110002,110003,110004],evaluationSeeds:Array.from({length:16},(_,i)=>111001+i),scenarios:SCENARIOS,
  authority:'All non-control policies can operate throughout days30–99, with a shared$50 virtual campaign budget. Original seven-day contact limit, stock and merchant margin constraints stay fixed. No coupons in this capacity test; no real payments.',
  scope:'New policy class and execution envelope. Old seven-day/$5 results remain historical. Every competitor receives the same expanded authority. These are transparent numerical baselines, not agent results.',
  selection:'Select one policy by mean paired development platform value, requiring nonnegative mean merchant contribution. Evaluate all policies on16 fresh seeds without subsequent tuning. Primary claim concerns the preselected policy.',
  metric:'Retained fees minus processing, support and outreach, with14-day refund tail; synthetic economic proxy, not actual PayPal profit.',cloudCalls:0};p.hash=hash(p);
 try{if((await read('protocol.json')).hash!==p.hash)throw Error('PROTOCOL_CHANGED');}catch(e){if(e.code!=='ENOENT')throw e;await save('protocol.json',p);}
 const stage=process.argv.includes('--evaluate')?'evaluation':'development',seeds=stage==='development'?p.developmentSeeds:p.evaluationSeeds,rows=[];
 let selection=null;if(stage==='evaluation')selection=(await read('development.json')).selectedPolicy;
 for(const seed of seeds)for(const scenario of SCENARIOS){
  const file=`${stage}/${seed}-${scenario}.json`;let record;
  try{record=await read(file);if(record.protocolHash!==p.hash)throw Error('CASE_PROTOCOL_CHANGED');}catch(e){
   if(e.code!=='ENOENT')throw e;const control=runAggressive({seed,scenario,catalog,policy:POLICIES[0]}),scores=[];
   for(const policy of POLICIES){const s=policy.id==='organic'?control:runAggressive({seed,scenario,catalog,policy});const {daily,fits,publications,...small}=s;
    scores.push({...small,deltaUSD:(s.platformProxyCents-control.platformProxyCents)/100,merchantDeltaUSD:(s.merchantContributionCents-control.merchantContributionCents)/100,volumeDeltaUSD:(s.retainedCents-control.retainedCents)/100,growthPct:100*(s.platformProxyCents-control.platformProxyCents)/control.platformProxyCents});}
   record={protocolHash:p.hash,seed,scenario,scores};await save(file,record);
  }
  rows.push(...record.scores);console.log(JSON.stringify({stage,seed,scenario,completed:rows.length/POLICIES.length,total:seeds.length*5}));
 }
 const stats=POLICIES.map(p=>({policy:p.id,platform:pairedEstimate(rows.filter(r=>r.policy===p.id),'deltaUSD'),merchant:pairedEstimate(rows.filter(r=>r.policy===p.id),'merchantDeltaUSD'),volume:pairedEstimate(rows.filter(r=>r.policy===p.id),'volumeDeltaUSD'),growth:pairedEstimate(rows.filter(r=>r.policy===p.id),'growthPct')}));
 if(stage==='development')selection=[...stats].filter(s=>s.policy!=='organic'&&s.merchant.mean>=0).sort((a,b)=>b.platform.mean-a.platform.mean)[0]?.policy||'organic';
 const report={protocolHash:p.hash,stage,selectedPolicy:selection,rows,stats,cloudCalls:0};await save(stage+'.json',report);console.log(JSON.stringify({stage,selectedPolicy:selection,stats:stats.map(s=>({policy:s.policy,mean:s.platform.mean,low:s.platform.low,high:s.platform.high,merchant:s.merchant.mean,growth:s.growth.mean}))}));
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
