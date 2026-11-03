// Predictors are observable before contact. IDs, regime/seed, hidden needs,
// future responses and the old model's in-sample estimates are excluded.
export const RESPONSE_FIELDS=Object.freeze(['age','search','signal_count','category_affinity','price_usd','stock','arrival_days','recency','prior_purchases','is_recommendation','sku_purchase_recency','signal_after_sku_purchase','stationery','electronics','furniture','bundles']);
export function responseFeatures(view,candidate){
 const f=candidate.features,a=candidate.action,products=new Map(view.products.map(p=>[p.id,p])),
  orders=a.catalogId?view.pastOrders.filter(o=>o.day<view.day&&o.customerId===a.customerId&&o.items.some(i=>products.get(i.productId)?.catalogId===a.catalogId)):[],
  last=orders.length?Math.max(...orders.map(o=>o.day)):null,
  values={...f,sku_purchase_recency:last===null?99:view.day-last,signal_after_sku_purchase:Number(a.kind==='recommend'&&(last===null||view.day-f.age>last)),stationery:Number(a.category==='Stationery'),electronics:Number(a.category==='Electronics'),furniture:Number(a.category==='Furniture'),bundles:Number(a.category==='Office bundles')},x=RESPONSE_FIELDS.map(k=>values[k]);
 if(x.some(v=>!Number.isFinite(v)))throw Error('INVALID_OBSERVED_RESPONSE_FEATURE');return x;
}

export function predictResponse(model,x){
 if(JSON.stringify(model.featureNames)!==JSON.stringify(RESPONSE_FIELDS)||x.length!==RESPONSE_FIELDS.length||x.some(v=>!Number.isFinite(v)))throw Error('INVALID_RESPONSE_MODEL_INPUT');
 if(model.family==='logistic'){
  const z=model.intercept+model.coefficients.reduce((s,c,i)=>s+c*(x[i]-model.mean[i])/model.scale[i],0);return 1/(1+Math.exp(-Math.max(-40,Math.min(40,z))));
 }
 if(model.family==='forest'){
  const input=x.map(Math.fround);return model.trees.reduce((s,t)=>{let n=0;while(t.left[n]!==-1)n=input[t.feature[n]]<=t.threshold[n]?t.left[n]:t.right[n];return s+t.probability[n];},0)/model.trees.length;
 }
 throw Error('UNKNOWN_RESPONSE_MODEL_FAMILY');
}
