import {publicEvidence} from '../../behavior-v4/policies.mjs';
import {compileDiscoveryPolicy} from './discovery-policy.mjs';
export const EXPERTS=['incumbent','no_outreach','catalog_rotation','intent_affordable','intent_premium','premium_rotation','adjacent_bundle','intent_trigger','replenishment'];
// Build the evidence index once per completed day. Campaign-exposed views are
// separated from organic views so repeated advertising does not become taste.
export function publicInterest(w){
 const offered=new Map(w.behavior.actions.filter(a=>a.day<w.tick&&a.product_id).map(a=>[a.customer_id+'|'+a.day,a.product_id])),byId=new Map(w.products.map(p=>[p.product_id,p])),rows=new Map();
 for(const o of w.behavior.observations){if(o.day>=w.tick||o.day<w.tick-28)continue;const p=byId.get(o.product_id);if(!p)continue;let r=rows.get(o.customer_id);if(!r){r={categories:{},seen:{}};rows.set(o.customer_id,r);}const organic=o.visited&&offered.get(o.customer_id+'|'+o.day)!==o.product_id;const weight=(o.purchased?2:0)+(organic?1:0)+(o.visited?.1:0);r.categories[p.category]=(r.categories[p.category]||0)+weight;r.seen[p.catalog_item_id]=(r.seen[p.catalog_item_id]||0)+1;}
 return rows;
}
export function compileExpert(w,artifact,config,expert){
 if(!EXPERTS.includes(expert))throw Error('UNKNOWN_CAMPAIGN_EXPERT');
 const base=compileDiscoveryPolicy(w,artifact,config),interests=publicInterest(w),blocked=new Set(publicEvidence(w).matureMerchantRisk.filter(m=>m.exclude).map(m=>m.merchantIndex)),contacted=new Map();
 for(const a of w.behavior.actions){if(a.day>=w.tick||!a.product_id)continue;const id=w.products.find(p=>p.product_id===a.product_id)?.catalog_item_id;if(!contacted.has(a.customer_id))contacted.set(a.customer_id,{});contacted.get(a.customer_id)[id]=a.day;}
 return input=>{
  if(expert==='incumbent')return base(input);
  if(expert==='no_outreach')return null;
  const u=input.customer;if(w.commerce.mandates.some(m=>m.customerId===u.customerId&&m.status==='ACTIVE'))return null;
  const fresh=u.observedIntent&&input.day-u.observedIntent.day<=14?u.observedIntent.topic:null,interest=interests.get(u.customerId),topic=fresh||Object.entries(interest?.categories||{}).sort((a,b)=>b[1]-a[1])[0]?.[0];
  if(expert==='intent_trigger'&&(!fresh||input.day-u.observedIntent.day>3))return null;
  let pool=input.products.filter(p=>p.stock>0&&p.allowedPct.includes(0)&&!blocked.has(p.merchantIndex));
  if(['intent_affordable','intent_premium','intent_trigger','replenishment'].includes(expert)){if(!topic)return null;pool=pool.filter(p=>p.category===topic);}
  if(expert==='adjacent_bundle')pool=pool.filter(p=>p.category==='Office bundles');
  const prices=u.history.filter(h=>h.purchased).map(h=>h.gross_cents).sort((a,b)=>a-b),prior=prices.length?prices[Math.floor((prices.length-1)*.75)]:null;
  if(expert==='intent_affordable'&&prior)pool=pool.filter(p=>p.priceCents<=prior*1.5);
  const byCatalog=new Map();for(const p of pool){const old=byCatalog.get(p.catalogItemId);if(!old||p.priceCents<old.priceCents||p.priceCents===old.priceCents&&p.merchantIndex===u.lastMerchantIndex)byCatalog.set(p.catalogItemId,p);}
  pool=[...byCatalog.values()];const times=contacted.get(u.customerId)||{};
  if(expert==='catalog_rotation')pool.sort((a,b)=>(times[a.catalogItemId]??-100)-(times[b.catalogItemId]??-100)||a.catalogItemId.localeCompare(b.catalogItemId));
  else pool.sort((a,b)=>Number((times[a.catalogItemId]??-100)>input.day-35)-Number((times[b.catalogItemId]??-100)>input.day-35)||(expert==='intent_affordable'?Math.abs(a.priceCents-(prior||6400))-Math.abs(b.priceCents-(prior||6400)):b.priceCents-a.priceCents)||a.catalogItemId.localeCompare(b.catalogItemId));
  const p=pool[0];if(!p)return null;
  if(expert==='replenishment'&&['Stationery','Office bundles'].includes(p.category))return {productId:p.productId,pct:0,kind:'subscription_offer',intervalDays:7,reason:'Observed category interest; optional replenishment invitation, pending customer consent.'};
  return {productId:p.productId,pct:0,kind:'recommendation',reason:'Observed-only '+expert+' campaign; no guaranteed purchase.'};
 };
}
