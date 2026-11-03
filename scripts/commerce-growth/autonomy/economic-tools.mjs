// Observed economic signals and bounded policy composition. No economy rule
// changes, arbitrary code/SQL, hidden needs, wallets or future draws.
import {observeGrowthWorld,digest} from '../environment.mjs';
import {RULES} from '../kernel.mjs';
import {enumerateBaskets} from '../../commerce-deadlines/policies.mjs';
import {planFundedBaskets} from '../experiments/baskets.mjs';
import {compileProgram,field,op} from '../experiments/program.mjs';
import {fitForecast} from '../team/control.mjs';
import {workbenchPlan} from './team-workbench-tools.mjs';

export const ECONOMIC_DOMAINS=['demand','outreach','inventory','liquidity','supply','payments'];
export const ECONOMIC_INDICATORS=Object.freeze({
 request_growth_ratio:{domain:'demand',unit:'ratio',meaning:'Observed request rate in this window divided by the preceding window. Null if there was no prior demand.'},
 response_rate:{domain:'outreach',unit:'fraction',meaning:'Observed replies / contacts in the window; not retained purchases.'},
 funded_fill_rate:{domain:'inventory',unit:'fraction',meaning:'Share of currently funded requests individually fillable from current stock. Not a promise that all can be filled jointly.'},
 stockout_share:{domain:'inventory',unit:'fraction',meaning:'Merchant/product listings with no currently available units.'},
 spendable_cash_usd:{domain:'liquidity',unit:'USD',meaning:'Merchant-authorized spendable balances after existing refund/holding safeguards.'},
 cash_to_replenishment_ratio:{domain:'liquidity',unit:'ratio',meaning:'Spendable merchant cash / the current complete-funded-basket replenishment plan. Null when no purchase is needed.'},
 supplier_lead_days:{domain:'supply',unit:'days',meaning:'Currently quoted maximum physical supplier lead time. Payment settlement delays are additional.'},
 payment_cash_margin_usd:{domain:'payments',unit:'USD',meaning:'Observed platform ledger cash inflows minus outflows during the window, including processing, returns and outreach. Future refunds remain unknown.'},
 mature_refund_rate:{domain:'payments',unit:'fraction',meaning:'Refunded captured orders in the latest fully matured cohort. Null for an empty cohort.'}
});
export function economicObservation(world){
 const view=observeGrowthWorld(world);view.outreach.history=view.outreach.history.filter(c=>c.day<view.day);
 return {...view,observedRequests:world.requests.filter(r=>(r.discoveredDay??r.createdDay)<view.day).map(r=>({observedDay:r.discoveredDay??r.createdDay,createdDay:r.createdDay,authorizedDay:r.authorizedDay??null,lines:structuredClone(r.lines)})),paymentEvents:world.ledger.filter(l=>l.day<view.day&&(l.from==='platform'||l.to==='platform')).map(l=>({day:l.day,kind:l.kind,from:l.from,to:l.to,cents:l.cents,reference:l.reference})),
  supplierInvoices:world.supplierInvoices.filter(i=>i.createdDay<view.day).map(i=>({createdDay:i.createdDay,paidDay:i.paidDay??null,status:i.status,rail:i.rail,stage:i.stage,grossCents:i.grossCents,feeCents:i.feeCents,processingCents:i.processingCents})),
  platformObligations:world.liabilities.filter(l=>['FEE_REBATE_DUE','UNPAID_REFUND'].includes(l.status)).map(l=>({status:l.status,amountCents:l.amountCents})),
  observationScope:'Current merchant/stock/funded-order state plus historical platform settlement events. History ends before the current day. Modeled business observations, not production PayPal data.'};
}
export function inspectEconomy(view,domains,windowDays=7){
 if(!Array.isArray(domains)||!domains.length||new Set(domains).size!==domains.length||domains.some(d=>!ECONOMIC_DOMAINS.includes(d))||![7,14,28].includes(windowDays))throw Error('INVALID_ECONOMIC_QUERY');
 const day=view.day,start=Math.max(0,day-windowDays),previous=Math.max(0,start-windowDays),recent=view.pastOrders.filter(o=>o.day>=start&&o.day<day),requests=(view.observedRequests||[]).filter(r=>r.observedDay>=start&&r.observedDay<day),funded=view.requests.filter(r=>r.status==='AUTHORIZED'),values={},details={};
 if(domains.includes('demand')){const before=(view.observedRequests||[]).filter(r=>r.observedDay>=previous&&r.observedDay<start),rate=requests.length/Math.max(1,day-start),priorRate=before.length/Math.max(1,start-previous),byCategory={};
  for(const r of requests)for(const l of r.lines)byCategory[l.category]=(byCategory[l.category]||0)+l.quantity;
  const samePhase=day<=RULES.warmupDays||previous>=RULES.warmupDays;
  values.request_growth_ratio=priorRate?rate/priorRate:null;details.demand={requests:view.observedRequests?requests.length:null,previousRequests:view.observedRequests?before.length:null,currentRequestsPerDay:view.observedRequests?rate:null,previousRequestsPerDay:view.observedRequests?priorRate:null,observedUnitsByCategory:byCategory,fundingEvents:view.pastRequests.filter(r=>r.authorizedDay>=start&&r.authorizedDay<day).length,phaseComparability:{samePhase,warmupEndsBeforeDay:RULES.warmupDays,warning:samePhase?null:'These windows cross the simulation warmup boundary. The observed discovery-volume change is not by itself evidence of changing latent customer demand.'},scope:'Counted when the request was discovered, not its earlier latent-need creation date. Undiscovered needs are unavailable.'};
 }
 if(domains.includes('outreach')){const contacts=view.outreach.history.filter(c=>c.day>=start&&c.day<day);values.response_rate=contacts.length?contacts.filter(c=>c.responded).length/contacts.length:null;details.outreach={contacts:contacts.length,responses:contacts.filter(c=>c.responded).length,immediatelyAuthorized:contacts.filter(c=>c.authorized).length,costUSD:contacts.reduce((s,c)=>s+c.costCents,0)/100,remainingBudgetUSD:view.outreach.remainingBudgetCents/100,scope:'Immediate funding is not a retained purchase. No nonresponse is assumed to imply a permanent inactive market.'};}
 if(domains.includes('inventory')){const fillable=funded.filter(r=>enumerateBaskets(view,r,{limit:1}).length>0);values.funded_fill_rate=funded.length?fillable.length/funded.length:null;values.stockout_share=view.products.filter(p=>p.available<=0).length/Math.max(1,view.products.length);
  details.inventory={fundedRequests:funded.length,individuallyFillable:fillable.length,authorizedUSD:funded.reduce((s,r)=>s+r.authorizedCents,0)/100,urgentRequests:funded.filter(r=>r.deadlineDay<day+view.paymentRules.physicalLeadMaxDays+2).length,stockCostUSD:view.products.reduce((s,p)=>s+p.stock*p.costCents,0)/100,inboundLines:view.inbound.length,scope:'Urgent means new supplier stock cannot be guaranteed before the required delivery deadline.'};}
 if(domains.includes('liquidity')){const plan=planFundedBaskets(view),required=plan.orders.flatMap(o=>o.items).reduce((s,i)=>s+i.quantity*view.products.find(p=>p.id===i.productId).costCents,0);values.spendable_cash_usd=view.merchants.reduce((s,m)=>s+m.cashCents,0)/100;values.cash_to_replenishment_ratio=required?values.spendable_cash_usd/(required/100):null;
  details.liquidity={merchants:view.merchants.map(m=>({merchantId:m.id,spendableUSD:m.cashCents/100,balanceUSD:m.balanceCents/100})),fundedPlanCashUSD:required/100,fundedPlans:plan.decisions.filter(d=>d.status==='COMPLETE_FUNDED_PLAN').length,scope:'Known spendable balances and a feasible current replenishment plan; not household money or a macroeconomic liquidity forecast.'};}
 if(domains.includes('supply')){values.supplier_lead_days=view.paymentRules.physicalLeadMaxDays;details.supply={normalLeadDays:view.paymentRules.physicalLeadDays,quotedMaximumLeadDays:view.paymentRules.physicalLeadMaxDays,bankSettlementDaysPerStage:view.paymentRules.bankLagDays,incomingWithinSevenDays:view.inbound.filter(i=>(i.confirmedArrivalDay??i.latestArrivalDay)<=day+7).reduce((s,i)=>s+i.quantity,0),scope:'Quoted lead times and currently announced arrivals, not future realized disruptions.'};}
 if(domains.includes('payments')){const totals={};for(const l of (view.paymentEvents||[]).filter(l=>l.day>=start&&l.day<day))totals[l.kind]=(totals[l.kind]||0)+((l.to==='platform'?l.cents:0)-(l.from==='platform'?l.cents:0))/100;
  const matureEnd=day-RULES.returnWindowDays,mature=view.pastOrders.filter(o=>o.day<matureEnd&&o.day>=matureEnd-windowDays),refunded=mature.filter(o=>['SETTLED','PENDING_FUNDS'].includes(o.refundStatus));values.payment_cash_margin_usd=Object.values(totals).reduce((s,n)=>s+n,0);values.mature_refund_rate=mature.length?refunded.length/mature.length:null;
  details.payments={retailCaptures:recent.length,retailCapturedUSD:recent.reduce((s,o)=>s+o.grossCents,0)/100,supplierPaidVolumeUSD:(view.supplierInvoices||[]).filter(i=>i.rail==='paypal'&&i.paidDay>=start&&i.paidDay<day).reduce((s,i)=>s+i.grossCents,0)/100,cashMovementsUSD:totals,knownPlatformObligationsUSD:(view.platformObligations||[]).reduce((s,l)=>s+l.amountCents,0)/100,feeSchedule:{source:'FROZEN_SIMULATOR_ASSUMPTIONS_NOT_LIVE_PRICES',paypalRate:view.paymentRules.feeRate,paypalFixedUSD:view.paymentRules.feeFixedCents/100,processingRate:RULES.processingRate,processingFixedUSD:RULES.processingFixedCents/100,bankFixedUSD:view.paymentRules.bankFeeCents/100},matureCohort:{firstCaptureDay:matureEnd-windowDays,lastCaptureDay:matureEnd-1,orders:mature.length,refunds:refunded.length},scope:'Cash margin is observed, not a promise of future settled profit. Retail and supplier volumes are separate payment legs.'};}
 const result={asOfDay:day,historyThroughDay:day-1,windowDays,domains,values,details};return {...result,evidenceId:'E-'+digest(result).slice(0,20)};
}
export function trainEconomicForecast(view,method){
 if(!['recent7','recent14','legacy28','adaptive'].includes(method))throw Error('INVALID_FORECAST_JOB');
 const fit=fitForecast(view,method),window={recent7:7,recent14:14,legacy28:28}[fit.selected],funded=view.pastRequests.filter(r=>Number.isInteger(r.authorizedDay)&&r.authorizedDay<view.day&&r.funded),body={snapshotId:digest(view),asOfDay:view.day,recipe:method,selected:fit.selected,fitWindowDays:window,validationMSE:fit.scores,rates:fit.rates,availableFundedRows:funded.length,trainingRows:funded.filter(r=>r.authorizedDay>=Math.max(0,view.day-window)).length,scope:'Local rolling Poisson rate fit with past-only temporal window selection. Available history and rows in the selected fit window are reported separately. Future demand is not observed.'};
 return {id:'F-'+digest(body).slice(0,20),...body};
}
const keys=['campaign','conditions','cover_days','duration_days','forecast_id','inventory','objective','settlement'];
export function validateEconomicPatch(policy,forecast=null){
 if(!policy||Object.keys(policy).sort().join()!==keys.sort().join()||!['v1','recommendations','reactivation','pause_outreach'].includes(policy.campaign)||!['joint','paypal'].includes(policy.objective)||!['v1','funded_only','forecast_cover'].includes(policy.inventory)||!['fast','deadline'].includes(policy.settlement)||![0,3,7].includes(policy.cover_days)||![3,7].includes(policy.duration_days)||!Array.isArray(policy.conditions)||policy.conditions.length>2)throw Error('INVALID_ECONOMIC_PATCH');
 for(const c of policy.conditions)if(!c||Object.keys(c).sort().join()!=='indicator,operator,value,window_days'||!Object.hasOwn(ECONOMIC_INDICATORS,c.indicator)||!['above','below'].includes(c.operator)||![7,14,28].includes(c.window_days)||!Number.isFinite(c.value)||Math.abs(c.value)>1e7)throw Error('INVALID_ECONOMIC_CONDITION');
 if(policy.forecast_id!=='none'&&policy.forecast_id!==forecast?.id)throw Error('UNKNOWN_FORECAST_ARTIFACT');
 if(policy.inventory==='forecast_cover'&&!forecast)throw Error('FORECAST_REQUIRED');
 if(policy.settlement==='deadline'&&policy.inventory!=='forecast_cover')throw Error('DEADLINE_ROUTING_REQUIRES_FORECAST_COVER');
 if(policy.campaign==='v1'&&policy.objective==='joint'&&policy.inventory==='v1'&&policy.settlement==='fast')throw Error('NO_POLICY_CHANGE');
 return structuredClone(policy);
}
export function requiredEconomicEvidence(policy){
 const domains=new Set(policy.conditions.map(c=>ECONOMIC_INDICATORS[c.indicator].domain));
 if(policy.campaign!=='v1'||policy.objective!=='joint'){domains.add('outreach');domains.add('demand');domains.add('payments');}
 if(policy.inventory!=='v1'){domains.add('inventory');domains.add('liquidity');}
 if(policy.settlement!=='fast'){domains.add('supply');domains.add('payments');}
 return [...domains];
}
export function patchApplies(view,candidate){
 if(view.day<candidate.reviewDay||view.day>=candidate.reviewDay+candidate.policy.duration_days)return false;
 return evaluateEconomicConditions(view,candidate.policy).every(c=>c.passes);
}
export function evaluateEconomicConditions(view,policy){
 return policy.conditions.map(c=>{const value=inspectEconomy(view,[ECONOMIC_INDICATORS[c.indicator].domain],c.window_days).values[c.indicator];return {...c,observedValue:value,passes:Number.isFinite(value)&&(c.operator==='above'?value>c.value:value<c.value)};});
}
export function compileEconomicInventory(resources,candidate,view=null){
 const p=candidate.policy,base=resources.funded.program;if(p.inventory==='v1')return resources.funded;
 const program={...base,stockTarget:field('funded_units')};
 if(p.inventory==='forecast_cover'){
  if(!view)throw Error('CURRENT_SUPPLIER_QUOTE_REQUIRED');
  const name={recent7:'rate7',recent14:'rate14',legacy28:'rate28'}[candidate.forecast.selected];
  const lead=view.paymentRules.physicalLeadMaxDays+(p.settlement==='deadline'?2*view.paymentRules.bankLagDays:0);
  program.stockTarget=op('add',field('funded_units'),op('mul',field(name),op('min',p.cover_days+lead,field('days_remaining'))));
  // Existing guarded SKU planner supports settlement-aware procurement. Fast
  // mode retains complete-basket planning before forecast inventory.
  program.rail=p.settlement==='deadline'?'deadline':'fast';if(program.rail==='deadline')program.fulfillment='sku_counts';
 }
 return compileProgram(program);
}
export function economicContactPlan(view,resources,candidate){
 const p=candidate.policy;if(p.campaign==='pause_outreach')return {actions:[],ranking:[],configuration:resources.fixed.config,reason:'Temporary paid-outreach pause only; organic shopping, funded baskets, fulfillment and settlement continue.'};
 return workbenchPlan(view,{model:resources.incumbent,campaign:{kind:{v1:'open_discovery',recommendations:'product_recommendations',reactivation:'reactivation'}[p.campaign],objective:p.objective},prior:resources.prior,fundingPrior:resources.fundingPrior,configuration:resources.fixed.config});
}
