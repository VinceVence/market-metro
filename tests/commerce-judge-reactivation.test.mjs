import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createSupplyYardServer} from '../scripts/serve.mjs';
import {canonicalHash} from '../scripts/commerce-expanded/harness-v2/contracts.mjs';
const read=async p=>JSON.parse(await readFile(p,'utf8'));

test('judge artifact binds the reported single-planner gain and checkout to the same seed, ranking and shopper',async()=>{
  const d=await read('demo/data/judge-reactivation.json'),study=await read('demo/data/commerce-reactivation-fresh.json');
  const folder='docs/commerce-expanded/model-check/reactivation-fresh/';
  const {lockHash,...lock}=await read(folder+'decisions.json');
  assert.equal(canonicalHash(lock),lockHash);assert.equal(d.lockHash,lockHash);assert.equal(study.lockHash,lockHash);
  const a=lock.arms.find(a=>a.seed===d.seed&&a.arm==='single'),result=study.cases.find(c=>c.seed===d.seed);
  const review=JSON.parse(gunzipSync(await readFile(folder+'judge-review.json.gz')));
  assert.equal(a.id,review.id);assert.equal(review.mode,'single');assert.equal(a.comparison.status,'switched');
  assert.equal(d.decision.contractHash,a.checked.hash);assert.equal(d.shopper.modelId,a.comparison.alternative.modelId);
  assert.deepEqual(d.fixed,result.rows.fixed);assert.deepEqual(d.planner,result.rows.single_checked);
  assert.deepEqual(d.vsFixed,result.comparisons.singleVsFixed);assert.deepEqual(d.vsOriginal,result.comparisons.singleVerifier);
  const purchase=d.frames[d.shopper.purchaseDay].activities.find(e=>e.type==='purchase'&&e.orderId===d.runId+'-'+d.shopper.basketId);
  assert.equal(purchase.customerId,d.shopper.id);assert.equal(purchase.merchantId,d.shopper.merchantId);
  assert.equal(purchase.amount,d.shopper.grossCents);assert.equal(purchase.product,d.shopper.product);
  assert.ok(d.frames[d.shopper.deliveryDay].activities.some(e=>e.type==='delivery'&&e.customerId===d.shopper.id));
  const r=d.receipt;assert.equal(r.source,'PAYPAL_SANDBOX');assert.equal(r.status,'COMPLETED');
  assert.ok(r.capture_id&&r.paypal_order_id&&r.verified_at);assert.equal(r.run_id,d.runId);
  assert.equal(r.order_id,d.shopper.orderId);assert.equal(r.merchant_id,d.shopper.merchantId);
  assert.equal(r.gross_cents,purchase.amount);assert.equal(r.fee_cents+r.net_cents,r.gross_cents);
});

test('bare judge entries open the recorded walkthrough without providers and explicit workspace links keep their destinations',async()=>{
  const server=createSupplyYardServer({},null,null);
  server.listen(0,'127.0.0.1');await once(server,'listening');
  try{
    const base='http://127.0.0.1:'+server.address().port;
    for(const path of ['/','/studio.html','/?utm_source=judges','/judge.html']){
      const r=await fetch(base+path);assert.equal(r.status,200);assert.match(await r.text(),/src="\/commerce\/judge\.mjs"/);
    }
    for(const [url,marker] of [['/studio.html?view=performance','/commerce/app.mjs'],['/?run=existing','/garden/app.mjs']]){
      const r=await fetch(base+url);assert.equal(r.status,200);assert.ok((await r.text()).includes(marker));
    }
    const r=await fetch(base+'/data/judge-reactivation.json');assert.equal((await r.json()).receipt.status,'COMPLETED');
  }finally{await new Promise(resolve=>server.close(resolve));}
});
