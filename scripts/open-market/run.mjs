import {createOpenWorld,advanceOpenDay,cashBalanceError} from './economy.mjs';
import {scheduleModel,matureMerchantRisk,POLICIES as CATALOG} from '../agent-mesh/aggressive-policy.mjs';
import {merchantTerms} from '../policy-lab/economy.mjs';

export const POLICIES=CATALOG.filter(p=>['organic','broad-full-price','high-value-weekly-return-aware','return-aware','high-value-return-aware'].includes(p.id));
export function createOpenRunner({seed,scenario,catalog,variant='nominal',days=400,policy=POLICIES[0],id,customers=100}){
  const world=createOpenWorld({runId:id||`OPEN-${seed}-${scenario}-${variant}-${policy.id}`,comparisonId:'OPEN-v1',branch:'mesh',settings:{seed,scenario,customerCount:customers,days,budgetCents:5000},catalog,startedAt:'2026-10-26T01:00:00.000Z'},variant);
  const actions=[],orders=new Map(),decisions=[],checks={cash:0,accounting:0,inventory:0,budget:0,eligibility:0,lateOutreach:0,maturity:0};
  let signature=null;const model=scheduleModel(policy);
  const runner={world,orders,actions,decisions,checks,step,evidence,result};
  function step(){
    const day=world.tick;
    if(day>=30){
      const risk=policy.risk?matureMerchantRisk(runner):[],indices=policy.risk?risk.filter(m=>!m.excluded).map(m=>m.index):[0,1,2];
      const active=policy.id!=='organic'&&day<100&&(!policy.weekdays||policy.weekdays.includes(day%7));
      world.policyLab.plan={strategy:active?'recommendations':'observe',audience:'all',merchantIndices:active?indices:[],maxOfferPct:0,epsilon:0};
      world.policyLab.model=model;world.policyLab.modelId=null;world.policyLab.policyVersion='AUTHORED-'+policy.id;
      const key=JSON.stringify({active,indices});
      if(key!==signature){decisions.push({day,active,merchantIndices:active?indices:[],risk,actor:'DETERMINISTIC_POLICY_EXECUTOR'});signature=key;}
    }
    const batch=advanceOpenDay(world);
    for(const o of batch.rows.orders){const t=batch.rows.transactions.find(t=>t.order_id===o.order_id);orders.set(o.order_id,{...o,day,fee:t.fee_cents,processing:Math.round(o.total_cents*.012)+20,refund:0});checks.accounting+=Number(o.total_cents!==o.subtotal_cents-o.discount_cents||t.net_cents!==t.gross_cents-t.fee_cents);}
    for(const r of batch.rows.refunds){if(!orders.has(r.order_id))throw Error('ORPHAN_REFUND');orders.get(r.order_id).refund+=r.amount_cents;}
    for(const a of batch.rows.policy_lab_actions){actions.push(a);checks.eligibility+=Number(!JSON.parse(a.eligible_json).includes(a.selected_action));checks.lateOutreach+=Number(a.day>=100&&a.selected_action!=='none');}
    checks.cash+=Number(Math.abs(cashBalanceError(world))>1e-5);
    checks.inventory+=Number(Object.values(world.inventory).some(n=>!Number.isSafeInteger(n)||n<0));
    checks.budget+=Number(world.live.spendCents+world.live.discountCents>5000);
    return batch;
  }
  function evidence(){
    // This is the ONLY agent-facing observation boundary. No world/private traits,
    // external transaction ledger, future return flags or control outcomes.
    const mature=[...orders.values()].filter(o=>o.day+14<=world.tick);
    return {asOfDay:world.tick,customers:world.customers.length,observedPurchases:orders.size,
      recentPurchases:[...orders.values()].filter(o=>o.day>=world.tick-7).length,
      catalog:world.products.map(p=>({productId:p.product_id,channel3Id:p.channel3_product_id,title:p.title,priceCents:p.price_cents,merchantId:p.merchant_id,stock:world.inventory[p.product_id]})),
      merchants:merchantTerms(world).map(({privateEconomics,...m})=>m),matureReturnRisk:matureMerchantRisk(runner),
      matureOrders:mature.length,matureReturned:mature.filter(o=>o.refund>0).length,
      campaigns:decisions,caveat:'Observed partner commerce only. No access to outside purchases or hidden preferences. Prices are cached Channel3 data; customers and costs are synthetic.'};
  }
  function result(){
    if(world.tick!==days+14)throw Error('INCOMPLETE_OPEN_RUN');
    const field=actions.filter(a=>a.day>=30),os=[...orders.values()].filter(o=>o.day>=30),ext=world.openMarket.orders.filter(o=>o.day>=30),sum=(xs,f)=>xs.reduce((n,x)=>n+f(x),0);
    for(const a of field){const o=orders.get(a.order_id);a.reward_cents=(o?(o.refund?0:o.fee)-o.processing:0)-a.outreach_cents-a.platform_support_cents;checks.maturity+=Number(a.matures_day>world.tick);}
    const retainedCents=sum(os,o=>o.total_cents-o.refund),externalRetainedCents=sum(ext,o=>o.refunded?0:o.gross),outreachCents=sum(field,a=>a.outreach_cents),supportCents=sum(field,a=>a.platform_support_cents);
    const grossFeesCents=sum(os,o=>o.fee),feeCreditsCents=sum(os,o=>o.refund?o.fee:0),processingCents=sum(os,o=>o.processing),platformProxyCents=sum(field,a=>a.reward_cents);
    checks.accounting+=Number(platformProxyCents!==grossFeesCents-feeCreditsCents-processingCents-outreachCents-supportCents);
    if(Object.values(checks).some(n=>n!==0)||world.openMarket.pendingRefunds.length)throw Error('OPEN_MARKET_INVARIANT_FAILED '+JSON.stringify(checks));
    const daily=Array.from({length:days-30},(_,i)=>({day:i+30,platformProxyCents:0,retainedCents:0,externalRetainedCents:0}));
    for(const a of field)daily[a.day-30].platformProxyCents+=a.reward_cents;
    for(const o of os)daily[o.day-30].retainedCents+=o.total_cents-o.refund;
    for(const o of ext)daily[o.day-30].externalRetainedCents+=o.refunded?0:o.gross;
    for(let i=1;i<daily.length;i++)for(const k of ['platformProxyCents','retainedCents','externalRetainedCents'])daily[i][k]+=daily[i-1][k];
    return {seed,scenario,variant,policy:policy.id,days,platformProxyCents,retainedCents,externalRetainedCents,totalCommerceCents:retainedCents+externalRetainedCents,paymentShare:retainedCents/(retainedCents+externalRetainedCents),grossFeesCents,feeCreditsCents,processingCents,outreachCents,supportCents,
      merchantContributionCents:sum(os,o=>o.total_cents-o.refund-(o.refund?0:o.fee)-o.cost_cents-o.delivery_cost_cents)+supportCents,
      purchases:os.length,externalPurchases:ext.length,recommendations:field.filter(a=>a.selected_action.startsWith('recommend')).length,coupons:field.filter(a=>a.selected_action.startsWith('coupon')).length,
      checks,cashErrorCents:cashBalanceError(world),daily,decisions};
  }
  return runner;
}
export function runOpen(input){const r=createOpenRunner(input);while(r.world.tick<r.world.totalTicks)r.step();return r.result();}
