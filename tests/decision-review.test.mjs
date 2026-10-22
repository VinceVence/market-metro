import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPacket, validatePacket, fixedReview, grade, hash, violations, analyze } from '../scripts/decision-review.mjs';

function toy(overrides = {}) {
  return buildPacket({ id: 'UNIT-ONLY', context: 'Unscored arithmetic/control fixture', cancelled: 0, early: 1, late: 1, held: 100, cap: 50,
    objective: 'expected_gap', policyText: 'Minimize expected gap', sources: [],
    forecast: { vectors: [[1, 0, 0]] }, plans: [
      { id: 'ONE', cost: 10, early: 0, late: 1 },
      { id: 'BOTH', cost: 30, early: 1, late: 1 },
    ], ...overrides });
}

test('decision-only benchmark: arithmetic, policy switches, controls, unsupported assumptions and honest grading', () => {
  const p = toy();
  validatePacket(p);
  assert.deepEqual(p.plans.find(a => a.id === 'ONE').payoffs.map(x => x.providerGapCents), [1000, 1000, 11000]);
  assert.deepEqual(p.plans.find(a => a.id === 'BOTH').payoffs.map(x => x.providerGapCents), [0, 3000, 13000]);
  const r = fixedReview(p);
  assert.equal(r.planId, 'BOTH');
  assert.equal(grade(p, r).successful, true);
  assert.equal(grade(p, { ...r, paymentCents: 1 }).numericErrors.length, 1);
  assert.equal(grade(p, { ...r, worstGapCents: 0 }).numericErrors.length, 1);
  assert.equal(grade(p, { ...r, inputHash: 'wrong' }).successful, false);
  assert.equal(grade(p, { ...r, disposition: 'escalate', planId: null, paymentCents: 0 }).unnecessaryEscalation, true);
  const missing = toy({ forecast: { vectors: [] } });
  assert.equal(fixedReview(missing).disposition, 'escalate');
  assert.equal(grade(missing, fixedReview(missing)).appropriateEscalation, true);
  assert(grade(missing, { ...r, inputHash: missing.inputHash }).policyViolations.includes('UNSUPPORTED_POLICY_OR_FORECAST_ASSUMPTION'));
  const opaque = toy({ authority: false });
  assert.equal(fixedReview(opaque).disposition, 'escalate');
  const robust = toy({ objective: 'minimax_gap', forecast: { vectors: [[1, 0, 0], [0, 0, 1]] } });
  assert.equal(fixedReview(robust).planId, 'HOLD');
  const regret = toy({ objective: 'minimax_regret', forecast: { vectors: [[1, 0, 0], [0, 0, 1]] } });
  assert.equal(fixedReview(regret).planId, 'ONE');
  assert.equal(analyze(regret).ranking[0].objectiveCents, 1000);
  const cap = toy({ cap: 5 });
  assert.equal(fixedReview(cap).planId, 'HOLD');
  const unavailable = toy({ plans: [{ id: 'BAD', cost: 10, early: 1, late: 1, control: false, available: false, beneficiary: false }] });
  assert.equal(violations(unavailable, unavailable.plans[1]).length, 3);
  const cancellation = toy({ cancelled: 1, held: 100 });
  assert(violations(cancellation, cancellation.plans[1]).includes('CANCELLED_REFUNDS_NOT_PROTECTED'));
  const recovery = toy({ plans: [{ id: 'GUARANTEED', cost: 10, early: 1, late: 1, recoveries: [0, 10, 10] }] });
  assert.deepEqual(recovery.plans[1].payoffs.map(x => x.providerGapCents), [0, 0, 10000]);
  const changed = structuredClone(p); changed.money.heldCents++;
  assert.throws(() => validatePacket(changed), /Changed packet/);
  const { inputHash, ...body } = p; assert.equal(hash(body), inputHash);
});
