import test from 'node:test';
import assert from 'node:assert/strict';
import {createNetwork,beginShift,buildFixedPlan,applyPlan,tickNetwork,assertNetwork,fixtureDraw,total} from '../demo/game/network.mjs';
import {createComparison,startComparisonShift,tickComparison,comparisonMetrics,benefitBreakdown,exportComparison,assertMatchedShock} from '../demo/game/paired-comparison.mjs';

function oneShock(p){startComparisonShift(p);for(let i=0;i<1500&&p.phase==='running';i++)tickComparison(p,.1);assert.ok(['between','complete'].includes(p.phase));p.worlds.forEach(assertNetwork);return p;}
function run(p=createComparison()){for(let i=0;i<3;i++)oneShock(p);return p;}
function settleFixed(w){beginShift(w);for(let i=0;i<40;i++)tickNetwork(w,.1);w.plans=[buildFixedPlan(w)];w.phase='review';applyPlan(w,'fixed');for(let i=0;i<600&&w.phase==='delivery';i++)tickNetwork(w,.1);assert.equal(w.phase,'settled');assertNetwork(w);return w;}

for(const strategy of ['fixed','balanced'])test(`identical-policy control (${strategy}) has exactly zero paired benefit, including fees and churn`,()=>{
  const p=run(createComparison({count:12},[strategy,strategy]));
  assert.deepEqual(p.worlds[0].ledger,p.worlds[1].ledger);
  assert.deepEqual(p.worlds[0].merchants,p.worlds[1].merchants);
  assert.deepEqual(p.worlds[0].churnAudit,p.worlds[1].churnAudit);
  assert.equal(benefitBreakdown(p).total,0);assert.ok(p.rounds.every(r=>r.benefit===0));
});

test('fees reduce merchant procurement cash, while processing costs are a provider expense',()=>{
  const plain=createNetwork(12),withFees=createNetwork(12,{economics:{feeBps:300,processingCostBps:100}});beginShift(plain);beginShift(withFees);
  assert.equal(plain.merchants[0].cash,10000);assert.equal(withFees.merchants[0].cash,8800);
  assert.equal(withFees.merchants[0].reserve,8000);assert.equal(withFees.ledger.feesCollected,19800);assert.equal(withFees.ledger.processingCost,6600);
  assert.equal(total(plain.merchants,'cash')-total(withFees.merchants,'cash'),withFees.ledger.feesCollected,'Processing cost must not be deducted from merchants a second time');assertNetwork(withFees);
});

test('refunded fees are credited once before uncovered-refund coverage and conserve cash',()=>{
  const w=settleFixed(createNetwork(12,{economics:{feeBps:300,processingCostBps:100,refundFeeReturnBps:10000}}));
  for(const o of w.orders)assert.equal(o.feeReturned,Math.round(o.fee*o.refunded/o.amount));
  assert.equal(w.ledger.feesReturned,total(w.orders,'feeReturned'));assert.ok(w.ledger.feesReturned>0);
  assert.equal(w.ledger.processingCost,6600,'Original processing expense persists after refunds');
  const before=structuredClone(w.ledger);for(let i=0;i<40;i++)tickNetwork(w,.1);assert.deepEqual(w.ledger,before);assertNetwork(w);
});

test('merchant departures happen after current settlement and stop later captures, fees and reviews',()=>{
  const w=settleFixed(createNetwork(12,{economics:{feeBps:300,churnBaseBps:10000}}));
  assert.ok(w.merchants.every(m=>!m.active&&m.settled));assert.ok(w.currentOrders.every(o=>o.status!=='CAPTURED'));
  const captured=w.ledger.captured,fees=w.ledger.feesCollected;beginShift(w);
  assert.equal(total(w.merchants,'due'),0);assert.equal(w.currentOrders.length,0);assert.equal(w.lostToChurn,150);assert.equal(w.declined,0);
  assert.equal(w.ledger.captured,captured);assert.equal(w.ledger.feesCollected,fees);assertNetwork(w);
});

