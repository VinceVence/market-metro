// Local empirical-Bayes learning separates an immediately observed response
// from a purchase label that needs settlement. Pending responders are censored,
// not relabeled as failures. No seed, regime or shopper ID is a predictor.
import {digest} from '../environment.mjs';
import {predictionMetrics} from './prediction-metrics.mjs';
export const MATURITY_SPECS=Object.freeze({grouping:['intent','intent_status'],recipe:['response_hurdle','mature_reward']});
export function validateMaturitySpec(s){if(!s||Object.keys(s).sort().join()!=='grouping,recipe'||!MATURITY_SPECS.grouping.includes(s.grouping)||!MATURITY_SPECS.recipe.includes(s.recipe))throw Error('INVALID_MATURITY_SPEC');return {grouping:s.grouping,recipe:s.recipe};}
const key=(bucket,grouping)=>bucket.split('|').filter((_,i)=>i===2||grouping==='intent_status'&&i===3).join('|');
function aggregate(rows){
 const n=rows.length,responses=rows.filter(r=>r.responded),yes=responses.filter(r=>r.retained),no=responses.filter(r=>!r.retained),mean=(a,k,fallback)=>a.length?a.reduce((s,r)=>s+r[k],0)/a.length:fallback;
 return {n,responseCount:responses.length,retained:yes.length,responseRate:(responses.length+.5)/(n+1),conditionalRetention:(yes.length+.5)/(responses.length+1),retentionRate:(yes.length+.5)/(n+1),retainedNetCents:mean(yes,'retailNetCents',0),failedResponseNetCents:mean(no,'retailNetCents',-5),meanNetCents:mean(rows,'retailNetCents',-5)};
}
function priors(rows,grouping){const all=aggregate(rows),groups={};for(const k of new Set(rows.map(r=>key(r.observedBucket,grouping)))){const group=rows.filter(r=>key(r.observedBucket,grouping)===k);groups[k]=group.length>=20?aggregate(group):all;}return {all,groups};}
export function predictMaturity(artifact,bucket,history,day,costCents=5){
 const cohort=key(bucket,artifact.spec.grouping),g=artifact.groups[cohort]??artifact.all,S=artifact.strength,
  past=history.filter(c=>c.kind==='ask_need'&&c.day<day&&key(c.observedBucket,artifact.spec.grouping)===cohort),mature=past.filter(c=>c.labelCompleteDay<day);
 let probability,expectedNetCents,upperNetCents,cautiousNetCents,responseProbability=null;
 if(artifact.spec.recipe==='mature_reward'){
  probability=(S*g.retentionRate+mature.reduce((s,c)=>s+c.retained,0))/(S+mature.length);
  expectedNetCents=(S*g.meanNetCents+mature.reduce((s,c)=>s+c.retailNetCents,0))/(S+mature.length);
  const variance=probability*(1-probability)/(S+mature.length+1),upper=Math.min(1,probability+Math.sqrt(variance));
  upperNetCents=upper*g.retainedNetCents+(1-upper)*(-costCents);
  const cautious=Math.min(1,probability+2*Math.sqrt(variance));cautiousNetCents=cautious*g.retainedNetCents+(1-cautious)*(-costCents);
 }else{
  const responded=past.filter(c=>c.responded),resolved=mature.filter(c=>c.responded),retained=resolved.filter(c=>c.retained),failed=resolved.filter(c=>!c.retained);
  responseProbability=(S*g.responseRate+responded.length)/(S+past.length);
  const conditional=(S*g.conditionalRetention+retained.length)/(S+resolved.length),retainedValue=(S*g.retainedNetCents+retained.reduce((s,c)=>s+c.retailNetCents,0))/(S+retained.length),failedValue=(S*g.failedResponseNetCents+failed.reduce((s,c)=>s+c.retailNetCents,0))/(S+failed.length),given=conditional*retainedValue+(1-conditional)*failedValue;
  probability=responseProbability*conditional;expectedNetCents=responseProbability*given+(1-responseProbability)*(-costCents);
  const upperResponse=Math.min(1,responseProbability+Math.sqrt(responseProbability*(1-responseProbability)/(S+past.length+1)));
  upperNetCents=upperResponse*given+(1-upperResponse)*(-costCents);
  const cautious=Math.min(1,responseProbability+2*Math.sqrt(responseProbability*(1-responseProbability)/(S+past.length+1)));cautiousNetCents=cautious*given+(1-cautious)*(-costCents);
 }
 if([probability,expectedNetCents,upperNetCents].some(v=>!Number.isFinite(v)))throw Error('INVALID_MATURITY_PREDICTION');
 return {probability,expectedNetCents,upperNetCents,cautiousNetCents,responseProbability,cohort,observedContacts:past.length,matureContacts:mature.length,pendingResponders:past.filter(c=>c.responded&&c.labelCompleteDay>=day).length};
}
export function trainMaturity(rows,rawSpec){
 const spec=validateMaturitySpec(rawSpec),data=rows.filter(r=>r.kind==='ask_need'),markets=[...new Set(data.map(r=>r.episode))];if(markets.length<3||data.length<200)throw Error('INSUFFICIENT_MATURITY_TRAINING');
 if(data.some(r=>r.retained&&!r.responded))throw Error('RESPONSE_TARGET_CONTRACT_FAILED');
 const trials=[];for(const strength of [8,32,128]){const scored=[];for(const market of markets){const training=data.filter(r=>r.episode!==market),held=data.filter(r=>r.episode===market),model={spec,strength,...priors(training,spec.grouping)};
   for(const policy of new Set(held.map(r=>r.sourcePolicy))){const history=held.filter(r=>r.sourcePolicy===policy);for(const r of history){const p=predictMaturity(model,r.observedBucket,history,r.day);scored.push({market,y:r.retained,p:p.probability});}}
  }trials.push({strength,metrics:predictionMetrics(scored)});}
 const best=trials.toSorted((a,b)=>a.metrics.logLoss-b.metrics.logLoss||a.strength-b.strength)[0],artifact={version:'inquiry-maturity-1',spec,strength:best.strength,...priors(data,spec.grouping),trainingRows:data.length,trainingMarkets:markets,datasetHash:digest(data)},
 report={spec,selectedStrength:best.strength,trainingRows:data.length,markets:markets.length,metrics:best.metrics,trials:trials.map(t=>({strength:t.strength,metrics:{auc:t.metrics.auc,brier:t.metrics.brier,logLoss:t.metrics.logLoss}})),scope:'Whole-source-market validation; each held-out collection trajectory learns only prior-day responses and matured financial outcomes. Conditional prediction, not causal uplift.'};
 return {id:'MATURITY-'+digest(artifact).slice(0,16),modelHash:digest(artifact),artifact,report};
}
export function inquiryHistory(view){
 const orders=new Map(view.pastOrders.filter(o=>o.day<view.day).map(o=>[o.requestId,o]));
 return view.outreach.history.filter(c=>c.day<view.day&&c.kind==='ask_need').map(c=>{const matured=c.day+26<view.day,o=matured?orders.get(c.requestId):null,retained=Number(Boolean(o&&!['SETTLED','PENDING_FUNDS'].includes(o.refundStatus)));
  return {day:c.day,kind:c.kind,observedBucket:c.observedBucket,responded:Number(c.responded),labelCompleteDay:c.day+26,...(matured?{retained,retailNetCents:(o?(retained?o.feeCents:0)-o.processingCents:0)-c.costCents}:{})};
 });
}
export function maturityPredictor(view,artifact){
 const history=inquiryHistory(view),people=new Map(view.audience.map(p=>[p.customerId,p]));
 return (_view,_prior,id)=>{const p=people.get(id);if(!p)throw Error('UNOBSERVED_SHOPPER');const age=p.signal?view.day-p.signal.day:99,bucket=['ask_need','*',age<=2?'fresh':age<=7?'recent':'cold',p.purchaseCount>0?'returning':'new'].join('|');return predictMaturity(artifact,bucket,history,view.day,view.outreach.rules.outreachCostCents);};
}
