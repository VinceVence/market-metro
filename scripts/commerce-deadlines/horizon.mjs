// Checkpointed multi-stage planning tool. Stages are numerical specialists,
// explicitly not LLM calls. A future LLM may choose a typed planning contract;
// it never supplies unchecked money movements or replaces the verifier.
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {enumerateBaskets,fitDemand,restockPlan} from './policies.mjs';
import {procurementLimit,placeProcurement} from './suppliers.mjs';
import {observeDeadlineWorld,reserveBasket,captureReservation,assertDeadlineIntegrity} from './environment.mjs';

const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export const HORIZON_CONTRACT=Object.freeze({id:'joint_funded_horizon_v1_1',horizonDays:10,requestLimit:40,basketsPerRequest:24,
 forecastCoverDays:3,returnProbability:.035,source:'NUMERICAL_ROLLING_HORIZON',modelCalls:0,
 objective:'Expected retail payment contribution, with small merchant margin and preference tie breaks. Positive procurement penalties prevent fee-farming stock purchases.'});

export function horizonPacket(view,{procurementOnly=false}={}){
 const requests=view.requests.filter(r=>r.status==='AUTHORIZED'&&r.deadlineDay-view.day>=2)
  .sort((a,b)=>a.deadlineDay-b.deadlineDay||a.createdDay-b.createdDay).slice(0,HORIZON_CONTRACT.requestLimit);
 const maxOffset=Math.min(HORIZON_CONTRACT.horizonDays,Math.max(0,...requests.map(r=>r.deadlineDay-view.day-2)));
 const inbound=view.inbound.map(p=>({...p,offset:Math.max(0,(p.confirmedArrivalDay??p.latestArrivalDay)-view.day)}));
 const procurement=[];
 for(const p of view.products){
  if(!requests.some(r=>r.lines.some(l=>l.acceptableCatalogIds.includes(p.catalogId))))continue;
  for(const [merchantRail,supplierRail]of [['paypal','paypal'],['bank','paypal'],['paypal','bank'],['bank','bank']]){
   const arrivalOffset=view.paymentRules.physicalLeadMaxDays+(merchantRail==='bank'?2:0)+(supplierRail==='bank'?2:0);
   if(arrivalOffset>maxOffset)continue;
   const limit=Math.min(20,procurementLimit(view,p,arrivalOffset),Math.floor(view.merchants.find(m=>m.id===p.merchantId).cashCents/p.costCents));
   if(limit<1)continue;
   procurement.push({productId:p.id,merchantId:p.merchantId,merchantRail,supplierRail,arrivalOffset,limit,unitCostCents:p.costCents,
    penalty:p.costCents*.005+Number(merchantRail==='paypal')*.08+Number(supplierRail==='paypal')*.08});
  }
 }
 const expanded={...view,products:view.products.map(p=>{const quantity=inbound.filter(x=>x.productId===p.id).reduce((s,x)=>s+x.quantity,0)+Math.max(0,...procurement.filter(x=>x.productId===p.id).map(x=>x.limit));return {...p,available:p.available+quantity,stock:p.stock+quantity};})};
 const times=[...new Set([0,...inbound.map(p=>p.offset),...procurement.map(p=>p.arrivalOffset)])].filter(d=>d<=maxOffset).sort((a,b)=>a-b),choices=[];
 for(const r of requests)for(const basket of enumerateBaskets(expanded,r,{limit:HORIZON_CONTRACT.basketsPerRequest}))for(const offset of times){
  if(procurementOnly&&offset===0)continue;
  if(view.day+offset>r.deadlineDay-2)continue;
  choices.push({...basket,offset,value:basket.expectedPlatformCents+.001*basket.retailerCents+.001*basket.preferred-offset*.05});
 }
 return {asOfDay:view.day,snapshotHash:hash(view),products:view.products.map(p=>({id:p.id,available:p.available})),
  merchants:view.merchants.map(m=>({id:m.id,cashCents:m.cashCents})),inbound,choices,procurement};
}

