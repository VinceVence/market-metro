// Evaluation-only relaxation. Future requests/refund flags are intentionally
// allowed here to bound headroom, never to construct a deployable policy.
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {warmGrowthWorld} from './evaluate.mjs';
import {balances} from '../commerce-deadlines/evaluate.mjs';
import {requestFor,RULES,fee,processing} from './kernel.mjs';
import {draw} from '../marketing/economy.mjs';
import {createHash} from 'node:crypto';
const dir='docs/commerce-growth/headroom-bound-1';await mkdir(dir,{recursive:true});if(await access(dir+'/inputs.json').then(()=>true,()=>false))throw Error('BOUND_INPUTS_EXIST');
const development=JSON.parse(await readFile('docs/commerce-growth/development-1/results.json','utf8')),rows=JSON.parse(await readFile('docs/commerce-growth/development-1/rows.json','utf8')).rows,fixed=rows.filter(r=>r.policy===development.reference),cases=[];
for(const reference of fixed){const w=await warmGrowthWorld({seed:reference.seed,regime:reference.regime}),opening=balances(w),requests=w.requests.filter(r=>['REQUESTED','AUTHORIZED','RESERVED'].includes(r.status)).map(r=>structuredClone(r));
 for(let day=30;day<w.settings.days;day++)for(const person of w.people){const r=requestFor(w,person,day);if(r)requests.push(r);}
 const budgets=w.people.map(person=>{
  const held=w.requests.filter(r=>r.customerId===person.id&&r.authorizationId).reduce((s,r)=>s+(w.accounts[r.authorizationId]||0),0);let money=w.accounts[person.id]+held;const prefix=[];
  for(let day=30;day<w.totalDays;day++){
   if(day<w.settings.days&&day%7===0)money+=person.weeklyIncomeCents-Math.round(person.weeklyIncomeCents*(.25+.25*draw(w.seed,'household-needs',day,person.index)));
   for(const o of w.orders.filter(o=>o.customerId===person.id&&o.refundStatus!=='SETTLED')){const q=w.privateOrderOutcomes[o.id];if(q.willRefund&&Math.max(30,q.refundDueDay)===day)money+=o.grossCents;}
   prefix.push({day,usd:money/100});
  }
  return {customerId:person.id,prefix};
 });
 const orderBounds=requests.map(r=>{
  let sums=[0];for(const line of r.lines){const prices=line.acceptableCatalogIds.map(id=>w.catalog.find(p=>p.id===id).priceCents*line.quantity);sums=[...new Set(sums.flatMap(s=>prices.map(p=>p+s)))];}
  const legal=sums.filter(s=>s<=r.budgetCents),person=w.people.find(p=>p.id===r.customerId),refunded=draw(w.seed,'deadline-return',r.createdDay,person.index)<RULES.returnProbability;
  return {id:r.id,customerId:r.customerId,createdDay:r.createdDay,latestCaptureDay:r.deadlineDay-2,minGrossUSD:Math.min(...legal)/100,maxGrossUSD:Math.max(...legal)/100,refunded};
 });
 const pendingWholesale=w.procurements.filter(p=>p.status==='WHOLESALER_PAYMENT_PENDING'),pendingFactory=w.procurements.filter(p=>['WHOLESALER_PAYMENT_PENDING','FACTORY_PAYMENT_PENDING'].includes(p.status));
 // Drop old supplier fees/raw costs where needed: these constants intentionally
 // overestimate positive future cash from already funded warmup obligations.
 const oldW=pendingWholesale.reduce((s,p)=>s+p.costCents-Math.round(p.costCents*.7),0)/100,oldF=pendingFactory.reduce((s,p)=>s+Math.round(p.costCents*.7)*.4+.5,0)/100;
 let oldP=0;for(const p of pendingFactory)if(p.supplierRail==='paypal'){const gross=Math.round(p.costCents*.7);oldP+=.0229*gross/100+.30;}
 const oldFeeReceivables=w.liabilities.filter(l=>l.status==='FEE_REBATE_DUE').reduce((s,l)=>s+l.amountCents,0)/100;
 cases.push({scenario:reference.regime,seed:reference.seed,reference:{platformUSD:reference.platformUSD,retailerUSD:reference.retailerUSD,wholesalerUSD:reference.wholesalerUSD,manufacturerUSD:reference.manufacturerUSD,terminalInventoryUSD:reference.terminalInventoryUSD},openingInventoryUSD:Object.values(opening.merchant).reduce((s,m)=>s+m.inventory+m.pipeline,0)/100,openingLiabilityUSD:(opening.feeDue+opening.exposure)/100,oldPositiveUpper:{platformUSD:oldP+(opening.feeDue+opening.exposure)/100,retailerUSD:oldFeeReceivables,wholesalerUSD:oldW,manufacturerUSD:oldF},minimumProcurementUnitUSD:Math.min(...w.products.map(p=>p.costCents))/100,scoreDays:w.totalDays-30,requests:orderBounds,budgets});
}
const input={createdAt:new Date().toISOString(),source:'EVALUATOR_ONLY_NOT_AGENT_INPUT',cases,rules:RULES,relaxations:['Perfect future knowledge of requests and return flags','Fractional requests and continuous charges within attainable basket price envelopes','No stock, shipping-delay, procurement-cash or merchant-location constraints','All refunded purchases return buyer funds immediately','Unserved requests cause no outside-market spending','No outreach, holding or model costs; all latent needs are optimistically discoverable regardless of consent/response','Only aggregate counterparty constraints across cases; terminal cash gate relaxed','Conservative fee-rounding and supplier-invoice-count bounds'],targetAchieved:false};input.hash=createHash('sha256').update(JSON.stringify(input)).digest('hex');await writeFile(dir+'/inputs.json',JSON.stringify(input,null,2)+'\n');console.log(JSON.stringify({cases:cases.length,requests:cases.reduce((s,c)=>s+c.requests.length,0),source:input.source}));
