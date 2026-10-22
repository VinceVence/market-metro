import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const API = 'https://api-m.sandbox.paypal.com';
export const CART = Object.freeze({ name: 'Office restock kit', unitCents: 1000, currency: 'USD', maxQuantity: 10 });
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const orderPattern = /^[A-Z0-9]{8,32}$/;

export class SandboxError extends Error {
  constructor(status, code, message, debugId) {
    super(message);
    Object.assign(this, { status, code, debugId });
  }
}
const fail = (status, code, message) => { throw new SandboxError(status, code, message); };
export function moneyCents(amount) {
  if (amount?.currency_code !== 'USD' || !/^\d{1,9}\.\d{2}$/.test(amount?.value ?? '')) {
    fail(502, 'INVALID_PAYPAL_RESPONSE', 'PayPal returned an unexpected currency or amount.');
  }
  const [whole, fraction] = amount.value.split('.');
  return Number(whole) * 100 + Number(fraction);
}

function approvalLink(order) {
  const href = order.links?.find(link => ['payer-action', 'approve'].includes(link.rel))?.href;
  if (!href) return null;
  const url = new URL(href);
  if (url.protocol !== 'https:' || !['www.sandbox.paypal.com', 'sandbox.paypal.com'].includes(url.hostname)
      || url.username || url.password || (url.port && url.port !== '443')) {
    fail(502, 'INVALID_APPROVAL_URL', 'PayPal did not return a sandbox approval link.');
  }
  return url.href;
}

function inspectOrder(order, row) {
  const unit = order.purchase_units?.[0];
  if (order.id !== row.paypalOrderId || order.purchase_units?.length !== 1
      || unit?.reference_id !== row.id || moneyCents(unit?.amount) !== row.grossCents) {
    fail(502, 'ORDER_MISMATCH', 'The PayPal order does not match this locally created checkout.');
  }
  const captures = unit.payments?.captures ?? [];
  if (captures.length > 1) fail(502, 'UNEXPECTED_CAPTURES', 'This demo expects a single capture per order.');
  const capture = captures[0];
  if (capture && (!orderPattern.test(capture.id) || moneyCents(capture.amount) !== row.grossCents)) {
    fail(502, 'CAPTURE_MISMATCH', 'The PayPal capture does not match the expected payment.');
  }
  let feeCents = null, netCents = null;
  const breakdown = capture?.seller_receivable_breakdown;
  if (breakdown?.paypal_fee && breakdown?.net_amount && breakdown?.gross_amount) {
    feeCents = moneyCents(breakdown.paypal_fee);
    netCents = moneyCents(breakdown.net_amount);
    if (moneyCents(breakdown.gross_amount) !== row.grossCents || feeCents + netCents !== row.grossCents) {
      fail(502, 'BREAKDOWN_MISMATCH', 'The PayPal fee and net amount do not reconcile with the gross payment.');
    }
  }
  return {
    orderStatus: order.status,
    paymentState: capture ? capture.status : order.status,
    receipt: capture ? {
      provenance: 'PAYPAL_SANDBOX', orderId: order.id, captureId: capture.id,
      status: capture.status, currency: 'USD', grossCents: row.grossCents,
      feeCents, netCents, capturedAt: capture.create_time ?? null,
    } : null,
  };
}

