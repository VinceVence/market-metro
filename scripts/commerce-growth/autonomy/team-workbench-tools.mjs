// Trusted demand, dataset, fitting and campaign tools. LLMs choose jobs and
// artifacts; they cannot write SQL, change the economy or create buyer funds.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
import {digest} from '../environment.mjs';
import {contactFeatures} from '../experiments/program.mjs';
import {RESPONSE_FIELDS,responseFeatures,predictResponse,predictContribution,predictSharedContribution} from './features.mjs';
import {inquiryEstimate} from './inquiry-expert.mjs';
import {fitFundingCalibration,fundingCohort,adjustForFunding} from './funding-calibration.mjs';
import {MARKET_FEEDBACK_FIELDS,SHOPPER_FEEDBACK_FIELDS,feedbackByRow,feedbackFeatures,observedFeedbackHistory} from './feedback-features.mjs';
import {EXPERT_STACK_FIELDS,trainExpertWorkbench} from './expert-stack.mjs';

export const CONTEXT_FIELDS=Object.freeze([...RESPONSE_FIELDS,'customer_intent_fresh','customer_intent_recent']);
export const RECIPES=Object.freeze(['forest','logistic','response_hurdle','boosted']);
export const FEATURE_VIEWS=Object.freeze({existing:RESPONSE_FIELDS,intent_context:CONTEXT_FIELDS,market_feedback:[...RESPONSE_FIELDS,...MARKET_FEEDBACK_FIELDS],shopper_feedback:[...RESPONSE_FIELDS,...SHOPPER_FEEDBACK_FIELDS],feedback:[...RESPONSE_FIELDS,...MARKET_FEEDBACK_FIELDS,...SHOPPER_FEEDBACK_FIELDS],expert_scores:EXPERT_STACK_FIELDS});
export const CAMPAIGNS=Object.freeze(['product_recommendations','intent_assistance','ranked_discovery','reactivation','open_discovery']);
const read=async p=>JSON.parse(await readFile(p,'utf8'));
export function datasetOverview(rows){
 return {observations:rows.length,sourceMarkets:new Set(rows.map(r=>r.episode)).size,responded:rows.filter(r=>r.responded).length,immediatelyAuthorized:rows.filter(r=>r.authorized).length,retained:rows.filter(r=>r.retained).length,
  retainedWithoutImmediateFunding:rows.filter(r=>r.retained&&!r.authorized).length,retainedWithoutResponse:rows.filter(r=>r.retained&&!r.responded).length,
  inquiryIntentFields:{inquiries:rows.filter(r=>r.kind==='ask_need').length,inquiriesWithPlaceholderAge:rows.filter(r=>r.kind==='ask_need'&&r.x[0]===99).length,availableContext:'observedBucket includes the shopper intent age before contact: fresh, recent or cold. It is available even when a general inquiry has no product SKU.'},
  availableFeatures:RESPONSE_FIELDS,label:'Retained purchase after complete settlement; immediate funding is an earlier event, not the final outcome.',scope:'Saved completed simulation history. Regime, seed, IDs and future outcomes are not predictors. Existing contact-policy selection makes these observational predictions, not causal uplift.'};
}
export function inspectDemand(rows,{lens,windowDays}){
 if(!['category','intent','payment_funnel','recency'].includes(lens)||![28,56,100].includes(windowDays))throw Error('INVALID_DEMAND_QUERY');
 const selected=rows.filter(r=>r.day>=Math.max(30,100-windowDays)),groups={};
 for(const r of selected){const bucket=r.observedBucket.split('|'),key=lens==='category'?bucket[1]:lens==='intent'?r.kind+'|'+bucket[2]:lens==='recency'?(r.x[8]===0?'new':r.x[7]>=14?'lapsed':'active'):r.kind,
   g=groups[key]??={contacts:0,responded:0,immediateFunding:0,retained:0,lateFundedPurchases:0,paymentNetUSD:0,retailerOrderContributionUSD:0};
  g.contacts++;g.responded+=r.responded;g.immediateFunding+=r.authorized;g.retained+=r.retained;g.lateFundedPurchases+=Number(r.retained&&!r.authorized);g.paymentNetUSD+=r.retailNetCents/100;g.retailerOrderContributionUSD+=r.merchantOrderContributionCents/100;
 }
 for(const g of Object.values(groups)){g.retainedRate=g.retained/g.contacts;g.paymentNetPerContactUSD=g.paymentNetUSD/g.contacts;}
 return {lens,windowDays,rows:selected.length,groups,evidenceId:digest({lens,windowDays,groups}),scope:'Observed contact funnel, conditional on historical outreach. Full order contribution is reported, not claimed incremental profit.'};
}
export function prepareTraining(rows,contract){
 if(!contract||!Object.hasOwn(FEATURE_VIEWS,contract.featureView)||contract.featureView==='expert_scores'||![28,56,100].includes(contract.windowDays))throw Error('INVALID_TRAINING_CONTRACT');
 if(rows.some(r=>r.x.length!==RESPONSE_FIELDS.length||r.x.some(v=>!Number.isFinite(v))))throw Error('INVALID_SOURCE_FEATURE_CONTRACT');
 const selected=rows.filter(r=>r.day>=Math.max(30,100-contract.windowDays));
 if(selected.length<500)throw Error('INSUFFICIENT_TRAINING_HISTORY');
 const feedbackValues=contract.featureView.endsWith('feedback')?feedbackByRow(rows):null,feedback=feedbackValues?new Map(rows.map((r,i)=>[r,feedbackValues[i]])):null;
 return {featureNames:FEATURE_VIEWS[contract.featureView],
  rows:selected.map(r=>({...r,x:contract.featureView==='intent_context'?[...r.x,Number(r.observedBucket.split('|')[2]==='fresh'),Number(r.observedBucket.split('|')[2]==='recent')]:feedback?[...r.x,...FEATURE_VIEWS[contract.featureView].slice(RESPONSE_FIELDS.length).map(k=>feedback.get(r)[k])]:[...r.x]}))};
}
export async function trainWorkbench(dir,rows,contract,family,expertResources=null){
 if(contract?.featureView==='expert_scores')return trainExpertWorkbench(dir,contract,family,expertResources);
 if(!RECIPES.includes(family))throw Error('INVALID_MODEL_RECIPE');
 await mkdir(dir);const data=prepareTraining(rows,contract),spec={family,...contract};
 await writeFile(dir+'/dataset.json',JSON.stringify(data));await writeFile(dir+'/spec.json',JSON.stringify(spec));
 await promisify(execFile)(resolve('.local/marketing-venv/bin/python'),[resolve('scripts/commerce-growth/autonomy/train-workbench.py'),resolve(dir)],{timeout:120000,maxBuffer:100000});
 const [artifact,report,parity]=await Promise.all([read(dir+'/models.json'),read(dir+'/report.json'),read(dir+'/parity.json')]);
 for(const r of parity){if(Math.abs(predictResponse(artifact.models[family],r.x,artifact.featureNames)-r.expected)>1e-9||Math.abs(predictSharedContribution(artifact,r.expected,r.x,r.kind,artifact.featureNames).expectedSharedNetCents-r.expectedSharedNetCents)>1e-7)throw Error('WORKBENCH_PREDICTION_PARITY_FAILED');}
 return {id:'MODEL-'+digest(artifact).slice(0,16),artifact,report,datasetHash:artifact.datasetHash,modelHash:digest(artifact)};
}
export function validateCampaign(c){
 if(!c||Object.keys(c).sort().join()!=='kind,objective'||!CAMPAIGNS.includes(c.kind)||!['paypal','joint','purchases'].includes(c.objective))throw Error('INVALID_CAMPAIGN_JOB');
 return Object.freeze({...c});
}
export function workbenchPlan(view,{model,campaign,prior,fundingPrior,configuration,inquiryPredictor=inquiryEstimate,weeklyProbe=false,recommendationJob=null,candidateMode='latest',allowUnfundedIntent=false}){
 if(!['latest','multiple'].includes(candidateMode))throw Error('INVALID_PRODUCT_CANDIDATE_MODE');
 validateCampaign(campaign);if(view.day<30||view.day>=view.marketDays)return {actions:[],ranking:[],configuration};
 if(recommendationJob&&(!['latest_interest','multiple_interests','trend_aware'].includes(recommendationJob.mode)||!['all','new','active','lapsed'].includes(recommendationJob.segment)||!['all',...new Set(view.products.map(p=>p.category))].includes(recommendationJob.category)||Object.values(recommendationJob.trendWeights||{}).some(w=>!Number.isFinite(w)||w<.5||w>1.5)))throw Error('INVALID_RECOMMENDATION_JOB');
 const limit=Math.min(view.outreach.rules.dailyContactLimit-view.outreach.contactsToday,Math.floor(Math.min(view.outreach.remainingBudgetCents,view.outreach.availablePlatformCashCents)/view.outreach.rules.outreachCostCents));
 if(limit<=0)return {actions:[],ranking:[],configuration};
 const people=new Map(view.audience.map(p=>[p.customerId,p])),calibration=fitFundingCalibration(view,fundingPrior),artifact=model.artifact,legacy=model.incumbent===true,
  usesFeedback=artifact.featureNames.some(k=>MARKET_FEEDBACK_FIELDS.includes(k)||SHOPPER_FEEDBACK_FIELDS.includes(k)),history=usesFeedback?observedFeedbackHistory(view):null;
 if(!Object.values(FEATURE_VIEWS).some(fields=>JSON.stringify(fields)===JSON.stringify(artifact.featureNames)))throw Error('UNKNOWN_MODEL_FEATURE_CONTRACT');
 const ranked=contactFeatures(view,prior,7,{allowUnfundedIntent}).filter(c=>{
  const person=people.get(c.action.customerId),signal=person.signal,age=signal?view.day-signal.day:99;
  if(recommendationJob){const segment=!person.purchaseCount?'new':person.lastPurchaseDay!=null&&view.day-person.lastPurchaseDay>=14?'lapsed':'active';if(c.action.kind!=='recommend'||recommendationJob.segment!=='all'&&segment!==recommendationJob.segment||recommendationJob.category!=='all'&&c.action.category!==recommendationJob.category)return false;}
  if(campaign.kind==='reactivation'&&(person.purchaseCount===0||person.lastPurchaseDay==null||view.day-person.lastPurchaseDay<14))return false;
  if(campaign.kind!=='reactivation'&&age>7&&!(campaign.kind==='open_discovery'&&c.action.kind==='ask_need'))return false;
  if(c.action.kind==='recommend')return (candidateMode==='multiple'||recommendationJob&&recommendationJob.mode!=='latest_interest'?c.features.age<=7:c.action.catalogId===signal?.catalogId)&&(c.features.stock>0||c.features.arrival_days<=5);
  return campaign.kind!=='product_recommendations'&&(campaign.kind!=='intent_assistance'||signal?.kind!=='SEARCH');
 }).map(c=>{
  const person=people.get(c.action.customerId),age=person.signal?view.day-person.signal.day:99,base=responseFeatures(view,c),values={...Object.fromEntries(RESPONSE_FIELDS.map((k,i)=>[k,base[i]])),customer_intent_fresh:Number(age<=2),customer_intent_recent:Number(age>2&&age<=7),...(usesFeedback?feedbackFeatures(history,view.day,c.action.customerId,c.action.kind):{})};
  if(artifact.incumbentArtifact){const a=artifact.incumbentArtifact;let p=c.action.kind==='ask_need'?inquiryEstimate(view,prior,c.action.customerId):predictContribution(a,a.selected,base,c.action.kind);if(c.action.kind==='recommend')p=adjustForFunding(p,calibration,fundingCohort(view,c.action),a.valueMeans[c.action.kind].failedNetCents);values.incumbent_probability=p.probability;}
  const x=artifact.featureNames.map(k=>values[k]);
 let estimate=legacy&&c.action.kind==='ask_need'?inquiryPredictor(view,prior,c.action.customerId):predictContribution(artifact,artifact.selected,x,c.action.kind,artifact.featureNames);
  // Feedback-aware models learn this state from historical observations.
  // Applying the external funding odds shift again would double-adjust them.
  if(c.action.kind==='recommend'&&!usesFeedback)estimate=adjustForFunding(estimate,calibration,fundingCohort(view,c.action),artifact.valueMeans[c.action.kind].failedNetCents);
  const joint=predictSharedContribution(artifact,estimate.probability,x,c.action.kind,artifact.featureNames).expectedSharedNetCents;
  const trendWeight=recommendationJob?.mode==='trend_aware'?recommendationJob.trendWeights[c.action.category]??1:1;
  return {...c,...estimate,expectedSharedNetCents:joint,score:(campaign.objective==='paypal'?estimate.expectedNetCents:campaign.objective==='purchases'?estimate.probability:joint)*trendWeight,...(recommendationJob?{trendWeight}:{})};
 });
 let eligible=ranked.filter(c=>c.expectedNetCents>0&&c.expectedSharedNetCents>c.expectedNetCents).sort((a,b)=>b.score-a.score||a.action.customerId.localeCompare(b.action.customerId));
 // A bounded probe can detect recovery when the current posterior rejects all
 // contacts. It spends the same existing budget; it never creates funds.
 const lastInquiry=Math.max(-100,...view.outreach.history.filter(c=>c.day<view.day&&c.kind==='ask_need').map(c=>c.day));
 if(weeklyProbe&&!eligible.length&&view.day-lastInquiry>=7)eligible=ranked.filter(c=>c.action.kind==='ask_need'&&(c.probeNetCents??c.upperNetCents)>0&&c.expectedSharedNetCents>c.expectedNetCents).sort((a,b)=>(b.probeNetCents??b.upperNetCents)-(a.probeNetCents??a.upperNetCents)||a.action.customerId.localeCompare(b.action.customerId)).slice(0,1).map(c=>({...c,isProbe:true}));
 const selected=[],seen=new Set();for(const r of eligible){if(seen.has(r.action.customerId))continue;seen.add(r.action.customerId);selected.push(r);if(selected.length>=limit)break;}
 return {actions:selected.map(r=>r.action),ranking:selected.map(r=>({customerId:r.action.customerId,catalogId:r.action.catalogId,kind:r.action.kind,probability:r.probability,expectedNetCents:r.expectedNetCents,expectedMerchantNetCents:r.expectedSharedNetCents-r.expectedNetCents,score:r.score,modelId:model.id,...(recommendationJob?{trendWeight:r.trendWeight,signalAgeDays:r.features.age}:{}),...(inquiryPredictor!==inquiryEstimate&&r.action.kind==='ask_need'?{observedContacts:r.observedContacts,matureContacts:r.matureContacts,pendingResponders:r.pendingResponders,isProbe:!!r.isProbe}:{})})),configuration,
  ...(recommendationJob?{candidateDiagnostics:{scoredProducts:ranked.length,positiveValueProducts:eligible.length,selectedShoppers:selected.length,recipe:recommendationJob}}:{}),
  reason:campaign.kind.replaceAll('_',' ')+': execute the selected fitted '+artifact.selected+' model using the analyst dataset contract.',
  agentCheckpoint:digest({modelHash:model.modelHash,campaign}),model:{id:model.id,type:artifact.selected,rows:artifact.trainingRows,cutoffDay:view.day}};
}
