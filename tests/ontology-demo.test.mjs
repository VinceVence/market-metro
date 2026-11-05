import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createSupplyYardServer} from '../scripts/serve.mjs';
import {verifyMerchantFeed} from '../demo/commerce/feed-verifier.mjs';
const read=async p=>JSON.parse(await readFile(p,'utf8'));

test('local tool certifies the recorded split baskets, links the archived capture and withholds totals on ambiguous feeds',async()=>{
  const server=createSupplyYardServer({},null,null);server.listen(0,'127.0.0.1');await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port+'/api/market/ontology/';
  try{
    const judge=await read('demo/data/judge-reactivation.json');
    for(const name of ['warehouse','renamed','flat','ambiguous','units']){
      const response=await fetch(base+'verify?example='+name);assert.equal(response.status,200);
      const {fixed,ontology:r}=await response.json();
      if(name==='ambiguous'||name==='units'){
        for(const result of [fixed,r]){assert.equal(result.decision,'HOLD');assert.equal(result.metrics,null);assert.equal(result.payment,null);}
        assert.equal(r.code,name==='ambiguous'?'ambiguous-link':'unit-unknown');continue;
      }
      assert.equal(fixed.decision,name==='warehouse'?'CERTIFY':'HOLD');
      assert.deepEqual(r.metrics,{purchases:1384,merchantOrders:1922,splitBaskets:538,grossCents:16445100});
      assert.equal(r.splitExample.grossCents,18800);assert.deepEqual(r.splitExample.legs.map(x=>x.gross),[4800,14000]);
      assert.equal(r.payment.capture,judge.receipt.capture_id);assert.equal(r.payment.merchantOrder,judge.shopper.orderId);
      assert.equal(r.payment.basket,judge.runId+'-'+judge.shopper.basketId);assert.equal(r.payment.basketGrossCents,9600);
      assert.equal(r.payment.grossCents,9600);assert.equal(r.payment.feeCents,356);assert.equal(r.payment.netCents,9244);
      assert.equal(r.payment.extraPurchases,0);assert.equal(r.payment.extraGrossCents,0);
      const exported=await (await fetch(base+'feed?example='+name)).json();
      assert.deepEqual(verifyMerchantFeed(exported).metrics,r.metrics);
    }
    assert.equal((await fetch(base+'verify?example=unknown')).status,400);
  }finally{await new Promise(resolve=>server.close(resolve));}
});

test('all registered examples and frozen source fingerprints are included in the published comparison',async()=>{
  const r=await read('demo/data/ontology-study.json'),lock=await read('docs/ontology/holdout-lock.json'),p=await read('docs/ontology/protocol.json');
  assert.deepEqual(r.lock,lock);
  for(const [source,digest] of Object.entries(lock.sources))assert.equal(createHash('sha256').update(await readFile(source)).digest('hex'),digest);
  assert.equal(r.cases.length,p.repetitions*(p.answerableFamilies.length+p.holdFamilies.length));
  assert.equal(new Set(r.cases.map(c=>c.feedHash)).size,r.cases.length);
  for(const mode of ['fixed','ontology']){
    assert.equal(r.total[mode].unsafeHeld,r.cases.filter(c=>!c.expected&&c[mode].decision==='HOLD').length);
    assert.equal(r.total[mode].exactCertifications,r.cases.filter(c=>c.expected&&JSON.stringify(c.expected)===JSON.stringify(c[mode].metrics)).length);
    assert.ok(r.cases.filter(c=>c[mode].decision==='HOLD').every(c=>c[mode].metrics===null));
  }
  assert.ok(r.accepted);assert.equal(r.total.ontology.falseCertifications,0);
});
