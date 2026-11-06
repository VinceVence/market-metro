import {createGrowthWorld,beginGrowthDay,endGrowthDay,digest} from './environment.mjs';
import {observeDeadlineWorld,reserveBasket,captureReservation,assertDeadlineIntegrity,RULES} from './kernel.mjs';
import {enumerateBaskets,greedyAllocate} from '../commerce-deadlines/policies.mjs';
import {validateConfig} from '../commerce-growth/team/control.mjs';
import {fitForecast,restock} from './inventory.mjs';
import {placeProcurement} from './suppliers.mjs';

function quotesFor(view,requests){
  const catalog=new Map();
  for(const p of view.products){if(!catalog.has(p.catalogId))catalog.set(p.catalogId,[]);catalog.get(p.catalogId).push(p);}
  const options=new Map([...catalog].map(([id,rows])=>[id,[...rows].sort((a,b)=>a.costCents-b.costCents||b.available-a.available||a.id.localeCompare(b.id))]));
  return requests.flatMap(request=>{
    const selected=new Map();
    for(const line of request.lines)for(const id of line.acceptableCatalogIds){
      const eligible=(options.get(id)||[]).filter(p=>p.available>=line.quantity);
      for(const p of [...eligible.slice(0,3),...[...eligible].sort((a,b)=>b.available-a.available||a.costCents-b.costCents).slice(0,3)])selected.set(p.id,p);
    }
    return enumerateBaskets({...view,products:[...selected.values()],requests:[request]},request,{limit:12});
  });
}

function capture(w,quotes,key){
  for(const q of quotes){reserveBasket(w,{requestId:q.requestId,items:q.items,key:key+':reserve:'+q.requestId});captureReservation(w,{requestId:q.requestId,key:key+':capture:'+q.requestId});}
}

function replenish(w,config,key){
  const view=observeDeadlineWorld(w),forecast=fitForecast(view,config.forecast),orders=restock(view,config,forecast);
  for(const [i,order] of orders.entries())placeProcurement(w,{...order,key:key+':stock:'+w.day+':'+i});
  return {stockUnits:orders.flatMap(o=>o.items).reduce((n,p)=>n+p.quantity,0),model:forecast};
}

function candidates(w){
  const limit=Math.ceil(240*w.people.length/600);
  return w.requests.filter(r=>r.status==='AUTHORIZED'&&r.deadlineDay-w.day>=2)
    .sort((a,b)=>a.deadlineDay-b.deadlineDay||a.createdDay-b.createdDay).slice(0,limit);
}
function quoteView(w){return {day:w.day,products:w.products.map(p=>({...p,available:p.stock-p.reserved})),requests:[],marketDays:w.settings.days};}

export function commerceTurn(w,key){
  const requests=candidates(w);let captured=0;
  for(let at=0;at<requests.length;at+=128){const view=quoteView(w),quotes=quotesFor(view,requests.slice(at,at+128)),chosen=greedyAllocate(view,quotes,'scarcity');capture(w,chosen,key);captured+=chosen.length;}
  const supply=replenish(w,{forecast:'legacy28',coverDays:3,routing:'fast',target:'preferred'},key);
  return {captured,...supply,solver:null};
}

export async function fulfill(w,config,allocator,key){
  validateConfig(config);const requests=candidates(w);let captured=0,candidatesCount=0,solverCalls=0,maxGap=0;
  for(let at=0;at<requests.length;at+=128){
    const view=quoteView(w),quotes=quotesFor(view,requests.slice(at,at+128));candidatesCount+=quotes.length;
    let chosen;
    if(config.allocation==='joint'){
      const result=await allocator.solve(view,quotes);chosen=result.selected.map(i=>quotes[i]);solverCalls++;maxGap=Math.max(maxGap,result.gap??0);
    }else chosen=greedyAllocate(view,quotes,'scarcity');
    capture(w,chosen,key);captured+=chosen.length;
  }
  const supply=replenish(w,config,key);assertDeadlineIntegrity(w);
  return {captured,candidates:candidatesCount,...supply,solver:{calls:solverCalls,maxGap,batchSize:128,scope:'Deadline-ordered batches share the same market inventory.'}};
}

const warmCache=new Map();
export function warmGrowthWorld(settings){
  const key=digest(settings);
  if(!warmCache.has(key)){
    const w=createGrowthWorld(settings);while(w.day<RULES.warmupDays){beginGrowthDay(w);commerceTurn(w,'shared-warmup');endGrowthDay(w);}
    warmCache.clear();warmCache.set(key,w);
  }
  return structuredClone(warmCache.get(key));
}
