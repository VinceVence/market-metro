import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createEvidenceEconomy,savedReceipt,startEvidenceShift,tickEvidenceEconomy,advanceInvestigation,applyEvidenceReview,assertEvidenceEconomy,evidenceTotals,investigatorView,investigationRequests,exportEvidenceEconomy} from '../demo/game/evidence-economy.mjs';
import {total} from '../demo/game/network.mjs';

// Test fixture fields, not credentials. The recorded sandbox artifact is verified separately.
const receipt={quantity:10,grossCents:10000,paypalOrderId:'TEST-ORDER',orderStatus:'COMPLETED',paymentState:'COMPLETED',verifiedAt:'2026-10-20T14:37:46Z',
  receipt:{provenance:'PAYPAL_SANDBOX',orderId:'TEST-ORDER',captureId:'TEST-CAPTURE',status:'COMPLETED',currency:'USD',grossCents:10000,feeCents:370,netCents:9630}};
function until(w,phase){for(let i=0;i<1800&&w.phase!==phase;i++)tickEvidenceEconomy(w,.1);assert.equal(w.phase,phase);}
function review(w){startEvidenceShift(w);until(w,'review');return w;}
function settle(w,policy='balanced'){applyEvidenceReview(w,policy);until(w,'settled');return w;}

test('saved receipt is linked only once per replay and never becomes a new provider capture',()=>{
  const original=structuredClone(receipt),w=review(createEvidenceEconomy(12,receipt));
  assert.equal(w.currentOrders[0].paymentSource,'SAVED_SANDBOX_REFERENCE');
  assert.equal(w.currentOrders[0].fee,370);assert.equal(w.currentOrders[0].net,9630);
  settle(w);review(w);settle(w);
  assert.equal(w.orders.filter(o=>o.captureReference).length,1);
  assert.ok(w.orders.every(o=>o.provenance==='SIMULATED_REPLAY'));
  assert.deepEqual(receipt,original);
  const restarted=review(createEvidenceEconomy(12,receipt));
  assert.equal(restarted.orders.length,12);assert.equal(restarted.orders[0].captureReference,'TEST-CAPTURE');
});

test('extra carrier investigation changes the same reserve rule; bad proof never clears a failed order',()=>{
  const w=review(createEvidenceEconomy(36,receipt)),[hold,initial,team]=w.plans;
  assert.deepEqual(evidenceTotals(w,'M001'),{units:10,initial:2,confirmed:6,unresolved:4,rejected:0});
  assert.equal(hold.rows[0].held,9630);
  assert.equal(initial.rows[0].held,8400);assert.equal(initial.rows[0].release,1230);
  assert.equal(team.rows[0].held,5200);assert.equal(team.rows[0].release,4430);
  assert.equal(team.rows[1].verified,0);assert.equal(team.rows[1].release,0);
  assert.equal(evidenceTotals(w,'M002').rejected,2);
  assert.ok(w.queries.filter(q=>q.response.orderId==='UNRELATED-ORDER').every(q=>!q.accepted));
  assert.ok(w.cases.filter(c=>c.buyer?.status==='RECEIVED'&&!c.confirmed).length>0,'An unsupported office claim must stay unresolved.');
  assert.equal(w.ledger.released,0,'Investigation and recommendations cannot move money.');
});

