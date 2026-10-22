import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = name => resolve(root, 'docs', name);
export const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fileHash = path => crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const read = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const writeNew = (path, value) => fs.writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const rounded = n => Math.round(n * 10000) / 10000;

export function buildPacket(spec) {
  const totalOrders = spec.cancelled + spec.early + spec.late;
  const money = {
    grossCents: totalOrders * 10000,
    historicalFeeCents: totalOrders * 300,
    heldCents: spec.held * 100,
    settledAndSpentCents: totalOrders * 9700 - spec.held * 100,
    cashCents: 0, creditCents: 0,
  };
  assert(money.settledAndSpentCents >= 0);
  const plans = [{ id: 'HOLD', cost: 0, early: 0, late: 0 }, ...spec.plans].map(plan => {
    const shipped = [plan.early + plan.late, plan.late, 0];
    const recoveries = (plan.recoveries ?? [0, 0, 0]).map(x => x * 100);
    const costCents = plan.cost * 100;
    return {
      id: plan.id,
      controlledPaymentCents: costCents,
      shipEarly: plan.early, shipLate: plan.late,
      availableBeforeCutoff: plan.available ?? true,
      controlEnforceable: plan.control ?? true,
      beneficiaryVerified: plan.beneficiary ?? true,
      recoveryByStateCents: recoveries,
      terms: plan.terms ?? 'Fixed price. Nonrefundable booking; no additional recoveries.',
      payoffs: shipped.map((fulfilled, i) => ({
        state: ['EARLY', 'LATE', 'MISSED'][i], fulfilled,
        refundsCents: (totalOrders - fulfilled) * 10000,
        providerGapCents: Math.max(0, (totalOrders - fulfilled) * 10000 - (money.heldCents - costCents + recoveries[i])),
      })),
    };
  });
  const packet = {
    id: spec.id, context: spec.context, money,
    cohorts: { cancelled: spec.cancelled, early: spec.early, late: spec.late, unitGrossCents: 10000 },
    sources: spec.sources,
    fixedWorkflowCompleted: true,
    policy: {
      authorityResolved: spec.authority ?? true,
      objective: spec.objective,
      incrementalWorstGapCapCents: spec.cap * 100,
      protectAlreadyCancelledRefunds: true,
      requireControlledPayment: true,
      humanExecutionApprovalRequired: true,
      objectiveText: spec.policyText,
      tieBreak: 'After the primary financial objective, prefer lower worst-case gap, then smaller payment, then plan ID. Equal primary objectives are scored as equal-quality decisions.',
    },
    forecast: spec.forecast,
    plans,
    assumptions: [
      'All facts, documents, policies, probabilities and control capabilities are authored synthetic inputs, not real PayPal practices or forecasts.',
      'All orders are $100. All kits in the selected van share one arrival state. EARLY meets both deadlines; LATE meets only the later deadline; MISSED meets neither.',
      'Without a booking, no orders ship. Cancelled, unshipped or late orders receive full refunds. There are no other funding sources, liabilities, alternate plans, or recoveries before the assessment horizon.',
      'The provider funds any refund gap in this model. This is short-horizon funding exposure, not proven ultimate loss or production liability.',
      'Historical fees are unchanged across plans. Shipping uses held merchant funds, so it reduces backing and is not counted again as a provider expense.',
      'Only explicitly quantified recoveryByStateCents is available within the funding horizon. No speculative retention, fee growth, inventory liquidation or merchant recovery is included.',
      'No execution is authorized by a recommendation. All control checks are hypothetical stipulations. Shared payoff tables are calculated by deterministic code for both methods.',
    ],
  };
  return { ...packet, inputHash: hash(packet) };
}

