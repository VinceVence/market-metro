// Authored supplier-payment experiment, not native PayPal execution or pricing.
// Two distinct goods trades: retailer->wholesaler->manufacturer. Never add a
// payment for a loop or count an unpaid invoice as settled payment volume.
export const NETWORK=Object.freeze({version:'supplier-network-v1',bankLagDays:2,bankFeeCents:25,feeRate:.0349,feeFixedCents:49,processingRate:.012,processingFixedCents:20,upstreamCostShare:.7,rawMaterialShare:.6});
const ppFee=n=>Math.round(n*NETWORK.feeRate)+NETWORK.feeFixedCents,processing=n=>Math.round(n*NETWORK.processingRate)+NETWORK.processingFixedCents;
function allocate(total,weights){const sum=weights.reduce((s,x)=>s+x,0),raw=weights.map(w=>total*w/sum),parts=raw.map(Math.floor),order=raw.map((x,i)=>({i,f:x-parts[i]})).sort((a,b)=>b.f-a.f||a.i-b.i);for(let left=total-parts.reduce((s,x)=>s+x,0),i=0;i<left;i++)parts[order[i].i]++;return parts;}
export const defaultNetworkPlan=()=>({merchantRail:'auto',supplierRail:'auto'});
export function initializeNetwork(){return {accounts:{wholesaler:0,manufacturer:0,platform:0,processor:0,bank:0,raw_materials:0,clearing:0},invoices:[],cashEnteredCents:0,plan:defaultNetworkPlan()};}
export function validateNetworkPlan(p){if(!p||Object.keys(p).sort().join()!=='merchantRail,supplierRail'||![p.merchantRail,p.supplierRail].every(x=>['auto','bank','paypal'].includes(x)))throw Error('INVALID_NETWORK_PLAN');return structuredClone(p);}
export function applyNetworkPlan(w,p){w.commerce.network.plan=validateNetworkPlan(p);}
function selectRail(mode,gross,avoidedStockoutCents){return mode==='auto'?(avoidedStockoutCents>ppFee(gross)-NETWORK.bankFeeCents?'paypal':'bank'):mode;}
function invoice(w,{from,to,gross,rail,orders,externalDebit=false,urgency=0}){
 const n=w.commerce.network;if(!Number.isSafeInteger(gross)||gross<1)throw Error('INVALID_INVOICE_AMOUNT');
 if(externalDebit)n.cashEnteredCents+=gross;else{if(n.accounts[from]<gross)throw Error('UNFUNDED_SUPPLIER_PAYMENT');n.accounts[from]-=gross;}
 n.accounts.clearing+=gross;
 const roots=orders.map(id=>w.commerce.procurement.find(o=>o.id===id)),shares=allocate(gross,roots.map(o=>o.costCents));
 const row={id:w.runId+'-B2B-'+n.invoices.length,from,to,grossCents:gross,rail,orders:[...orders],allocations:roots.map((o,i)=>({orderId:o.id,rootDay:o.orderedDay,grossCents:shares[i],feeCents:0,processingCents:0,rawMaterialCents:0})),createdDay:w.tick,settlementDay:w.tick+(rail==='paypal'?0:NETWORK.bankLagDays),status:'PENDING',feeCents:0,processingCents:0,urgencyCents:urgency,source:'SIMULATED_SUPPLIER_PAYMENT'};n.invoices.push(row);return row;
}
export function routeProcurement(w,orders){
 if(!orders.length)return;const n=w.commerce.network;
 for(let merchant=0;merchant<3;merchant++){
  const xs=orders.filter(o=>o.merchant===merchant);if(!xs.length)continue;
  const gross=xs.reduce((s,o)=>s+o.costCents,0),urgency=xs.reduce((s,o)=>s+o.avoidedStockoutCents,0),rail=selectRail(n.plan.merchantRail,gross,urgency);
  const inv=invoice(w,{from:'merchant-'+merchant,to:'wholesaler',gross,rail,orders:xs.map(o=>o.id),externalDebit:true,urgency});for(const o of xs){o.invoiceId=inv.id;o.dueDay=null;}
 }
 advanceNetwork(w);
}
export function advanceNetwork(w){
 const n=w.commerce.network,manufacturerOrders=[];let wholesalerGross=0,urgency=0;
 // Settle only the invoices that existed when this pass began. Newly created
 // upstream invoices are processed by a bounded second pass below.
 const due=n.invoices.filter(i=>i.status==='PENDING'&&i.settlementDay<=w.tick);
 for(const i of due){const fee=i.rail==='paypal'?ppFee(i.grossCents):NETWORK.bankFeeCents,pc=i.rail==='paypal'?processing(i.grossCents):0;
  if(fee>=i.grossCents)throw Error('UNECONOMIC_MICRO_INVOICE');n.accounts.clearing-=i.grossCents;n.accounts[i.to]+=i.grossCents-fee;n.accounts[i.rail==='paypal'?'platform':'bank']+=fee-pc;n.accounts.processor+=pc;Object.assign(i,{status:'PAID',paidDay:w.tick,feeCents:fee,processingCents:pc});
  const fees=allocate(fee,i.allocations.map(a=>a.grossCents)),pcs=allocate(pc,i.allocations.map(a=>a.grossCents));i.allocations.forEach((a,j)=>{a.feeCents=fees[j];a.processingCents=pcs[j];});
  if(i.to==='wholesaler'){wholesalerGross+=Math.round(i.grossCents*NETWORK.upstreamCostShare);manufacturerOrders.push(...i.orders);urgency+=i.urgencyCents;}
  else if(i.to==='manufacturer'){
   const raw=Math.round(i.grossCents*NETWORK.rawMaterialShare);n.accounts.manufacturer-=raw;n.accounts.raw_materials+=raw;const rawParts=allocate(raw,i.allocations.map(a=>a.grossCents));i.allocations.forEach((a,j)=>{a.rawMaterialCents=rawParts[j];});
   for(const id of i.orders){const order=w.commerce.procurement.find(o=>o.id===id);order.manufacturerInvoiceId=i.id;order.dueDay=w.tick+3+(w.scenario==='supply_delay'&&order.orderedDay>=35&&order.orderedDay<49?10:0);}
  }
 }
 if(wholesalerGross){const rail=selectRail(n.plan.supplierRail,wholesalerGross,urgency);invoice(w,{from:'wholesaler',to:'manufacturer',gross:wholesalerGross,rail,orders:manufacturerOrders,urgency});if(rail==='paypal')advanceNetwork(w);}
 assertNetworkIntegrity(w);
}
export function assertNetworkIntegrity(w){const n=w.commerce.network;if(Object.values(n.accounts).some(x=>!Number.isSafeInteger(x)||x<0)||Object.values(n.accounts).reduce((s,x)=>s+x,0)!==n.cashEnteredCents)throw Error('SUPPLIER_NETWORK_CASH_CONSERVATION_FAILED');const pending=n.invoices.filter(i=>i.status==='PENDING').reduce((s,i)=>s+i.grossCents,0);if(pending!==n.accounts.clearing)throw Error('INVOICE_CLEARING_MISMATCH');return true;}
export function networkOutcome(w,endDay){
 const n=w.commerce.network,paid=n.invoices.filter(i=>i.status==='PAID').map(i=>{const a=i.allocations.filter(a=>a.rootDay>=30&&a.rootDay<endDay);return {...i,grossCents:a.reduce((s,x)=>s+x.grossCents,0),feeCents:a.reduce((s,x)=>s+x.feeCents,0),processingCents:a.reduce((s,x)=>s+x.processingCents,0),rawMaterialCents:a.reduce((s,x)=>s+x.rawMaterialCents,0)};}).filter(i=>i.grossCents>0),pp=paid.filter(i=>i.rail==='paypal'),retailToWholesale=paid.filter(i=>i.to==='wholesaler'),toManufacturer=paid.filter(i=>i.to==='manufacturer'),wholesaleRevenue=retailToWholesale.reduce((s,i)=>s+i.grossCents-i.feeCents,0),wholesaleCost=toManufacturer.reduce((s,i)=>s+i.grossCents,0),manufacturerContribution=toManufacturer.reduce((s,i)=>s+i.grossCents-i.feeCents-i.rawMaterialCents,0);
 return {version:NETWORK.version,settledInvoices:paid.length,paypalInvoices:pp.length,paypalVolumeCents:pp.reduce((s,i)=>s+i.grossCents,0),platformNetCents:pp.reduce((s,i)=>s+i.feeCents-i.processingCents,0),wholesalerContributionCents:wholesaleRevenue-wholesaleCost,manufacturerContributionCents:manufacturerContribution,partnerContributionCents:wholesaleRevenue-wholesaleCost+manufacturerContribution,bankFeesCents:paid.filter(i=>i.rail==='bank').reduce((s,i)=>s+i.feeCents,0),accounts:{...n.accounts},source:'MODELED_B2B_NETWORK_NOT_NATIVE_RECEIPTS'};
}
