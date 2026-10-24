import {createPolicyWorld,advancePolicyDay,merchantTerms,ACTIONS,ASSUMPTIONS} from './economy.mjs';
import {trainBandit} from './learner.mjs';
import {rulesPlan} from './service.mjs';

// In-memory evaluation adapter. Uses the actual market transition and learner,
// retains observed rows only, and never opens a provider or payment client.
export function simulateBenchmarkWorld({seed,scenario,policy,protocol,catalog,schedule,originalModels=null}){
  const started=performance.now(),id=`EVAL-${seed}-${scenario}-${policy}`;
  const w=createPolicyWorld({runId:id,comparisonId:id,branch:policy==='organic'?'organic':'mesh',
    settings:{...protocol.settings,seed,scenario,nativeSample:false},catalog,startedAt:protocol.startedAt});
  const observations=[],orders=new Map(),maturity=new Map(),fits=[],publications=[],daily=[];
  const checks={accounting:0,eligibility:0,propensity:0,inventory:0,budget:0,maturity:0,contactGap:0};
  const contacts=new Map(),baselineLapsed=new Set();let frozenCohort=false,pending=null;
  const timings=policy==='rules_fast'?schedule.map(p=>({...p,effectiveDay:p.asOfDay})):schedule;
  const sum=(xs,fn)=>xs.reduce((s,r)=>s+fn(r),0);
  function observedSummary(){
    const purchases=observations.filter(a=>a.order_id),latest=new Map();for(const a of purchases)latest.set(a.customer_id,a.day);
    const lapsed=[...latest.values()].filter(d=>w.tick-d>=7).length;
    return {returnRate:[...orders.values()].filter(o=>o.refund).length/Math.max(1,purchases.length),
      lapsedFraction:lapsed/w.customers.length,remainingBudgetCents:w.goal.budgetCents-w.live.discountCents-w.live.spendCents,
      merchants:merchantTerms(w).map(({privateEconomics,...m})=>m)};
  }
  while(w.tick<w.totalTicks){
    if(w.tick===30&&!frozenCohort){
      for(const u of w.customers)if(u.purchases&&w.tick-u.lastPurchase>=7)baselineLapsed.add(u.customer_id);
      frozenCohort=true;
    }
    if(policy!=='organic'){
      const checkpoint=timings.find(p=>p.asOfDay===w.tick);
      if(checkpoint){
        const plan=policy.startsWith('rules_')?{...rulesPlan(observedSummary()),asOfDay:w.tick,effectiveDay:checkpoint.effectiveDay}:checkpoint;
        const artifact=originalModels?.[checkpoint.asOfDay]||trainBandit(observations,{cutoffDay:checkpoint.asOfDay,windowDays:plan.windowDays,actions:ACTIONS});
        fits.push({day:w.tick,trainingRows:artifact.trainingRows,validationRows:artifact.validationRows,mse:artifact.mse,baselineMse:artifact.baselineMse,runtimeMs:artifact.runtimeMs});
        pending={plan,artifact};
      }
      if(pending&&pending.plan.effectiveDay===w.tick){
        const {plan,artifact}=pending;w.policyLab.plan=plan;w.policyLab.model=artifact;w.policyLab.modelId='LOCAL-FIT-'+plan.asOfDay;
        w.policyLab.policyVersion=policy+'-'+plan.asOfDay;publications.push(plan);pending=null;
      }
    }
    const batch=advancePolicyDay(w),rows=batch.rows;
    for(const o of rows.orders){
      const transaction=rows.transactions.find(t=>t.order_id===o.order_id);
      checks.accounting+=Number(!Number.isSafeInteger(o.total_cents)||o.total_cents!==o.subtotal_cents-o.discount_cents+o.shipping_cents||transaction.net_cents!==o.total_cents-transaction.fee_cents);
      orders.set(o.order_id,{...o,fee:transaction.fee_cents,processing:Math.round(o.total_cents*ASSUMPTIONS.processingRate)+ASSUMPTIONS.processingFixedCents,refund:0});
    }
    for(const r of rows.refunds){const o=orders.get(r.order_id);if(!o)throw Error('ORPHAN_REFUND');o.refund+=r.amount_cents;checks.accounting+=Number(o.refund>o.total_cents);}
    for(const a of rows.policy_lab_actions){
      checks.eligibility+=Number(!JSON.parse(a.eligible_json).includes(a.selected_action));
      checks.propensity+=Number(!Number.isFinite(a.propensity)||a.propensity<=0||a.propensity>1);
      if(a.selected_action!=='none'){checks.contactGap+=Number(contacts.has(a.customer_id)&&a.day-contacts.get(a.customer_id)<ASSUMPTIONS.contactGapDays);contacts.set(a.customer_id,a.day);}
      observations.push(a);const queue=maturity.get(a.matures_day)||[];queue.push(a);maturity.set(a.matures_day,queue);
    }
    for(const a of maturity.get(w.tick)||[]){
      const o=orders.get(a.order_id);a.reward_cents=(o?(o.refund?0:o.fee)-o.processing:0)-a.outreach_cents-a.platform_support_cents;
    }
    maturity.delete(w.tick);
    checks.inventory+=Object.values(w.inventory).filter(n=>!Number.isSafeInteger(n)||n<0).length;
    checks.budget+=Number(w.live.discountCents+w.live.spendCents>w.goal.budgetCents);
  }
  const field=observations.filter(a=>a.day>=30),sales=field.filter(a=>a.order_id),fieldOrders=sales.map(a=>orders.get(a.order_id));
  checks.maturity=field.filter(a=>a.reward_cents===null).length;
  let cumulative=0;
  for(let day=30;day<protocol.settings.days;day++){
    cumulative+=sum(field.filter(a=>a.day===day),a=>a.reward_cents);
    // Historical review cost is a declared per-world allocation, not a new API bill.
    const allocatedModelUSD=policy==='recorded_v1'?sum(protocol.costSchedule.filter(c=>c.day<=day),c=>c.micros)/1e6:0;
    daily.push({day:day+1,platformProxyCents:cumulative,allocatedModelUSD});
  }
  const allocatedModelUSD=policy==='recorded_v1'?protocol.sourceModelCostUSD:0;
  const reactivated=new Set(sales.filter(a=>baselineLapsed.has(a.customer_id)).map(a=>a.customer_id));
  const platformProxyCents=sum(field,a=>a.reward_cents),outreach=sum(field,a=>a.outreach_cents),support=sum(field,a=>a.platform_support_cents);
  const directReward=sum(fieldOrders,o=>(o.refund?0:o.fee)-o.processing)-outreach-support;
  checks.accounting+=Number(directReward!==platformProxyCents);
  const last=daily.at(-1);last.allocatedModelUSD=allocatedModelUSD; // Includes final review, after follow-up.
  return {policy,seed,scenario,purchases:sales.length,platformProxyCents,allocatedModelUSD,
    retainedCents:sum(fieldOrders,o=>o.total_cents-o.refund),
    merchantContributionCents:sum(fieldOrders,o=>o.total_cents-o.refund-o.fee+(o.refund?o.fee:0)-o.cost_cents-o.delivery_cost_cents)+support,
    refundsCents:sum(fieldOrders,o=>o.refund),feesCents:sum(fieldOrders,o=>o.fee-(o.refund?o.fee:0)),
    outreachCents:outreach,platformSupportCents:support,jointBudgetSpentCents:w.live.discountCents+w.live.spendCents,
    offers:w.live.offers,recommendations:w.live.recommendations||0,redemptions:w.live.redemptions,
    cohortLapsed:baselineLapsed.size,reactivatedCustomers:reactivated.size,matureOutcomes:field.length-checks.maturity,
    fits,publications,daily,checks,runtimeMs:performance.now()-started,modelCalls:0,paymentCalls:0,
    actualNewAPIUSD:0,source:policy==='recorded_v1'?'SAVED_PLAN_TRANSFER_WITH_LOCAL_REFITS':'LOCAL_RULE_BASELINE',
    simulationStats:w.stats};
}
