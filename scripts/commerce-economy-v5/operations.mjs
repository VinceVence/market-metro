import {initializeNetwork,advanceNetwork,routeProcurement,networkOutcome,assertNetworkIntegrity} from './network.mjs';
import {draw} from '../marketing/economy.mjs';
export const BUSINESS=Object.freeze({version:'commerce-operations-v5.2',openingStock:6,openingMerchantCashCents:150000,leadDays:3,holdingRatePerDay:.0002,consentBase:.12,consentRepeatBonus:.20,subscriptionNeedThreshold:.65,subscriptionCategories:['Stationery','Office bundles'],priceChangesPct:[-10,-5,0,5,10],stockDayOptions:[7,14,28],intervalDayOptions:[7,14,28]});
export const defaultPlan=()=>({pricePct:[0,0,0],stockDays:[14,14,14],useLostDemand:false});
export function validatePlan(p){if(!p||Object.keys(p).sort().join()!=='pricePct,stockDays,useLostDemand'||![p.pricePct,p.stockDays].every(a=>Array.isArray(a)&&a.length===3)||p.pricePct.some(n=>!BUSINESS.priceChangesPct.includes(n))||p.stockDays.some(n=>!BUSINESS.stockDayOptions.includes(n))||typeof p.useLostDemand!=='boolean')throw Error('INVALID_COMMERCE_PLAN');return structuredClone(p);}
export function initializeCommerce(w){
 w.commerce={version:BUSINESS.version,network:initializeNetwork(),plan:defaultPlan(),cashCents:w.merchants.map(()=>BUSINESS.openingMerchantCashCents),cashStartCents:BUSINESS.openingMerchantCashCents*w.merchants.length,basePrices:{},procurement:[],mandates:[],events:[],daily:[],recordedOrders:{},recordedRefunds:{},carryCents:0,historyCarryCents:0,initialInventoryValueCents:0,modelActorsHavePrivateAccess:false};
 for(const p of w.products){w.commerce.basePrices[p.product_id]=p.price_cents;w.inventory[p.product_id]=BUSINESS.openingStock;p.initial_stock=BUSINESS.openingStock;w.commerce.initialInventoryValueCents+=p.cost_cents*BUSINESS.openingStock;}
 w.merchants.forEach(m=>{m.stock=w.products.filter(p=>p.merchant_id===m.merchant_id).length*BUSINESS.openingStock;});
}
const log=(w,type,detail)=>w.commerce.events.push({id:w.runId+'-COM-'+w.commerce.events.length,day:w.tick,type,...detail,source:'SIMULATED_COMMERCE_V5'});
export function applyPlan(w,raw,{evidenceDay,actor='LOCAL_POLICY'}={}){const plan=validatePlan(raw);if(!Number.isInteger(evidenceDay)||evidenceDay>w.tick)throw Error('FUTURE_OR_MISSING_EVIDENCE');w.commerce.plan=plan;log(w,'PLAN_PUBLISHED',{plan,evidenceDay,actor});}
export function applyAssortment(w,catalogIds,{evidenceDay}={}){
 const known=new Set(w.products.map(p=>p.catalog_item_id));if(!Array.isArray(catalogIds)||!catalogIds.length||new Set(catalogIds).size!==catalogIds.length||catalogIds.some(id=>!known.has(id))||!Number.isInteger(evidenceDay)||evidenceDay>w.tick)throw Error('INVALID_REPLENISHMENT_ASSORTMENT');
 for(const category of new Set(w.products.map(p=>p.category)))if(!w.products.some(p=>p.category===category&&catalogIds.includes(p.catalog_item_id)))throw Error('ASSORTMENT_CATEGORY_COVERAGE');
 w.commerce.assortment=[...catalogIds];log(w,'REPLENISHMENT_ASSORTMENT_PUBLISHED',{catalogIds,evidenceDay,meaning:'Stop future reorders for other SKUs. Existing stock is still offered; no goods or cash are erased.'});
}
export function beginCommerceDay(w){
 const c=w.commerce,day=w.tick;advanceNetwork(w);const newOrders=[];
 for(const p of w.products){const merchant=w.merchants.findIndex(m=>m.merchant_id===p.merchant_id);p.price_cents=Math.round(c.basePrices[p.product_id]*(1+c.plan.pricePct[merchant]/100));}
 for(const order of c.procurement)if(!order.delivered&&order.dueDay!==null&&order.dueDay<=day){w.inventory[order.productId]+=order.quantity;order.delivered=true;log(w,'PROCUREMENT_DELIVERED',{procurementId:order.id,productId:order.productId,quantity:order.quantity});}
 if(day>=w.behavior.days)return;
 for(const p of w.products){
  if(c.assortment&&!c.assortment.includes(p.catalog_item_id))continue;
  const window=c.forecastWindowDays||14;if(![7,14,28].includes(window))throw Error('INVALID_FORECAST_WINDOW');
  const merchant=w.merchants.findIndex(m=>m.merchant_id===p.merchant_id),recent=w.behavior.orders.filter(o=>o.productId===p.product_id&&o.day>=day-window&&o.day<day).length,views=w.behavior.observations.filter(o=>o.product_id===p.product_id&&o.day>=day-window&&o.day<day&&o.visited).length;
  const quotedLead=BUSINESS.leadDays+(c.network.plan.merchantRail==='paypal'?0:2)+(c.network.plan.supplierRail==='paypal'?0:2)+(w.scenario==='supply_delay'&&day>=35&&day<49?10:0);
  if(day+quotedLead>=w.behavior.days)continue;
  const rate=Math.max(1/14,recent/window,c.plan.useLostDemand?views*.2/window:0),target=Math.max(1,Math.ceil(rate*Math.min(c.plan.stockDays[merchant]+quotedLead,w.behavior.days-day))),pipeline=c.procurement.filter(o=>o.productId===p.product_id&&!o.delivered).reduce((s,o)=>s+o.quantity,0),wanted=Math.max(0,target-w.inventory[p.product_id]-pipeline),quantity=Math.min(wanted,Math.max(0,Math.floor(c.cashCents[merchant]/p.cost_cents)));
  if(!quantity)continue;const retailMargin=Math.max(0,p.price_cents-Math.round(p.price_cents*.0349)-49-p.cost_cents-350),avoidedStockoutCents=Math.round(Math.max(0,rate*7-w.inventory[p.product_id]-pipeline)*retailMargin);const cost=quantity*p.cost_cents;c.cashCents[merchant]-=cost;const order={id:w.runId+'-PO-'+c.procurement.length,merchant,productId:p.product_id,quantity,costCents:cost,avoidedStockoutCents,orderedDay:day,dueDay:day+BUSINESS.leadDays+(w.scenario==='supply_delay'&&day>=35&&day<49?10:0),delivered:false};c.procurement.push(order);newOrders.push(order);log(w,'PROCUREMENT_ORDERED',order);
 }
 routeProcurement(w,newOrders);
}
export function considerConsent(w,u,p,offer,read){
 if(!BUSINESS.intervalDayOptions.includes(offer.intervalDays)||!BUSINESS.subscriptionCategories.includes(p.category)||![0,5].includes(offer.pct)||!read||w.tick<30)return;
 if(w.commerce.mandates.some(m=>m.customerId===u.customer_id&&m.status==='ACTIVE'))return;
 const repeat=w.behavior.orders.filter(o=>o.customerId===u.customer_id&&w.products.find(p=>p.product_id===o.productId)?.category===p.category).length;
 const threshold=Math.min(.65,BUSINESS.consentBase+(repeat>=2?BUSINESS.consentRepeatBonus:0)+offer.pct*.02),accepted=draw(w.seed,'v5-subscription-consent',w.tick,u.index,p.catalog_item_id,offer.intervalDays)<threshold;
 log(w,accepted?'SUBSCRIPTION_CONSENTED':'SUBSCRIPTION_DECLINED',{customerId:u.customer_id,productId:p.product_id,intervalDays:offer.intervalDays});if(!accepted)return;
 const mandate={id:w.runId+'-MANDATE-'+w.commerce.mandates.length,customerId:u.customer_id,productId:p.product_id,intervalDays:offer.intervalDays,pct:offer.pct,maxPaidCents:Math.round(p.price_cents*(1-offer.pct/100)),consentedDay:w.tick,nextDay:w.tick+offer.intervalDays,status:'ACTIVE',paidCount:0};w.commerce.mandates.push(mandate);
}
export function recurringAction(w,u){
 const mandate=w.commerce.mandates.find(m=>m.customerId===u.customer_id&&m.status==='ACTIVE');if(!mandate||mandate.nextDay>w.tick)return null;
 const p=w.products.find(p=>p.product_id===mandate.productId),paid=p.price_cents-Math.round(p.price_cents*mandate.pct/100),t=w.behavior.private[u.index];mandate.nextDay=w.tick+mandate.intervalDays;
 const netMargin=(paid-Math.round(paid*.0349)-49-p.cost_cents-350)/paid;
 const reason=netMargin<.2?'MARGIN_FLOOR':paid>mandate.maxPaidCents?'PRICE_EXCEEDS_CONSENT':w.inventory[p.product_id]<=0?'OUT_OF_STOCK':u.wallet<paid?'UNAFFORDABLE':t.need<BUSINESS.subscriptionNeedThreshold?'NO_CURRENT_NEED':null;
 if(reason){log(w,'SUBSCRIPTION_SKIPPED',{mandateId:mandate.id,customerId:u.customer_id,reason});return null;}
 // Private need is a simulator consumer safeguard, never exposed to a policy.
 return {productId:p.product_id,pct:mandate.pct,kind:'subscription',mandateId:mandate.id,reason:'Customer-consented replenishment; current need, stock, wallet and price cap checked.'};
}
export function finishCommerceDay(w){
 const c=w.commerce;
 for(const o of w.behavior.orders){if(!c.recordedOrders[o.id]){c.cashCents[o.merchantIndex]+=o.gross-o.fee-o.delivery+o.support;c.recordedOrders[o.id]=true;if(o.subscription){const m=c.mandates.find(m=>m.id===o.mandateId);if(!m)throw Error('UNCONSENTED_RECURRING_ORDER');m.paidCount++;log(w,'SUBSCRIPTION_PAID',{mandateId:m.id,orderId:o.id,grossCents:o.gross});}}
  if(o.refund&&!c.recordedRefunds[o.id]){c.cashCents[o.merchantIndex]-=o.refund-o.fee;c.recordedRefunds[o.id]=true;if(o.subscription){const m=c.mandates.find(m=>m.id===o.mandateId);m.status='CANCELLED';log(w,'SUBSCRIPTION_CANCELLED',{mandateId:m.id,reason:'Customer cancels after a refunded replenishment'});}}
 }
 let carry=0;for(let i=0;i<3;i++){const amount=Math.round(w.products.filter(p=>p.merchant_id===w.merchants[i].merchant_id).reduce((s,p)=>s+w.inventory[p.product_id]*p.cost_cents,0)*BUSINESS.holdingRatePerDay);c.cashCents[i]-=amount;carry+=amount;}
 c.carryCents+=carry;if(w.tick<30)c.historyCarryCents+=carry;c.daily.push({day:w.tick,carryCents:carry,cashCents:[...c.cashCents]});assertCommerceIntegrity(w);
}
export function assertCommerceIntegrity(w){
 const c=w.commerce,inventory=w.products.reduce((s,p)=>s+w.inventory[p.product_id]*p.cost_cents,0),pipeline=c.procurement.filter(p=>!p.delivered).reduce((s,p)=>s+p.costCents,0),profit=w.behavior.orders.reduce((s,o)=>s+o.gross-o.refund-(o.refund?0:o.fee)-o.cost-o.delivery+o.support,0)-c.carryCents;
 if(c.cashCents.some(n=>!Number.isSafeInteger(n))||c.cashCents.reduce((s,n)=>s+n,0)+inventory+pipeline!==c.cashStartCents+c.initialInventoryValueCents+profit)throw Error('MERCHANT_CASH_INVENTORY_CONSERVATION_FAILED');
 assertNetworkIntegrity(w);return true;
}
export function commerceOutcome(w,endDay){const c=w.commerce;return {version:c.version,network:networkOutcome(w,endDay),carryCents:c.daily.filter(d=>d.day>=30&&d.day<(endDay===w.behavior.days?endDay+14:endDay)).reduce((s,d)=>s+d.carryCents,0),insolvencyCents:c.cashCents.reduce((s,n)=>s+Math.max(0,-n),0),subscriptionOffers:c.events.filter(e=>['SUBSCRIPTION_CONSENTED','SUBSCRIPTION_DECLINED'].includes(e.type)&&e.day>=30&&e.day<endDay).length,subscriptionConsents:c.mandates.filter(m=>m.consentedDay>=30&&m.consentedDay<endDay).length,subscriptionPurchases:w.behavior.orders.filter(o=>o.subscription&&o.day>=30&&o.day<endDay).length,procurementOrders:c.procurement.filter(o=>o.orderedDay>=30&&o.orderedDay<endDay).length,merchantCashCents:[...c.cashCents]};}
