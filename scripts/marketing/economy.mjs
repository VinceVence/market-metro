import {createMarket,eventDate,marketFrame} from '../../demo/market/engine.mjs';
import {FEATURES,predict} from './contract.mjs';

export const HISTORY_DAYS=28, SEASON_DAYS=56;
export const POLICIES=['adaptive','scheduled_ml','fixed_rules','no_offers'];
const NAMES=['Mika','Theo','Aya','Noah','Luca','Emi','Sage','Nico','Kai','Iris','Jules','Rae','Ari','Remy','Tala','Bea','Sam','Eli','Lia','Finn','Yuna','Max','June','Owen'];
const SHOPS=['Willow Goods','Oak & Ink','Corner Supply','Sunroom Market','River General','Juniper House','The Desk Shop','Clover Trading','Little Workshop','Meadow Supply','Daylight Goods','Copper Corner'];
const clip=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const round=x=>Math.max(0,Math.round(x));
const fee=x=>round(x*.0349)+49;
export function draw(seed,...keys){
  let h=seed>>>0;
  for(const c of keys.join('|'))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;
  h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);h^=h>>>16;
  return (h>>>0)/4294967296;
}
const sum=(list,k)=>list.reduce((n,x)=>n+(x[k]||0),0);
const stats=()=>({orders:0,units:0,revenueCents:0,refundsCents:0,feesCents:0,costCents:0,deliveryCostCents:0,spendCents:0,discountCents:0,offers:0,seen:0,redemptions:0,visits:0});
export function createLearningMarket({runId,seed=42,customerCount=600,merchantCount=8,startedAt,catalog,policy='adaptive',objective='retention',budgetCents=120000,scenario='rival_sale'}){
  const w=createMarket({runId,seed,customerCount,merchantCount,days:1,sandboxLimit:0,startedAt,catalog});
  Object.assign(w,{kind:'LEARNING_MARKET_V2',tickUnit:'day',totalTicks:SEASON_DAYS,historyDays:HISTORY_DAYS,policy,scenario,champion:null,models:[],decisions:[],daily:[],retention:[],lastTrainingDay:-1,modelVersion:0,privateTraits:[],pending:[],live:stats(),history:stats(),assignmentsMade:false,stockPools:null,goal:{objective,budgetCents,minMargin:.20,contactGap:7,question:objective==='retention'?'Which offers bring established customers back without wasting the discount budget?':objective==='profit'?'Which offers add contribution after discounts, outreach, fulfillment and fees?':'Which customers need an offer to complete a purchase?'}});
  w.campaigns=[];
  for(const m of w.merchants){
    m.name=SHOPS[m.position%SHOPS.length];m.category='Simulated mixed-goods store';m.district=['Willow Lane','Market Square','Riverside'][m.position%3];
    for(const phase of ['HISTORY','LIVE'])w.campaigns.push({campaign_id:runId+'-'+phase+'-'+m.position,run_id:runId,merchant_id:m.merchant_id,name:m.name+(phase==='HISTORY'?' · randomized learning':' · coupon field test'),channel:'in_game',objective, daily_budget_cents:round(budgetCents/28/merchantCount),spend_cents:0,status:'ACTIVE',policy:phase==='HISTORY'?'RANDOMIZED_EXPLORATION':policy,creative:phase==='HISTORY'?'Learn which offers help':'A little something for your next visit'});
  }
  w.products.forEach((p,i)=>{
    const ref=catalog[i%catalog.length];
    Object.assign(p,{channel3_product_id:ref.channel3Id||null,title:ref.title,brand:ref.brand||'',category:ref.category||'Unspecified',price_cents:ref.priceCents,cost_cents:round(ref.priceCents*(.42+.16*draw(seed,'cost',i))),source:ref.source,source_url:ref.sourceUrl||'',image_url:ref.imageUrl||'',initial_stock:45,retrieved_at:ref.retrievedAt||null});
    w.inventory[p.product_id]=45;
  });
  for(const m of w.merchants)m.stock=w.products.filter(p=>p.merchant_id===m.merchant_id).reduce((n,p)=>n+w.inventory[p.product_id],0);
  w.customers.forEach((u,i)=>{
    const type=draw(seed,'persona',i),bargain=type<(.25+.25*draw(seed,'population-mix')),loyal=!bargain&&type<.77;
    const wallet=round(6000+18000*draw(seed,'wallet',i));
    Object.assign(u,{index:i,name:NAMES[i%NAMES.length]+' '+String(Math.floor(i/NAMES.length)+1).padStart(2,'0'),segment:['Willow neighbors','Riverside neighbors','Square neighbors','Hill neighbors'][i%4],history:[],wallet,lastOffer:-100,lastPurchase:-100,visits:0,offers:0,redemptions:0,purchases:0,gross:0,lastAction:'home',lastDay:-1,lastCoupon:null,lastScores:null,baselineActive:false,arm:draw(seed,'holdout',i)<.25?'HOLDOUT':'TARGETABLE'});
    w.privateTraits.push({bargain,loyal,activity:.25+.30*draw(seed,'activity',i),couponEffect:bargain?2.5+draw(seed,'lift',i):loyal?.12:.45,loyalty:loyal?1.8:.15,affinity:Math.floor(draw(seed,'affinity',i)*w.products.length),weeklyIncome:round(3000+6000*draw(seed,'income',i))});
  });
  return w;
}
export function observedFeatures(w,u,p){
  const h=u.history.filter(x=>x.day<w.tick),seven=h.filter(x=>x.day>=w.tick-7),fourteen=h.filter(x=>x.day>=w.tick-14);
  return {recency_days:Math.min(28,w.tick-u.lastPurchase),purchases_7d:sum(seven,'purchased'),organic_14d:fourteen.filter(x=>x.purchased&&!x.redeemed).length,visits_7d:sum(seven,'visited'),spend_7d:sum(seven,'gross_cents'),offers_7d:sum(seven,'offered'),redemptions_14d:sum(fourteen,'redeemed'),price_cents:p.price_cents,stock_available:available(w,p,u)>0?1:0,rival_sale:w.tick>=35&&w.scenario==='rival_sale'?1:0,payday:w.tick%7===0?1:0};
}
function available(w,p,u){return w.stockPools?w.stockPools[p.product_id][u.arm]:w.inventory[p.product_id];}
function currentProduct(w,u){
  const t=w.privateTraits[u.index],offset=draw(w.seed,'browse',w.tick,u.index)<.68?0:Math.floor(draw(w.seed,'alternative',w.tick,u.index)*w.products.length);
  return w.products[(t.affinity+offset)%w.products.length];
}
export function scoreOffers(w,f,p){
  if(!w.champion)return null;
  const ps=[0,5,10].map(a=>predict(w.champion.artifact,f,a));
  const base=p.price_cents-p.cost_cents-fee(p.price_cents)-350;
  const options=[5,10].map((offer,j)=>{
    const discount=round(p.price_cents*offer/100),net=p.price_cents-discount;
    const gain=ps[j+1]*(net-p.cost_cents-fee(net)-350)-ps[0]*base-2;
    const lift=ps[j+1]-ps[0],margin=(net-p.cost_cents-fee(net)-350)/net;
    return {offer,gain,lift,margin,rank:w.goal.objective==='profit'?gain:lift*10000};
  }).filter(x=>x.margin>=w.goal.minMargin&&x.lift>.005&&(w.goal.objective!=='profit'||x.gain>0)).sort((a,b)=>b.rank-a.rank||a.offer-b.offer);
  return {p0:ps[0],p5:ps[1],p10:ps[2],offer:options[0]?.offer||0,gain:options[0]?.gain||0,lift:options[0]?.lift||0};
}
export function appendDecision(w,role,action,message,evidence={},status='DONE'){
  const row={decision_id:w.runId+'-TEAM-'+(w.decisions.length+1),run_id:w.runId,day:w.tick,role,action,message,evidence_json:JSON.stringify(evidence),status,source:'SCRIPTED_LOCAL_WORKFLOW'};
  w.decisions.push(row);return row;
}
export function initialLearningRows(w){
  return {business_goals:[{goal_id:w.runId+'-GOAL',run_id:w.runId,objective:w.goal.objective,question:w.goal.question,budget_cents:w.goal.budgetCents,min_margin_pct:w.goal.minMargin,contact_gap_days:w.goal.contactGap,history_days:HISTORY_DAYS,followup_days:14,policy:w.policy,scenario:w.scenario,source:'USER_SIMULATION_BRIEF'}],
    team_decisions:[appendDecision(w,'Business lead','SET_OBJECTIVE',w.goal.question,{budgetCents:w.goal.budgetCents,policy:w.policy}),
      appendDecision(w,'Data engineer','COLLECT_HISTORY','Collect 28 market days. Randomized 0%, 5% and 10% offers supply observed training examples; private customer traits are excluded.',{features:FEATURES,historyDays:HISTORY_DAYS}),
      appendDecision(w,'Experiment analyst','DEFINE_SUCCESS','Keep a persistent 25% customer holdout and a 14-day follow-up. Count additional retained customers only after outcomes mature.',{retentionDefinition:'No purchase in the next 14 days, among customers active before the field test.'})]};
}
export function advanceLearningDay(w){
  if(w.tick>=w.totalTicks)return {rows:{},activities:[]};
  const day=w.tick,phase=day<HISTORY_DAYS?'HISTORY':'LIVE',stamp=new Date(Date.parse(w.startedAt)+day*86400000).toISOString(),date=eventDate(stamp);
  const rowNames=['events','orders','order_items','transactions','refunds','deliveries','inventory_movements','campaign_spend','campaign_assignments','coupons','coupon_redemptions','customer_days','model_scores','team_decisions','retention_results'];
  const rows=Object.fromEntries(rowNames.map(t=>[t,[]])),activities=[];
  const uid=p=>w.runId+'-'+p+(++w.sequence);
  const counter=phase==='HISTORY'?w.history:w.live;
  const movement=(p,n,reason,oid=null)=>rows.inventory_movements.push({movement_id:uid('I'),run_id:w.runId,product_id:p.product_id,merchant_id:p.merchant_id,order_id:oid,event_ts:stamp,event_date:date,quantity:n,reason,source:'SIMULATED'});
  const emit=(type,u,p,c,oid=null,detail={})=>rows.events.push({event_id:uid('E'),run_id:w.runId,event_ts:stamp,event_date:date,merchant_id:p?.merchant_id||null,customer_id:u?.customer_id||null,product_id:p?.product_id||null,campaign_id:c?.campaign_id||null,order_id:oid,channel:c?'in_game':'direct',event_type:type,detail_json:JSON.stringify({phase,day,...detail}),source:'SIMULATED'});
  const team=(role,action,message,evidence={},status='DONE')=>rows.team_decisions.push(appendDecision(w,role,action,message,evidence,status));
  if(day===HISTORY_DAYS){
    w.assignmentsMade=true;w.stockPools=Object.fromEntries(w.products.map(p=>[p.product_id,{HOLDOUT:Math.floor(w.inventory[p.product_id]*.25),TARGETABLE:w.inventory[p.product_id]-Math.floor(w.inventory[p.product_id]*.25)}]));
    for(const u of w.customers){
      u.baselineActive=u.history.some(x=>x.purchased&&x.day>=HISTORY_DAYS-14);
      for(const m of w.merchants)rows.campaign_assignments.push({assignment_id:w.runId+'-A-'+u.index+'-'+m.position,run_id:w.runId,campaign_id:w.runId+'-LIVE-'+m.position,customer_id:u.customer_id,assigned_day:day,arm:u.arm,propensity:u.arm==='HOLDOUT'?.25:.75,eligible:u.baselineActive?1:0,source:'RANDOMIZED_SIMULATION'});
    }
    team('Campaign manager','PROPOSE_AUDIENCE','Prioritize customers who may need an offer. Compare 5% and 10% against no offer; reserve the maximum discount before issuing.',{eligible:w.customers.filter(u=>u.baselineActive).length});
    team('Experiment analyst','CHALLENGE_TARGETING','Risk of inactivity alone does not establish coupon benefit. Preserve holdout customers and prefer measured offer response.',{holdout:w.customers.filter(u=>u.arm==='HOLDOUT').length});
    team('Coordinator','LAUNCH_FIELD_TEST',w.champion?'Launch using the promoted model, with contact limits, stock checks and a hard budget.':'No qualified model yet. Use the disclosed fixed-rule fallback and keep collecting outcomes.',{modelId:w.champion?.id||null,budgetCents:w.goal.budgetCents});
  }
  if(day===35&&w.scenario!=='steady'){
    team('Business lead','CHANGE_DETECTED',w.scenario==='rival_sale'?'A rival sale changes shopping conditions. Are our earlier offer-response estimates still useful?':w.scenario==='supply_delay'?'Restocking is delayed. Do not spend coupons on unavailable products.':'Household budgets tighten. Recheck whether the campaign is still affordable.',{scenario:w.scenario});
    team('Data scientist','REQUEST_RECENT_OUTCOMES','A changed world is not enough evidence to promote a new model. Collect seven days of observed outcomes before the next validation.',{reviewDay:42},'WAITING');
  }
  // Inventory is partitioned by randomized arm during the field test to prevent treatment stock usage from exhausting holdout stock.
  for(const p of w.products){
    const delayed=w.scenario==='supply_delay'&&day>=35&&day<42;
    if(delayed)continue;
    if(w.stockPools){for(const arm of ['HOLDOUT','TARGETABLE'])if(w.stockPools[p.product_id][arm]<8){const n=arm==='HOLDOUT'?20:60;w.stockPools[p.product_id][arm]+=n;w.inventory[p.product_id]+=n;movement(p,n,'RESTOCK_'+arm);}}
    else if(w.inventory[p.product_id]<12){w.inventory[p.product_id]+=70;movement(p,70,'RESTOCK');}
  }
  const deliver=(d)=>{
    const u=w.customers[d.customerIndex],p=w.products.find(p=>p.product_id===d.productId),c=w.campaigns.find(c=>c.campaign_id===d.campaignId);
    rows.deliveries.push({delivery_id:uid('D'),run_id:w.runId,order_id:d.orderId,merchant_id:p.merchant_id,event_ts:stamp,event_date:date,units:1,status:'DELIVERED',source:'SIMULATED'});
    w.stats.deliveries++;emit('delivered',u,p,c,d.orderId);activities.push({type:'delivery',customerId:u.customer_id,customer:u.name,merchantId:p.merchant_id,merchant:w.merchants.find(m=>m.merchant_id===p.merchant_id).name,product:p.title,amount:d.gross});
    if(d.refund){rows.refunds.push({refund_id:uid('R'),run_id:w.runId,order_id:d.orderId,transaction_id:d.transactionId,merchant_id:p.merchant_id,event_ts:stamp,event_date:date,amount_cents:d.gross,currency:'USD',reason:'Simulated buyer return',source:'SIMULATED'});w.stats.refundsCents+=d.gross;(d.phase==='LIVE'?w.live:w.history).refundsCents+=d.gross;u.wallet+=d.gross;emit('refunded',u,p,c,d.orderId,{amount_cents:d.gross});}
  };
  const due=w.pending.filter(d=>d.due<=day);w.pending=w.pending.filter(d=>d.due>day);due.forEach(deliver);
  let reserved=0,offeredToday=0,seenToday=0,redeemedToday=0,purchasesToday=0,visitsToday=0,discountToday=0;
  const remainingBudget=w.goal.budgetCents-w.live.discountCents-w.live.spendCents;
  const dailyAllowance=Math.min(remainingBudget,Math.max(0,remainingBudget/Math.max(1,SEASON_DAYS-day)*2));
  const planned=w.customers.map(u=>{
    const p=currentProduct(w,u),f=observedFeatures(w,u,p),score=scoreOffers(w,f,p);
    let offer=0,reason='No offer',probability=1;
    if(day>=7&&phase==='HISTORY'&&day-u.lastOffer>=4){offer=[0,5,10][Math.floor(draw(w.seed,'exploration',day,u.index)*3)];reason='Randomized history experiment';probability=1/3;}
    if(phase==='LIVE'&&u.arm==='TARGETABLE'&&(w.goal.objective!=='retention'||u.baselineActive)&&day-u.lastOffer>=w.goal.contactGap&&f.stock_available){
      if(w.policy==='no_offers')reason='No-offer comparison policy';
      else if((w.policy==='adaptive'||w.policy==='scheduled_ml')&&score){offer=score.offer;reason=offer?'Model selects the offer against its no-offer prediction':'Model predicts no worthwhile offer';}
      else {offer=f.recency_days>=5&&f.purchases_7d<2?10:f.recency_days>=3?5:0;reason=offer?'Fixed recency/frequency rule':'Fixed rule: no offer';}
    }
    return {u,p,f,score,offer,reason,probability};
  });
  // Higher expected value is funded first. Keyed external random draws do not depend on this action order.
  planned.sort((a,b)=>(b.score?(w.goal.objective==='profit'?b.score.gain:b.score.lift):b.f.recency_days)-(a.score?(w.goal.objective==='profit'?a.score.gain:a.score.lift):a.f.recency_days)||a.u.index-b.u.index);
  for(const item of planned){
    const {u,p,f,score}=item,t=w.privateTraits[u.index],m=w.merchants.find(m=>m.merchant_id===p.merchant_id),c=w.campaigns.find(c=>c.campaign_id===w.runId+'-'+phase+'-'+m.position);
    if(day%7===0&&day>0)u.wallet=Math.min(50000,u.wallet+t.weeklyIncome*(w.scenario==='budget_squeeze'&&day>=35?.55:1));
    let offer=item.offer,reason=item.reason,coupon=null;
    const discount=round(p.price_cents*offer/100),sale=p.price_cents-discount,margin=(sale-p.cost_cents-fee(sale)-350)/Math.max(1,sale);
    if(offer&&margin<w.goal.minMargin){offer=0;reason='Rejected: margin floor';}
    if(offer&&phase==='LIVE'){
      if(discount+2+reserved>dailyAllowance){offer=0;reason='Deferred: discount budget reserved';}
    }
    if(offer&&available(w,p,u)<=0){offer=0;reason='Rejected: no stock';}
    if(offer){
      const amount=round(p.price_cents*offer/100);
      coupon={coupon_id:uid('CP'),run_id:w.runId,campaign_id:c.campaign_id,assignment_id:phase==='LIVE'?w.runId+'-A-'+u.index+'-'+m.position:null,customer_id:u.customer_id,merchant_id:p.merchant_id,product_id:p.product_id,issued_day:day,expires_day:day,discount_pct:offer,max_discount_cents:amount,model_id:phase==='LIVE'?w.champion?.id||null:null,reason,source:'SIMULATED_MERCHANT_COUPON'};
      rows.coupons.push(coupon);reserved+=amount+2;u.lastOffer=day;u.offers++;u.lastMerchant=p.merchant_id;u.lastCoupon={id:coupon.coupon_id,pct:offer,day,status:'DELIVERED'};
      offeredToday++;counter.offers++;counter.spendCents+=2;w.stats.spendCents+=2;c.spend_cents+=2;
      rows.campaign_spend.push({spend_id:uid('A'),run_id:w.runId,campaign_id:c.campaign_id,merchant_id:p.merchant_id,event_ts:stamp,event_date:date,channel:'in_game',amount_cents:2,currency:'USD',source:'SIMULATED_2_CENT_OUTREACH_ASSUMPTION'});
      emit('coupon_issued',u,p,c,null,{coupon_id:coupon.coupon_id,discount_pct:offer});activities.push({type:'coupon',customerId:u.customer_id,customer:u.name,merchantId:p.merchant_id,merchant:m.name,pct:offer});
    }
    if(score&&phase==='LIVE'){
      const record={score_id:uid('SCORE'),run_id:w.runId,customer_id:u.customer_id,product_id:p.product_id,day,model_id:w.champion.id,p_no_offer:score.p0,p_five:score.p5,p_ten:score.p10,chosen_pct:offer,expected_gain_cents:score.gain,source:'LOCAL_FITTED_MODEL'};
      rows.model_scores.push(record);u.lastScores={p0:score.p0,p5:score.p5,p10:score.p10,modelId:w.champion.id,offer,reason};
    }
    const read=coupon&&draw(w.seed,'message-read',day,u.index)<.80;
    if(read){seenToday++;counter.seen++;emit('coupon_seen',u,p,c,null,{coupon_id:coupon.coupon_id});}
    const visitChance=clip(t.activity+(read?.13*offer/5:0)-(f.rival_sale?.08:0),.05,.90);
    const visited=draw(w.seed,'visit',day,u.index)<visitChance;
    let purchased=0,redeemed=0,gross=0,discountPaid=0,contribution=-Number(!!coupon)*2;
    u.lastAction=read?'coupon':'home';u.lastDay=day;
    if(visited){
      visitsToday++;counter.visits++;u.visits++;w.stats.impressions++;w.stats.clicks++;
      emit('impression',u,p,coupon?c:null);emit('product_view',u,p,coupon?c:null);u.lastAction='browse';u.lastMerchant=p.merchant_id;activities.push({type:'visit',customerId:u.customer_id,customer:u.name,merchantId:p.merchant_id,merchant:m.name});
      const useOffer=read?offer:0,amount=round(p.price_cents*useOffer/100),net=p.price_cents-amount;
      const rivalPenalty=f.rival_sale?(t.bargain?1.2:.4):0;
      const lift=(t.couponEffect+(f.rival_sale&&t.bargain?.9:0))*(useOffer/10);
      const logit=-1.0+t.loyalty+lift-rivalPenalty-Math.min(2,p.price_cents/Math.max(1000,u.wallet))*.7;
      const probability=1/(1+Math.exp(-logit));
      if(available(w,p,u)>0&&net<=u.wallet&&draw(w.seed,'purchase',day,u.index)<probability){
        purchased=1;redeemed=useOffer?1:0;gross=net;discountPaid=amount;purchasesToday++;redeemedToday+=redeemed;discountToday+=amount;
        const oid=uid('O'),tid=uid('T'),paymentFee=fee(net),cost=p.cost_cents,deliveryCost=350;
        contribution+=net-paymentFee-cost-deliveryCost;
        rows.orders.push({order_id:oid,run_id:w.runId,merchant_id:p.merchant_id,customer_id:u.customer_id,campaign_id:coupon?c.campaign_id:null,event_ts:stamp,event_date:date,channel:coupon?'in_game':'direct',currency:'USD',subtotal_cents:p.price_cents,discount_cents:amount,shipping_cents:0,total_cents:net,cost_cents:cost,delivery_cost_cents:deliveryCost,status:'PAID',source:'SIMULATED',sandbox_requested:0});
        rows.order_items.push({order_item_id:uid('LI'),run_id:w.runId,order_id:oid,product_id:p.product_id,quantity:1,unit_price_cents:p.price_cents,line_total_cents:p.price_cents});
        rows.transactions.push({transaction_id:tid,run_id:w.runId,order_id:oid,merchant_id:p.merchant_id,event_ts:stamp,event_date:date,currency:'USD',gross_cents:net,fee_cents:paymentFee,net_cents:net-paymentFee,status:'COMPLETED',source:'SIMULATED',fee_assumption:'3.49% + $0.49; model assumption, not a PayPal quote'});
        if(redeemed){rows.coupon_redemptions.push({redemption_id:uid('REDEEM'),run_id:w.runId,coupon_id:coupon.coupon_id,order_id:oid,customer_id:u.customer_id,event_date:date,discount_cents:amount,source:'SIMULATED'});u.lastCoupon.status='REDEEMED';emit('coupon_redeemed',u,p,c,oid,{coupon_id:coupon.coupon_id,discount_cents:amount});}
        emit('checkout_started',u,p,coupon?c:null,oid);emit('purchase',u,p,coupon?c:null,oid,{coupon_id:redeemed?coupon.coupon_id:null,discount_cents:amount,amount_cents:net});
        movement(p,-1,'SALE',oid);w.inventory[p.product_id]--;if(w.stockPools)w.stockPools[p.product_id][u.arm]--;
        u.wallet-=net;u.lastPurchase=day;u.purchases++;u.redemptions+=redeemed;u.gross+=net;u.lastAction=redeemed?'redeem':'purchase';u.lastMerchant=p.merchant_id;
        m.sold++;m.revenue+=net;
        for(const target of [w.stats,counter]){target.orders++;target.units++;target.revenueCents+=net;target.feesCents+=paymentFee;target.costCents+=cost;target.deliveryCostCents+=deliveryCost;}
        counter.discountCents+=amount;counter.redemptions+=redeemed;
        w.pending.push({orderId:oid,transactionId:tid,productId:p.product_id,customerIndex:u.index,campaignId:coupon?c.campaign_id:null,gross:net,phase,due:Math.min(SEASON_DAYS-1,day+1+Math.floor(draw(w.seed,'delivery',day,u.index)*2)),refund:draw(w.seed,'return',day,u.index)<.025});
        activities.push({type:redeemed?'redemption':'purchase',customerId:u.customer_id,customer:u.name,merchantId:m.merchant_id,merchant:m.name,product:p.title,amount:net,pct:useOffer,orderId:oid});
      }else{emit('cart_abandoned',u,p,coupon?c:null,null,{reason:available(w,p,u)<=0?'STOCK':net>u.wallet?'BUDGET':'NO_PURCHASE'});if(available(w,p,u)<=0)w.stats.stockouts++;}
    }
    const obs={observation_id:uid('OBS'),run_id:w.runId,customer_id:u.customer_id,day,event_date:date,phase,product_id:p.product_id,...f,offered_pct:offer,assignment_probability:phase==='HISTORY'?item.probability:u.arm==='HOLDOUT'?.25:.75,visited:Number(visited),purchased,redeemed,gross_cents:gross,discount_cents:discountPaid,contribution_cents:contribution,source:'SIMULATED_OBSERVED'};
    rows.customer_days.push(obs);
    u.history.push({day,visited:Number(visited),purchased,redeemed,offered:offer>0?1:0,gross_cents:gross});u.history=u.history.filter(h=>h.day>=day-28);
  }
  if(day===SEASON_DAYS-1){w.pending.forEach(deliver);w.pending=[];}
  for(const m of w.merchants)m.stock=w.products.filter(p=>p.merchant_id===m.merchant_id).reduce((n,p)=>n+w.inventory[p.product_id],0);
  const d={day,phase,visits:visitsToday,orders:purchasesToday,offers:offeredToday,seen:seenToday,redemptions:redeemedToday,discountCents:discountToday,conversion:visitsToday?purchasesToday/visitsToday:0};
  w.daily.push(d);
  if(phase==='LIVE'&&(day===28||day%7===6))team('Campaign manager','CAMPAIGN_CHECK',offeredToday+' offers issued; '+seenToday+' seen; '+redeemedToday+' redeemed today. Unused offers expire without a discount charge.',{...d,budgetSpent:w.live.discountCents+w.live.spendCents});
  if(day===41||day===55){
    const start=day-13,cohort=w.customers.filter(u=>u.baselineActive),treated=cohort.filter(u=>u.arm==='TARGETABLE'),control=cohort.filter(u=>u.arm==='HOLDOUT');
    const inactive=group=>group.filter(u=>!u.history.some(h=>h.day>=start&&h.day<=day&&h.purchased)).length;
    const tn=treated.length,cn=control.length,ti=inactive(treated),ci=inactive(control),tr=tn?ti/tn:0,cr=cn?ci/cn:0,lift=cr-tr;
    const se=tn&&cn?Math.sqrt(tr*(1-tr)/tn+cr*(1-cr)/cn):null;
    const result={result_id:uid('RET'),run_id:w.runId,campaign_id:null,window_start:start,window_end:day+1,status:tn>=30&&cn>=30?'MATURE':'SMALL_SAMPLE',treatment_n:tn,control_n:cn,treatment_inactive:ti,control_inactive:ci,treatment_rate:tr,control_rate:cr,lift,ci_low:se===null?null:Math.max(-1,lift-1.96*se),ci_high:se===null?null:Math.min(1,lift+1.96*se),estimated_prevented:lift*tn,source:'SIMULATED_RANDOMIZED_ITT'};
    w.retention.push(result);rows.retention_results.push(result);
    team('Experiment analyst','MEASURE_RETENTION','14-day outcomes matured. Estimated reduction in inactivity: '+(lift*100).toFixed(1)+' percentage points. '+(result.ci_low>0?'The interval is above zero.':'The interval does not establish a benefit.'),result,result.ci_low>0?'EVIDENCE':'INCONCLUSIVE');
  }
  w.tick++;w.status=w.tick>=w.totalTicks?'COMPLETED':'RUNNING';
  return {rows,activities:[...activities.filter(a=>a.type==='redemption').slice(0,10),...activities.filter(a=>a.type==='coupon').slice(0,10),...activities.filter(a=>a.type==='purchase').slice(0,10),...activities.filter(a=>a.type==='delivery').slice(0,5),...activities.filter(a=>a.type==='visit').slice(0,10)],daily:d};
}
export function learningFrame(w){
  const base=marketFrame(w),contribution=s=>s.revenueCents-s.refundsCents-s.feesCents-s.costCents-s.deliveryCostCents-s.spendCents;
  return {...base,eventTs:new Date(Date.parse(w.startedAt)+Math.max(0,w.tick-1)*86400000).toISOString(),kind:w.kind,tickUnit:'day',historyDays:HISTORY_DAYS,phase:w.tick<=HISTORY_DAYS?'LEARNING_HISTORY':'FIELD_TEST',policy:w.policy,scenario:w.scenario,goal:w.goal,
    live:{...w.live,contributionCents:contribution(w.live),budgetSpentCents:w.live.discountCents+w.live.spendCents},history:{...w.history,contributionCents:contribution(w.history)},
    champion:w.champion?{id:w.champion.id,version:w.champion.version,type:w.champion.artifact.type}:null,
    models:w.models.map(({artifact,...m})=>m),team:w.decisions.slice(-45).reverse(),daily:w.daily,retention:w.retention,
    customers:w.customers.map(u=>({id:u.customer_id,index:u.index,name:u.name,segment:u.segment,purchases:u.purchases,visits:u.visits,offers:u.offers,redemptions:u.redemptions,grossCents:u.gross,lastAction:u.lastAction,lastDay:u.lastDay,lastMerchant:u.lastMerchant,arm:u.arm,baselineActive:u.baselineActive,coupon:u.lastCoupon,scores:u.lastScores,history:u.history.slice(-14)}))};
}
