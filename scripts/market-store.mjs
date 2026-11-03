import {WORKFLOW_SCHEMA,WORKFLOW_TABLES,WORKFLOW_DICTIONARY} from './marketing/workflow-schema.mjs';
import {AUTONOMY_SCHEMA,AUTONOMY_TABLES,AUTONOMY_DICTIONARY} from './commerce-growth/autonomy/schema.mjs';
import {SCHEMA as BEHAVIOR_SCHEMA,TABLES as BEHAVIOR_TABLES,VIEWS as BEHAVIOR_VIEWS,DICTIONARY as BEHAVIOR_DICTIONARY} from './behavior-v3/schema.mjs';
import {POLICY_SCHEMA,POLICY_TABLES,POLICY_VIEWS,POLICY_DICTIONARY} from './policy-lab/schema.mjs';
import {COMMERCE_SCHEMA,COMMERCE_TABLES,COMMERCE_VIEWS,COMMERCE_DICTIONARY} from './paypal-commerce-schema.mjs';
import {LEARNING_SCHEMA,LEARNING_TABLES,LEARNING_VIEWS,LEARNING_DICTIONARY} from './marketing/contract.mjs';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Approval links belong in the local consent UI, not downloadable datasets or model evidence.
export function redactApprovalLinks(value){
  if(Array.isArray(value))return value.map(redactApprovalLinks);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,['approvalUrl','paymentUrl'].includes(key)?'[redacted consent link]':redactApprovalLinks(item)]));
  return value;
}
function publicRow(row){
  const {profile_key,create_request_id,capture_request_id,funding_key,request_id,...visible}=row;
  for(const [key,value] of Object.entries(visible))if(key.endsWith('_json')&&typeof value==='string'&&/approvalUrl|paymentUrl/.test(value)){
    try{visible[key]=JSON.stringify(redactApprovalLinks(JSON.parse(value)));}catch{}
  }
  return visible;
}

