export const WORKFLOW_TABLES=['agent_workflows','agent_checkpoints','campaign_plans','campaign_customer_decisions','planner_sessions','planner_turns'];
export const WORKFLOW_DICTIONARY={
  agent_workflows:'Durable campaign missions and workflow state. Planner attribution distinguishes current-chat decisions from scripted demo coordination; tools execute locally.',
  agent_checkpoints:'Idempotent tool requests, planner rationale, evidence references, attempts, status and saved outputs.',
  campaign_plans:'Validated, versioned campaign specifications tied to real locally fitted models and bounded simulation budgets.',
  campaign_customer_decisions:'One recorded decision per shopper and campaign day: observed inputs, model scores, inclusion/exclusion reason, coupon and model lineage.',
  planner_sessions:'App-owned autonomous planner status and immutable per-campaign model-spend allowance. No credentials.',
  planner_turns:'Persisted model inputs, public decisions, validated requests, provider token receipts and execution outcomes. Saved proposals resume without another inference call.'
};
export const WORKFLOW_SCHEMA=`
CREATE TABLE IF NOT EXISTS agent_workflows (workflow_id TEXT PRIMARY KEY,run_id TEXT UNIQUE REFERENCES simulation_runs(run_id),request_id TEXT UNIQUE,goal_hash TEXT,state_json TEXT,created_at TEXT,updated_at TEXT);
CREATE TABLE IF NOT EXISTS agent_checkpoints (checkpoint_id TEXT PRIMARY KEY,workflow_id TEXT REFERENCES agent_workflows(workflow_id),run_id TEXT REFERENCES simulation_runs(run_id),request_id TEXT,input_hash TEXT,action TEXT,actor TEXT,status TEXT,attempts INTEGER,input_json TEXT,output_json TEXT,error_json TEXT,started_at TEXT,finished_at TEXT,UNIQUE(workflow_id,request_id));
CREATE TABLE IF NOT EXISTS campaign_plans (plan_id TEXT PRIMARY KEY,workflow_id TEXT REFERENCES agent_workflows(workflow_id),run_id TEXT REFERENCES simulation_runs(run_id),version INTEGER,model_id TEXT REFERENCES model_runs(model_id),status TEXT,plan_json TEXT,created_at TEXT,launched_at TEXT);
CREATE TABLE IF NOT EXISTS campaign_customer_decisions (decision_id TEXT PRIMARY KEY,workflow_id TEXT REFERENCES agent_workflows(workflow_id),run_id TEXT REFERENCES simulation_runs(run_id),plan_id TEXT REFERENCES campaign_plans(plan_id),customer_id TEXT REFERENCES customers(customer_id),product_id TEXT REFERENCES products(product_id),merchant_id TEXT REFERENCES merchants(merchant_id),day INTEGER,arm TEXT,model_id TEXT REFERENCES model_runs(model_id),eligibility TEXT,reason TEXT,p_no_offer REAL,p_five REAL,p_ten REAL,proposed_pct INTEGER,issued_pct INTEGER,coupon_id TEXT REFERENCES coupons(coupon_id),features_json TEXT,UNIQUE(workflow_id,customer_id,day));
CREATE INDEX IF NOT EXISTS campaign_trace_customer ON campaign_customer_decisions(workflow_id,customer_id,day);
CREATE TABLE IF NOT EXISTS planner_sessions (workflow_id TEXT PRIMARY KEY REFERENCES agent_workflows(workflow_id),run_id TEXT REFERENCES simulation_runs(run_id),model TEXT,status TEXT,spend_cap_micros INTEGER,state_json TEXT,created_at TEXT,updated_at TEXT);
CREATE TABLE IF NOT EXISTS planner_turns (turn_id TEXT PRIMARY KEY,workflow_id TEXT REFERENCES agent_workflows(workflow_id),run_id TEXT REFERENCES simulation_runs(run_id),turn_index INTEGER,status TEXT,input_json TEXT,decision_json TEXT,request_json TEXT,provider_json TEXT,error_json TEXT,checkpoint_id TEXT,started_at TEXT,finished_at TEXT,UNIQUE(workflow_id,turn_index));
`;