test('investigators see only published observations and select only evidence gaps',()=>{
  const w=createEvidenceEconomy(12,receipt);startEvidenceShift(w);until(w,'debate');
  const observation=investigatorView(w),json=JSON.stringify(observation);
  assert.ok(!/\"(delivered|arrived|draw|cash|seed|successBps)\":/.test(json));
  assert.ok(observation.units.every(u=>u.carrier===null&&u.buyer===null));
  const requests=investigationRequests(observation,'carrier');
  assert.equal(requests.length,observation.units.filter(u=>!u.confirmed).length);
  assert.ok(requests.every(q=>!observation.units.find(u=>u.id===q.unitId).confirmed));
  const before=structuredClone(observation);
  w.merchants[0].delivered=0;
  assert.deepEqual(investigatorView(w),before,'Changing private physical counters cannot change the agent inputs.');
  advanceInvestigation(w);
  assert.equal(evidenceTotals(w,'M001').confirmed,6,'The source records, not the visual counter, establish proof.');
});

test('review releases each merchant’s own funds and changes affordable restocking next shift',()=>{
  const hold=settle(review(createEvidenceEconomy(12,receipt)),'hold');
  const initial=settle(review(createEvidenceEconomy(12,receipt)),'checklist');
  const team=settle(review(createEvidenceEconomy(12,receipt)));
  assert.equal(team.merchants[0].cash,5430);assert.equal(team.merchants[0].reserve,1200);
  assert.equal(team.merchants[0].refunded,4000);
  assert.equal(hold.merchants[0].cash,1000);assert.equal(hold.merchants[0].reserve,5630);
  for(const w of [hold,initial,team]){startEvidenceShift(w);until(w,'delivery');assertEvidenceEconomy(w);}
  assert.equal(hold.merchants[0].purchased,1);
  assert.equal(initial.merchants[0].purchased,3);
  assert.equal(team.merchants[0].purchased,9);
});

for(const count of [12,36,120])test(`${count} merchants finish three shifts with conserved cash, goods and provenance`,()=>{
  const w=createEvidenceEconomy(count,receipt);
  for(let i=0;i<3;i++){
    review(w);const before=structuredClone(w.merchants);
    applyEvidenceReview(w);
    for(let j=0;j<count;j++){
      assert.equal(before[j].cash+before[j].reserve,w.merchants[j].cash+w.merchants[j].reserve);
      assert.equal(w.merchants[j].cash-before[j].cash,w.applied.rows[j].release);
    }
    until(w,'settled');assertEvidenceEconomy(w);
    assert.equal(total(w.currentOrders,o=>o.delivered*1000+o.refunded),total(w.currentOrders,'amount'));
    assert.equal(total(w.merchants,m=>m.delivered+m.lost),total(w.merchants,'purchased'));
  }
  assert.equal(w.orders.length,count*3);assert.equal(w.reviewHistory.length,3);
  assert.equal(total(w.offices,'received'),total(w.history,'delivered'));
  assert.throws(()=>startEvidenceShift(w),/Complete/);
  const exported=exportEvidenceEconomy(w);
  assert.equal(exported.reviewHistory[0].queries.length,w.reviewHistory[0].queries.length);
  assert.match(exported.disclosure,/No checkout/);assert.match(exported.disclosure,/scripted/);
});

test('non-reviewer authority, stale evidence, double execution and pause cannot move funds',()=>{
  const w=review(createEvidenceEconomy(12,receipt));
  const ledger=structuredClone(w.ledger);
  assert.throws(()=>applyEvidenceReview(w,'balanced','agent'),/reviewer/);
  assert.deepEqual(w.ledger,ledger);
  w.cases.find(c=>c.confirmed).confirmed=false;
  assert.throws(()=>applyEvidenceReview(w),/Evidence or balances/);
  assert.deepEqual(w.ledger,ledger);
  const fresh=review(createEvidenceEconomy(12,receipt));fresh.paused=true;
  const frozen=structuredClone(fresh);tickEvidenceEconomy(fresh,.1);assert.deepEqual(fresh,frozen);
  fresh.paused=false;
  fresh.plans[2].rows[0].release=99999999;
  applyEvidenceReview(fresh);
  assert.equal(fresh.merchants[0].released,4430,'Execution recomputes from observations, not UI proposals.');
  const moved=structuredClone(fresh.ledger);
  assert.throws(()=>applyEvidenceReview(fresh),/fresh review/);assert.deepEqual(fresh.ledger,moved);
  until(fresh,'settled');const settled=structuredClone(fresh);
  for(let i=0;i<20;i++)tickEvidenceEconomy(fresh,.1);
  assert.deepEqual(fresh.ledger,settled.ledger);assert.equal(fresh.history.length,1);
});

test('ineligible receipts do not masquerade as native proof and synthetic mode still runs',()=>{
  for(const change of [{paymentState:'PENDING'},{orderStatus:'REFUNDED'},{grossCents:9999},{paypalOrderId:'OTHER'},{verifiedAt:'invalid'}]){
    assert.equal(savedReceipt([{...receipt,...change}]),null);
  }
  for(const change of [{provenance:'GENERATED_PAYMENT'},{currency:'EUR'},{netCents:null},{feeCents:-1},{netCents:10000}]){
    assert.equal(savedReceipt([{...receipt,receipt:{...receipt.receipt,...change}}]),null);
  }
  const w=settle(review(createEvidenceEconomy(12)));
  assert.equal(w.paymentReference,null);assert.ok(w.orders.every(o=>o.paymentSource==='GENERATED_PAYMENT'));
  assertEvidenceEconomy(w);
});

test('identical seed and evidence produce identical reviews; UI fetches only the saved local receipt',async()=>{
  const a=settle(review(createEvidenceEconomy(12,receipt))),b=settle(review(createEvidenceEconomy(12,receipt)));
  assert.deepEqual(exportEvidenceEconomy(a),exportEvidenceEconomy(b));
  const app=await readFile(new URL('../demo/game/network-app.mjs',import.meta.url),'utf8');
  const requests=[...app.matchAll(/fetch\(([^,\n]+)/g)].map(m=>m[1]);
  assert.deepEqual(requests,["'/api/paypal/orders'"],'The main economy must not introduce payment creation, verification or capture calls.');
  assert.doesNotMatch(app,/method:\s*['"]POST/);
});
