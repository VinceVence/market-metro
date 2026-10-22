// Pure, deterministic demonstration mechanics. No model calls or PayPal requests.
// All money is integer USD cents; local IDs are never provider receipts.
export const SCENARIOS = [
  { id: 'cash-constrained-feasible', name: '01 / Cash is the constraint', detail: 'A replacement batch exists. Can a bounded reserve release make recovery feasible?' },
  { id: 'no-capacity', name: '02 / No replacement stock', detail: 'The supplier has no stock. Additional cash cannot recover these orders.', stock: 0 },
  { id: 'cash-sufficient', name: '03 / Merchant already has cash', detail: 'The merchant can buy the batch without a reserve change.', cash: 20000 },
  { id: 'stale-quote', name: '04 / The quote has expired', detail: 'The attractive offer is no longer valid. The team needs current terms.', expired: true },
  { id: 'unknown-liability', name: '05 / Missing refund obligations', detail: 'The team cannot assess protection without the prior-sale obligations.', liability: null },
  { id: 'competing-reservation', name: '06 / Another merchant has the stock', detail: 'Merchant B has a valid reservation. Merchant A cannot take its batch.', reservedBy: 'B' },
  { id: 'protection-gap', name: '07 / Release weakens protection', detail: 'The same cash gap exists, but the remaining reserve fails the declared protection floor.', liability: 18000 }
];
export const STAGES = ['Economy', 'Shock', 'Investigate', 'Compare', 'Review', 'Execute', 'Observe'];
export const money = cents => cents == null ? 'Unknown' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);

export function createWorld(id = SCENARIOS[0].id) {
  const fixture = SCENARIOS.find(s => s.id === id);
  if (!fixture) throw new Error('Unknown scenario');
  const cash = fixture.cash ?? 10000;
  const world = {
    schema: 'aftershock-local-v1', mode: 'LOCAL_SIMULATION', scenario: { ...fixture }, stage: 0, revision: 0,
    merchant: { available: cash, reserve: 20000, opening: cash + 20000, supplierPaid: 0, unsettledReceipts: 0, refunded: 0, grossCaptured: 0 },
    quote: { id: 'QUOTE-S2-01', cost: 16000, units: 4, stock: fixture.stock ?? 4, reservedBy: fixture.reservedBy ?? null, valid: !fixture.expired, arrivalDay: 2, promiseDay: 6 },
    exposure: { low: fixture.liability === null ? null : 8000, high: fixture.liability === undefined ? 12000 : fixture.liability, horizonDays: 30 },
    policy: { id: 'DEMO-POLICY-1', maxRelease: 6000, requiredCushion: 2000, currency: 'USD' },
    orders: Array.from({ length: 4 }, (_, i) => ({ id: `LOCAL-ORDER-${i + 1}`, authorization: `LOCAL-AUTH-${i + 1}`, amount: 8000, status: 'AUTHORIZED', delivered: false, refundStatus: null })),
    events: [], traces: [], dossier: null, comparison: null, decision: null, approval: null, receipts: {}, purchased: false, delivered: false, lastMessage: ''
  };
  record(world, 'Environment', 'Opening state', 'Prior simulated sales: available funds and minimum reserve. Four new authorizations provide no spendable cash.');
  return world;
}

function record(w, actor, action, detail) {
  w.events.push({ seq: w.events.length + 1, revision: w.revision, actor, action, detail, mode: 'LOCAL_SIMULATION' });
}
function fingerprint(w) {
  return JSON.stringify({ revision: w.revision, quote: w.quote, exposure: w.exposure, policy: w.policy, available: w.merchant.available, reserve: w.merchant.reserve });
}
function requireStage(w, stage) { if (w.stage !== stage) throw new Error(`Action requires stage ${STAGES[stage]}`); }
function stockAvailable(w) { return w.quote.stock >= w.quote.units && (!w.quote.reservedBy || w.quote.reservedBy === 'A'); }
function quoteUsable(w) { return stockAvailable(w) && w.quote.valid && w.quote.arrivalDay <= w.quote.promiseDay; }

export function injectShock(w) {
  requireStage(w, 0); w.stage = 1;
  record(w, 'Supplier S1', 'Supply failure', 'Original batch unavailable. Merchant A requests recovery; other merchants retain their commitments.');
}

