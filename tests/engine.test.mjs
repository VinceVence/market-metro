import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS, createWorld, injectShock, investigate, compare, openReview, review, execute, stockRace, reconcile, applyPayment, assertInvariants, exportRun } from '../demo/engine.mjs';

function atReview(id) {
  const w = createWorld(id);
  injectShock(w); investigate(w); compare(w); openReview(w);
  return w;
}

test('authorizations do not create spendable cash', () => {
  const w = createWorld();
  assert.equal(w.orders.reduce((s, o) => s + o.amount, 0), 32000);
  assert.equal(w.merchant.available, 10000);
  assert.equal(w.merchant.unsettledReceipts, 0);
  assertInvariants(w);
});

test('approved recovery conserves money and keeps captured funds unsettled', () => {
  const w = atReview();
  assert.equal(w.comparison.keep.recoverableOrders, 0);
  assert.equal(w.comparison.release.recoverableOrders, 4);
  review(w, 'APPROVE'); execute(w);
  assert.equal(w.merchant.reserve, 14000);
  assert.equal(w.merchant.available, 0);
  assert.equal(w.merchant.supplierPaid, 16000);
  assert.equal(w.merchant.unsettledReceipts, 32000);
  assert.equal(w.quote.stock, 0);
  assertInvariants(w);
  assert.throws(() => execute(w), /stage/);
});

test('agent cannot approve its own recommendation', () => {
  const w = atReview();
  assert.throws(() => review(w, 'APPROVE', 'agent'), /only the simulated human/);
  assert.equal(w.approval, null);
  assert.equal(w.merchant.reserve, 20000);
});

test('human may keep reserve despite favorable recommendation', () => {
  const w = atReview(); review(w, 'KEEP'); execute(w);
  assert.equal(w.merchant.reserve, 20000);
  assert.equal(w.merchant.available, 10000);
  assert.ok(w.orders.every(o => o.status === 'VOIDED'));
});

for (const id of ['no-capacity', 'competing-reservation', 'cash-sufficient', 'protection-gap']) {
  test(`${id}: cash-gap reasoning cannot override a failed case check`, () => {
    const w = atReview(id);
    assert.equal(w.dossier.verdict, 'KEEP_RESERVE');
    assert.throws(() => review(w, 'APPROVE'), /blocked/);
    review(w, 'KEEP'); execute(w);
    assert.equal(w.merchant.reserve, 20000);
    assert.equal(w.purchased, id === 'cash-sufficient');
    assertInvariants(w);
  });
}

for (const id of ['stale-quote', 'unknown-liability']) {
  test(`${id}: team abstains and release is blocked`, () => {
    const w = atReview(id);
    assert.equal(w.dossier.verdict, 'MORE_EVIDENCE');
    assert.throws(() => review(w, 'APPROVE'), /blocked/);
  });
}

test('a reservation race invalidates approval before funds move', () => {
  const w = atReview(); review(w, 'APPROVE'); stockRace(w);
  assert.throws(() => execute(w), /No money moved/);
  assert.equal(w.stage, 1);
  assert.equal(w.merchant.reserve, 20000);
  assert.equal(w.merchant.available, 10000);
  assert.equal(w.quote.reservedBy, 'B');
  investigate(w); compare(w); openReview(w); review(w, 'KEEP'); execute(w);
  assert.equal(w.quote.stock, 4);
  assert.ok(w.orders.every(o => o.status === 'VOIDED'));
});

test('pending capture is not counted as captured or delivered; reconciliation adds it once', () => {
  const w = atReview(); review(w, 'APPROVE'); execute(w, 'pending');
  assert.equal(w.orders[0].status, 'CAPTURE_PENDING');
  assert.equal(w.orders[0].delivered, false);
  assert.equal(w.merchant.grossCaptured, 24000);
  reconcile(w); reconcile(w);
  assert.equal(w.merchant.grossCaptured, 32000);
  assert.equal(w.merchant.available, 0);
  assert.equal(w.orders[0].status, 'CAPTURED');
});

test('failed reconciliation never creates capture revenue', () => {
  const w = atReview(); review(w, 'APPROVE'); execute(w, 'pending'); reconcile(w, 'FAILED');
  assert.equal(w.orders[0].status, 'CAPTURE_FAILED');
  assert.equal(w.merchant.grossCaptured, 24000);
  assertInvariants(w);
});

test('capture retries with the same request identity do not duplicate money', () => {
  const w = atReview(); review(w, 'APPROVE'); execute(w);
  const receipt = applyPayment(w, w.orders[0].id, 'capture');
  assert.equal(receipt.id, 'LOCAL-RECEIPT-1');
  assert.equal(w.merchant.grossCaptured, 32000);
  assert.throws(() => applyPayment(w, w.orders[1].id, 'capture', 'COMPLETED', `${w.orders[0].id}:capture`), /different operation/);
  assert.throws(() => applyPayment(w, w.orders[0].id, 'capture', 'COMPLETED', 'different-key'), /eligible authorization/);
});

test('captured money requires a refund; a pending refund has not moved funds', () => {
  const w = atReview(); review(w, 'APPROVE'); execute(w, 'return');
  assert.throws(() => applyPayment(w, w.orders[0].id, 'void'), /uncaptured/);
  assert.equal(w.merchant.refunded, 0);
  assert.equal(w.merchant.unsettledReceipts, 32000);
  reconcile(w);
  assert.equal(w.merchant.refunded, 8000);
  assert.equal(w.merchant.unsettledReceipts, 24000);
  assert.equal(w.orders[0].status, 'REFUNDED');
  assertInvariants(w);
});

test('all cases retain open liabilities in their exported evaluation', () => {
  for (const s of SCENARIOS) {
    const w = atReview(s.id);
    review(w, w.dossier.verdict === 'RECOMMEND_REVIEW' ? 'APPROVE' : 'KEEP'); execute(w);
    const run = exportRun(w);
    assert.equal(run.terminalAssessment.priorObligationsStillOpen, true);
    assert.equal(run.terminalAssessment.horizonDays, 30);
    assert.match(run.disclosure, /No model performance/);
    assertInvariants(w);
  }
});

test('paired-world evaluation has no side effects on the world ledger or stock', () => {
  const w = createWorld(); injectShock(w); investigate(w);
  const before = JSON.stringify({ merchant: w.merchant, quote: w.quote, orders: w.orders });
  compare(w);
  assert.equal(JSON.stringify({ merchant: w.merchant, quote: w.quote, orders: w.orders }), before);
  assert.equal(w.comparison.release.ifSupplierFails.fulfilled, 0);
  assert.equal(w.comparison.release.ifSupplierFails.potentialSupplierSpendLost, 16000);
});
