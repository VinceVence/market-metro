// Policy-context adapter for the frozen closed economy. No changed behavioral or financial equations.
import {createPolicyWorld,merchantTerms,ACTIONS,ASSUMPTIONS} from '../policy-lab/economy.mjs';
import {advanceFocusedDay as advancePolicyDay} from './economy.mjs';
import {trainBandit} from '../policy-lab/learner.mjs';
import {rulesPlan} from '../policy-lab/service.mjs';

export const POLICY_OPTIONS=Object.freeze([
  {id:'observe',strategy:'observe',audience:'all',maxOfferPct:0,duration:25,penalty:0,epsilon:0},
  {id:'recommend_short',strategy:'recommendations',audience:'all',maxOfferPct:0,duration:3,penalty:.12,epsilon:0},
  {id:'recommend_selective',strategy:'recommendations',audience:'all',maxOfferPct:0,duration:3,penalty:.6,epsilon:0},
  {id:'reactivate_short',strategy:'recommendations',audience:'lapsed',maxOfferPct:0,duration:3,penalty:.3,epsilon:0},
  {id:'coupon_probe',strategy:'mixed',audience:'lapsed',maxOfferPct:5,duration:7,penalty:.06,epsilon:0}
]);
export const defaultPlan=()=>({...POLICY_OPTIONS[0],merchantIndices:[],windowDays:42});

// Policy-only change: conservative scoring on the SAME seven observed features.
// No change to transitions, prices, wallets, inventory, response or rewards.
export function policyArtifact(model,plan){
  const copy=structuredClone(model);
  if(!plan.penalty)return copy;
  for(const [action,arm] of Object.entries(copy.arms)){
    // Remove the optimistic exploration bonus; this penalty is NOT a causal CI.
    arm.inverse=arm.inverse.map(row=>row.map(()=>0));
    if(action!=='none')arm.coef[0]-=plan.penalty;
  }
  copy.policyPenaltyUSD=plan.penalty;copy.scoring='Predicted reward minus a declared outreach penalty, not an uplift estimate';return copy;
}