export function investigate(w) {
  requireStage(w, 1);
  const gap = Math.max(0, w.quote.cost - w.merchant.available);
  const remainingReserve = w.merchant.reserve - gap;
  const checks = [
    { label: 'Current quote and customer promise', ok: w.quote.valid && w.quote.arrivalDay <= w.quote.promiseDay, detail: w.quote.valid ? 'Two-day arrival fits the original six-day promise.' : 'Quote expired; request refreshed terms.' },
    { label: 'Authoritative stock reservation', ok: stockAvailable(w), detail: stockAvailable(w) ? 'Four units are available; checked again at execution.' : w.quote.reservedBy ? 'Merchant B owns the last batch reservation.' : 'Zero replacement units available.' },
    { label: 'Prior refund obligations', ok: w.exposure.high !== null, detail: w.exposure.high === null ? 'Missing statement; no exposure-dependent approval.' : `${money(w.exposure.low)}–${money(w.exposure.high)} over ${w.exposure.horizonDays} days; authored assumptions.` },
    { label: 'Protection after proposed release', ok: w.exposure.high !== null && remainingReserve >= w.exposure.high + w.policy.requiredCushion, detail: `${money(remainingReserve)} remaining; requires known upper exposure plus a ${money(w.policy.requiredCushion)} demo cushion.` },
    { label: 'A financing constraint exists', ok: gap > 0 && gap <= w.policy.maxRelease, detail: gap ? `${money(gap)} gap; ${money(w.policy.maxRelease)} maximum release in this case.` : 'The merchant can already afford the replacement.' }
  ];
  let verdict = 'RECOMMEND_REVIEW';
  let reason = 'A $60 release enables the batch purchase and retains the declared $20 cushion. Approval still requires a reviewer and a fresh execution check.';
  if (w.exposure.high === null || !w.quote.valid) { verdict = 'MORE_EVIDENCE'; reason = w.exposure.high === null ? 'Request the missing prior-sale obligations before assessing a reserve reduction.' : 'Request a current quote before committing funds.'; }
  else if (!checks.every(c => c.ok)) {
    verdict = 'KEEP_RESERVE';
    reason = !stockAvailable(w) ? 'Money does not create unreserved stock. Retain the reserve; do not displace Merchant B.' : gap === 0 ? 'Recovery is already affordable. Releasing reserve adds no financing benefit.' : 'The proposed release fails the declared protection floor. Retain the reserve.';
  }
  w.dossier = { fingerprint: fingerprint(w), gap, remainingReserve, checks, verdict, reason };
  w.traces = [
    { role: 'Evidence investigator', action: 'Read the quote, cash ledger, customer promise, and prior obligations.', tools: ['read_quote', 'read_ledger', 'read_orders', 'read_exposure'], finding: checks.filter(c => !c.ok).map(c => c.detail).join(' ') || 'The price is per four-unit, non-splittable batch. Authorizations are not cash.' },
    { role: 'Experimental economist', action: 'Choose a paired keep-versus-release test, plus a supplier-failure stress.', tools: ['branch_world', 'run_counterfactual'], finding: 'Hold demand, stock, deadlines, and prior exposure fixed. Change only reserve policy.' },
    { role: 'Challenging reviewer', action: 'Test the financing explanation against capacity, validity, and protection.', tools: ['check_reservations', 'check_policy', 'request_missing_evidence'], finding: reason }
  ];
  w.stage = 2;
  w.traces.forEach(t => record(w, t.role, 'Scripted role trace', t.finding));
  return w.dossier;
}

export function branch(w, release) {
  const available = w.merchant.available + release;
  const reserve = w.merchant.reserve - release;
  const canRecover = quoteUsable(w) && available >= w.quote.cost;
  return {
    release, availableBeforePurchase: available, reserve, canRecover,
    recoverableOrders: canRecover ? 4 : 0,
    supplierOutlay: canRecover ? w.quote.cost : 0,
    // Reserve-only buffer, not predicted PayPal loss or overall merchant solvency.
    reserveCushion: w.exposure.high === null ? null : reserve - w.exposure.high,
    uncoveredReserveExposure: w.exposure.high === null ? null : Math.max(0, w.exposure.high - reserve),
    ifSupplierFails: { fulfilled: 0, potentialSupplierSpendLost: canRecover ? w.quote.cost : 0, newCaptures: 0 }
  };
}
export function compare(w) {
  requireStage(w, 2);
  const candidate = Math.min(w.dossier.gap, w.policy.maxRelease);
  w.comparison = { keep: branch(w, 0), release: branch(w, candidate), assumption: 'Conditional on on-time supply; stress branch fails before capture. No probabilities estimated.' };
  w.stage = 3;
  record(w, 'Deterministic runner', 'Paired worlds evaluated', `Keep: ${w.comparison.keep.recoverableOrders} recoverable orders. Candidate: ${w.comparison.release.recoverableOrders}. Conditional model outputs, not measured business effects.`);
  return w.comparison;
}
export function openReview(w) { requireStage(w, 3); w.stage = 4; }

