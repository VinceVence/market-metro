import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyMerchantFeed} from '../demo/commerce/feed-verifier.mjs';
import {merchantExport} from '../scripts/ontology/feeds.mjs';

// Development examples only. No held-out merchant seed or holdout outputs.
const example={runId:'dev-1',checkouts:[['basket-one',18800,[['leg-one','shop-a',4800],['leg-two','shop-b',14000]]],
  ['basket-two',9600,[['leg-three','shop-b',9600]]]]};
const receipt={source:'PAYPAL_SANDBOX',status:'COMPLETED',currency:'USD',run_id:'dev-1',receipt_id:'development-fixture',
  paypal_order_id:'TESTORDER123',capture_id:'TESTCAPTURE123',verified_at:'2026-11-01T00:00:00Z',order_id:'leg-three',merchant_id:'shop-b',
  gross_cents:9600,fee_cents:356,net_cents:9244};
const make=(layout='warehouse',fault=null)=>merchantExport(example,layout,'development-only',{fault});

test('both mappings count one split checkout once and a saved capture adds zero purchases or gross',()=>{
  for(const mode of ['fixed','ontology']){
    const r=verifyMerchantFeed(make(),{mode,receipt});
    assert.equal(r.decision,'CERTIFY');assert.deepEqual(r.metrics,{purchases:2,merchantOrders:3,splitBaskets:1,grossCents:28400});
    assert.equal(r.splitExample.grossCents,18800);assert.equal(r.splitExample.legs.length,2);
    assert.equal(r.payment.basket,'basket-two');assert.equal(r.payment.netCents,9244);assert.equal(r.payment.extraPurchases,0);assert.equal(r.payment.extraGrossCents,0);
  }
});
test('semantic binding works across unrelated physical names and reconciles a repeated checkout total in a flat decimal export',()=>{
  const input=make('renamed-flat'),before=JSON.stringify(input);
  assert.equal(verifyMerchantFeed(input,{mode:'fixed'}).decision,'HOLD');
  const r=verifyMerchantFeed(input);assert.equal(r.metrics.grossCents,28400);assert.equal(r.metrics.purchases,2);
  assert.equal(r.mapping.layout,'flat');assert.equal(r.mapping.checkoutUnit,'USD');assert.equal(JSON.stringify(input),before);
});
test('ambiguous evidence with coincidentally matching keys cannot publish a count',()=>{
  for(const mode of ['fixed','ontology']){
    const r=verifyMerchantFeed(make('warehouse','ambiguous-checkout-link'),{mode});
    assert.equal(r.code,'ambiguous-link');assert.equal(r.metrics,null);
    assert.equal(verifyMerchantFeed(make('warehouse','unit-unknown'),{mode}).code,'unit-unknown');
  }
  const input=make(),t=input.tables.find(t=>t.name==='orders'),c=t.columns.find(c=>c.name==='total_cents');
  t.columns.push({...c,name:'other_charge'});t.rows.forEach(row=>row.push(0));
  assert.equal(verifyMerchantFeed(input).code,'field-binding');
});
test('receipt provenance, the exact order and merchant and the fee breakdown are mandatory',()=>{
  for(const edit of [{run_id:'foreign'},{source:'SIMULATED'},{status:'PENDING'},{order_id:'leg-two'},
    {merchant_id:'other'},{gross_cents:9601},{fee_cents:null},{net_cents:9200},{capture_id:''}]){
    const r=verifyMerchantFeed(make(),{receipt:{...receipt,...edit}});assert.equal(r.decision,'HOLD');assert.equal(r.metrics,null);assert.equal(r.payment,null);
  }
});
test('conflicting grain, malformed money and mixed currencies fail closed',()=>{
  const v=make();const t=v.tables.find(t=>t.name==='orders'),c=t.columns.find(c=>c.name==='total_cents');
  c.unit='USD';assert.equal(verifyMerchantFeed(v).code,'unit-conflict');
  c.unit='USD cents';t.rows[0][t.columns.indexOf(c)]=.1;assert.equal(verifyMerchantFeed(v).code,'amount-format');
  const v2=make();v2.tables[0].columns.push({name:'currency',description:'currency code'});v2.tables[0].rows.forEach(r=>r.push('EUR'));
  assert.equal(verifyMerchantFeed(v2).code,'currency-conflict');
  assert.equal(verifyMerchantFeed({...make(),complete:false}).code,'scope');
  const v3=make();v3.tables.find(t=>t.name==='orders').grain='payment attempt';
  for(const mode of ['fixed','ontology'])assert.equal(verifyMerchantFeed(v3,{mode}).decision,'HOLD');
});
