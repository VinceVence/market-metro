import test from 'node:test';
import assert from 'node:assert/strict';
import {createEvidenceComparison,startEvidencePairShift,tickEvidencePair,evidencePairMetrics,evidenceBenefit,exportEvidencePair,assertEvidencePair} from '../demo/game/evidence-comparison.mjs';
import {assertEvidenceEconomy} from '../demo/game/evidence-economy.mjs';
import {total} from '../demo/game/network.mjs';

const receipt={quantity:10,grossCents:10000,paypalOrderId:'TEST-ORDER',orderStatus:'COMPLETED',paymentState:'COMPLETED',verifiedAt:'2026-10-20T14:37:46Z',
  receipt:{provenance:'PAYPAL_SANDBOX',orderId:'TEST-ORDER',captureId:'TEST-CAPTURE',status:'COMPLETED',currency:'USD',grossCents:10000,feeCents:370,netCents:9630}};
function advance(p,phase){for(let i=0;i<4000&&p.phase!==phase;i++)tickEvidencePair(p,.1);assert.equal(p.phase,phase);}
function run(settings={}){
  const p=createEvidenceComparison(settings,receipt);p.auto=true;startEvidencePairShift(p);advance(p,'complete');return p;
}

test('matched receipt economy compares identical orders and fees across all three shocks',()=>{
  const p=run(),[a,b]=p.worlds.map(w=>evidencePairMetrics(w,p.settings));
  assert.deepEqual(p.audit.map(a=>a.paidUnits),[398,450,594]);
  assert.ok(p.audit.every(a=>a.matched));assertEvidencePair(p);
  assert.equal(a.gross,1442000);assert.equal(a.gross,b.gross);
  assert.equal(a.fees,43330);assert.equal(b.fees,43330);
  assert.equal(a.delivered,289);assert.equal(b.delivered,757);
  assert.equal(p.rounds[0].perShift[0].delivered,p.rounds[0].perShift[1].delivered,'Review cannot retroactively change the first deliveries.');
  assert.equal(p.worlds[0].queries.length,0);assert.ok(p.worlds[0].reviewHistory.every(r=>r.queries.length===0));
  assert.ok(b.queries>0);
  for(const w of p.worlds){
    assertEvidenceEconomy(w);assert.equal(w.orders.filter(o=>o.captureReference==='TEST-CAPTURE').length,1);
    assert.equal(w.orders[0].fee,370);
  }
  assert.notEqual(p.worlds[0].merchants[0].cash,p.worlds[1].merchants[0].cash);
});

test('net benefit excludes merchant liquidity and refunds, and includes provider costs exactly once',()=>{
  const p=run(),[a,b]=p.worlds.map(w=>evidencePairMetrics(w,p.settings)),delta=evidenceBenefit(p);
  assert.equal(a.processing,14420);assert.equal(b.processing,14420);
  assert.equal(a.coverage,3040);assert.equal(b.coverage,3040);
  assert.equal(a.reviewCost,0);assert.equal(b.reviewCost,2700);
  assert.equal(a.net,25870);assert.equal(b.net,23170);assert.equal(delta.total,-2700);
  assert.equal(delta.total,delta.fees+delta.processing+delta.coverage+delta.review);
  assert.equal(delta.extraDeliveries,468);assert.ok(b.refunds<a.refunds);
  assert.ok(b.released>0);assert.equal(delta.fees,0,'Freed merchant reserves must not be counted as PayPal fees.');
  assert.equal(total(p.rounds,r=>r.perShift[0].net),a.net);
  assert.equal(total(p.rounds,r=>r.perShift[1].net),b.net);
  assert.equal(total(p.rounds,'shiftBenefit'),delta.total);
});

test('same-workflow control has exactly identical outcomes and zero benefit, including investigation costs',()=>{
  const p=run({referencePolicy:'balanced'});
  assert.deepEqual(p.worlds.map(w=>evidencePairMetrics(w,p.settings))[0],p.worlds.map(w=>evidencePairMetrics(w,p.settings))[1]);
  assert.deepEqual(p.worlds[0].orders,p.worlds[1].orders);
  assert.deepEqual(p.worlds[0].reviewHistory,p.worlds[1].reviewHistory);
  assert.equal(evidenceBenefit(p).total,0);
  assert.ok(p.rounds.every(r=>r.benefit===0&&r.shiftBenefit===0));
});

