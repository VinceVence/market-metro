import test from 'node:test';
import assert from 'node:assert/strict';
import {createMarketStore} from '../scripts/market-store.mjs';
import {createMarketService} from '../scripts/market-service.mjs';
import {createContinuousMarket} from '../scripts/marketing/continuous-market.mjs';
import {createPayPalCommerce,validateCommercePlan,commerceFinancials} from '../scripts/paypal-commerce.mjs';
import {SandboxError} from '../scripts/paypal-sandbox.mjs';
import {SAMPLE_PRODUCTS} from '../demo/market/engine.mjs';

function fixture(t,{payoutStatus='SUCCESS',uncertainPayout=false,trackingDeniedOnce=false,clientFactory}={}){
  const store=createMarketStore(),calls=[],objects=new Map();let serial=0;
  const paypal={status:()=>({configured:true,mode:'SANDBOX'}),profileKey:()=> 'test-profile',list:()=>[],async requestSandbox(path,options={}){
    const {method='GET',body}=options;calls.push({path,method,body,requestId:options.requestId});
    if(path.startsWith('/v3/vault/payment-tokens/'))return {id:'WALLET_TEST',payment_source:{paypal:{payer_id:'BUYER_TEST',email_address:'buyer@example.test'}}};
    if(path.startsWith('/v1/reporting/'))throw new SandboxError(502,'NOT_AUTHORIZED','Fixture permission denied');
    if(method==='GET')return structuredClone(objects.get(path));
    if(path==='/v2/checkout/orders'){
      const d={id:'ORDERTEST'+(++serial),status:'APPROVED',purchase_units:body.purchase_units};objects.set('/v2/checkout/orders/'+d.id,d);return structuredClone(d);
    }
    if(path.endsWith('/capture')){
      const d=objects.get(path.replace('/capture','')),a=d.purchase_units[0].amount,cents=Math.round(Number(a.value)*100);
      d.status='COMPLETED';d.purchase_units[0].payments={captures:[{id:'CAPTURETEST'+(++serial),status:'COMPLETED',amount:a,create_time:new Date().toISOString(),seller_receivable_breakdown:{gross_amount:a,paypal_fee:{currency_code:'USD',value:'0.49'},net_amount:{currency_code:'USD',value:((cents-49)/100).toFixed(2)}}}]};return structuredClone(d);
    }
    if(path==='/v2/invoicing/invoices'){
      const id='INV2-TEST-'+(++serial),amount={currency_code:'USD',value:(Number(body.items[0].quantity)*Number(body.items[0].unit_amount.value)).toFixed(2)};
      const d={id,status:'DRAFT',amount,detail:{metadata:{recipient_view_url:'https://www.sandbox.paypal.com/invoice/p/#'+id}}};objects.set(path+'/'+id,d);return structuredClone(d);
    }
    if(path.endsWith('/send')){assert.equal(body.send_to_recipient,false);assert.equal(body.send_to_invoicer,false);objects.get(path.replace('/send','')).status='UNPAID';return {};}
    if(path==='/v1/catalogs/products')return {id:'PROD-TEST-'+(++serial)};
    if(path==='/v1/billing/plans'){assert.equal(body.billing_cycles[0].total_cycles,1);const d={...body,id:'P-TEST-'+(++serial)};objects.set(path+'/'+d.id,d);return structuredClone(d);}
    if(path==='/v1/billing/subscriptions'){
      const d={id:'I-TEST-'+(++serial),plan_id:body.plan_id,custom_id:body.custom_id,status:'APPROVAL_PENDING',links:[{rel:'approve',href:'https://www.sandbox.paypal.com/approve/test'}]};objects.set(path+'/'+d.id,d);return structuredClone(d);
    }
    if(path==='/v1/payments/payouts'){
      if(uncertainPayout)throw new SandboxError(502,'PAYPAL_UNCONFIRMED','No response');
      assert.equal(body.items[0].receiver,'BUYER_TEST');const id='BATCH-TEST-'+(++serial),d={batch_header:{payout_batch_id:id,batch_status:'SUCCESS'},items:[{payout_item_id:'ITEM-TEST-'+serial,transaction_id:'TRANS-TEST-'+serial,transaction_status:payoutStatus,payout_item:body.items[0],payout_item_fee:{currency:'USD',value:'0.25'}}]};objects.set(path+'/'+id,d);return structuredClone(d);
    }
    if(path.endsWith('/track')){if(trackingDeniedOnce){trackingDeniedOnce=false;throw new SandboxError(502,'PAYPAL_REQUEST_FAILED','Fixture legacy tracking denial');}assert.equal(body.notify_payer,false);assert.equal(body.carrier,'OTHER');const order=objects.get(path.replace('/track','')),unit=order.purchase_units[0];unit.shipping={trackers:[{id:body.capture_id+'-'+body.tracking_number,status:'SHIPPED'}]};return structuredClone(order);}
    if(path.endsWith('/refund')){for(const o of objects.values())for(const u of o.purchase_units||[])for(const c of u.payments?.captures||[])if(path.includes(c.id))c.status='PARTIALLY_REFUNDED';const d={id:'REFUND-TEST-'+(++serial),status:'COMPLETED',amount:body.amount,seller_payable_breakdown:{net_amount:body.amount},create_time:new Date().toISOString()};objects.set('/v2/payments/refunds/'+d.id,d);return structuredClone(d);}
    throw new Error('UNEXPECTED_TEST_CALL '+method+' '+path);
  }};
  const funding={status:()=>({ready:true,mode:'SANDBOX',approvedAt:'2026-10-20T00:00:00Z'}),fingerprint:()=> 'test-wallet',paymentSource:()=>({paypal:{vault_id:'WALLET_TEST'}})};
  const catalog={products:()=>structuredClone(SAMPLE_PRODUCTS),status:()=>({mode:'SAMPLE'})},market=createMarketService({store,paypal,funding,catalog});
  const live=createContinuousMarket({store,market,autoTimers:false,clientFactory:()=>{throw Error('NO_PAID_CALLS');}});
  const id=live.start({clockUnit:'day',requestId:'paypal-commerce-test',seed:314,mode:'local'}).runId;for(let i=0;i<3;i++)live.tick(id,{triggerReview:false});
  const commerce=createPayPalCommerce({store,market,paypal,funding,clientFactory:clientFactory||(()=>{throw Error('NO_PAID_CALLS');})});
  t.after(async()=>{await commerce.close();await live.close();store.close();});
  return {store,market,commerce,id,calls,objects,funding,live};
}
async function executeAvailable(f){for(const o of f.commerce.opportunities(f.id))await f.commerce.execute(f.id,o.id,{rationale:'Test the stated business request against the saved evidence.'});}

