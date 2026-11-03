// Versioned accounting correction only. Original economy.mjs stays frozen.
// The day transition below retains original response/choice/fees, replacing only
// allowance credits. It does not add acquisition, retention or campaign relevance.
import {draw} from '../marketing/economy.mjs';
import {eventDate} from '../../demo/market/engine.mjs';
import {chooseBandit} from './learner.mjs';
import {createPolicyWorld,merchantTerms,eligibleActions,modeledFee,ASSUMPTIONS} from './economy.mjs';
export const WALLET_VERSION='wallet-integrity-v2';
const clip=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const feeCost=cents=>Math.round(cents*ASSUMPTIONS.processingRate)+ASSUMPTIONS.processingFixedCents;
const shelfPrice=(w,p)=>p.price_cents-Math.round(p.price_cents*(w.scenario==='rival_sale'&&w.tick>=35&&w.tick<60&&w.merchants[1].merchant_id===p.merchant_id?.05:0));
export function creditShoppingWallet(walletCents,scheduledCents,ceilingCents=50000){
  if(!Number.isSafeInteger(walletCents)||walletCents<0||!Number.isFinite(scheduledCents)||scheduledCents<0||!Number.isSafeInteger(ceilingCents)||ceilingCents<0)throw Error('INVALID_WALLET_CREDIT');
  const scheduled=Math.round(scheduledCents);
  if(!Number.isSafeInteger(scheduled))throw Error('INVALID_WALLET_CREDIT');
  // The ceiling limits NEW credits, never pre-existing funds or returned money.
  const creditedCents=Math.min(scheduled,Math.max(0,ceilingCents-walletCents));
  return {walletCents:walletCents+creditedCents,creditedCents,uncreditedCents:scheduled-creditedCents};
}
export function createWalletCorrectedWorld(input){
  const w=createPolicyWorld(input);w.policyLab.behaviorVersion=WALLET_VERSION;return w;
}
export function advanceWalletCorrectedDay(w){
  if(w.policyLab.behaviorVersion!==WALLET_VERSION)throw Error('VERSIONED_WORLD_REQUIRED');
  if(w.tick>=w.totalTicks)return {rows:{},activities:[]};
  const day=w.tick,lab=w.policyLab,tail=day>=lab.settings.days,history=day<30;
  const stamp=new Date(Date.parse(w.startedAt)+day*86400000).toISOString(),date=eventDate(stamp),uid=p=>w.runId+'-'+p+(++w.sequence);
  const rows=Object.fromEntries(['orders','order_items','transactions','refunds','deliveries','inventory_movements','campaign_spend','events','coupons','coupon_redemptions','policy_lab_actions','policy_lab_daily','policy_lab_merchants'].map(t=>[t,[]]));
  const activities=[],counter=history?w.history:w.live,daily={daily_id:w.runId+'-DAY-'+day,run_id:w.runId,day,orders:0,gross_cents:0,refunds_cents:0,fee_cents:0,platform_support_cents:0,outreach_cents:0,merchant_contribution_cents:0,platform_proxy_cents:0,offers:0,recommendations:0,source:'SIMULATED_WITH_EXPLICIT_COST_ASSUMPTIONS'};
  const emit=(type,u,p,orderId=null,detail={})=>rows.events.push({event_id:uid('E'),run_id:w.runId,event_ts:stamp,event_date:date,merchant_id:p?.merchant_id||null,customer_id:u?.customer_id||null,product_id:p?.product_id||null,order_id:orderId,channel:'policy_lab',event_type:type,detail_json:JSON.stringify({day,...detail}),source:'SIMULATED'});
  const move=(p,n,reason,order=null)=>rows.inventory_movements.push({movement_id:uid('I'),run_id:w.runId,product_id:p.product_id,merchant_id:p.merchant_id,order_id:order,event_ts:stamp,event_date:date,quantity:n,reason,source:'SIMULATED'});
  for(const pending of w.pending){
    const u=w.customers[pending.customerIndex],p=w.products[pending.productIndex];
    if(!pending.delivered&&pending.deliveryDay<=day){pending.delivered=true;rows.deliveries.push({delivery_id:uid('D'),run_id:w.runId,order_id:pending.orderId,merchant_id:p.merchant_id,event_ts:stamp,event_date:date,units:1,status:'DELIVERED',source:'SIMULATED'});w.stats.deliveries++;emit('delivered',u,p,pending.orderId);activities.push({type:'delivery',customerId:u.customer_id,customer:u.name,merchantId:p.merchant_id,amount:pending.gross});}
    if(pending.refund&&!pending.refunded&&pending.returnDay<=day){pending.refunded=true;rows.refunds.push({refund_id:uid('R'),run_id:w.runId,order_id:pending.orderId,transaction_id:pending.transactionId,merchant_id:p.merchant_id,event_ts:stamp,event_date:date,amount_cents:pending.gross,currency:'USD',reason:'Synthetic return within14-day observation window',source:'SIMULATED'});w.stats.refundsCents+=pending.gross;const owner=pending.history?w.history:w.live;owner.refundsCents+=pending.gross;owner.feeCreditsCents=(owner.feeCreditsCents||0)+pending.fee;lab.feeCreditsCents+=pending.fee;u.wallet+=pending.gross;u.returnCount++;daily.refunds_cents+=pending.gross;daily.merchant_contribution_cents+=pending.fee-pending.gross;daily.platform_proxy_cents-=pending.fee;emit('refunded',u,p,pending.orderId);activities.push({type:'refund',customerId:u.customer_id,customer:u.name,merchantId:p.merchant_id,amount:pending.gross});}
  }
  w.pending=w.pending.filter(x=>!x.delivered||x.refund&&!x.refunded);
  if(!tail)for(const p of w.products){
    const delay=w.scenario==='supply_delay'&&day>=35&&day<49;
    if(!delay&&w.inventory[p.product_id]<12){w.inventory[p.product_id]+=30;move(p,30,'RESTOCK');}
  }
  const terms=merchantTerms(w);
  if(day===35&&w.scenario==='rival_sale')emit('market_change',null,w.products[3],null,{change:'A competing merchant begins a5% shelf-price sale through day60. Funded by that merchant, outside the joint campaign budget.'});
  if(day%7===0||[30,35,55,80].includes(day))for(const term of terms)rows.policy_lab_merchants.push({merchant_decision_id:w.runId+'-MERCHANT-'+day+'-'+term.index,run_id:w.runId,day,merchant_id:term.merchantId,max_offer_pct:term.maxOfferPct,stock:term.stock,reason:term.reason,evidence_json:JSON.stringify(term.privateEconomics),source:term.source});
  // Keyed exogenous draws never depend on a branch ID or previous RNG consumption.
  const customers=tail?[]:[...w.customers.slice(day%w.customers.length),...w.customers.slice(0,day%w.customers.length)];
  for(const u of customers){
    const t=w.privateTraits[u.index],category=Math.floor(draw(w.seed,'category',day,u.index)*3),candidates=eligibleActions(w,u,terms,category);
    if(day%7===0&&day>0)u.wallet=creditShoppingWallet(u.wallet,t.weeklyIncome*(w.scenario==='budget_squeeze'&&day>=35?.65:1)).walletCents;
    let action;
    if(history){action={...candidates[Math.floor(draw(w.seed,'history-action',day,u.index)*candidates.length)],propensity:1/candidates.length};}
    else if(lab.model)action=chooseBandit(lab.model,candidates,{epsilon:lab.plan?.epsilon??0,draw:[draw(w.seed,'policy-explore',day,u.index),draw(w.seed,'policy-arm',day,u.index)]});
    else action={...candidates[0],propensity:1};
    const target=action.merchant===null?null:w.products[action.merchant*3+category],campaign=target?w.campaigns.find(c=>c.campaign_id===w.runId+'-'+(history?'HISTORY':'LIVE')+'-'+action.merchant):null;
    let coupon=null,outreach=0,subsidy=0;
    if(target){outreach=2;u.lastOffer=day;u.offers++;counter.spendCents+=2;w.stats.spendCents+=2;daily.outreach_cents+=2;daily.platform_proxy_cents-=2;daily[action.pct?'offers':'recommendations']++;counter[action.pct?'offers':'recommendations']=(counter[action.pct?'offers':'recommendations']||0)+1;
      rows.campaign_spend.push({spend_id:uid('SPEND'),run_id:w.runId,campaign_id:campaign.campaign_id,merchant_id:target.merchant_id,event_ts:stamp,event_date:date,channel:'policy_lab',amount_cents:2,currency:'USD',source:'SIMULATED_PLATFORM_OUTREACH'});
      if(action.pct){coupon={coupon_id:uid('CP'),run_id:w.runId,campaign_id:campaign.campaign_id,customer_id:u.customer_id,merchant_id:target.merchant_id,product_id:target.product_id,issued_day:day,expires_day:day,discount_pct:action.pct,max_discount_cents:Math.round(target.price_cents*action.pct/100),model_id:null,reason:'Jointly funded policy-lab offer;80% merchant,20% platform assumption',source:'SIMULATED_POLICY_LAB_COUPON'};rows.coupons.push(coupon);u.lastCoupon={id:coupon.coupon_id,pct:action.pct,day,status:'DELIVERED'};}
      emit(action.pct?'coupon_issued':'recommendation_shown',u,target,null,{action:action.id,policyVersion:lab.policyVersion,modelId:lab.modelId||null});activities.push({type:action.pct?'coupon':'recommendation',customerId:u.customer_id,customer:u.name,merchantId:target.merchant_id,merchant:w.merchants[action.merchant].name,pct:action.pct,product:target.title});
    }
    const read=Boolean(target)&&draw(w.seed,'read-offer',day,u.index)<.8;
    if(read&&coupon){counter.seen++;emit('coupon_seen',u,target);}
    const visit=draw(w.seed,'visit-market',day,u.index)<clip(t.activity+(read?.10:0)-t.fatigue*.04,.05,.9);
    let orderId=null,actual=null,gross=0,fee=0,discount=0;
    u.lastAction=target?'coupon':'home';u.lastDay=day;
    if(visit){
      u.visits++;counter.visits++;w.stats.impressions++;w.stats.clicks++;
      const gumbel=key=>-Math.log(-Math.log(Math.max(1e-8,draw(w.seed,'choice',day,u.index,key))));
      const options=[{index:null,utility:1.3+gumbel('outside')}];
      for(let i=0;i<3;i++){
        const p=w.products[i*3+category],pct=read&&action.merchant===i?action.pct:0,shelf=shelfPrice(w,p),price=shelf-Math.round(shelf*pct/100);
        if(w.inventory[p.product_id]<=0||price>u.wallet)continue;
        const publicDiscount=100*(p.price_cents-shelf)/p.price_cents;
        const utility=.1+(t.merchantAffinity===i?t.loyalty:0)+t.couponEffect*(pct+publicDiscount)/10+(read&&action.merchant===i&&action.type==='recommendation'?.55:0)-price/Math.max(1000,u.wallet)*1.5-t.fatigue*.05+gumbel(i);
        options.push({index:i,utility});
      }
      actual=options.sort((a,b)=>b.utility-a.utility)[0].index;
      const viewed=actual===null?(target||w.products[category]):w.products[actual*3+category];emit('product_view',u,viewed);activities.push({type:'visit',customerId:u.customer_id,customer:u.name,merchantId:viewed.merchant_id});
      if(actual!==null){
        const p=w.products[actual*3+category],m=w.merchants[actual],redeemed=Boolean(read&&coupon&&action.merchant===actual),shelf=shelfPrice(w,p);discount=redeemed?Math.round(shelf*action.pct/100):0;gross=shelf-discount;subsidy=Math.round(discount*.2);fee=modeledFee(gross);orderId=uid('O');const transactionId=uid('T');
        rows.orders.push({order_id:orderId,run_id:w.runId,merchant_id:m.merchant_id,customer_id:u.customer_id,campaign_id:target&&actual===action.merchant?campaign.campaign_id:null,event_ts:stamp,event_date:date,channel:redeemed?'policy_coupon':target&&actual===action.merchant?'policy_recommendation':'direct',currency:'USD',subtotal_cents:p.price_cents,discount_cents:p.price_cents-gross,shipping_cents:0,total_cents:gross,cost_cents:p.cost_cents,delivery_cost_cents:350,status:'PAID',source:'SIMULATED',sandbox_requested:0});
        rows.order_items.push({order_item_id:uid('ITEM'),run_id:w.runId,order_id:orderId,product_id:p.product_id,quantity:1,unit_price_cents:p.price_cents,line_total_cents:p.price_cents});
        rows.transactions.push({transaction_id:transactionId,run_id:w.runId,order_id:orderId,merchant_id:m.merchant_id,event_ts:stamp,event_date:date,currency:'USD',gross_cents:gross,fee_cents:fee,net_cents:gross-fee,status:'COMPLETED',source:'SIMULATED',fee_assumption:'3.49%+$0.49. Modeled processing cost1.2%+$0.20 and20% incentive reimbursement. Not PayPal rates or profit.'});
        if(redeemed){rows.coupon_redemptions.push({redemption_id:uid('CR'),run_id:w.runId,coupon_id:coupon.coupon_id,order_id:orderId,customer_id:u.customer_id,event_date:date,discount_cents:discount,source:'SIMULATED'});u.lastCoupon.status='REDEEMED';u.redemptions++;counter.redemptions++;emit('coupon_redeemed',u,p,orderId);}
        if(action.type==='recommendation'&&read&&action.merchant===actual){counter.recommendationPurchases=(counter.recommendationPurchases||0)+1;}
        u.wallet-=gross;u.lastPurchase=day;u.lastMerchant=m.merchant_id;u.lastMerchantIndex=actual;u.purchases++;u.gross+=gross;u.lastAction=redeemed?'redeem':'purchase';m.sold++;m.revenue+=gross;w.inventory[p.product_id]--;move(p,-1,'SALE',orderId);
        for(const s of [w.stats,counter]){s.orders++;s.units++;s.revenueCents+=gross;s.feesCents+=fee;s.costCents+=p.cost_cents;s.deliveryCostCents+=350;}
        counter.discountCents+=discount;counter.platformSupportCents=(counter.platformSupportCents||0)+subsidy;lab.platformSupportCents+=subsidy;lab.processingCents+=feeCost(gross);daily.orders++;daily.gross_cents+=gross;daily.fee_cents+=fee;daily.platform_support_cents+=subsidy;daily.merchant_contribution_cents+=gross+subsidy-fee-p.cost_cents-350;daily.platform_proxy_cents+=fee-feeCost(gross)-subsidy;
        w.pending.push({orderId,transactionId,customerIndex:u.index,productIndex:actual*3+category,gross,fee,history,deliveryDay:day+1+Math.floor(draw(w.seed,'delivery-delay',day,u.index)*2),refund:draw(w.seed,'return',day,u.index)<.035+Number(w.scenario==='returns_wave'&&day>=35&&actual===1)*.18,returnDay:day+5+Math.floor(draw(w.seed,'return-delay',day,u.index)*9)});
        emit('purchase',u,p,orderId,{policyVersion:lab.policyVersion,amount_cents:gross});activities.push({type:redeemed?'redemption':'purchase',customerId:u.customer_id,customer:u.name,merchantId:m.merchant_id,merchant:m.name,product:p.title,amount:gross,pct:redeemed?action.pct:0,orderId});
      }
    }
    t.fatigue=clip(t.fatigue*.9+Number(Boolean(target))*.2,0,3);
    u.history.push({day,visited:Number(visit),purchased:Number(Boolean(orderId)),redeemed:Number(discount>0),offered:Number(Boolean(target)),gross_cents:gross});u.history=u.history.filter(r=>r.day>=day-28);
    rows.policy_lab_actions.push({action_id:w.runId+'-ACTION-'+day+'-'+u.index,run_id:w.runId,day,customer_id:u.customer_id,policy_version:lab.policyVersion,model_id:lab.modelId||null,context_json:JSON.stringify(action.features),selected_action:action.id,eligible_json:JSON.stringify(candidates.map(a=>a.id)),propensity:action.propensity,target_merchant_id:target?.merchant_id||null,actual_merchant_id:actual===null?null:w.merchants[actual].merchant_id,order_id:orderId,offered_pct:action.pct,platform_support_cents:subsidy,outreach_cents:outreach,matures_day:day+14,reward_cents:null,source:history?'RANDOMIZED_SIMULATION':lab.branch==='organic'?'NO_CAMPAIGN_CONTROL':'LOCAL_CONTEXTUAL_BANDIT'});
  }
  for(const m of w.merchants)m.stock=w.products.filter(p=>p.merchant_id===m.merchant_id).reduce((s,p)=>s+w.inventory[p.product_id],0);
  w.daily.push({day,phase:history?'HISTORY':tail?'FOLLOWUP':'LIVE',purchases:daily.orders,revenueCents:daily.gross_cents,offers:daily.offers,redemptions:rows.coupon_redemptions.length});
  w.tick++;w.status=w.tick>=w.totalTicks?'COMPLETED':'RUNNING';lab.lastActivities=activities.slice(-50);rows.policy_lab_daily.push(daily);
  return {rows,activities};
}