test('initial-feed control uses the same reserve rule without retrieving the reviewed side’s evidence',()=>{
  const p=run({referencePolicy:'checklist'}),[a,b]=p.worlds.map(w=>evidencePairMetrics(w,p.settings));
  assert.equal(a.queries,0);assert.equal(a.reviewCost,0);assert.equal(a.delivered,455);assert.equal(b.delivered,757);
  const first=p.worlds[0].reviewHistory[0].applied.rows[0];
  assert.equal(first.verified,2);assert.equal(first.held,8400);assert.equal(first.release,1230);
  assert.equal(p.worlds[0].reviewHistory[0].cases.find(c=>c.merchant==='M001'&&!c.feed).carrier,null);
});

test('review-cost sensitivity changes provider accounting but cannot change physical outcomes',()=>{
  const zero=run({reviewCostPerMerchant:0}),high=run({reviewCostPerMerchant:1000});
  assert.equal(evidenceBenefit(zero).total,0);
  assert.equal(evidenceBenefit(high).total,-108000);
  assert.deepEqual(zero.worlds.map(w=>w.orders),high.worlds.map(w=>w.orders));
  assert.deepEqual(zero.worlds.map(w=>w.merchants),high.worlds.map(w=>w.merchants));
});

test('pause, step boundaries and repeat starts prevent duplicate orders and settlement costs',()=>{
  const p=createEvidenceComparison({count:12},receipt);startEvidencePairShift(p);
  assert.throws(()=>startEvidencePairShift(p),/Wait/);
  p.paused=true;const before=structuredClone(p);tickEvidencePair(p,.1);assert.deepEqual(p,before);
  p.paused=false;advance(p,'between');
  const orders=p.worlds.map(w=>w.orders.length);
  for(let i=0;i<200;i++)tickEvidencePair(p,.1);
  assert.deepEqual(p.worlds.map(w=>w.orders.length),orders);assert.equal(p.rounds.length,1);
  p.auto=true;startEvidencePairShift(p);advance(p,'complete');
  const cost=evidenceBenefit(p);for(let i=0;i<50;i++)tickEvidencePair(p,.1);
  assert.deepEqual(evidenceBenefit(p),cost);assert.equal(p.worlds[0].orders.length,36);
});

test('mutated assumptions, starting wallets, orders or shocks fail the matched-input gate',()=>{
  let p=createEvidenceComparison({},receipt);p.settings.reviewCostPerMerchant=100;
  assert.throws(()=>startEvidencePairShift(p),/inputs changed/);
  p=createEvidenceComparison({},receipt);p.worlds[0].merchants[0].cash++;
  assert.throws(()=>startEvidencePairShift(p),/wallets differ/);
  p=createEvidenceComparison({},receipt);startEvidencePairShift(p);p.worlds[0].currentOrders[0].fee++;
  assert.throws(()=>assertEvidencePair(p),/not matched/);
  p=createEvidenceComparison({},receipt);startEvidencePairShift(p);p.worlds[0].warehouses[0].opening++;
  assert.throws(()=>assertEvidencePair(p),/not matched/);
  assert.throws(()=>createEvidenceComparison({reviewCostPerMerchant:-1}),/Invalid/);
});

test('largest scale preserves cash and goods, and export labels the agent and financial limitations',()=>{
  const p=run({count:120});
  p.worlds.forEach(assertEvidenceEconomy);assertEvidencePair(p);
  const exported=exportEvidencePair(p);
  assert.equal(exported.audit.length,3);assert.equal(exported.rounds.length,3);
  assert.match(exported.disclosure,/conventional implementation/);
  assert.match(exported.disclosure,/no new payment/);
  assert.match(exported.disclosure,/No churn|no churn/);
  assert.doesNotThrow(()=>JSON.stringify(exported));
});