test('shared shocks and keyed randomness remain matched as the two populations diverge',()=>{
  const p=createComparison();assert.notEqual(p.worlds[0].merchants,p.worlds[1].merchants);assert.notEqual(p.worlds[0].economics,p.worlds[1].economics);
  for(let i=0;i<3;i++){
    oneShock(p);assertMatchedShock(p);
    for(const m of p.worlds[0].merchants)for(const type of ['delivery','churn'])assert.equal(fixtureDraw(p.worlds[0],m.id,type),fixtureDraw(p.worlds[1],m.id,type));
  }
  assert.deepEqual(p.audit.map(a=>a.potentialUnits),[396,450,594]);
  assert.notDeepEqual(p.worlds[0].merchants.map(m=>m.active),p.worlds[1].merchants.map(m=>m.active));
  for(const w of p.worlds){const m=comparisonMetrics(w);assert.equal(m.captured+m.lostChurnGMV+m.blockedGMV,7200000);}
});

test('default net benefit reconciles from actual fees and expenses; churn is not charged twice',()=>{
  const p=run(),[fixed,agents]=p.worlds.map(comparisonMetrics),d=benefitBreakdown(p);
  assert.equal(fixed.net,-3104400);assert.equal(agents.net,-2683475);assert.equal(d.total,420925);
  assert.equal(d.fees,-13200);assert.equal(d.processing,4400);assert.equal(d.coverage,432000);assert.equal(d.agentCost,-2275);
  assert.equal(d.fees+d.processing+d.coverage+d.agentCost,d.total);
  assert.equal(agents.churned,16);assert.equal(fixed.churned,15,'The model must expose worse retention even when contribution improves');
  for(const w of p.worlds)assert.equal(comparisonMetrics(w).net,total(w.history,'netContribution'));
});

test('higher assumed agent cost can reverse the winner without changing delivery or churn outcomes',()=>{
  const p=run(createComparison({reviewCostPerMerchant:5000}));
  assert.ok(benefitBreakdown(p).total<0);assert.equal(comparisonMetrics(p.worlds[1]).delivered,317);
  assert.equal(comparisonMetrics(p.worlds[1]).churned,16);assert.equal(p.worlds[1].ledger.agentCost,455000);
});

test('turning churn off preserves all merchants and isolates payment-pause effects',()=>{
  const p=run(createComparison({churnScaleBps:0}));
  for(const w of p.worlds){assert.equal(comparisonMetrics(w).active,36);assert.equal(w.churnAudit.length,0);assert.equal(comparisonMetrics(w).lostChurnGMV,0);}
  assert.ok(comparisonMetrics(p.worlds[1]).blockedGMV>0);
});

test('paired assumptions are locked; reset is required before comparing changed inputs',()=>{
  const p=oneShock(createComparison());p.settings.seed++;
  const before=structuredClone(p.worlds.map(w=>w.ledger));assert.throws(()=>startComparisonShift(p),/Reset both/);assert.deepEqual(p.worlds.map(w=>w.ledger),before);
  const changed=createComparison();changed.worlds.forEach(w=>{w.economics.feeBps=400;});assert.throws(()=>startComparisonShift(changed),/inputs differ/);
  assert.throws(()=>createComparison({feeBps:NaN}),/Invalid/);assert.throws(()=>createComparison({churnScaleBps:-1}),/Invalid/);
});

test('pause stops both economies and duplicate starts cannot create extra captures',()=>{
  const p=createComparison();startComparisonShift(p);const before=structuredClone(p.worlds.map(w=>w.ledger));assert.throws(()=>startComparisonShift(p),/both worlds/);assert.deepEqual(p.worlds.map(w=>w.ledger),before);
  p.paused=true;const frozen=structuredClone(p);tickComparison(p,.1);assert.deepEqual(p,frozen);
});

test('full paired replay also completes at the largest UI scale',()=>{
  const p=run(createComparison({count:120,seed:42,refundFeeReturnBps:10000}));
  assert.equal(p.rounds.length,3);assert.equal(p.worlds[0].merchants.length,120);p.worlds.forEach(assertNetwork);
});

test('export contains the paired input audit, exact arithmetic and finite-horizon disclosure',()=>{
  const p=run(createComparison({count:12})),result=exportComparison(p);
  assert.equal(result.phase,'complete');assert.equal(result.audit.length,3);assert.ok(result.audit.every(a=>a.matched));
  assert.match(result.scope,/no additional lifetime-value penalty/);assert.match(result.scope,/not real PayPal policy/);
  assert.equal(result.metrics[1].net-result.metrics[0].net,result.benefit.total);assert.doesNotThrow(()=>JSON.stringify(result));
});