export async function createPayPalSandbox({ env = process.env, fetchImpl = fetch, storePath = null } = {}) {
  const clientId = (env.PAYPAL_CLIENT_ID ?? '').trim();
  const clientSecret = (env.PAYPAL_CLIENT_SECRET ?? '').trim();
  const sandbox = (env.PAYPAL_ENVIRONMENT ?? 'SANDBOX').toUpperCase() === 'SANDBOX';
  const configured = Boolean(clientId && clientSecret && sandbox);
  const profile = createHash('sha256').update(clientId).digest('hex');
  let authenticatedAt = null, token = null, expiresAt = 0, tokenRequest = null;
  const orders = new Map(), running = new Map();
  let saving = Promise.resolve();
  if (storePath) {
    try {
      const saved = JSON.parse(await readFile(storePath, 'utf8'));
      if (saved.schema !== 'supply-yard-paypal-sandbox-v1' || !Array.isArray(saved.orders)) throw new Error('schema');
      for (const row of saved.orders) {
        if (!uuidPattern.test(row.id) || !Number.isInteger(row.quantity) || row.quantity < 1
            || row.quantity > CART.maxQuantity || row.grossCents !== row.quantity * CART.unitCents) throw new Error('record');
        orders.set(row.id, row);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') fail(500, 'RECEIPT_STORE_ERROR', 'The local sandbox receipt store could not be read. Preserve it before repairing the file.');
    }
  }
  const view = row => ({
    id: row.id, quantity: row.quantity, grossCents: row.grossCents, currency: CART.currency,
    paypalOrderId: row.paypalOrderId, approvalUrl: row.approvalUrl,
    orderStatus: row.orderStatus, paymentState: row.paymentState,
    createdAt: row.createdAt, verifiedAt: row.verifiedAt ?? null,
    receipt: row.receipt ?? null, provenance: 'PAYPAL_SANDBOX',
  });
  function persist() {
    if (!storePath) return Promise.resolve();
    // ponytail: one local process owns this store; use a database before hosting multiple workers.
    saving = saving.catch(() => {}).then(async () => {
      await mkdir(dirname(storePath), { recursive: true, mode: 0o700 });
      const temp = `${storePath}.tmp`;
      await writeFile(temp, JSON.stringify({ schema: 'supply-yard-paypal-sandbox-v1', orders: [...orders.values()] }, null, 2), { mode: 0o600 });
      await rename(temp, storePath);
    });
    return saving;
  }
  function guard() {
    if (!sandbox) fail(503, 'SANDBOX_ONLY', 'This integration only supports SANDBOX. Live credentials and live mode are not supported.');
    if (!configured) fail(503, 'NOT_CONFIGURED', 'Add sandbox credentials to the project .env file, then restart npm run dev.');
  }
  async function responseJson(response) {
    try { return await response.json(); }
    catch { fail(502, 'INVALID_PAYPAL_RESPONSE', 'PayPal returned an unreadable response. Refresh the payment before retrying.'); }
  }
  async function accessToken() {
    guard();
    if (token && Date.now() < expiresAt) return token;
    if (tokenRequest) return tokenRequest;
    tokenRequest = (async () => {
      let response;
      try {
        response = await fetchImpl(`${API}/v1/oauth2/token`, {
          method: 'POST',
          headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'grant_type=client_credentials', signal: AbortSignal.timeout(15000), redirect: 'error',
        });
      } catch { fail(502, 'PAYPAL_UNREACHABLE', 'Could not reach the PayPal sandbox. Check the network and try connecting again.'); }
      const data = await responseJson(response);
      if (!response.ok || typeof data.access_token !== 'string' || !Number.isFinite(data.expires_in)) {
        token = null; authenticatedAt = null;
        fail(502, 'PAYPAL_AUTH_FAILED', 'PayPal sandbox authentication failed. Check that both credentials belong to the same sandbox REST app.');
      }
      token = data.access_token;
      expiresAt = Date.now() + Math.max(1, data.expires_in - 60) * 1000;
      authenticatedAt = new Date().toISOString();
      return token;
    })();
    try { return await tokenRequest; } finally { tokenRequest = null; }
  }
  async function request(path, { method = 'GET', body, requestId } = {}, retry = true) {
    const bearer = await accessToken();
    let response;
    try {
      response = await fetchImpl(`${API}${path}`, {
        method, headers: {
          Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json', Prefer: 'return=representation',
          ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(20000), redirect: 'error',
      });
    } catch { fail(502, 'PAYPAL_UNCONFIRMED', 'PayPal did not confirm the result. Refresh this checkout before retrying; do not start a replacement payment.'); }
    if (response.status === 401 && retry) {
      token = null; expiresAt = 0;
      return request(path, { method, body, requestId }, false);
    }
    const data = await responseJson(response);
    if (!response.ok) {
      const issue = data.details?.[0]?.issue ?? data.name;
      const code = /^[A-Z0-9_]{1,90}$/.test(issue ?? '') ? issue : 'PAYPAL_REQUEST_FAILED';
      const debugId = /^[a-zA-Z0-9-]{1,80}$/.test(data.debug_id ?? '') ? data.debug_id : undefined;
      throw new SandboxError(response.status === 422 ? 409 : 502, code, `PayPal sandbox returned ${code}. Refresh the order to check its current state.`, debugId);
    }
    return data;
  }
  function ownOrder(id) {
    guard();
    if (!uuidPattern.test(id ?? '')) fail(400, 'INVALID_CHECKOUT', 'Invalid local checkout ID.');
    const row = orders.get(id);
    if (!row || row.profile !== profile) fail(404, 'UNKNOWN_CHECKOUT', 'This checkout was not created by the configured sandbox app.');
    return row;
  }
  async function exclusive(id, action) {
    if (running.has(id)) return running.get(id);
    const promise = action();
    running.set(id, promise);
    try { return await promise; } finally { running.delete(id); }
  }
  async function refreshRow(row) {
    if (!row.paypalOrderId) fail(409, 'CREATE_UNCONFIRMED', 'Retry creating this same checkout to recover its PayPal order.');
    const data = await request(`/v2/checkout/orders/${row.paypalOrderId}`);
    Object.assign(row, inspectOrder(data, row), { verifiedAt: new Date().toISOString() });
    if (['COMPLETED', 'VOIDED'].includes(data.status)) row.approvalUrl = null;
    await persist();
    return view(row);
  }
  const status = () => ({
    mode: 'SANDBOX', configured, authenticatedAt,
    configurationError: sandbox ? null : 'SANDBOX_ONLY', cart: CART,
  });
  return {
    status,
    // Server-only reuse for the market's bounded test-card purchases; never exposed as a generic HTTP proxy.
    requestSandbox: request,
    profileKey: () => profile,
    async connect() { await accessToken(); return status(); },
    list() { return [...orders.values()].filter(row => row.profile === profile).reverse().map(view); },
    async create({ id, quantity }, origin) {
      guard();
      if (!uuidPattern.test(id ?? '') || !Number.isInteger(quantity) || quantity < 1 || quantity > CART.maxQuantity) {
        fail(400, 'INVALID_CART', 'Choose 1–10 kits and a valid checkout ID.');
      }
      if (!/^http:\/\/(127\.0\.0\.1|localhost):\d{1,5}$/.test(origin)) fail(400, 'INVALID_RETURN_URL', 'Checkout must return to this local app.');
      const existing = orders.get(id);
      if (existing && (existing.profile !== profile || existing.quantity !== quantity)) {
        fail(409, 'CHECKOUT_CHANGED', 'An existing checkout cannot change app or amount. Start a new checkout.');
      }
      return exclusive(id, async () => {
        if (existing?.paypalOrderId) return view(existing);
        const row = existing ?? {
          id, profile, quantity, grossCents: CART.unitCents * quantity, createdAt: new Date().toISOString(),
          createRequestId: randomUUID(), captureRequestId: randomUUID(),
          orderStatus: 'CREATING', paymentState: 'NOT_PAID', paypalOrderId: null, approvalUrl: null,
        };
        orders.set(id, row);
        await persist(); // Keep the retry key before issuing a possibly ambiguous network request.
        const value = (row.grossCents / 100).toFixed(2);
        const data = await request('/v2/checkout/orders', {
          method: 'POST', requestId: row.createRequestId,
          body: {
            intent: 'CAPTURE',
            purchase_units: [{
              reference_id: id, custom_id: id, invoice_id: `SY-${id}`,
              description: 'Supply Yard sandbox restock — payment evidence demo',
              amount: { currency_code: 'USD', value, breakdown: { item_total: { currency_code: 'USD', value } } },
              items: [{ name: CART.name, sku: 'SY-OFFICE-KIT', quantity: String(quantity), unit_amount: { currency_code: 'USD', value: '10.00' }, category: 'PHYSICAL_GOODS' }],
            }],
            payment_source: { paypal: { experience_context: {
              return_url: `${origin}/sandbox.html?checkout=approved&local=${id}`,
              cancel_url: `${origin}/sandbox.html?checkout=cancelled&local=${id}`,
              user_action: 'PAY_NOW', shipping_preference: 'NO_SHIPPING',
            } } },
          },
        });
        if (!orderPattern.test(data.id ?? '')) fail(502, 'INVALID_PAYPAL_RESPONSE', 'PayPal did not return an order ID.');
        const link = approvalLink(data);
        if (!link) fail(502, 'MISSING_APPROVAL_URL', 'PayPal did not return a buyer approval link.');
        Object.assign(row, { paypalOrderId: data.id, approvalUrl: link, orderStatus: data.status, paymentState: 'AWAITING_BUYER_APPROVAL' });
        await persist();
        return view(row);
      });
    },
    async refresh(id) { const row = ownOrder(id); return exclusive(id, () => refreshRow(row)); },
    async capture(id, expectedOrderId) {
      const row = ownOrder(id);
      if (!row.paypalOrderId || expectedOrderId !== row.paypalOrderId) fail(409, 'ORDER_MISMATCH', 'The approval return does not match this checkout.');
      return exclusive(id, async () => {
        await refreshRow(row); // Never trust the return URL, browser state, or a previous process's receipt.
        if (row.receipt) return view(row); // Includes pending/refunded captures; never capture again.
        if (row.orderStatus !== 'APPROVED') fail(409, 'BUYER_APPROVAL_REQUIRED', 'Approve the payment using your sandbox personal buyer account first.');
        try {
          await request(`/v2/checkout/orders/${row.paypalOrderId}/capture`, { method: 'POST', body: {}, requestId: row.captureRequestId });
        } catch (error) {
          if (error.code !== 'ORDER_ALREADY_CAPTURED') throw error;
        }
        return refreshRow(row); // Only a verified provider capture becomes payment evidence.
      });
    },
  };
}
