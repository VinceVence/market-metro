// Fast local adaptation from observed funding outcomes. This is a fitted
// base-rate adjustment, not a claim of causal lift or guaranteed conversion.
import {digest} from '../environment.mjs';
export function fundingCohort(view,action){
 const person=view.audience.find(p=>p.customerId===action.customerId),signal=person?.signal;
 const age=signal&&signal.day<=view.day?view.day-signal.day:99;
 return action.kind+'|'+(age<=2?'fresh':age<=7?'recent':'cold');
}
export function fitFundingCalibration(view,prior,{windowDays=28,strength=8}={}){
 if(!prior?.groups||!Number.isInteger(windowDays)||windowDays<1||!Number.isFinite(strength)||strength<=0)throw Error('INVALID_FUNDING_CALIBRATION');
 const groups={};let rows=0;
 for(const [key,g]of Object.entries(prior.groups)){
  if(!Number.isInteger(g.contacts)||!Number.isInteger(g.funded)||g.funded<0||g.funded>g.contacts)throw Error('INVALID_FUNDING_PRIOR');
  groups[key]={historicalContacts:g.contacts,historicalRate:(g.funded+.5)/(g.contacts+1),contacts:0,funded:0};
 }
 for(const c of view.outreach.history){
  if(c.day>=view.day||c.day<view.day-windowDays)continue;
  const key=c.kind+'|'+c.observedBucket.split('|')[2],g=groups[key];if(!g)continue;
  g.contacts++;g.funded+=Number(Boolean(c.authorized));rows++;
 }
 for(const g of Object.values(groups))g.fundingRate=(strength*g.historicalRate+g.funded)/(strength+g.contacts);
 const result={priorVersion:prior.version,asOfDay:view.day,windowDays,strength,rows,groups,
  scope:'Prior-day observed funding outcomes. Funding is an earlier signal than retained payment; the odds adjustment is a modeling assumption, not a causal effect.'};
 return {...result,id:'FUNDING-'+digest(result).slice(0,16)};
}
export function adjustForFunding(estimate,calibration,key,failedNetCents){
 const g=calibration.groups[key];if(!g||!g.contacts||estimate.probability<=0||estimate.probability>=1)return {...estimate,calibration:{id:calibration.id,cohort:key,contacts:g?.contacts||0,logOddsShift:0}};
 const logit=p=>Math.log(p/(1-p)),shift=logit(g.fundingRate)-logit(g.historicalRate),probability=1/(1+Math.exp(-(logit(estimate.probability)+shift))),
  expectedNetCents=failedNetCents+(estimate.expectedNetCents-failedNetCents)*probability/estimate.probability;
 if(!Number.isFinite(expectedNetCents)||!Number.isFinite(probability))throw Error('INVALID_CALIBRATED_SCORE');
 return {...estimate,probability,expectedNetCents,calibration:{id:calibration.id,cohort:key,contacts:g.contacts,funded:g.funded,historicalFundingRate:g.historicalRate,currentFundingRate:g.fundingRate,baseProbability:estimate.probability,logOddsShift:shift}};
}

// Evaluation only, after the settlement tail. These labels never feed a
// pre-contact prediction or an application-agent prompt before maturation.
export function evaluateFundingPredictions(decisions,contacts,orders){
 const byContact=new Map(contacts.map(c=>[[c.day,c.customerId,c.catalogId,c.kind].join('|'),c])),byRequest=new Map(orders.map(o=>[o.requestId,o])),rows=[];
 for(const d of decisions)for(const rank of d.ranking||[]){
  if(!Number.isFinite(rank.calibration?.baseProbability))continue;
  const c=byContact.get([d.day,rank.customerId,rank.catalogId,'recommend'].join('|'));if(!c)continue;
  const order=byRequest.get(c.requestId),retained=Number(Boolean(order&&!['SETTLED','PENDING_FUNDS'].includes(order.refundStatus)));
  rows.push({day:d.day,customerId:c.customerId,baseProbability:rank.calibration.baseProbability,adaptedProbability:rank.probability,retained,priorContacts:rank.calibration.contacts,funded:rank.calibration.funded,orderId:order?.id||null});
 }
 const metrics=field=>({brier:rows.length?rows.reduce((s,r)=>s+(r[field]-r.retained)**2,0)/rows.length:null,logLoss:rows.length?rows.reduce((s,r)=>{const p=Math.max(1e-9,Math.min(1-1e-9,r[field]));return s-r.retained*Math.log(p)-(1-r.retained)*Math.log(1-p);},0)/rows.length:null}),base=metrics('baseProbability'),adapted=metrics('adaptedProbability');
 return {observations:rows.length,base,adapted,brierReduction:base.brier>0?1-adapted.brier/base.brier:null,
  examples:[...rows].sort((a,b)=>Math.abs(b.adaptedProbability-b.baseProbability)-Math.abs(a.adaptedProbability-a.baseProbability)).slice(0,3),
  scope:'Predictions recorded before each contact; outcomes assessed after settlement. Same issued contacts, not a randomized causal campaign comparison.'};
}
