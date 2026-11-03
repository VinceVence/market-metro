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

export function predictResponse(model,x,featureNames=RESPONSE_FIELDS){
 if(JSON.stringify(model.featureNames)!==JSON.stringify(featureNames)||x.length!==featureNames.length||x.some(v=>!Number.isFinite(v)))throw Error('INVALID_RESPONSE_MODEL_INPUT');
 if(model.family==='response_hurdle')return predictResponse(model.response,x,featureNames)*predictResponse(model.retainedGivenResponse,x,featureNames);
 if(model.family==='expert_stack'){
  const logit=p=>{const q=Math.max(1e-6,Math.min(1-1e-6,p));return Math.log(q/(1-q));},kind=x[featureNames.indexOf('is_recommendation')],incumbent=x[featureNames.indexOf('incumbent_probability')],feedback=predictResponse(model.feedbackExpert,x.slice(0,model.feedbackFeatureNames.length),model.feedbackFeatureNames),head=model.stack.heads[model.stack.mode==='pooled'?'all':String(kind)],v=[logit(incumbent),logit(feedback),kind];
  if(!head||head.coefficients.length!==(model.stack.mode==='pooled'?3:2)||incumbent<0||incumbent>1)throw Error('INVALID_EXPERT_HEAD');
  const z=head.intercept+head.coefficients.reduce((s,b,i)=>s+b*v[i],0);return 1/(1+Math.exp(-Math.max(-40,Math.min(40,z))));
 }
 if(model.family==='boosted'){
  const input=x.map(Math.fround),z=model.intercept+model.learningRate*model.trees.reduce((s,t)=>{let n=0;while(t.left[n]!==-1)n=input[t.feature[n]]<=t.threshold[n]?t.left[n]:t.right[n];return s+t.value[n];},0);
  return 1/(1+Math.exp(-Math.max(-40,Math.min(40,z))));
 }
 if(model.family==='logistic'){
  const z=model.intercept+model.coefficients.reduce((s,c,i)=>s+c*(x[i]-model.mean[i])/model.scale[i],0);return 1/(1+Math.exp(-Math.max(-40,Math.min(40,z))));
 }
 if(model.family==='forest'){
  const input=x.map(Math.fround);return model.trees.reduce((s,t)=>{let n=0;while(t.left[n]!==-1)n=input[t.feature[n]]<=t.threshold[n]?t.left[n]:t.right[n];return s+t.probability[n];},0)/model.trees.length;
 }
 throw Error('UNKNOWN_RESPONSE_MODEL_FAMILY');
}
export function predictContribution(artifact,family,x,kind,featureNames=RESPONSE_FIELDS){
 const probability=predictResponse(artifact.models[family],x,featureNames),values=artifact.valueMeans[kind];let retained=values.retainedNetCents;
 if(artifact.valueModel){
  if(JSON.stringify(artifact.valueModel.featureNames)!==JSON.stringify(featureNames))throw Error('INVALID_PAYMENT_VALUE_FEATURES');
  const input=x.map(Math.fround);retained=artifact.valueModel.trees.reduce((sum,t)=>{let n=0;while(t.left[n]!==-1)n=input[t.feature[n]]<=t.threshold[n]?t.left[n]:t.right[n];return sum+t.value[n];},0)/artifact.valueModel.trees.length;
 }
 const expectedNetCents=probability*retained+(1-probability)*values.failedNetCents;
 if(!Number.isFinite(expectedNetCents))throw Error('INVALID_PAYMENT_VALUE_PREDICTION');return {probability,expectedNetCents};
}
export function predictSharedContribution(artifact,probability,x,kind,featureNames=RESPONSE_FIELDS){
 const head=artifact.sharedValueModel,values=artifact.sharedValueMeans?.[kind];
 if(!head||!values||JSON.stringify(head.featureNames)!==JSON.stringify(featureNames)||x.length!==featureNames.length||x.some(v=>!Number.isFinite(v))||!Number.isFinite(probability)||probability<0||probability>1)throw Error('INVALID_SHARED_VALUE_MODEL');
 const input=x.map(Math.fround),value=head.trees.reduce((sum,t)=>{let n=0;while(t.left[n]!==-1)n=input[t.feature[n]]<=t.threshold[n]?t.left[n]:t.right[n];return sum+t.value[n];},0)/head.trees.length,
  expectedSharedNetCents=probability*value+(1-probability)*values.failedNetCents;
 if(!Number.isFinite(expectedSharedNetCents))throw Error('INVALID_SHARED_VALUE_PREDICTION');return {expectedSharedNetCents};
}
