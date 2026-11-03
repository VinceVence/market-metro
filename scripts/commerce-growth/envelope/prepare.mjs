// EVALUATOR ONLY. Exhaustive legal quote economics and future reachability.
// Never imported by an agent or a deployable controller.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {warmGrowthWorld} from '../evaluate.mjs';
import {GROWTH_REGIMES,GROWTH_RULES} from '../environment.mjs';
import {quoteBasket,RULES} from '../kernel.mjs';
const root='docs/commerce-growth/envelope-1',base=JSON.parse(await readFile('docs/commerce-growth/team-1/headroom/inputs.json','utf8')),
 rows=JSON.parse(await readFile('docs/commerce-growth/team-1/development/rows.json','utf8')).rows,
 selected=JSON.parse(await readFile('docs/commerce-growth/team-1/development/results.json','utf8')).selectedFixed.id;
const cases=[];
for(const source of base.cases){
 const w=warmGrowthWorld({seed:source.seed,regime:source.scenario}),reference=rows.find(r=>r.seed===source.seed&&r.policy===selected),needs=new Map(w.growth.needs.map(n=>[n.request.id,n])),requests=[];
 const products=w.products.map(p=>({...p,stock:1000000,reserved:0}));let enumerated=0,legal=0;
 for(const r of source.requests){
  if(r.latestCaptureDay<30)continue;
  const n=needs.get(r.id),profile=w.growth.profiles.find(p=>p.id===r.customerId),request=n.request;
  const contactStart=Math.max(30,request.createdDay),contactEnd=Math.min(w.settings.days-1,r.latestCaptureDay,(profile.revokedDay??Infinity)-1),needsContact=!n.organic&&n.state!=='EXPOSED';
  const reachable=!needsContact||profile.optedIn&&contactStart<=contactEnd&&n.responseDraw<GROWTH_REGIMES[source.scenario].responseProbability;
  if(!reachable){requests.push({...r,reachable:false,needsContact,contactStart,contactEnd,options:[]});continue;}
  const virtual={...w,products,day:Math.max(30,request.createdDay),requests:[{...structuredClone(request),status:'REQUESTED'}]},unique=new Map(),pools=request.lines.map(l=>products.filter(p=>l.acceptableCatalogIds.includes(p.catalogId)));
  function visit(i,items){
   if(i<request.lines.length){for(const p of pools[i])visit(i+1,[...items,{lineId:request.lines[i].id,productId:p.id,quantity:request.lines[i].quantity}]);return;}
   enumerated++;
   let q;try{q=quoteBasket(virtual,r.id,items);}catch(error){if(!['CUSTOMER_BUDGET_EXCEEDED','MERCHANT_MARGIN_FLOOR'].includes(error.message))throw error;return;}
   legal++;const merchantProfit=[0,0,0];for(const m of q.merchants){const index=w.merchants.findIndex(x=>x.id===m.id);merchantProfit[index]=(r.refunded?0:m.grossCents-m.feeCents)-m.costCents-m.deliveryCents;}
   const cost=q.merchants.reduce((s,m)=>s+m.costCents,0),shipping=q.merchants.reduce((s,m)=>s+m.deliveryCents,0),option={grossCents:q.grossCents,costCents:cost,shippingCents:shipping,retailPlatformCents:(r.refunded?0:q.feeCents)-q.processingCents,merchantProfitCents:merchantProfit};
   if(option.grossCents%100)throw Error('PRICE_GRID_IS_NOT_ONE_DOLLAR');
   unique.set(JSON.stringify(option),option);
  }
  visit(0,[]);requests.push({...r,reachable,needsContact,contactStart,contactEnd,options:[...unique.values()]});
 }
 const maxDeadline=Math.max(...source.requests.map(r=>r.latestCaptureDay+2));
 // After the sales period, procurement must serve a currently authorized
 // request that can arrive by its deadline. Physical lead is at least3 days.
 const lastRootDay=Math.max(w.settings.days-1,maxDeadline-RULES.physicalLeadDays-2),lastFactoryDay=Math.max(w.settings.days-1+RULES.bankLagDays,maxDeadline-RULES.physicalLeadDays-2);
 cases.push({...source,merchantFloorsCents:w.merchants.map(m=>Math.round(reference.merchantContributions[m.id]*100)),requests,
  maximumRootPaypalBatches:Math.max(0,lastRootDay-30+1),maximumFactoryPaypalBatches:2*Math.max(0,lastFactoryDay-30+1),enumerated,legal});
 console.log(JSON.stringify({scenario:source.scenario,requests:requests.length,reachable:requests.filter(r=>r.reachable).length,enumerated,distinctOptions:requests.reduce((s,r)=>s+r.options.length,0)}));
}
const input={createdAt:new Date().toISOString(),source:'EVALUATOR_ONLY_NOT_AGENT_INPUT',sourceInputHash:base.hash,reference:selected,contactGapDays:GROWTH_RULES.customerContactGapDays,outreachCostCents:GROWTH_RULES.outreachCostCents,cases,
 scope:'Exact legal basket price, fee, shipping, cost and merchant-profit tuples. Future needs/returns/reachability are evaluator-only. Stock, operational financing, delayed refunds, holding and LLM costs remain relaxed. No behavioral or baseline changes.'};
input.hash=createHash('sha256').update(JSON.stringify(input)).digest('hex');await writeFile(root+'/inputs.json',JSON.stringify(input)+'\n',{flag:'wx'});
