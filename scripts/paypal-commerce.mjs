import {createHash,randomUUID} from 'node:crypto';
import {SandboxError,moneyCents} from './paypal-sandbox.mjs';
import {appendDecision} from './marketing/economy.mjs';
import {openCampaignVertex} from './marketing/autonomous-planner.mjs';
import {FLASH_LITE_PROFILE} from '../benchmark/vertex.mjs';
import {redactApprovalLinks} from './market-store.mjs';

export const PAYPAL_SERVICES=[
  {id:'vault',name:'Saved payment methods',job:'Verify the consented buyer before repeat purchases.'},
  {id:'checkout',name:'Checkout',job:'Turn a selected shopper order into a verified payment.'},
  {id:'invoicing',name:'Invoicing',job:'Give the office buyer an itemized procurement invoice.'},
  {id:'subscriptions',name:'Subscriptions',job:'Offer replenishment to a repeat buyer; wait for consent.'},
  {id:'payouts',name:'Payouts',job:'Deliver a budgeted loyalty reward to the sandbox buyer.'},
  {id:'refunds',name:'Payments · refunds',job:'Honor an approved adjustment and revise retained margin.'},
  {id:'tracking',name:'Shipment Tracking',job:'Link simulated fulfillment to its payment before follow-up marketing.'},
  {id:'reporting',name:'Transaction Search',job:'Reconcile provider records before spending earned revenue.'}
];
const stamp=()=>new Date().toISOString(),parse=x=>x?JSON.parse(x):null;
const fail=(code,message)=>{throw new SandboxError(409,code,message);};
const reqId=(id,step)=>createHash('sha256').update(id+':'+step).digest('hex').slice(0,32);
const value=cents=>(cents/100).toFixed(2);
const idOK=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{3,255}$/.test(id);
const terminal=new Set(['VERIFIED','COMPLETED','UNPAID','AWAITING_BUYER','OFFER_READY','BLOCKED']);
const PROMPT=`You are the commerce lead for Market Metro's marketing team. Select useful PayPal actions from the exact available opportunities. These are bounded sandbox tasks attached to simulated shoppers and actual Channel3 product snapshots. Distinguish observed purchase counts from AUTHORED_DEMO_REQUEST business requests. Honor the existing buyer consent; a replenishment offer is not subscription consent. Never invent receipts or claim that an invoice, pending subscription, pending payout, or simulation purchase is settled money. Evaluate the why field and financial facts. Prefer completing explicit buyer/merchant requests and verifying payment evidence; you may wait. Do not select a denied or unavailable API. Payments workers compute amounts and enforce caps; you cannot edit recipients, amounts, URLs or consent. A completed cashback cannot be clawed back automatically after a return. Explain your choice in plain language and identify the next marketing consequence. When no opportunities remain, return actions=[] and summarize the verified money movement, what is still pending, and what to change or test in the next campaign. A small sandbox sample cannot establish marketing uplift. The invoice is deliberately unpaid and the subscription deliberately unactivated in this integration trial. No buyer-response observation window exists for these offers: do not call them low-converting, high-friction, or evidence of disengagement. Shipment tracking acceptance is recorded metadata, not independent proof of real delivery. Use only the submitted evidence cutoff. Call submit_commerce_plan; return no private chain of thought.`;

export function validateCommercePlan(x,packet){
  if(!x||Object.keys(x).some(k=>!['actions','summary','evidenceDay'].includes(k))||x.evidenceDay!==packet.evidenceDay||typeof x.summary!=='string'||x.summary.length<5||x.summary.length>1200||!Array.isArray(x.actions)||x.actions.length>6)fail('INVALID_COMMERCE_PLAN','Use the current evidence day and up to six available actions.');
  const ids=new Set();
  for(const a of x.actions){if(!a||Object.keys(a).some(k=>!['actionId','reason'].includes(k))||ids.has(a.actionId)||!packet.opportunities.some(o=>o.id===a.actionId)||typeof a.reason!=='string'||a.reason.length<5||a.reason.length>1200)fail('INVALID_COMMERCE_ACTION','Choose unique available action IDs and explain each choice.');ids.add(a.actionId);}
  return x;
}

export function commerceFinancials(events,operations=[],goodsAndDeliveryCents=0){
  const successful=events.filter(e=>['COMPLETED','SUCCESS'].includes(e.status));
  const total=(kind,key)=>successful.filter(e=>e.event_type===kind).reduce((n,e)=>n+(e[key]??0),0);
  const capturedCents=total('capture','amount_cents'),refundCents=total('refund','amount_cents'),rewardCents=total('payout','amount_cents');
  const feeEvents=successful.filter(e=>['capture','payout','refund'].includes(e.event_type));
  const feesComplete=feeEvents.every(e=>Number.isInteger(e.fee_cents));
  const knownFeesCents=feeEvents.reduce((n,e)=>n+(e.fee_cents??0),0);
  const unresolved=new Set(['PENDING','PROCESSING','UNCLAIMED','ONHOLD','UNKNOWN','REQUESTED']);
  const pendingOutflowCents=operations.filter(o=>['send_reward','refund_adjustment'].includes(o.action)&&unresolved.has(o.status)).reduce((n,o)=>n+(o.amount_cents||0),0);
  const providerCashAfterCents=feesComplete?capturedCents-refundCents-rewardCents-knownFeesCents:null;
  return {capturedCents,refundCents,rewardCents,feeCents:feesComplete?knownFeesCents:null,knownFeesCents,feesComplete,pendingOutflowCents,
    providerCashAfterCents,assumedGoodsAndDeliveryCents:goodsAndDeliveryCents,modeledContributionCents:providerCashAfterCents===null?null:providerCashAfterCents-goodsAndDeliveryCents,
    scope:'Confirmed native sample events only, not the PayPal account balance. Pending outflows are separate. Goods and delivery costs are simulated; outreach is excluded. Unknown fees leave net flow unknown.'};
}

