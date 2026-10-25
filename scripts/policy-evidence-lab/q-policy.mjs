import {predict} from './features.mjs';

export function predictQComponent(model,x){
  if(model.kind!=='extra_trees')return predict(model,x)[0];
  let total=0;for(const tree of model.trees){let node=0;while(tree.left[node]!==-1)node=Math.fround(x[tree.feature[node]])<=tree.threshold[node]?tree.left[node]:tree.right[node];total+=tree.value[node][0];}return total/model.trees.length;
}
export function qValues(model,stage,state,candidateCount){
  const observed=model.definition.history?state:state.slice(0,24),components=model.stages[String(stage)];
  if(!components)throw Error('INVALID_Q_STAGE');
  return Array.from({length:candidateCount},(_,action)=>{
    const x=[...observed,...Array.from({length:candidateCount},(_,i)=>Number(i===action))];
    const platform=predictQComponent(components.platform,x),merchant=predictQComponent(components.merchant,x);
    if(!Number.isFinite(platform)||!Number.isFinite(merchant))throw Error('INVALID_Q_VALUE');
    return {action,platform,merchant};
  });
}
export function chooseQ(values){
  if(!values.length||values[0].action!==0)throw Error('WAIT_ACTION_REQUIRED');
  const micros=x=>Math.floor(x*1e6+.5);
  return [...values].filter(q=>micros(q.merchant)>=micros(values[0].merchant)).sort((a,b)=>micros(b.platform)-micros(a.platform)||a.action-b.action)[0].action;
}
