// Training-only action-value data. Each candidate uses existing engine actions;
// economic response equations, fees, cash and constraints are unchanged.
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {createWorld,stepWorld,outcome} from '../engine.mjs';
import {applyPlan} from '../operations.mjs';
import {applyNetworkPlan} from '../network.mjs';
import {compileCommercePolicy} from '../policies.mjs';
import {authoredCatalog} from '../../behavior-v4/catalog.mjs';
import {draw} from '../../marketing/economy.mjs';
import {hash} from '../../commerce-design-v2/evaluate.mjs';
import {actions,actionFeatures,ACTION_FEATURES,actionKey} from './actions.mjs';
const dir='docs/commerce-economy-v5/action-learning-1';if(await access(dir+'/protocol.json').then(()=>true,()=>false))throw Error('ACTION_PROTOCOL_EXISTS');
const prior=JSON.parse(await readFile('docs/commerce-economy-v5/search-1/audited-report.json','utf8')),commercial=prior.arms.multi.config,fast=structuredClone(commercial);fast.economics.merchantRail='paypal';fast.economics.supplierRail='paypal';
const scenarios=['steady','rival_sale','budget_squeeze','returns_wave','preference_shift','supply_delay'],episodes=Array.from({length:18},(_,i)=>({seed:650000+i,scenario:scenarios[i%6],split:i<12?'train':'model_validation'})),settings={customers:100,days:100,campaignStop:90,budgetCents:5000},snapshotDays=[30,35,49,63],rows=[],summaries=[];
const files=['scripts/commerce-economy-v5/engine.mjs','scripts/commerce-economy-v5/operations.mjs','scripts/commerce-economy-v5/network.mjs','scripts/commerce-economy-v5/policies.mjs','scripts/commerce-economy-v5/learning/features.mjs','scripts/commerce-economy-v5/learning/pair-features.mjs','scripts/commerce-economy-v5/learning/actions.mjs','scripts/commerce-economy-v5/learning/generate-actions.mjs'];
const protocol={createdAt:new Date().toISOString(),episodes,businesses:{commercial,fast},settings,snapshotDays,customersPerSnapshot:4,actionsPerCustomer:4,features:ACTION_FEATURES,labelHorizonDays:28,returnFollowupDays:14,scope:'Paired simulator training experiments over recommendation, suppression, bounded coupon and optional replenishment invitations. One customer action changes; other decisions follow the incumbent. Models receive observed features, per-customer28-day retained retail contribution advantages and auxiliary global outcomes. No new economic dynamics, oracle access at inference, native payments or model API calls. Active mandates are never overwritten; replenishment invitations use previously purchased consumables at at most110% of their observed prior payment.',hashes:Object.fromEntries(await Promise.all(files.map(async f=>[f,hash(await readFile(f,'utf8'))])))};protocol.hash=hash(protocol);await writeFile(dir+'/protocol.json',JSON.stringify(protocol,null,2));
for(const f of files){const path=dir+'/source/'+f;await mkdir(path.slice(0,path.lastIndexOf('/')),{recursive:true});await writeFile(path,await readFile(f));}
function prepare(w,b){applyPlan(w,{pricePct:b.economics.pricePct,stockDays:b.demand.stockDays,useLostDemand:b.demand.useLostDemand},{evidenceDay:w.tick});applyNetworkPlan(w,{merchantRail:b.economics.merchantRail,supplierRail:b.economics.supplierRail});w.commerce.forecastWindowDays=b.demand.windowDays;}
function totals(w,day,end,customerId){const orders=w.behavior.orders.filter(o=>o.customerId===customerId&&o.day>=day&&o.day<end),contacts=w.behavior.actions.filter(a=>a.customer_id===customerId&&a.day>=day&&a.day<end);const own=[orders.reduce((s,o)=>s+(o.refund?0:o.fee)-o.processing,0)-contacts.reduce((s,a)=>s+a.outreach_cents+a.platform_support_cents,0),orders.reduce((s,o)=>s+o.gross-o.refund-(o.refund?0:o.fee)-o.cost-o.delivery+o.support,0)],all=outcome(w,end);return {own,global:[all.platformCents,all.merchantCents+all.commerce.network.partnerContributionCents,all.merchantCents]};}
function rollout(snapshot,b,target,treatment){const w=structuredClone(snapshot),day=w.tick,end=day+28,stop=end+14;let captured=null;
 while(w.tick<stop){const standard=compileCommercePolicy(w,b.lifecycle);stepWorld(w,input=>{const old=standard(input);if(input.day!==day||input.customer.index!==target)return old;
  const options=actions(w,input,old);captured={customerId:input.customer.customerId,incumbent:old,options:options.map(o=>({...o,x:actionFeatures(w,input,o,old)}))};
  if(treatment){const chosen=captured.options.find(o=>actionKey(o.action)===actionKey(treatment.action));if(!chosen||JSON.stringify(chosen.x)!==JSON.stringify(treatment.x))throw Error('PRE_ACTION_CANDIDATE_MISMATCH');return chosen.action?{...chosen.action,reason:'Training-only action replacement in a copied simulator.'}:null;}return old;});
  if(w.tick===day+1&&!captured)return {captured:null};
 }
 return {captured,...totals(w,day,end,captured.customerId)};
}
for(const episode of episodes)for(const [mode,b] of Object.entries(protocol.businesses)){const w=createWorld({...settings,...episode,runId:'ACTION-TRAIN-'+episode.seed,catalog:authoredCatalog()});let count=0;
 for(const day of snapshotDays){while(w.tick<day)stepWorld(w,w.tick>=30?compileCommercePolicy(w,b.lifecycle):()=>null);if(day===30)prepare(w,b);
  const eligible=w.customers.filter(u=>day-u.lastOffer>=7&&!w.commerce.mandates.some(m=>m.customerId===u.customer_id&&m.status==='ACTIVE')).sort((a,z)=>draw(850001,'customer',episode.seed,day,a.index)-draw(850001,'customer',episode.seed,day,z.index)).slice(0,protocol.customersPerSnapshot);
  for(const u of eligible){const control=rollout(w,b,u.index,null);if(!control.captured)continue;const selected=control.captured.options.sort((a,z)=>draw(850002,'action',episode.seed,day,u.index,actionKey(a.action))-draw(850002,'action',episode.seed,day,u.index,actionKey(z.action))).slice(0,protocol.actionsPerCustomer);
   for(const option of selected){const treated=rollout(w,b,u.index,option);rows.push({episode:episode.seed,split:episode.split,scenario:episode.scenario,mode,day,customerId:control.captured.customerId,action:option.action,name:option.name,incumbent:control.captured.incumbent,x:option.x,y:treated.own.map((v,i)=>v-control.own[i]),globalDelta:treated.global.map((v,i)=>v-control.global[i])});count++;}
  }
 }
 summaries.push({...episode,mode,rows:count});console.log(JSON.stringify(summaries.at(-1)));await writeFile(dir+'/summary.json',JSON.stringify({protocolHash:protocol.hash,complete:summaries.length===36,summaries,rows:rows.length,modelCalls:0,nativePayments:0},null,2));await writeFile(dir+'/dataset.json',JSON.stringify({protocolHash:protocol.hash,features:ACTION_FEATURES,rows}));
}
