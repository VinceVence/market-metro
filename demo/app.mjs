import { SCENARIOS, STAGES, money, createWorld, injectShock, investigate, compare, openReview, review, execute, stockRace, reconcile, exportRun } from './engine.mjs';

let world = createWorld();
const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
$('scenario').innerHTML = SCENARIOS.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
$('scenario').addEventListener('change', () => { world = createWorld($('scenario').value); render(); });
$('reset').addEventListener('click', () => { world = createWorld($('scenario').value); render(); });
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  for (const id of ['experiment', 'architecture', 'scope']) $(`${id}-view`).hidden = id !== button.dataset.view;
}));
$('export').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(exportRun(world), null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `aftershock-${world.scenario.id}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

function action(label, fn, style = 'primary', disabled = false) {
  const b = document.createElement('button'); b.className = style; b.textContent = label; b.disabled = disabled;
  b.addEventListener('click', () => {
    try { fn(); render(); }
    catch (error) { render(); $('message').textContent = error.message; }
  }); $('actions').append(b);
}
const row = (label, value) => `<div class="detail-row"><span>${label}</span><b>${value}</b></div>`;
const verdictLabel = w => ({ RECOMMEND_REVIEW: 'Recommend bounded release', KEEP_RESERVE: 'Recommend keeping reserve', MORE_EVIDENCE: 'Request more evidence' }[w.dossier?.verdict]);
function statusBanner() {
  return `<div class="status-banner ${world.dossier.verdict === 'RECOMMEND_REVIEW' ? '' : 'warning'}"><strong>${verdictLabel(world)}</strong>${world.dossier.reason}</div>`;
}
function traceHtml() {
  return `<details><summary>Inspect the scripted agent tool traces</summary>${world.traces.map(t => `<div class="trace-role"><b>${t.role}</b><p>${t.action}</p><small>${t.tools.join(' → ')}</small><p>${t.finding}</p></div>`).join('')}</details>`;
}
function checksHtml() {
  return `<ul class="check-list">${world.dossier.checks.map(c => `<li><span class="check-mark ${c.ok ? '' : 'fail'}">${c.ok ? '✓' : '×'}</span><div><b>${c.label}</b><p>${c.detail}</p></div></li>`).join('')}</ul>`;
}

function render() {
  $('message').textContent = '';
  $('scenario-detail').textContent = world.scenario.detail;
  $('steps').innerHTML = STAGES.map((s, i) => `<li class="${i === world.stage ? 'active' : i < world.stage ? 'done' : ''}" ${i === world.stage ? 'aria-current="step"' : ''}><span class="step-number">${i + 1}</span><span>${s}</span></li>`).join('');
  $('world-label').textContent = world.stage === 0 ? 'Before disruption' : world.purchased ? 'Recovery in progress' : 'Supplier disruption';
  renderMap();
  $('balances').innerHTML = `<div><p>Available to spend</p><strong>${money(world.merchant.available)}</strong><small>Merchant A</small></div><div><p>Minimum reserve</p><strong>${money(world.merchant.reserve)}</strong><small>Simulated control</small></div><div><p>Awaiting settlement</p><strong>${money(world.merchant.unsettledReceipts)}</strong><small>Not spendable here</small></div>`;
  $('actions').replaceChildren();
  const content = $('stage-content');
  const heading = (role, title) => { $('role-label').textContent = role; $('case-title').textContent = title; };
  if (world.stage === 0) {
    heading('02 / SET THE BASELINE', 'Four orders. One fragile supply line.');
    content.innerHTML = `<p class="stage-lead">Merchant A has four ${money(8000)} orders and a supplier commitment. The customer payments are authorized.</p>${row('Order value', '$320 authorized')}${row('Original customer promise', 'Delivery within 6 days')}${row('New cash from authorizations', '$0')}${row('Existing reserve origin', 'Earlier simulated sales')}<p class="inset-note">Start with a supplier failure. Watch the team determine whether money is actually the binding constraint.</p>`;
    action('Inject supplier shock →', () => injectShock(world));
  } else if (world.stage === 1) {
    heading('02 / OPERATIONAL ACTORS', 'The merchant asks for a way through.');
    content.innerHTML = `<div class="status-banner danger"><strong>Supplier S1 cannot deliver.</strong>Merchant A must recover the orders or cancel them.</div><p class="stage-lead">Supplier S2 advertises a replacement batch. The merchant asks for enough available cash to pay upfront.</p>${row('Replacement offer', '$160 for all 4 units')}${row('Available merchant funds', money(world.merchant.available))}${row('Apparent funding gap', money(Math.max(0, 16000 - world.merchant.available)))}<p class="inset-note">A $60 gap is a clue, not an approval. The team still needs current terms, stock, and the obligations protected by the reserve.</p>`;
    action('Investigate evidence →', () => investigate(world));
  } else if (world.stage === 2) {
    heading('02 / ECONOMIC AGENT TEAM · SCRIPTED', 'Find the constraint before the remedy.');
    content.innerHTML = checksHtml() + traceHtml();
    action('Run controlled comparisons →', () => compare(world));
  } else if (world.stage === 3) {
    heading('02 / ECONOMIC AGENT TEAM · SCRIPTED', 'Does the intervention change recovery?');
    content.innerHTML = statusBanner() + `<p class="stage-lead">The branches below start from the same world. Only the reserve decision changes.</p>${row('Keep reserve: recoverable orders', `${world.comparison.keep.recoverableOrders} / 4`)}${row('Candidate: recoverable orders', `${world.comparison.release.recoverableOrders} / 4`)}${row('Declared assessment horizon', '30 days')}<p class="inset-note">These are conditional mechanics, not forecasts. The adverse branch assumes the replacement supplier fails before capture: no new orders recover, and a paid supplier may retain the $160.</p>` + traceHtml();
    action('Open reviewer decision →', () => openReview(world));
  } else if (world.stage === 4) {
    heading('02 / HUMAN AUTHORITY · SIMULATED', 'The team advises. The reviewer decides.');
    content.innerHTML = statusBanner() + row('Maximum allowed release', '$60') + row('Protection requirement', `Known exposure + $20`) + row('Post-release reserve', money(world.dossier.remainingReserve)) + `<p class="inset-note">You are playing the PayPal reviewer. This is an authored case policy, not PayPal’s actual reserve policy. Approval is bound to the current evidence version.</p>`;
    action(`Approve ${money(world.dossier.gap)} release`, () => review(world, 'APPROVE'), 'primary human-button', world.dossier.verdict !== 'RECOMMEND_REVIEW');
    action('Keep reserve', () => review(world, 'KEEP'), 'secondary');
    action('Test boundary: agent tries to approve', () => review(world, 'APPROVE', 'agent'), 'text-button');
  } else if (world.stage === 5) {
    heading('02 / DETERMINISTIC EXECUTION GATE', 'Check again before any money moves.');
    content.innerHTML = `<div class="status-banner"><strong>${world.decision === 'APPROVE' ? `${money(world.approval.amount)} release authorized locally` : 'Reserve retained'}</strong>The current evidence, stock reservation, and approval scope must still match.</div><p class="stage-lead">The local runner applies the reviewed decision and executes the feasible payment path.</p><label class="select-label" for="payment-outcome">Payment response fixture</label><select id="payment-outcome"><option value="completed">Captures complete</option><option value="pending">First capture stays pending</option><option value="declined">First capture is declined</option><option value="return">A customer returns one captured order</option></select><p class="inset-note">PayPal will own these statuses in the Sandbox integration. This version uses local receipts. Capture does not make funds automatically available for withdrawal.</p>`;
    action('Execute reviewed path →', () => execute(world, $('payment-outcome').value));
    action('Inject race: Merchant B reserves the stock', () => { stockRace(world); }, 'text-button');
    if (world.revision > 0) content.insertAdjacentHTML('afterbegin', '<div class="status-banner warning"><strong>Evidence changed after approval.</strong>Try execution: the gate must reject the stale approval before releasing funds.</div>');
  } else {
    heading('02 / OBSERVE AND RECONCILE', 'Follow the money—and the open obligations.');
    const pending = Object.values(world.receipts).filter(r => r.result === 'PENDING').length;
    content.innerHTML = `<div class="status-banner ${pending ? 'warning' : ''}"><strong>${pending ? 'Payment outcome still pending' : world.purchased ? 'Replacement purchase executed' : 'Reserve retained; orders cancelled'}</strong>${pending ? 'A pending result is not completed money movement. Reconcile before relying on it.' : 'Review the local receipts and separate logistics events below.'}</div>${row('Replacement supplier paid', money(world.merchant.supplierPaid))}${row('Completed gross captures', money(world.merchant.grossCaptured))}${row('Completed refunds', money(world.merchant.refunded))}${row('Prior refund obligations still open', world.exposure.high === null ? 'Unknown' : `${money(world.exposure.low)}–${money(world.exposure.high)}`)}<p class="inset-note">The 30-day horizon is still open. New sales may return. The run carries these liabilities forward; it does not claim a settled loss result or PayPal savings.</p>`;
    if (pending) {
      action('Reconcile pending result → completed', () => reconcile(world));
      action('Reconcile → failed', () => reconcile(world, 'FAILED'), 'secondary');
    }
    action('Run another case', () => { world = createWorld(world.scenario.id); }, pending ? 'secondary' : 'primary');
  }
  renderComparison(); renderPayments();
  $('event-log').innerHTML = [...world.events].reverse().map(e => `<div class="event"><span class="seq">${String(e.seq).padStart(2, '0')}</span><span class="actor">${escape(e.actor)}</span><div class="event-body"><b>${escape(e.action)}</b><p>${escape(e.detail)}</p></div></div>`).join('');
}

function renderMap() {
  const shock = world.stage > 0;
  const activeAgent = world.stage >= 2 && world.stage <= 4;
  const decision = world.decision === 'APPROVE' ? 'Release approved locally' : world.decision === 'KEEP' ? 'Reserve retained' : 'Reserve review';
  const node = (x, y, width, title, sub, kind = 'code', selected = false) => {
    const colors = { agent: ['#086f68', '#eaf6f2'], code: ['#566578', '#f5f7fa'], human: ['#91500b', '#fff5e7'], paypal: ['#003087', '#edf2fa'], failed: ['#a6333c', '#fff0f1'] };
    const [color, fill] = colors[kind];
    return `<g><rect x="${x}" y="${y}" width="${width}" height="61" rx="7" fill="${fill}" stroke="${selected ? color : '#d5dfe7'}" stroke-width="${selected ? 1.6 : 1}"/><rect x="${x + 11}" y="${y + 15}" width="5" height="30" rx="2" fill="${color}"/><text x="${x + 25}" y="${y + 26}" font-size="13" font-weight="600" fill="#172b42">${title}</text><text x="${x + 25}" y="${y + 44}" font-size="10" fill="#576779">${sub}</text></g>`;
  };
  $('economy-map').innerHTML = `<svg viewBox="0 0 660 360" role="img" aria-labelledby="map-title map-desc"><title id="map-title">Aftershock economy and decision authority</title><desc id="map-desc">Customers authorize orders with Merchant A. Suppliers provide stock. The economic team investigates, a human reviews reserve policy, and payment state is tracked separately. All nodes in this demonstration are local simulations.</desc><defs><marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L8 4L0 8Z" fill="#a8b7c5"/></marker><marker id="agent-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L8 4L0 8Z" fill="#086f68"/></marker></defs>
    <path d="M190 64H239 M421 64H474 M421 75H448V162H474" stroke="${shock ? '#c78085' : '#a8b7c5'}" stroke-width="1.4" fill="none" marker-end="url(#arrow)"/>
    <path d="M330 94V150 M330 211V270 M240 300H186" stroke="${activeAgent ? '#086f68' : '#a8b7c5'}" stroke-width="1.4" fill="none" marker-end="url(#${activeAgent ? 'agent-arrow' : 'arrow'})"/>
    <path d="M103 331V350H558V331" stroke="#a8b7c5" stroke-width="1.3" fill="none" marker-end="url(#arrow)"/>
    <text x="330" y="345" text-anchor="middle" font-size="9" fill="#576779">validated payment intent</text>
    <path d="M558 193V225H99V270" stroke="#a8b7c5" stroke-width="1.1" stroke-dasharray="4 4" fill="none"/>
    <text x="205" y="49" font-size="9" fill="#576779">orders</text><text x="338" y="125" font-size="9" fill="#086f68">evidence</text><text x="339" y="245" font-size="9" fill="#086f68">recommendation</text>
    ${node(20, 34, 170, '4 customer orders', '$80 each · authorized')}
    ${node(240, 34, 180, 'Merchant A', world.purchased ? 'Replacement purchased' : 'Recovery request', 'agent', shock)}
    ${node(475, 34, 165, 'Supplier S1', shock ? 'Supply failure' : 'Original commitment', shock ? 'failed' : 'code', shock)}
    ${node(475, 132, 165, 'Supplier S2', world.quote.reservedBy === 'B' ? 'Batch reserved by B' : `${world.quote.stock} units · $160 / batch`, 'code')}
    ${node(20, 132, 170, 'Merchants B + C', world.quote.reservedBy === 'B' ? 'B holds the last batch' : 'Other market participants', 'code')}
    ${node(240, 150, 180, 'Economic agent team', 'Investigate · test · challenge', 'agent', activeAgent)}
    ${node(20, 270, 165, 'Policy + ledger', 'Enforce permitted actions', 'code', world.stage === 5)}
    ${node(240, 270, 180, 'Human reviewer', decision, 'human', world.stage === 4)}
    ${node(475, 270, 165, 'PayPal boundary', 'Payment status · local stub', 'paypal', world.stage >= 5)}
  </svg>`;
}

function renderComparison() {
  $('comparison').hidden = !world.comparison;
  if (!world.comparison) return;
  const { keep, release } = world.comparison;
  const tr = (label, k, r) => `<tr><td>${label}</td><td>${k}</td><td>${r}</td></tr>`;
  const label = world.dossier.gap === 0 ? 'No change needed' : `Release ${money(release.release)}`;
  $('comparison').innerHTML = `<div class="panel-heading"><div><p class="eyebrow">CONTROLLED COMPARISON / CONDITIONAL MODEL OUTPUTS</p><h2>Cash can unlock a purchase. It also leaves less in reserve.</h2></div><span class="tag">Same evidence · same world</span></div><div class="comparison-grid"><div><table class="comparison-table"><caption>Assumes valid stock and on-time replacement delivery.</caption><thead><tr><th>Outcome / USD</th><th>Keep reserve</th><th>${label}</th></tr></thead><tbody>${tr('Cash before purchase', money(keep.availableBeforePurchase), money(release.availableBeforePurchase))}${tr('Remaining reserve', money(keep.reserve), money(release.reserve))}${tr('Orders recoverable', `${keep.recoverableOrders} / 4`, `${release.recoverableOrders} / 4`)}${tr('Reserve less upper prior exposure', money(keep.reserveCushion), money(release.reserveCushion))}${tr('Reserve-only shortfall', money(keep.uncoveredReserveExposure), money(release.uncoveredReserveExposure))}</tbody></table></div><div class="mini-chart">${cashChart(keep, release)}<div class="stress"><strong>Adverse branch: replacement supplier fails before capture.</strong>Both branches recover 0 new orders. The candidate branch may lose ${money(release.ifSupplierFails.potentialSupplierSpendLost)} of supplier spend. Prior refund obligations remain. This comparison makes no claim about failure probability.</div></div></div><p class="small-note">Reserve-only coverage excludes other recoverable merchant assets and does not estimate PayPal’s loss. The $20 cushion is an authored demo constraint. Benefits to Merchant A do not establish a benefit across the network.</p>`;
}
function cashChart(keep, release) {
  const max = Math.max(20000, keep.availableBeforePurchase, release.availableBeforePurchase);
  const width = v => v / max * 300;
  const target = 128 + width(16000);
  return `<svg viewBox="0 0 520 155" role="img" aria-label="Available cash compared with the 160 dollar batch price"><text x="12" y="20" font-size="12" fill="#172b42" font-weight="600">Available cash before supplier purchase (USD)</text><line x1="${target}" x2="${target}" y1="43" y2="130" stroke="#91500b" stroke-dasharray="4 3"/><text x="${target}" y="147" text-anchor="middle" font-size="10" fill="#91500b">$160 batch price</text><text x="12" y="68" font-size="11" fill="#576779">Keep reserve</text><rect x="128" y="51" width="${width(keep.availableBeforePurchase)}" height="24" rx="2" fill="#8095b2"/><text x="${138 + width(keep.availableBeforePurchase)}" y="68" font-size="12" fill="#172b42">${money(keep.availableBeforePurchase)}</text><text x="12" y="112" font-size="11" fill="#576779">Candidate</text><rect x="128" y="95" width="${width(release.availableBeforePurchase)}" height="24" rx="2" fill="#086f68"/><text x="${138 + width(release.availableBeforePurchase)}" y="112" font-size="12" fill="#172b42">${money(release.availableBeforePurchase)}</text></svg>`;
}
function renderPayments() {
  $('payment-section').hidden = world.stage !== 6;
  if (world.stage !== 6) return;
  $('payment-section').innerHTML = `<div class="panel-heading"><div><p class="eyebrow">PAYMENT CONSEQUENCES / LOCAL RECEIPTS</p><h2>Payment status is separate from fulfillment and available funds.</h2></div></div><div class="table-wrap"><table><thead><tr><th>Order</th><th>Amount</th><th>Payment</th><th>Refund</th><th>Logistics event</th></tr></thead><tbody>${world.orders.map(o => `<tr><td>${o.id}</td><td>${money(o.amount)}</td><td><span class="payment-status ${o.status.includes('PENDING') ? 'pending' : ''}">${o.status}</span></td><td>${o.refundStatus || '—'}</td><td>${o.delivered ? 'Authored delivery' : o.status === 'VOIDED' ? 'Cancelled' : 'No delivery event'}</td></tr>`).join('')}</tbody></table></div><p class="small-note">LOCAL-* identifiers are generated by this app. No PayPal request was made. A future Sandbox adapter must persist and reconcile PayPal’s actual response before changing payment state.</p>`;
}
render();
