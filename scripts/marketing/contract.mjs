// Public, observed inputs only. Latent simulator traits must never enter training.
export const FEATURES = ['recency_days','purchases_7d','organic_14d','visits_7d','spend_7d','offers_7d','redemptions_14d','price_cents','stock_available','rival_sale','payday'];
export const LEARNING_TABLES = ['business_goals','campaign_assignments','coupons','coupon_redemptions','customer_days','model_runs','model_scores','team_decisions','retention_results','policy_comparisons'];
export const LEARNING_VIEWS = ['v_coupon_journey','v_learning_daily','v_model_history','v_retention_experiments'];
export const LEARNING_DICTIONARY = {
  business_goals:'Operator objective and simulated budget. Discounts reduce sale proceeds; only outreach is additionally subtracted from contribution.',
  campaign_assignments:'Persistent randomized treatment eligibility versus holdout. Assignment precedes outcomes; non-targeted treatment customers remain in the denominator.',
  coupons:'Merchant-funded, one-day, single-customer and single-product offers. No real retailer coupons are issued.',
  coupon_redemptions:'One redemption per coupon, linked to the actual simulated order and discount.',
  customer_days:'Pre-action observed features followed by that day’s offer and purchase outcome. Hidden preferences are excluded.',
  model_runs:'Real CPU training runs, chronological validation, dataset hash, candidate metrics and portable fitted artifacts.',
  model_scores:'Model-versioned purchase probabilities under 0%, 5% and 10% offers. These are our predictions, not Channel3 customer scores.',
  team_decisions:'Scripted team decisions with measured evidence, selected actions and explicit reasons. No LLM is used.',
  retention_results:'Mature 14-day randomized intent-to-treat outcomes among customers active at assignment; includes uncertainty and signed lift.',
  policy_comparisons:'Matched-world comparisons under the same seed, catalog and shocks. Simulation evidence only.',
  v_coupon_journey:'Coupon → customer → merchant → Channel3 product → redemption → order → simulated payment.',
  v_learning_daily:'Observed daily activity and live campaign outcomes, including offer cost and recorded purchase labels.',
  v_model_history:'Model training and promotion history; real local CPU runtimes and validation losses.',
  v_retention_experiments:'Randomized treatment/control retention rates. An estimate of aggregate prevented inactivity, never an individual saved-customer claim.'
};
export const LEARNING_SCHEMA = [
  'CREATE TABLE IF NOT EXISTS business_goals (goal_id TEXT PRIMARY KEY,run_id TEXT UNIQUE REFERENCES simulation_runs(run_id),objective TEXT,question TEXT,budget_cents INTEGER,min_margin_pct REAL,contact_gap_days INTEGER,history_days INTEGER,followup_days INTEGER,policy TEXT,scenario TEXT,source TEXT);',
  'CREATE TABLE IF NOT EXISTS campaign_assignments (assignment_id TEXT PRIMARY KEY,run_id TEXT REFERENCES simulation_runs(run_id),campaign_id TEXT REFERENCES campaigns(campaign_id),customer_id TEXT REFERENCES customers(customer_id),assigned_day INTEGER,arm TEXT,propensity REAL,eligible INTEGER,source TEXT);',
  'CREATE TABLE IF NOT EXISTS coupons (coupon_id TEXT PRIMARY KEY,run_id TEXT REFERENCES simulation_runs(run_id),campaign_id TEXT REFERENCES campaigns(campaign_id),assignment_id TEXT REFERENCES campaign_assignments(assignment_id),customer_id TEXT REFERENCES customers(customer_id),merchant_id TEXT REFERENCES merchants(merchant_id),product_id TEXT REFERENCES products(product_id),issued_day INTEGER,expires_day INTEGER,discount_pct INTEGER,max_discount_cents INTEGER,model_id TEXT,reason TEXT,source TEXT);',
  'CREATE TABLE IF NOT EXISTS coupon_redemptions (redemption_id TEXT PRIMARY KEY,run_id TEXT REFERENCES simulation_runs(run_id),coupon_id TEXT UNIQUE REFERENCES coupons(coupon_id),order_id TEXT UNIQUE REFERENCES orders(order_id),customer_id TEXT REFERENCES customers(customer_id),event_date TEXT,discount_cents INTEGER,source TEXT);',
  'CREATE TABLE IF NOT EXISTS customer_days (observation_id TEXT PRIMARY KEY,run_id TEXT REFERENCES simulation_runs(run_id),customer_id TEXT REFERENCES customers(customer_id),day INTEGER,event_date TEXT,phase TEXT,product_id TEXT REFERENCES products(product_id),recency_days REAL,purchases_7d REAL,organic_14d REAL,visits_7d REAL,spend_7d REAL,offers_7d REAL,redemptions_14d REAL,price_cents REAL,stock_available REAL,rival_sale REAL,payday REAL,offered_pct INTEGER,assignment_probability REAL,visited INTEGER,purchased INTEGER,redeemed INTEGER,gross_cents INTEGER,discount_cents INTEGER,contribution_cents INTEGER,source TEXT);',
  'CREATE TABLE IF NOT EXISTS model_runs (model_id TEXT PRIMARY KEY,run_id TEXT REFERENCES simulation_runs(run_id),day INTEGER,version INTEGER,status TEXT,reason TEXT,model_type TEXT,features_json TEXT,dataset_hash TEXT,training_rows INTEGER,validation_rows INTEGER,train_through_day INTEGER,validation_from_day INTEGER,validation_through_day INTEGER,validation_log_loss REAL,baseline_log_loss REAL,champion_log_loss REAL,brier_score REAL,candidates_json TEXT,artifact_json TEXT,runtime_ms INTEGER,source TEXT);',
  'CREATE TABLE IF NOT EXISTS model_scores (score_id TEXT PRIMARY KEY,run_id TEXT REFERENCES simulation_runs(run_id),customer_id TEXT REFERENCES customers(customer_id),product_id TEXT REFERENCES products(product_id),day INTEGER,model_id TEXT REFERENCES model_runs(model_id),p_no_offer REAL,p_five REAL,p_ten REAL,chosen_pct INTEGER,expected_gain_cents REAL,source TEXT);',
  'CREATE TABLE IF NOT EXISTS team_decisions (decision_id TEXT PRIMARY KEY,run_id TEXT REFERENCES simulation_runs(run_id),day INTEGER,role TEXT,action TEXT,message TEXT,evidence_json TEXT,status TEXT,source TEXT);',
  'CREATE TABLE IF NOT EXISTS retention_results (result_id TEXT PRIMARY KEY,run_id TEXT REFERENCES simulation_runs(run_id),campaign_id TEXT REFERENCES campaigns(campaign_id),window_start INTEGER,window_end INTEGER,status TEXT,treatment_n INTEGER,control_n INTEGER,treatment_inactive INTEGER,control_inactive INTEGER,treatment_rate REAL,control_rate REAL,lift REAL,ci_low REAL,ci_high REAL,estimated_prevented REAL,source TEXT);',
  'CREATE TABLE IF NOT EXISTS policy_comparisons (comparison_id TEXT PRIMARY KEY,run_id TEXT REFERENCES simulation_runs(run_id),policy TEXT,compared_run_id TEXT,seed INTEGER,purchases INTEGER,gross_cents INTEGER,contribution_cents INTEGER,coupon_cost_cents INTEGER,outreach_cents INTEGER,redemptions INTEGER,model_trains INTEGER,source TEXT);',
  'CREATE INDEX IF NOT EXISTS customer_days_training ON customer_days(run_id,day);',
  'CREATE INDEX IF NOT EXISTS learning_scores_run ON model_scores(run_id,day);',
  'CREATE INDEX IF NOT EXISTS learning_coupon_run ON coupons(run_id,issued_day);',
  'CREATE INDEX IF NOT EXISTS learning_decisions_run ON team_decisions(run_id,day);',
  'CREATE VIEW IF NOT EXISTS v_coupon_journey AS SELECT c.run_id,c.coupon_id,c.issued_day,c.customer_id,c.merchant_id,m.name AS merchant_name,c.campaign_id,c.product_id,p.channel3_product_id,p.title,c.discount_pct,c.model_id,c.reason,r.order_id,r.discount_cents,t.transaction_id,t.gross_cents,t.fee_cents,t.net_cents,CASE WHEN r.order_id IS NULL THEN \'EXPIRED_UNUSED\' ELSE \'REDEEMED\' END AS outcome,c.source FROM coupons c JOIN products p USING(product_id) JOIN merchants m ON m.merchant_id=c.merchant_id LEFT JOIN coupon_redemptions r USING(coupon_id) LEFT JOIN transactions t ON t.order_id=r.order_id;',
  'CREATE VIEW IF NOT EXISTS v_learning_daily AS SELECT run_id,day,event_date,phase,COUNT(*) AS observations,SUM(visited) AS visits,SUM(purchased) AS purchases,SUM(CASE WHEN offered_pct>0 THEN 1 ELSE 0 END) AS targeted,SUM(redeemed) AS redemptions,SUM(gross_cents) AS gross_cents,SUM(discount_cents) AS discount_cents,SUM(contribution_cents) AS contribution_cents FROM customer_days GROUP BY run_id,day,event_date,phase;',
  'CREATE VIEW IF NOT EXISTS v_model_history AS SELECT run_id,model_id,day,version,status,model_type,training_rows,validation_rows,validation_log_loss,baseline_log_loss,champion_log_loss,brier_score,runtime_ms,reason FROM model_runs;',
  'CREATE VIEW IF NOT EXISTS v_retention_experiments AS SELECT run_id,campaign_id,window_start,window_end,status,treatment_n,control_n,treatment_inactive,control_inactive,treatment_rate,control_rate,lift,ci_low,ci_high,estimated_prevented FROM retention_results;'
].join('\n');

export function modelVector(features,offer) {
  const base=FEATURES.map(k=>Number(features[k]||0));
  return [...base,offer/10,...base.map(x=>x*offer/10)];
}
export function predict(artifact,features,offer) {
  if(!artifact)return null;
  const x=modelVector(features,offer);
  if(artifact.type==='logistic'){
    let z=artifact.intercept;
    for(let j=0;j<x.length;j++)z+=artifact.coef[j]*(x[j]-artifact.mean[j])/artifact.scale[j];
    return 1/(1+Math.exp(-Math.max(-40,Math.min(40,z))));
  }
  let node=0;
  while(artifact.left[node]!==-1)node=x[artifact.feature[node]]<=artifact.threshold[node]?artifact.left[node]:artifact.right[node];
  return artifact.probability[node];
}
