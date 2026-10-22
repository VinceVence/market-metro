import test from 'node:test';
import assert from 'node:assert/strict';
import { CASES, createEconomy, startSupplyFlow, injectShock, sendAgents, tick, compareOptions, choose, execute, stockRace, reconcileRefund, setAssumptions, invariant, exportEconomy } from '../demo/game/economy.mjs';
import { streetRoute } from '../demo/game/streets.mjs';
import { NODES, PLACES } from '../demo/game/yard-art.mjs';

function investigateCase(id='rescue'){
  const w=createEconomy(id);injectShock(w);sendAgents(w);
  for(let i=0;i<300&&w.phase===2;i++)tick(w,.1);
  assert.equal(w.phase,3,'Investigators must finish their street routes');
  return w;
}
function advanceUntil(w,predicate){for(let i=0;i<600&&!predicate();i++){tick(w,.1);invariant(w);}assert.ok(predicate(),'The visual flow must reach its next stop');}

test('the opening case is captured and settled, with no fictitious newly available money',()=>{
  const w=createEconomy();assert.ok(w.orders.every(o=>o.status==='CAPTURED'));
  assert.equal(w.opening.capturedPayments,100000);
  assert.equal(w.opening.spentBeforeShock+w.ledger.available+w.ledger.reserve,100000);invariant(w);
});
test('default comparison separates expected refunds, failure downside and incremental contribution',()=>{
  const w=investigateCase(),m=compareOptions(w);
  assert.equal(m.hold.expectedLoss,70000);
  assert.equal(m.release.failureLoss,86000);
  assert.equal(m.release.expectedLoss,12900);
  assert.equal(m.avoidedExpectedLoss,57100);
  assert.equal(m.incrementalContribution,850);
  assert.equal(m.netBenefit,57950);
  assert.equal(m.extraFailureLoss,16000);
  assert.equal(m.release.reserve,14000);
  assert.equal(m.release.amount,6000);
});
test('visible investigation changes the demo recommendation from hold to a bounded release',()=>{
  const w=createEconomy();injectShock(w);assert.equal(w.recommendations[0].decision,'HOLD');
  sendAgents(w);assert.equal(w.recommendation,null);
  for(let i=0;i<300&&w.phase===2;i++)tick(w,.1);
  assert.equal(w.recommendation.decision,'RELEASE');assert.equal(w.evidence.filter(e=>e.found).length,3);
  assert.equal(w.events.filter(e=>e.type.startsWith('Evidence')).length,3);
});
test('lowering the authored success assumption can reverse the recommendation',()=>{
  const w=investigateCase();setAssumptions(w,{successBps:1000});
  assert.equal(w.recommendation.decision,'HOLD');assert.equal(compareOptions(w).netBenefit,-7300);
  assert.throws(()=>choose(w,'RELEASE'),/blocked/);
  setAssumptions(w,{successBps:8500});assert.equal(w.recommendation.decision,'RELEASE');
});
test('historic payment fees do not reappear as incremental revenue',()=>{
  const w=investigateCase();setAssumptions(w,{futureVolume:0});
  const m=compareOptions(w);assert.equal(m.incrementalContribution,0);assert.equal(m.netBenefit,57100);
});
test('speculative future contribution cannot override increased expected refund loss',()=>{
  const w=investigateCase();setAssumptions(w,{successBps:1000,futureVolume:1000000,netContributionBps:1000});
  assert.ok(compareOptions(w).netBenefit>0);
  assert.equal(w.recommendation.decision,'HOLD');assert.throws(()=>choose(w,'RELEASE'),/blocked/);
});
for(const [id,decision] of [['no-stock','HOLD'],['competing','HOLD'],['expired','MORE_EVIDENCE'],['missing','MORE_EVIDENCE'],['fragile','HOLD']]){
  test(`${id}: adverse evidence or assumptions prevent an approved release`,()=>{
    const w=investigateCase(id);assert.equal(w.recommendation.decision,decision);
    assert.throws(()=>choose(w,'RELEASE'),/blocked/);
    choose(w,'HOLD');execute(w,'failure');assert.equal(w.ledger.paypalPaid,70000);invariant(w);
  });
}
test('agents cannot self-approve; financial state remains unchanged',()=>{
  const w=investigateCase();assert.throws(()=>choose(w,'RELEASE','agent'),/reviewer/);
  assert.equal(w.approval,null);assert.equal(w.ledger.reserve,20000);
});
test('successful release reclassifies existing funds; no extra capture or PayPal expense',()=>{
  const w=investigateCase(),before=compareOptions(w);choose(w,'RELEASE');execute(w,'success');
  assert.equal(w.ledger.reserve,14000);assert.equal(w.ledger.available,0);assert.equal(w.ledger.supplierPaid,16000);
  assert.equal(w.ledger.paypalPaid,0);assert.equal(w.ledger.customerRefunds,0);assert.equal(w.quote.stock,0);
  assert.ok(w.orders.every(o=>o.status==='CAPTURED'&&o.delivery==='AWAITING'),'Purchase is not delivery');
  advanceUntil(w,()=>w.delivery.stage==='complete');
  assert.ok(w.orders.every(o=>o.status==='CAPTURED'&&o.delivery==='DELIVERED'));
  assert.deepEqual(compareOptions(w),before,'Running a branch must not rewrite its pre-execution counterfactuals');
  assert.throws(()=>execute(w,'success'),/approval/);invariant(w);
});
test('failed replacement makes the greater PayPal downside explicit and balances refunds',()=>{
  const w=investigateCase();choose(w,'RELEASE');execute(w,'failure');
  assert.equal(w.ledger.paypalPaid,86000);assert.equal(w.ledger.customerRefunds,100000);
  assert.equal(w.ledger.reserve,0);assert.equal(w.ledger.supplierPaid,16000);
  assert.ok(w.orders.every(o=>o.refund==='COMPLETED'));invariant(w);
});
test('retaining reserve refunds from merchant backing before the $700 provider contribution',()=>{
  const w=investigateCase();choose(w,'HOLD');execute(w,'failure');
  assert.equal(w.ledger.paypalPaid,70000);assert.equal(w.ledger.customerRefunds,100000);
  assert.equal(w.ledger.supplierPaid,0);assert.equal(w.ledger.reserve,0);invariant(w);
});
test('pending refunds move no money until reconciliation, which is idempotent',()=>{
  const w=investigateCase();choose(w,'RELEASE');execute(w,'pending');
  assert.equal(w.ledger.paypalPaid,0);assert.equal(w.ledger.customerRefunds,0);assert.equal(w.ledger.reserve,14000);
  reconcileRefund(w);reconcileRefund(w);assert.equal(w.ledger.paypalPaid,86000);invariant(w);
});
test('stock race rejects stale approval and supports a second investigation',()=>{
  const w=investigateCase();choose(w,'RELEASE');stockRace(w);
  assert.throws(()=>execute(w,'success'),/Stock changed/);
  assert.equal(w.ledger.reserve,20000);assert.equal(w.ledger.available,10000);assert.equal(w.quote.stock,4);
  sendAgents(w);for(let i=0;i<300&&w.phase===2;i++)tick(w,.1);
  assert.equal(w.phase,3);assert.equal(w.recommendation.decision,'HOLD');
});
test('changed assumptions invalidate approval and remain separate from observed evidence',()=>{
  const w=investigateCase();choose(w,'RELEASE');setAssumptions(w,{successBps:9000});
  assert.equal(w.phase,3);assert.equal(w.approval,null);assert.equal(w.evidence.filter(e=>e.found).length,3);
  assert.throws(()=>execute(w),/approval/);assert.throws(()=>setAssumptions(w,{successBps:10001}),/Invalid/);
});
test('pause freezes investigation and world motion; reset creates clean state',()=>{
  const w=createEconomy();injectShock(w);sendAgents(w);w.paused=true;
  const before=JSON.stringify(w);tick(w,.1);assert.equal(JSON.stringify(w),before);
  const fresh=createEconomy();assert.equal(fresh.phase,0);assert.equal(fresh.events.length,1);assert.equal(fresh.recommendation,null);
});
test('office stock is consumed without creating new invoices or changing case money',()=>{
  const w=createEconomy(),cash=structuredClone(w.ledger);
  startSupplyFlow(w);
  for(let i=0;i<180;i++)tick(w,.1);
  assert.deepEqual(w.offices.map(o=>o.stock),[0,0]);assert.deepEqual(w.offices.map(o=>o.consumed),[2,2]);
  assert.equal(w.orders.length,4);assert.deepEqual(w.ledger,cash);invariant(w);
});
test('the van picks up, restocks Mara, packs, and delivers stock only at each office arrival',()=>{
  const w=investigateCase();const before=w.offices.map(o=>o.stock);choose(w,'RELEASE');execute(w,'success');
  assert.deepEqual(w.offices.map(o=>o.stock),before);
  assert.equal(w.delivery.awaitingPickup,4);assert.equal(w.delivery.load,0);
  advanceUntil(w,()=>w.delivery.stage==='restock');assert.equal(w.delivery.awaitingPickup,0);assert.equal(w.delivery.load,4);
  advanceUntil(w,()=>w.delivery.stage==='packing');assert.equal(w.delivery.packing,4);assert.equal(w.delivery.load,0);
  assert.deepEqual(w.offices.map(o=>o.received),[0,0]);
  advanceUntil(w,()=>w.delivery.stage==='office-a');assert.equal(w.delivery.packing,0);assert.equal(w.delivery.load,4);
  advanceUntil(w,()=>w.delivery.stage==='office-b');
  assert.deepEqual(w.offices.map(o=>o.received),[2,0]);assert.equal(w.delivery.load,2);
  assert.equal(w.orders.filter(o=>o.delivery==='DELIVERED').length,2);
  w.paused=true;const paused=JSON.stringify(w);tick(w,.1);assert.equal(JSON.stringify(w),paused);w.paused=false;
  advanceUntil(w,()=>w.delivery.stage==='complete');assert.equal(w.delivery.load,0);
  assert.deepEqual(w.offices.map(o=>o.stock),before.map(n=>n+2));assert.equal(w.offices.reduce((s,o)=>s+o.received,0),4);
  for(let i=0;i<200;i++)tick(w,.1);assert.deepEqual(w.offices.map(o=>o.stock),before.map(n=>n+2));invariant(w);
  assert.equal(w.events.filter(e=>e.type==='Office delivery received').length,2);
  assert.equal(w.events.filter(e=>e.type==='All deliveries complete').length,1);
  assert.equal(createEconomy().delivery,null);
});
test('visible requests precede the failed restock without adding orders or charging buyers again',()=>{
  const w=createEconomy(),cash=structuredClone(w.ledger),orders=structuredClone(w.orders);
  for(let i=0;i<200;i++)tick(w,.1);assert.deepEqual(w.offices.map(o=>o.stock),[2,2],'The opening scene waits for play');
  startSupplyFlow(w);assert.equal(w.orderFlow.stage,'requests');
  assert.equal(w.events.filter(e=>e.type==='Stock requested').length,2);
  assert.throws(()=>startSupplyFlow(w),/already started/);
  w.paused=true;const paused=JSON.stringify(w);tick(w,.1);assert.equal(JSON.stringify(w),paused);w.paused=false;
  advanceUntil(w,()=>w.orderFlow.stage==='restock');assert.equal(w.phase,0);
  advanceUntil(w,()=>w.phase===1);assert.equal(w.orderFlow.stage,'blocked');
  assert.deepEqual(w.ledger,cash);assert.deepEqual(w.orders,orders);
  assert.equal(w.recommendations[0].decision,'HOLD');
  assert.equal(w.events.filter(e=>e.type==='Restock requested').length,1);
});
test('all authored refund outcomes keep goods out of offices and never dispatch a delivery',()=>{
  for(const [decision,outcome] of [['HOLD','failure'],['RELEASE','failure'],['RELEASE','pending']]){
    const w=investigateCase();choose(w,decision);execute(w,outcome);
    for(let i=0;i<300;i++)tick(w,.1,true);
    assert.equal(w.delivery,null);assert.deepEqual(w.offices.map(o=>o.received),[0,0]);
    assert.equal(w.actors.find(a=>a.id==='courier').path.length,0);invariant(w);
  }
});
test('all loading-lane routes avoid warehouses, packing benches and offices',()=>{
  for(const from of NODES)for(const to of NODES){
    const path=[from,...streetRoute(from,to)];assert.deepEqual(path.at(-1),to);
    for(let i=1;i<path.length;i++){
      const a=path[i-1],b=path[i];assert.ok(a.x===b.x||a.y===b.y);
      for(let t=0;t<=1;t+=.1){const x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
        assert.ok(!PLACES.some(p=>x>p.x&&x<p.x+p.w&&y>p.y&&y<p.y+p.h));
      }
    }
  }
});
test('export labels synthetic probabilities, provider coverage and the incomplete real observation horizon',()=>{
  const run=exportEconomy(investigateCase());assert.match(run.disclosure,/authored probabilities/);assert.equal(run.horizon.realObservationComplete,false);
});
