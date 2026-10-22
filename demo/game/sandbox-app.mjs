import { buildReserveReview } from './sandbox-review.mjs';

const $ = id => document.getElementById(id);
const money = cents => Number.isInteger(cents) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100) : 'Unavailable';
let configuration = { configured: false }, orders = [], selected = null, busy = false;
let verifiedThisVisit = null, review = null, pending = null;
let approvalTimer = null, watchingId = null, watchStarted = 0, watchCount = 0;
try { pending = JSON.parse(sessionStorage.getItem('supply-yard-sandbox-checkout')); } catch { /* No previous checkout. */ }

async function api(path, input) {
  const response = await fetch(`/api/paypal/${path}`, {
    method: input === undefined ? 'GET' : 'POST',
    ...(input === undefined ? {} : { headers: { 'Content-Type': 'application/json', 'X-Supply-Yard': 'sandbox' }, body: JSON.stringify(input) }),
    cache: 'no-store',
  });
  let data;
  try { data = await response.json(); } catch { throw new Error('Restart npm run dev to load the sandbox server, then reload this page.'); }
  if (!response.ok) {
    if (['PAYPAL_AUTH_FAILED', 'NOT_CONFIGURED', 'SANDBOX_ONLY'].includes(data.error?.code)) configuration.authenticatedAt = null;
    throw new Error(`${data.error?.message ?? 'The request failed.'}${data.error?.debugId ? ` PayPal debug ID: ${data.error.debugId}` : ''}`);
  }
  return data;
}
function notice(message, error = false) { $('notice').textContent = message; $('notice').classList.toggle('error', error); }
async function action(work) {
  if (busy) return;
  busy = true; notice(''); render();
  try { await work(); }
  catch (error) { verifiedThisVisit = null; review = null; notice(error.message, true); }
  finally { busy = false; render(); }
}
function remember() {
  try {
    if (pending) sessionStorage.setItem('supply-yard-sandbox-checkout', JSON.stringify(pending));
    else sessionStorage.removeItem('supply-yard-sandbox-checkout');
  } catch { /* Server still persists the checkout and retry keys. */ }
}
function stopWatching() { clearTimeout(approvalTimer); approvalTimer = null; watchingId = null; }
function watchApproval(id) {
  stopWatching(); watchingId = id; watchStarted = Date.now(); watchCount = 0;
  const schedule = () => { approvalTimer = setTimeout(poll, Math.min(10000, 2000 + watchCount * 1500)); };
  async function poll() {
    if (watchingId !== id || selected?.id !== id) return;
    if (Date.now() - watchStarted > 300000) {
      stopWatching(); notice('Approval is still pending. Use Verify with PayPal when the buyer has approved.'); return;
    }
    if (busy) { schedule(); return; }
    busy = true; render();
    try {
      const order = await api(`orders/${id}/refresh`, {});
      acceptOrder(order, true);
      if (order.orderStatus === 'APPROVED' && !order.receipt) await capture(order.paypalOrderId);
      if (selected.receipt || selected.orderStatus === 'VOIDED') {
        stopWatching();
        if (selected.receipt?.status === 'COMPLETED') notice('PayPal confirmed the capture. You can run the simulated review without another checkout.');
      } else { watchCount++; schedule(); }
    } catch (error) { stopWatching(); notice(error.message, true); }
    finally { busy = false; render(); }
  }
  notice('Waiting for buyer approval in the PayPal tab. This page will capture once PayPal confirms approval.');
  schedule();
}
function acceptOrder(order, verified = false) {
  selected = order; review = null;
  orders = [order, ...orders.filter(item => item.id !== order.id)];
  if (verified) verifiedThisVisit = order.id;
  pending = { id: order.id, quantity: order.quantity };
  remember();
}
function render() {
  const ready = configuration.configured;
  $('connection-state').textContent = configuration.configurationError ? 'Sandbox mode required' : configuration.authenticatedAt ? 'Authenticated with PayPal sandbox' : ready ? 'Credentials configured' : 'Sandbox credentials needed';
  $('connection-detail').textContent = busy ? 'Working…' : configuration.authenticatedAt ? `Last connected ${new Date(configuration.authenticatedAt).toLocaleTimeString()}` : 'PayPal sandbox only · no real money';
  $('connection-dot').classList.toggle('connected', Boolean(configuration.authenticatedAt));
  $('connect').disabled = busy || !ready;
  $('connect').textContent = configuration.authenticatedAt ? 'Check connection' : 'Test connection';
  if (selected || pending) $('quantity').value = selected?.quantity ?? pending.quantity;
  $('quantity').disabled = busy || Boolean(selected || pending);
  const quantity = Number($('quantity').value);
  $('cart-total').textContent = money(quantity * 1000);
  $('create').disabled = busy || !ready || Boolean(selected?.paypalOrderId);
  $('create').textContent = pending && !selected?.paypalOrderId ? 'Retry this checkout' : 'Create sandbox order';
  $('order-id').textContent = selected?.paypalOrderId ?? 'Not created';
  $('payment-state').textContent = selected?.paymentState?.replaceAll('_', ' ') ?? (ready ? 'Ready for a test order' : 'Awaiting connection');
  const approval = selected?.approvalUrl && !selected.receipt;
  $('approval-actions').hidden = !approval;
  if (approval) $('approve-link').href = selected.approvalUrl;
  $('approve-link').setAttribute('aria-disabled', String(busy));
  $('refresh').disabled = busy || !ready || !selected?.paypalOrderId;
  $('capture').hidden = !selected?.paypalOrderId || Boolean(selected.receipt);
  $('capture').disabled = busy || !ready;
  $('new-order').hidden = !selected && !pending;
  $('new-order').disabled = busy;
  const receipt = selected?.receipt;
  $('gross').textContent = receipt ? money(receipt.grossCents) : '—';
  $('fee').textContent = receipt ? money(receipt.feeCents) : '—';
  $('net').textContent = receipt ? money(receipt.netCents) : '—';
  $('capture-id').textContent = receipt?.captureId ?? 'Waiting for buyer approval';
  $('capture-status').textContent = receipt?.status ?? '—';
  $('verified-at').textContent = selected?.verifiedAt ? new Date(selected.verifiedAt).toLocaleString() : '—';
  $('receipt-badge').textContent = receipt ? (verifiedThisVisit === selected.id ? `Sandbox · ${receipt.status.toLowerCase()}` : 'Saved receipt · verify again') : 'No capture yet';
  $('export').disabled = busy || !selected?.paypalOrderId;
  const completed = ready && receipt?.status === 'COMPLETED' && selected.paymentState === 'COMPLETED'
    && selected.orderStatus === 'COMPLETED' && verifiedThisVisit === selected.id;
  $('investigate').disabled = busy || !completed;
  $('evidence-scenario').disabled = busy;
  $('review-gate').textContent = completed ? `One PayPal order · ${selected.quantity} kits. Inspect the generated delivery evidence against capture ${receipt.captureId}.`
    : receipt ? 'Verify a completed capture with PayPal before using it in the review.' : 'Capture a payment and verify it with PayPal to unlock the review.';
  $('review-result').hidden = !review;
  $('approve-review').disabled = busy || !completed || !review || review.approved;
  $('approve-review').textContent = review?.approved ? 'Simulated review approved' : 'Approve simulated review';
  if (review) {
    $('before-target').textContent = money(review.beforeTarget);
    $('after-target').textContent = money(review.afterTarget);
    $('available').textContent = money(review.availableAfter);
    $('decision-text').textContent = review.approved
      ? 'Approved in the local simulation. PayPal’s real reserve settings were not changed.'
      : 'This is a proposed simulation change. Review the evidence before approving.';
  }
  $('order-history').replaceChildren();
  if (!orders.length) $('order-history').textContent = 'No checkouts yet.';
  for (const row of orders) {
    const button = document.createElement('button');
    button.textContent = `${row.paypalOrderId ?? 'Unconfirmed creation'} · ${money(row.grossCents)} · ${row.paymentState.replaceAll('_', ' ')}`;
    button.disabled = busy;
    button.addEventListener('click', () => action(async () => {
      stopWatching();
      verifiedThisVisit = null; acceptOrder(row);
      if (row.paypalOrderId) acceptOrder(await api(`orders/${row.id}/refresh`, {}), true);
    }));
    $('order-history').append(button);
  }
}
$('quantity').addEventListener('input', render);
$('connect').addEventListener('click', () => action(async () => {
  configuration = await api('connect', {});
  notice('PayPal sandbox authentication succeeded. Create an order to test buyer approval and capture.');
}));
$('checkout-form').addEventListener('submit', event => {
  event.preventDefault();
  action(async () => {
    pending ??= { id: crypto.randomUUID(), quantity: Number($('quantity').value) };
    remember();
    acceptOrder(await api('orders', pending));
    configuration = await api('status');
    notice('Order created in PayPal sandbox. Approve it using your Personal test buyer account.');
  });
});
$('approve-link').addEventListener('click', event => {
  if (busy || !selected?.paypalOrderId) { event.preventDefault(); return; }
  watchApproval(selected.id);
});
$('refresh').addEventListener('click', () => action(async () => {
  acceptOrder(await api(`orders/${selected.id}/refresh`, {}), true);
  if (selected.orderStatus === 'APPROVED' && !selected.receipt) await capture(selected.paypalOrderId);
  else notice(`Verified with PayPal: ${selected.paymentState.replaceAll('_', ' ')}.`);
}));
async function capture(expectedId) {
  acceptOrder(await api(`orders/${selected.id}/capture`, { orderId: expectedId }), true);
  configuration = await api('status');
  notice(selected.receipt?.status === 'COMPLETED' ? 'Payment captured and verified in PayPal sandbox. Your payment evidence is ready.' : 'PayPal has not reported a completed capture yet. Verify the order again before using it.');
}
$('capture').addEventListener('click', () => action(() => capture(selected.paypalOrderId)));
$('new-order').addEventListener('click', () => {
  stopWatching();
  selected = null; pending = null; review = null; verifiedThisVisit = null; remember(); notice('Ready for a new sandbox checkout. Previous receipts remain saved.'); render();
});
$('evidence-scenario').addEventListener('change', () => { review = null; render(); });
$('investigate').addEventListener('click', () => action(async () => {
  acceptOrder(await api(`orders/${selected.id}/refresh`, {}), true);
  review = buildReserveReview(selected, $('evidence-scenario').value);
  $('investigation-log').replaceChildren();
  const messages = [
    `Payment check: PayPal confirms capture ${selected.receipt.captureId} for ${money(selected.receipt.grossCents)}.`,
    `Scripted investigator: generated delivery records support ${money(review.verifiedGross)} of this order; ${money(review.unresolvedGross)} remains unverified.`,
    `Risk check: delivered goods retain an authored 20% buffer. Unverified units remain fully included in the reserve target.`,
    `Calculator: proposed target ${money(review.afterTarget)}. Actual reported net proceeds ${money(selected.receipt.netCents)} cap the simulated funds held.`,
  ];
  for (const text of messages) { const li = document.createElement('li'); li.textContent = text; $('investigation-log').append(li); }
  $('delivery-evidence').replaceChildren();
  for (const item of review.evidence) { const p = document.createElement('p'); p.textContent = `${item.reference} · ${money(item.amountCents)} · ${item.observation} · generated scenario`; $('delivery-evidence').append(p); }
  notice('Investigation completed using actual sandbox payment values and generated fulfillment evidence.');
}));
$('approve-review').addEventListener('click', () => {
  if (!review || verifiedThisVisit !== selected?.id || busy) return;
  review.approved = true; render();
});
$('export').addEventListener('click', () => {
  const evidence = { schema: 'supply-yard-payment-evidence-v1', exportedAt: new Date().toISOString(), payment: selected,
    verifiedDuringThisVisit: verifiedThisVisit === selected.id, review,
    scope: 'Payment records are from PayPal SANDBOX. Delivery records and reserve decisions are generated locally. No real funds or PayPal reserve controls are changed.' };
  const url = URL.createObjectURL(new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = `supply-yard-sandbox-${selected.paypalOrderId}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

async function init() {
  try {
    const [config, saved] = await Promise.all([api('status'), api('orders')]);
    configuration = config; orders = saved.orders;
    const params = new URLSearchParams(location.search);
    const id = params.get('local') ?? pending?.id;
    const row = orders.find(item => item.id === id) ?? (!id ? orders[0] : null);
    if (row) acceptOrder(row);
    $('setup').open = !configuration.configured;
    render();
    if (params.get('checkout') === 'approved') {
      await action(async () => {
        if (!selected || selected.id !== params.get('local')) throw new Error('The returned checkout was not found in this sandbox app.');
        if (params.get('token') !== selected.paypalOrderId) throw new Error('The PayPal return token does not match this checkout. Verify the saved order.');
        await capture(params.get('token'));
      });
      history.replaceState(null, '', '/sandbox.html');
    } else if (params.get('checkout') === 'cancelled') {
      notice('Buyer approval was cancelled. Verify the saved order before starting another checkout.');
      history.replaceState(null, '', '/sandbox.html');
    } else if (selected?.paypalOrderId && configuration.configured) {
      await action(async () => {
        acceptOrder(await api(`orders/${selected.id}/refresh`, {}), true);
        if (selected.receipt?.status === 'COMPLETED') notice('Saved sandbox capture verified. Run the simulated review without another checkout.');
      });
    }
  } catch (error) { notice(error.message, true); $('setup').open = true; render(); }
}
init();
