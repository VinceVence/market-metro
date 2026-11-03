// Existing authored bank/PayPal fee and timing assumptions, now with explicit
// invoices and funded clearing. Procurement creates stock only after delivery.
import {RULES,fee,processing,transfer,allocateCents,idempotent,merchantSpendable} from './environment.mjs';
import {draw} from '../marketing/economy.mjs';
export function supplierQuote(w){return {physicalLeadDays:RULES.physicalLeadDays,physicalLeadMaxDays:w.scenario==='supplier_delay'&&w.day>=35&&w.day<60?6:RULES.physicalLeadDays};}
const rails=['bank','paypal'];
export function procurementLimit(observation,product,leadDays){
 const pending=observation.requests.filter(r=>r.status==='AUTHORIZED'&&r.deadlineDay>=observation.day+leadDays+2).flatMap(r=>r.lines).filter(l=>l.acceptableCatalogIds.includes(product.catalogId)).reduce((s,l)=>s+l.quantity,0);
 const past=observation.pastRequests.filter(r=>r.createdDay>=observation.day-28).flatMap(r=>r.lines).filter(l=>l.acceptableCatalogIds.includes(product.catalogId)).reduce((s,l)=>s+l.quantity,0),forecast=observation.day<observation.marketDays?Math.max(2,Math.ceil(past/Math.max(1,Math.min(28,observation.day))*Math.min(14,observation.marketDays-observation.day))):0,pipeline=observation.inbound.filter(p=>p.productId===product.id).reduce((s,p)=>s+p.quantity,0);
 return Math.max(0,Math.max(pending,forecast)-product.available-pipeline);
}
export function placeProcurement(w,{merchantId,items,merchantRail,supplierRail,key}){
 return idempotent(w,key,{type:'PROCURE',merchantId,items,merchantRail,supplierRail},()=>{
  if(!w.dayStarted||!w.merchants.some(m=>m.id===merchantId)||!rails.includes(merchantRail)||!rails.includes(supplierRail)||!Array.isArray(items)||!items.length||items.length>16||new Set(items.map(i=>i.productId)).size!==items.length)throw Error('INVALID_PROCUREMENT');
  const quote=supplierQuote(w),lead=quote.physicalLeadMaxDays+(merchantRail==='bank'?2:0)+(supplierRail==='bank'?2:0),view={day:w.day,marketDays:w.settings.days,requests:w.requests,pastRequests:w.requests.filter(r=>r.createdDay<w.day),inbound:w.procurements.filter(p=>p.status!=='DELIVERED')};
  const resolved=items.map(item=>{const product=w.products.find(p=>p.id===item.productId);if(!product||product.merchantId!==merchantId||Object.keys(item).sort().join()!=='productId,quantity'||!Number.isSafeInteger(item.quantity)||item.quantity<1||item.quantity>20)throw Error('INVALID_PROCUREMENT_ITEM');const available={...product,available:product.stock-product.reserved};if(item.quantity>procurementLimit(view,available,lead))throw Error('PROCUREMENT_EXCEEDS_OBSERVED_DEMAND');return {...item,costCents:product.costCents*item.quantity};});
  const cost=resolved.reduce((s,i)=>s+i.costCents,0);if(merchantSpendable(w,merchantId)<cost)throw Error('INSUFFICIENT_MERCHANT_CASH');
  transfer(w,merchantId,'procurement_clearing',cost,{kind:'PROCUREMENT_FUNDED',reference:key});
  const ids=[];for(const item of resolved){const order={id:'PO-'+w.procurements.length,merchantId,...item,orderedDay:w.day,merchantRail,supplierRail,physicalLeadMaxDays:quote.physicalLeadMaxDays,latestArrivalDay:w.day+lead,dueDay:null,status:'RESERVED_FUNDS'};w.procurements.push(order);ids.push(order.id);w.events.push({day:w.day,type:'PROCUREMENT_FUNDED',procurementId:order.id,productId:item.productId,quantity:item.quantity,costCents:item.costCents});}
  return {procurementIds:ids,costCents:cost,latestArrivalDay:w.day+lead,source:'SIMULATED_SUPPLIER_ORDER'};
 });
}
function invoice(w,stage,rail,roots){
 const allocations=roots.map(root=>({procurementId:root.id,grossCents:stage==='RETAIL_TO_WHOLESALE'?root.costCents:root.factoryCostCents})),grossCents=allocations.reduce((s,a)=>s+a.grossCents,0),recipient=stage==='RETAIL_TO_WHOLESALE'?'wholesaler':'manufacturer',id='SUPPLIER-INVOICE-'+w.supplierInvoices.length;
 if(stage==='WHOLESALE_TO_FACTORY')transfer(w,'wholesaler','procurement_clearing',grossCents,{kind:'FACTORY_INVOICE_FUNDED',reference:id});
 const row={id,stage,rail,recipient,grossCents,createdDay:w.day,settlementDay:w.day+(rail==='bank'?RULES.bankLagDays:0),status:'PENDING',allocations,feeCents:0,processingCents:0};w.supplierInvoices.push(row);
 for(const root of roots){root.status=stage==='RETAIL_TO_WHOLESALE'?'WHOLESALER_PAYMENT_PENDING':'FACTORY_PAYMENT_PENDING';root[stage==='RETAIL_TO_WHOLESALE'?'wholesalerInvoiceId':'factoryInvoiceId']=id;}
 return row;
}
export function submitSupplierBatches(w){
 const roots=w.procurements.filter(p=>p.status==='RESERVED_FUNDS');
 for(const rail of rails){const group=roots.filter(p=>p.merchantRail===rail);if(group.length)invoice(w,'RETAIL_TO_WHOLESALE',rail,group);}
}
export function advanceSuppliers(w){
 let ready;
 while((ready=w.supplierInvoices.filter(i=>i.status==='PENDING'&&i.settlementDay<=w.day)).length){
  const factoryGroups={bank:[],paypal:[]};
  for(const i of ready){
   const charge=i.rail==='paypal'?fee(i.grossCents):RULES.bankFeeCents,pc=i.rail==='paypal'?processing(i.grossCents):0;if(charge>=i.grossCents)throw Error('UNECONOMIC_SUPPLIER_INVOICE');
   transfer(w,'procurement_clearing',i.recipient,i.grossCents,{kind:'SUPPLIER_INVOICE_SETTLED',reference:i.id});transfer(w,i.recipient,i.rail==='paypal'?'platform':'bank_fees',charge,{kind:i.rail==='paypal'?'SUPPLIER_PAYMENT_FEE':'BANK_PAYMENT_FEE',reference:i.id});if(pc)transfer(w,'platform','processor',pc,{kind:'SUPPLIER_PROCESSING',reference:i.id});
   Object.assign(i,{status:'PAID',paidDay:w.day,feeCents:charge,processingCents:pc});const fees=allocateCents(charge,i.allocations.map(a=>a.grossCents)),costs=allocateCents(pc,i.allocations.map(a=>a.grossCents));i.allocations.forEach((a,j)=>{a.feeCents=fees[j];a.processingCents=costs[j];});
   for(const a of i.allocations){const root=w.procurements.find(p=>p.id===a.procurementId);
    if(i.stage==='RETAIL_TO_WHOLESALE'){root.factoryCostCents=Math.round(root.costCents*.7);factoryGroups[root.supplierRail].push(root);}
    else{const raw=Math.round(root.factoryCostCents*.6);transfer(w,'manufacturer','raw_materials',raw,{kind:'RAW_MATERIAL_EXPENSE',reference:root.id});a.rawMaterialCents=raw;const lead=RULES.physicalLeadDays+Math.floor(draw(w.seed,'deadline-supplier-delay',root.orderedDay,root.productId)*(root.physicalLeadMaxDays-RULES.physicalLeadDays+1));root.dueDay=w.day+lead;root.status='IN_TRANSIT';w.events.push({day:w.day,type:'SUPPLIER_DISPATCHED',procurementId:root.id,arrivalDay:root.dueDay});}
   }
  }
  for(const rail of rails)if(factoryGroups[rail].length)invoice(w,'WHOLESALE_TO_FACTORY',rail,factoryGroups[rail]);
 }
 for(const root of w.procurements)if(root.status==='IN_TRANSIT'&&root.dueDay<=w.day){w.products.find(p=>p.id===root.productId).stock+=root.quantity;root.status='DELIVERED';root.deliveredDay=w.day;w.events.push({day:w.day,type:'SUPPLIER_DELIVERED',procurementId:root.id,productId:root.productId,quantity:root.quantity});}
}