export function review(w, decision, role = 'human-reviewer') {
  requireStage(w, 4);
  if (role !== 'human-reviewer') {
    record(w, 'Policy gate', 'Agent approval blocked', 'An investigator cannot approve its own reserve recommendation.');
    throw new Error('Blocked: only the simulated human reviewer can approve or retain the reserve.');
  }
  if (!['APPROVE', 'KEEP'].includes(decision)) throw new Error('Invalid review decision');
  if (fingerprint(w) !== w.dossier.fingerprint) throw new Error('Evidence changed. Reinvestigate before review.');
  if (decision === 'APPROVE' && w.dossier.verdict !== 'RECOMMEND_REVIEW') throw new Error('Release blocked: evidence or policy checks did not pass.');
  w.decision = decision;
  w.approval = { role, decision, amount: decision === 'APPROVE' ? w.dossier.gap : 0, caseId: w.scenario.id, policy: w.policy.id, fingerprint: fingerprint(w), consumed: false };
  w.stage = 5;
  record(w, 'Human reviewer (simulated)', decision === 'APPROVE' ? 'Release authorized locally' : 'Reserve retained', 'Decision is bound to this evidence version. No funds move until execution rechecks the case.');
}

export function stockRace(w) {
  if (![4, 5].includes(w.stage)) throw new Error('Inject a race at review or execution.');
  w.quote.reservedBy = 'B'; w.revision += 1;
  record(w, 'Supplier S2', 'Reservation changed', 'Merchant B reserved the last batch after the dossier was prepared.');
}

export function applyPayment(w, orderId, action, result = 'COMPLETED', requestId = `${orderId}:${action}`) {
  const prior = w.receipts[requestId];
  if (prior) {
    if (prior.orderId !== orderId || prior.action !== action) throw new Error('Request identity reused for a different operation');
    return prior;
  }
  const order = w.orders.find(o => o.id === orderId);
  if (!order) throw new Error('Unknown order');
  if (!['capture', 'void', 'refund'].includes(action)) throw new Error('Unsupported operation');
  if (!['COMPLETED', 'PENDING', 'DECLINED', 'FAILED'].includes(result)) throw new Error('Unsupported result');
  if (action === 'capture' && (!w.purchased || !['AUTHORIZED'].includes(order.status))) throw new Error('Capture requires ready recovery and an eligible authorization');
  if (action === 'void' && order.status !== 'AUTHORIZED') throw new Error('Only an eligible uncaptured authorization can be voided');
  if (action === 'void' && result !== 'COMPLETED') throw new Error('This local void fixture only implements completed voids');
  if (action === 'refund' && (order.status !== 'CAPTURED' || order.refundStatus)) throw new Error('Refund requires a completed, unrefunded capture');
  const receipt = { id: `LOCAL-RECEIPT-${Object.keys(w.receipts).length + 1}`, requestId, orderId, action, amount: order.amount, result, mode: 'LOCAL_SIMULATION' };
  w.receipts[requestId] = receipt;
  finishPayment(w, order, receipt);
  record(w, 'Local payment simulator', `${action.toUpperCase()} ${result}`, `${orderId} · ${money(order.amount)} · ${receipt.id}`);
  assertInvariants(w);
  return receipt;
}

function finishPayment(w, order, receipt) {
  const { action, result } = receipt;
  if (action === 'capture') {
    if (result === 'COMPLETED') {
      order.status = 'CAPTURED'; w.merchant.unsettledReceipts += order.amount; w.merchant.grossCaptured += order.amount;
      order.delivered = true; // Separate authored logistics event; not inferred from the provider status.
      record(w, 'Local logistics simulator', 'Delivery recorded', `${order.id}: authored on-time delivery after confirmed capture.`);
    } else if (result === 'PENDING') order.status = 'CAPTURE_PENDING';
    else order.status = 'CAPTURE_FAILED';
  } else if (action === 'void') order.status = 'VOIDED';
  else {
    order.refundStatus = result;
    if (result === 'COMPLETED') { order.status = 'REFUNDED'; w.merchant.unsettledReceipts -= order.amount; w.merchant.refunded += order.amount; }
  }
}

