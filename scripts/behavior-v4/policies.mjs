import {fitRanker,rankProducts} from '../marketing/recommender.mjs';
import {createHash} from 'node:crypto';
export const POLICIES=Object.freeze([
 {id:'none',label:'No campaign'},
 {id:'weekly_featured',label:'Weekly featured-pack recommendations'},
 {id:'strong_rules',label:'Rules with the same fitted ranker'},
 {id:'personalized',label:'Full-price discovery recommendations'},
 {id:'reactivate',label:'Targeted reactivation coupons'},
 {id:'portfolio',label:'Discovery + reactivation portfolio'}
]);
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function train(w){
 const start=performance.now(),cutoff=w.tick,split=cutoff-7,rows=w.behavior.observations.filter(r=>r.day<cutoff&&r.day>=cutoff-35);
 const trainRows=rows.filter(r=>r.day<split),valid=rows.filter(r=>r.day>=split&&r.purchased),fit=fitRanker(trainRows,w.products),pop={...fit,type:'popularity',profiles:{}};
 const recall=model=>valid.reduce((n,r)=>n+Number(rankProducts(model,w.products,r.customer_id).slice(0,3).some(p=>p.productId===r.product_id)),0)/Math.max(1,valid.length);
 const candidateRecall=recall(fit),baselineRecall=recall(pop),artifact=fitRanker(rows,w.products);
 // Numerical model selection is shared with the strong-rule baseline.
 if(valid.length<10||candidateRecall<baselineRecall){artifact.type='popularity';artifact.profiles={};}
 const model={id:w.runId+'-V3MODEL-'+cutoff,cutoff,split,trainingRows:trainRows.length,validationPurchases:valid.length,candidateRecall,baselineRecall,type:artifact.type,artifact,datasetHash:hash(rows),runtimeMs:Math.round(performance.now()-start),reason:'Chronological last7-day rank validation; this predicts ranking, not causal profit.'};
 w.behavior.models.push(model);return model;
}
export function publicEvidence(w){
 const b=w.behavior,cutoff=w.tick,mature=b.orders.filter(o=>o.day+14<=cutoff),recent=b.orders.filter(o=>o.day>=cutoff-14&&o.day<cutoff),previous=b.orders.filter(o=>o.day>=cutoff-28&&o.day<cutoff-14);
 return {asOfDay:cutoff,customers:w.customers.length,recentOrders:recent.length,previousOrders:previous.length,observedLapsed:w.customers.filter(u=>u.purchases&&cutoff-u.lastPurchase>=14).length,
  observedProspects:w.customers.filter(u=>!u.purchases&&u.visits).length,recentInterests:Object.entries(w.customers.reduce((a,u)=>{if(u.observedIntent&&cutoff-u.observedIntent.day<=14)a[u.observedIntent.topic]=(a[u.observedIntent.topic]||0)+1;return a;},{})).map(([topic,n])=>({topic,n})),
  matureMerchantRisk:w.merchants.map((m,i)=>{const xs=mature.filter(o=>o.merchantIndex===i).slice(-40),r=xs.filter(o=>o.refund>0).length;return {merchantIndex:i,orders:xs.length,returns:r,returnRate:(r+1)/(xs.length+20),exclude:xs.length>=20&&(r+1)/(xs.length+20)>.1};}),
  model:b.models.at(-1)?{...b.models.at(-1),artifact:undefined}:null,remainingBudgetCents:w.goal.budgetCents-w.live.discountCents-w.live.spendCents,
  scope:'Observed partner events only. True relationship state, unmet need, preferences, outside spending and future returns are excluded.'};
}
export function compilePolicy(w,policyId){
 if(!POLICIES.some(p=>p.id===policyId))throw Error('UNKNOWN_V3_POLICY');const model=w.behavior.models.at(-1),risk=publicEvidence(w).matureMerchantRisk,excluded=new Set(risk.filter(m=>m.exclude).map(m=>m.merchantIndex));
 const ranking=new Map();
 return ({day,customer:u,products})=>{
  if(policyId==='none')return null;
  let pool=products.filter(p=>p.stock>0&&p.allowedPct.includes(0)&&!excluded.has(p.merchantIndex));if(!pool.length)return null;
  if(policyId==='weekly_featured'){
   if(![0,1].includes(day%7))return null;
   pool=pool.filter(p=>p.campaignRole==='featured_bundle');
   pool.sort((a,b)=>Number(b.merchantIndex===u.lastMerchantIndex)-Number(a.merchantIndex===u.lastMerchantIndex)||a.merchantIndex-b.merchantIndex);
   return pool[0]?{productId:pool[0].productId,pct:0,reason:'Featured authored pack, familiar eligible merchant, weekly window.'}:null;
  }
  if(!Object.keys(u.seenCategories).length&&!u.observedIntent)return null;
  if(!ranking.has(u.customerId))ranking.set(u.customerId,new Map((model?rankProducts(model.artifact,w.products,u.customerId):[]).map((r,i)=>[r.productId,r.score])));
  const scores=ranking.get(u.customerId),intent=u.observedIntent&&day-u.observedIntent.day<=14?u.observedIntent.topic:null;
  pool.sort((a,b)=>((scores.get(b.productId)||0)+Number(b.category===intent)*.5)-((scores.get(a.productId)||0)+Number(a.category===intent)*.5)||a.priceCents-b.priceCents||a.productId.localeCompare(b.productId));
  const lapsed=u.purchases>0&&day-u.lastPurchase>=14,prospect=!u.purchases;
  if(policyId==='reactivate'&&!lapsed)return null;
  if(policyId==='personalized'&&!prospect&&!intent&&day-u.lastPurchase<14)return null;
  if(policyId==='portfolio'&&!lapsed&&!prospect&&!intent)return null;
  if(policyId==='strong_rules'){
   // Strong baseline has identical model and safety data; simple recurring timing.
   if(day%7!==0||(!lapsed&&!prospect))return null;
  }
  const p=pool[0],discount=policyId!=='personalized'&&lapsed&&p.allowedPct.includes(5)?5:0;
  return {productId:p.productId,pct:discount,reason:discount?'A lapsed customer with observed interest; bounded5% reactivation offer.':intent?'Recommendation matches a recent expressed need.':'Recommendation matches observed browsing and fitted product affinity.'};
 };
}
