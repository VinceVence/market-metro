import {createHash} from 'node:crypto';
import {createWorld,stepWorld,outcome,assertIntegrity,actionInput,frame} from '../behavior-v4/engine.mjs';
import {authoredCatalog} from '../behavior-v4/catalog.mjs';
import {train,compilePolicy,publicEvidence} from '../behavior-v4/policies.mjs';
import {fitRanker,rankProducts} from '../marketing/recommender.mjs';
import {fitFeatures,compileCandidate,rankOffers,defaults} from './policy.mjs';
export const SETTINGS={customers:100,days:100,campaignStop:90,budgetCents:5000};
export const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
export const mean=xs=>xs.reduce((s,x)=>s+x,0)/Math.max(1,xs.length);
const worlds=new Map(),results=new Map();
function warm(c){const key=JSON.stringify(c);if(!worlds.has(key)){const w=createWorld({...SETTINGS,...c,runId:'DESIGN-'+c.seed,catalog:authoredCatalog()});while(w.tick<30)stepWorld(w);worlds.set(key,w);}return structuredClone(worlds.get(key));}
export function evidence(c){const w=warm(c),m=fitFeatures(w.behavior.observations,w.products,30),byCat={};for(const r of w.behavior.observations){const p=w.products.find(p=>p.product_id===r.product_id);if(!p)continue;const a=byCat[p.category]??={views:0,purchases:0};a.views+=r.visited;a.purchases+=r.purchased;}
 return {scenario:c.scenario,completedDays:30,observed:publicEvidence(w),categoryActivity:byCat,learnedModel:{version:m.version,rows:m.rows,profiles:Object.keys(m.profiles).length,regularization:m.regularization},catalog:authoredCatalog().map(({id,title,category,priceCents})=>({id,title,category,priceCents}))};}
function rankings(w,model,policy){
 const count=fitRanker(w.behavior.observations,w.products),rankings={policy:{},countAffinity:{},popularity:{}},byId=new Map(w.products.map(p=>[p.product_id,p]));
 for(const u of w.customers){const input=actionInput(w,u);rankings.policy[u.customer_id]=rankOffers(input,model,typeof policy==='string'?{...defaults(),basis:'featured',audience:'all'}:policy).map(p=>({offer:p.productId,sku:p.catalogItemId}));
  for(const [name,model] of [['countAffinity',count],['popularity',{...count,type:'popularity',profiles:{}}]])rankings[name][u.customer_id]=rankProducts(model,w.products,u.customer_id).map(p=>({offer:p.productId,sku:byId.get(p.productId).catalog_item_id}));
 }return rankings;
}
export function rankingMetrics(c,policy){
 const w=warm(c),model=fitFeatures(w.behavior.observations,w.products,30),ranked=rankings(w,model,policy),truth=[],byId=new Map(w.products.map(p=>[p.product_id,p]));
 // Snapshot fixed at day30. Labels are future organic purchases in a separate,
 // no-campaign branch. Never add these labels to the scoring model or prompt.
 while(w.tick<37){const step=stepWorld(w,()=>null);for(const o of step.rows.orders){const item=step.rows.order_items.find(i=>i.order_id===o.order_id);truth.push({user:o.customer_id,offer:item.product_id,sku:byId.get(item.product_id).catalog_item_id});}}
 return Object.fromEntries(Object.entries(ranked).map(([name,users])=>{let skuHits=0,offerHits=0,ndcg=0;for(const t of truth){const r=users[t.user],skus=[...new Set(r.map(x=>x.sku))].slice(0,3),index=skus.indexOf(t.sku);skuHits+=Number(index>=0);ndcg+=index<0?0:1/Math.log2(index+2);offerHits+=Number(r.slice(0,3).some(p=>p.offer===t.offer));}return [name,{purchases:truth.length,skuRecall3:skuHits/Math.max(1,truth.length),skuNdcg3:ndcg/Math.max(1,truth.length),offerRecall3:offerHits/Math.max(1,truth.length)}];}));
}
export function simulate(c,policy,{record=false,onDay}={}){
 const key=hash({c,policy}),existing=results.get(key);if(existing&&!record&&!onDay)return existing;
 const w=warm(c),initialHash=hash(w.behavior.observations),started=performance.now(),events=[],frames=[],daily=[],modelFits=[];let model;
 while(w.tick<w.totalTicks){const active=w.tick<SETTINGS.campaignStop;
  if(active&&(w.tick-30)%14===0){train(w);model=fitFeatures(w.behavior.observations,w.products,w.tick);modelFits.push({day:w.tick,rows:model.rows,runtimeMs:model.runtimeMs,version:model.version});}
  const chooser=active?(typeof policy==='string'?compilePolicy(w,policy):compileCandidate(w,model,policy)):()=>null;
  const step=stepWorld(w,chooser);for(const o of step.rows.orders)events.push(o);
  daily.push({day:w.tick,...outcome(w)});if(record)frames.push(frame(w));onDay?.(w,step);
 }
 assertIntegrity(w);const o=outcome(w),assisted=events.filter(e=>e.channel==='behavior_recommendation'),discounted=events.filter(e=>e.channel==='behavior_coupon'),kept=new Set(w.behavior.orders.filter(o=>!o.refund).map(o=>o.id));
 const result={...o,platformUSD:o.platformCents/100,merchantUSD:o.merchantCents/100,retainedUSD:o.retainedCents/100,recommendationPurchases:assisted.length,retainedRecommendationPurchases:assisted.filter(o=>kept.has(o.order_id)).length,couponPurchases:discounted.length,recommendationConversion:assisted.length/Math.max(1,o.recommendations),contactedShoppers:new Set(w.behavior.actions.filter(a=>a.day>=30&&a.product_id).map(a=>a.customer_id)).size,modelFits,initialHash,runtimeMs:Math.round(performance.now()-started),integrity:true,daily};
 if(!record&&!onDay)results.set(key,result);return record?{...result,frames,orders:events,world:w}:result;
}
export function evaluate(cases,policy){const casesResults=cases.map(c=>({case:c,...simulate(c,policy)}));return {cases:casesResults,mean:Object.fromEntries(['platformUSD','merchantUSD','purchases','retainedUSD','recommendationPurchases','recommendationConversion','coupons','couponPurchases'].map(k=>[k,mean(casesResults.map(r=>r[k]))]))};}