export function createFreshWorld({id,seed,scenario,settings,catalog,startedAt}){
  const w=createPolicyWorld({runId:id,comparisonId:id,branch:'mesh',settings:{...settings,seed,scenario,nativeSample:false},catalog,startedAt});
  const actions=[],orders=new Map(),maturity=new Map(),fits=[],publications=[],checks={accounting:0,eligibility:0,propensity:0,inventory:0,budget:0,maturity:0};
  const lapsed=new Set();let expiry=Infinity,costUSD=0,modelCalls=0,rawModel=null;
  function step(){
    if(w.tick===30)for(const u of w.customers)if(u.purchases&&w.tick-u.lastPurchase>=7)lapsed.add(u.customer_id);
    if(w.tick>=expiry){w.policyLab.plan={...w.policyLab.plan,strategy:'observe',merchantIndices:[],epsilon:0};expiry=Infinity;}
    const {rows}=advancePolicyDay(w);
    for(const o of rows.orders){const t=rows.transactions.find(t=>t.order_id===o.order_id);orders.set(o.order_id,{...o,fee:t.fee_cents,refund:0,processing:Math.round(o.total_cents*ASSUMPTIONS.processingRate)+ASSUMPTIONS.processingFixedCents});checks.accounting+=Number(o.total_cents!==o.subtotal_cents-o.discount_cents+o.shipping_cents||t.net_cents!==o.total_cents-t.fee_cents);}
    for(const r of rows.refunds){const o=orders.get(r.order_id);if(!o)throw Error('ORPHAN_REFUND');o.refund+=r.amount_cents;}
    for(const a of rows.policy_lab_actions){actions.push(a);checks.eligibility+=Number(!JSON.parse(a.eligible_json).includes(a.selected_action));checks.propensity+=Number(a.propensity<=0||a.propensity>1);const bucket=maturity.get(a.matures_day)||[];bucket.push(a);maturity.set(a.matures_day,bucket);}
    for(const a of maturity.get(w.tick)||[]){const o=orders.get(a.order_id);a.reward_cents=(o?(o.refund?0:o.fee)-o.processing:0)-a.outreach_cents-a.platform_support_cents;}maturity.delete(w.tick);
    checks.inventory+=Object.values(w.inventory).filter(x=>x<0||!Number.isSafeInteger(x)).length;
    checks.budget+=Number(w.live.discountCents+w.live.spendCents>w.goal.budgetCents);
  }
  function fit(cutoffDay=w.tick,windowDays=42,population='all'){
    const records=population==='contact_eligible'?actions.filter(a=>JSON.parse(a.eligible_json).length>1):actions;
    const model=trainBandit(records,{cutoffDay,windowDays,actions:ACTIONS});fits.push({cutoffDay,windowDays,population,trainingRows:model.trainingRows,validationRows:model.validationRows,mse:model.mse,baselineMse:model.baselineMse,runtimeMs:model.runtimeMs});return model;
  }
  function evidence(){
    const cutoff=w.tick,eligible=actions.filter(a=>a.day<cutoff&&a.matures_day<=cutoff&&JSON.parse(a.eligible_json).length>1);
    const byType={};for(const a of eligible){const type=a.selected_action==='none'?'none':a.selected_action.startsWith('recommend')?'recommendation':'coupon';const g=byType[type]||={n:0,rewardCents:0,purchases:0,returns:0,outreachCents:0,supportCents:0};g.n++;g.rewardCents+=a.reward_cents;g.purchases+=Number(Boolean(a.order_id));g.returns+=Number(Boolean(orders.get(a.order_id)?.refund));g.outreachCents+=a.outreach_cents;g.supportCents+=a.platform_support_cents;}
    const purchases=actions.filter(a=>a.order_id),recent=purchases.filter(a=>a.day>=cutoff-7).length,previous=purchases.filter(a=>a.day>=cutoff-14&&a.day<cutoff-7).length;
    const mature=actions.filter(a=>a.matures_day<=cutoff&&a.day<cutoff),byMerchant=w.merchants.map((m,i)=>{const rows=actions.filter(a=>a.day>=cutoff-21&&a.day<cutoff&&a.actual_merchant_id===m.merchant_id);return {index:i,purchases:rows.length,observedReturns:rows.filter(a=>orders.get(a.order_id)?.refund).length,retainedCents:rows.reduce((s,a)=>{const o=orders.get(a.order_id);return s+o.total_cents-o.refund;},0)};});
    return {asOfDay:cutoff,recentPurchases:recent,previousPurchases:previous,trend:recent>previous?'up':recent<previous?'down':'flat',
      customers:w.customers.length,lapsedFraction:w.customers.filter(u=>u.purchases&&cutoff-u.lastPurchase>=7).length/w.customers.length,
      returnRate:[...orders.values()].filter(o=>o.refund).length/Math.max(1,purchases.length),
      remainingBudgetCents:w.goal.budgetCents-w.live.discountCents-w.live.spendCents,
      merchants:merchantTerms(w).map(({privateEconomics,...m})=>m),byMerchant,
      actionAssociations:byType,matureObservations:mature.length,maturePlatformContributionCents:mature.reduce((s,a)=>s+a.reward_cents,0),
      currentPolicy:w.policyLab.plan,previousPublications:publications,
      caveat:'These adaptive action groups are descriptive, not causal lift. No control-branch outcomes, hidden traits or future events are available. Outcomes mature after14 days.'};
  }
  function publish(plan,model,cutoffDay=w.tick){
    if(model)rawModel=model;
    w.policyLab.plan={...plan,asOfDay:cutoffDay,effectiveDay:w.tick};w.policyLab.model=model?policyArtifact(model,plan):null;w.policyLab.modelId=model&&model.type!=='transparent_catalog_rule'?'LOCAL-'+model.cutoffDay:null;w.policyLab.policyVersion=plan.id+'-'+cutoffDay;
    expiry=w.tick+(plan.duration??25);publications.push({asOfDay:cutoffDay,effectiveDay:w.tick,expiresDay:expiry,trainingCutoffDay:model?.cutoffDay??null,policy:plan.id,strategy:plan.strategy,audience:plan.audience,maxOfferPct:plan.maxOfferPct,penaltyUSD:plan.penalty,merchantIndices:plan.merchantIndices});
  }
  function result(policy){
    const field=actions.filter(a=>a.day>=30),sales=field.filter(a=>a.order_id),os=sales.map(a=>orders.get(a.order_id)),sum=(xs,fn)=>xs.reduce((n,x)=>n+fn(x),0);
    checks.maturity=field.filter(a=>a.reward_cents===null).length;
    const support=sum(field,a=>a.platform_support_cents),proxy=sum(field,a=>a.reward_cents);
    checks.accounting+=Number(proxy!==sum(os,o=>(o.refund?0:o.fee)-o.processing)-sum(field,a=>a.outreach_cents)-support);
    let total=0;const daily=Array.from({length:settings.days-30},(_,i)=>{total+=sum(field.filter(a=>a.day===30+i),a=>a.reward_cents);return {day:31+i,platformProxyCents:total,allocatedModelUSD:i===settings.days-31?costUSD:0};});
    return {policy,seed,scenario,purchases:sales.length,platformProxyCents:proxy,retainedCents:sum(os,o=>o.total_cents-o.refund),merchantContributionCents:sum(os,o=>o.total_cents-o.refund-o.fee+(o.refund?o.fee:0)-o.cost_cents-o.delivery_cost_cents)+support,
      outreachCents:sum(field,a=>a.outreach_cents),platformSupportCents:support,jointBudgetSpentCents:w.live.discountCents+w.live.spendCents,offers:w.live.offers,recommendations:w.live.recommendations||0,redemptions:w.live.redemptions,
      cohortLapsed:lapsed.size,reactivatedCustomers:new Set(sales.filter(a=>lapsed.has(a.customer_id)).map(a=>a.customer_id)).size,checks,modelCalls,allocatedModelUSD:costUSD,daily,fits,publications,matureOutcomes:field.length-checks.maturity};
  }
  return {world:w,step,fit,evidence,publish,result,model:()=>rawModel,charge(usd,calls=1){costUSD+=usd;modelCalls+=calls;},actions,orders};
}

export function runLocalCandidate(input,choice){
  const runner=createFreshWorld(input);
  while(runner.world.tick<114){
    if([30,55,80].includes(runner.world.tick)){
      const e=runner.evidence(),option=typeof choice==='function'?choice(e):POLICY_OPTIONS.find(p=>p.id===choice);
      const plan={...option,merchantIndices:e.merchants.filter(m=>m.stock>0).map(m=>m.index),windowDays:42};runner.publish(plan,plan.strategy==='observe'?null:runner.fit(runner.world.tick,42,option.population||'all'));
    }
    runner.step();
  }
  return runner.result(typeof choice==='string'?choice:'selector');
}

export function unchangedRules(e){return {...rulesPlan(e),id:'rules',duration:25,penalty:0};}
