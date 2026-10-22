import test from 'node:test';
import assert from 'node:assert/strict';
import {createMarketService} from '../scripts/market-service.mjs';
import {createMarketStore} from '../scripts/market-store.mjs';
import {createMarketCatalog} from '../scripts/market-catalog.mjs';
import {SandboxError} from '../scripts/paypal-sandbox.mjs';

async function fixture(t,{automatic=0}={}){
  const store=createMarketStore();t.after(()=>store.close());
  const state={creates:0,captures:0,reads:0,lostCreate:false,wrongAmount:false,missingCapture:false,fingerprint:'PRIVATE_WALLET_HASH',ready:true,orders:new Map(),keys:new Map()};
  const funding={status:()=>({ready:state.ready,mode:'SANDBOX'}),fingerprint:()=>state.fingerprint,paymentSource:()=>({paypal:{vault_id:'PRIVATE_VAULT',stored_credential:{payment_initiator:'MERCHANT',usage:'SUBSEQUENT',usage_pattern:'UNSCHEDULED_PREPAID'}}})};
  const paypal={status:()=>({configured:true,mode:'SANDBOX'}),profileKey:()=> 'PRIVATE_PROFILE',list:()=>[],async requestSandbox(path,args={}){
    if(path==='/v2/checkout/orders'&&args.method==='POST'){
      assert.equal(args.body.payment_source.paypal.vault_id,'PRIVATE_VAULT');assert.equal(args.body.payment_source.paypal.stored_credential.payment_initiator,'MERCHANT');assert.equal(args.body.payment_source.card,undefined);
      let order=state.keys.get(args.requestId);
      if(!order){
        state.creates++;state.captures++;const unit=structuredClone(args.body.purchase_units[0]),amount=unit.amount;
        unit.payee={merchant_id:'SANDBOXMERCHANT'};
        unit.payments={captures:[{id:'VAULTCAPTURE'+String(state.captures).padStart(5,'0'),status:'COMPLETED',amount,create_time:'2026-10-22T07:00:00.000Z',seller_receivable_breakdown:{gross_amount:amount,paypal_fee:{currency_code:'USD',value:'1.00'},net_amount:{currency_code:'USD',value:(Number(amount.value)-1).toFixed(2)}}}]};
        order={id:'VAULTORDER'+String(state.creates).padStart(6,'0'),status:'COMPLETED',purchase_units:[unit]};state.orders.set(order.id,order);state.keys.set(args.requestId,order);
      }
      if(state.lostCreate){state.lostCreate=false;throw new SandboxError(502,'PAYPAL_UNCONFIRMED','Lost create response');}
      return structuredClone(order);
    }
    if(path.startsWith('/v2/checkout/orders/')&&(!args.method||args.method==='GET')){
      state.reads++;const order=structuredClone(state.orders.get(path.split('/').at(-1)));assert(order);
      if(state.wrongAmount)order.purchase_units[0].payments.captures[0].amount={currency_code:'USD',value:'0.01'};
      if(state.missingCapture)order.purchase_units[0].payments={captures:[]};
      return order;
    }
    throw new Error('Unexpected provider call: '+path);
  }};
  const catalog=await createMarketCatalog({env:{}}),service=createMarketService({store,paypal,catalog,funding});
  const run=await service.create({kind:'learning',policy:'fixed_rules',customerCount:100,merchantCount:8,seed:42,sandboxLimit:0,sandboxSampleLimit:automatic});
  await service.advance(run.runId,24);await service.advance(run.runId,5);await service.drain();
  return {store,state,paypal,catalog,funding,service,id:run.runId};
}

test('selected emulator order uses the vaulted sandbox wallet and joins its verified receipt without doubling revenue',async t=>{
  const f=await fixture(t),c=f.service.paymentSample(f.id).candidates[0];assert(c);
  const totals=f.store.db.prepare('SELECT SUM(gross_cents) gross,COUNT(*) n FROM transactions WHERE run_id=?').get(f.id);
  await Promise.all([f.service.mirror(f.id,[c.order_id]),f.service.mirror(f.id,[c.order_id])]);
  const receipt=f.service.frame(f.id).receipts[0];assert.equal(receipt.status,'COMPLETED');assert.equal(receipt.gross_cents,c.total_cents);assert.equal(receipt.funding_method,'PAYPAL_WALLET_VAULT');
  const joined=f.store.table('v_paypal_order_lineage',f.id).rows[0];assert.equal(joined.order_id,c.order_id);assert.equal(joined.amount_verified,1);assert.equal(joined.paypal_fee_cents,100);assert.equal(joined.paypal_gross_cents,joined.paypal_fee_cents+joined.paypal_net_cents);assert.equal(joined.provider_event_date,'2026-10-22');
  assert.deepEqual(f.store.db.prepare('SELECT SUM(gross_cents) gross,COUNT(*) n FROM transactions WHERE run_id=?').get(f.id),totals);
  assert.equal(f.state.creates,1);assert.equal(f.state.captures,1);await f.service.refreshReceipt(receipt.receipt_id);assert.equal(f.state.captures,1);
  const exported=JSON.stringify(f.store.export(f.id));for(const secret of ['PRIVATE_VAULT','PRIVATE_WALLET_HASH','PRIVATE_PROFILE'])assert(!exported.includes(secret));
  assert.deepEqual(f.store.db.prepare('PRAGMA foreign_key_check').all(),[]);
});

