import test from 'node:test';
import assert from 'node:assert/strict';
import {fitIncrementalFamily} from '../scripts/agent-mesh/incremental.mjs';
import {estimate} from '../scripts/policy-lab/learner.mjs';
import {validateSpec,rollout} from '../scripts/agent-mesh/growth-lab.mjs';

function fixture(){
 return Array.from({length:1500},(_,i)=>{
  const recency=(i%100)/100,selected_action=['none','recommend:0','coupon5:0'][i%3],x=[1,recency,0,0,.5,0,0];
  return {day:0,matures_day:14,cluster:'person-'+i,previousMerchant:-1,context_json:JSON.stringify(x),source:'RANDOMIZED_SIMULATION',selected_action,eligible_json:JSON.stringify(['none','recommend:0','coupon5:0']),propensity:1/3,reward_cents:100+(selected_action==='recommend:0'?Math.round(100*recency):selected_action==='coupon5:0'?-20:0)};
 });
}
test('cross-fitted incremental model learns benefit versus no contact and avoids harmful treatment',()=>{
 const model=fitIncrementalFamily('incremental',fixture());
 assert.equal(model.arms.none.coef.reduce((n,x)=>n+Math.abs(x),0),0);
 assert.ok(estimate(model,'recommend:0',[1,.8,0,0,.5,0,0]).mean>.65);
 assert.ok(estimate(model,'coupon5:0',[1,.8,0,0,.5,0,0]).mean<-.1);
 assert.equal(model.trainingScope.crossFit,'2 customer-group folds');
 assert.equal(model.mse,null,'Pseudo-effect fit must not masquerade as reward MSE.');
 assert.equal(model.support.find(x=>x.action==='coupon10:2').supported,false);
});
test('future labels and adaptive observations cannot enter randomized-effect fitting',()=>{
 const rows=fixture(),first=fitIncrementalFamily('incremental',rows);
 const hidden=[...rows.slice(0,10).map(r=>({...r,day:60,matures_day:74,reward_cents:999999})),...rows.slice(0,10).map(r=>({...r,source:'LOCAL_CONTEXTUAL_BANDIT',reward_cents:999999}))];
 const second=fitIncrementalFamily('incremental',[...rows,...hidden]);assert.deepEqual(first.arms,second.arms);assert.equal(first.datasetHash,second.datasetHash);
 assert.throws(()=>fitIncrementalFamily('incremental',rows.map(r=>({...r,propensity:.01}))),/INVALID_RANDOMIZATION_SUPPORT/);
});
test('typed experimental plans and model integrity protect the frozen executor',()=>{
 assert.throws(()=>validateSpec({family:'arbitrary_python'}));
 const spec={family:'eligible',audience:'all',merchantIndices:[0],maxOfferPct:0,durationDays:7,penaltyUSD:0};assert.deepEqual(validateSpec(spec),spec);
 assert.throws(()=>validateSpec({...spec,durationDays:1000}));assert.throws(()=>rollout({seed:1,scenario:'steady',catalog:[],spec,model:null}),/ACTIVE_CAMPAIGN_MODEL_REQUIRED/);
});
