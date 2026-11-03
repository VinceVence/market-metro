import {publicEvidence} from '../behavior-v4/policies.mjs';

export const WEIGHTS=['affinity','collaborative','intent','priceFit','value'];
export const CONFIG_KEYS=['basis','weights','audience','gapDays','minRecency','discountPct','priceRatio'];
export const defaults=()=>({basis:'blend',weights:{affinity:3,collaborative:1,intent:4,priceFit:2,value:1},audience:'observed',gapDays:7,minRecency:0,discountPct:0,priceRatio:0});
export function validateConfig(c){
 if(!c||Object.keys(c).sort().join()!==[...CONFIG_KEYS].sort().join()||!['blend','featured','none'].includes(c.basis)||!['all','observed','lapsed','intent','prospects'].includes(c.audience)||![7,14,21].includes(c.gapDays)||![0,7,14,21].includes(c.minRecency)||![0,5].includes(c.discountPct)||![0,1.5,2,4].includes(c.priceRatio)||!c.weights||Object.keys(c.weights).sort().join()!==[...WEIGHTS].sort().join()||WEIGHTS.some(k=>!Number.isFinite(c.weights[k])||c.weights[k]<0||c.weights[k]>10)||WEIGHTS.every(k=>c.weights[k]===0))throw Error('INVALID_TYPED_CAMPAIGN');
 return structuredClone(c);
}
// EASE (Steck, WWW 2019). Sixteen authored SKUs: a small dense inverse suffices.
// At larger catalog sizes use a sparse/low-rank learner, not this O(items^3) fit.
export function inverse(a){
 const n=a.length,m=a.map((row,i)=>[...row,...Array.from({length:n},(_,j)=>Number(i===j))]);
 for(let i=0;i<n;i++){
  let pivot=i;for(let r=i+1;r<n;r++)if(Math.abs(m[r][i])>Math.abs(m[pivot][i]))pivot=r;
  [m[i],m[pivot]]=[m[pivot],m[i]];const d=m[i][i];if(!Number.isFinite(d)||Math.abs(d)<1e-12)throw Error('SINGULAR_MODEL');
  m[i]=m[i].map(v=>v/d);for(let r=0;r<n;r++)if(r!==i){const f=m[r][i];for(let j=0;j<2*n;j++)m[r][j]-=f*m[i][j];}
 }
 return m.map(r=>r.slice(n));
}
export function fitFeatures(rows,products,cutoff){
 const start=performance.now(),items=[...new Map(products.map(p=>[p.catalog_item_id,p])).values()],ids=items.map(p=>p.catalog_item_id),index=new Map(ids.map((x,i)=>[x,i])),byId=new Map(products.map(p=>[p.product_id,p])),profiles={},pop=Array(ids.length).fill(0);
 const past=rows.filter(r=>r.day<cutoff&&r.day>=cutoff-35);
 for(const r of past){const p=byId.get(r.product_id);if(!p)continue;const weight=Number(r.visited)+3*Number(r.purchased);if(!weight)continue;
  const u=profiles[r.customer_id]??={counts:Array(ids.length).fill(0),category:{},priceSum:0,priceWeight:0};
  const i=index.get(p.catalog_item_id);u.counts[i]+=weight;pop[i]+=weight;u.category[p.category]=(u.category[p.category]||0)+weight;
  if(r.purchased){u.priceSum+=Math.log(p.price_cents);u.priceWeight++;}
 }
 const x=Object.values(profiles).map(u=>u.counts.map(Math.log1p)),n=ids.length,gram=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>x.reduce((s,row)=>s+row[i]*row[j],0)+(i===j?32:0))),p=inverse(gram),b=p.map((row,i)=>row.map((v,j)=>i===j?0:-v/p[j][j]));
 for(const u of Object.values(profiles)){const v=u.counts.map(Math.log1p);u.cf=ids.map((_,j)=>v.reduce((s,value,i)=>s+value*b[i][j],0));u.priceCenter=u.priceWeight?Math.exp(u.priceSum/u.priceWeight):null;}
 return {version:'canonical-ease-1',cutoff,ids,index:Object.fromEntries(index),profiles,pop,coefficients:b,rows:past.length,runtimeMs:Math.round(performance.now()-start),regularization:32};
}
export function rankOffers(input,model,config,excluded=new Set()){
 const {customer:u,day}=input,profile=model.profiles[u.customerId],cf=profile?.cf||[],count=profile?.counts||[],cat=profile?.category||{},maxCf=Math.max(.001,...cf),maxCount=Math.max(1,...count),maxCat=Math.max(1,...Object.values(cat)),maxPop=Math.max(1,...model.pop),intent=u.observedIntent&&day-u.observedIntent.day<=14?u.observedIntent.topic:null;
 const candidates=input.products.filter(p=>p.stock>0&&p.allowedPct.includes(0)&&!excluded.has(p.merchantIndex)&&(config.basis!=='featured'||p.campaignRole==='featured_bundle')&&(!config.priceRatio||!profile?.priceCenter||p.priceCents<=profile.priceCenter*config.priceRatio));
 return candidates.map(p=>{const i=model.index[p.catalogItemId],features={
  affinity:profile?.counts.some(x=>x>0)?(.5*(count[i]||0)/maxCount+.5*(cat[p.category]||0)/maxCat):(model.pop[i]||0)/maxPop,
  collaborative:Math.max(0,cf[i]||0)/maxCf,
  intent:Number(p.category===intent),
  priceFit:profile?.priceCenter?Math.exp(-Math.abs(Math.log(p.priceCents/profile.priceCenter))):.5,
  value:(Math.round(p.priceCents*.0349)+49-Math.round(p.priceCents*.012)-20)/659
 };
 return {...p,features,score:config.basis==='featured'?0:WEIGHTS.reduce((sum,k)=>sum+config.weights[k]*features[k],0)};
 }).sort((a,b)=>b.score-a.score||Number(b.merchantIndex===u.lastMerchantIndex)-Number(a.merchantIndex===u.lastMerchantIndex)||a.merchantIndex-b.merchantIndex||a.productId.localeCompare(b.productId));
}
export function compileCandidate(w,model,raw){
 const c=validateConfig(raw),excluded=new Set(publicEvidence(w).matureMerchantRisk.filter(r=>r.exclude).map(r=>r.merchantIndex));
 return input=>{const {day,customer:u}=input,observed=!!Object.keys(u.seenCategories).length||!!u.observedIntent,lapsed=u.purchases>0&&day-u.lastPurchase>=14,intent=u.observedIntent&&day-u.observedIntent.day<=14;
  if(c.basis==='none'||day-u.lastOffer<c.gapDays||(u.purchases&&day-u.lastPurchase<c.minRecency)||(c.basis==='featured'&&![0,1].includes(day%7))||(c.audience==='observed'&&!observed)||(c.audience==='lapsed'&&!lapsed)||(c.audience==='intent'&&!intent)||(c.audience==='prospects'&&u.purchases))return null;
  const p=rankOffers(input,model,c,excluded)[0];if(!p)return null;
  const pct=c.discountPct&&lapsed&&p.allowedPct.includes(c.discountPct)?c.discountPct:0;
  return {productId:p.productId,pct,reason:`Validated campaign: ${c.audience}; ${c.gapDays}-day contact interval; ${pct?pct+'% lapsed-buyer offer':'full-price recommendation'}. ${Object.entries(p.features).filter(([k])=>c.weights[k]>0).map(([k,v])=>k+'='+v.toFixed(2)).join(', ')}`};
 };
}
export const NUMERICAL_CANDIDATES=[
 {name:'Observed relevance',config:{...defaults(),weights:{affinity:4,collaborative:0,intent:6,priceFit:3,value:1}}},
 {name:'Collaborative discovery',config:{...defaults(),weights:{affinity:2,collaborative:6,intent:4,priceFit:2,value:1}}},
 {name:'Value-aware relevance',config:{...defaults(),weights:{affinity:2,collaborative:1,intent:4,priceFit:1,value:5}}},
 {name:'Patient reactivation',config:{...defaults(),audience:'lapsed',gapDays:14,discountPct:5}},
 {name:'Weekly featured baseline',config:{...defaults(),basis:'featured',audience:'all'}}
];
