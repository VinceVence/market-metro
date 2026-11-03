// Evaluator-only pricing headroom, with no change to buyer demand or funding.
import {readFile,writeFile} from 'node:fs/promises';
import {createDeadlineWorld,requestFor} from './environment.mjs';
const data=JSON.parse(await readFile('docs/commerce-deadlines/headroom-bound-2/inputs.json','utf8'));
const requests=[];
for(const c of data.cases){
 const w=createDeadlineWorld({seed:c.seed,scenario:c.scenario});
 for(const r of c.requests){
  if(r.latestCaptureDay<30)continue;
  const [,day,index]=r.id.split('-'),request=requestFor(w,w.people[Number(index)],Number(day));
  if(!request||request.id!==r.id)throw Error('REQUEST_STREAM_MISMATCH');
  let min=0,max=0;
  for(const line of request.lines){
   const prices=line.acceptableCatalogIds.map(id=>w.catalog.find(p=>p.id===id).priceCents*line.quantity);
   min+=Math.min(...prices);max+=Math.max(...prices);
  }
  const budget=c.budgets.find(b=>b.customerId===r.customerId).prefix.find(p=>p.day===r.latestCaptureDay);
  requests.push({key:c.seed+':gross:'+r.id,declaredBudgetUSD:request.budgetCents/100,
   minQuoteUSD:min*.75/100,maxQuoteUSD:Math.min(request.budgetCents,max*1.25)/100,resourcesUSD:budget.usd});
 }
}
await writeFile('docs/commerce-deadlines/price-envelope-inputs.json',JSON.stringify({source:'EVALUATOR_ONLY_NOT_AGENT_INPUT',sourceHash:data.hash,requests},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({requests:requests.length,scope:'Price-action envelope only; no simulator mutation'}));
