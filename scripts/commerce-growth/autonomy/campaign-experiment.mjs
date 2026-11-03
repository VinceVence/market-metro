// Model-authored campaigns can change contact choice, not the economy or money.
// Both the single planner and specialist team use this exact local tool.
import {validateExpression,calculate,contactFeatures,field as f,op as o} from '../experiments/program.mjs';
import {digest} from '../environment.mjs';
import {responseFeatures,predictContribution,predictSharedContribution} from './features.mjs';
import {inquiryEstimate} from './inquiry-expert.mjs';
import {fitFundingCalibration,fundingCohort,adjustForFunding} from './funding-calibration.mjs';

export const CAMPAIGN_FIELDS=Object.freeze(['age','search','signal_count','category_affinity','price_usd','stock','arrival_days','recency','prior_purchases','response_rate','local_response_rate','local_sample_count','expected_net_usd','is_recommendation','interest_age','latest_search','latest_product','ml_probability','ml_paypal_net_usd','ml_merchant_net_usd','ml_joint_net_usd']);
export const NUMERICAL_CAMPAIGN=Object.freeze({limit:10,
 gate:o('and',o('lte',f('interest_age'),7),o('gt',f('ml_paypal_net_usd'),0),o('gt',f('ml_merchant_net_usd'),0),
  o('if',f('is_recommendation'),o('and',f('latest_product'),o('lte',f('arrival_days'),5)),o('lte',f('latest_search'),0))),
 score:f('ml_joint_net_usd')});

export function compileCampaign(raw){
 if(!raw||Object.keys(raw).sort().join()!=='gate,limit,score'||!Number.isInteger(raw.limit)||raw.limit<1||raw.limit>10)throw Error('INVALID_CAMPAIGN');
 const budget={nodes:0};
 for(const expression of [raw.gate,raw.score])validateExpression(expression,'contact',budget,0,CAMPAIGN_FIELDS);
 if(budget.nodes>100)throw Error('CAMPAIGN_COMPLEXITY_LIMIT');
 const canonical=x=>typeof x==='number'?x:x.field?{field:x.field}:{op:x.op,args:x.args.map(canonical)},program={gate:canonical(raw.gate),score:canonical(raw.score),limit:raw.limit};
 const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
 return Object.freeze({program:freeze(program),hash:digest(program),nodes:budget.nodes});
}

export function campaignCandidates(view,{prior,artifact,fundingPrior}){
 const calibration=fitFundingCalibration(view,fundingPrior),people=new Map(view.audience.map(p=>[p.customerId,p]));
 return contactFeatures(view,prior,7).map(c=>{
  const person=people.get(c.action.customerId),signal=person.signal,x=responseFeatures(view,c);
  let estimate=c.action.kind==='ask_need'?inquiryEstimate(view,prior,c.action.customerId):predictContribution(artifact,artifact.selected,x,c.action.kind);
  if(c.action.kind==='recommend')estimate=adjustForFunding(estimate,calibration,fundingCohort(view,c.action),artifact.valueMeans[c.action.kind].failedNetCents);
  const joint=predictSharedContribution(artifact,estimate.probability,x,c.action.kind).expectedSharedNetCents;
  return {...c,features:{...c.features,interest_age:signal?view.day-signal.day:99,latest_search:Number(signal?.kind==='SEARCH'),latest_product:Number(c.action.catalogId!==null&&c.action.catalogId===signal?.catalogId),ml_probability:estimate.probability,ml_paypal_net_usd:estimate.expectedNetCents/100,ml_merchant_net_usd:(joint-estimate.expectedNetCents)/100,ml_joint_net_usd:joint/100}};
 });
}

export function campaignPlan(view,compiled,resources,configuration){
 if(view.day<30||view.day>=view.marketDays)return {actions:[],ranking:[],configuration};
 const n=Math.min(compiled.program.limit,view.outreach.rules.dailyContactLimit-view.outreach.contactsToday,Math.floor(Math.min(view.outreach.remainingBudgetCents,view.outreach.availablePlatformCashCents)/view.outreach.rules.outreachCostCents));
 if(n<=0)return {actions:[],ranking:[],configuration};
 const rows=campaignCandidates(view,resources).filter(r=>calculate(compiled.program.gate,r.features)>0).map(r=>({...r,score:calculate(compiled.program.score,r.features)})).filter(r=>r.score>0).sort((a,b)=>b.score-a.score||a.action.customerId.localeCompare(b.action.customerId)||String(a.action.catalogId).localeCompare(String(b.action.catalogId))),selected=[],seen=new Set();
 for(const r of rows){if(seen.has(r.action.customerId))continue;seen.add(r.action.customerId);selected.push(r);if(selected.length>=n)break;}
 return {actions:selected.map(r=>r.action),ranking:selected.map(r=>({customerId:r.action.customerId,catalogId:r.action.catalogId,kind:r.action.kind,score:r.score,features:r.features})),configuration,
  reason:'Execute the exact tested campaign expression over observed interest, local feedback and trained model estimates.',agentCheckpoint:compiled.hash,
  model:{id:resources.artifact.version,type:'Shared local models and observed funding calibration',rows:resources.artifact.trainingRows,cutoffDay:view.day}};
}

export function selectMeasuredCampaign(choice,artifacts,{requireGain=true}={}){
 const selected=artifacts[choice.selected];if(!selected||choice.programHash!==selected.programHash||choice.measurementHash!==digest(selected.measurement))throw Error('UNBOUND_CAMPAIGN_SELECTION');
 const m=selected.measurement;
 if(m.unpaidLiabilities!==0||requireGain&&(m.platformDeltaUSD<=0||m.retailerDeltaUSD<0))return {selected:'fixed',reason:'Measured campaign failed the aggregate payment/retailer guard; keep fixed.',requested:choice.selected};
 return {selected:choice.selected,programHash:selected.programHash,measurementHash:choice.measurementHash,reason:choice.rationale};
}
