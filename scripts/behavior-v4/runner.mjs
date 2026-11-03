import {createWorld,stepWorld,outcome,assertIntegrity,frame} from './engine.mjs';
import {compilePolicy,train,publicEvidence} from './policies.mjs';
export function createRunner(input){
 const w=createWorld(input),policy=input.policy||'none';let chooser=()=>null;
 return {world:w,step(){
  if(w.tick>=30&&w.tick<w.behavior.campaignStop){
   if((w.tick-30)%14===0){const m=train(w),e=publicEvidence(w);w.behavior.decisions.push({day:w.tick,role:'Data scientist',actor:'LOCAL_MODEL_TRAINING',decision:'FIT_AND_VALIDATE_RECOMMENDER',modelId:m.id,known:{recentOrders:e.recentOrders,previousOrders:e.previousOrders,lapsed:e.observedLapsed,modelRecall:m.candidateRecall,popularityRecall:m.baselineRecall},reason:m.reason});}
   chooser=compilePolicy(w,policy);
  }else chooser=()=>null;
  return stepWorld(w,chooser);
 },result(){assertIntegrity(w);if(w.tick!==w.totalTicks)throw Error('UNFINISHED_BEHAVIOR_RUN');return {policy,seed:w.seed,scenario:w.scenario,response:w.behavior.response,ongoing:outcome(w,w.behavior.campaignStop),durable:outcome(w),models:w.behavior.models.map(({artifact,...m})=>m),integrity:true};},evidence:()=>publicEvidence(w),frame:()=>frame(w)};
}
export function run(input){const r=createRunner(input);while(r.world.tick<r.world.totalTicks)r.step();return r.result();}