export const SCHEMA = `
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS simulation_runs (run_id TEXT PRIMARY KEY, seed INTEGER, started_at TEXT, timezone TEXT, status TEXT, total_ticks INTEGER, current_tick INTEGER, merchant_count INTEGER, customer_count INTEGER, catalog_source TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS run_state (run_id TEXT PRIMARY KEY REFERENCES simulation_runs(run_id), state_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS merchants (merchant_id TEXT PRIMARY KEY, run_id TEXT REFERENCES simulation_runs(run_id), name TEXT, district TEXT, category TEXT, position INTEGER, starting_cash_cents INTEGER, source TEXT, paypal_account_mapping TEXT);
CREATE TABLE IF NOT EXISTS products (product_id TEXT PRIMARY KEY, run_id TEXT REFERENCES simulation_runs(run_id), merchant_id TEXT REFERENCES merchants(merchant_id), channel3_product_id TEXT, catalog_item_id TEXT, title TEXT, brand TEXT, category TEXT, currency TEXT, price_cents INTEGER, cost_cents INTEGER, source TEXT, source_url TEXT, image_url TEXT, initial_stock INTEGER, cost_assumption TEXT, retrieved_at TEXT);
CREATE TABLE IF NOT EXISTS customers (customer_id TEXT PRIMARY KEY, run_id TEXT REFERENCES simulation_runs(run_id), segment TEXT, budget_cents INTEGER, source TEXT);
CREATE TABLE IF NOT EXISTS campaigns (campaign_id TEXT PRIMARY KEY, run_id TEXT REFERENCES simulation_runs(run_id), merchant_id TEXT REFERENCES merchants(merchant_id), name TEXT, channel TEXT, objective TEXT, daily_budget_cents INTEGER, status TEXT, policy TEXT, creative TEXT);
CREATE TABLE IF NOT EXISTS events (event_id TEXT PRIMARY KEY, run_id TEXT REFERENCES simulation_runs(run_id), event_ts TEXT, event_date TEXT, merchant_id TEXT REFERENCES merchants(merchant_id), customer_id TEXT REFERENCES customers(customer_id), product_id TEXT REFERENCES products(product_id), campaign_id TEXT REFERENCES campaigns(campaign_id), order_id TEXT, channel TEXT, event_type TEXT, detail_json TEXT, source TEXT);
CREATE TABLE IF NOT EXISTS orders (order_id TEXT PRIMARY KEY, run_id TEXT REFERENCES simulation_runs(run_id), merchant_id TEXT REFERENCES merchants(merchant_id), customer_id TEXT REFERENCES customers(customer_id), campaign_id TEXT REFERENCES campaigns(campaign_id), event_ts TEXT, event_date TEXT, channel TEXT, currency TEXT, subtotal_cents INTEGER, discount_cents INTEGER, shipping_cents INTEGER, total_cents INTEGER, cost_cents INTEGER, delivery_cost_cents INTEGER, status TEXT, source TEXT, sandbox_requested INTEGER);
CREATE TABLE IF NOT EXISTS order_items (order_item_id TEXT PRIMARY KEY, run_id TEXT REFERENCES simulation_runs(run_id), order_id TEXT REFERENCES orders(order_id), product_id TEXT REFERENCES products(product_id), quantity INTEGER, unit_price_cents INTEGER, line_total_cents INTEGER);
CREATE TABLE IF NOT EXISTS transactions (transaction_id TEXT PRIMARY KEY, run_id TEXT REFERENCES simulation_runs(run_id), order_id TEXT UNIQUE REFERENCES orders(order_id), merchant_id TEXT REFERENCES merchants(merchant_id), event_ts TEXT, event_date TEXT, currency TEXT, gross_cents INTEGER, fee_cents INTEGER, net_cents INTEGER, status TEXT, source TEXT, fee_assumption TEXT);
CREATE TABLE IF NOT EXISTS refunds (refund_id TEXT PRIMARY KEY, run_id TEXT REFERENCES simulation_runs(run_id), order_id TEXT UNIQUE REFERENCES orders(order_id), transaction_id TEXT REFERENCES transactions(transaction_id), merchant_id TEXT REFERENCES merchants(merchant_id), event_ts TEXT, event_date TEXT, amount_cents INTEGER, currency TEXT, reason TEXT, source TEXT);
CREATE TABLE IF NOT EXISTS deliveries (delivery_id TEXT PRIMARY KEY, run_id TEXT REFERENCES simulation_runs(run_id), order_id TEXT UNIQUE REFERENCES orders(order_id), merchant_id TEXT REFERENCES merchants(merchant_id), event_ts TEXT, event_date TEXT, units INTEGER, status TEXT, source TEXT);
CREATE TABLE IF NOT EXISTS inventory_movements (movement_id TEXT PRIMARY KEY, run_id TEXT REFERENCES simulation_runs(run_id), product_id TEXT REFERENCES products(product_id), merchant_id TEXT REFERENCES merchants(merchant_id), order_id TEXT REFERENCES orders(order_id), event_ts TEXT, event_date TEXT, quantity INTEGER, reason TEXT, source TEXT);
CREATE TABLE IF NOT EXISTS campaign_spend (spend_id TEXT PRIMARY KEY, run_id TEXT REFERENCES simulation_runs(run_id), campaign_id TEXT REFERENCES campaigns(campaign_id), merchant_id TEXT REFERENCES merchants(merchant_id), event_ts TEXT, event_date TEXT, channel TEXT, amount_cents INTEGER, currency TEXT, source TEXT);
CREATE TABLE IF NOT EXISTS paypal_receipts (receipt_id TEXT PRIMARY KEY, run_id TEXT REFERENCES simulation_runs(run_id), order_id TEXT UNIQUE REFERENCES orders(order_id), merchant_id TEXT REFERENCES merchants(merchant_id), profile_key TEXT, status TEXT, paypal_order_id TEXT UNIQUE, capture_id TEXT UNIQUE, payee_merchant_id TEXT, currency TEXT, gross_cents INTEGER, fee_cents INTEGER, net_cents INTEGER, created_at TEXT, captured_at TEXT, verified_at TEXT, event_date TEXT, error_code TEXT, create_request_id TEXT, capture_request_id TEXT, funding_method TEXT, funding_key TEXT, source TEXT DEFAULT 'PAYPAL_SANDBOX');
CREATE INDEX IF NOT EXISTS events_run_date ON events(run_id,event_date,event_type);
CREATE INDEX IF NOT EXISTS orders_run_date ON orders(run_id,event_date,merchant_id);
CREATE INDEX IF NOT EXISTS transactions_run ON transactions(run_id,event_date);
CREATE INDEX IF NOT EXISTS campaign_spend_run ON campaign_spend(run_id,campaign_id,event_date);
CREATE VIEW IF NOT EXISTS v_marketing_transactions AS SELECT t.transaction_id,t.run_id,t.event_ts,t.event_date,t.order_id,t.merchant_id,m.name AS merchant_name,m.district,o.customer_id,u.segment AS customer_segment,o.campaign_id,c.name AS campaign_name,o.channel,t.currency,t.gross_cents,t.fee_cents,t.net_cents,COALESCE(r.amount_cents,0) AS refunded_cents,o.cost_cents,o.delivery_cost_cents,t.net_cents-COALESCE(r.amount_cents,0)-o.cost_cents-o.delivery_cost_cents AS contribution_before_marketing_cents,t.source,p.status AS sandbox_status,p.paypal_order_id,p.capture_id,p.gross_cents AS sandbox_gross_cents,p.fee_cents AS sandbox_fee_cents,p.net_cents AS sandbox_net_cents,p.captured_at AS sandbox_captured_at FROM transactions t JOIN orders o USING(order_id) JOIN merchants m ON m.merchant_id=t.merchant_id JOIN customers u ON u.customer_id=o.customer_id LEFT JOIN campaigns c ON c.campaign_id=o.campaign_id LEFT JOIN refunds r ON r.order_id=t.order_id LEFT JOIN paypal_receipts p ON p.order_id=t.order_id;
CREATE VIEW IF NOT EXISTS v_daily_merchant_sales AS WITH sales AS (SELECT run_id,event_date,merchant_id,COUNT(*) AS purchases,SUM(gross_cents) AS gross_cents,SUM(fee_cents) AS fee_cents,SUM(refunded_cents) AS refunds_cents,SUM(contribution_before_marketing_cents) AS contribution_cents FROM v_marketing_transactions GROUP BY run_id,event_date,merchant_id), spend AS (SELECT run_id,event_date,merchant_id,SUM(amount_cents) AS ad_spend_cents FROM campaign_spend GROUP BY run_id,event_date,merchant_id), keys AS (SELECT run_id,event_date,merchant_id FROM sales UNION SELECT run_id,event_date,merchant_id FROM spend) SELECT k.run_id,k.event_date,k.merchant_id,m.name AS merchant_name,COALESCE(s.purchases,0) AS purchases,COALESCE(s.gross_cents,0) AS gross_cents,COALESCE(s.fee_cents,0) AS fee_cents,COALESCE(s.refunds_cents,0) AS refunds_cents,COALESCE(s.contribution_cents,0) AS contribution_cents,COALESCE(a.ad_spend_cents,0) AS ad_spend_cents,COALESCE(s.contribution_cents,0)-COALESCE(a.ad_spend_cents,0) AS contribution_after_marketing_cents FROM keys k JOIN merchants m USING(merchant_id) LEFT JOIN sales s ON s.run_id=k.run_id AND s.event_date=k.event_date AND s.merchant_id=k.merchant_id LEFT JOIN spend a ON a.run_id=k.run_id AND a.event_date=k.event_date AND a.merchant_id=k.merchant_id;
CREATE VIEW IF NOT EXISTS v_campaign_performance AS WITH traffic AS (SELECT run_id,campaign_id,COUNT(CASE WHEN event_type='impression' THEN 1 END) AS impressions,COUNT(CASE WHEN event_type='product_view' THEN 1 END) AS clicks,COUNT(CASE WHEN event_type='add_to_cart' THEN 1 END) AS carts FROM events GROUP BY run_id,campaign_id), sales AS (SELECT run_id,campaign_id,COUNT(*) AS purchases,SUM(gross_cents-refunded_cents) AS retained_revenue_cents,SUM(contribution_before_marketing_cents) AS contribution_cents FROM v_marketing_transactions GROUP BY run_id,campaign_id), spend AS (SELECT run_id,campaign_id,SUM(amount_cents) AS spend_cents FROM campaign_spend GROUP BY run_id,campaign_id) SELECT c.run_id,c.campaign_id,c.merchant_id,m.name AS merchant_name,c.name,c.channel,COALESCE(t.impressions,0) AS impressions,COALESCE(t.clicks,0) AS clicks,COALESCE(t.carts,0) AS carts,COALESCE(s.purchases,0) AS purchases,COALESCE(s.retained_revenue_cents,0) AS retained_revenue_cents,COALESCE(a.spend_cents,0) AS spend_cents,COALESCE(s.contribution_cents,0)-COALESCE(a.spend_cents,0) AS contribution_cents,ROUND(1.0*s.retained_revenue_cents/NULLIF(a.spend_cents,0),2) AS roas FROM campaigns c JOIN merchants m USING(merchant_id) LEFT JOIN traffic t ON t.campaign_id=c.campaign_id LEFT JOIN sales s ON s.campaign_id=c.campaign_id LEFT JOIN spend a ON a.campaign_id=c.campaign_id;
CREATE VIEW IF NOT EXISTS v_marketing_funnel AS SELECT run_id,event_date,merchant_id,channel,COUNT(CASE WHEN event_type='impression' THEN 1 END) AS impressions,COUNT(CASE WHEN event_type='product_view' THEN 1 END) AS product_views,COUNT(CASE WHEN event_type='add_to_cart' THEN 1 END) AS carts,COUNT(CASE WHEN event_type='purchase' THEN 1 END) AS purchases,COUNT(CASE WHEN event_type='cart_abandoned' THEN 1 END) AS abandoned_carts,COUNT(CASE WHEN event_type='stockout' THEN 1 END) AS stockouts FROM events GROUP BY run_id,event_date,merchant_id,channel;
CREATE VIEW IF NOT EXISTS v_inventory AS SELECT p.run_id,p.product_id,p.merchant_id,p.title,p.initial_stock,COALESCE(SUM(i.quantity),0) AS net_movement,p.initial_stock+COALESCE(SUM(i.quantity),0) AS on_hand FROM products p LEFT JOIN inventory_movements i USING(product_id) GROUP BY p.product_id;
CREATE VIEW IF NOT EXISTS v_customer_segments AS SELECT u.run_id,u.segment,COUNT(DISTINCT u.customer_id) AS customers,COUNT(DISTINCT t.order_id) AS purchases,COALESCE(SUM(t.gross_cents-t.refunded_cents),0) AS retained_revenue_cents FROM customers u LEFT JOIN v_marketing_transactions t USING(customer_id) GROUP BY u.run_id,u.segment;
` + LEARNING_SCHEMA + WORKFLOW_SCHEMA + COMMERCE_SCHEMA + POLICY_SCHEMA + BEHAVIOR_SCHEMA + AUTONOMY_SCHEMA + `
CREATE INDEX IF NOT EXISTS order_items_run ON order_items(run_id);
CREATE INDEX IF NOT EXISTS order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS deliveries_run ON deliveries(run_id);
CREATE INDEX IF NOT EXISTS inventory_movements_run ON inventory_movements(run_id);
CREATE INDEX IF NOT EXISTS refunds_run ON refunds(run_id);
CREATE INDEX IF NOT EXISTS coupon_redemptions_run ON coupon_redemptions(run_id);
CREATE INDEX IF NOT EXISTS coupon_redemptions_order ON coupon_redemptions(order_id);
CREATE INDEX IF NOT EXISTS campaign_assignments_run ON campaign_assignments(run_id);
CREATE VIEW IF NOT EXISTS v_paypal_order_lineage AS SELECT o.run_id,o.order_id,o.event_ts AS simulation_event_ts,o.event_date AS simulation_event_date,o.merchant_id,m.name AS merchant_name,o.customer_id,o.campaign_id,c.coupon_id,c.discount_pct,o.currency,o.total_cents AS simulated_gross_cents,t.fee_cents AS modeled_fee_cents,t.net_cents AS modeled_net_cents,p.receipt_id,p.funding_method,p.status AS paypal_status,p.paypal_order_id,p.capture_id,p.payee_merchant_id,p.gross_cents AS paypal_gross_cents,p.fee_cents AS paypal_fee_cents,p.net_cents AS paypal_net_cents,p.captured_at AS provider_captured_at,p.verified_at AS provider_verified_at,p.event_date AS provider_event_date,p.error_code,p.source AS payment_source,CASE WHEN p.status IN ('COMPLETED','PARTIALLY_REFUNDED','REFUNDED') AND p.gross_cents=o.total_cents AND p.currency=o.currency THEN 1 ELSE 0 END AS amount_verified,(SELECT group_concat(pr.channel3_product_id,', ') FROM order_items oi JOIN products pr USING(product_id) WHERE oi.order_id=o.order_id) AS channel3_product_ids,(SELECT group_concat(pr.title,' | ') FROM order_items oi JOIN products pr USING(product_id) WHERE oi.order_id=o.order_id) AS product_titles FROM paypal_receipts p JOIN orders o ON o.order_id=p.order_id JOIN merchants m ON m.merchant_id=o.merchant_id JOIN transactions t ON t.order_id=o.order_id LEFT JOIN coupon_redemptions cr ON cr.order_id=o.order_id LEFT JOIN coupons c ON c.coupon_id=cr.coupon_id;
`;
export const TABLES = ['simulation_runs','merchants','products','customers','campaigns','events','orders','order_items','transactions','refunds','deliveries','inventory_movements','campaign_spend','paypal_receipts',...LEARNING_TABLES,...WORKFLOW_TABLES,...COMMERCE_TABLES,...POLICY_TABLES,...BEHAVIOR_TABLES,...AUTONOMY_TABLES];
export const VIEWS = ['v_marketing_transactions','v_daily_merchant_sales','v_campaign_performance','v_marketing_funnel','v_inventory','v_customer_segments',...LEARNING_VIEWS,'v_paypal_order_lineage',...COMMERCE_VIEWS,...POLICY_VIEWS,...BEHAVIOR_VIEWS];
export const DATA_DICTIONARY = {
  ...LEARNING_DICTIONARY,...WORKFLOW_DICTIONARY,...COMMERCE_DICTIONARY,...POLICY_DICTIONARY,...BEHAVIOR_DICTIONARY,...AUTONOMY_DICTIONARY,
  coupons:'One-day, single-shopper simulated offers. Ordinary seasons use merchant-funded coupons; Policy Lab explicitly models80% merchant/20% platform funding. No real retailer coupons are issued.',
  v_paypal_order_lineage:'One row per selected emulator order: Channel3 product IDs, coupon, synthetic merchant/customer, and verified native PayPal sandbox order/capture/fees. Provider timestamps and modeled amounts remain separate. Never add mirrored provider gross to simulated revenue.',
  simulation_runs:'One reproducible simulation and its clock. All dates use Asia/Manila business dates.', merchants:'Fictional merchants. All sandbox receipts settle to the one connected test store.',
  products:'Catalog snapshot. Sample or Channel3 provenance, provider ID, observed price and assumed unit cost.',customers:'Synthetic shoppers and segments; no personal data.',campaigns:'Campaign definitions and planner-authored copy in workflows. Merchant coupons and marketing spend are simulated.',events:'Impressions, views, carts, purchases, deliveries and refunds, with event timestamps and foreign keys.',
  orders:'Generated purchase records; currency and all monetary fields reconcile in integer cents.',order_items:'Product and quantity lines joined to each order.',transactions:'Simulated payment ledger. Never sum these with the mirrored sandbox receipts.',refunds:'Simulated buyer returns. These do not issue PayPal refunds.',deliveries:'Simulated completed deliveries.',inventory_movements:'Signed stock movements: sale negative, restock positive.',campaign_spend:'Simulated ad cost, never charged to an ad platform.',paypal_receipts:'Actual sandbox API receipts for a bounded sample of orders. Fictitious funds; actual provider IDs and fees.',
  v_marketing_transactions:'Orders + merchant + customer + campaign + simulated payment/refund + optional native sandbox receipt.',v_daily_merchant_sales:'Sales-cohort date totals with ad spend. Refunds are attributed back to the original sale date.',v_campaign_performance:'Campaign funnel, retained revenue, spend and ROAS; no causal incrementality claim.',v_marketing_funnel:'Date × merchant × channel funnel counts.',v_inventory:'Opening stock + signed movements = on-hand stock.',v_customer_segments:'Segment-level purchases and retained revenue.'};