export function verifyHorizonSelection(packet,answer){
 if(!Array.isArray(answer.selected)||!Array.isArray(answer.procurement)||new Set(answer.selected).size!==answer.selected.length)throw Error('INVALID_HORIZON_RESPONSE');
 const chosen=answer.selected.map(i=>{if(!Number.isInteger(i)||!packet.choices[i])throw Error('INVALID_HORIZON_CHOICE');return packet.choices[i];});
 if(new Set(chosen.map(q=>q.requestId)).size!==chosen.length)throw Error('HORIZON_DUPLICATE_REQUEST');
 const seen=new Set(),orders=answer.procurement.map(item=>{
  if(!Number.isInteger(item.index)||seen.has(item.index)||!Number.isSafeInteger(item.quantity)||item.quantity<1)throw Error('INVALID_HORIZON_PROCUREMENT');
  seen.add(item.index);const p=packet.procurement[item.index];if(!p||item.quantity>p.limit)throw Error('HORIZON_PROCUREMENT_LIMIT');return {...p,quantity:item.quantity};
 });
 for(const m of packet.merchants)if(orders.filter(o=>o.merchantId===m.id).reduce((s,o)=>s+o.quantity*o.unitCostCents,0)>m.cashCents)throw Error('HORIZON_CASH_VIOLATION');
 for(const p of packet.products){
  if(orders.filter(o=>o.productId===p.id).reduce((s,o)=>s+o.quantity,0)>Math.max(0,...packet.procurement.filter(o=>o.productId===p.id).map(o=>o.limit)))throw Error('HORIZON_PROCUREMENT_LIMIT');
  for(const lead of new Set(packet.procurement.filter(o=>o.productId===p.id).map(o=>o.arrivalOffset)))if(orders.filter(o=>o.productId===p.id&&o.arrivalOffset>=lead).reduce((s,o)=>s+o.quantity,0)>Math.max(...packet.procurement.filter(o=>o.productId===p.id&&o.arrivalOffset===lead).map(o=>o.limit)))throw Error('HORIZON_NESTED_PROCUREMENT_LIMIT');
  for(const day of new Set(chosen.map(q=>q.offset))){
   const available=p.available+packet.inbound.filter(o=>o.productId===p.id&&o.offset<=day).reduce((s,o)=>s+o.quantity,0)+orders.filter(o=>o.productId===p.id&&o.arrivalOffset<=day).reduce((s,o)=>s+o.quantity,0);
   if(chosen.filter(q=>q.offset<=day).reduce((s,q)=>s+(q.quantities[p.id]||0),0)>available)throw Error('HORIZON_STOCK_OR_TIMING_VIOLATION');
  }
 }
 const groups=new Map();for(const p of [...orders].sort((a,b)=>b.arrivalOffset-a.arrivalOffset)){const key=[p.merchantId,p.merchantRail,p.supplierRail].join('|');if(!groups.has(key))groups.set(key,{merchantId:p.merchantId,merchantRail:p.merchantRail,supplierRail:p.supplierRail,items:[]});groups.get(key).items.push({productId:p.productId,quantity:p.quantity});}
 return {captures:chosen.filter(q=>q.offset===0),future:chosen.filter(q=>q.offset>0),procurements:[...groups.values()]};
}

export function openHorizonPlanner(){
 const child=spawn(resolve('.local/marketing-venv/bin/python'),['-u',resolve('scripts/commerce-deadlines/horizon-worker.py')],{stdio:['pipe','pipe','pipe']}),pending=new Map();let seq=0,stderr='';
 child.stderr.on('data',b=>{stderr=(stderr+b).slice(-2000);});
 const rejectAll=e=>{for(const job of pending.values()){clearTimeout(job.timer);job.reject(e);}pending.clear();};
 child.on('error',rejectAll);child.on('exit',code=>rejectAll(Error('HORIZON_WORKER_EXIT_'+code+':'+stderr)));
 createInterface({input:child.stdout}).on('line',line=>{let result;try{result=JSON.parse(line);}catch{rejectAll(Error('INVALID_HORIZON_JSON'));return;}const job=pending.get(result.id);if(!job)return;pending.delete(result.id);clearTimeout(job.timer);result.error?job.reject(Error(result.error)):job.resolve(result);});
 return {async plan(view,options){
  const start=performance.now(),packet=horizonPacket(view,options),id=++seq;
  const answer=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('HORIZON_WORKER_TIMEOUT'));child.kill();},10000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({...packet,id})+'\n');});
  const plan=verifyHorizonSelection(packet,answer),forecast=fitDemand(view),latencyMs=performance.now()-start;
  return {...plan,source:HORIZON_CONTRACT.source,snapshotHash:packet.snapshotHash,asOfDay:view.day,forecast,solver:{status:answer.status,gap:answer.gap,runtimeSeconds:answer.runtimeSeconds},latencyMs,
   checkpoints:[
    {stage:'OBSERVE',day:view.day,snapshotHash:packet.snapshotHash,fundedRequests:view.requests.filter(r=>r.status==='AUTHORIZED').length},
    {stage:'DEMAND_MODEL',type:forecast.type,cutoffDay:forecast.cutoffDay,source:'LOCAL_ANALYTIC_FIT'},
    {stage:'PROPOSE',role:'Basket and supply planning tools',basketSchedules:packet.choices.length,procurementOptions:packet.procurement.length},
    {stage:'COORDINATE',role:'Joint numerical optimizer',captureNow:plan.captures.map(q=>q.requestId),scheduled:plan.future.map(q=>({requestId:q.requestId,captureDay:view.day+q.offset})),procurementUnits:plan.procurements.flatMap(p=>p.items).reduce((s,p)=>s+p.quantity,0)},
    {stage:'VERIFY',status:'PASSED',checks:['funded quotes','one basket per request','time-indexed stock','merchant cash','procurement limits'],futurePlansArePromises:false}
   ]};
 },close(){child.stdin.end();}};
}