export function validatePacket(packet) {
  const { inputHash, ...body } = packet;
  assert.equal(hash(body), inputHash, 'Changed packet');
  const c = packet.cohorts, m = packet.money;
  for (const n of Object.values(c)) assert(Number.isSafeInteger(n) && n >= 0);
  assert.equal(m.grossCents, (c.cancelled + c.early + c.late) * c.unitGrossCents);
  assert.equal(m.grossCents, m.heldCents + m.settledAndSpentCents + m.historicalFeeCents);
  assert.equal(packet.plans.filter(p => p.id === 'HOLD').length, 1);
  assert.equal(new Set(packet.plans.map(p => p.id)).size, packet.plans.length);
  for (const plan of packet.plans) {
    assert(Number.isSafeInteger(plan.controlledPaymentCents) && plan.controlledPaymentCents >= 0);
    assert(plan.shipEarly >= 0 && plan.shipEarly <= c.early);
    assert(plan.shipLate >= 0 && plan.shipLate <= c.late);
    const fulfilled = [plan.shipEarly + plan.shipLate, plan.shipLate, 0];
    plan.payoffs.forEach((p, i) => {
      assert.equal(p.fulfilled, fulfilled[i]);
      assert.equal(p.refundsCents, m.grossCents - p.fulfilled * c.unitGrossCents);
      assert.equal(p.providerGapCents, Math.max(0, p.refundsCents - (m.heldCents - plan.controlledPaymentCents + plan.recoveryByStateCents[i])));
    });
  }
  for (const vector of packet.forecast.vectors) {
    assert.equal(vector.length, 3);
    assert(vector.every(p => Number.isFinite(p) && p >= 0 && p <= 1));
    assert(Math.abs(vector.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  }
}

export function violations(packet, plan) {
  if (!plan) return ['UNKNOWN_PLAN'];
  const errors = [], baseline = packet.plans.find(p => p.id === 'HOLD');
  const worst = p => Math.max(...p.payoffs.map(x => x.providerGapCents));
  if (plan.controlledPaymentCents > 0) {
    if (!plan.availableBeforeCutoff) errors.push('MISSED_BOOKING_CUTOFF');
    if (!plan.controlEnforceable) errors.push('CONTROL_UNAVAILABLE');
    if (!plan.beneficiaryVerified) errors.push('BENEFICIARY_UNVERIFIED');
  }
  if (packet.money.heldCents - plan.controlledPaymentCents < packet.cohorts.cancelled * packet.cohorts.unitGrossCents) errors.push('CANCELLED_REFUNDS_NOT_PROTECTED');
  if (worst(plan) - worst(baseline) > packet.policy.incrementalWorstGapCapCents) errors.push('INCREMENTAL_RISK_CAP_EXCEEDED');
  return errors;
}

export function analyze(packet) {
  validatePacket(packet);
  const eligible = packet.plans.filter(p => violations(packet, p).length === 0);
  const problem = !packet.policy.authorityResolved ? 'UNRESOLVED_POLICY_AUTHORITY'
    : !['expected_gap', 'minimax_gap', 'minimax_regret'].includes(packet.policy.objective) ? 'NO_AGREED_DECISION_OBJECTIVE'
    : packet.forecast.vectors.length === 0 ? 'NO_ACCEPTED_PROBABILITY_OR_UNCERTAINTY_SET'
    : packet.policy.objective === 'expected_gap' && packet.forecast.vectors.length !== 1 ? 'EXPECTED_VALUE_REQUIRES_AN_ACCEPTED_DISTRIBUTION'
    : eligible.length === 0 ? 'NO_ELIGIBLE_PLAN' : null;
  if (problem) return { problem, eligible, ranking: [] };
  const expected = plan => packet.forecast.vectors.map(v => dot(v, plan.payoffs.map(x => x.providerGapCents)));
  const bestByVector = packet.forecast.vectors.map((_, i) => Math.min(...eligible.map(p => expected(p)[i])));
  const ranking = eligible.map(plan => {
    const values = expected(plan);
    const maxRegret = Math.max(...values.map((v, i) => v - bestByVector[i]));
    const objectiveCents = packet.policy.objective === 'expected_gap' ? values[0]
      : packet.policy.objective === 'minimax_gap' ? Math.max(...values) : maxRegret;
    return { id: plan.id, objectiveCents: rounded(objectiveCents), expectedGapRangeCents: [Math.min(...values), Math.max(...values)].map(rounded),
      maxRegretCents: rounded(maxRegret), worstGapCents: Math.max(...plan.payoffs.map(x => x.providerGapCents)), paymentCents: plan.controlledPaymentCents };
  }).sort((a, b) => a.objectiveCents - b.objectiveCents || a.worstGapCents - b.worstGapCents || a.paymentCents - b.paymentCents || a.id.localeCompare(b.id));
  return { problem: null, eligible, ranking };
}

export function fixedReview(packet) {
  const analysis = analyze(packet);
  if (analysis.problem) return { caseId: packet.id, inputHash: packet.inputHash, disposition: 'escalate', planId: null, paymentCents: 0, worstGapCents: null, reason: analysis.problem };
  const first = analysis.ranking[0];
  return { caseId: packet.id, inputHash: packet.inputHash, disposition: 'recommend', planId: first.id, paymentCents: first.paymentCents, worstGapCents: first.worstGapCents,
    reason: `Apply ${packet.policy.objective} to all eligible plans; require human approval before execution.` };
}

export function grade(packet, review) {
  const a = analyze(packet), plan = packet.plans.find(p => p.id === review.planId);
  const invalid = [];
  if (review.caseId !== packet.id || review.inputHash !== packet.inputHash) invalid.push('INPUT_MISMATCH');
  if (!['recommend', 'escalate'].includes(review.disposition)) invalid.push('INVALID_DISPOSITION');
  if (review.disposition === 'escalate' && (review.planId !== null || review.paymentCents !== 0)) invalid.push('ESCALATION_CANNOT_AUTHORIZE_PAYMENT');
  const policyViolations = review.disposition === 'recommend' ? violations(packet, plan) : [];
  if (a.problem && review.disposition === 'recommend') policyViolations.push('UNSUPPORTED_POLICY_OR_FORECAST_ASSUMPTION');
  const numericErrors = [];
  if (review.disposition === 'recommend' && plan) {
    if (review.paymentCents !== plan.controlledPaymentCents) numericErrors.push('WRONG_RECOMMENDED_AMOUNT');
    if (review.worstGapCents !== Math.max(...plan.payoffs.map(x => x.providerGapCents))) numericErrors.push('WRONG_WORST_CASE_GAP');
  }
  const appropriateEscalation = review.disposition === 'escalate' && !!a.problem && invalid.length === 0;
  const unnecessaryEscalation = review.disposition === 'escalate' && !a.problem;
  const selected = a.ranking.find(r => r.id === review.planId);
  const policyRegretCents = selected ? rounded(selected.objectiveCents - a.ranking[0].objectiveCents) : null;
  const optimalUnderStatedPolicy = !a.problem && selected && policyRegretCents <= 0.01;
  return {
    caseId: packet.id, invalid, policyViolations, numericErrors, appropriateEscalation, unnecessaryEscalation,
    policyRegretCents, selectedEvaluation: selected ?? null,
    successful: invalid.length === 0 && policyViolations.length === 0 && numericErrors.length === 0 && (appropriateEscalation || !!optimalUnderStatedPolicy),
    explanationQuality: 'Not automatically scored; no LLM-as-judge or author preference grade.',
  };
}

function frozenFiles() { return ['scripts/decision-review.mjs', 'benchmark/decision-cases.mjs', 'tests/decision-review.test.mjs', 'docs/decision-review-contract.json', 'docs/decision-review-cases.json']; }

async function main() {
  const command = process.argv[2];
  if (command === 'freeze') {
    const cases = read(file('decision-review-cases.json'));
    cases.forEach(validatePacket);
    const ledgerPath = resolve(root, '.local/gcp/model-spend.json');
    writeNew(file('decision-review-freeze.json'), {
      createdAt: new Date().toISOString(), caseCount: cases.length,
      files: Object.fromEntries(frozenFiles().map(p => [p, fileHash(resolve(root, p))])),
      cases: Object.fromEntries(cases.map(c => [c.id, c.inputHash])),
      cloudLedgerBefore: { sha256: fileHash(ledgerPath), entries: read(ledgerPath).entries.length },
      baselineResultsExposedBeforeManualCommit: false,
      independence: 'Same assistant authored the cases and baseline, then reviews the packets in the same conversation. Not independently blinded; freezing only prevents retrospective edits.',
    });
    console.log(`Frozen ${cases.length} cases and benchmark code. Baseline decisions have not been emitted.`);
    return;
  }
  if (command !== 'run') throw new Error('Use: node scripts/decision-review.mjs freeze|run');
  const freeze = read(file('decision-review-freeze.json'));
  for (const [path, digest] of Object.entries(freeze.files)) assert.equal(fileHash(resolve(root, path)), digest, `Frozen file changed: ${path}`);
  const cases = read(file('decision-review-cases.json'));
  const manual = read(file('decision-review-recommendations.json'));
  assert.equal(manual.reviews.length, cases.length);
  assert.equal(new Set(manual.reviews.map(r => r.caseId)).size, cases.length);
  const submissionHash = fileHash(file('decision-review-recommendations.json'));
  const byId = new Map(manual.reviews.map(r => [r.caseId, r]));
  for (const packet of cases) assert.equal(byId.get(packet.id)?.inputHash, packet.inputHash);
  writeNew(file('decision-review-submission-receipt.json'), { createdAt: new Date().toISOString(), submissionHash, caseCount: cases.length, status: 'MANUAL_RECOMMENDATIONS_COMMITTED_BEFORE_BASELINE_OUTPUT' });
  const rows = cases.map(packet => {
    const start = performance.now(), fixed = fixedReview(packet), baselineMs = performance.now() - start;
    const candidate = byId.get(packet.id);
    return { caseId: packet.id, context: packet.context, objective: packet.policy.objective, inputHash: packet.inputHash,
      fixed, manual: candidate, fixedGrade: grade(packet, fixed), manualGrade: grade(packet, candidate), baselineMs };
  });
  const summarize = key => {
    const grades = rows.map(r => r[key + 'Grade']);
    return {
      cases: rows.length, successful: grades.filter(g => g.successful).length,
      invalidOutputs: grades.filter(g => g.invalid.length).length,
      policyViolationCases: grades.filter(g => g.policyViolations.length).length,
      numericErrorCases: grades.filter(g => g.numericErrors.length).length,
      appropriateEscalations: grades.filter(g => g.appropriateEscalation).length,
      unnecessaryEscalations: grades.filter(g => g.unnecessaryEscalation).length,
      suboptimalUnderSpecifiedObjective: grades.filter(g => g.policyRegretCents > 0.01).length,
      pointForecastExpectedFundingGapCents: rounded(rows.filter(r => r.objective === 'expected_gap' && r[key + 'Grade'].selectedEvaluation).reduce((sum, r) => sum + r[key + 'Grade'].selectedEvaluation.objectiveCents, 0)),
      pointForecastCasesWithNumericDecision: rows.filter(r => r.objective === 'expected_gap' && r[key + 'Grade'].selectedEvaluation).length,
      additionalExternalModelAPICostUSD: 0,
      totalCostUSD: null,
    };
  };
  const ledgerPath = resolve(root, '.local/gcp/model-spend.json');
  const report = {
    status: 'COMPLETED_AUTHORED_DECISION_REVIEW_COMPARISON', generatedAt: new Date().toISOString(), submissionHash,
    freezeVerified: true, samePacketsAndPayoffTables: true,
    manualProvenance: manual.provenance,
    fixed: summarize('fixed'), manual: summarize('manual'),
    identicalDispositionAndPlan: rows.filter(r => r.fixed.disposition === r.manual.disposition && r.fixed.planId === r.manual.planId).length,
    baselineTotalMilliseconds: rows.reduce((s, r) => s + r.baselineMs, 0),
    cloudLedgerUnchanged: fileHash(ledgerPath) === freeze.cloudLedgerBefore.sha256,
    cloudLedgerEntries: read(ledgerPath).entries.length,
    rows,
    limitations: [
      'Synthetic cases, authored and reviewed by the same assistant; no independent blind holdout or domain-expert labels.',
      'Full payoff tables and explicit objectives make the scored portion a policy-application/optimization test. Fixed software can exactly optimize these cases; this does not test whether an LLM discovers missing real-world factors.',
      'Point forecasts are assumed inputs, not validated forecasts. Interval objectives are authored risk preferences, not actual PayPal policy.',
      'Underspecified cases test appropriate escalation. Their ultimate financial merit is not scored or silently treated as zero cost.',
      'One manual submission, no stochastic repeats or production reliability estimate. Narrative persuasiveness is not graded.',
      'No external model API calls. Current-chat Codex usage and human approval/engineering time are unpriced, so total-cost superiority is unknown.',
      'No PayPal reserve changes, real payments, GCP calls or APAC edits. No ROI claim from hypothetical funding gaps.',
    ],
  };
  writeNew(file('decision-review-results.json'), report);
  console.table(rows.map(r => ({ case: r.caseId, fixed: r.fixed.planId ?? 'ESCALATE', chat: r.manual.planId ?? 'ESCALATE', passed: r.manualGrade.successful, regretUSD: r.manualGrade.policyRegretCents === null ? null : r.manualGrade.policyRegretCents / 100 })));
  console.log(JSON.stringify({ fixed: report.fixed, manual: report.manual, samePlans: report.identicalDispositionAndPlan, cloudLedgerUnchanged: report.cloudLedgerUnchanged, baselineTotalMilliseconds: report.baselineTotalMilliseconds }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
