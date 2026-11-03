// Independent enumeration and empirical trajectory membership audit.
// No provider calls; no changes to the frozen simulator or controller.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {warmGrowthWorld} from '../evaluate.mjs';
import {runCoordinatedCase} from '../team/runner.mjs';
import {openAllocator} from '../../commerce-deadlines/solver.mjs';
import {fee,processing,allocateCents,RULES} from '../kernel.mjs';
import {GROWTH_REGIMES} from '../environment.mjs';
const root='docs/commerce-growth/envelope-1',read=p=>readFile(p,'utf8').then(JSON.parse),input=await read(root+'/inputs.json'),
 protocol=await read('docs/commerce-growth/team-1/protocol.json'),prior=await read('docs/commerce-growth/team-1/training/model.json');
for(const [f,h]of Object.entries(protocol.hashes))if(createHash('sha256').update(await readFile(f)).digest('hex')!==h)throw Error('FROZEN_SOURCE_CHANGED:'+f);
const key=o=>JSON.stringify([o.grossCents,o.costCents,o.shippingCents,o.retailPlatformCents,o.merchantProfitCents]);
const rows=[],allocator=openAllocator();
try{
 for(const c of input.cases){
  const settings={seed:c.seed,regime:c.scenario},w=warmGrowthWorld(settings),needs=new Map(w.growth.needs.map(n=>[n.request.id,n]));let checked=0,quotes=0;
  for(const r of c.requests){
   const n=needs.get(r.id),request=n.request,profile=w.growth.profiles.find(p=>p.id===request.customerId),lo=Math.max(30,request.createdDay),hi=Math.min(w.settings.days-1,request.deadlineDay-2,(profile.revokedDay??Infinity)-1),requiresContact=!n.organic&&n.state!=='EXPOSED',reachable=!requiresContact||profile.optedIn&&lo<=hi&&n.responseDraw<GROWTH_REGIMES[c.scenario].responseProbability;
   if(reachable!==r.reachable||requiresContact!==r.needsContact||lo!==r.contactStart||hi!==r.contactEnd)throw Error('REACHABILITY_MAPPING_MISMATCH');
   if(!reachable){if(r.options.length)throw Error('UNREACHABLE_OPTIONS');continue;}
   // This enumerates iteratively and computes quote economics directly. It
   // does not call quoteBasket() or the bound-input generator.
   let combinations=[[]];
   for(const line of request.lines){const pool=w.products.filter(p=>line.acceptableCatalogIds.includes(p.catalogId));combinations=combinations.flatMap(prior=>pool.map(p=>[...prior,{p,quantity:line.quantity}]));}
   const expected=new Set();
   for(const basket of combinations){
    const merchant=w.merchants.map(m=>({id:m.id,gross:0,cost:0}));
    for(const item of basket){const m=merchant.find(x=>x.id===item.p.merchantId);m.gross+=item.p.priceCents*item.quantity;m.cost+=item.p.costCents*item.quantity;}
    const gross=merchant.reduce((s,m)=>s+m.gross,0);if(gross>request.budgetCents)continue;
    const active=merchant.filter(m=>m.gross>0),fees=allocateCents(fee(gross),active.map(m=>m.gross));active.forEach((m,i)=>{m.fee=fees[i];});
    if(active.some(m=>(m.gross-m.cost-m.fee-RULES.deliveryCents)/m.gross<.2))continue;
    const option={grossCents:gross,costCents:merchant.reduce((s,m)=>s+m.cost,0),shippingCents:active.length*RULES.deliveryCents,
     retailPlatformCents:(r.refunded?0:fee(gross))-processing(gross),
     merchantProfitCents:merchant.map(m=>m.gross?(r.refunded?0:m.gross-m.fee)-m.cost-RULES.deliveryCents:0)};
    expected.add(key(option));quotes++;
   }
   const actual=new Set(r.options.map(key));if(expected.size!==actual.size||[...expected].some(k=>!actual.has(k)))throw Error('QUOTE_ENUMERATION_INCOMPLETE:'+r.id);checked++;
  }
  const result=await runCoordinatedCase(settings,protocol.selectedFixed,{allocator,prior,trace:true});
  if(result.platformUSD!==c.reference.platformUSD)throw Error('REFERENCE_REPLAY_CHANGED');
  const requests=new Map(c.requests.map(r=>[r.id,r])),orders=result.trace.orders.filter(o=>o.day>=30),profits=[0,0,0];let retail=0,cogs=0;
  for(const order of orders){
   const r=requests.get(order.requestId);if(!r||!r.reachable||r.refunded!==(order.refundStatus==='SETTLED'))throw Error('ACTUAL_REQUEST_OUTSIDE_ENVELOPE');
   const vector=w.merchants.map(m=>{const sale=order.merchants.find(x=>x.id===m.id);return sale?(r.refunded?0:sale.grossCents-sale.feeCents)-sale.costCents-sale.deliveryCents:0;});
   const option={grossCents:order.grossCents,costCents:order.merchants.reduce((s,m)=>s+m.costCents,0),shippingCents:order.merchants.reduce((s,m)=>s+m.deliveryCents,0),retailPlatformCents:(r.refunded?0:order.feeCents)-order.processingCents,merchantProfitCents:vector};
   if(!new Set(r.options.map(key)).has(key(option)))throw Error('ACTUAL_BASKET_NOT_ENUMERATED');
   retail+=option.retailPlatformCents;cogs+=option.costCents;vector.forEach((p,i)=>{profits[i]+=p;});
  }
  for(const buyer of c.budgets)for(const p of buyer.prefix){const consumed=orders.filter(o=>o.customerId===buyer.customerId&&!requests.get(o.requestId).refunded&&requests.get(o.requestId).latestCaptureDay<=p.day).reduce((s,o)=>s+o.grossCents,0);if(consumed>Math.round(p.usd*100))throw Error('ACTUAL_BUYER_BUDGET_OUTSIDE_ENVELOPE');}
  for(let i=0;i<3;i++)if(profits[i]+Math.round(c.oldPositiveUpper.retailerUSD*100)<Math.round(result.merchantContributions[w.merchants[i].id]*100))throw Error('RETAIL_PROFIT_ENVELOPE_TOO_SMALL');
  const roots=result.trace.invoices.filter(i=>i.stage==='RETAIL_TO_WHOLESALE'&&i.createdDay>=30),rootIds=new Set(roots.flatMap(i=>i.allocations.map(a=>a.procurementId))),T=roots.reduce((s,i)=>s+i.grossCents,0),G=result.trace.invoices.filter(i=>i.stage==='WHOLESALE_TO_FACTORY').flatMap(i=>i.allocations).filter(a=>rootIds.has(a.procurementId)).reduce((s,a)=>s+a.grossCents,0);
  const identity=T-cogs-Math.round(result.terminalInventoryUSD*100)+Math.round(c.openingInventoryUSD*100);if(identity!==0)throw Error('INVENTORY_COST_IDENTITY_FAILED');
  const min=Math.round(c.minimumProcurementUnitUSD*100);if(G>.7*T+.5*T/min+1e-8)throw Error('FACTORY_ROUNDING_ENVELOPE_FAILED');
  const A=roots.filter(i=>i.rail==='paypal').length,B=result.trace.invoices.filter(i=>i.stage==='WHOLESALE_TO_FACTORY'&&i.rail==='paypal'&&i.allocations.every(a=>rootIds.has(a.procurementId))).length;
  if(A>c.maximumRootPaypalBatches||B>c.maximumFactoryPaypalBatches)throw Error('BATCH_TIME_ENVELOPE_FAILED');
  const beta=.0229*(1.7+.5/min),upper=retail+beta*T+30*(A+B)+c.oldPositiveUpper.platformUSD*100-result.outreachCostUSD*100;
  if(upper+1e-6<result.platformUSD*100)throw Error('PLATFORM_CONTRIBUTION_ENVELOPE_TOO_SMALL');
  rows.push({scenario:c.scenario,seed:c.seed,reachableRequestsChecked:checked,legalCombinationsChecked:quotes,actualCapturedBasketsChecked:orders.length,actualPlatformUSD:result.platformUSD,trajectoryEnvelopeUSD:upper/100,inventoryIdentityResidualCents:identity,rootBatches:A,factoryBatches:B});
  console.log(JSON.stringify(rows.at(-1)));
 }
 const output={verifiedAt:new Date().toISOString(),inputHash:input.hash,quoteEnumerationComplete:true,referenceTrajectoriesInsideEnvelope:true,cases:rows,
  scope:'Independent quote enumeration uses the frozen fee/cent-allocation primitives but not quoteBasket or the input generator. Recorded strongest-fixed trajectories satisfy the quote, buyer-budget, stock-cost, rounding and batch-count mappings. The general bound derivation is documented separately.',newModelCalls:0};
 await writeFile(root+'/mapping-verification.json',JSON.stringify(output,null,2)+'\n');
}finally{allocator.close();}
