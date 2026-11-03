// Approved, separate deadline scenario. Firm requests are conditional customer
// consent, not extra cash or guaranteed executable orders. No provider calls.
import {draw} from '../marketing/economy.mjs';
import {authoredCatalog} from '../behavior-v4/catalog.mjs';
import {createHash} from 'node:crypto';
import {advanceSuppliers,submitSupplierBatches,supplierQuote} from './suppliers.mjs';

export const VERSION='deadline-commerce-1';
// The tail covers the last request's12-day deadline plus its14-day return
// window. It produces no new requests or wages and cannot inflate demand.
export const RULES=Object.freeze({customers:100,days:100,warmupDays:30,followupDays:26,merchantCashCents:150000,feeRate:.0349,feeFixedCents:49,processingRate:.012,processingFixedCents:20,deliveryCents:350,bankFeeCents:25,bankLagDays:2,physicalLeadDays:3,returnProbability:.035,returnWindowDays:14,holdingRatePerDay:.0002,minimumReturnCashBuffer:.10});
export const SCENARIOS=Object.freeze({
 ordinary:{requestsPerDay:4,initialStock:6,minDeadline:8,maxDeadline:12,maxLines:2},
 scarce_stock:{requestsPerDay:6,initialStock:1,minDeadline:6,maxDeadline:12,maxLines:2},
 concentrated_needs:{requestsPerDay:6,initialStock:2,minDeadline:5,maxDeadline:10,maxLines:2},
 mixed_deadlines:{requestsPerDay:6,initialStock:2,minDeadline:3,maxDeadline:12,maxLines:3},
 supplier_delay:{requestsPerDay:5,initialStock:2,minDeadline:6,maxDeadline:12,maxLines:2},
 preference_shift:{requestsPerDay:5,initialStock:2,minDeadline:5,maxDeadline:10,maxLines:3}
});
export const fee=cents=>Math.round(cents*RULES.feeRate)+RULES.feeFixedCents;
export const processing=cents=>Math.round(cents*RULES.processingRate)+RULES.processingFixedCents;
export function createDeadlineWorld({seed,scenario='ordinary',days=RULES.days,customers=RULES.customers}={}){
 if(!Number.isSafeInteger(seed)||!Object.hasOwn(SCENARIOS,scenario)||!Number.isInteger(days)||days<31||days>365||!Number.isInteger(customers)||customers<1||customers>600)throw Error('INVALID_DEADLINE_SETTINGS');
 const catalog=authoredCatalog(),accounts={platform:0,processor:0,bank_fees:0,wholesaler:0,manufacturer:0,raw_materials:0,household_expenses:0,outside_shops:0},people=[],merchants=[],products=[];
 for(let i=0;i<customers;i++){const id='BUYER-'+String(i).padStart(4,'0');accounts[id]=Math.round(6000+18000*draw(seed,'wallet',i));people.push({id,index:i,weeklyIncomeCents:3000+Math.round(6000*draw(seed,'v3-income',i))});}
 for(let i=0;i<3;i++){const id='MERCHANT-'+i;accounts[id]=RULES.merchantCashCents;merchants.push({id,name:['Willow Goods','Oak & Ink','Corner Supply'][i]});for(const p of catalog)products.push({id:id+'-'+p.id,merchantId:id,catalogId:p.id,title:p.title,category:p.category,priceCents:p.priceCents,costCents:Math.round(p.priceCents*[.60,.43,.52][i]),stock:SCENARIOS[scenario].initialStock,initialStock:SCENARIOS[scenario].initialStock,reserved:0});}
 return {version:VERSION,seed,scenario,settings:{days,customers},day:0,totalDays:days+RULES.followupDays,accounts,people,merchants,products,catalog,initialCashCents:Object.values(accounts).reduce((s,n)=>s+n,0),incomeCents:0,requests:[],ledger:[],events:[],procurements:[],supplierInvoices:[],orders:[],deliveries:[],liabilities:[],decisions:[],actionResults:{},privateOrderOutcomes:{},dayStarted:false};
}
export function transfer(w,from,to,cents,{kind,reference,allowLiability=false}={}){
 if(!Number.isSafeInteger(cents)||cents<0||!kind||!Object.hasOwn(w.accounts,from)||from===to)throw Error('INVALID_LEDGER_TRANSFER');
 if(!allowLiability&&w.accounts[from]<cents)throw Error('INSUFFICIENT_FUNDS');
 // Only the environment's eventual refund handler may explicitly record a
 // liability. Application actions must never use overdrafts to finance stock.
 if(allowLiability)throw Error('UNIMPLEMENTED_LIABILITY_TRANSFER');
 w.accounts[to]??=0;w.accounts[from]-=cents;w.accounts[to]+=cents;
 const entry={id:'ENTRY-'+w.ledger.length,day:w.day,from,to,cents,kind,reference:reference||null,source:'SIMULATED_DEADLINE_LEDGER'};w.ledger.push(entry);return entry;
}
function fundHouseholds(w){
 if(!w.day||w.day%7!==0)return;
 for(const person of w.people){
  // Income is exogenous and identical in every policy arm. Unspent income is
  // retained rather than silently destroyed at a wallet-cap boundary.
  const amount=person.weeklyIncomeCents;w.accounts[person.id]+=amount;w.incomeCents+=amount;
  w.ledger.push({id:'ENTRY-'+w.ledger.length,day:w.day,from:'EXOGENOUS_INCOME',to:person.id,cents:amount,kind:'INCOME',reference:null,source:'SIMULATED_DEADLINE_LEDGER'});
  const household=Math.round(amount*(.25+.25*draw(w.seed,'household-needs',w.day,person.index)));
  transfer(w,person.id,'household_expenses',household,{kind:'HOUSEHOLD_EXPENSE'});
 }
}
export function requestFor(w,person,day){
 const setting=SCENARIOS[w.scenario];if(draw(w.seed,'deadline-arrival',day,person.index)>=setting.requestsPerDay/w.settings.customers)return null;
 const topics=[...new Set(w.catalog.map(p=>p.category))],lines=[],count=1+Math.floor(draw(w.seed,'deadline-lines',day,person.index)*setting.maxLines);
 for(let j=0;j<count;j++){
  let topic=Math.floor(draw(w.seed,'deadline-topic',day,person.index,j)*topics.length);
  if(w.scenario==='concentrated_needs')topic=(Math.floor(day/14)+j)%topics.length;
  if(w.scenario==='preference_shift'&&day>=55)topic=(topic+1)%topics.length;
  const eligible=w.catalog.filter(p=>p.category===topics[topic]),preferred=Math.floor(draw(w.seed,'deadline-tier',day,person.index,j)*eligible.length),alternativeCount=1+Math.floor(draw(w.seed,'deadline-flexibility',day,person.index,j)*3),acceptable=eligible.filter((p,k)=>Math.abs(k-preferred)<alternativeCount).map(p=>p.id),quantity=draw(w.seed,'deadline-quantity',day,person.index,j)<.12?2:1;
  lines.push({id:'LINE-'+j,category:topics[topic],preferredCatalogId:eligible[preferred].id,acceptableCatalogIds:acceptable,quantity});
 }
 const base=lines.reduce((s,line)=>s+w.catalog.find(p=>p.id===line.preferredCatalogId).priceCents*line.quantity,0),budgetCents=Math.ceil(base*(1.05+.1*draw(w.seed,'deadline-budget',day,person.index))),duration=setting.minDeadline+Math.floor(draw(w.seed,'deadline-duration',day,person.index)*(setting.maxDeadline-setting.minDeadline+1));
 return {id:'REQUEST-'+day+'-'+person.index,customerId:person.id,createdDay:day,deadlineDay:day+duration,budgetCents,lines,status:'REQUESTED',authorizationId:null,allocatedItems:[],source:'SIMULATED_CUSTOMER_CONDITIONAL_REQUEST'};
}
export function authorizeRequest(w,request,amount=Math.min(request.budgetCents,w.accounts[request.customerId])){
 if(request.status!=='REQUESTED'||request.deadlineDay<w.day)return false;
 if(!Number.isSafeInteger(amount)||amount<0||amount>request.budgetCents)throw Error('INVALID_AUTHORIZATION_AMOUNT');if(!amount)return false;
 const minimum=request.lines.reduce((s,line)=>s+Math.min(...line.acceptableCatalogIds.map(id=>w.catalog.find(p=>p.id===id).priceCents))*line.quantity,0);if(amount<minimum)return false;
 if(w.accounts[request.customerId]<amount)return false;
 const account='AUTH-'+request.id;transfer(w,request.customerId,account,amount,{kind:'AUTHORIZE',reference:request.id});
 request.authorizationId=account;request.authorizedCents=amount;request.authorizedDay=w.day;request.status='AUTHORIZED';w.events.push({day:w.day,type:'REQUEST_AUTHORIZED',requestId:request.id,amountCents:amount,budgetCents:request.budgetCents});return true;
}
export function releaseAuthorization(w,request,reason){
 const account=request.authorizationId;if(!account)return;
 const amount=w.accounts[account]||0;if(amount)transfer(w,account,request.customerId,amount,{kind:'AUTHORIZATION_RELEASE',reference:request.id});
 w.events.push({day:w.day,type:'AUTHORIZATION_RELEASED',requestId:request.id,reason});
}
function expireRequests(w){
 for(const r of w.requests){
  if(r.status==='RESERVED'&&r.quote.expiresDay<w.day){for(const item of r.allocatedItems)w.products.find(p=>p.id===item.productId).reserved-=item.quantity;r.allocatedItems=[];r.quote=null;r.status='AUTHORIZED';w.events.push({day:w.day,type:'RESERVATION_EXPIRED',requestId:r.id});}
  if(!['REQUESTED','AUTHORIZED'].includes(r.status)||r.deadlineDay>=w.day)continue;
  releaseAuthorization(w,r,'Deadline passed without a complete delivery commitment');
  const outsideCents=r.lines.reduce((s,line)=>s+Math.min(...line.acceptableCatalogIds.map(id=>w.catalog.find(p=>p.id===id).priceCents))*line.quantity,0);
  if(w.accounts[r.customerId]>=outsideCents){transfer(w,r.customerId,'outside_shops',outsideCents,{kind:'OUTSIDE_PURCHASE',reference:r.id});r.outsideCents=outsideCents;}
  r.status='EXPIRED';w.events.push({day:w.day,type:'REQUEST_EXPIRED',requestId:r.id});
 }
}
export function beginDeadlineDay(w){
 if(w.dayStarted||w.day>=w.totalDays)throw Error('INVALID_DAY_TRANSITION');
 if(w.day<w.settings.days)fundHouseholds(w);advanceSuppliers(w);settleCustomerOrders(w);settleHoldingCosts(w);expireRequests(w);
 if(w.day<w.settings.days)for(const person of w.people){const request=requestFor(w,person,w.day);if(request)w.requests.push(request);}
 for(const request of w.requests)authorizeRequest(w,request);
 w.dayStarted=true;assertDeadlineIntegrity(w);
}
export function endDeadlineDay(w){if(!w.dayStarted)throw Error('DAY_NOT_STARTED');submitSupplierBatches(w);advanceSuppliers(w);chargeHoldingCosts(w);assertDeadlineIntegrity(w);w.day++;w.dayStarted=false;}
export function merchantSpendable(w,id){const owed=w.orders.filter(o=>o.refundStatus==='PENDING_FUNDS').flatMap(o=>o.merchants).filter(m=>m.id===id).reduce((s,m)=>s+m.grossCents,0)+w.liabilities.filter(l=>l.status==='HOLDING_COST_DUE'&&l.merchantId===id).reduce((s,l)=>s+l.amountCents,0),refundable=w.orders.filter(o=>o.day+RULES.returnWindowDays>w.day&&!o.refundStatus).flatMap(o=>o.merchants).filter(m=>m.id===id).reduce((s,m)=>s+m.grossCents,0),buffer=Math.ceil(refundable*RULES.minimumReturnCashBuffer),holding=Math.ceil(w.products.filter(p=>p.merchantId===id).reduce((s,p)=>s+p.stock*p.costCents,0)*RULES.holdingRatePerDay);return Math.max(0,w.accounts[id]-owed-buffer-holding);}
function settleHoldingCosts(w){for(const l of w.liabilities.filter(l=>l.status==='HOLDING_COST_DUE'))if(w.accounts[l.merchantId]>=l.amountCents){transfer(w,l.merchantId,'warehouse_costs',l.amountCents,{kind:'INVENTORY_HOLDING_COST',reference:l.id});l.status='SETTLED';}}
function chargeHoldingCosts(w){for(const m of w.merchants){const cents=Math.round(w.products.filter(p=>p.merchantId===m.id).reduce((s,p)=>s+p.stock*p.costCents,0)*RULES.holdingRatePerDay);if(!cents)continue;if(w.accounts[m.id]>=cents)transfer(w,m.id,'warehouse_costs',cents,{kind:'INVENTORY_HOLDING_COST',reference:'DAY-'+w.day});else w.liabilities.push({id:'RENT-'+w.day+'-'+m.id,merchantId:m.id,amountCents:cents,status:'HOLDING_COST_DUE'});}}
export function observeDeadlineWorld(w){
 return {version:w.version,day:w.day,marketDays:w.settings.days,merchants:w.merchants.map(m=>({...m,cashCents:merchantSpendable(w,m.id),balanceCents:w.accounts[m.id]})),products:w.products.map(p=>({...p,available:p.stock-p.reserved})),requests:w.requests.filter(r=>['REQUESTED','AUTHORIZED','RESERVED'].includes(r.status)).map(r=>structuredClone(r)),pastRequests:w.requests.filter(r=>r.createdDay<w.day).map(r=>({createdDay:r.createdDay,authorizedDay:r.authorizedDay??null,funded:!!r.authorizedCents,lines:structuredClone(r.lines)})),inbound:w.procurements.filter(p=>p.status!=='DELIVERED').map(p=>({id:p.id,productId:p.productId,quantity:p.quantity,status:p.status,latestArrivalDay:p.latestArrivalDay,confirmedArrivalDay:p.status==='IN_TRANSIT'?p.dueDay:null})),pastOrders:w.orders.filter(o=>o.day<w.day).map(o=>({...o})),pastEvents:w.events.filter(e=>e.day<w.day).slice(-200),paymentRules:{feeRate:RULES.feeRate,feeFixedCents:RULES.feeFixedCents,bankLagDays:RULES.bankLagDays,bankFeeCents:RULES.bankFeeCents,...supplierQuote(w)},scope:'Current customer-approved requirements and merchant-authorized inventory/cash; no future requests, household income, hidden shopper wallets or simulator seed.'};
}
export function allocateCents(total,weights){
 const sum=weights.reduce((s,n)=>s+n,0),parts=weights.map(n=>Math.floor(total*n/sum));let left=total-parts.reduce((s,n)=>s+n,0);
 for(const i of weights.map((n,i)=>({i,remainder:total*n/sum-parts[i]})).sort((a,b)=>b.remainder-a.remainder||a.i-b.i)){if(!left)break;parts[i.i]++;left--;}
 return parts;
}
export function idempotent(w,key,payload,action){
 if(typeof key!=='string'||!/^[A-Za-z0-9:_-]{1,120}$/.test(key))throw Error('INVALID_ACTION_KEY');
 const fingerprint=createHash('sha256').update(JSON.stringify(payload)).digest('hex'),slot='ACTION:'+key,prior=w.actionResults[slot];
 if(prior){if(prior.fingerprint!==fingerprint)throw Error('IDEMPOTENCY_KEY_REUSE');return structuredClone(prior.result);}
 const result=action();w.actionResults[slot]={fingerprint,result:structuredClone(result)};return result;
}
export function quoteBasket(w,requestId,items){
 const r=w.requests.find(r=>r.id===requestId);if(!r||!['REQUESTED','AUTHORIZED'].includes(r.status)||r.deadlineDay-w.day<2)throw Error('REQUEST_NOT_QUOTABLE');
 if(!Array.isArray(items)||items.length!==r.lines.length||new Set(items.map(i=>i.lineId)).size!==r.lines.length)throw Error('INCOMPLETE_BASKET');
 const used=new Map(),resolved=[];
 for(const item of items){
  if(!item||Object.keys(item).sort().join()!=='lineId,productId,quantity')throw Error('INVALID_BASKET_FIELDS');
  const line=r.lines.find(l=>l.id===item.lineId),product=w.products.find(p=>p.id===item.productId);
  if(!line||!product||!Number.isSafeInteger(item.quantity)||item.quantity!==line.quantity||!line.acceptableCatalogIds.includes(product.catalogId))throw Error('REQUEST_REQUIREMENT_VIOLATION');
  used.set(product.id,(used.get(product.id)||0)+item.quantity);resolved.push({...item,merchantId:product.merchantId,unitPriceCents:product.priceCents,unitCostCents:product.costCents});
 }
 for(const [id,qty]of used){const p=w.products.find(p=>p.id===id);if(p.stock-p.reserved<qty)throw Error('INSUFFICIENT_STOCK');}
 const grossCents=resolved.reduce((s,i)=>s+i.unitPriceCents*i.quantity,0);if(grossCents>r.budgetCents)throw Error('CUSTOMER_BUDGET_EXCEEDED');
 if(r.status==='AUTHORIZED'&&grossCents>r.authorizedCents)throw Error('CUSTOMER_FUNDED_LIMIT_EXCEEDED');
 const merchantIds=[...new Set(resolved.map(i=>i.merchantId))].sort(),gross=merchantIds.map(id=>resolved.filter(i=>i.merchantId===id).reduce((s,i)=>s+i.unitPriceCents*i.quantity,0)),fees=allocateCents(fee(grossCents),gross),merchants=merchantIds.map((id,i)=>({id,grossCents:gross[i],feeCents:fees[i],costCents:resolved.filter(l=>l.merchantId===id).reduce((s,l)=>s+l.unitCostCents*l.quantity,0),deliveryCents:RULES.deliveryCents}));
 if(merchants.some(m=>(m.grossCents-m.feeCents-m.costCents-m.deliveryCents)/m.grossCents<.2))throw Error('MERCHANT_MARGIN_FLOOR');
 const expiresDay=Math.min(w.day+2,r.deadlineDay-2);
 return {requestId,grossCents,feeCents:fee(grossCents),processingCents:processing(grossCents),items:resolved,merchants,expiresDay,latestDeliveryDay:expiresDay+2,source:'SIMULATED_QUOTE'};
}
export function reserveBasket(w,{requestId,items,key}){
 return idempotent(w,key,{type:'RESERVE',requestId,items},()=>{
  const quote=quoteBasket(w,requestId,items),r=w.requests.find(r=>r.id===requestId);
  if(r.status==='REQUESTED'&&!authorizeRequest(w,r,quote.grossCents))throw Error('CUSTOMER_AUTHORIZATION_NOT_FUNDED');
  if(w.accounts[r.authorizationId]<quote.grossCents)throw Error('AUTHORIZATION_TOO_SMALL');
  for(const item of quote.items)w.products.find(p=>p.id===item.productId).reserved+=item.quantity;
  r.allocatedItems=structuredClone(quote.items);r.quote=quote;r.status='RESERVED';w.events.push({day:w.day,type:'BASKET_RESERVED',requestId,quote});assertDeadlineIntegrity(w);
  return {requestId,reservationId:'RES-'+requestId,grossCents:quote.grossCents,expiresDay:quote.expiresDay};
 });
}
export function captureReservation(w,{requestId,key}){
 return idempotent(w,key,{type:'CAPTURE',requestId},()=>{
  const r=w.requests.find(r=>r.id===requestId);if(!r||r.status!=='RESERVED'||w.day>r.quote.expiresDay)throw Error('NO_VALID_RESERVATION');
  const q=r.quote;if(w.accounts[r.authorizationId]<q.grossCents)throw Error('AUTHORIZATION_TOO_SMALL');
  for(const item of q.items){const p=w.products.find(p=>p.id===item.productId);if(p.stock<item.quantity||p.reserved<item.quantity)throw Error('RESERVATION_STOCK_MISMATCH');}
  const id='SIM-CAPTURE-'+w.orders.length;
  for(const m of q.merchants){transfer(w,r.authorizationId,m.id,m.grossCents,{kind:'CAPTURE_GROSS',reference:id});transfer(w,m.id,'platform',m.feeCents,{kind:'PAYMENT_FEE',reference:id});transfer(w,m.id,'logistics',m.deliveryCents,{kind:'DELIVERY_EXPENSE',reference:id});}
  transfer(w,'platform','processor',q.processingCents,{kind:'PAYMENT_PROCESSING',reference:id});
  for(const item of q.items){const product=w.products.find(p=>p.id===item.productId);product.stock-=item.quantity;product.reserved-=item.quantity;}
  const person=w.people.find(p=>p.id===r.customerId),due=w.day+1+Math.floor(draw(w.seed,'deadline-customer-delivery',r.createdDay,person.index)*2),order={id,requestId,customerId:r.customerId,day:w.day,requestDay:r.createdDay,grossCents:q.grossCents,feeCents:q.feeCents,processingCents:q.processingCents,items:structuredClone(q.items),merchants:structuredClone(q.merchants),deliveryDueDay:due,status:'CAPTURED',refundStatus:null,refundCents:0,source:'SIMULATED_NOT_PAYPAL_RECEIPT'};
  w.privateOrderOutcomes[id]={willRefund:draw(w.seed,'deadline-return',r.createdDay,person.index)<RULES.returnProbability,refundDueDay:w.day+5+Math.floor(draw(w.seed,'deadline-return-delay',r.createdDay,person.index)*9)};
  w.orders.push(order);r.status='CAPTURED';r.captureId=id;r.allocatedItems=[];releaseAuthorization(w,r,'Unspent part of approved budget');w.events.push({day:w.day,type:'PAYMENT_CAPTURED',requestId,captureId:id,grossCents:q.grossCents});assertDeadlineIntegrity(w);return {captureId:id,requestId,grossCents:q.grossCents,source:order.source};
 });
}
function settleCustomerOrders(w){
 for(const liability of w.liabilities.filter(l=>l.status==='FEE_REBATE_DUE')){
  const order=w.orders.find(o=>o.id===liability.orderId);if(w.accounts.platform<order.feeCents)continue;
  for(const m of order.merchants)transfer(w,'platform',m.id,m.feeCents,{kind:'PAYMENT_FEE_RETURN',reference:order.id});
  order.feeReturnedCents=order.feeCents;liability.status='SETTLED';
 }
 for(const order of w.orders){const r=w.requests.find(r=>r.id===order.requestId),privateOutcome=w.privateOrderOutcomes[order.id];
  if(order.status==='CAPTURED'&&order.deliveryDueDay<=w.day){order.status='DELIVERED';r.status='FULFILLED';w.deliveries.push({id:'DELIVERY-'+order.id,orderId:order.id,requestId:r.id,day:w.day,onTime:w.day<=r.deadlineDay});w.events.push({day:w.day,type:'DELIVERED',requestId:r.id,captureId:order.id});}
  if(!privateOutcome.willRefund||privateOutcome.refundDueDay>w.day||order.refundStatus==='SETTLED')continue;
  const feeAvailable=w.accounts.platform>=order.feeCents;
  if(order.merchants.some(m=>w.accounts[m.id]+(feeAvailable?m.feeCents:0)<m.grossCents)){order.refundStatus='PENDING_FUNDS';if(!w.liabilities.some(l=>l.orderId===order.id&&l.status==='UNPAID_REFUND'))w.liabilities.push({orderId:order.id,amountCents:order.grossCents,status:'UNPAID_REFUND'});continue;}
  if(feeAvailable){for(const m of order.merchants)transfer(w,'platform',m.id,m.feeCents,{kind:'PAYMENT_FEE_RETURN',reference:order.id});order.feeReturnedCents=order.feeCents;}
  else w.liabilities.push({orderId:order.id,amountCents:order.feeCents,status:'FEE_REBATE_DUE'});
  for(const m of order.merchants)transfer(w,m.id,order.customerId,m.grossCents,{kind:'MERCHANT_REFUND',reference:order.id});
  order.refundStatus='SETTLED';order.refundCents=order.grossCents;r.status='REFUNDED';const liability=w.liabilities.find(l=>l.orderId===order.id&&l.status==='UNPAID_REFUND');if(liability)liability.status='SETTLED';w.events.push({day:w.day,type:'REFUNDED',requestId:r.id,captureId:order.id});
 }
}
export function assertDeadlineIntegrity(w){
 if(Object.values(w.accounts).some(c=>!Number.isSafeInteger(c)||c<0)||Object.values(w.accounts).reduce((s,c)=>s+c,0)!==w.initialCashCents+w.incomeCents)throw Error('DEADLINE_CASH_CONSERVATION_FAILED');
 if(w.products.some(p=>!Number.isInteger(p.stock)||!Number.isInteger(p.reserved)||p.stock<0||p.reserved<0||p.reserved>p.stock))throw Error('DEADLINE_STOCK_INTEGRITY_FAILED');
 for(const r of w.requests)if(['AUTHORIZED','RESERVED'].includes(r.status)&&w.accounts[r.authorizationId]!==r.authorizedCents)throw Error('AUTHORIZATION_FUNDS_MISMATCH');
 for(const product of w.products){const reserved=w.requests.filter(r=>r.status==='RESERVED').flatMap(r=>r.allocatedItems).filter(i=>i.productId===product.id).reduce((s,i)=>s+i.quantity,0),sold=w.orders.flatMap(o=>o.items).filter(i=>i.productId===product.id).reduce((s,i)=>s+i.quantity,0),received=w.procurements.filter(p=>p.productId===product.id&&p.status==='DELIVERED').reduce((s,p)=>s+p.quantity,0);if(reserved!==product.reserved||product.initialStock+received-sold!==product.stock)throw Error('DEADLINE_ITEM_CONSERVATION_FAILED');}
 const clearing=w.supplierInvoices.filter(i=>i.status==='PENDING').reduce((s,i)=>s+i.grossCents,0)+w.procurements.filter(p=>p.status==='RESERVED_FUNDS').reduce((s,p)=>s+p.costCents,0);if(clearing!==(w.accounts.procurement_clearing||0))throw Error('SUPPLIER_CLEARING_MISMATCH');
 return true;
}
