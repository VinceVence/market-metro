import {publicInterest} from './experts.mjs';
import {publicEvidence} from '../../behavior-v4/policies.mjs';
import {applyPlan,applyAssortment} from '../operations.mjs';
export const DEFAULT_COVERAGE=Object.freeze({novelty:3,interest:1,priceFit:1,value:.25,cadence:7});
export function compileCoveragePolicy(w,config){
 const weights=config.coverage||DEFAULT_COVERAGE;
 if(Object.keys(weights).sort().join()!==Object.keys(DEFAULT_COVERAGE).sort().join()||!['novelty','interest','priceFit','value'].every(k=>Number.isFinite(weights[k])&&weights[k]>=0&&weights[k]<=4)||![7,14].includes(weights.cadence))throw Error('INVALID_COVERAGE_WEIGHTS');
 const interests=publicInterest(w),byId=new Map(w.products.map(p=>[p.product_id,p])),seen=new Map(),blocked=new Set(publicEvidence(w).matureMerchantRisk.filter(m=>m.exclude).map(m=>m.merchantIndex));
 const record=(customerId,productId,day)=>{const p=byId.get(productId);if(!p)return;let row=seen.get(customerId);if(!row){row={};seen.set(customerId,row);}row[p.catalog_item_id]=Math.max(row[p.catalog_item_id]??-100,day);};
 for(const o of w.behavior.observations)if(o.day<w.tick)record(o.customer_id,o.product_id,o.day);
 for(const a of w.behavior.actions)if(a.day<w.tick)record(a.customer_id,a.product_id,a.day);
 return input=>{
  const u=input.customer;if(input.day-u.lastOffer<weights.cadence||w.commerce.mandates.some(m=>m.customerId===u.customerId&&m.status==='ACTIVE'))return null;
  const paid=u.history.filter(r=>r.purchased).map(r=>r.gross_cents).sort((a,b)=>a-b),prior=paid.length?paid[Math.floor((paid.length-1)*.75)]:6400,cats=interests.get(u.customerId)?.categories||{},maxInterest=Math.max(1,...Object.values(cats)),fresh=u.observedIntent&&input.day-u.observedIntent.day<=14?u.observedIntent.topic:null,known=seen.get(u.customerId)||{};
  const pool=new Map();for(const p of input.products.filter(p=>p.stock>0&&p.allowedPct.includes(0)&&!blocked.has(p.merchantIndex))){const existing=pool.get(p.catalogItemId);if(!existing||p.priceCents<existing.priceCents||p.priceCents===existing.priceCents&&p.merchantIndex===u.lastMerchantIndex)pool.set(p.catalogItemId,p);}
  let best=null;for(const p of pool.values()){
   const novelty=Math.min(45,input.day-(known[p.catalogItemId]??-100))/45,interest=fresh?(Number(p.category===fresh)+(cats[p.category]||0)/maxInterest)/2:(cats[p.category]||0)/maxInterest,fit=Math.exp(-Math.abs(Math.log(p.priceCents/Math.max(1,prior)))),value=Math.log1p(p.priceCents/1000)/Math.log(31),score=weights.novelty*novelty+weights.interest*interest+weights.priceFit*fit+weights.value*value;
   if(!best||score>best.score)best={p,score};
  }
  return best?{productId:best.p.productId,pct:0,kind:'recommendation',reason:'Public-history coverage score combines novelty, observed interest, prior paid prices and contribution. It predicts opportunity; it does not guarantee a purchase.'}:null;
 };
}
export function updateWorkingCapital(w,config){
 if(w.tick<30||w.tick>=w.behavior.days)return;
 if(config.riskPricing){const prices=[...config.business.economics.pricePct];for(const r of publicEvidence(w).matureMerchantRisk)if(r.exclude)prices[r.merchantIndex]=10;
  if(prices.join()!==w.commerce.plan.pricePct.join())applyPlan(w,{...w.commerce.plan,pricePct:prices},{evidenceDay:w.tick,actor:'OBSERVED_MARGIN_CONTROLLER'});
 }
 if(!config.trimDays||w.tick<w.behavior.days-config.trimDays||w.tick%7!==0)return;
 const ids=[...new Set(w.products.map(p=>p.catalog_item_id))],scores=ids.map(id=>{const products=w.products.filter(p=>p.catalog_item_id===id),productIds=new Set(products.map(p=>p.product_id)),recent=w.behavior.orders.filter(o=>productIds.has(o.productId)&&o.day>=w.tick-28&&o.day<w.tick).length,stock=products.reduce((s,p)=>s+w.inventory[p.product_id],0),pipeline=w.commerce.procurement.filter(o=>productIds.has(o.productId)&&!o.delivered).reduce((s,o)=>s+o.quantity,0);return {id,category:products[0].category,recent,reorder:stock+pipeline<Math.max(1,Math.ceil(recent/28*Math.min(7,w.behavior.days-w.tick)))};});
 const selected=scores.filter(s=>s.reorder).map(s=>s.id);
 for(const category of new Set(scores.map(s=>s.category)))if(!scores.some(s=>s.category===category&&selected.includes(s.id)))selected.push(scores.filter(s=>s.category===category).sort((a,b)=>b.recent-a.recent)[0].id);
 if(JSON.stringify([...selected].sort())!==JSON.stringify([...(w.commerce.assortment||[])].sort()))applyAssortment(w,selected,{evidenceDay:w.tick});
}
