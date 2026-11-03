// Training-only paired simulator experiments. Hidden state stays inside copies
// of the environment. Models receive public feature vectors and measured label
// differences, never latent traits, seeds, future draws or runtime oracle tools.
import {readFile,writeFile,access} from 'node:fs/promises';
import {createWorld,stepWorld,outcome} from '../engine.mjs';
import {applyPlan} from '../operations.mjs';
import {applyNetworkPlan} from '../network.mjs';
import {compileCommercePolicy} from '../policies.mjs';
import {authoredCatalog} from '../../behavior-v4/catalog.mjs';
import {draw} from '../../marketing/economy.mjs';
import {hash} from '../../commerce-design-v2/evaluate.mjs';
import {PAIR_FEATURES,pairFeatures} from './pair-features.mjs';
const dir='docs/commerce-economy-v5/paired-learning-2';if(await access(dir+'/protocol.json').then(()=>true,()=>false))throw Error('PAIRED_PROTOCOL_ALREADY_EXISTS');
const prior=JSON.parse(await readFile('docs/commerce-economy-v5/search-1/audited-report.json','utf8')),safe=prior.arms.multi.config,fast=structuredClone(safe);fast.economics.merchantRail='paypal';fast.economics.supplierRail='paypal';
const scenarios=['steady','rival_sale','budget_squeeze','returns_wave','preference_shift','supply_delay'],episodes=Array.from({length:18},(_,i)=>({seed:640000+i,scenario:scenarios[i%6],split:i<12?'train':'model_validation'})),settings={customers:100,days:100,campaignStop:90,budgetCents:5000},snapshots=[30,35,49,63,77],samplesPerSnapshot=8,rows=[],summary=[];
const files=['scripts/commerce-economy-v5/engine.mjs','scripts/commerce-economy-v5/operations.mjs','scripts/commerce-economy-v5/network.mjs','scripts/commerce-economy-v5/policies.mjs','scripts/commerce-economy-v5/learning/features.mjs','scripts/commerce-economy-v5/learning/pair-features.mjs','scripts/commerce-economy-v5/learning/generate-pairs.mjs'];
const protocol={createdAt:new Date().toISOString(),episodes,businesses:{safe,fast},settings,snapshots,samplesPerSnapshot,features:PAIR_FEATURES,maxPairs:1440,maxCustomerAttemptsPerSnapshot:24,outcomeDays:14,refundFollowupDays:14,economicHashes:Object.fromEntries(await Promise.all(files.map(async f=>[f,hash(await readFile(f,'utf8'))]))),scope:'Paired synthetic training experiments: one observed customer recommendation is changed; everything else follows the incumbent policy. Both cloned worlds use identical exogenous shocks. Label differences use settled14-day whole-market platform, aggregate-partner and retailer contribution. This privileged simulator supervision is available equally to all learning baselines, and cannot be queried on validation/test runtime states. No hidden state appears in X. Not real-world counterfactual data. No native/model API calls.'};protocol.hash=hash(protocol);await writeFile(dir+'/protocol.json',JSON.stringify(protocol,null,2));
for(const f of files){const path=dir+'/source/'+f;await (await import('node:fs/promises')).mkdir(path.slice(0,path.lastIndexOf('/')),{recursive:true});await writeFile(path,await readFile(f));}
function prepare(w,b){applyPlan(w,{pricePct:b.economics.pricePct,stockDays:b.demand.stockDays,useLostDemand:b.demand.useLostDemand},{evidenceDay:w.tick});applyNetworkPlan(w,{merchantRail:b.economics.merchantRail,supplierRail:b.economics.supplierRail});w.commerce.forecastWindowDays=b.demand.windowDays;}
function branch(snapshot,b,target,probe,treatment){const w=structuredClone(snapshot),day=w.tick,end=day+14,stop=end+14;let record=null;
 while(w.tick<stop){const standard=compileCommercePolicy(w,b.lifecycle);stepWorld(w,input=>{const old=standard(input);if(input.day!==day||input.customer.index!==target||old?.kind==='subscription_offer')return old;
  const pool=input.products.filter(p=>p.stock>0&&p.allowedPct.includes(0));if(!pool.length)return old;const p=pool[Math.floor(draw(840000,'candidate',w.seed,day,target,probe)*pool.length)];record={x:pairFeatures(w,input,p,old),productId:p.productId,customerId:input.customer.customerId,incumbent:old?.productId||null};return treatment?{productId:p.productId,pct:0,reason:'Training-only single-action replacement in a cloned simulator.'}:old;});if(w.tick===day+1&&!record)return {record:null};}
 const o=outcome(w,end);return {record,y:[o.platformCents,o.merchantCents+o.commerce.network.partnerContributionCents,o.merchantCents]};}
for(const episode of episodes)for(const [mode,b] of Object.entries(protocol.businesses)){if(b.lifecycle.marketing!=='weekly_featured')throw Error('TEACHER_REQUIRES_WEEKLY_INCUMBENT');
 const w=createWorld({...settings,...episode,runId:'PAIR-'+episode.seed,catalog:authoredCatalog()});let count=0,skipped=0;
 for(const day of snapshots){while(w.tick<day)stepWorld(w,w.tick>=30?compileCommercePolicy(w,b.lifecycle):()=>null);if(day===30)prepare(w,b);
  const eligible=w.customers.filter(u=>day-u.lastOffer>=7&&!w.commerce.mandates.some(m=>m.customerId===u.customer_id&&m.status==='ACTIVE')).sort((a,z)=>draw(840001,'customer',episode.seed,day,a.index)-draw(840001,'customer',episode.seed,day,z.index)).slice(0,24);let accepted=0;
  for(const [probe,u] of eligible.entries()){if(accepted>=samplesPerSnapshot)break;const control=branch(w,b,u.index,probe,false);if(!control.record){skipped++;continue;}const treated=branch(w,b,u.index,probe,true);if(!treated.record){skipped++;continue;}if(JSON.stringify(control.record)!==JSON.stringify(treated.record))throw Error('PRE_ACTION_FEATURE_OR_PRODUCT_MISMATCH');rows.push({episode:episode.seed,scenario:episode.scenario,split:episode.split,mode,day,...control.record,y:treated.y.map((v,i)=>v-control.y[i]),control:control.y,treatment:treated.y});count++;accepted++;}
 }
 summary.push({...episode,mode,pairs:count,skipped});console.log(JSON.stringify(summary.at(-1)));await writeFile(dir+'/summary.json',JSON.stringify({protocolHash:protocol.hash,complete:summary.length===36,summary,rows:rows.length,modelCalls:0,nativePayments:0},null,2));await writeFile(dir+'/dataset.json',JSON.stringify({protocolHash:protocol.hash,features:PAIR_FEATURES,rows}));
}