// Money and stock are committed by trusted code, atomically in this simulator.
// Forecasts may affect tomorrow's plan; only today's actions are committed.
export async function executeHorizonPlan(world,plan,{repair}={}){
 const view=observeDeadlineWorld(world);if(plan.snapshotHash!==hash(view)||plan.asOfDay!==world.day)throw Error('STALE_HORIZON_PLAN');
 let copy=structuredClone(world);const prefix=HORIZON_CONTRACT.id+':'+world.day;
 for(const q of plan.captures){reserveBasket(copy,{requestId:q.requestId,items:q.items,key:prefix+':reserve:'+q.requestId});captureReservation(copy,{requestId:q.requestId,key:prefix+':capture:'+q.requestId});}
 const afterCaptures=structuredClone(copy);let supplyPlan=plan,repairResult=null;
 try{for(const [i,p]of plan.procurements.entries())placeProcurement(copy,{...p,key:prefix+':procurement:'+i});}
 catch(error){
  if(error.message!=='PROCUREMENT_EXCEEDS_OBSERVED_DEMAND'||!repair)throw error;
  copy=afterCaptures;const viewAfter=observeDeadlineWorld(copy);
  supplyPlan=await repair(viewAfter,{procurementOnly:true});
  if(supplyPlan.snapshotHash!==hash(viewAfter)||supplyPlan.captures.length)throw Error('INVALID_HORIZON_REPAIR');
  for(const [i,p]of supplyPlan.procurements.entries())placeProcurement(copy,{...p,key:prefix+':revised-procurement:'+i});
  repairResult={stage:'REPLAN',cause:error.message,reason:'Completed purchases changed the valid demand limits for remaining stock. Rebuilt the supply plan from the post-purchase observation.',snapshotHash:supplyPlan.snapshotHash,solver:supplyPlan.solver,latencyMs:supplyPlan.latencyMs};
 }
 // Same rolling demand tool as fixed. Only its future-demand buffer is added:
 // existing requests were already jointly assigned by the horizon optimizer.
 const after=observeDeadlineWorld(copy),buffer=restockPlan({...after,requests:[]},{coverDays:HORIZON_CONTRACT.forecastCoverDays,routing:'fast',target:'preferred'});
 for(const [i,p]of buffer.orders.entries())placeProcurement(copy,{...p,key:prefix+':buffer:'+i});
 assertDeadlineIntegrity(copy);
 const procuredUnits=[...supplyPlan.procurements,...buffer.orders].flatMap(p=>p.items).reduce((s,p)=>s+p.quantity,0);
 copy.decisions.push({day:copy.day,policy:HORIZON_CONTRACT.id,asOfDay:plan.asOfDay,source:plan.source,captured:plan.captures.length,procuredUnits,forecast:plan.forecast,solver:plan.solver,
  checkpoints:[...plan.checkpoints,...(repairResult?[repairResult,{...supplyPlan.checkpoints.find(c=>c.stage==='COORDINATE'),stage:'REVISED_SUPPLY'}, {...supplyPlan.checkpoints.find(c=>c.stage==='VERIFY'),stage:'VERIFY_REVISED_SUPPLY'}]:[]),{stage:'COMMIT',status:'PASSED',captured:plan.captures.length,procuredUnits,source:'SIMULATED_NOT_PAYPAL_RECEIPT'}],future:supplyPlan.future.map(q=>({requestId:q.requestId,captureDay:copy.day+q.offset}))});
 Object.assign(world,copy);
 return {captured:plan.captures.length,procuredUnits,repair:repairResult};
}
