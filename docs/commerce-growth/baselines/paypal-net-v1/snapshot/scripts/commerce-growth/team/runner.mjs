// Controller extension only. Uses the original frozen growth transitions and warmup.
import {beginGrowthDay,endGrowthDay,observeGrowthWorld,contactCustomer,assertGrowthIntegrity,digest} from '../environment.mjs';
import {warmGrowthWorld} from '../evaluate.mjs';
import {balances,settledPlatformNet} from '../../commerce-deadlines/evaluate.mjs';
import {fulfill,outreachPlan} from './control.mjs';
export async function runCoordinatedCase(settings,policy,{trace=false,controller=null,allocator,prior,commerceExecutor=fulfill}={}){
 const w=warmGrowthWorld(settings),opening=balances(w),initialHash=digest(w),start=performance.now(),durations=[];
 let learnedUpdates=0,lastRows=-1,calibrationUpdates=0,lastCalibration=null;
 while(w.day<w.totalDays){
  beginGrowthDay(w);const view=observeGrowthWorld(w),then=performance.now();
  const proposal=controller?await controller.plan(view):{...outreachPlan(view,policy.config,prior),configuration:policy.config};
  if(!Array.isArray(proposal.actions))throw Error('INVALID_OUTREACH_PLAN');
  const actions=proposal.actions.map((a,i)=>({...a,key:policy.id+':contact:'+w.day+':'+i}));
  // All actions in a proposed batch must validate before any contact is sent.
  const copy=structuredClone(w);for(const a of actions)contactCustomer(copy,a);Object.assign(w,copy);
  const activity=await commerceExecutor(w,proposal.configuration,allocator,policy.id);durations.push(performance.now()-then);
  if(proposal.model&&proposal.model.rows!==lastRows){learnedUpdates++;lastRows=proposal.model.rows;}
  if(proposal.model?.calibration){const fingerprint=digest(proposal.model.calibration.groups);if(fingerprint!==lastCalibration){calibrationUpdates++;lastCalibration=fingerprint;}}
  w.decisions.push({day:w.day,policy:policy.id,source:controller?'APPLICATION_AGENT_TEAM':policy.id==='local_calibrated'?'LOCAL_CALIBRATED_WORKFLOW':'FIXED_WORKFLOW',configuration:proposal.configuration,agentCheckpoint:proposal.agentCheckpoint??null,
   evidence:{snapshotHash:digest(view),signals:view.signals.length,contactable:view.audience.filter(p=>p.marketingConsent&&!p.hasOpenRequest).length},
   reason:proposal.reason,model:proposal.model?{id:proposal.model.id,type:proposal.model.type,rows:proposal.model.rows,cutoffDay:proposal.model.cutoffDay,...(proposal.model.calibration?{calibration:proposal.model.calibration}:{})}:null,
   contacts:actions.map(a=>({customerId:a.customerId,kind:a.kind,category:a.category,catalogId:a.catalogId})),ranking:proposal.ranking||[],
   results:w.growth.contacts.filter(c=>c.day===w.day),commerce:{captured:activity.captured,stockUnits:activity.stockUnits,forecast:activity.model,solver:activity.solver},
   checkpoints:['OBSERVE','RANK','CONSENT_AND_BUDGET_CHECK','CONTACT','FUNDED_REQUEST','COMMERCE_EXECUTION']});
  endGrowthDay(w);
 }
 assertGrowthIntegrity(w);const closing=balances(w),orders=w.orders.filter(o=>o.day>=30),contacts=w.growth.contacts,
 retailer=Object.keys(opening.merchant).reduce((s,id)=>s+closing.merchant[id].equity-opening.merchant[id].equity,0),
 wholesaler=closing.wholesaler-opening.wholesaler,manufacturer=closing.manufacturer-opening.manufacturer,
 net=settledPlatformNet(opening,closing),liabilities=w.liabilities.filter(l=>l.status!=='SETTLED'),byRequest=new Map(w.requests.map(r=>[r.id,r]));
 const retained=orders.filter(o=>!['SETTLED','PENDING_FUNDS'].includes(o.refundStatus));
 const attributed=retained.filter(o=>byRequest.get(o.requestId).discovery==='CONSENTED_OUTREACH');
 const recommended=attributed.filter(o=>{const id=byRequest.get(o.requestId).recommendedCatalogId;return id&&o.items.some(i=>w.products.find(p=>p.id===i.productId).catalogId===id);});
 durations.sort((a,b)=>a-b);
 return {...settings,policy:policy.id,initialHash,opportunityHash:w.growth.opportunityHash,consentHash:w.growth.consentHash,incomeCents:w.incomeCents,
  platformUSD:net/100,retailerUSD:retailer/100,wholesalerUSD:wholesaler/100,manufacturerUSD:manufacturer/100,
  allPartnerUSD:(retailer+wholesaler+manufacturer)/100,
  terminalCashUSD:(Object.values(closing.merchant).reduce((s,m)=>s+m.cash,0)+closing.wholesaler+closing.manufacturer)/100,
  terminalInventoryUSD:Object.values(closing.merchant).reduce((s,m)=>s+m.inventory,0)/100,
  merchantContributions:Object.fromEntries(Object.keys(opening.merchant).map(id=>[id,(closing.merchant[id].equity-opening.merchant[id].equity)/100])),
  purchases:orders.length,retainedPurchases:retained.length,retainedVolumeUSD:retained.reduce((s,o)=>s+o.grossCents,0)/100,
  fulfilledRequests:orders.filter(o=>w.deliveries.some(d=>d.orderId===o.id&&d.onTime)).length,
  contactCount:contacts.length,recommendationsSent:contacts.filter(c=>c.kind==='recommend').length,fundedResponses:contacts.filter(c=>c.authorized).length,
  attributedPurchases:attributed.length,recommendationPurchases:recommended.length,outreachCostUSD:w.growth.outreachCents/100,
  requestCount:w.requests.filter(r=>r.createdDay>=30).length,needCount:w.growth.needs.filter(n=>n.request.createdDay>=30).length,
  outsidePurchases:w.ledger.filter(l=>l.day>=30&&l.kind==='OUTSIDE_PURCHASE').length,
  unpaidLiabilities:liabilities.length,unpaidLiabilityUSD:liabilities.reduce((s,l)=>s+l.amountCents,0)/100,
  reliability:{invariantsPassed:true,learnedPosteriorUpdates:learnedUpdates,calibrationUpdates,p95DecisionMs:durations[Math.floor(durations.length*.95)]||0,totalWallMs:Math.round(performance.now()-start)},
  modelCostUSD:0,source:'AUTHORED_FINITE_NEED_GROWTH_SIMULATION',
  ...(trace?{trace:{decisions:w.decisions,contacts:w.growth.contacts,requests:w.requests,orders:w.orders,deliveries:w.deliveries,ledger:w.ledger,invoices:w.supplierInvoices}}:{})};
}