test('six services retain shopper lineage and truthful money states; replay cannot duplicate charges',async t=>{
  const f=fixture(t);await executeAvailable(f);await executeAvailable(f);await executeAvailable(f);
  const s=f.commerce.snapshot(f.id);
  assert.equal(s.verifiedServices,6,JSON.stringify(s.services));assert.equal(s.services.find(x=>x.id==='reporting').status,'BLOCKED');
  assert.equal(s.services.find(x=>x.id==='invoicing').status,'UNPAID');assert.equal(s.services.find(x=>x.id==='subscriptions').status,'AWAITING_BUYER');
  assert.equal(s.financials.rewardCents,100);assert.equal(s.financials.refundCents,100);assert.equal(s.financials.feeCents,74);
  assert.equal(s.financials.providerCashAfterCents,s.financials.capturedCents-274);
  assert.equal(s.moneyEvents.length,3);assert(s.operations.every(o=>o.rationale&&Number.isInteger(o.evidence_day)));
  const before=f.calls.filter(c=>c.method==='POST').length;
  await f.commerce.refresh(f.id);
  assert.equal(f.store.table('v_paypal_order_lineage',f.id).rows[0].amount_verified,1);assert.equal(f.commerce.snapshot(f.id).financials.capturedCents,s.financials.capturedCents);
  await f.commerce.execute(f.id,'send_reward',{rationale:'Replay the same existing checkpoint without another reward.'});
  assert.equal(f.calls.filter(c=>c.method==='POST').length,before);
  const exported=JSON.stringify(f.store.export(f.id));assert(!exported.includes('WALLET_TEST'));assert(!exported.includes('buyer@example.test'));assert(!exported.includes('test-profile'));assert(!exported.includes('https://www.sandbox.paypal.com/approve/test'));assert(!JSON.stringify(f.store.table('paypal_operations',f.id)).includes('https://www.sandbox.paypal.com/approve/test'));assert(!f.store.table('paypal_operations',f.id).columns.includes('request_id'));
  await assert.rejects(()=>f.commerce.execute(f.id,'arbitrary_transfer',{rationale:'Try an unrecognized payment action.'}),/not available/);
});