export function reconcile(w, result = 'COMPLETED') {
  if (!['COMPLETED', 'FAILED'].includes(result)) throw new Error('Reconcile to a declared terminal result');
  for (const receipt of Object.values(w.receipts).filter(r => r.result === 'PENDING')) {
    receipt.result = result;
    finishPayment(w, w.orders.find(o => o.id === receipt.orderId), receipt);
    record(w, 'Local payment simulator', 'Status reconciled', `${receipt.id}: ${result}. This is a local fixture, not a PayPal lookup.`);
  }
  assertInvariants(w);
}

export function execute(w, outcome = 'completed') {
  requireStage(w, 5);
  if (!['completed', 'pending', 'declined', 'return'].includes(outcome)) throw new Error('Unknown payment scenario');
  if (!w.approval || w.approval.consumed) throw new Error('Missing or consumed review decision');
  if (fingerprint(w) !== w.approval.fingerprint) {
    record(w, 'Policy gate', 'Execution blocked', 'The evidence version changed. No release or purchase occurred. Reinvestigate.');
    w.stage = 1; w.approval = null; w.decision = null; w.dossier = null; w.comparison = null; w.traces = [];
    throw new Error('Stock changed after review. No money moved; investigate the new evidence.');
  }
  const amount = w.approval.amount;
  if (amount > 0 && (w.dossier.verdict !== 'RECOMMEND_REVIEW' || amount > w.policy.maxRelease || w.merchant.reserve - amount < w.exposure.high + w.policy.requiredCushion)) throw new Error('Release violates the case policy');
  const canRecover = quoteUsable(w) && w.merchant.available + amount >= w.quote.cost;
  if (amount && !canRecover) throw new Error('No executable recovery path; release blocked');
  w.approval.consumed = true;
  if (canRecover) {
    w.merchant.reserve -= amount; w.merchant.available += amount;
    if (amount) record(w, 'Reserve simulator', 'Reserve reclassified', `${money(amount)} moved from reserve to available cash. Merchant-owned money; no new value created.`);
    w.quote.reservedBy = 'A'; w.quote.stock -= w.quote.units;
    w.merchant.available -= w.quote.cost; w.merchant.supplierPaid += w.quote.cost; w.purchased = true;
    record(w, 'Merchant recovery actor (scripted)', 'Replacement purchased', `${money(w.quote.cost)} paid to S2 for four units; reservation cannot be reused.`);
    w.orders.forEach((o, i) => applyPayment(w, o.id, 'capture', i === 0 && outcome === 'pending' ? 'PENDING' : i === 0 && outcome === 'declined' ? 'DECLINED' : 'COMPLETED'));
    if (outcome === 'return') applyPayment(w, w.orders[0].id, 'refund', 'PENDING');
  } else {
    w.orders.forEach(o => applyPayment(w, o.id, 'void'));
    record(w, 'Merchant recovery actor (scripted)', 'Orders cancelled', 'No feasible purchase under the reviewed policy. Uncaptured authorizations were voided locally.');
  }
  w.stage = 6; assertInvariants(w);
}

export function assertInvariants(w) {
  const m = w.merchant;
  for (const amount of Object.values(m)) if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Invalid money state');
  if (m.available + m.reserve + m.supplierPaid + m.unsettledReceipts + m.refunded !== m.opening + m.grossCaptured) throw new Error('Ledger does not conserve money');
  if (!Number.isInteger(w.quote.stock) || w.quote.stock < 0) throw new Error('Negative stock');
  if (w.purchased && w.quote.reservedBy !== 'A') throw new Error('Purchased stock must belong to A');
  return true;
}

export function exportRun(w) {
  return { ...structuredClone(w), disclosure: 'Deterministic local demonstration. Scripted roles, synthetic evidence, local payment receipts. No model performance, native PayPal integration, production loss or causal business benefit established.', terminalAssessment: { horizonDays: w.exposure.horizonDays, priorObligationsStillOpen: true, possiblePriorRefunds: { low: w.exposure.low, high: w.exposure.high }, newSalesStillWithinReturnWindow: w.orders.filter(o => o.status === 'CAPTURED').length, pendingPayments: Object.values(w.receipts).filter(r => r.result === 'PENDING').length } };
}
