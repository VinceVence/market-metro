import {readFile,writeFile} from 'node:fs/promises';
import {runDeadlineCase,FIXED_POLICIES,warmDeadlineWorld,balances} from './evaluate.mjs';
const dir='docs/commerce-deadlines/headroom-bound-2',inputs=JSON.parse(await readFile(dir+'/inputs.json','utf8')),policy=FIXED_POLICIES.find(p=>p.id==='fixed_fast'),values={};let actualPlatformUSD=0;
for(const c of inputs.cases){const result=await runDeadlineCase({seed:c.seed,scenario:c.scenario},policy,{trace:true}),w=await warmDeadlineWorld({seed:c.seed,scenario:c.scenario});actualPlatformUSD+=result.platformUSD;
 if(Math.abs(result.platformUSD-c.reference.platformUSD)>1e-8)throw Error('REFERENCE_CHANGED_DURING_BOUND_AUDIT');
 const orders=result.trace.orders.filter(o=>o.day>=30),roots=result.trace.procurements.filter(p=>p.orderedDay>=30),rootIds=new Set(roots.map(p=>p.id));if(roots.some(p=>p.status!=='DELIVERED'))throw Error('UNSETTLED_PIPELINE');
 for(const o of orders){const r=c.requests.find(r=>r.id===o.requestId);if(!r||r.refunded!==(o.refundStatus==='SETTLED'))throw Error('RETURN_OR_REQUEST_BOUND_MISMATCH');values[c.seed+':gross:'+o.requestId]=o.grossCents/100;values[c.seed+':count:'+o.requestId]=1;values[c.seed+':cost:'+o.requestId]=o.merchants.reduce((s,m)=>s+m.costCents,0)/100;}
 const invoices=result.trace.invoices.filter(i=>i.rail==='paypal'&&i.status==='PAID');
 values[c.seed+':new_procurement']=roots.reduce((s,p)=>s+p.costCents,0)/100;values[c.seed+':factory_gross']=roots.reduce((s,p)=>s+p.factoryCostCents,0)/100;values[c.seed+':closing_inventory']=result.terminalInventoryUSD;
 for(const [stage,grossKey,countKey]of [['RETAIL_TO_WHOLESALE','merchant_paypal','root_paypal_invoices'],['WHOLESALE_TO_FACTORY','factory_paypal','factory_paypal_invoices']]){
  const rows=invoices.filter(i=>i.stage===stage);values[c.seed+':'+grossKey]=rows.flatMap(i=>i.allocations).filter(a=>rootIds.has(a.procurementId)).reduce((s,a)=>s+a.grossCents,0)/100;values[c.seed+':'+countKey]=rows.filter(i=>i.allocations.every(a=>rootIds.has(a.procurementId))).length;
 }
 console.log(JSON.stringify({case:c.scenario,actualPlatformUSD:result.platformUSD,openingLiabilityCents:balances(w).feeDue+balances(w).exposure}));
}
await writeFile(dir+'/witness.json',JSON.stringify({actualPlatformUSD,values,scope:'Actual fixed-policy data, solely to verify the relaxation contains known feasible trajectories.'},null,2));
