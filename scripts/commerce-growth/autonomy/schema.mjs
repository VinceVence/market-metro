export const AUTONOMY_SCHEMA=`
CREATE TABLE IF NOT EXISTS autonomy_baskets(basket_id TEXT PRIMARY KEY,run_id TEXT REFERENCES simulation_runs(run_id),request_id TEXT,customer_id TEXT REFERENCES customers(customer_id),capture_day INTEGER,event_date TEXT,authorized_cents INTEGER,gross_cents INTEGER,fee_cents INTEGER,processing_cents INTEGER,deadline_day INTEGER,status TEXT,legs_json TEXT,source TEXT);
CREATE TABLE IF NOT EXISTS autonomy_contacts(contact_id TEXT PRIMARY KEY,run_id TEXT REFERENCES simulation_runs(run_id),day INTEGER,event_date TEXT,customer_id TEXT REFERENCES customers(customer_id),catalog_item_id TEXT,kind TEXT,cost_cents INTEGER,responded INTEGER,authorized INTEGER,request_id TEXT,model_id TEXT,policy_source TEXT,source TEXT);
CREATE TABLE IF NOT EXISTS autonomy_ledger(entry_id TEXT PRIMARY KEY,run_id TEXT REFERENCES simulation_runs(run_id),day INTEGER,event_date TEXT,from_account TEXT,to_account TEXT,amount_cents INTEGER,kind TEXT,reference_id TEXT,source TEXT);
CREATE TABLE IF NOT EXISTS autonomy_supplier_payments(invoice_id TEXT PRIMARY KEY,run_id TEXT REFERENCES simulation_runs(run_id),stage TEXT,rail TEXT,created_day INTEGER,settlement_day INTEGER,gross_cents INTEGER,fee_cents INTEGER,processing_cents INTEGER,status TEXT,source TEXT);
`;
export const AUTONOMY_TABLES=['autonomy_baskets','autonomy_contacts','autonomy_ledger','autonomy_supplier_payments'];
export const AUTONOMY_DICTIONARY={
 autonomy_baskets:'Canonical customer checkouts from the frozen growth economy. The orders table holds merchant legs; do not count legs and baskets as separate customer purchases.',
 autonomy_contacts:'Observed contact decisions, model lineage and funded responses. A response is not a purchase.',
 autonomy_ledger:'Modeled commerce transfers in integer cents. Household income, private wallets and outside-market spending are excluded. Not native PayPal receipts.',
 autonomy_supplier_payments:'Modeled funded supplier invoices and settlement status. Bank and PayPal fee/timing assumptions remain frozen.'
};
