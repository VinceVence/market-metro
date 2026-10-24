// Small contextual ridge bandit. No model API, GPU, or added dependency.
export const DIMENSIONS=7;
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const eye=n=>Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>Number(i===j)));
function inverse(a){
  const n=a.length,m=a.map((r,i)=>[...r,...eye(n)[i]]);
  for(let k=0;k<n;k++){
    let pivot=k;for(let i=k+1;i<n;i++)if(Math.abs(m[i][k])>Math.abs(m[pivot][k]))pivot=i;
    [m[k],m[pivot]]=[m[pivot],m[k]];const d=m[k][k];if(Math.abs(d)<1e-12)throw Error('SINGULAR_POLICY_MODEL');
    for(let j=0;j<2*n;j++)m[k][j]/=d;
    for(let i=0;i<n;i++)if(i!==k){const f=m[i][k];for(let j=0;j<2*n;j++)m[i][j]-=f*m[k][j];}
  }
  return m.map(r=>r.slice(n));
}
function fit(rows,actions){
  return Object.fromEntries(actions.map(action=>{
    const subset=rows.filter(r=>r.selected_action===action),a=eye(DIMENSIONS),b=Array(DIMENSIONS).fill(0);
    for(const r of subset){const x=JSON.parse(r.context_json),y=r.reward_cents/100;
      if(x.length!==DIMENSIONS||!x.every(Number.isFinite)||!Number.isFinite(y))throw Error('INVALID_POLICY_TRAINING_ROW');
      for(let i=0;i<DIMENSIONS;i++){b[i]+=x[i]*y;for(let j=0;j<DIMENSIONS;j++)a[i][j]+=x[i]*x[j];}
    }
    const inv=inverse(a);return [action,{count:subset.length,coef:inv.map(r=>dot(r,b)),inverse:inv}];
  }));
}
export function estimate(artifact,action,x,explore=0){
  const m=artifact?.arms[action];if(!m)return {mean:0,score:0,observations:0};
  const mean=dot(m.coef,x),variance=Math.max(0,dot(x,m.inverse.map(r=>dot(r,x))));
  return {mean,score:mean+explore*Math.sqrt(variance),observations:m.count};
}
export function trainBandit(observations,{cutoffDay,windowDays,actions}){
  const start=performance.now(),rows=observations.filter(r=>r.day<cutoffDay&&r.day>=cutoffDay-windowDays&&r.matures_day<=cutoffDay&&Number.isSafeInteger(r.reward_cents));
  if(rows.length<60)throw Error('INSUFFICIENT_MATURE_OBSERVATIONS');
  const days=[...new Set(rows.map(r=>r.day))].sort((a,b)=>a-b),split=days[Math.max(1,Math.floor(days.length*.8))]??cutoffDay;
  const train=rows.filter(r=>r.day<split),validation=rows.filter(r=>r.day>=split),candidate={arms:fit(train,actions)};
  const mean=train.reduce((s,r)=>s+r.reward_cents/100,0)/Math.max(1,train.length);
  const mse=validation.length?validation.reduce((s,r)=>s+(estimate(candidate,r.selected_action,JSON.parse(r.context_json)).mean-r.reward_cents/100)**2,0)/validation.length:null;
  const baselineMse=validation.length?validation.reduce((s,r)=>s+(mean-r.reward_cents/100)**2,0)/validation.length:null;
  return {type:'contextual_ridge_bandit',arms:fit(rows,actions),cutoffDay,windowDays,trainingRows:rows.length,validationRows:validation.length,mse,baselineMse,runtimeMs:performance.now()-start,features:['bias','recency_30d','purchases_7d','offers_7d','price_scale','observed_merchant_affinity','recent_refunds'],disclosure:'Chronological reward prediction check, not causal lift. Final coefficients refit on all mature training observations.'};
}
export function chooseBandit(artifact,candidates,{epsilon=.12,explore=.04,draw}){
  if(!candidates.length)throw Error('EMPTY_POLICY_ACTION_SET');
  const ranked=candidates.map(a=>({...a,...estimate(artifact,a.id,a.features,explore)})).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
  const exploreChoice=draw[0]<epsilon,chosen=exploreChoice?candidates[Math.min(candidates.length-1,Math.floor(draw[1]*candidates.length))]:ranked[0];
  return {...chosen,propensity:epsilon/candidates.length+(chosen.id===ranked[0].id?1-epsilon:0),ranked:ranked.map(a=>({id:a.id,score:a.score,observations:a.observations}))};
}
