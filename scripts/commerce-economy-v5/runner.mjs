import {createWorld,stepWorld,outcome,assertIntegrity} from './engine.mjs';
import {applyPlan,applyAssortment,defaultPlan,assertCommerceIntegrity} from './operations.mjs';
import {applyNetworkPlan,defaultNetworkPlan} from './network.mjs';
import {compileCommercePolicy} from './policies.mjs';
import {train,publicEvidence} from '../behavior-v4/policies.mjs';
import {authoredCatalog} from '../behavior-v4/catalog.mjs';
import {hash,mean} from '../commerce-design-v2/evaluate.mjs';
export const CASES=['steady','rival_sale','budget_squeeze','returns_wave','preference_shift','supply_delay'].map((scenario,i)=>({scenario,seed:550100+i}));
export const VALIDATION=CASES.map((c,i)=>({...c,seed:550200+i}));
export const SETTINGS={customers:100,days:100,campaignStop:90,budgetCents:5000};
export const incumbent=()=>({demand:{stockDays:[14,14,14],windowDays:14,useLostDemand:false,topK:4,retrainDays:14},economics:{pricePct:[0,0,0],merchantRail:'auto',supplierRail:'auto'},lifecycle:{marketing:'weekly_featured',subscriptions:true,interval:'observed',minimumRepeat:2,discountPct:0}});
const cache=new Map(),warmups=new Map();
export function validateComponent(role,p){
 const expected=Object.keys(incumbent()[role]).sort().join();if(!p||Object.keys(p).sort().join()!==expected)throw Error('INVALID_COMPONENT_FIELDS');
 if(role==='demand'&&(!Array.isArray(p.stockDays)||p.stockDays.length!==3||p.stockDays.some(n=>![7,14,28].includes(n))||![7,14,28].includes(p.windowDays)||typeof p.useLostDemand!=='boolean'||![1,2,3,4].includes(p.topK)||![7,14,28].includes(p.retrainDays)))throw Error('INVALID_DEMAND_COMPONENT');
 if(role==='economics'&&(!Array.isArray(p.pricePct)||p.pricePct.length!==3||p.pricePct.some(n=>![-10,-5,0,5,10].includes(n))||![p.merchantRail,p.supplierRail].every(s=>['bank','paypal','auto'].includes(s))))throw Error('INVALID_ECONOMICS_COMPONENT');
 if(role==='lifecycle'&&(!['weekly_featured','personalized','portfolio'].includes(p.marketing)||typeof p.subscriptions!=='boolean'||!['observed','7','14','28',7,14,28].includes(p.interval)||![1,2,3].includes(p.minimumRepeat)||![0,5].includes(p.discountPct)))throw Error('INVALID_LIFECYCLE_COMPONENT');
 return structuredClone(p);
}
function warm(c){const key=hash(c);if(!warmups.has(key)){const w=createWorld({...SETTINGS,...c,runId:'ECONOMY5-'+c.seed,catalog:authoredCatalog()});while(w.tick<30)stepWorld(w);warmups.set(key,w);}return structuredClone(warmups.get(key));}
export function summarizeEvidence(c){const w=warm(c);train(w);const e=publicEvidence(w);return {scenario:c.scenario,day:30,evidence:e,merchantCashCents:w.commerce.cashCents,products:authoredCatalog().map(p=>({id:p.id,category:p.category,priceCents:p.priceCents})),business:{consents:w.commerce.mandates.length,procurements:w.commerce.procurement.length,networkPayments:w.commerce.network.invoices.filter(i=>i.status==='PAID').length},scope:'Completed observed history. The scenario name describes the known development test regime, not a hidden evaluation seed. No private tastes, needs, wallets or future draws.'};}
export function simulate(c,config){const key=hash({c,config});if(cache.has(key))return cache.get(key);for(const role of ['demand','economics','lifecycle'])validateComponent(role,config[role]);
 const w=warm(c),initialHash=hash(w),started=performance.now(),d=config.demand,e=config.economics,l=config.lifecycle;
 applyPlan(w,{pricePct:e.pricePct,stockDays:d.stockDays,useLostDemand:d.useLostDemand},{evidenceDay:30});applyNetworkPlan(w,{merchantRail:e.merchantRail,supplierRail:e.supplierRail});w.commerce.forecastWindowDays=d.windowDays;
 const catalog=authoredCatalog(),ids=[...new Set(catalog.map(p=>p.category))].flatMap(category=>catalog.filter(p=>p.category===category).sort((a,b)=>b.priceCents-a.priceCents).slice(0,d.topK).map(p=>p.id));applyAssortment(w,ids,{evidenceDay:30});
 let recommendationsBought=0;
 while(w.tick<w.totalTicks){if(w.tick<90&&(w.tick-30)%d.retrainDays===0)train(w);const batch=stepWorld(w,w.tick<90?compileCommercePolicy(w,{...l,interval:l.interval==='observed'?'observed':Number(l.interval)}):()=>null);recommendationsBought+=batch.rows.orders.filter(o=>o.channel==='behavior_recommendation').length;}
 assertIntegrity(w);assertCommerceIntegrity(w);const o=outcome(w),result={...o,platformUSD:o.platformCents/100,allPartnerUSD:(o.merchantCents+o.commerce.network.partnerContributionCents)/100,retailerUSD:o.merchantCents/100,terminalCashUSD:(w.commerce.cashCents.reduce((s,x)=>s+x,0)+w.commerce.network.accounts.wholesaler+w.commerce.network.accounts.manufacturer)/100,terminalInventoryUSD:w.products.reduce((s,p)=>s+w.inventory[p.product_id]*p.cost_cents,0)/100,recommendationsBought,modelFits:w.behavior.models.length,initialHash,integrity:true,runtimeMs:Math.round(performance.now()-started)};cache.set(key,result);return result;
}
export function evaluate(cases,config){const rows=cases.map(c=>({...c,...simulate(c,config)}));return {rows,mean:Object.fromEntries(['platformUSD','allPartnerUSD','retailerUSD','terminalCashUSD','terminalInventoryUSD','purchases','recommendationsBought'].map(k=>[k,mean(rows.map(r=>r[k]))]))};}
