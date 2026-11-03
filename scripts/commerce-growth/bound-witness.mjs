// Verify that the actual strongest-fixed trajectories fit the financial bound.
import {readFile,writeFile} from 'node:fs/promises';
import {runGrowthCase} from './evaluate.mjs';
import {GROWTH_POLICIES} from './policies.mjs';
const dir='docs/commerce-growth/headroom-bound-1',inputs=JSON.parse(await readFile(dir+'/inputs.json','utf8')),
 results=JSON.parse(await readFile('docs/commerce-growth/development-1/results.json','utf8')),
 policy=GROWTH_POLICIES.find(p=>p.id===results.reference),values={};let actualPlatformUSD=0;
for(const c of inputs.cases){
 const r=await runGrowthCase({seed:c.seed,regime:c.scenario},policy,{trace:true});
 if(r.platformUSD!==c.reference.platformUSD)throw Error('GROWTH_REFERENCE_CHANGED');
 actualPlatformUSD+=r.platformUSD;
 for(const order of r.trace.orders.filter(o=>o.day>=30)){
  const request=c.requests.find(q=>q.id===order.requestId);if(!request||request.refunded!==(order.refundStatus==='SETTLED'))throw Error('BOUND_REQUEST_OR_RETURN_MISMATCH');
  values[c.seed+':gross:'+order.requestId]=order.grossCents/100;values[c.seed+':count:'+order.requestId]=1;
  values[c.seed+':cost:'+order.requestId]=order.merchants.reduce((s,m)=>s+m.costCents,0)/100;
 }
 const invoices=r.trace.invoices,roots=invoices.filter(i=>i.stage==='RETAIL_TO_WHOLESALE'&&i.createdDay>=30),rootIds=new Set(roots.flatMap(i=>i.allocations.map(a=>a.procurementId)));
 if(roots.some(i=>i.status!=='PAID'||i.rail!=='paypal'))throw Error('WITNESS_REQUIRES_REGISTERED_FIXED_FAST_SETTLEMENT');
 values[c.seed+':new_procurement']=roots.reduce((s,i)=>s+i.grossCents,0)/100;
 values[c.seed+':factory_gross']=invoices.filter(i=>i.stage==='WHOLESALE_TO_FACTORY').flatMap(i=>i.allocations).filter(a=>rootIds.has(a.procurementId)).reduce((s,a)=>s+a.grossCents,0)/100;
 values[c.seed+':closing_inventory']=r.terminalInventoryUSD;
 for(const [stage,gross,count]of [['RETAIL_TO_WHOLESALE','merchant_paypal','root_paypal_invoices'],['WHOLESALE_TO_FACTORY','factory_paypal','factory_paypal_invoices']]){
  const group=invoices.filter(i=>i.stage===stage&&i.status==='PAID'&&i.rail==='paypal');
  values[c.seed+':'+gross]=group.flatMap(i=>i.allocations).filter(a=>rootIds.has(a.procurementId)).reduce((s,a)=>s+a.grossCents,0)/100;
  values[c.seed+':'+count]=group.filter(i=>i.allocations.every(a=>rootIds.has(a.procurementId))).length;
 }
 console.log(JSON.stringify({regime:c.scenario,platformUSD:r.platformUSD,outreachCostUSD:r.outreachCostUSD}));
}
await writeFile(dir+'/witness.json',JSON.stringify({actualPlatformUSD,values,scope:'Actual strongest-fixed growth trajectories; accounting verification only.'},null,2)+'\n');