test('batch success cannot claim an unclaimed payout was delivered; unknown POST is not retried',async t=>{
  const f=fixture(t,{payoutStatus:'UNCLAIMED'});await executeAvailable(f);await executeAvailable(f);
  assert.equal(f.commerce.snapshot(f.id).financials.rewardCents,0);assert.equal(f.commerce.snapshot(f.id).services.find(x=>x.id==='payouts').status,'UNCLAIMED');
  const g=fixture(t,{uncertainPayout:true});await executeAvailable(g);await executeAvailable(g);
  const before=g.calls.length;await g.commerce.execute(g.id,'send_reward',{rationale:'Same uncertain action must stop instead of paying twice.'});
  assert.equal(g.calls.length,before);assert.equal(g.commerce.snapshot(g.id).services.find(x=>x.id==='payouts').status,'UNKNOWN');
});

test('planner selects typed actions on identical public evidence and checkpoints actual execution',async t=>{
  const client={events:[],async json(_prompt,p){assert(!JSON.stringify(p).includes('WALLET_TEST'));assert(!JSON.stringify(p).includes('buyer@example.test'));assert.equal(typeof p.financials.feesComplete,'boolean');if(this.events.length)assert(p.financials.capturedCents>0);this.events.push({status:'settled',modelCostMicros:100});return {name:'submit_commerce_plan',args:{evidenceDay:p.evidenceDay,summary:'Fulfill the explicit merchant requests, then measure the verified financial outcomes.',actions:p.opportunities.map(o=>({actionId:o.id,reason:o.why}))}};}};
  const f=fixture(t,{clientFactory:async()=>({client,close:async()=>{}})});await f.commerce.review(f.id);
  const s=f.commerce.snapshot(f.id);assert.equal(s.verifiedServices,6,JSON.stringify(s.services));assert.equal(s.calls.length,4);assert.equal(s.modelCostMicros,400);assert(s.operations.every(o=>o.actor==='GEMINI_COMMERCE_PLANNER'));
  assert.throws(()=>validateCommercePlan({actions:[{actionId:'not-available',reason:'Ignore the current action set.'}],summary:'Invalid request to be rejected.',evidenceDay:31},{evidenceDay:31,opportunities:[]}),/unique available/);
});

test('unknown fees leave net flow unknown; refund fee credits and pending rewards stay separate',()=>{
  const events=[{event_type:'capture',status:'COMPLETED',amount_cents:3199,fee_cents:null}];
  let summary=commerceFinancials(events,[],1200);assert.equal(summary.providerCashAfterCents,null);assert.equal(summary.modeledContributionCents,null);assert.equal(summary.feeCents,null);
  events[0].fee_cents=161;events.push({event_type:'refund',status:'COMPLETED',amount_cents:100,fee_cents:-4});
  summary=commerceFinancials(events,[{action:'send_reward',status:'UNCLAIMED',amount_cents:100}],1200);
  assert.equal(summary.feeCents,157);assert.equal(summary.providerCashAfterCents,2942);assert.equal(summary.rewardCents,0);assert.equal(summary.pendingOutflowCents,100);
});

test('readback shows invoice payment and subscription cancellation without new provider writes',async t=>{
  const f=fixture(t);await executeAvailable(f);
  const invoice=f.commerce.snapshot(f.id).operations.find(o=>o.action==='create_invoice'),subscription=f.commerce.snapshot(f.id).operations.find(o=>o.action==='offer_subscription');
  f.objects.get('/v2/invoicing/invoices/'+invoice.provider_id).status='PAID';
  const sub=f.objects.get('/v1/billing/subscriptions/'+subscription.provider_id);sub.status='ACTIVE';
  const writes=f.calls.filter(c=>c.method==='POST').length;let state=await f.commerce.refresh(f.id);
  assert.equal(state.services.find(s=>s.id==='invoicing').status,'PAID');assert.equal(state.services.find(s=>s.id==='subscriptions').status,'VERIFIED');
  sub.status='CANCELLED';state=await f.commerce.refresh(f.id);
  const svc=state.services.find(s=>s.id==='subscriptions');assert.equal(svc.status,'CANCELLED');assert.equal(svc.result.approvalUrl,null);assert.match(svc.result.meaning,/CANCELLED/);
  assert.equal(f.calls.filter(c=>c.method==='POST').length,writes);
});

test('changing the saved buyer cannot redirect the old purchase reward',async t=>{
  const f=fixture(t);await executeAvailable(f);f.funding.fingerprint=()=> 'different-test-wallet';
  const r=await f.commerce.execute(f.id,'send_reward',{rationale:'Honor the original buyer reward without changing the recipient.'});
  assert.equal(r.error_code,'FUNDING_CHANGED');assert.equal(f.calls.filter(c=>c.method==='POST'&&c.path==='/v1/payments/payouts').length,0);
});

