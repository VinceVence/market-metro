export const COMMERCE_SCHEMA = `
CREATE TABLE IF NOT EXISTS paypal_operations (
  operation_id TEXT PRIMARY KEY, run_id TEXT REFERENCES simulation_runs(run_id),
  service TEXT NOT NULL, action TEXT NOT NULL, status TEXT NOT NULL,
  evidence_day INTEGER, actor TEXT, rationale TEXT, evidence_json TEXT,
  order_id TEXT, customer_id TEXT, product_id TEXT, merchant_id TEXT,
  amount_cents INTEGER, currency TEXT DEFAULT 'USD', provider_id TEXT,
  result_json TEXT, error_code TEXT, profile_key TEXT, request_id TEXT,
  created_at TEXT, updated_at TEXT, source TEXT DEFAULT 'PAYPAL_SANDBOX'
);
CREATE INDEX IF NOT EXISTS paypal_operations_run ON paypal_operations(run_id,service);
CREATE TABLE IF NOT EXISTS paypal_money_events (
  event_id TEXT PRIMARY KEY, run_id TEXT REFERENCES simulation_runs(run_id),
  operation_id TEXT REFERENCES paypal_operations(operation_id), order_id TEXT,
  customer_id TEXT, merchant_id TEXT, event_type TEXT, provider_id TEXT,
  status TEXT, amount_cents INTEGER, fee_cents INTEGER, currency TEXT,
  provider_at TEXT, recorded_at TEXT, source TEXT DEFAULT 'PAYPAL_SANDBOX'
);
CREATE INDEX IF NOT EXISTS paypal_money_events_run ON paypal_money_events(run_id);
CREATE VIEW IF NOT EXISTS v_paypal_agent_actions AS
SELECT o.run_id,o.operation_id,o.service,o.action,o.status,o.evidence_day,
o.actor,o.rationale,o.order_id,o.customer_id,o.merchant_id,o.product_id,
p.channel3_product_id,p.title AS product_title,o.amount_cents,o.currency,
o.provider_id,o.error_code,o.created_at,o.updated_at,o.source
FROM paypal_operations o LEFT JOIN products p ON p.product_id=o.product_id;
`;
export const COMMERCE_TABLES=['paypal_operations','paypal_money_events'];
export const COMMERCE_VIEWS=['v_paypal_agent_actions'];
export const COMMERCE_DICTIONARY={
  paypal_operations:'Checkpointed agent choices and native PayPal API outcomes. Draft invoices and pending subscriptions are not payments. Scenario requests are labeled in evidence_json.',
  paypal_money_events:'Verified native sandbox capture, refund and payout states. Provider timestamps are wall-clock time; these are samples, never additional simulated sales.',
  v_paypal_agent_actions:'Agent rationale and evidence cutoff joined to Channel3 product, shopper, merchant and actual PayPal operation. No secrets or wallet tokens.'
};
