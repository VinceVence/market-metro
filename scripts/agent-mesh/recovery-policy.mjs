import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {createFreshWorld} from '../policy-lab/fresh-world.mjs';
import {ACTIONS} from '../policy-lab/economy.mjs';
import {frozenInputs} from '../research-lab/data.mjs';
import {pairedEstimate} from '../policy-lab/benchmark-stats.mjs';
import {assertFrozen} from '../campaign-controller/benchmark.mjs';
export const ROOT=resolve(import.meta.dirname,'../..'),BASE=resolve(ROOT,'docs/agent-mesh/recovery-policy');
export const SCENARIOS=['steady','rival_sale','budget_squeeze','supply_delay','returns_wave'];
export const POLICIES=[
 {id:'organic',trigger:'never',audience:'all'},
 {id:'quality-route-all',trigger:'merchant-risk',audience:'all'},
 {id:'quality-route-refunded',trigger:'merchant-risk',audience:'refunded'},
 {id:'refund-recovery',trigger:'always',audience:'refunded'},
 {id:'quality-route-high-value',trigger:'merchant-risk',audience:'high-value'},
 {id:'quality-route-low-value',trigger:'merchant-risk',audience:'low-value'}
];
export const sha=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
export const save=async(f,x)=>{const p=resolve(BASE,f);await mkdir(resolve(p,'..'),{recursive:true});await writeFile(p+'.tmp',JSON.stringify(x,null,2)+'\n');await rename(p+'.tmp',p);};
const read=async f=>JSON.parse(await readFile(resolve(BASE,f),'utf8'));
export function recentRisk(r){return r.world.merchants.map((m,index)=>{
 const end=Date.parse(r.world.startedAt)+(r.world.tick-14)*86400000;
 const orders=[...r.orders.values()].filter(o=>o.merchant_id===m.merchant_id&&Date.parse(o.event_ts)<=end).sort((a,b)=>b.event_ts.localeCompare(a.event_ts)||b.order_id.localeCompare(a.order_id)).slice(0,40);
 const returned=orders.filter(o=>o.refund>0).length;return {index,n:orders.length,returns:returned,rate:(returned+1)/(orders.length+20),excluded:orders.length>=20&&(returned+1)/(orders.length+20)>.1};
});}
export function modelFor(p){
 const coef=p.audience==='refunded'?[-.001,0,0,0,0,.00001,1]:p.audience==='high-value'?[-.5,0,0,0,1,.01,0]:p.audience==='low-value'?[.5,0,0,0,-1,.01,0]:[1,0,0,0,0,.01,0];
 return {type:'authored_recovery_rule',modelId:'RECOVERY-'+p.id,cutoffDay:30,arms:Object.fromEntries(ACTIONS.map(a=>[a,{count:0,coef:a==='none'?Array(7).fill(0):a.startsWith('recommend:')?coef:[-10000,0,0,0,0,0,0],inverse:Array.from({length:7},()=>Array(7).fill(0))}]))};
}
export function runRecovery({seed,scenario,catalog,policy,days=400}){
 const r=createFreshWorld({id:`RECOVERY-${seed}-${scenario}-${policy.id}`,seed,scenario,catalog,startedAt:'2026-10-26T01:00:00.000Z',settings:{customerCount:100,days,budgetCents:5000}}),model=modelFor(policy);const activations=[];let signature=null;
 while(r.world.tick<days+14){const day=r.world.tick;
  if(day>=30&&day<100&&policy.id!=='organic'){
   const risk=recentRisk(r),active=policy.trigger==='always'||risk.some(m=>m.excluded),indices=risk.filter(m=>!m.excluded).map(m=>m.index);
   r.publish({id:policy.id,strategy:active?'recommendations':'observe',audience:'all',merchantIndices:active?indices:[],maxOfferPct:0,duration:1,penalty:0,epsilon:0},model,day);
   const key=JSON.stringify({active,indices});if(key!==signature){activations.push({day,active,indices,risk});signature=key;}
  }r.step();
 }
 if(r.actions.some(a=>a.day>=100&&a.selected_action!=='none'))throw Error('LATE_OUTREACH');
 const result=r.result(policy.id);if(Object.values(result.checks).some(x=>x!==0))throw Error('RECOVERY_INVARIANT_FAILED');
 return {...result,activations};
}
async function main(){
 await assertFrozen(JSON.parse(await readFile(resolve(ROOT,'docs/policy-lab/benchmarks/v5/protocol.json'))));
 const {catalog,originalBenchmarkHash}=await frozenInputs();const protocol={version:1,codeHash:sha(await readFile(import.meta.filename,'utf8')),engineHash:originalBenchmarkHash,catalogHash:sha(catalog),developmentSeeds:[111001,111002,111003,111004],evaluationSeeds:Array.from({length:16},(_,i)=>113001+i),scenarios:SCENARIOS,policies:POLICIES,shoppingDays:400,campaignWindow:[30,99],budgetCents:5000,
  selection:'Development uses previously examined seeds explicitly as development. Select best mean400-day platform value with nonnegative merchant mean. No final-data tuning.',
  meaning:'Marketing recovery recommendations after observed refunds and mature merchant-quality deterioration. No dispute decisions, hidden traits, future returns, fee changes or native payments.',cloudCalls:0};protocol.hash=sha(protocol);
 try{if((await read('protocol.json')).hash!==protocol.hash)throw Error('RECOVERY_PROTOCOL_CHANGED');}catch(e){if(e.code!=='ENOENT')throw e;await save('protocol.json',protocol);}
 const stage=process.argv.includes('--evaluate')?'evaluation':'development',seeds=stage==='development'?protocol.developmentSeeds:protocol.evaluationSeeds,rows=[];let selected=stage==='evaluation'?(await read('development.json')).selectedPolicy:null;
 for(const seed of seeds)for(const scenario of SCENARIOS){
  let record;const file=`${stage}/${seed}-${scenario}.json`;
  try{record=await read(file);if(record.protocolHash!==protocol.hash)throw Error('RECOVERY_CASE_CHANGED');}catch(e){
   if(e.code!=='ENOENT')throw e;const control=runRecovery({seed,scenario,catalog,policy:POLICIES[0]}),scores=[];
   for(const policy of POLICIES){const result=policy.id==='organic'?control:runRecovery({seed,scenario,catalog,policy});const {daily,fits,publications,...small}=result;scores.push({...small,deltaUSD:(result.platformProxyCents-control.platformProxyCents)/100,merchantDeltaUSD:(result.merchantContributionCents-control.merchantContributionCents)/100,volumeDeltaUSD:(result.retainedCents-control.retainedCents)/100});}
   record={protocolHash:protocol.hash,seed,scenario,scores};await save(file,record);
  }rows.push(...record.scores);console.log(JSON.stringify({stage,completed:rows.length/POLICIES.length,total:seeds.length*5}));
 }
 const stats=POLICIES.map(p=>({policy:p.id,platform:pairedEstimate(rows.filter(r=>r.policy===p.id),'deltaUSD'),merchant:pairedEstimate(rows.filter(r=>r.policy===p.id),'merchantDeltaUSD'),volume:pairedEstimate(rows.filter(r=>r.policy===p.id),'volumeDeltaUSD')}));
 if(stage==='development')selected=[...stats].filter(s=>s.policy!=='organic'&&s.merchant.mean>=0).sort((a,b)=>b.platform.mean-a.platform.mean)[0]?.policy||'organic';
 await save(stage+'.json',{protocolHash:protocol.hash,stage,selectedPolicy:selected,rows,stats});console.log(JSON.stringify({selected,stats}));
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
