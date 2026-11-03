import {compilePolicy,publicEvidence} from '../behavior-v4/policies.mjs';
import {rankProducts} from '../marketing/recommender.mjs';
import {BUSINESS,defaultPlan} from './operations.mjs';
export const BASELINES=['campaign_only','fixed_extended'];
export function fixedPlan(){return defaultPlan();}
export function compileCommercePolicy(w,{marketing='weekly_featured',subscriptions=true,interval='observed',discountPct=0,minimumRepeat=2}={}){
 if(!['weekly_featured','personalized','portfolio'].includes(marketing)||![false,true].includes(subscriptions)||!['observed',7,14,28].includes(interval)||![0,5].includes(discountPct)||![1,2,3].includes(minimumRepeat))throw Error('INVALID_COMMERCE_POLICY');
 const fallback=compilePolicy(w,marketing),byId=new Map(w.products.map(p=>[p.product_id,p])),blocked=new Set(publicEvidence(w).matureMerchantRisk.filter(m=>m.exclude).map(m=>m.merchantIndex)),history=new Map();
 for(const o of w.behavior.orders.filter(o=>o.day<w.tick&&!o.refund)){const p=byId.get(o.productId);if(!BUSINESS.subscriptionCategories.includes(p.category))continue;const key=o.customerId+'|'+p.category;if(!history.has(key))history.set(key,[]);history.get(key).push(o);}
 return input=>{
  if(!subscriptions)return fallback(input);
  if(w.commerce.mandates.some(m=>m.customerId===input.customer.customerId&&m.status==='ACTIVE'))return null;
  const cohorts=BUSINESS.subscriptionCategories.map(category=>history.get(input.customer.customerId+'|'+category)||[]).filter(xs=>xs.length>=minimumRepeat).sort((a,b)=>b.at(-1).day-a.at(-1).day);
  const purchases=cohorts[0];if(!purchases)return fallback(input);
  const recent=purchases.at(-1),p=input.products.find(p=>p.productId===recent.productId&&p.stock>0&&p.allowedPct.includes(discountPct)&&!blocked.has(p.merchantIndex));if(!p)return fallback(input);
  const gaps=purchases.slice(1).map((o,i)=>o.day-purchases[i].day).filter(n=>n>0).sort((a,b)=>a-b),median=gaps.length?gaps[Math.floor(gaps.length/2)]:28,intervalDays=interval==='observed'?[7,14,28].sort((a,b)=>Math.abs(a-median)-Math.abs(b-median))[0]:interval;
  return {kind:'subscription_offer',productId:p.productId,pct:discountPct,intervalDays,reason:'Observed repeat purchases; optional replenishment with a fixed price cap and customer consent.'};
 };
}
export function observedCommerce(w){
 const b=w.behavior,cutoff=w.tick;return {asOfDay:cutoff,public:publicEvidence(w),merchantCashCents:[...w.commerce.cashCents],inventory:w.products.map(p=>({id:p.product_id,catalogItemId:p.catalog_item_id,merchantId:p.merchant_id,priceCents:p.price_cents,costCents:p.cost_cents,stock:w.inventory[p.product_id]})),pastProcurement:w.commerce.procurement.filter(p=>p.orderedDay<cutoff),consents:w.commerce.mandates.filter(m=>m.consentedDay<cutoff).map(m=>({...m})),pastBusinessEvents:w.commerce.events.filter(e=>e.day<cutoff).slice(-60),paidOrders:b.orders.filter(o=>o.day<cutoff).map(o=>({day:o.day,customerId:o.customerId,productId:o.productId,gross:o.gross,refund:o.refund,subscription:o.subscription})),scope:'Observed orders, inventory, merchant-authorized costs/cash, consents and operations only. No private needs, tastes, wallet balances or future draws.'};
}