export function createPayPalCommerce({store,market,paypal,funding,clientFactory=openCampaignVertex}){
  const jobs=new Map(),inflight=new Map();let identity=null;
  const world=id=>{const w=store.state(id);if(!w)fail('RUN_NOT_FOUND','Choose an existing market.');return w;};
  const rows=id=>store.db.prepare('SELECT * FROM paypal_operations WHERE run_id=? ORDER BY created_at, rowid').all(id);
  const own=row=>{if(row.profile_key!==paypal.profileKey())fail('PAYPAL_ACCOUNT_CHANGED','Use the sandbox app that created this checkpoint.');};
  const op=id=>store.db.prepare('SELECT * FROM paypal_operations WHERE operation_id=?').get(id);
  function update(id,fields){fields.updated_at=stamp();const keys=Object.keys(fields);store.db.prepare('UPDATE paypal_operations SET '+keys.map(k=>k+'=?').join(',')+' WHERE operation_id=?').run(...keys.map(k=>fields[k]??null),id);return op(id);}
  function result(row,data,status,providerId=row.provider_id){return update(row.operation_id,{status,provider_id:providerId,result_json:JSON.stringify({...parse(op(row.operation_id).result_json),...data}),error_code:null});}
  function teamLog(id,action,message,evidence,status='DONE',actor='LOCAL_PAYPAL_WORKER'){
    const w=world(id),row=appendDecision(w,actor==='GEMINI_COMMERCE_PLANNER'?'Coordinator':'Campaign manager',action,message,{...evidence,marketTime:{day:Math.min(w.totalTicks,w.tick+1),hour:w.continuous?.hour||0},afterRun:w.tick>=w.totalTicks},status);
    row.source=actor;store.transaction(()=>{store.insert('team_decisions',[row]);store.saveState(w);});
  }
  async function buyer(){
    if(paypal.status().mode!=='SANDBOX'||!funding?.status().ready)fail('SANDBOX_BUYER_REQUIRED','Connect the approved sandbox buyer first.');
    if(identity?.fingerprint===funding.fingerprint())return identity;
    const token=funding.paymentSource().paypal.vault_id,data=await paypal.requestSandbox('/v3/vault/payment-tokens/'+encodeURIComponent(token)),p=data.payment_source?.paypal;
    if(data.id!==token||!idOK(p?.payer_id)||!p.email_address)fail('INVALID_SAVED_BUYER','PayPal did not verify the saved buyer.');
    identity={payerId:p.payer_id,email:p.email_address,fingerprint:funding.fingerprint()};return identity;
  }
  const latestReceipt=id=>store.db.prepare("SELECT * FROM paypal_receipts WHERE run_id=? AND profile_key=? AND capture_id IS NOT NULL ORDER BY created_at DESC LIMIT 1").get(id,paypal.profileKey());
  function opportunities(id){
    const w=world(id),done=new Set(rows(id).map(r=>r.action)),out=[];
    if(w.tick<30)return out;
    const product=store.db.prepare(`SELECT p.*,COUNT(o.order_id) purchase_count,COUNT(DISTINCT o.customer_id) buyers
      FROM products p JOIN order_items i USING(product_id) JOIN orders o USING(order_id)
      WHERE p.run_id=? AND p.price_cents BETWEEN 1000 AND 25000 GROUP BY p.product_id ORDER BY purchase_count DESC,p.product_id LIMIT 1`).get(id);
    const sample=market.paymentSample(id),receipt=latestReceipt(id);
    const sampleId=receipt?.order_id||(sample.candidates.find(o=>o.total_cents>=2000)||sample.candidates[0])?.order_id;
    const order=sampleId?store.db.prepare('SELECT o.*,i.product_id FROM orders o JOIN order_items i USING(order_id) WHERE o.order_id=? LIMIT 1').get(sampleId):null;
    const selected=order&&store.db.prepare('SELECT p.* FROM products p JOIN order_items i USING(product_id) WHERE i.order_id=? LIMIT 1').get(order.order_id);
    const repeat=product&&store.db.prepare('SELECT o.customer_id,COUNT(*) purchases FROM orders o JOIN order_items i USING(order_id) WHERE o.run_id=? AND i.product_id=? GROUP BY o.customer_id ORDER BY purchases DESC,o.customer_id LIMIT 1').get(id,product.product_id);
    const add=(action,service,why,target={},extra={})=>{if(!done.has(action))out.push({id:action,service,why,evidenceDay:w.tick,...target,...extra});};
    add('verify_wallet','vault','A repeat purchase needs valid saved buyer consent. Verify the token without exposing it.',{}, {source:'EXISTING_SANDBOX_CONSENT'});
    if(order&&selected&&!receipt&&sample.remaining>0)add('capture_order','checkout','Reconcile one observed shopper purchase with actual PayPal fees and net proceeds.',{orderId:order.order_id,customerId:order.customer_id,merchantId:order.merchant_id,productId:selected.product_id,amountCents:order.total_cents},{source:'OBSERVED_SIMULATION_ORDER',title:selected.title,channel3Id:selected.channel3_product_id});
    if(receipt&&!done.has('capture_order'))add('capture_order','checkout','Import and verify the existing receipt for this run; never charge twice.',{orderId:order.order_id,customerId:order.customer_id,merchantId:order.merchant_id,productId:selected.product_id,amountCents:receipt.gross_cents},{source:'EXISTING_SANDBOX_RECEIPT',title:selected.title});
    if(product&&repeat){
      const target={productId:product.product_id,customerId:repeat.customer_id,merchantId:product.merchant_id,title:product.title,channel3Id:product.channel3_product_id,observedProductPurchases:product.purchase_count,observedCustomerPurchases:repeat.purchases};
      add('create_invoice','invoicing','Demo office buyer requests an itemized quote for two units. Create a payable invoice; do not email anyone or claim payment.',target,{source:'AUTHORED_DEMO_REQUEST',amountCents:product.price_cents*2,quantity:2});
      if(repeat.purchases>=2)add('offer_subscription','subscriptions','Demo repeat buyer asks to see a monthly replenishment offer. Create one finite billing cycle and request separate buyer consent.',target,{source:'AUTHORED_DEMO_REQUEST',amountCents:product.price_cents,interval:'MONTH',cycles:1});
    }
    if(receipt?.status==='COMPLETED'&&selected){
      const target={orderId:order.order_id,customerId:order.customer_id,merchantId:order.merchant_id,productId:selected.product_id,title:selected.title,amountCents:100};
      if(receipt.gross_cents>=2000)add('send_reward','payouts','Merchant approved a $1 loyalty thank-you for this completed purchase, from its test balance. Record the payout fee; measure future retention separately.',target,{source:'AUTHORED_DEMO_REQUEST',captureId:receipt.capture_id,maxRewardCents:100});
      if(done.has('send_reward'))add('refund_adjustment','refunds','After the reward, the demo buyer reports a packing defect. Merchant policy approves a $1 partial refund. Do not pretend the earlier reward can be recovered.',target,{source:'AUTHORED_DEMO_REQUEST',captureId:receipt.capture_id,maxRefundCents:100});
    }
    if(receipt&&selected&&['COMPLETED','PARTIALLY_REFUNDED'].includes(receipt.status)){
      const delivery=store.db.prepare("SELECT * FROM deliveries WHERE run_id=? AND order_id=? AND status='DELIVERED' AND source='SIMULATED'").get(id,receipt.order_id);
      if(delivery)add('record_shipment','tracking','The warehouse has a simulated completed delivery for this paid order. Link that fulfillment record to PayPal before deciding on post-purchase follow-ups. Provider acceptance confirms the uploaded metadata, not an independent carrier check.',{orderId:order.order_id,customerId:order.customer_id,merchantId:order.merchant_id,productId:selected.product_id,title:selected.title,amountCents:0},{source:'SIMULATED_DELIVERY_RECORD',deliveryId:delivery.delivery_id,deliveryStatus:delivery.status,simulationDeliveredAt:delivery.event_ts,captureId:receipt.capture_id});
    }
    add('reconcile_transactions','reporting','Check actual provider transaction history. Missing access or reporting lag must not be replaced with generated rows.',{}, {source:'PROVIDER_RECONCILIATION'});
    return out;
  }
  function packet(id){
    const w=world(id),records=rows(id),events=store.db.prepare('SELECT * FROM paypal_money_events WHERE run_id=?').all(id);
    const paid=new Set(events.filter(e=>e.event_type==='capture'&&e.status==='COMPLETED').map(e=>e.operation_id));
    const costs=records.filter(r=>paid.has(r.operation_id)).reduce((n,r)=>{const o=store.db.prepare('SELECT cost_cents,delivery_cost_cents FROM orders WHERE order_id=?').get(r.order_id);return n+(o?.cost_cents||0)+(o?.delivery_cost_cents||0);},0);
    return {runId:id,evidenceDay:w.tick,goal:'Fulfill the merchant and buyer requests using appropriate PayPal services; then revise marketing based on actual retained money.',opportunities:opportunities(id),completed:records.map(r=>({service:r.service,action:r.action,status:r.status,result:redactApprovalLinks(parse(r.result_json)),error:r.error_code})),moneyEvents:events,financials:commerceFinancials(events,records,costs),limits:{checkoutSampleCents:100000,rewardCents:100,refundCents:100,invoiceUnits:2,subscriptionCycles:1},disclosure:'Additional office, replenishment, loyalty and packing-defect requests are authored demo cases. Behavior and cost of goods are simulated. Native PayPal states and fees are fetched from sandbox. Do not infer causal uplift or actual retail-merchant permissions.'};
  }
  function money(row,type,id,status,cents,fee,at){
    if(!idOK(id)||!Number.isInteger(cents)||cents<0)fail('INVALID_MONEY_EVIDENCE','Provider money evidence failed validation.');
    store.db.prepare(`INSERT INTO paypal_money_events VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(event_id) DO UPDATE SET status=excluded.status,amount_cents=excluded.amount_cents,fee_cents=excluded.fee_cents,provider_at=excluded.provider_at,recorded_at=excluded.recorded_at`).run(row.operation_id+'-'+type,row.run_id,row.operation_id,row.order_id,row.customer_id,row.merchant_id,type,id,status,cents,fee??null,'USD',at||null,stamp(),'PAYPAL_SANDBOX');
  }
  async function verifyCapture(row,readOnly=false){
    let receipt=store.db.prepare('SELECT * FROM paypal_receipts WHERE run_id=? AND order_id=?').get(row.run_id,row.order_id);
    if(!receipt){if(readOnly)fail('CAPTURE_NOT_CONFIRMED','The original receipt is missing; readback cannot create another payment.');await market.mirror(row.run_id,[row.order_id]);receipt=store.db.prepare('SELECT * FROM paypal_receipts WHERE run_id=? AND order_id=?').get(row.run_id,row.order_id);}
    else if(receipt.paypal_order_id)await market.refreshReceipt(receipt.receipt_id,{readOnly});
    receipt=store.db.prepare('SELECT * FROM paypal_receipts WHERE run_id=? AND order_id=?').get(row.run_id,row.order_id);
    if(receipt?.profile_key!==paypal.profileKey()||!receipt.capture_id)fail(receipt?.error_code||'CAPTURE_NOT_CONFIRMED','No native capture is confirmed for this shopper order.');
    const received=['COMPLETED','PARTIALLY_REFUNDED','REFUNDED'].includes(receipt.status);
    money(row,'capture',receipt.capture_id,received?'COMPLETED':receipt.status,receipt.gross_cents,receipt.fee_cents,receipt.captured_at);
    return result(row,{orderId:receipt.paypal_order_id,captureId:receipt.capture_id,grossCents:receipt.gross_cents,feeCents:receipt.fee_cents,netCents:receipt.net_cents,providerStatus:receipt.status,meaning:received?'PayPal verified the original capture. Refunds are recorded separately; this is not additional simulated revenue.':'The provider has not confirmed a completed capture.'},receipt.status,receipt.capture_id);
  }
  async function perform(row,readOnly=false){
    own(row);if(readOnly&&!row.provider_id)return row;const input=parse(row.evidence_json),saved=parse(row.result_json)||{},call=(path,step,body)=>paypal.requestSandbox(path,{method:'POST',requestId:reqId(row.request_id,step),body});
    if(row.action==='verify_wallet'){await buyer();return result(row,{ready:true,approvedAt:funding.status().approvedAt,meaning:'Existing sandbox consent verified. No subscription consent implied.'},'VERIFIED');}
    if(row.action==='capture_order'){await buyer();return verifyCapture(row,readOnly);}
    if(row.action==='create_invoice'){
      const b=await buyer();let id=row.provider_id;
      if(!id){const d=await call('/v2/invoicing/invoices','create',{detail:{currency_code:'USD',invoice_number:'MM-'+reqId(row.operation_id,'invoice').slice(0,20),reference:row.operation_id.slice(0,120),invoice_date:stamp().slice(0,10),payment_term:{term_type:'DUE_ON_RECEIPT'},note:'Sandbox office procurement demo. No goods will ship.'},primary_recipients:[{billing_info:{email_address:b.email}}],items:[{name:input.title.slice(0,127),quantity:'2',unit_amount:{currency_code:'USD',value:value(row.amount_cents/2)}}],configuration:{allow_tip:false,partial_payment:{allow_partial_payment:false}}});id=d.id;
        if(!id){let link;try{link=new URL(d.href||d.links?.find(l=>l.rel==='self')?.href);}catch{}if(link?.protocol==='https:'&&['api-m.sandbox.paypal.com','api.sandbox.paypal.com'].includes(link.hostname))id=link.pathname.match(/^\/v2\/invoicing\/invoices\/(INV2-[A-Z0-9-]+)$/)?.[1];}
        if(!idOK(id))fail('INVALID_INVOICE','PayPal returned no invoice ID.');result(row,{invoiceId:id},'CREATED',id);}
      let d=await paypal.requestSandbox('/v2/invoicing/invoices/'+id);
      if(d.status==='DRAFT'&&!readOnly){await call('/v2/invoicing/invoices/'+id+'/send','send',{send_to_recipient:false,send_to_invoicer:false});d=await paypal.requestSandbox('/v2/invoicing/invoices/'+id);}
      if(d.id!==id||moneyCents(d.amount)!==row.amount_cents)fail('INVOICE_MISMATCH','The invoice amount does not match the agent checkpoint.');
      const href=d.detail?.metadata?.recipient_view_url||d.links?.find(l=>l.rel==='payer-view')?.href;
      return result(row,{invoiceId:id,amountCents:row.amount_cents,paymentUrl:href?sandboxUrl(href):null,meaning:d.status==='PAID'?'PayPal marks this invoice paid. Invoice collection is separate from the checkout sample ledger.':d.status==='CANCELLED'?'Invoice cancelled; no payment is claimed.':'Invoice issued; payment is not yet confirmed.',emailsSent:false},d.status||'UNPAID',id);
    }
    if(row.action==='offer_subscription'){
      if(readOnly&&!saved.subscriptionId)return row;
      const b=await buyer();let {productId,planId}=saved;
      if(!productId){const p=await call('/v1/catalogs/products','product',{name:('Market Metro · '+input.title).slice(0,127),description:'Sandbox replenishment offer for a simulated shopper. No real goods.',type:'PHYSICAL'});if(!idOK(p.id))fail('INVALID_SUBSCRIPTION_PRODUCT','Missing PayPal product.');productId=p.id;result(row,{productId},'CREATED');}
      if(!planId){const p=await call('/v1/billing/plans','plan',{product_id:productId,name:'One monthly replenishment · Sandbox',status:'ACTIVE',billing_cycles:[{frequency:{interval_unit:'MONTH',interval_count:1},tenure_type:'REGULAR',sequence:1,total_cycles:1,pricing_scheme:{fixed_price:{value:value(row.amount_cents),currency_code:'USD'}}}],payment_preferences:{auto_bill_outstanding:false,payment_failure_threshold:1}});if(!idOK(p.id))fail('INVALID_SUBSCRIPTION_PLAN','Missing PayPal plan.');planId=p.id;result(row,{productId,planId},'OFFER_READY',planId);}
      const plan=await paypal.requestSandbox('/v1/billing/plans/'+planId),cycle=plan.billing_cycles?.[0];
      if(plan.id!==planId||plan.product_id!==productId||plan.billing_cycles?.length!==1||cycle?.total_cycles!==1||cycle.frequency?.interval_unit!=='MONTH'||cycle.frequency?.interval_count!==1||moneyCents(cycle.pricing_scheme?.fixed_price)!==row.amount_cents)fail('SUBSCRIPTION_PLAN_MISMATCH','PayPal plan terms do not match the approved finite offer.');
      let id=op(row.operation_id).result_json&&parse(op(row.operation_id).result_json).subscriptionId;
      if(!id){const d=await call('/v1/billing/subscriptions','subscription',{plan_id:planId,custom_id:row.operation_id,subscriber:{email_address:b.email},application_context:{brand_name:'Market Metro Sandbox',shipping_preference:'NO_SHIPPING',user_action:'SUBSCRIBE_NOW',return_url:'http://127.0.0.1:4173/?run='+encodeURIComponent(row.run_id)+'&paypalServices=1',cancel_url:'http://127.0.0.1:4173/?run='+encodeURIComponent(row.run_id)+'&paypalServices=1'}});if(!idOK(d.id))fail('INVALID_SUBSCRIPTION','Missing subscription ID.');id=d.id;result(row,{subscriptionId:id,approvalUrl:d.links?.find(l=>l.rel==='approve')?.href?sandboxUrl(d.links.find(l=>l.rel==='approve').href):null},'AWAITING_BUYER',id);}
      const d=await paypal.requestSandbox('/v1/billing/subscriptions/'+id);
      if(d.id!==id||d.plan_id!==planId||d.custom_id!==row.operation_id)fail('SUBSCRIPTION_MISMATCH','The subscription does not match this offer.');
      const awaiting=['APPROVAL_PENDING','APPROVED'].includes(d.status),state=d.status==='ACTIVE'?'VERIFIED':awaiting?'AWAITING_BUYER':d.status||'UNKNOWN';
      return result(row,{subscriptionId:id,planId,productId,providerStatus:d.status,cycles:1,approvalUrl:awaiting?saved.approvalUrl||parse(op(row.operation_id).result_json).approvalUrl:null,meaning:d.status==='ACTIVE'?'Buyer approved one monthly billing cycle. Check payments separately.':awaiting?'Offer prepared. Separate buyer approval is required; no payment is claimed.':`PayPal subscription state: ${d.status||'unknown'}. No active renewal is assumed.`},state,id);
    }
    if(row.action==='send_reward'){
      const b=await buyer(),receipt=latestReceipt(row.run_id);
      if(!receipt||receipt.order_id!==row.order_id||(!row.provider_id&&receipt.status!=='COMPLETED')||row.amount_cents!==100||receipt.gross_cents<2000)fail('REWARD_NOT_ELIGIBLE','A verified $20+ capture and the $1 campaign cap are required.');
      if(receipt.funding_method!=='PAYPAL_WALLET_VAULT'||receipt.funding_key!==funding.fingerprint())fail('FUNDING_CHANGED','The reward must go to the same saved sandbox buyer as its purchase.');
      let id=row.provider_id;
      if(!id){const d=await call('/v1/payments/payouts','payout',{sender_batch_header:{sender_batch_id:row.request_id,email_subject:'Market Metro sandbox loyalty reward'},items:[{recipient_type:'PAYPAL_ID',receiver:b.payerId,recipient_wallet:'PAYPAL',amount:{value:'1.00',currency:'USD'},sender_item_id:row.operation_id,note:'Sandbox loyalty campaign. Fictitious funds only.'}]});id=d.batch_header?.payout_batch_id;if(!idOK(id))fail('INVALID_PAYOUT','Missing payout batch ID.');result(row,{batchId:id},'PENDING',id);}
      const d=await paypal.requestSandbox('/v1/payments/payouts/'+id),item=d.items?.find(i=>i.payout_item?.sender_item_id===row.operation_id);
      if(!item)return result(row,{batchId:id,batchStatus:d.batch_header?.batch_status,meaning:'Waiting for the individual reward outcome.'},'PENDING',id);
      if(item.payout_item.receiver!==b.payerId||payoutCents(item.payout_item.amount)!==100)fail('PAYOUT_MISMATCH','Recipient or reward amount did not match.');
      const fee=item.payout_item_fee?payoutCents(item.payout_item_fee):null;
      money(row,'payout',item.payout_item_id,item.transaction_status,100,fee,item.time_processed);
      return result(row,{batchId:id,itemId:item.payout_item_id,transactionId:item.transaction_id||null,amountCents:100,feeCents:fee,providerStatus:item.transaction_status,meaning:'Reward delivery is determined by the item status, not the batch status.'},item.transaction_status==='SUCCESS'?'COMPLETED':item.transaction_status,id);
    }
    if(row.action==='record_shipment'){
      const receipt=latestReceipt(row.run_id),delivery=store.db.prepare('SELECT * FROM deliveries WHERE run_id=? AND order_id=? AND delivery_id=?').get(row.run_id,row.order_id,input.deliveryId);
      if(!receipt||receipt.capture_id!==input.captureId||receipt.order_id!==row.order_id||!delivery||delivery.status!=='DELIVERED'||delivery.source!=='SIMULATED')fail('DELIVERY_EVIDENCE_MISMATCH','Use the saved simulated delivery belonging to this captured order.');
      const trackingNumber='MMDEMO'+reqId(delivery.delivery_id,'shipment').slice(0,14).toUpperCase(),trackingId=receipt.capture_id+'-'+trackingNumber;
      const orderPath='/v2/checkout/orders/'+receipt.paypal_order_id;
      const findTracker=d=>{
        const unit=d.purchase_units?.find(u=>u.custom_id===row.order_id&&u.payments?.captures?.some(c=>c.id===receipt.capture_id));
        if(d.id!==receipt.paypal_order_id||!unit)fail('TRACKING_ORDER_MISMATCH','Tracking must belong to this captured emulator order.');
        return unit.shipping?.trackers?.find(t=>t.id===trackingId);
      };
      let tracker=findTracker(await paypal.requestSandbox(orderPath));
      if(!tracker&&!readOnly){
        await call(orderPath+'/track','tracking-v2',{capture_id:receipt.capture_id,tracking_number:trackingNumber,carrier:'OTHER',carrier_name_other:'Market Metro simulated courier',notify_payer:false});
        tracker=findTracker(await paypal.requestSandbox(orderPath));
      }
      if(!tracker||!['SHIPPED','DELIVERED'].includes(tracker.status))fail('TRACKING_NOT_ACCEPTED','PayPal did not verify the linked shipment record.');
      return result(row,{trackingId,trackingNumber,deliveryId:delivery.delivery_id,providerStatus:tracker.status,deliverySource:'SIMULATED',api:'ORDERS_V2_TRACKING',meaning:'PayPal stored the tracking record with status '+tracker.status+'. Physical delivery remains simulated; no funds release or buyer engagement is inferred.'},'VERIFIED',trackingId);
    }
    if(row.action==='refund_adjustment'){
      const receipt=latestReceipt(row.run_id);
      if(!receipt||receipt.order_id!==row.order_id||receipt.capture_id!==input.captureId||row.amount_cents!==100||receipt.gross_cents<2000)fail('REFUND_NOT_ELIGIBLE','Use the approved $1 adjustment for this captured sample only.');
      let id=row.provider_id;
      if(!id){const d=await call('/v2/payments/captures/'+receipt.capture_id+'/refund','refund',{amount:{value:'1.00',currency_code:'USD'},invoice_id:'MM-R-'+row.request_id.slice(0,20),note_to_payer:'Sandbox packing-defect adjustment; authored demo case.'});id=d.id;if(!idOK(id))fail('INVALID_REFUND','Missing refund ID.');result(row,{refundId:id,captureId:receipt.capture_id},'PENDING',id);}
      const d=await paypal.requestSandbox('/v2/payments/refunds/'+id);
      if(d.id!==id||moneyCents(d.amount)!==100)fail('REFUND_MISMATCH','The verified refund did not match this adjustment.');
      const merchantDebit=d.seller_payable_breakdown?.net_amount?moneyCents(d.seller_payable_breakdown.net_amount):null;
      money(row,'refund',id,d.status,100,merchantDebit===null?null:merchantDebit-100,d.create_time);
      return result(row,{refundId:id,captureId:receipt.capture_id,amountCents:100,merchantDebitCents:merchantDebit,meaning:'Retained revenue falls by $1. Any already-delivered reward remains a cost.'},d.status,id);
    }
    if(row.action==='reconcile_transactions'){
      const end=new Date(),start=new Date(end.getTime()-7*86400000);
      const d=await paypal.requestSandbox('/v1/reporting/transactions?start_date='+encodeURIComponent(start.toISOString())+'&end_date='+encodeURIComponent(end.toISOString())+'&fields=transaction_info&page_size=100');
      const references=new Set(store.db.prepare('SELECT capture_id FROM paypal_receipts WHERE run_id=?').all(row.run_id).map(r=>r.capture_id).filter(Boolean));
      const matching=(d.transaction_details||[]).filter(t=>references.has(t.transaction_info?.transaction_id));
      return result(row,{returned:d.transaction_details?.length||0,matched:matching.map(t=>({id:t.transaction_info.transaction_id,status:t.transaction_info.transaction_status})),reportedThrough:d.last_refreshed_datetime||null,meaning:'Only matching transaction IDs are attributed to this run. Reporting may lag.'},'VERIFIED');
    }
    fail('UNKNOWN_COMMERCE_ACTION','Unknown PayPal action.');
  }
  async function execute(id,actionId,{rationale,actor='USER_APPROVED_DEMO',candidate}={}){
    world(id);if(typeof rationale!=='string'||rationale.length<5||rationale.length>1400)fail('RATIONALE_REQUIRED','Record why this payment action is useful.');
    const operationId=id+'-PP-'+actionId;
    if(inflight.has(operationId))return inflight.get(operationId);
    const task=(async()=>{
      let row=op(operationId);
      if(row){own(row);if(terminal.has(row.status)||row.status==='FAILED'||row.status==='UNKNOWN')return row;}
      else{
        const c=candidate||opportunities(id).find(o=>o.id===actionId);
        if(!c||c.id!==actionId||!opportunities(id).some(o=>o.id===actionId))fail('ACTION_UNAVAILABLE','This action is not available on the current evidence.');
        row={operation_id:operationId,run_id:id,service:c.service,action:actionId,status:'REQUESTED',evidence_day:c.evidenceDay,actor,rationale,evidence_json:JSON.stringify(c),order_id:c.orderId,customer_id:c.customerId,product_id:c.productId,merchant_id:c.merchantId,amount_cents:c.amountCents||0,currency:'USD',profile_key:paypal.profileKey(),request_id:randomUUID(),created_at:stamp(),updated_at:stamp(),source:'PAYPAL_SANDBOX'};store.insert('paypal_operations',[row]);
        teamLog(id,'PAYPAL_ACTION_SELECTED',rationale,{service:c.service,actionId,operationId,evidence:c},'RUNNING',actor);
      }
      try{const r=await perform(row);teamLog(id,'PAYPAL_ACTION_RESULT',`${PAYPAL_SERVICES.find(s=>s.id===r.service)?.name}: ${r.status}. ${parse(r.result_json)?.meaning||'Provider result saved.'}`,{operationId,service:r.service,result:parse(r.result_json),asOfDay:r.evidence_day},r.status);return r;}
      catch(e){const code=e.code||'PAYPAL_WORKER_FAILED',status=code==='NOT_AUTHORIZED'||code.includes('PERMISSION')?'BLOCKED':code==='PAYPAL_UNCONFIRMED'?'UNKNOWN':'FAILED';const r=update(operationId,{status,error_code:code});teamLog(id,'PAYPAL_ACTION_RESULT',`${row.service}: ${code}. No successful payment is assumed.`,{operationId,service:row.service,error:code},status);return r;}
    })();inflight.set(operationId,task);try{return await task;}finally{inflight.delete(operationId);}
  }
  async function refresh(id){
    for(const r of rows(id)){own(r);if(r.provider_id&&!['FAILED','UNKNOWN','BLOCKED'].includes(r.status))try{await perform(r,true);}catch(e){update(r.operation_id,{error_code:e.code||'REFRESH_FAILED'});}}
    return snapshot(id);
  }
  async function retryFulfillment(id){
    const row=op(id+'-PP-record_shipment');
    if(!row||row.action!=='record_shipment'||row.status!=='FAILED'||row.error_code!=='PAYPAL_REQUEST_FAILED'||parse(row.result_json)?.adapterRepairAttempted)fail('FULFILLMENT_RETRY_UNAVAILABLE','Only the failed legacy tracking request can use this metadata-only repair.');
    own(row);
    update(row.operation_id,{status:'REQUESTED',error_code:null,result_json:JSON.stringify({...parse(row.result_json),adapterRepairAttempted:true,previousError:row.error_code})});
    teamLog(id,'PAYPAL_TRACKING_ADAPTER_REPAIR','Use the documented Orders v2 shipment endpoint and read the existing order before any metadata write. No new financial action or model call.',{operationId:row.operation_id,previousError:row.error_code},'RUNNING');
    await execute(id,'record_shipment',{rationale:row.rationale,actor:row.actor});return snapshot(id);
  }
  function snapshot(id){
    const p=packet(id),records=rows(id).map(({profile_key,request_id,...r})=>({...r,evidence:parse(r.evidence_json),result:parse(r.result_json),evidence_json:undefined,result_json:undefined}));
    const services=PAYPAL_SERVICES.map(s=>{const r=records.find(r=>r.service===s.id);return {...s,status:r?.error_code&&!['FAILED','UNKNOWN','BLOCKED'].includes(r.status)?'NEEDS_REVIEW':r?.status||'NOT_RUN',operationId:r?.operation_id,result:r?.result||null,error:r?.error_code||null,verified:Boolean(r?.result&&!r.error_code&&r.status!=='FAILED'&&r.status!=='UNKNOWN'&&r.status!=='BLOCKED')};});
    const calls=store.db.prepare("SELECT stage,status,choice_json,provider_json,started_at,finished_at FROM marketing_planner_calls WHERE run_id=? AND stage IN ('commerce','commerce_fulfillment') ORDER BY rowid").all(id).map(r=>({...r,choice:parse(r.choice_json),provider:parse(r.provider_json),assessment:parse(r.choice_json)?.actions?.length===0?'REQUIRES_OUTCOME_DATA':'ACTION_PROPOSAL',assessmentNote:parse(r.choice_json)?.actions?.length===0?'No buyer-response window was observed. Intentionally unpaid invoices and unactivated offers do not establish conversion or engagement.':'Recorded before provider execution; actual results are in the operation checkpoints.',choice_json:undefined,provider_json:undefined}));
    return {...p,operations:records,services,verifiedServices:services.filter(s=>s.verified).length,goalServices:6,running:jobs.has(id),calls,modelCostMicros:calls.reduce((n,c)=>n+(c.provider?.modelCostMicros||0),0)};
  }
  async function review(id,{fulfillmentOnly=false}={}){
    if(jobs.has(id))return jobs.get(id);
    const w=world(id);if(w.tick<30)fail('HISTORY_NOT_READY','Collect at least 30 days before the PayPal team review.');
    if(w.continuous&&!fulfillmentOnly){w.continuous.paypalCommerceEnabled=true;store.saveState(w);}
    const job=(async()=>{let resources;
      try{
        resources=await clientFactory(w.continuous?.budgetId||id);
        for(let turn=0;turn<(fulfillmentOnly?1:4);turn++){
          const packetNow=packet(id);if(fulfillmentOnly){packetNow.opportunities=packetNow.opportunities.filter(o=>o.id==='record_shipment');packetNow.goal='Review whether linking the observed simulated delivery to its existing sandbox payment is useful. Only shipment metadata can be written; no purchase, payout, refund, invoice, subscription activation or balance change is available.';}if(!packetNow.opportunities.length&&turn===0)break;
          const stage=fulfillmentOnly?'commerce_fulfillment':'commerce',count=store.db.prepare("SELECT COUNT(*) n FROM marketing_planner_calls WHERE run_id=? AND stage=?").get(id,stage).n;
          if(count>=(fulfillmentOnly?1:4))break;
          const callId=id+(fulfillmentOnly?'-FULFILLMENT-':'-COMMERCE-')+(count+1),before=resources.client.events.length;
          store.insert('marketing_planner_calls',[{call_id:callId,run_id:id,budget_id:w.continuous?.budgetId||id,review_id:callId,stage,attempt:1,evidence_day:packetNow.evidenceDay,model:FLASH_LITE_PROFILE.model,status:'REQUESTED',input_json:JSON.stringify({system:PROMPT,payload:packetNow}),started_at:stamp()}]);
          let choice,error,status='FAILED';
          try{
            const raw=await resources.client.json(PROMPT,packetNow,{caseId:id,trialId:id,stage,functions:[{name:'submit_commerce_plan',description:'Choose useful bounded PayPal actions for the supplied business requests.',parameters:{type:'OBJECT',properties:{actions:{type:'ARRAY',items:{type:'OBJECT',properties:{actionId:{type:'STRING',...(packetNow.opportunities.length?{enum:packetNow.opportunities.map(o=>o.id)}:{})},reason:{type:'STRING'}},required:['actionId','reason']}},summary:{type:'STRING'},evidenceDay:{type:'INTEGER'}},required:['actions','summary','evidenceDay']}}]});
            if(raw?.name!=='submit_commerce_plan')fail('INVALID_COMMERCE_TOOL','Use submit_commerce_plan.');choice=validateCommercePlan(raw.args,packetNow);status='VALIDATED';
          }catch(e){error={code:e.code||e.message||'COMMERCE_PLANNER_FAILED'};throw e;}
          finally{
            const event=resources.client.events.slice(before).at(-1)||null,current=world(id);
            if(event&&current.continuous){current.continuous.modelCalls++;current.continuous.modelCostMicros+=event.modelCostMicros||0;if(event.status==='uncertain')current.continuous.unmeteredCostMicros+=event.reservedMicros||30000;store.saveState(current);}
            store.db.prepare('UPDATE marketing_planner_calls SET status=?,choice_json=?,provider_json=?,error_json=?,decision_day=?,decision_hour=?,finished_at=? WHERE call_id=?').run(status,choice?JSON.stringify(choice):null,event?JSON.stringify(event):null,error?JSON.stringify(error):null,current.tick,current.continuous?.hour||0,stamp(),callId);
          }
          teamLog(id,'PAYPAL_TEAM_PLAN',choice.summary,{choice,asOfDay:packetNow.evidenceDay},'DONE','GEMINI_COMMERCE_PLANNER');
          if(!choice.actions.length)break;
          for(const a of choice.actions)await execute(id,a.actionId,{rationale:a.reason,actor:'GEMINI_COMMERCE_PLANNER',candidate:packetNow.opportunities.find(o=>o.id===a.actionId)});
        }
      }finally{await resources?.close();jobs.delete(id);}
      return snapshot(id);
    })();jobs.set(id,job);return job;
  }
  return {snapshot,packet,opportunities,execute,refresh,review,retryFulfillment,reviewFulfillment:id=>review(id,{fulfillmentOnly:true}),async close(){await Promise.allSettled([...jobs.values(),...inflight.values()]);}};
}
function payoutCents(money){return moneyCents({value:money?.value,currency_code:money?.currency});}
function sandboxUrl(href){let url;try{url=new URL(href);}catch{fail('INVALID_PROVIDER_LINK','Missing sandbox link.');}if(url.protocol!=='https:'||!['sandbox.paypal.com','www.sandbox.paypal.com'].includes(url.hostname)||url.username||url.password||(url.port&&url.port!=='443'))fail('INVALID_PROVIDER_LINK','Only PayPal sandbox links are allowed.');return url.href;}
