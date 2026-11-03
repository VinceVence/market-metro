// Frozen quote-extension evaluator, derived from the v5 controller harness.
import {buildPriceBook,publishPriceBook} from './quotes.mjs';
import {createWorld,stepWorld,outcome,assertIntegrity} from './engine.mjs';
import {applyPlan,applyAssortment,assertCommerceIntegrity} from './operations.mjs';
import {applyNetworkPlan} from '../commerce-economy-v5/network.mjs';
import {compileCommercePolicy} from '../commerce-economy-v5/policies.mjs';
import {validateComponent,SETTINGS} from '../commerce-economy-v5/runner.mjs';
import {authoredCatalog} from '../behavior-v4/catalog.mjs';
import {hash,mean} from '../commerce-design-v2/evaluate.mjs';
import {compileActionPolicy} from '../commerce-economy-v5/learning/action-policy.mjs';
import {actions} from '../commerce-economy-v5/learning/actions.mjs';
import {compileDiscoveryPolicy} from '../commerce-economy-v5/learning/discovery-policy.mjs';

const warmups=new Map();
export function fixedHeuristic(w,lifecycle,kind){
 const base=compileCommercePolicy(w,lifecycle);
 return input=>{
  const old=base(input);
  if(kind==='fixed'||w.commerce.mandates.some(m=>m.customerId===input.customer.customerId&&m.status==='ACTIVE'))return old;
  if(!input.customer.purchases||input.day-input.customer.lastPurchase<14)return old;
  const options=actions(w,input,old);
  return (kind==='winback'?options.find(o=>o.action?.kind==='subscription_offer'&&o.action.intervalDays===7):options.find(o=>o.action?.pct===5))?.action||old;
 };
}
export function simulateController(c,config,artifact,{trace=false,policyFactory,customerOutcomes=false,settings=SETTINGS,onDay}={}){
 for(const role of ['demand','economics','lifecycle'])validateComponent(role,config.business[role]);
 const key=hash({c,settings});
 if(!warmups.has(key)){
  const w=createWorld({...settings,...c,runId:'JOINT-EVAL-'+c.seed,catalog:authoredCatalog()});
  while(w.tick<30)stepWorld(w);
  warmups.set(key,w);
 }
 const w=structuredClone(warmups.get(key)),initialHash=hash(w),b=config.business,start=performance.now(),decisions=[];
 let overrides=0,recommendationPurchases=0;
 applyPlan(w,{pricePct:b.economics.pricePct,stockDays:b.demand.stockDays,useLostDemand:b.demand.useLostDemand},{evidenceDay:30});
 applyNetworkPlan(w,{merchantRail:b.economics.merchantRail,supplierRail:b.economics.supplierRail});
 w.commerce.forecastWindowDays=b.demand.windowDays;
 const cat=authoredCatalog();
 applyAssortment(w,[...new Set(cat.map(p=>p.category))].flatMap(category=>cat.filter(p=>p.category===category).sort((a,b)=>b.priceCents-a.priceCents).slice(0,b.demand.topK).map(p=>p.id)),{evidenceDay:30});
 if(config.quotePlan)publishPriceBook(w,buildPriceBook(w,config.quotePlan),{evidenceDay:30});
 while(w.tick<w.totalTicks){
  onDay?.(w,config);
  if(config.cashSchedule&&w.tick===config.cashSchedule.day){
   applyPlan(w,{pricePct:b.economics.pricePct,stockDays:config.cashSchedule.stockDays,useLostDemand:b.demand.useLostDemand},{evidenceDay:w.tick,actor:'LIQUIDITY_CONTROLLER'});
  }
  let policy;
  const batch=stepWorld(w,input=>{
   if(w.tick>=settings.campaignStop)return null;
   policy??=policyFactory?policyFactory(w,config):config.kind==='discovery'?compileDiscoveryPolicy(w,artifact,config):config.kind==='learned'?compileActionPolicy(w,artifact,{modelName:config.modelName,lifecycle:b.lifecycle,thresholdCents:config.thresholdCents,merchantFloorCents:0,onDecision:d=>{if(d.changed)overrides++;if(trace)decisions.push(d);}}):fixedHeuristic(w,b.lifecycle,config.kind);
   return policy(input);
  });
  recommendationPurchases+=batch.rows.orders.filter(o=>o.channel==='behavior_recommendation').length;
 }
 assertIntegrity(w);assertCommerceIntegrity(w);
 const o=outcome(w);
 const customers=customerOutcomes?w.customers.map(u=>{const orders=w.behavior.orders.filter(x=>x.customerId===u.customer_id&&x.day>=30&&x.day<settings.days),contacts=w.behavior.actions.filter(x=>x.customer_id===u.customer_id&&x.day>=30&&x.day<settings.days);return {id:u.customer_id,index:u.index,platformCents:orders.reduce((s,x)=>s+(x.refund?0:x.fee)-x.processing,0)-contacts.reduce((s,x)=>s+x.outreach_cents+x.platform_support_cents,0),retailerCents:orders.reduce((s,x)=>s+x.gross-x.refund-(x.refund?0:x.fee)-x.cost-x.delivery+x.support,0),purchases:orders.length,retainedCents:orders.reduce((s,x)=>s+x.gross-x.refund,0),uniqueContactItems:new Set(contacts.filter(x=>x.product_id).map(x=>w.products.find(p=>p.product_id===x.product_id).catalog_item_id)).size};}):undefined;
 return {...c,...o,initialHash,platformUSD:o.platformCents/100,allPartnerUSD:(o.merchantCents+o.commerce.network.partnerContributionCents)/100,retailerUSD:o.merchantCents/100,terminalCashUSD:(w.commerce.cashCents.reduce((s,x)=>s+x,0)+w.commerce.network.accounts.wholesaler+w.commerce.network.accounts.manufacturer)/100,terminalInventoryUSD:w.products.reduce((s,p)=>s+w.inventory[p.product_id]*p.cost_cents,0)/100,recommendationPurchases,overrides,runtimeMs:Math.round(performance.now()-start),integrity:true,...(trace?{decisions}:{}),...(customerOutcomes?{customerOutcomes:customers}:{})};
}
export const METRICS=['platformUSD','allPartnerUSD','retailerUSD','terminalCashUSD','terminalInventoryUSD','purchases','recommendationPurchases','overrides'];
export function assess(cases,config,artifact){
 const rows=cases.map(c=>simulateController(c,config,artifact));
 return {id:config.id,config,rows,mean:Object.fromEntries(METRICS.map(k=>[k,mean(rows.map(r=>r[k]))]))};
}
export const violation=(a,b)=>Math.max(0,b.allPartnerUSD-a.allPartnerUSD)+Math.max(0,b.retailerUSD-a.retailerUSD)+Math.max(0,b.terminalCashUSD-a.terminalCashUSD)+Math.max(0,a.terminalInventoryUSD-b.terminalInventoryUSD*1.1);
