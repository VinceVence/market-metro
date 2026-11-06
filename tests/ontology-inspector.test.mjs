import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {runOntology} from '../scripts/ontology/run-evidence.mjs';
import {savedPlanningEvidence} from '../scripts/ontology/saved-policy.mjs';
import {createSupplyYardServer} from '../scripts/serve.mjs';

test('ontology inspection separates raw rows, certified purchases, eligible labels and future outcomes',()=>{
  const world={people:[{id:'u'}],products:[{id:'p',catalogId:'catalog-p',title:'Paper'}],merchants:[{id:'m1',name:'Store one'},{id:'m2',name:'Store two'}],
    orders:[{id:'o1',customerId:'u',day:1,grossCents:900,merchants:[{id:'m1',grossCents:300},{id:'m2',grossCents:600}],items:[{productId:'p'}]},
      {id:'o2',customerId:'u',day:40,grossCents:500,merchants:[{id:'m1',grossCents:500}],items:[{productId:'p'}]}],
    growth:{contacts:[{day:2,kind:'recommend'},{day:3,kind:'ask_need'},{day:40,kind:'recommend'}]},events:[{type:'REFUNDED',captureId:'o1',day:60}]};
  const input={world,run:{runId:'test-run',execution:'saved',merchantMapping:'two-links',mappingCorrection:{holdId:'later'}},day:30,steps:[],receipts:[],reference:null,hold:true};
  const held=runOntology(input);assert.equal(held.mapping.decision,'HOLD');assert.equal(held.mapping.metrics,null);
  assert.deepEqual([held.counts.checkouts,held.counts.merchantOrders,held.counts.splitCheckouts],[1,2,1]);
  assert.equal(held.counts.refunds,0);assert.equal(held.counts.matureRecommendations,1);assert.equal(held.counts.matureInquiries,1);
  assert.equal(held.example.grossCents,900);assert.equal(held.example.orders.reduce((n,o)=>n+o.grossCents,0),900);
  const verified=runOntology({...input,steps:[{actor:'MERCHANT_FEED_GATE',status:'COMPLETED',output:{decision:'CERTIFY'}}],hold:false});
  assert.equal(verified.mapping.decision,'CERTIFY');assert.equal(verified.mapping.metrics.purchases,1);
  assert.match(verified.mapping.reason,/reconcile/);assert.equal(runOntology({...input,day:27}).counts.matureContacts,0);
});

test('the reference planning endpoint binds six archived decisions to the actual saved policy',async()=>{
  const server=createSupplyYardServer({},null,null);
  try{
    server.listen(0,'127.0.0.1');await once(server,'listening');
    const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/market/ontology/reference');
    assert.equal(response.status,200);const record=await response.json();
    assert.deepEqual(record,await savedPlanningEvidence());assert.equal(record.source,'RECORDED_REFERENCE_REVIEW');
    assert.equal(record.seed,92111706);assert.equal(record.checkpoints.filter(c=>c.actor==='GEMINI').length,6);
    assert.equal(record.checkpoints.find(c=>c.actor==='TRUSTED_PUBLISHER').output.selectedContractHash,record.contractHash);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
