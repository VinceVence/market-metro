import test from 'node:test';
import assert from 'node:assert/strict';
import {createNetwork,beginShift,beginDebate,buildPlans,evaluatePlan,applyPlan,tickNetwork,changeReleaseLimit,assertNetwork,total,exportNetwork} from '../demo/game/network.mjs';

function until(w,predicate){for(let i=0;i<1200&&!predicate();i++)tickNetwork(w,.1);assert.ok(predicate(),'The network must progress to the requested state');}
function review(w){if(w.phase==='ready'||w.phase==='settled')beginShift(w);until(w,()=>w.phase==='observe');beginDebate(w);until(w,()=>w.phase==='review');return w;}
function settle(w,kind='balanced'){applyPlan(w,kind);until(w,()=>w.phase==='settled');assertNetwork(w);}

for(const count of [12,36,120])test(`${count} separate wallets and ${count*4} offices complete all three shocks with conserved money and goods`,()=>{
  const w=createNetwork(count);assert.equal(w.offices.length,count*4);
  for(let round=0;round<3;round++){
    review(w);const oldOrders=w.orders.length;settle(w);assert.equal(w.orders.length,oldOrders,'Delivery must not capture another payment');
    assert.equal(total(w.merchants,'purchased'),total(w.merchants,m=>m.delivered+m.lost));
    assert.equal(total(w.warehouses,'opening')-total(w.warehouses,'stock'),total(w.merchants,'purchased'));
    assert.ok(w.currentOrders.every(o=>o.delivered*5000+o.refunded===o.amount));
  }
  assert.equal(w.history.length,3);assert.equal(total(w.offices,'received'),total(w.history,'delivered'));
  assert.equal(w.ledger.paypalCoverage,total(w.history,'coverage'));
  assert.throws(()=>beginShift(w),/Finish/);
});

test('competing objectives generate different merchant allocations and future policies from the same economy',()=>{
  const w=review(createNetwork()),[risk,commerce,balanced]=w.plans;
  assert.equal(risk.released,0);assert.ok(commerce.released>balanced.released);
  assert.ok(balanced.releaseCount>commerce.releaseCount);
  assert.equal(balanced.units,commerce.units);assert.ok(balanced.expectedLoss<risk.expectedLoss);
  assert.ok(balanced.underserved<commerce.underserved,'The revision should respond to Network’s service-gap challenge');
  assert.ok(balanced.extraWorst>0,'The remaining risk disagreement must have a real numerical basis');
  assert.ok(risk.rows.every(r=>r.rate===4000));assert.ok(commerce.rows.every(r=>r.rate===1000));
  assert.ok(risk.paused>balanced.paused);assert.notDeepEqual(commerce.rows,balanced.rows);
  assert.match(w.debate.at(-1).text,/still prefer holding/);
});

test('policy comparison is read-only and cannot spend another merchant’s reserve',()=>{
  const w=review(createNetwork()),before=structuredClone(w);buildPlans(w);assert.deepEqual(w,before);
  const invalid=w.merchants.map(()=>0);invalid[0]=w.merchants[0].reserve+1;
  assert.throws(()=>evaluatePlan(w,invalid),/own reserve/);assert.deepEqual(w,before);
});

test('agent self-approval, stale stock and double execution cannot move money',()=>{
  const w=review(createNetwork()),cash=structuredClone(w.ledger);
  assert.throws(()=>applyPlan(w,'balanced','agent'),/reviewer/);assert.deepEqual(w.ledger,cash);
  w.warehouses[1].stock--;assert.throws(()=>applyPlan(w,'balanced'),/evidence changed/);assert.deepEqual(w.ledger,cash);
  beginDebate(w);until(w,()=>w.phase==='review');applyPlan(w,'balanced');
  const after=structuredClone(w.ledger);assert.throws(()=>applyPlan(w,'balanced'),/fresh review/);assert.deepEqual(w.ledger,after);
});

test('payment pauses persist into the next shift and block captures instead of refunding fictional sales',()=>{
  const w=review(createNetwork());settle(w,'risk');
  assert.ok(w.merchants.every(m=>m.rate===4000&&!m.acceptNew));const captured=w.ledger.captured;
  beginShift(w);assert.equal(total(w.merchants,'due'),0);assert.equal(w.currentOrders.length,0);assert.ok(w.declined>0);assert.equal(w.ledger.captured,captured);assertNetwork(w);
  until(w,()=>w.phase==='observe');beginDebate(w);until(w,()=>w.phase==='review');settle(w);
  assert.ok(w.merchants.every(m=>m.acceptNew),'The agents can reopen next-shift acceptance after reconsideration');
  beginShift(w);assert.ok(w.ledger.captured>captured);
});

test('the authored downside limit blocks a trading plan that spends too much refund backing',()=>{
  const w=createNetwork();changeReleaseLimit(w,90000);review(w);
  settle(w);review(w);const bad=w.plans.find(p=>!p.eligible);
  assert.ok(bad,'The freight shock must produce a concrete limit conflict');
  const before=structuredClone(w.ledger);assert.throws(()=>applyPlan(w,bad.kind),/failure-exposure/);assert.deepEqual(w.ledger,before);
});

test('changing limits invalidates old proposals and pause freezes debate and delivery',()=>{
  const w=review(createNetwork());changeReleaseLimit(w,30000);assert.equal(w.phase,'observe');assert.equal(w.plans.length,0);
  assert.throws(()=>applyPlan(w,'balanced'),/fresh review/);beginDebate(w);w.paused=true;
  let before=structuredClone(w);tickNetwork(w,.1);assert.deepEqual(w,before);w.paused=false;until(w,()=>w.phase==='review');
  applyPlan(w,'balanced');assert.equal(total(w.merchants,'delivered'),0,'Funding is not proof of delivery');
  w.paused=true;before=structuredClone(w);tickNetwork(w,.1);assert.deepEqual(w,before);
  w.paused=false;until(w,()=>w.phase==='settled');const receipts=w.events.length;
  for(let i=0;i<100;i++)tickNetwork(w,.1);assert.equal(w.events.length,receipts,'Settled receipts must not repeat');
});

test('export distinguishes scripted expected results from realized synthetic coverage',()=>{
  const w=review(createNetwork());settle(w);const exported=exportNetwork(w);
  assert.match(exported.disclosure,/hypothetical internal policy/);assert.match(exported.disclosure,/No LLM/);
  assert.notEqual(w.history[0].coverage,w.history[0].expectedCoverage);
  assert.doesNotThrow(()=>JSON.stringify(exported));
});
