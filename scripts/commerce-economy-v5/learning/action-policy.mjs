import {readFile} from 'node:fs/promises';
import {compileCommercePolicy} from '../policies.mjs';
import {actions,actionFeatures,ACTION_FEATURES} from './actions.mjs';
export async function loadActionModels(){const m=JSON.parse(await readFile('docs/commerce-economy-v5/action-learning-1/models.json','utf8'));if(m.version!=='action-advantage-1'||JSON.stringify(m.featureNames)!==JSON.stringify(ACTION_FEATURES))throw Error('INVALID_ACTION_MODEL');return m;}
export function predictActionValue(model,x){
 if(x.length!==ACTION_FEATURES.length||x.some(v=>!Number.isFinite(v)))throw Error('INVALID_ACTION_FEATURE_VECTOR');
 let result;
 if(model.kind==='linear'){const z=x.map((v,i)=>(v-model.mean[i])/model.scale[i]);result=model.coefficient.map((row,j)=>row.reduce((s,c,i)=>s+c*z[i],model.intercept[j]));}
 else if(model.kind==='forest'){const z=x.map(Math.fround);result=model.outcomeScale.map(()=>0);for(const t of model.trees){let n=0;while(t.left[n]!==-1)n=z[t.feature[n]]<=t.threshold[n]?t.left[n]:t.right[n];for(let j=0;j<result.length;j++)result[j]+=t.value[n][j]/model.trees.length;}}
 else throw Error('UNKNOWN_ACTION_MODEL_KIND');
 return result.map((v,j)=>v*model.outcomeScale[j]);
}
export function compileActionPolicy(w,artifact,{modelName='extra_trees',lifecycle,thresholdCents=5,merchantFloorCents=0,onDecision}={}){
 const model=artifact.models[modelName];if(!model||!Number.isFinite(thresholdCents)||thresholdCents<0)throw Error('INVALID_ACTION_POLICY');const oldPolicy=compileCommercePolicy(w,lifecycle);
 return input=>{const old=oldPolicy(input);if(input.day>77||w.commerce.mandates.some(m=>m.customerId===input.customer.customerId&&m.status==='ACTIVE'))return old;
  let best=null;for(const candidate of actions(w,input,old)){const prediction=predictActionValue(model,actionFeatures(w,input,candidate,old));if(prediction[0]<=thresholdCents||prediction[1]<merchantFloorCents)continue;if(!best||prediction[0]>best.prediction[0])best={...candidate,prediction};}
  onDecision?.({day:input.day,customerId:input.customer.customerId,changed:!!best,name:best?.name||'Keep incumbent',prediction:best?.prediction||[0,0]});
  if(!best)return old;if(!best.action)return null;return {...best.action,reason:`Estimated28-day improvement over incumbent: ${best.prediction[0].toFixed(1)} cents platform and ${best.prediction[1].toFixed(1)} cents retailer. Forecast, not a guaranteed purchase.`};
 };
}