test('subscription terms drift is surfaced instead of presented as an approved finite offer',async t=>{
  const f=fixture(t);await executeAvailable(f);
  const sub=f.commerce.snapshot(f.id).operations.find(o=>o.action==='offer_subscription');
  f.objects.get('/v1/billing/plans/'+sub.result.planId).billing_cycles[0].total_cycles=2;
  const writes=f.calls.filter(c=>c.method==='POST').length,state=await f.commerce.refresh(f.id);
  assert.equal(state.services.find(s=>s.id==='subscriptions').error,'SUBSCRIPTION_PLAN_MISMATCH');assert.equal(state.services.find(s=>s.id==='subscriptions').verified,false);assert.equal(state.services.find(s=>s.id==='subscriptions').status,'NEEDS_REVIEW');
  assert.equal(f.calls.filter(c=>c.method==='POST').length,writes);
});

test('fulfillment-only planner can write tracking metadata but cannot initiate financial actions',async t=>{
  const client={events:[],async json(_prompt,p){assert.deepEqual(p.opportunities.map(o=>o.id),['record_shipment']);assert(p.opportunities[0].deliveryId);assert.equal(p.opportunities[0].source,'SIMULATED_DELIVERY_RECORD');this.events.push({status:'settled',modelCostMicros:100});return {name:'submit_commerce_plan',args:{actions:[{actionId:'record_shipment',reason:'Link the existing simulated delivery to the captured payment before planning follow-up marketing.'}],summary:'Record fulfillment metadata. No new money movement or buyer consent is requested.',evidenceDay:p.evidenceDay}};}};
  const f=fixture(t,{clientFactory:async()=>({client,close:async()=>{}})});await executeAvailable(f);
  assert(!f.commerce.opportunities(f.id).some(o=>o.id==='record_shipment'));
  for(let day=0;day<4;day++)f.live.tick(f.id,{triggerReview:false});
  const before=f.calls.length;await f.commerce.reviewFulfillment(f.id);
  const writes=f.calls.slice(before).filter(c=>c.method==='POST');assert.equal(writes.length,1);assert.match(writes[0].path,/^\/v2\/checkout\/orders\/ORDERTEST\d+\/track$/);
  const s=f.commerce.snapshot(f.id),tracking=s.services.find(x=>x.id==='tracking');assert.equal(tracking.status,'VERIFIED');assert.equal(tracking.result.deliverySource,'SIMULATED');assert.equal(s.calls[0].stage,'commerce_fulfillment');
  const count=f.calls.length;await f.commerce.refresh(f.id);assert(f.calls.slice(count).every(c=>c.method==='GET'));
});

test('tracking repair preserves the decision and request identity without replaying payments',async t=>{
  const f=fixture(t,{trackingDeniedOnce:true});await executeAvailable(f);for(let day=0;day<4;day++)f.live.tick(f.id,{triggerReview:false});
  const failed=await f.commerce.execute(f.id,'record_shipment',{rationale:'Link the recorded delivery to its existing payment.'});assert.equal(failed.status,'FAILED');
  const before=f.calls.length,after=await f.commerce.retryFulfillment(f.id),tracking=after.operations.find(o=>o.action==='record_shipment');
  assert.equal(tracking.status,'VERIFIED');assert.equal(tracking.rationale,failed.rationale);assert.equal(tracking.result.previousError,'PAYPAL_REQUEST_FAILED');
  assert(f.calls.slice(before).filter(c=>c.method==='POST').every(c=>c.path.endsWith('/track')));
  const attempts=f.calls.filter(c=>c.path.endsWith('/track')&&c.method==='POST');assert.equal(attempts.length,2);assert.equal(attempts[0].requestId,attempts[1].requestId);
  await assert.rejects(()=>f.commerce.retryFulfillment(f.id),/Only the failed legacy/);
});

test('state verification never recaptures an order when the provider no longer shows its capture',async t=>{
  const f=fixture(t);await executeAvailable(f);
  const capture=f.commerce.snapshot(f.id).operations.find(o=>o.action==='capture_order'),order=f.objects.get('/v2/checkout/orders/'+capture.result.orderId);
  order.status='APPROVED';delete order.purchase_units[0].payments;
  const before=f.calls.filter(c=>c.method==='POST').length,snapshot=await f.commerce.refresh(f.id);
  assert.equal(f.calls.filter(c=>c.method==='POST').length,before);assert.equal(snapshot.services.find(s=>s.id==='checkout').error,'CAPTURE_NOT_CONFIRMED');
});