export function createMarketStore(path=':memory:') {
  if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
  const db=new DatabaseSync(path);
  const productColumns=db.prepare('PRAGMA table_info(products)').all().map(c=>c.name);
  if(productColumns.length&&!productColumns.includes('catalog_item_id'))db.exec('ALTER TABLE products ADD COLUMN catalog_item_id TEXT');
  const receiptColumns=db.prepare('PRAGMA table_info(paypal_receipts)').all().map(c=>c.name);
  if(receiptColumns.length)for(const column of ['funding_method','funding_key'])if(!receiptColumns.includes(column))db.exec('ALTER TABLE paypal_receipts ADD COLUMN '+column+' TEXT');
  const plannerColumns=db.prepare('PRAGMA table_info(marketing_planner_calls)').all().map(c=>c.name);
  if(plannerColumns.length&&!plannerColumns.includes('budget_id')){db.exec('ALTER TABLE marketing_planner_calls ADD COLUMN budget_id TEXT');db.exec('UPDATE marketing_planner_calls SET budget_id=run_id WHERE budget_id IS NULL');}
  db.exec(SCHEMA.replace(/CREATE VIEW IF NOT EXISTS (\w+)/g,'DROP VIEW IF EXISTS $1; CREATE VIEW $1'));
  const cols=new Map([...TABLES,'run_state'].map(t=>[t,db.prepare(`PRAGMA table_info(${t})`).all().map(c=>c.name)]));
  function insert(table,rows){
    if(!cols.has(table))throw new Error('Unknown base table');
    const keys=cols.get(table), stmt=db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`);
    for(const row of rows)stmt.run(...keys.map(k=>row[k]??null));
  }
  function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}
  function saveState(world){db.prepare('INSERT OR REPLACE INTO run_state VALUES (?,?)').run(world.runId,JSON.stringify(world));db.prepare('UPDATE simulation_runs SET status=?, current_tick=? WHERE run_id=?').run(world.status,world.tick,world.runId);}
  function table(name,runId,{limit=100,offset=0}={}){
    if(![...TABLES,...VIEWS].includes(name))throw new Error('Unknown table or view');
    const columns=db.prepare(`PRAGMA table_info(${name})`).all().map(c=>c.name);
    const count=db.prepare(`SELECT COUNT(*) AS n FROM ${name} WHERE run_id=?`).get(runId).n;
    const rows=db.prepare(`SELECT * FROM ${name} WHERE run_id=? LIMIT ? OFFSET ?`).all(runId,Math.min(500,Math.max(1,Math.trunc(Number(limit)||100))),Math.max(0,Math.trunc(Number(offset)||0)));
    // Idempotency keys and application fingerprints are server internals, not marketing columns.
    const visible=columns.filter(k=>!['profile_key','create_request_id','capture_request_id','funding_key','request_id'].includes(k));
    return {name,kind:VIEWS.includes(name)?'view':'table',description:DATA_DICTIONARY[name],columns:visible,count,rows:rows.map(publicRow)};
  }
  return {db,path,insert,transaction,saveState,table,
    create(world){transaction(()=>{insert('simulation_runs',[{run_id:world.runId,seed:world.seed,started_at:world.startedAt,timezone:'Asia/Manila',status:world.status,total_ticks:world.totalTicks,current_tick:0,merchant_count:world.merchants.length,customer_count:world.customers.length,catalog_source:[...new Set(world.products.map(p=>p.source))].join(','),created_at:new Date().toISOString()}]);for(const [t,rows] of Object.entries({merchants:world.merchants,products:world.products,customers:world.customers,campaigns:world.campaigns}))insert(t,rows);saveState(world);});},
    commit(world,batch){transaction(()=>{for(const t of ['orders','order_items','transactions','refunds','deliveries','inventory_movements','campaign_spend','events'])insert(t,batch.rows[t]||[]);saveState(world);});},
    state(id){const row=db.prepare('SELECT state_json FROM run_state WHERE run_id=?').get(id);return row?JSON.parse(row.state_json):null;},
    latest(){return db.prepare('SELECT * FROM simulation_runs ORDER BY created_at DESC LIMIT 1').get()||null;},
    runs(){return db.prepare('SELECT * FROM simulation_runs ORDER BY created_at DESC LIMIT 30').all();},
    catalog(runId,{viewCounts=true}={}){return [...TABLES,...VIEWS].map(name=>({name,kind:VIEWS.includes(name)?'view':'table',count:!viewCounts&&VIEWS.includes(name)?null:db.prepare(`SELECT COUNT(*) AS n FROM ${name} WHERE run_id=?`).get(runId).n,description:DATA_DICTIONARY[name]}));},
    export(runId){return {schema:'market-metro-v2',generated_at:new Date().toISOString(),timezone:'Asia/Manila',money_unit:'integer cents',tables:Object.fromEntries(TABLES.map(t=>[t,db.prepare(`SELECT * FROM ${t} WHERE run_id=?`).all(runId).map(publicRow)])),views:Object.fromEntries(VIEWS.map(t=>[t,db.prepare(`SELECT * FROM ${t} WHERE run_id=?`).all(runId)]))};},
    async snapshot(runId){const dir=await mkdtemp(join(tmpdir(),'market-metro-export-'));let copy;
      try{const data=this.export(runId);copy=createMarketStore(join(dir,'market.sqlite'));copy.transaction(()=>{for(const t of TABLES)copy.insert(t,data.tables[t]);});copy.close();copy=null;return await readFile(join(dir,'market.sqlite'));}
      finally{copy?.close();await rm(dir,{recursive:true,force:true});}
    },
    close(){db.close();},
  };
}
export function csv(data){const cell=v=>{let s=v===null||v===undefined?'':String(v);if(typeof v==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};return [data.columns,...data.rows.map(r=>data.columns.map(c=>r[c]))].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';}
