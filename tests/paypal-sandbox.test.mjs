import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { createPayPalSandbox } from '../scripts/paypal-sandbox.mjs';
import { createSupplyYardServer } from '../scripts/serve.mjs';
import { buildReserveReview } from '../demo/game/sandbox-review.mjs';

const env = { PAYPAL_CLIENT_ID: 'sandbox-client-only-for-tests', PAYPAL_CLIENT_SECRET: 'fake-secret-only-for-tests', PAYPAL_ENVIRONMENT: 'SANDBOX' };
const origin = 'http://127.0.0.1:4173';
const answer = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
test('native 204 success is valid for invoice and subscription lifecycle actions',async()=>{
  const paypal=await createPayPalSandbox({env,fetchImpl:async url=>url.endsWith('/v1/oauth2/token')?answer({access_token:'test-only-token',expires_in:7200}):new Response(null,{status:204})});
  assert.deepEqual(await paypal.requestSandbox('/v2/invoicing/invoices/INV2-TEST/send',{method:'POST',body:{send_to_recipient:false}}),{});
});
test('an empty 403 preserves a permission-denied error',async()=>{
  const paypal=await createPayPalSandbox({env,fetchImpl:async url=>url.endsWith('/v1/oauth2/token')?answer({access_token:'test-only-token',expires_in:7200}):answer({},403)});
  await assert.rejects(()=>paypal.requestSandbox('/v1/shipping/trackers/test'),e=>e.code==='PAYPAL_PERMISSION_DENIED');
});
function provider() {
  const state = { calls: [], orders: new Map(), requests: new Map(), captureCount: 0, createCount: 0 };
  state.fetch = async (url, options) => {
    assert.equal(new URL(url).origin, 'https://api-m.sandbox.paypal.com', 'No requests may reach live PayPal');
    state.calls.push({ url, method: options.method, requestId: options.headers['PayPal-Request-Id'] });
    if (url.endsWith('/v1/oauth2/token')) return state.authFail
      ? answer({ error: 'invalid_client' }, 401)
      : answer({ access_token: 'fake-access-token-only-for-tests', expires_in: 7200 });
    if (options.method === 'POST' && url.endsWith('/v2/checkout/orders')) {
      let order = state.requests.get(options.headers['PayPal-Request-Id']);
      if (!order) {
        const payload = JSON.parse(options.body);
        assert.equal(payload.purchase_units[0].amount.value, (Number(payload.purchase_units[0].items[0].quantity) * 10).toFixed(2));
        assert.match(payload.payment_source.paypal.experience_context.return_url, /^http:\/\/127\.0\.0\.1:4173\/sandbox.html\?checkout=approved/);
        order = { id: `TESTORDER${String(++state.createCount).padStart(8, '0')}`, status: 'PAYER_ACTION_REQUIRED',
          purchase_units: structuredClone(payload.purchase_units), payer: { email_address: 'private-buyer@example.test' } };
        state.orders.set(order.id, order); state.requests.set(options.headers['PayPal-Request-Id'], order);
      }
      if (state.loseCreate) { state.loseCreate = false; throw new Error('Simulated response lost after create'); }
      return answer({ id: order.id, status: order.status, links: [{ rel: 'payer-action', href: `https://${state.badApproval ? 'www.paypal.com' : 'www.sandbox.paypal.com'}/checkoutnow?token=${order.id}` }] }, 201);
    }
    const id = url.split('/v2/checkout/orders/')[1]?.split('/')[0];
    const order = state.orders.get(id);
    if (!order) return answer({ name: 'RESOURCE_NOT_FOUND' }, 404);
    if (options.method === 'GET') return answer(order);
    if (url.endsWith('/capture')) {
      assert.equal(order.status, 'APPROVED');
      state.captureCount++;
      const gross = order.purchase_units[0].amount;
      const value = Number(gross.value);
      order.status = 'COMPLETED';
      order.purchase_units[0].payments = { captures: [{
        id: `TESTCAPTURE${String(state.captureCount).padStart(6, '0')}`, status: state.pending ? 'PENDING' : 'COMPLETED',
        amount: gross, create_time: '2026-10-20T00:00:00Z',
        ...(state.noFees ? {} : { seller_receivable_breakdown: {
          gross_amount: gross, paypal_fee: { currency_code: 'USD', value: '3.00' },
          net_amount: { currency_code: 'USD', value: (value - 3).toFixed(2) },
        } }),
      }] };
      if (state.loseCapture) { state.loseCapture = false; throw new Error('Simulated response lost after capture'); }
      return answer(order, 201);
    }
    throw new Error('Unexpected provider request');
  };
  return state;
}
async function setup(options = {}) {
  const p = provider();
  const service = await createPayPalSandbox({ env, fetchImpl: p.fetch, ...options });
  const input = { id: randomUUID(), quantity: 10 };
  return { p, service, input };
}
async function approved(f) {
  const row = await f.service.create(f.input, origin);
  f.p.orders.get(row.paypalOrderId).status = 'APPROVED';
  return row;
}

