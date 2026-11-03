import {createHash} from 'node:crypto';
import {trainBandit,estimate} from '../policy-lab/learner.mjs';
import {ACTIONS} from '../policy-lab/economy.mjs';

export const FAMILIES=['reward','eligible','incremental'];
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const zero=()=>Array.from({length:7},()=>Array(7).fill(0));
const fold=id=>createHash('sha256').update(id).digest().readUInt16BE(0)%2;
const xFor=(r,action)=>{const x=JSON.parse(r.context_json);x[5]=Number(action!=='none'&&r.previousMerchant===Number(action.split(':')[1]));return x;};

// Reconstruct only pretreatment purchase history. Full-world private traits and
// future refunds are never exposed in these training records.
export function trainingRows(runner,cutoff){
  const w=runner.world,previous=new Map(),index=new Map(w.merchants.map((m,i)=>[m.merchant_id,i]));
  const users=new Map(w.customers.map(c=>[c.customer_id,c.index]));
  return runner.actions.filter(r=>r.day<cutoff).map(r=>{
    const row={...r,cluster:`${w.seed}:${users.get(r.customer_id)}`,previousMerchant:previous.get(r.customer_id)??-1,reward_cents:r.matures_day<=cutoff?r.reward_cents:null};
    if(r.order_id)previous.set(r.customer_id,index.get(r.actual_merchant_id));return row;
  });
}

export function fitIncrementalFamily(family,input,{cutoffDay=45}={}){
  if(!FAMILIES.includes(family))throw Error('UNKNOWN_LEARNING_FAMILY');
  const started=performance.now();
  const rows=input.filter(r=>r.day<cutoffDay&&r.matures_day<=cutoffDay&&Number.isSafeInteger(r.reward_cents)&&r.source==='RANDOMIZED_SIMULATION');
  const prepared=rows.map(r=>{
    const eligible=typeof r.eligible_json==='string'?JSON.parse(r.eligible_json):r.eligible_json;
    if(!Array.isArray(eligible)||!eligible.includes(r.selected_action)||!eligible.includes('none')||!Number.isFinite(r.propensity)||Math.abs(r.propensity-1/eligible.length)>1e-9||!r.cluster)throw Error('INVALID_RANDOMIZATION_SUPPORT');
    const x=JSON.parse(r.context_json);if(x.length!==7||!x.every(Number.isFinite)||![-1,0,1,2].includes(r.previousMerchant))throw Error('INVALID_OBSERVED_FEATURES');
    return {...r,eligible,fold:fold(r.cluster)};
  });
  const eligible=prepared.filter(r=>r.eligible.length>1),base=family==='reward'?prepared:eligible;
  if(base.length<60)throw Error('INSUFFICIENT_RANDOMIZED_HISTORY');
  const settings={cutoffDay,windowDays:56,actions:ACTIONS};
  let model;
  if(family!=='incremental')model=trainBandit(base,settings);
  else{
    const arms={},support=[];
    arms.none={count:eligible.filter(r=>r.selected_action==='none').length,coef:Array(7).fill(0),inverse:zero()};
    for(const action of ACTIONS.filter(a=>a!=='none')){
      const pop=eligible.filter(r=>r.eligible.includes(action)),observed=pop.filter(r=>r.selected_action===action).length,controls=pop.filter(r=>r.selected_action==='none').length;
      const supported=observed>=20&&controls>=20&&[0,1].every(f=>pop.filter(r=>r.fold!==f).length>=60);
      support.push({action,eligibleRows:pop.length,observed,controls,supported});
      if(!supported){arms[action]={count:observed,coef:[-10000,0,0,0,0,0,0],inverse:zero()};continue;}
      const nuisance=[0,1].map(f=>trainBandit(pop.filter(r=>r.fold!==f),settings));
      const pseudo=pop.map(r=>{
        const q=nuisance[r.fold],xa=xFor(r,action),x0=xFor(r,'none');
        const qa=estimate(q,action,xa).mean,q0=estimate(q,'none',x0).mean,y=r.reward_cents/100;
        const target=qa-q0+(r.selected_action===action?(y-qa)/r.propensity:0)-(r.selected_action==='none'?(y-q0)/r.propensity:0);
        return {...r,selected_action:action,context_json:JSON.stringify(xa),reward_cents:Math.round(target*100)};
      });
      const fitted=trainBandit(pseudo,{...settings,actions:[action]});arms[action]={...fitted.arms[action],inverse:zero()};
    }
    model={type:'cross_fitted_incremental_ridge',arms,cutoffDay,windowDays:56,trainingRows:base.length,validationRows:0,mse:null,baselineMse:null,support,
      disclosure:'Customer-group cross-fitting with known warmup randomization. Predicts one-step net reward advantage over no contact. Pseudo-outcomes rounded to cents. No MSE comparability, long-horizon guarantee or real-world causal claim.'};
  }
  // All new learners use greedy predictions, so uncertainty optimism cannot
  // masquerade as a calibrated confidence bound or an economic benefit.
  for(const arm of Object.values(model.arms))arm.inverse=zero();
  model.family=family;model.runtimeMs=performance.now()-started;
  model.datasetHash=hash(base.map(r=>[r.cluster,r.day,r.selected_action,r.context_json,r.reward_cents,r.propensity]));
  model.trainingScope={source:'MATURE_RANDOMIZED_HISTORY',rows:base.length,customers:new Set(base.map(r=>r.cluster)).size,crossFit:family==='incremental'?'2 customer-group folds':'none',stateTransitionsModeled:false};
  model.modelId='MODEL-'+family+'-'+hash({family,dataset:model.datasetHash,arms:model.arms}).slice(0,16);
  return model;
}
