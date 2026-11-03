import {createHash,randomUUID} from 'node:crypto';
import {createWorld,stepWorld,frame,outcome} from '../behavior-v4/engine.mjs';
import {authoredCatalog} from '../behavior-v4/catalog.mjs';
import {train,publicEvidence,compilePolicy,POLICIES} from '../behavior-v4/policies.mjs';
import {openTeamVertex} from '../agent-mesh/model-client.mjs';
import {SandboxError} from '../paypal-sandbox.mjs';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const ids=POLICIES.map(p=>p.id),label=id=>POLICIES.find(p=>p.id===id)?.label||id;
const tables=['orders','order_items','transactions','refunds','deliveries','inventory_movements','campaign_spend','events','coupons','coupon_redemptions','customer_days','behavior_actions','behavior_lifecycle','behavior_outside','behavior_daily'];
export function createCommerceRoom({store,market,clientFactory=openTeamVertex,benchmark=null}){
 const db=store.db,active=new Map();let closing=false;
 db.exec(`CREATE TABLE IF NOT EXISTS commerce_room_runs(id TEXT PRIMARY KEY,request_id TEXT UNIQUE,run_id TEXT UNIQUE REFERENCES simulation_runs(run_id),status TEXT,state_json TEXT,created_at TEXT);
 CREATE TABLE IF NOT EXISTS commerce_room_steps(id TEXT PRIMARY KEY,session_id TEXT REFERENCES commerce_room_runs(id),role TEXT,actor TEXT,status TEXT,started_day INTEGER,finished_day INTEGER,input_json TEXT,output_json TEXT,cost_micros INTEGER,provider_json TEXT,created_at TEXT,finished_at TEXT);
 CREATE TABLE IF NOT EXISTS commerce_room_frames(run_id TEXT,day INTEGER,frame_json TEXT,PRIMARY KEY(run_id,day));`);
 const load=id=>{const r=db.prepare('SELECT * FROM commerce_room_runs WHERE id=?').get(id);if(!r)throw new SandboxError(404,'COMMERCE_RUN_NOT_FOUND','Start a commerce run first.');return {s:JSON.parse(r.state_json),w:store.state(r.run_id)};};
 const save=r=>{store.saveState(r.w);db.prepare('UPDATE commerce_room_runs SET status=?,state_json=? WHERE id=?').run(r.s.status,JSON.stringify(r.s),r.s.id);};
 const day=r=>Math.min(r.w.totalTicks,Math.max(1,r.w.tick+1));
 function begin(r,role,actor,input,id=randomUUID()){
  db.prepare('INSERT INTO commerce_room_steps VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,r.s.id,role,actor,'RUNNING',day(r),null,JSON.stringify(input),null,0,null,new Date().toISOString(),null);return id;
 }
 function finish(r,id,output,status='COMPLETED',events=[]){
  const cost=events.reduce((n,e)=>n+(e.modelCostMicros??e.reservedMicros??0),0);r.s.costMicros+=cost;
  db.prepare('UPDATE commerce_room_steps SET status=?,finished_day=?,output_json=?,cost_micros=?,provider_json=?,finished_at=? WHERE id=?').run(status,day(r),JSON.stringify(output),cost,JSON.stringify(events),new Date().toISOString(),id);save(r);
 }
 const note=(r,role,title,body,input={})=>{const id=begin(r,role,'LOCAL_TOOL',input);finish(r,id,{title,body});return id;};
 function fit(r,reason){
  if(r.w.behavior.models.some(m=>m.cutoff===r.w.tick))return r.w.behavior.models.at(-1);
  const id=begin(r,'Scientist','LOCAL_MODEL',{cutoff:r.w.tick,reason}),m=train(r.w);
  store.insert('recommendation_models',[{model_id:m.id,run_id:r.w.runId,day:m.cutoff,model_type:m.type,training_rows:m.trainingRows,validation_purchases:m.validationPurchases,validation_from_day:m.split,candidate_recall:m.candidateRecall,baseline_recall:m.baselineRecall,dataset_hash:m.datasetHash,runtime_ms:m.runtimeMs,reason:m.reason,artifact_json:JSON.stringify(m.artifact),source:'LOCAL_COUNT_MODEL'}]);
  finish(r,id,{title:'Recommender fitted',body:`${m.trainingRows} training rows. Recall@3 ${(m.candidateRecall*100).toFixed(1)}% vs ${(m.baselineRecall*100).toFixed(1)}% popularity.`,modelId:m.id,type:m.type,reason});return m;
 }
 function evidence(r){const observed=publicEvidence(r.w),e={goal:r.s.goal,observed,activeProgram:r.s.policy,programs:POLICIES,...(benchmark?.development?{developmentResults:benchmark.development}:{}),operatingContext:{warmupDays:30,shopperType:'SIMULATED',realFunds:false,payment:benchmark?'Payment effects are simulated in this evaluation; native APIs are disabled.':'At most one selected campaign order is mirrored to the saved PayPal Sandbox buyer; it is not additional sales.',constraints:'At most 5% coupon for eligible lapsed buyers, observed interests, stock and merchant margin guards, $50 virtual budget. No campaign ROI has been established.',publicPriceSignal:r.w.scenario==='rival_sale'&&r.w.tick>=35?'A rival sale was observed beginning on day 36.':'No rival sale observed.'}};return {...e,evidenceId:'EVID-'+sha(e).slice(0,20)};}
 async function ask(r,role,tool,packet,properties){
  const id=begin(r,role,'GEMINI',packet);r.s.calls++;save(r);let client,events=[];
  try{if(r.s.calls>5)throw Error('RUN_CALL_LIMIT');client=await clientFactory(r.s.id,{route:'hybrid'});
   const system=`You are the ${role} in Market Metro's commerce team. Use only the supplied observed data, goal, model validation and prior handoff. Choose a useful bounded exploratory marketing action. Shoppers and economics are simulated. Do not claim causal profit or infer hidden preferences. Recommendations and coupons are real actions in this simulation; PayPal Sandbox is test funds. A review may keep, change or stop a campaign. Explain your decision in one short sentence. Stock, budget, frequency and margin controls are enforced by trusted code. Never output SQL, code, credentials or payment amounts. Copy the evidenceId.`;
   const response=await client.client.json(system,packet,{caseId:id,trialId:r.s.id,functions:[{name:tool,description:'Commit this role’s bounded decision.',parameters:{type:'OBJECT',properties,required:Object.keys(properties)}}]});events=client.client.events;const o=response?.args;
   if(response?.name!==tool||!o||o.evidenceId!==packet.evidenceId||typeof o.rationale!=='string'||o.rationale.length>800)throw Error('INVALID_AGENT_DECISION');
   if(o.policyId&&!ids.includes(o.policyId))throw Error('INVALID_CAMPAIGN_PROGRAM');
   if(tool==='propose_policy'&&(typeof o.retrain!=='boolean'||typeof o.name!=='string'||o.name.length>65))throw Error('INVALID_CAMPAIGN_PLAN');
   if(tool==='review_policy'&&!['approve','revise'].includes(o.decision))throw Error('INVALID_REVIEW');
   finish(r,id,o,'COMPLETED',events);return {...o,checkpointId:id};
  }catch(e){finish(r,id,{title:role+' stopped',body:e.message},'FAILED',client?.client.events||events);throw e;}finally{await client?.close();}
 }
 async function review(r,round){
  r.s.pending=true;r.s.rounds=round;save(r);
  try{let packet=evidence(r),analysis=null;
   if(round===1)analysis=await ask(r,'Analyst','analyse_commerce',packet,{finding:{type:'STRING'},rationale:{type:'STRING'},evidenceId:{type:'STRING',enum:[packet.evidenceId]}});
   packet={...evidence(r),...(analysis?{analyst:analysis}:{}),reviewReason:round===1?'Choose our first campaign.':'Review new shopping data after the rival sale. Keep, change or stop the campaign.'};
   const proposal=await ask(r,'Strategist','propose_policy',packet,{policyId:{type:'STRING',enum:ids},name:{type:'STRING'},retrain:{type:'BOOLEAN'},rationale:{type:'STRING'},evidenceId:{type:'STRING',enum:[packet.evidenceId]}});
   if(proposal.retrain&&r.w.tick<90)fit(r,'Strategist requested a refresh before review');
   packet={...evidence(r),proposal};
   const reviewed=await ask(r,'Reviewer','review_policy',packet,{decision:{type:'STRING',enum:['approve','revise']},policyId:{type:'STRING',enum:ids},rationale:{type:'STRING'},evidenceId:{type:'STRING',enum:[packet.evidenceId]}});
   if(r.w.tick>=90)throw Error('The campaign window ended before review completed.');
   const previous=r.s.policy;r.s.policy=reviewed.policyId;r.s.campaignName=proposal.policyId===reviewed.policyId?proposal.name:label(reviewed.policyId);r.s.firstLaunch??=r.w.tick;
   r.s.campaigns.push({day:day(r),policy:r.s.policy,name:r.s.campaignName,proposalId:proposal.checkpointId,reviewId:reviewed.checkpointId,evidenceId:reviewed.evidenceId});
   note(r,'Publisher',previous===r.s.policy?'Campaign retained':'Campaign published',`${r.s.campaignName}. ${r.s.policy==='none'?'Outreach stopped.':'Eligible shoppers now receive the approved program.'}`,{previous,policy:r.s.policy,review:reviewed.checkpointId,asOf:packet.observed.asOfDay,effectiveDay:day(r)});
  }catch(e){r.s.warning=e.message;r.s.reviewBlocked=true;note(r,'Coordinator','Review needs attention',e.message);}finally{r.s.pending=false;save(r);}
 }
 function saveFrame(r){const f=frame(r.w);f.models=[];f.team=[];f.retention=[];f.daily=[];f.products=undefined;f.customers=f.customers.map(c=>({...c,history:undefined,scores:undefined}));
  for(const u of f.customers){const a=[...f.activities].reverse().find(a=>a.customerId===u.id&&a.merchantId);if(a){u.lastMerchant=a.merchantId;if(a.type==='visit'&&u.lastAction==='home')u.lastAction='browse';}}
  db.prepare('INSERT OR REPLACE INTO commerce_room_frames VALUES(?,?,?)').run(r.w.runId,r.w.tick,JSON.stringify(f));
 }
 async function settle(r){
  r.s.nativeDay=r.w.totalTicks;save(r);
  if(!r.s.sandbox){note(r,'PayPal','Sandbox sample disabled','Orders remain in the modeled ledger.');return;}
  const picked=db.prepare(`SELECT o.order_id,o.total_cents,a.kind FROM behavior_actions a JOIN orders o ON o.order_id=a.order_id LEFT JOIN refunds f ON f.order_id=o.order_id WHERE a.run_id=? AND a.day>=30 AND a.kind<>'none' AND f.refund_id IS NULL AND o.total_cents BETWEEN 1 AND 10000 ORDER BY (a.kind='coupon') DESC,o.total_cents,o.event_ts LIMIT 1`).get(r.w.runId);
  if(!picked){note(r,'PayPal','No eligible campaign purchase','No purchase was forced for the payment sample.');return;}
  const id=begin(r,'PayPal','PAYPAL_SANDBOX',{orderId:picked.order_id,amountCents:picked.total_cents,limitCents:10000});
  try{if(db.prepare("SELECT COUNT(*) n FROM paypal_receipts WHERE status='QUEUED' AND run_id<>?").get(r.w.runId).n)throw Error('Another sandbox batch is queued; this sample is held.');await market.mirror(r.w.runId,[picked.order_id]);const p=store.table('paypal_receipts',r.w.runId).rows.find(p=>p.order_id===picked.order_id);if(p?.status!=='COMPLETED')throw Error(p?.error_code||p?.status||'Capture not verified');
   finish(r,id,{title:'Sandbox receipt verified',body:`$${(p.gross_cents/100).toFixed(2)} test purchase · ${p.fee_cents===null?'fee not returned':'$'+(p.fee_cents/100).toFixed(2)+' provider fee'}.`,orderId:p.order_id,captureId:p.capture_id,feeCents:p.fee_cents,grossCents:p.gross_cents,netCents:p.net_cents});
  }catch(e){r.s.warning=e.message;finish(r,id,{title:'Sandbox needs attention',body:e.message,orderId:picked.order_id},'FAILED');}
 }
 async function pump(r){
  if(closing)return;
  try{
   if(r.w.tick>=r.w.totalTicks){if(r.s.pending){r.timer=setTimeout(()=>pump(r),500);return;}r.s.status='SETTLING';save(r);await settle(r);r.s.status=r.s.warning?'ATTENTION':'COMPLETED';note(r,'Coordinator','Run complete',`${r.w.stats.orders} orders recorded. All decisions and payment references are saved.`,outcome(r.w));save(r);active.delete(r.s.id);return;}
   if(r.w.tick>=30&&r.w.tick<90&&(r.w.tick-30)%14===0)fit(r,'Scheduled local validation on completed data');
   if(r.w.tick>=30&&!r.s.rounds){r.job=review(r,1);}
   else if(r.w.tick>=60&&r.s.rounds===1&&!r.s.pending&&!r.s.reviewBlocked){r.job=review(r,2);}
   // Controlled evaluations hold virtual time at decision boundaries. The live UI keeps trading.
   if(benchmark&&r.s.pending){r.timer=setTimeout(()=>pump(r),100);return;}
   if(r.w.scenario==='rival_sale'&&r.w.tick===35)note(r,'Market','Rival sale started','The price environment changed. Shoppers continue trading.');
   const chooser=r.w.tick>=30&&r.w.tick<90?compilePolicy(r.w,r.s.policy):()=>null,b=stepWorld(r.w,chooser);
   store.transaction(()=>{for(const t of tables)if(b.rows[t]?.length)store.insert(t,b.rows[t]);store.saveState(r.w);});save(r);saveFrame(r);
   r.timer=setTimeout(()=>pump(r),benchmark?1:r.s.pending?1000:r.w.tick<30?150:r.w.tick>=90?120:350);
  }catch(e){r.s.status='ATTENTION';r.s.warning=e.message;save(r);active.delete(r.s.id);}
 }
 function snapshot(id,at){const {s,w}=load(id),max=w.tick,d=at==null?max:Math.max(0,Math.min(max,Math.trunc(Number(at)||0))),f=db.prepare('SELECT frame_json FROM commerce_room_frames WHERE run_id=? AND day=?').get(w.runId,d),end=new Date(Date.parse(w.startedAt)+d*86400000).toISOString();
  const steps=db.prepare('SELECT * FROM commerce_room_steps WHERE session_id=? ORDER BY rowid').all(id).filter(x=>x.started_day<=Math.max(1,d)).map(x=>{const complete=x.finished_day!==null&&x.finished_day<=Math.max(1,d);return {id:x.id,role:x.role,actor:x.actor,status:complete?x.status:'RUNNING',day:x.started_day,finishedDay:complete?x.finished_day:null,input:JSON.parse(x.input_json),output:complete?JSON.parse(x.output_json):null,costMicros:complete?x.cost_micros:0,provider:complete?JSON.parse(x.provider_json||'[]'):[]};});
  const orders=db.prepare(`SELECT o.order_id,o.customer_id,o.event_ts,o.event_date,o.total_cents,o.discount_cents,m.name merchant,p.title product,t.transaction_id,t.fee_cents,a.kind contact,a.reason FROM orders o JOIN merchants m USING(merchant_id) JOIN order_items i USING(order_id) JOIN products p USING(product_id) JOIN transactions t USING(order_id) LEFT JOIN behavior_actions a ON a.order_id=o.order_id WHERE o.run_id=? AND o.event_ts<? ORDER BY o.event_ts DESC,o.rowid DESC LIMIT 16`).all(w.runId,end);
  const campaigns=s.campaigns.filter(c=>c.day<=Math.max(1,d)),receipts=s.nativeDay&&d>=s.nativeDay?store.table('paypal_receipts',w.runId).rows:[];let paymentJourney=null;
  if(receipts[0]){const j=db.prepare('SELECT a.day,a.kind,o.customer_id,o.discount_cents,p.title product,offer.title offeredProduct FROM orders o JOIN order_items i USING(order_id) JOIN products p USING(product_id) LEFT JOIN behavior_actions a ON a.order_id=o.order_id LEFT JOIN products offer ON offer.product_id=a.product_id WHERE o.order_id=?').get(receipts[0].order_id);if(j)paymentJourney={product:j.product,offeredProduct:j.offeredProduct,discountCents:j.discount_cents,customerId:j.customer_id,customerName:w.customers.find(c=>c.customer_id===j.customer_id)?.name,action:j.kind,actionDay:j.day+1,campaignName:s.campaigns.filter(c=>c.day<=j.day+1).at(-1)?.name};}
  const redemptions=db.prepare('SELECT o.order_id,o.customer_id,o.total_cents,o.discount_cents,c.discount_pct,p.title product FROM coupon_redemptions cr JOIN orders o USING(order_id) JOIN coupons c USING(coupon_id) JOIN products p ON p.product_id=c.product_id WHERE o.run_id=? AND o.event_ts<? ORDER BY o.event_ts DESC LIMIT 3').all(w.runId,end).map(x=>({...x,customerName:w.customers.find(c=>c.customer_id===x.customer_id)?.name}));
  return {id,runId:w.runId,status:s.status,warning:s.warning||null,settings:{seed:s.seed,goal:s.goal,sandbox:s.sandbox,modelCapUSD:.25},day:d,liveDay:max,totalDays:w.totalTicks,replay:d<max,frame:f?JSON.parse(f.frame_json):null,steps,orders,redemptions,campaigns,costMicros:steps.reduce((n,x)=>n+x.costMicros,0),modelCalls:steps.filter(x=>x.actor==='GEMINI').length,receipts,paymentJourney,latestCampaign:campaigns.at(-1)||null};
 }
 return {snapshot,preview(){return frame(createWorld({runId:'COMMERCE-PREVIEW',seed:150001,catalog:authoredCatalog(),customers:100,days:100,campaignStop:90,scenario:'rival_sale'}));},latest(){const r=db.prepare('SELECT id FROM commerce_room_runs ORDER BY created_at DESC LIMIT 1').get();return r?snapshot(r.id):null;},start(input){
  if(Object.keys(input).some(k=>!['requestId','seed','sandbox'].includes(k))||typeof input.requestId!=='string'||input.requestId.length<8||input.requestId.length>100||!Number.isSafeInteger(input.seed)||input.seed<0||input.seed>4294967295||typeof input.sandbox!=='boolean')throw new SandboxError(400,'INVALID_COMMERCE_SETTINGS','Use a seed and a unique request ID.');
  if(benchmark&&input.sandbox)throw new SandboxError(400,'BENCHMARK_NO_PAYMENTS','Native payments are disabled in evaluations.');
  const existing=db.prepare('SELECT id,state_json FROM commerce_room_runs WHERE request_id=?').get(input.requestId);if(existing){const old=JSON.parse(existing.state_json);if(old.seed!==input.seed||old.sandbox!==input.sandbox)throw new SandboxError(409,'REQUEST_CONFLICT','This request belongs to different settings.');return snapshot(existing.id);}
  if(active.size)throw new SandboxError(409,'COMMERCE_RUNNING','A commerce run is already in progress.');
  const key=sha(input).slice(0,16),id='COMMERCE-'+key,runId='GARDEN-OWN-'+key,w=createWorld({runId,seed:input.seed,catalog:authoredCatalog(),customers:100,days:100,campaignStop:90,scenario:benchmark?.scenario||'rival_sale',budgetCents:5000});w.commerceWorkflow=true;
  const s={id,runId,seed:input.seed,sandbox:input.sandbox,status:'RUNNING',goal:benchmark?.goal||'Reactivate lapsed shoppers with recent browsing interest while protecting merchant margin and controlling discount cost.',rounds:0,pending:false,policy:'none',campaigns:[],costMicros:0,calls:0};
  store.create(w);db.prepare('INSERT INTO commerce_room_runs VALUES(?,?,?,?,?,?)').run(id,input.requestId,runId,s.status,JSON.stringify(s),new Date().toISOString());const r={s,w};active.set(id,r);note(r,'Coordinator','Market opened','Collect 30 days, fit a local model, then let the team choose a campaign.');saveFrame(r);r.timer=setTimeout(()=>pump(r),150);return snapshot(id);
 },recover(){for(const row of db.prepare("SELECT id FROM commerce_room_runs WHERE status IN ('RUNNING','SETTLING')").all()){const r=load(row.id);r.s.status='INTERRUPTED';r.s.warning='Server restarted. Saved checkpoints are retained; uncertain provider requests will not be repeated automatically.';save(r);}},async close(){closing=true;for(const r of active.values())clearTimeout(r.timer);await Promise.allSettled([...active.values()].map(r=>r.job));for(const r of active.values()){r.s.status='INTERRUPTED';save(r);}active.clear();}};
}
