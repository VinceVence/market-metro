// Expanded capacity, same legal quotes and observed-demand planning tools.
import {createGrowthWorld,beginGrowthDay,endGrowthDay,observeGrowthWorld,digest} from './environment.mjs';
import {observeDeadlineWorld,reserveBasket,captureReservation,assertDeadlineIntegrity,RULES} from './kernel.mjs';
import {enumerateBaskets,greedyAllocate,restockPlan} from '../commerce-deadlines/policies.mjs';
import {placeProcurement} from '../commerce-deadlines/suppliers.mjs';
import {validateConfig,fitForecast,restock} from '../commerce-growth/team/control.mjs';

export function buildCandidates(view){
 return view.requests.filter(r=>r.status==='AUTHORIZED'&&r.deadlineDay-view.day>=2)
  .sort((a,b)=>a.deadlineDay-b.deadlineDay||a.createdDay-b.createdDay)
  .slice(0,240).flatMap(r=>enumerateBaskets(view,r));
}
function capture(w,selected,key){for(const q of selected){
 reserveBasket(w,{requestId:q.requestId,items:q.items,key:key+':reserve:'+q.requestId});
 captureReservation(w,{requestId:q.requestId,key:key+':capture:'+q.requestId});
}}
function procure(w,orders,key){for(const [i,o] of orders.entries())placeProcurement(w,{...o,key:key+':stock:'+w.day+':'+i});}
export function commerceTurn(w,key){
 const view=observeDeadlineWorld(w),quotes=buildCandidates(view),chosen=greedyAllocate(view,quotes,'scarcity');
 capture(w,chosen,key);const restock=restockPlan(observeDeadlineWorld(w),{coverDays:3,routing:'fast',target:'preferred'});
 procure(w,restock.orders,key);return {candidates:quotes.length,captured:chosen.length,stockUnits:restock.orders.flatMap(o=>o.items).reduce((s,p)=>s+p.quantity,0),model:restock.model};
}
export async function fulfill(w,config,allocator,key){
 validateConfig(config);const copy=structuredClone(w);
 if(config.forecast==='legacy28'&&config.coverDays===3&&config.allocation==='scarcity'&&config.target==='preferred'&&config.routing==='fast'){
  const result=commerceTurn(copy,key);assertDeadlineIntegrity(copy);Object.assign(w,copy);return {...result,solver:null};
 }
 const view=observeGrowthWorld(copy),quotes=buildCandidates(view);let selected,solver=null;
 if(config.allocation==='joint'){solver=await allocator.solve(view,quotes);selected=solver.selected.map(i=>quotes[i]);}else selected=greedyAllocate(view,quotes,'scarcity');
 capture(copy,selected,key);
 const after=observeGrowthWorld(copy),forecast=fitForecast(after,config.forecast),orders=restock(after,config,forecast);
 procure(copy,orders,key);assertDeadlineIntegrity(copy);Object.assign(w,copy);
 return {captured:selected.length,candidates:quotes.length,stockUnits:orders.flatMap(o=>o.items).reduce((s,p)=>s+p.quantity,0),model:forecast,solver};
}
const warmCache=new Map();
export function warmGrowthWorld(settings){
 const key=digest(settings);if(!warmCache.has(key)){
  const w=createGrowthWorld(settings);while(w.day<RULES.warmupDays){beginGrowthDay(w);commerceTurn(w,'shared-warmup');endGrowthDay(w);}
  // Only cache the most recent warmup; the live process can run indefinitely.
  warmCache.clear();warmCache.set(key,w);
 }return structuredClone(warmCache.get(key));
}