test('sandbox lifecycle verifies approval/capture, reconciles fees and strips private provider fields', async () => {
  const f = await setup();
  await f.service.connect();
  const row = await approved(f);
  const captured = await f.service.capture(row.id, row.paypalOrderId);
  assert.equal(captured.paymentState, 'COMPLETED');
  assert.equal(captured.receipt.grossCents, 10000);
  assert.equal(captured.receipt.feeCents, 300);
  assert.equal(captured.receipt.netCents, 9700);
  assert.equal(captured.receipt.provenance, 'PAYPAL_SANDBOX');
  assert.ok(captured.verifiedAt);
  const exposed = JSON.stringify([f.service.status(), f.service.list()]);
  for (const secret of ['private-buyer', env.PAYPAL_CLIENT_SECRET, env.PAYPAL_CLIENT_ID, 'fake-access-token']) assert.ok(!exposed.includes(secret));
});

test('missing credentials or live mode fail before any network request', async () => {
  for (const bad of [{}, { ...env, PAYPAL_ENVIRONMENT: 'LIVE' }]) {
    const f = await setup({ env: bad });
    await assert.rejects(f.service.connect(), /sandbox|credentials/i);
    await assert.rejects(f.service.create(f.input, origin));
    assert.equal(f.p.calls.length, 0);
  }
});

test('invalid amounts, unknown orders and live approval links are rejected', async () => {
  const f = await setup();
  for (const quantity of [0, 11, 1.5, '10']) await assert.rejects(f.service.create({ id: randomUUID(), quantity }, origin), /1–10/);
  await assert.rejects(f.service.capture(randomUUID(), 'OTHERORDER123'), /not created/);
  assert.equal(f.p.calls.length, 0);
  f.p.badApproval = true;
  await assert.rejects(f.service.create(f.input, origin), /sandbox approval/);
});

test('return tokens and local browser state never substitute for buyer approval', async () => {
  const f = await setup();
  const row = await f.service.create(f.input, origin);
  await assert.rejects(f.service.capture(row.id, 'WRONGTOKEN123'), /does not match/);
  await assert.rejects(f.service.capture(row.id, row.paypalOrderId), /Approve the payment/);
  assert.equal(f.p.captureCount, 0);
});

test('duplicate create and capture clicks issue one provider operation', async () => {
  const f = await setup();
  const rows = await Promise.all([f.service.create(f.input, origin), f.service.create(f.input, origin)]);
  assert.equal(rows[0].paypalOrderId, rows[1].paypalOrderId);
  assert.equal(f.p.createCount, 1);
  f.p.orders.get(rows[0].paypalOrderId).status = 'APPROVED';
  await Promise.all([f.service.capture(rows[0].id, rows[0].paypalOrderId), f.service.capture(rows[0].id, rows[0].paypalOrderId)]);
  await f.service.capture(rows[0].id, rows[0].paypalOrderId);
  assert.equal(f.p.captureCount, 1);
  await assert.rejects(f.service.create({ ...f.input, quantity: 2 }, origin), /cannot change/);
});

test('lost create response reuses persisted idempotency key after server restart', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'supply-yard-paypal-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const storePath = join(dir, 'receipts.json'), f = await setup({ storePath });
  f.p.loseCreate = true;
  await assert.rejects(f.service.create(f.input, origin), /did not confirm/);
  const restarted = await createPayPalSandbox({ env, fetchImpl: f.p.fetch, storePath });
  const row = await restarted.create(f.input, origin);
  assert.equal(f.p.createCount, 1); assert.ok(row.paypalOrderId);
  const calls = f.p.calls.filter(c => c.url.endsWith('/v2/checkout/orders'));
  assert.equal(calls[0].requestId, calls[1].requestId);
  const file = await readFile(storePath, 'utf8');
  assert.ok(!file.includes(env.PAYPAL_CLIENT_SECRET));
  assert.ok(!file.includes('private-buyer'));
});