test('an uncertain single-step capture recovers after service restart with the same persisted idempotency key',async t=>{
  const f=await fixture(t),id=f.service.paymentSample(f.id).candidates[0].order_id;f.state.lostCreate=true;
  await f.service.mirror(f.id,[id]);let receipt=f.service.frame(f.id).receipts[0];assert.equal(receipt.status,'ERROR');assert.equal(receipt.paypal_order_id,null);assert.equal(f.state.captures,1);
  const restored=createMarketService({store:f.store,paypal:f.paypal,catalog:f.catalog,funding:f.funding});await restored.refreshReceipt(receipt.receipt_id);receipt=restored.frame(f.id).receipts[0];assert.equal(receipt.status,'COMPLETED');assert.equal(f.state.creates,1);assert.equal(f.state.captures,1);
});

test('selection bounds, foreign orders and missing consent fail before provider calls',async t=>{
  const f=await fixture(t),cs=f.service.paymentSample(f.id).candidates;assert(cs.length>3);
  await assert.rejects(()=>f.service.mirror(f.id,[cs[0].order_id,cs[0].order_id]),{code:'INVALID_ORDER_SELECTION'});
  await assert.rejects(()=>f.service.mirror(f.id,['FOREIGN-ORDER']),{code:'INELIGIBLE_ORDER'});assert.equal(f.state.creates,0);
  f.state.ready=false;await assert.rejects(()=>f.service.mirror(f.id,[cs[0].order_id]),{code:'SANDBOX_BUYER_REQUIRED'});f.state.ready=true;
  await f.service.mirror(f.id,cs.slice(0,3).map(c=>c.order_id));await assert.rejects(()=>f.service.mirror(f.id,[cs[3].order_id]),{code:'SAMPLE_CAP'});assert.equal(f.state.captures,3);
});

test('amount mismatches and a completed order with no capture are never counted as verified payments',async t=>{
  const f=await fixture(t),ids=f.service.paymentSample(f.id).candidates.slice(0,2).map(c=>c.order_id);
  f.state.wrongAmount=true;await f.service.mirror(f.id,[ids[0]]);assert.equal(f.service.frame(f.id).receipts[0].error_code,'SANDBOX_CAPTURE_MISMATCH');
  f.state.wrongAmount=false;f.state.missingCapture=true;await f.service.mirror(f.id,[ids[1]]);assert(f.service.frame(f.id).receipts.some(r=>r.error_code==='MISSING_NATIVE_CAPTURE'));
  assert.equal(f.store.db.prepare('SELECT SUM(amount_verified) n FROM v_paypal_order_lineage').get().n,0);
});

test('a changed wallet and an expired uncertain request cannot be replayed as a new payment',async t=>{
  const f=await fixture(t),id=f.service.paymentSample(f.id).candidates[0].order_id;f.state.lostCreate=true;await f.service.mirror(f.id,[id]);const receipt=f.service.frame(f.id).receipts[0];
  f.state.fingerprint='CHANGED_WALLET';await assert.rejects(()=>f.service.refreshReceipt(receipt.receipt_id),{code:'FUNDING_CHANGED'});assert.equal(f.state.captures,1);
  f.state.fingerprint='PRIVATE_WALLET_HASH';f.store.db.prepare('UPDATE orders SET total_cents=total_cents+1 WHERE order_id=?').run(id);
  await assert.rejects(()=>f.service.refreshReceipt(receipt.receipt_id),{code:'EMULATOR_ORDER_CHANGED'});assert.equal(f.state.captures,1);
  f.store.db.prepare('UPDATE orders SET total_cents=? WHERE order_id=?').run(receipt.gross_cents,id);f.store.db.prepare('UPDATE paypal_receipts SET created_at=? WHERE receipt_id=?').run('2020-01-01T00:00:00Z',receipt.receipt_id);
  await assert.rejects(()=>f.service.refreshReceipt(receipt.receipt_id),{code:'RECONCILE_REQUIRED'});assert.equal(f.state.captures,1);
});

test('automatic field-test sampling is bounded across further shifts without affecting the model policy',async t=>{
  const f=await fixture(t,{automatic:3});assert.equal(f.service.frame(f.id).receipts.length,3);assert.equal(f.state.captures,3);
  await f.service.advance(f.id,7);await f.service.drain();assert.equal(f.state.captures,3);assert.equal(f.service.frame(f.id).policy,'fixed_rules');assert.equal(f.service.frame(f.id).sandboxSampleLimit,3);
});
