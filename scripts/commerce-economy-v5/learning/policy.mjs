import {readFile} from 'node:fs/promises';
import {FEATURES,observedFeatures} from './features.mjs';
import {compileCommercePolicy} from '../policies.mjs';
import {publicEvidence} from '../../behavior-v4/policies.mjs';
export async function loadResponseModel(path='docs/commerce-economy-v5/learning-1/model.json'){
 const m=JSON.parse(await readFile(path,'utf8'));if(m.version!=='response-dr-1'||JSON.stringify(m.featureNames)!==JSON.stringify(FEATURES)||m.models.length!==2)throw Error('INVALID_RESPONSE_MODEL');
 for(const o of m.models)for(const t of o.forest){const n=t.feature.length;if(!n||!['threshold','left','right','value'].every(k=>t[k].length===n))throw Error('INVALID_RESPONSE_TREE');for(let i=0;i<n;i++){if(!Number.isFinite(t.value[i])||!Number.isFinite(t.threshold[i]))throw Error('NONFINITE_RESPONSE_TREE');if(t.left[i]!==-1&&(!Number.isInteger(t.feature[i])||t.feature[i]<0||t.feature[i]>=FEATURES.length||![t.left[i],t.right[i]].every(j=>Number.isInteger(j)&&j>i&&j<n)))throw Error('INVALID_RESPONSE_NODE');}}
 return m;
}
export function predictResponse(model,features){
 if(features.length!==FEATURES.length||features.some(x=>!Number.isFinite(x)))throw Error('INVALID_RESPONSE_FEATURES');
 // sklearn's public tree predictor casts inputs to float32; reproduce it for
 // portable inference and verify against independent Python predictions.
 const x=features.map(Math.fround);
 return model.models.map(o=>o.forest.reduce((sum,t)=>{let n=0;while(t.left[n]!==-1)n=x[t.feature[n]]<=t.threshold[n]?t.left[n]:t.right[n];return sum+t.value[n];},0)/o.forest.length);
}
export function compileResponsePolicy(w,model,{lifecycle,thresholdCents=0,merchantFloorCents=0,onDecision}={}){
 if(!Number.isFinite(thresholdCents)||thresholdCents<0||!Number.isFinite(merchantFloorCents)||merchantFloorCents<0)throw Error('INVALID_RESPONSE_THRESHOLD');
 const old=compileCommercePolicy(w,lifecycle),excluded=new Set(publicEvidence(w).matureMerchantRisk.filter(x=>x.exclude).map(x=>x.merchantIndex));
 return input=>{
  if(w.commerce.mandates.some(m=>m.customerId===input.customer.customerId&&m.status==='ACTIVE'))return null;
  const offer=old(input);if(offer?.kind==='subscription_offer')return offer;
  let best=null;
  for(const p of input.products){if(p.stock<=0||!p.allowedPct.includes(0)||excluded.has(p.merchantIndex))continue;
   const prediction=predictResponse(model,observedFeatures(w,input,p));if(prediction[0]<=thresholdCents||prediction[1]<merchantFloorCents)continue;
   if(!best||prediction[0]>best.prediction[0])best={p,prediction};
  }
  onDecision?.({day:input.day,customerId:input.customer.customerId,productId:best?.p.productId||null,prediction:best?.prediction||null,source:'LOCAL_ESTIMATED_RESPONSE_NOT_GUARANTEED_OUTCOME'});
  return best?{productId:best.p.productId,pct:0,reason:`Local response model estimates ${best.prediction[0].toFixed(1)} cents of14-day payment contribution and ${best.prediction[1].toFixed(1)} cents retailer contribution versus deferring. Estimated, not guaranteed.`}:null;
 };
}
