import {createDeadlineWorld,beginDeadlineDay,endDeadlineDay,observeDeadlineWorld,reserveBasket,captureReservation,assertDeadlineIntegrity,RULES} from './environment.mjs';
import {placeProcurement} from './suppliers.mjs';
import {buildCandidates,greedyAllocate,restockPlan} from './policies.mjs';
import {createHash} from 'node:crypto';
import {executeHorizonPlan} from './horizon.mjs';

export const FIXED_POLICIES=Object.freeze([
 {id:'fixed_deadline',allocation:'deadline',coverDays:7,routing:'auto',target:'cheap'},
 {id:'fixed_scarcity',allocation:'scarcity',coverDays:7,routing:'auto',target:'preferred'},
 {id:'fixed_margin',allocation:'margin',coverDays:3,routing:'auto',target:'preferred'},
 {id:'fixed_preference',allocation:'preference',coverDays:7,routing:'auto',target:'preferred'},
 {id:'fixed_fast',allocation:'scarcity',coverDays:3,routing:'fast',target:'preferred'}
]);
export const JOINT_POLICIES=Object.freeze([
 {id:'joint_auto',allocation:'joint',coverDays:7,routing:'auto',target:'preferred'},
 {id:'joint_lean',allocation:'joint',coverDays:0,routing:'auto',target:'cheap'},
 {id:'joint_fast',allocation:'joint',coverDays:3,routing:'fast',target:'preferred'}
]);
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function balances(w){
 const merchant=Object.fromEntries(w.merchants.map(m=>{const inventory=w.products.filter(p=>p.merchantId===m.id).reduce((s,p)=>s+p.stock*p.costCents,0),pipeline=w.procurements.filter(p=>p.merchantId===m.id&&p.status!=='DELIVERED').reduce((s,p)=>s+p.costCents,0),refunds=w.orders.filter(o=>o.refundStatus==='PENDING_FUNDS').flatMap(o=>o.merchants).filter(x=>x.id===m.id).reduce((s,x)=>s+x.grossCents,0),rent=w.liabilities.filter(l=>l.status==='HOLDING_COST_DUE'&&l.merchantId===m.id).reduce((s,l)=>s+l.amountCents,0);return [m.id,{cash:w.accounts[m.id],inventory,pipeline,equity:w.accounts[m.id]+inventory+pipeline-refunds-rent}];}));
 const feeDue=w.liabilities.filter(l=>l.status==='FEE_REBATE_DUE').reduce((s,l)=>s+l.amountCents,0),exposure=w.liabilities.filter(l=>l.status==='UNPAID_REFUND').reduce((s,l)=>s+l.amountCents,0);
 return {merchant,platformCash:w.accounts.platform,platformNet:w.accounts.platform-feeDue-exposure,feeDue,exposure,wholesaler:w.accounts.wholesaler,manufacturer:w.accounts.manufacturer};
}
export function settledPlatformNet(opening,closing){
 // Releasing an old risk provision is not newly earned payment income.
 // Outstanding closing obligations remain a conservative deduction.
 return closing.platformCash-opening.platformCash-closing.feeDue-closing.exposure;
}
async function act(w,policy,allocator,stats){
 let view=observeDeadlineWorld(w);const quotes=buildCandidates(view),start=performance.now();let chosen,solver;
 if(policy.allocation==='joint'){solver=await allocator.solve(view,quotes);chosen=solver.selected.map(i=>quotes[i]);stats.solverCalls++;if(solver.status!==0)stats.solverNonoptimal++;}
 else chosen=greedyAllocate(view,quotes,policy.allocation);
 stats.decisionMs.push(performance.now()-start);let captured=0;
 for(const q of chosen){reserveBasket(w,{requestId:q.requestId,items:q.items,key:policy.id+':reserve:'+q.requestId});captureReservation(w,{requestId:q.requestId,key:policy.id+':capture:'+q.requestId});captured++;}
 view=observeDeadlineWorld(w);const restock=restockPlan(view,policy);stats.modelFits++;let ordered=0;
 for(const [i,order]of restock.orders.entries()){placeProcurement(w,{...order,key:policy.id+':procure:'+w.day+':'+i});ordered+=order.items.reduce((s,p)=>s+p.quantity,0);}
 w.decisions.push({day:w.day,policy:policy.id,asOfDay:view.day,openRequests:view.requests.length,feasibleBaskets:quotes.length,captured,procuredUnits:ordered,forecast:restock.model,solver:solver?{status:solver.status,gap:solver.gap,runtimeSeconds:solver.runtimeSeconds}:null,source:policy.allocation==='joint'?'NUMERICAL_JOINT_PLANNER':'FIXED_WORKFLOW'});
}
const warmCache=new Map();
// Evaluator-only export for accounting bounds and matched initial-state audits.
// Application policies receive observeDeadlineWorld(), never this world.
export async function warmDeadlineWorld(c,{allocator}={}){
 const key=digest(c);if(!warmCache.has(key)){const w=createDeadlineWorld(c),stats={solverCalls:0,solverNonoptimal:0,modelFits:0,decisionMs:[]};while(w.day<RULES.warmupDays){beginDeadlineDay(w);await act(w,FIXED_POLICIES[0],allocator,stats);endDeadlineDay(w);}warmCache.set(key,w);}
 return structuredClone(warmCache.get(key));
}
export async function runDeadlineCase(c,policy,{allocator,controller,trace=false}={}){
 const w=await warmDeadlineWorld(c,{allocator}),initialHash=digest(w),opening=balances(w),stats={solverCalls:0,solverNonoptimal:0,modelFits:0,decisionMs:[]},start=performance.now();
 while(w.day<w.totalDays){
  beginDeadlineDay(w);
  if(controller){
   const plan=await controller.plan(observeDeadlineWorld(w));
   const execution=await executeHorizonPlan(w,plan,{repair:controller.plan});stats.solverCalls++;stats.modelFits++;
   if(execution.repair){stats.solverCalls++;stats.modelFits++;if(execution.repair.solver.status!==0)stats.solverNonoptimal++;}
   stats.decisionMs.push(plan.latencyMs+(execution.repair?.latencyMs||0));if(plan.solver.status!==0)stats.solverNonoptimal++;
  }else await act(w,policy,allocator,stats);
  endDeadlineDay(w);
 }
 assertDeadlineIntegrity(w);const closing=balances(w),scored=w.orders.filter(o=>o.day>=RULES.warmupDays),retailer=Object.keys(opening.merchant).reduce((s,id)=>s+closing.merchant[id].equity-opening.merchant[id].equity,0),wholesaler=closing.wholesaler-opening.wholesaler,manufacturer=closing.manufacturer-opening.manufacturer,net=settledPlatformNet(opening,closing),paidInvoices=w.supplierInvoices.filter(i=>i.status==='PAID'&&i.paidDay>=RULES.warmupDays),requests=w.requests.map(r=>({id:r.id,createdDay:r.createdDay,deadlineDay:r.deadlineDay,budgetCents:r.budgetCents,lines:r.lines}));
 const durations=[...stats.decisionMs].sort((a,b)=>a-b),liabilities=w.liabilities.filter(l=>l.status!=='SETTLED');
 return {...c,policy:policy.id,initialHash,requestStreamHash:digest(requests),platformUSD:net/100,retailerUSD:retailer/100,wholesalerUSD:wholesaler/100,manufacturerUSD:manufacturer/100,allPartnerUSD:(retailer+wholesaler+manufacturer)/100,terminalCashUSD:(Object.values(closing.merchant).reduce((s,m)=>s+m.cash,0)+closing.wholesaler+closing.manufacturer)/100,terminalInventoryUSD:Object.values(closing.merchant).reduce((s,m)=>s+m.inventory,0)/100,fulfilledRequests:scored.filter(o=>w.deliveries.some(d=>d.orderId===o.id&&d.onTime)).length,retainedRequests:scored.filter(o=>o.refundStatus!=='SETTLED'&&o.refundStatus!=='PENDING_FUNDS').length,retainedVolumeUSD:scored.reduce((s,o)=>s+o.grossCents-o.refundCents,0)/100,refunds:scored.filter(o=>o.refundStatus==='SETTLED').length,unpaidLiabilities:liabilities.length,unpaidLiabilityUSD:liabilities.reduce((s,l)=>s+l.amountCents,0)/100,settledSupplierInvoices:paidInvoices.length,paypalSupplierInvoices:paidInvoices.filter(i=>i.rail==='paypal').length,requestCount:w.requests.filter(r=>r.createdDay>=RULES.warmupDays).length,expiredRequests:w.requests.filter(r=>r.createdDay>=RULES.warmupDays&&r.status==='EXPIRED').length,merchantContributions:Object.fromEntries(Object.keys(opening.merchant).map(id=>[id,(closing.merchant[id].equity-opening.merchant[id].equity)/100])),incomeCents:w.incomeCents,reliability:{invariantsPassed:true,solverCalls:stats.solverCalls,solverNonoptimal:stats.solverNonoptimal,modelFits:stats.modelFits,medianDecisionMs:durations[Math.floor(durations.length*.5)]||0,p95DecisionMs:durations[Math.floor(durations.length*.95)]||0,totalWallMs:Math.round(performance.now()-start)},modelCostUSD:0,source:'SIMULATED_DEADLINE_ECONOMY',...(trace?{trace:{requests:w.requests,orders:w.orders,decisions:w.decisions,ledger:w.ledger,invoices:w.supplierInvoices,procurements:w.procurements,liabilities:w.liabilities}}:{})};
}