test('lost capture response is reconciled without charging again', async () => {
  const f = await setup(), row = await approved(f);
  f.p.loseCapture = true;
  await assert.rejects(f.service.capture(row.id, row.paypalOrderId), /did not confirm/);
  const recovered = await f.service.capture(row.id, row.paypalOrderId);
  assert.equal(recovered.receipt.status, 'COMPLETED'); assert.equal(f.p.captureCount, 1);
});

test('pending and refunded captures cannot be treated as completed reserve evidence', async () => {
  const f = await setup(), row = await approved(f);
  f.p.pending = true;
  const pending = await f.service.capture(row.id, row.paypalOrderId);
  assert.equal(pending.receipt.status, 'PENDING');
  assert.throws(() => buildReserveReview(pending), /completed/);
  f.p.orders.get(row.paypalOrderId).purchase_units[0].payments.captures[0].status = 'REFUNDED';
  const refunded = await f.service.refresh(row.id);
  assert.throws(() => buildReserveReview(refunded), /completed/);
  assert.equal(f.p.captureCount, 1);
});

test('amount or reference tampering fails provider verification', async () => {
  const f = await setup(), row = await approved(f);
  f.p.orders.get(row.paypalOrderId).purchase_units[0].amount.value = '99.00';
  await assert.rejects(f.service.capture(row.id, row.paypalOrderId), /does not match/);
  assert.equal(f.p.captureCount, 0);
});

test('unknown fee data stays unknown, rather than inventing merchant proceeds', async () => {
  const f = await setup(), row = await approved(f);
  f.p.noFees = true;
  const captured = await f.service.capture(row.id, row.paypalOrderId);
  assert.equal(captured.receipt.netCents, null);
  assert.equal(buildReserveReview(captured).availableAfter, null);
});

test('reserve simulation uses actual receipt net, labels generated evidence and preserves adverse cases', async () => {
  const f = await setup(), row = await approved(f);
  const captured = await f.service.capture(row.id, row.paypalOrderId);
  const review = buildReserveReview(captured);
  assert.equal(review.beforeTarget, 10000); assert.equal(review.afterTarget, 5200);
  assert.equal(review.beforeHeld, 9700); assert.equal(review.afterHeld, 5200); assert.equal(review.availableAfter, 4500);
  assert.equal(review.afterHeld + review.availableAfter, captured.receipt.netCents);
  assert.ok(review.evidence.every(e => e.provenance === 'GENERATED_SCENARIO'));
  assert.equal(review.evidence.filter(e => e.verifiedDelivered).length, 6);
  assert.equal(buildReserveReview(captured, 'unresolved').availableAfter, 0);
  assert.equal(buildReserveReview(captured, 'unresolved').afterTarget, 10000);
});

test('local receipt corruption is not silently discarded, and changing app cannot capture old orders', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'supply-yard-paypal-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const storePath = join(dir, 'receipts.json'), f = await setup({ storePath });
  const row = await approved(f);
  const other = await createPayPalSandbox({ env: { ...env, PAYPAL_CLIENT_ID: 'different-app' }, fetchImpl: f.p.fetch, storePath });
  assert.equal(other.list().length, 0);
  await assert.rejects(other.capture(row.id, row.paypalOrderId), /not created/);
  await writeFile(storePath, 'broken');
  await assert.rejects(createPayPalSandbox({ env, storePath }), /could not be read/);
  assert.equal(await readFile(storePath, 'utf8'), 'broken');
});

test('HTTP boundary rejects cross-origin mutations and exposes no credential values', async t => {
  const f = await setup();
  const server = createSupplyYardServer(f.service);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const status = await (await fetch(`${base}/api/paypal/status`)).json();
  assert.equal(status.configured, true); assert.ok(!JSON.stringify(status).includes(env.PAYPAL_CLIENT_ID));
  const hostile = await fetch(`${base}/api/paypal/connect`, { method: 'POST', headers: { Origin: 'https://example.test', 'Content-Type': 'application/json', 'X-Supply-Yard': 'sandbox' }, body: '{}' });
  assert.equal(hostile.status, 403); assert.equal(f.p.calls.length, 0);
  const allowed = await fetch(`${base}/api/paypal/connect`, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json', 'X-Supply-Yard': 'sandbox' }, body: '{}' });
  assert.equal(allowed.status, 200);
  assert.equal((await fetch(`${base}/.env`)).status, 404);
  // Node fetch replaces Host; send the actual forged header through node:http.
  const wrongHostStatus = await new Promise((resolve, reject) => {
    const req = httpRequest(`${base}/api/paypal/status`, { headers: { Host: 'example.test' } }, res => {
      res.resume(); resolve(res.statusCode);
    });
    req.on('error', reject); req.end();
  });
  assert.equal(wrongHostStatus, 403);
});
