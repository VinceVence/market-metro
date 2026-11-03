// Expand campaign choice using existing legal actions, not new response rules.
// A first replenishment invitation requires observed interest; consent, price,
// affordability, stock and current need remain enforced by the simulator.
import {publicEvidence} from '../../behavior-v4/policies.mjs';
import {compileActionPolicy} from './action-policy.mjs';
export function compileDiscoveryPolicy(w,artifact,config){
 const base=compileActionPolicy(w,artifact,{modelName:config.modelName||'ridge',lifecycle:config.business.lifecycle,thresholdCents:config.thresholdCents||0});
 const excluded=new Set(publicEvidence(w).matureMerchantRisk.filter(m=>m.exclude).map(m=>m.merchantIndex));
 return input=>{
  const old=base(input),u=input.customer;
  if(w.commerce.mandates.some(m=>m.customerId===u.customerId&&m.status==='ACTIVE'))return old;
  const fresh=u.observedIntent&&input.day-u.observedIntent.day<=7?u.observedIntent.topic:null;
  const topic=fresh||Object.entries(u.seenCategories).filter(([,count])=>count>=2).sort((a,b)=>b[1]-a[1])[0]?.[0];
  if(!topic||!['Stationery','Office bundles'].includes(topic))return old;
  // Do not repeatedly invite buyers whose last subscription invitation was
  // declined recently. This is observed campaign history, not latent consent.
  const declined=w.commerce.events.filter(e=>e.type==='SUBSCRIPTION_DECLINED'&&e.customerId===u.customerId).at(-1);
  if(declined&&input.day-declined.day<(config.declineGap||14))return old;
  const paid=u.history.filter(h=>h.purchased).map(h=>h.gross_cents).sort((a,b)=>a-b),prior=paid.length?paid[Math.floor((paid.length-1)*.75)]:null;
  let pool=input.products.filter(p=>p.category===topic&&p.stock>0&&p.allowedPct.includes(0)&&!excluded.has(p.merchantIndex));
  if(config.discovery==='observed_price')pool=pool.filter(p=>!prior||p.priceCents<=prior*1.1);
  if(config.discovery==='observed_value')pool=pool.filter(p=>!prior||p.priceCents<=prior*2);
  const byCatalog=new Map();for(const p of pool){const last=byCatalog.get(p.catalogItemId);if(!last||p.priceCents<last.priceCents)byCatalog.set(p.catalogItemId,p);}
  pool=[...byCatalog.values()].sort((a,b)=>b.priceCents-a.priceCents);
  const p=pool[0];if(!p)return old;
  return {productId:p.productId,pct:0,kind:'subscription_offer',intervalDays:config.intervalDays||7,reason:'Optional replenishment for an observed category interest. Customer may decline; no charge without consent. Existing need, affordability and margin checks still apply.'};
 };
}
