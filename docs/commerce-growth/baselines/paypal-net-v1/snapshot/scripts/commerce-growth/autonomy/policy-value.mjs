// Policy-value experiments operate on historical simulator copies. Runtime
// agents receive only contextFeatures(view), never a private world or rollout.
import {readFile} from 'node:fs/promises';
import {warmGrowthWorld} from '../evaluate.mjs';
import {beginGrowthDay,endGrowthDay,observeGrowthWorld,contactCustomer,assertGrowthIntegrity,digest} from '../environment.mjs';
import {balances,settledPlatformNet} from '../../commerce-deadlines/evaluate.mjs';
import {fulfill,outreachPlan} from '../team/control.mjs';
import {workbenchPlan} from './team-workbench-tools.mjs';
export const VALUE_ACTIONS=Object.freeze(['continue_numerical','fixed_recommendations','expert_discovery','observe']);
export const VALUE_FIELDS=Object.freeze(['response_rate','authorization_rate','contacts_log','organic_order_ratio','interest_share','stock_share','unresolved_authorized','mean_paid_usd','predicted_payment_net_usd','predicted_retention']);
export async function valueResources(){const read=async p=>JSON.parse(await readFile(p,'utf8')),incumbent=await read('docs/commerce-growth/autonomy-1/shared-value-training-1/models.json'),expert=await read('docs/commerce-growth/roc-net-goal-1/pilot-2/team/fit-0/models.json');
 if(expert.selected!=='expert_stack'||expert.models.expert_stack.stack.mode!=='pooled')throw Error('EXPECTED_FROZEN_POOLED_EXPERT');
 return {fixed:(await read('docs/commerce-growth/team-1/development/results.json')).selectedFixed,prior:await read('docs/commerce-growth/team-1/training/model.json'),fundingPrior:await read('docs/commerce-growth/autonomy-1/funding-training/funding-prior.json'),incumbent:{id:'VALUE-INCUMBENT',modelHash:digest(incumbent),artifact:incumbent,incumbent:true},expert:{id:'VALUE-EXPERT',modelHash:digest(expert),artifact:expert}};
}
export function actionPlan(view,action,r){
 if(!VALUE_ACTIONS.includes(action))throw Error('INVALID_VALUE_ACTION');
 if(action==='observe')return {actions:[],ranking:[],configuration:r.fixed.config,reason:'Pause new outreach while organic shopping, fulfillment and settlement continue.'};
 if(action==='fixed_recommendations')return {...outreachPlan(view,r.fixed.config,r.prior),configuration:r.fixed.config};
 return workbenchPlan(view,{model:action==='continue_numerical'?r.incumbent:r.expert,campaign:{kind:action==='continue_numerical'?'intent_assistance':'ranked_discovery',objective:'joint'},prior:r.prior,fundingPrior:r.fundingPrior,configuration:r.fixed.config});
}
async function turn(w,action,r,allocator,key,observer=null){
 if(!w.dayStarted)beginGrowthDay(w);const view=observeGrowthWorld(w),proposal=actionPlan(view,action,r),copy=structuredClone(w);observer?.(view,proposal);
 for(const [i,a]of proposal.actions.entries())contactCustomer(copy,{...a,key:key+':contact:'+w.day+':'+i});Object.assign(w,copy);
 await fulfill(w,r.fixed.config,allocator,key);endGrowthDay(w);assertGrowthIntegrity(w);
}
export async function policyPrefix(settings,r,allocator,reviewDay=45,observer=null){
 if(!Number.isInteger(reviewDay)||reviewDay<30||reviewDay>=100)throw Error('INVALID_REVIEW_DAY');
 const w=warmGrowthWorld(settings),opening=balances(w),initialHash=digest(w);
 while(w.day<reviewDay)await turn(w,'continue_numerical',r,allocator,'value-prefix',observer);
 beginGrowthDay(w);return {w,opening,initialHash,entryHash:digest(w)};
}
export function contextFeatures(view,r){
 const contacts=view.outreach.history.filter(c=>c.day<view.day&&c.day>=view.day-15),contactRequests=new Set(view.outreach.history.filter(c=>c.day<view.day).map(c=>c.requestId)),orders=view.pastOrders.filter(o=>o.day<view.day),warm=orders.filter(o=>o.day<30),recent=orders.filter(o=>o.day>=view.day-15),organic=recent.filter(o=>!contactRequests.has(o.requestId)),eligible=new Set(view.signals.filter(s=>s.day<=view.day&&s.day>=view.day-7).map(s=>s.customerId)),forecast=actionPlan(view,'expert_discovery',r),values={
  response_rate:(1+contacts.filter(c=>c.responded).length)/(4+contacts.length),authorization_rate:(1+contacts.filter(c=>c.authorized).length)/(4+contacts.length),contacts_log:Math.log1p(contacts.length),
  organic_order_ratio:(organic.length+1)/(warm.length/30*15+1),interest_share:eligible.size/Math.max(1,view.audience.length),stock_share:view.products.filter(p=>p.available>0).length/view.products.length,
  unresolved_authorized:view.requests.filter(q=>q.status==='AUTHORIZED').length,mean_paid_usd:recent.length?recent.reduce((s,o)=>s+o.grossCents,0)/recent.length/100:0,
  predicted_payment_net_usd:(forecast.ranking||[]).reduce((s,p)=>s+p.expectedNetCents,0)/100,predicted_retention:forecast.ranking?.length?forecast.ranking.reduce((s,p)=>s+p.probability,0)/forecast.ranking.length:0};
 const x=VALUE_FIELDS.map(k=>values[k]);if(x.some(v=>!Number.isFinite(v)))throw Error('INVALID_PUBLIC_VALUE_FEATURE');
 return {asOfDay:view.day,featureNames:VALUE_FIELDS,values,x,evidenceId:digest({day:view.day,values}),scope:'Observed prior contacts and payments, current interest/inventory and frozen model forecasts. No private need pool, seed, regime, wallets or future outcomes.'};
}
export function valueVector(context){
 const v=context.values,n=Math.expm1(v.contacts_log);
 return [...context.x,Math.round(v.response_rate*(n+4)-1),Math.round(v.authorization_rate*(n+4)-1)];
}
export function predictPolicyValues(model,context){
 const expected=[...VALUE_FIELDS,'observed_response_count','observed_authorization_count'];if(JSON.stringify(model.featureNames)!==JSON.stringify(expected))throw Error('INVALID_POLICY_VALUE_FEATURE_CONTRACT');
 const x=valueVector(context),predictions={continue_numerical:[0,0]};
 for(const [action,h]of Object.entries(model.heads)){
  if(!VALUE_ACTIONS.includes(action))throw Error('UNKNOWN_VALUE_MODEL_ACTION');
  if(h.type==='ridge'){const z=x.map((v,i)=>(v-h.mean[i])/h.scale[i]);predictions[action]=h.coefficients.map((b,i)=>h.intercept[i]+b.reduce((s,c,j)=>s+c*z[j],0));}
  else if(h.type==='tree'){const z=x.map(Math.fround);let n=0;while(h.left[n]!==-1)n=z[h.feature[n]]<=h.threshold[n]?h.left[n]:h.right[n];predictions[action]=h.value[n];}
  else throw Error('INVALID_VALUE_HEAD');
  if(predictions[action].some(v=>!Number.isFinite(v)))throw Error('INVALID_VALUE_PREDICTION');
 }
 return Object.entries(predictions).map(([action,[platformDeltaUSD,retailerDeltaUSD]])=>({action,platformDeltaUSD,retailerDeltaUSD}));
}
export function mechanicalValueChoice(predictions){
 return predictions.filter(p=>p.platformDeltaUSD>0&&p.retailerDeltaUSD>=-1e-7).sort((a,b)=>b.platformDeltaUSD-a.platformDeltaUSD||a.action.localeCompare(b.action))[0]?.action||'continue_numerical';
}
export async function finishPolicy(prefix,action,r,allocator,{observer=null,trace=false}={}){
 const w=structuredClone(prefix.w),start=performance.now();while(w.day<w.totalDays)await turn(w,action,r,allocator,'value-'+action,observer);
 const closing=balances(w),orders=w.orders.filter(o=>o.day>=30),retained=orders.filter(o=>!['SETTLED','PENDING_FUNDS'].includes(o.refundStatus)),result={action,initialHash:prefix.initialHash,entryHash:prefix.entryHash,opportunityHash:w.growth.opportunityHash,consentHash:w.growth.consentHash,
  platformUSD:settledPlatformNet(prefix.opening,closing)/100,retailerUSD:Object.keys(prefix.opening.merchant).reduce((s,id)=>s+closing.merchant[id].equity-prefix.opening.merchant[id].equity,0)/100,
  retainedPurchases:retained.length,retainedVolumeUSD:retained.reduce((s,o)=>s+o.grossCents,0)/100,contactCount:w.growth.contacts.length,outreachCostUSD:w.growth.outreachCents/100,
  unpaidLiabilities:w.liabilities.filter(l=>l.status!=='SETTLED').length,runtimeMs:Math.round(performance.now()-start)};
 if(digest(prefix.w)!==prefix.entryHash)throw Error('SHARED_PREFIX_MUTATED');return {...result,...(trace?{trace:{contacts:w.growth.contacts,orders:w.orders,deliveries:w.deliveries,ledger:w.ledger}}:{})};
}
