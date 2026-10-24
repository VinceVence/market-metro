// Read-only presentation data. Opening or replaying this view never advances a run.
export function createJudgeDemo({store,workflow,market}){
  const cache=new Map();
  return {snapshot(id){
    const c=workflow.context(id),lastTurn=store.db.prepare('SELECT turn_index,status,decision_json FROM planner_turns WHERE workflow_id=? ORDER BY turn_index DESC LIMIT 1').get(id);
    const signature=JSON.stringify([c.revision,c.phase,c.autonomy,c.checkpoints.map(p=>[p.status,p.attempts]),lastTurn?.turn_index,lastTurn?.status,c.nativePayments.lineage.map(r=>[r.receipt_id,r.paypal_status,r.amount_verified,r.provider_verified_at])]);
    if(cache.get(id)?.signature===signature)return cache.get(id).value;
    const frame=market.frame(c.runId),roster=frame.customers.map(u=>({id:u.id,index:u.index,name:u.name,arm:u.arm,segment:u.segment}));
    const customerIndex=new Map(roster.map(u=>[u.id,u.index])),merchantIndex=new Map(frame.merchants.map((m,i)=>[m.merchant_id,i]));
    const products=frame.products.map(p=>({id:p.product_id,merchantId:p.merchant_id,title:p.title,priceCents:p.price_cents,source:p.source,channel3Id:p.channel3_product_id,imageUrl:p.image_url,sourceUrl:p.source_url,retrievedAt:p.retrieved_at}));
    const productMap=new Map(products.map(p=>[p.id,p])),people=new Map(roster.map(u=>[u.id,u]));
    const days=store.db.prepare('SELECT day,event_date AS date,phase,COUNT(*) observations,SUM(visited) visits,SUM(purchased) purchases,SUM(gross_cents) salesCents,SUM(CASE WHEN offered_pct>0 THEN 1 ELSE 0 END) coupons,SUM(redeemed) redemptions,AVG(rival_sale) rivalPromotion FROM customer_days WHERE run_id=? AND day<? GROUP BY day ORDER BY day').all(c.runId,c.day).map(d=>({...d,motions:[],events:[],deliveries:0,feesCents:0}));
    const byDate=new Map(days.map(d=>[d.date,d])),byDay=new Map(days.map(d=>[d.day,d]));
    const orders=store.db.prepare('SELECT o.order_id,o.event_date,o.customer_id,o.merchant_id,o.total_cents,o.discount_cents,i.product_id,r.coupon_id FROM orders o JOIN order_items i USING(order_id) LEFT JOIN coupon_redemptions r USING(order_id) WHERE o.run_id=? ORDER BY o.event_ts,o.rowid').all(c.runId);
    const orderMap=new Map(orders.map(o=>[o.order_id,o]));
    const coupons=store.db.prepare('SELECT * FROM coupons WHERE run_id=? AND issued_day<? ORDER BY issued_day,rowid').all(c.runId,c.day);
    const seen=new Set(store.db.prepare("SELECT json_extract(detail_json,'$.coupon_id') id FROM events WHERE run_id=? AND event_type='coupon_seen'").all(c.runId).map(r=>r.id));
    const decisions=store.db.prepare('SELECT day,customer_id,model_id,reason,p_no_offer,p_five,p_ten FROM campaign_customer_decisions WHERE workflow_id=? AND day<?').all(id,c.day);
    const decisionMap=new Map(decisions.map(d=>[d.day+':'+d.customer_id,d]));
    const sample=new Set(Array.from({length:Math.min(32,roster.length)},(_,i)=>Math.floor(i*roster.length/Math.min(32,roster.length))));
    for(const day of days){
      const sales=orders.filter(o=>o.event_date===day.date),issued=coupons.filter(o=>o.issued_day===day.day);
      const chosen=[...sales.filter(o=>o.coupon_id).slice(0,2),...sales.filter(o=>!o.coupon_id).slice(0,3)].slice(0,4);
      const selectedCoupons=[...new Set([...chosen.map(o=>o.coupon_id).filter(Boolean),...issued.slice(0,3).map(o=>o.coupon_id)])].slice(0,4);
      const event=(kind,row)=>{
        const cid=row.customer_id,product=productMap.get(row.product_id),decision=decisionMap.get(day.day+':'+cid);
        return {kind,customerId:cid,customerIndex:customerIndex.get(cid),customerName:people.get(cid)?.name,merchantId:row.merchant_id,merchantIndex:merchantIndex.get(row.merchant_id),productId:row.product_id,productTitle:product?.title,channel3Id:product?.channel3Id,priceCents:product?.priceCents,orderId:row.order_id||null,couponId:row.coupon_id||null,amountCents:row.total_cents||0,discountCents:row.discount_cents||0,discountPct:row.discount_pct||0,seen:seen.has(row.coupon_id),modelId:decision?.model_id||null,probabilities:decision?{none:decision.p_no_offer,five:decision.p_five,ten:decision.p_ten}:null,reason:decision?.reason||'Randomized learning-history observation'};
      };
      for(const couponId of selectedCoupons){const row=issued.find(o=>o.coupon_id===couponId);if(row)day.events.push(event('coupon',row));}
      for(const row of chosen){const coupon=issued.find(o=>o.coupon_id===row.coupon_id);day.events.push(event('purchase',{...row,discount_pct:coupon?.discount_pct||0}));}
    }
    const deliveryRows=store.db.prepare('SELECT event_date,order_id FROM deliveries WHERE run_id=? ORDER BY event_ts,rowid').all(c.runId);
    for(const r of deliveryRows){const day=byDate.get(r.event_date),o=orderMap.get(r.order_id);if(!day||!o)continue;day.deliveries++;if(!day.events.some(e=>e.kind==='delivery'))day.events.push({kind:'delivery',orderId:o.order_id,merchantId:o.merchant_id,merchantIndex:merchantIndex.get(o.merchant_id),customerId:o.customer_id,customerName:people.get(o.customer_id)?.name});}
    for(const r of store.db.prepare('SELECT event_date,SUM(fee_cents) fees FROM transactions WHERE run_id=? GROUP BY event_date').all(c.runId)){const day=byDate.get(r.event_date);if(day)day.feesCents=r.fees;}
    const observed=store.db.prepare('SELECT d.day,d.customer_id,p.merchant_id,d.visited,d.purchased,d.redeemed,d.offered_pct FROM customer_days d JOIN products p USING(product_id) WHERE d.run_id=? AND d.day<? ORDER BY d.day,d.customer_id').all(c.runId,c.day);
    const featured=new Map(days.map(d=>[d.day,new Set(d.events.map(e=>e.customerIndex).filter(Number.isInteger))]));
    for(const r of observed){const day=byDay.get(r.day),index=customerIndex.get(r.customer_id);if(!day||!sample.has(index)&&!featured.get(r.day).has(index))continue;day.motions.push([index,merchantIndex.get(r.merchant_id),r.redeemed?'redeem':r.purchased?'purchase':r.visited?'browse':'home',r.offered_pct]);}
    const shopDaily=store.db.prepare('SELECT d.day,p.merchant_id,SUM(d.purchased) purchases,SUM(d.gross_cents) sales FROM customer_days d JOIN products p USING(product_id) WHERE d.run_id=? AND d.day<? GROUP BY d.day,p.merchant_id').all(c.runId,c.day);
    const stockChanges=store.db.prepare('SELECT i.event_date,p.merchant_id,SUM(i.quantity) quantity FROM inventory_movements i JOIN products p USING(product_id) WHERE i.run_id=? GROUP BY i.event_date,p.merchant_id').all(c.runId);
    const shopCounts=frame.merchants.map(m=>({sold:0,salesCents:0,stock:frame.products.filter(p=>p.merchant_id===m.merchant_id).reduce((n,p)=>n+p.initial_stock,0)}));let cumulative={purchases:0,salesCents:0,coupons:0,redemptions:0};
    for(const day of days){if(day.day===28)cumulative={purchases:0,salesCents:0,coupons:0,redemptions:0};for(const key of Object.keys(cumulative))cumulative[key]+=day[key];day.cumulative={...cumulative};for(const r of shopDaily.filter(r=>r.day===day.day)){const m=shopCounts[merchantIndex.get(r.merchant_id)];m.sold+=r.purchases;m.salesCents+=r.sales;}for(const r of stockChanges.filter(r=>r.event_date===day.date))shopCounts[merchantIndex.get(r.merchant_id)].stock+=r.quantity;day.shops=shopCounts.map(s=>({...s}));}
    const team=store.db.prepare('SELECT day,evidence_json FROM team_decisions WHERE run_id=?').all(c.runId),teamDay=new Map(team.map(r=>[JSON.parse(r.evidence_json||'{}').checkpointId,r.day]));
    const turns=store.db.prepare('SELECT turn_index,status,provider_json,checkpoint_id,error_json FROM planner_turns WHERE workflow_id=? ORDER BY turn_index').all(id).map(t=>({...t,provider:t.provider_json?JSON.parse(t.provider_json):null,error:t.error_json?JSON.parse(t.error_json):null,provider_json:undefined,error_json:undefined}));
    const contexts=new Map(store.db.prepare('SELECT input_json,request_json FROM planner_turns WHERE workflow_id=? AND request_json IS NOT NULL').all(id).map(t=>{const packet=JSON.parse(t.input_json||'{}').packet,request=JSON.parse(t.request_json);return [request.requestId,packet?{day:packet.workflow.day,offerExecution:packet.offerExecution}:null];}));
    const checkpoints=c.checkpoints.filter(p=>p.action==='set_goal'||['COMPLETED','FAILED'].includes(p.status)).map(p=>({id:p.checkpoint_id,action:p.action,status:p.status,actor:p.actor,day:teamDay.get(p.checkpoint_id)??p.output?.day??p.output?.cutoffExclusive??null,known:contexts.get(p.input.requestId)||null,evidenceIds:p.input.evidenceIds||[],parameters:p.input.parameters||{},rationale:p.input.rationale||p.input.mission,output:p.output?{...p.output,activities:undefined}:null,error:p.error}));
    const value={workflowId:id,runId:c.runId,revision:c.revision,seed:frame.seed,planner:c.planner,phase:c.phase,day:c.day,startDay:c.startDay,endDay:c.endDay,goal:c.goal,autonomy:c.autonomy,evaluation:c.evaluation,activeTurn:lastTurn?{index:lastTurn.turn_index,status:lastTurn.status}:null,pendingAction:c.pendingRequest?.action||null,
      base:{runId:c.runId,merchantCount:frame.merchantCount,merchants:frame.merchants.map(m=>({merchant_id:m.merchant_id,name:m.name,position:m.position,district:m.district,stock:frame.products.filter(p=>p.merchant_id===m.merchant_id).reduce((n,p)=>n+p.initial_stock,0),sold:0})),customers:roster,products},days,checkpoints,turns,
      receipts:c.nativePayments.lineage,catalog:{source:frame.catalog.mode,count:new Set(products.map(p=>p.channel3Id).filter(Boolean)).size,syncedAt:frame.catalog.syncedAt,message:frame.catalog.message},
      boundaries:{market:'Seeded simulation; motion shows representative shoppers and sampled events. Daily totals include every recorded shopper.',team:'One Gemini planner chooses tools; six office roles represent local responsibilities, not six independent LLMs.',catalog:'Channel3 provides product snapshots, not customer behavior, inventory or coupon scores.',payments:'Gold sale effects are simulated. Only verified blue PayPal receipts are native sandbox captures. Replay is read-only.'}};
    cache.set(id,{signature,value});if(cache.size>6)cache.delete(cache.keys().next().value);return value;
  }};
}
