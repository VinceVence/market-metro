// Cost-aware inquiry control using an existing fitted response-hurdle prior.
// No scenario labels, latent needs, hidden wallets or future outcomes.
import {readFile} from 'node:fs/promises';import {digest} from '../environment.mjs';
import {runCoordinatedCase} from '../team/runner.mjs';
export const RESPONSE_MODEL_PATH='docs/commerce-growth/baseline-v1-challenger-4/team/model-0.json';
export async function responseBudgetModel(){const m=JSON.parse(await readFile(RESPONSE_MODEL_PATH,'utf8'));if(digest(m.artifact)!==m.modelHash||m.artifact.spec.recipe!=='response_hurdle')throw Error('INVALID_RESPONSE_BUDGET_MODEL');return m;}
export function responseBudgetEvidence(view,model){
 const history=view.outreach.history.filter(c=>c.day<view.day),inquiries=history.filter(c=>c.kind==='ask_need'),replySeen=history.some(c=>c.responded),g=model.artifact.all,S=model.artifact.strength,cost=view.outreach.rules.outreachCostCents;
 const responses=inquiries.filter(c=>c.responded).length,p=(S*g.responseRate+responses)/(S+inquiries.length),optimistic=Math.min(1,p+2*Math.sqrt(p*(1-p)/(S+inquiries.length+1))),given=g.conditionalRetention*g.retainedNetCents+(1-g.conditionalRetention)*g.failedResponseNetCents,optimisticNetCents=optimistic*given+(1-optimistic)*(-cost),lastInquiry=Math.max(-100,...inquiries.map(c=>c.day));
 return {asOfDay:view.day,observedInquiries:inquiries.length,observedInquiryReplies:responses,anyMarketingReplySeen:replySeen,responseProbability:p,optimisticResponseProbability:optimistic,expectedNetGivenReplyCents:given,optimisticInquiryNetCents:optimisticNetCents,pauseGeneralInquiries:inquiries.length>0&&!replySeen&&optimisticNetCents<=0,probeDue:view.day-lastInquiry>=view.outreach.rules.customerContactGapDays,scope:'Fitted empirical-Bayes response prior plus current observed replies. Two posterior standard deviations are an optimistic heuristic, not a calibrated95% guarantee. No-reply status is observed, not inferred from immature purchase labels.'};
}
export function responseBudgetPlan(view,r,model){
 const base=r.baselineController.plan(view),evidence=responseBudgetEvidence(view,model);let probeUsed=false;
 const keep=base.actions.map(a=>{if(!evidence.pauseGeneralInquiries||a.kind!=='ask_need')return true;if(evidence.probeDue&&!probeUsed){probeUsed=true;return true;}return false;}),actions=base.actions.filter((_,i)=>keep[i]),ranking=base.ranking.filter((_,i)=>keep[i]);
 return {...base,actions,ranking,reason:evidence.pauseGeneralInquiries?'Retain product recommendations; suppress routine general inquiries after no observed replies and negative optimistic inquiry value. One recovery inquiry is permitted per existing contact-gap interval.':'Keep v1: observed replies or uncertainty do not justify reducing general outreach.',agentCheckpoint:digest({policy:'response-budget-1',model:model.modelHash}),budgetReview:{...evidence,suppressedInquiries:keep.filter(v=>!v).length,probeSent:probeUsed,keptRecommendations:actions.filter(a=>a.kind==='recommend').length}};
}
export async function runResponseBudget(settings,r,allocator,{trace=false,model}={}){
 model??=await responseBudgetModel();const reviews=[];
 const result=await runCoordinatedCase(settings,{id:'response-budget',config:r.fixed.config},{allocator,prior:r.prior,trace,controller:{plan(view){const p=responseBudgetPlan(view,r,model);if(p.budgetReview.pauseGeneralInquiries)reviews.push(p.budgetReview);return p;}},commerceExecutor:(w,_c,a,key)=>r.executeCommerce(w,r.funded,r.prior,a,key)});
 return {...result,budgetReviews:reviews,diagnostics:{suppressedInquiries:reviews.reduce((s,r)=>s+r.suppressedInquiries,0),recoveryProbes:reviews.filter(r=>r.probeSent).length,modelHash:model.modelHash},scope:'Original v1 product choice and fulfillment retained. Only paid general-inquiry frequency responds to observed no-reply evidence and the existing learned value prior.'};
}
