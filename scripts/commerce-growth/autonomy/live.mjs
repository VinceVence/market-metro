import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {SandboxError} from '../../paypal-sandbox.mjs';
import {createGrowthWorld,beginGrowthDay,endGrowthDay,observeGrowthWorld,contactCustomer,assertGrowthIntegrity,CONTRACT,digest} from '../environment.mjs';
import {commerceTurn} from '../evaluate.mjs';
import {fulfill} from '../team/control.mjs';
import {runCoordinatedCase} from '../team/runner.mjs';
import {balances,settledPlatformNet} from '../../commerce-deadlines/evaluate.mjs';
import {openAllocator} from '../../commerce-deadlines/solver.mjs';
import {openAutonomousCommerce} from './controller.mjs';
import {openCommerceHarnessV2} from '../../commerce-expanded/harness-v2/controller.mjs';
import {plannerMappings,withPlannerFeed} from '../../ontology/planner-gate.mjs';
import {llmTrainingAdvisor as ontologyTrainingAdvisor} from '../../ontology/planner-training.mjs';
import {openSavedPolicy} from '../../ontology/saved-policy.mjs';
import {runOntology} from '../../ontology/run-evidence.mjs';
import {evaluateFundingPredictions} from './funding-calibration.mjs';
import {projection,marketFrame,warehouseBatch,key,stamp} from './live-data.mjs';
import * as expandedEnvironment from '../../commerce-expanded/environment.mjs';
import * as expandedCommerce from '../../commerce-expanded/commerce.mjs';
import {runCoordinatedCase as runExpandedControl} from '../../commerce-expanded/runner.mjs';
const legacyEngine={createGrowthWorld,beginGrowthDay,endGrowthDay,observeGrowthWorld,contactCustomer,assertGrowthIntegrity,commerceTurn,fulfill,runCoordinatedCase};
const expandedEngine={...expandedEnvironment,...expandedCommerce,runCoordinatedCase:runExpandedControl};
const engineFor=s=>s.marketProfile==='expanded-12x600'?expandedEngine:legacyEngine;

export function createAutonomyRoom({store,market,providerFactory,rootDir=resolve('.local/commerce-autonomy'),autoPump=true,tickMs=1500,v2TrialFactory,v2ControllerFactory=openCommerceHarnessV2}={}){
 const db=store.db,active=new Map(),loadJSON=p=>JSON.parse(readFileSync(p,'utf8')),
  prior=loadJSON('docs/commerce-growth/team-1/training/model.json'),fixed=loadJSON('docs/commerce-growth/team-1/development/results.json').selectedFixed,
  core=loadJSON('docs/commerce-growth/development-1/protocol.json'),developmentEvidence=loadJSON('docs/commerce-growth/autonomy-1/policy-library-funding.json'),fundingPrior=loadJSON('docs/commerce-growth/autonomy-1/funding-training/funding-prior.json');let closing=false,starting=false;
 db.exec(`CREATE TABLE IF NOT EXISTS autonomy_sessions(id TEXT PRIMARY KEY,request_id TEXT UNIQUE,run_id TEXT UNIQUE REFERENCES simulation_runs(run_id),status TEXT,state_json TEXT,created_at TEXT);
 CREATE TABLE IF NOT EXISTS autonomy_frames(run_id TEXT REFERENCES simulation_runs(run_id),day INTEGER,frame_json TEXT,PRIMARY KEY(run_id,day));`);
 const get=id=>{const running=active.get(id);if(running)return running;const row=db.prepare('SELECT state_json FROM autonomy_sessions WHERE id=?').get(id);if(!row)throw new SandboxError(404,'AUTONOMY_NOT_FOUND','Start an autonomous run first.');return {...JSON.parse(row.state_json),team:null};};
 function persist(r,frame=null,cursor=r.s.cursor){const state={s:{...r.s,committedDay:frame?r.w.day:r.s.committedDay,cursor,team:r.team?.summary()||r.s.team},w:r.w};db.prepare('UPDATE autonomy_sessions SET status=?,state_json=? WHERE id=?').run(r.s.status,JSON.stringify(state),r.s.id);if(frame)db.prepare('INSERT OR REPLACE INTO autonomy_frames VALUES(?,?,?)').run(r.s.runId,r.w.day,JSON.stringify(frame));}
 function commit(r,proposal){
  const summary=r.team?.summary()||r.s.team,batch=warehouseBatch(r.w,r.s,proposal,summary),frame=marketFrame(r.w,r.s,summary),p=projection(r.w,r.s);p.autonomyFrame=frame;
  store.transaction(()=>{for(const [table,rows]of Object.entries(batch.rows))if(rows.length)store.insert(table,rows);
   for(const u of batch.updates)db.prepare('UPDATE orders SET status=? WHERE order_id=?').run(u.status,u.orderId);
   for(const o of r.w.orders)db.prepare('UPDATE autonomy_baskets SET status=? WHERE basket_id=?').run(o.refundStatus==='SETTLED'?'REFUNDED':o.status,key(r.s.runId,o.id));
   for(const i of r.w.supplierInvoices)db.prepare('UPDATE autonomy_supplier_payments SET status=?,fee_cents=?,processing_cents=? WHERE invoice_id=?').run(i.status,i.feeCents,i.processingCents,key(r.s.runId,i.id));
   store.saveState(p);persist(r,frame,batch.cursor);
  });r.s.cursor=batch.cursor;r.s.committedDay=r.w.day;r.s.team=summary;
 }
 async function step(id){
  const r=active.get(id);if(!r||r.s.status!=='RUNNING'||r.stepping)return;r.stepping=true;const before=structuredClone(r.w);let committed=false;const engine=engineFor(r.s);
  try{
   if(r.w.day===30){r.s.opening=balances(r.w);r.s.initialHash=digest(r.w);}
   engine.beginGrowthDay(r.w);let proposal=null;
   if(r.w.day<30)engine.commerceTurn(r.w,'shared-warmup');
   else{
    const view=engine.observeGrowthWorld(r.w);proposal=await r.team.plan(view);
    if(proposal.held){
     r.w=before;r.s.status='AWAITING_MAPPING';persist(r);return;
    }
    const copy=structuredClone(r.w);for(const [i,a]of proposal.actions.entries())engine.contactCustomer(copy,{...a,key:r.s.id+':contact:'+r.w.day+':'+i});Object.assign(r.w,copy);
    const activity=await engine.fulfill(r.w,proposal.configuration,r.allocator,r.s.id),summary=r.team.summary();
    r.w.decisions.push({day:r.w.day,policy:'AUTONOMOUS_COMMERCE',source:proposal.agentCampaign?'AGENT_CAMPAIGN':'FIXED_FALLBACK',agentCampaign:proposal.agentCampaign,model:proposal.model||null,ranking:proposal.ranking||[],reason:proposal.reason,contacts:proposal.actions,configuration:proposal.configuration,commerce:{captured:activity.captured,stockUnits:activity.stockUnits},agentReviewPending:summary.pending});
   }
   engine.endGrowthDay(r.w);engine.assertGrowthIntegrity(r.w);commit(r,proposal);committed=true;
   if(r.w.day>=r.w.totalDays)await finish(r);
  }catch(error){if(!committed)r.w=before;r.s.status='ATTENTION';r.s.warning=error.message;await r.team?.close();persist(r);r.allocator?.close();active.delete(id);}
  finally{r.stepping=false;}
 }
 async function finish(r){
  r.s.status='SETTLING';persist(r);await r.team.close();r.s.team=r.team.summary();commit(r,null);
  const closingBalances=balances(r.w),retained=r.w.orders.filter(o=>o.day>=30&&!['SETTLED','PENDING_FUNDS'].includes(o.refundStatus));
  r.s.result={platformUSD:settledPlatformNet(r.s.opening,closingBalances)/100-r.s.team.modelCostUSD,retailerUSD:Object.keys(closingBalances.merchant).reduce((sum,id)=>sum+closingBalances.merchant[id].equity-r.s.opening.merchant[id].equity,0)/100,retainedPurchases:retained.length,retainedVolumeUSD:retained.reduce((s,o)=>s+o.grossCents,0)/100,modelCostUSD:r.s.team.modelCostUSD,modelCalls:r.s.team.modelCalls,unpaidLiabilities:r.w.liabilities.filter(l=>l.status!=='SETTLED').length,marketVersion:r.w.version,merchants:r.w.merchants.length,shoppers:r.w.people.length,source:'SIMULATED_COMMERCE_AFTER_MODEL_COST'};
  // A single local comparator, not another model search. LLM latency is part
  // of this live run; the fixed policy is active while reviews are pending.
  const control=await engineFor(r.s).runCoordinatedCase({seed:r.s.seed,regime:r.s.regime},fixed,{allocator:r.allocator,prior});
  if(control.initialHash!==r.s.initialHash||control.opportunityHash!==r.w.growth.opportunityHash||control.consentHash!==r.w.growth.consentHash||control.incomeCents!==r.w.incomeCents)throw Error('LIVE_COMPARISON_INPUT_MISMATCH');
  r.s.result.normalized={platformPer100ShoppersUSD:r.s.result.platformUSD*100/r.w.people.length,retainedPurchasesPer100:r.s.result.retainedPurchases*100/r.w.people.length,merchantContributionPerMerchantUSD:r.s.result.retailerUSD/r.w.merchants.length};
  r.s.comparison={fixed:control,team:r.s.result,platformDeltaUSD:r.s.result.platformUSD-control.platformUSD,scope:'One paired live run at identical market size, need pool, consent and income; original benchmark unchanged. '+(r.s.harnessVersion==='v2'?'Economic dates pause at reviews. ':'Background review latency affects publication timing. ')+'Not proof of generalization.'};persist(r);
  if(r.s.sandbox)await mirror(r);
  r.s.status=r.s.warning||r.s.team.failed?'ATTENTION':'COMPLETED';commit(r,null);r.allocator.close();active.delete(r.s.id);
 }
 async function mirror(r){
  const agentRequests=new Set(db.prepare("SELECT request_id FROM autonomy_contacts WHERE run_id=? AND policy_source='AGENT_CAMPAIGN' AND request_id IS NOT NULL").all(r.s.runId).map(x=>x.request_id)),picked=r.w.orders.filter(o=>agentRequests.has(o.requestId)&&!o.refundStatus).flatMap(o=>o.merchants.map(m=>({order_id:key(r.s.runId,o.id+'-'+m.id),total_cents:m.grossCents}))).find(o=>o.total_cents>0&&o.total_cents<=10000);
  if(!picked){r.s.paymentNote='No eligible retained campaign order for a Sandbox sample.';return;}
  r.s.nativeStarted=true;persist(r);try{if(db.prepare("SELECT COUNT(*) n FROM paypal_receipts WHERE status='QUEUED' AND run_id<>?").get(r.s.runId).n)throw Error('Another Sandbox sample is queued.');await market.mirror(r.s.runId,[picked.order_id]);r.s.paymentNote='Selected existing merchant order mirrored; provider receipt is not additional simulated revenue.';}catch(error){r.s.warning='Sandbox sample: '+error.message;}
 }
 async function pump(r){if(closing||r.s.status!=='RUNNING')return;await step(r.s.id);if(!closing&&r.s.status==='RUNNING')r.timer=setTimeout(()=>pump(r),r.w.day<30?200:r.w.day>=100?100:tickMs);}
 function displayStep(c,i,id,day,multiplier=1){
  const start=c.day+1,finish=(c.completedDay??c.day)+1,done=c.status!=='STARTED'&&finish<=day;let output=c.output||{body:c.error};
  if(done&&c.actor==='LOCAL_TRAINING_TOOL')output={...output,title:output.validationPassed?'Response model trained':'Model not promoted',body:`${c.input.rows.toLocaleString()} observed contacts · ${output.family||c.input.family}${output.recipe?' · '+output.recipe.replaceAll('_',' '):''} · ${(output.runtimeSeconds||0).toFixed(1)} seconds. Prediction validation ${output.validationPassed?'passed':'failed'}; campaign profit is evaluated after settlement.`};
  if(done&&c.actor==='LOCAL_ANALYSIS')output={...output,body:'Compared observed demand, current stock and the payment funnel. Pending outcomes stay separate from completed purchases.'};
  if(done&&c.actor==='LOCAL_CAMPAIGN_TRIAL'&&output.measurement)output={...output,title:'Campaign trial completed',body:`Development comparison: PayPal ${output.measurement.platformDeltaUSD.toFixed(2)} USD, merchants ${output.measurement.retailerDeltaUSD.toFixed(2)} USD, retained purchases ${output.measurement.purchaseDelta.toFixed(1)} versus fixed rules. ${output.scope}`};
  if(done&&c.actor==='LOCAL_MODEL_COMPARISON')output={...output,title:'Which model should rank shoppers?',body:output.reason};
  if(done&&c.actor==='TRUSTED_PUBLISHER')output={...output,title:c.status==='EXPIRED'?'Review finished after market close':output.decision==='publish'?'Campaign published':output.decision==='stop'?'New outreach stopped':'Current campaign retained',body:output.reason||(output.decision==='publish'?`${output.campaign.audience.replaceAll('_',' ')} · up to ${Number(output.campaign.contactsPerDay)*multiplier} contacts/day. Effective day ${output.effectiveDay+1}.`:'The current valid policy remains in place.')};
  return {id:id+'-STEP-'+i,toolName:c.toolName??null,role:c.role,actor:c.actor==='LOCAL_TRAINING_TOOL'?'LOCAL_MODEL':c.actor,status:done?(c.status==='VALIDATED'?'COMPLETED':c.status):'RUNNING',day:start,finishedDay:done?finish:null,input:{...c.input,observed:{asOfDay:c.day}},output:done?output:null,costMicros:done?(c.provider||[]).reduce((s,e)=>s+(e.modelCostMicros??e.reservedMicros??0),0):0,provider:done?c.provider||[]:[]};
 }
 function snapshot(id,at){
  const r=get(id),latest=db.prepare('SELECT day,frame_json FROM autonomy_frames WHERE run_id=? ORDER BY day DESC LIMIT 1').get(r.s.runId),max=latest?.day||0,d=at==null?max:Math.max(0,Math.min(max,Math.trunc(Number(at)||0))),saved=db.prepare('SELECT frame_json FROM autonomy_frames WHERE run_id=? AND day=?').get(r.s.runId,d),frame=saved?JSON.parse(saved.frame_json):null,
   summary=r.team?.summary()||r.s.team||{checkpoints:[],modelCostUSD:0,modelCalls:0},clockPaused=at==null&&r.s.harnessVersion==='v2'&&(summary.pending||r.s.status==='AWAITING_MAPPING'),visibleDay=clockPaused?d+1:d,steps=(summary.checkpoints||[]).map((c,i)=>displayStep(c,i,r.s.id,visibleDay,r.w.settings.scale||1)).filter(c=>c.day<=Math.max(1,visibleDay)),
   campaigns=(summary.checkpoints||[]).flatMap((c,i)=>['TRUSTED_PUBLISHER','SAVED_POLICY'].includes(c.actor)&&c.status==='COMPLETED'&&(c.output.decision==='publish'||c.actor==='SAVED_POLICY')&&c.output.effectiveDay+1<=d?[{day:c.output.effectiveDay+1,name:c.output.campaign.audience==='lapsed'?'Model-guided reactivation':'Model-guided recommendations',policy:c.output.modelId,reviewId:r.s.id+'-STEP-'+i,modelId:c.output.modelId,audience:c.output.campaign.audience,contactsPerDay:Number(c.output.campaign.contactsPerDay)*(r.w.settings.scale||1)}]:[]),
   end=stamp(d),orders=db.prepare(`SELECT o.order_id,o.customer_id,o.event_ts,o.event_date,o.total_cents,o.discount_cents,m.name merchant,group_concat(p.title,', ') product,t.transaction_id,t.fee_cents,o.channel contact FROM orders o JOIN merchants m USING(merchant_id) JOIN order_items i USING(order_id) JOIN products p USING(product_id) JOIN transactions t USING(order_id) WHERE o.run_id=? AND o.event_ts<? GROUP BY o.order_id ORDER BY o.event_ts DESC,o.order_id DESC LIMIT 16`).all(r.s.runId,end),
   receipts=d>=r.w.totalDays?store.table('paypal_receipts',r.s.runId).rows:[];
  const learning=d>=r.w.totalDays?evaluateFundingPredictions(r.w.decisions,r.w.growth.contacts,r.w.orders):null;
  let paymentJourney=null;if(receipts[0]){const o=r.w.orders.find(o=>o.merchants.some(m=>key(r.s.runId,o.id+'-'+m.id)===receipts[0].order_id)),request=o&&r.w.requests.find(q=>q.id===o.requestId);if(o)paymentJourney={product:o.items.map(i=>r.w.products.find(p=>p.id===i.productId).title).join(', '),customerId:key(r.s.runId,o.customerId),customerName:frame?.customers.find(c=>c.id===key(r.s.runId,o.customerId))?.name,discountCents:0,action:request?.discovery==='CONSENTED_OUTREACH'?'recommendation':'direct',actionDay:(request?.discoveredDay??o.day)+1,campaignName:'Autonomous commerce campaign'};}
  return {id:r.s.id,runId:r.s.runId,status:r.s.status,warning:d===max?(r.s.warning||(summary.failed?'Agent review stopped; the last valid policy remains active.':null)):null,clockPaused,reviewDay:clockPaused?d+1:null,feedHold:clockPaused&&r.s.status==='AWAITING_MAPPING'?summary.feedGate?.waiting??null:null,settings:{execution:r.s.execution??'fresh',recordedReplay:summary.recordedReplay||null,controllerVersion:summary.version||r.s.harnessVersion||'v1',harnessVersion:r.s.harnessVersion||'v1',plannerMode:r.s.plannerMode||'team',modelCheck:Boolean(r.s.modelCheck),merchantMapping:r.s.merchantMapping??null,clockMode:r.s.harnessVersion==='v2'?'decision_barrier':'background',seed:r.s.seed,regime:r.s.regime,marketProfile:r.s.marketProfile||'frozen-3x100',marketVersion:r.w.version,merchantCount:r.w.merchants.length,customerCount:r.w.people.length,campaignBudgetUSD:r.s.marketProfile==='expanded-12x600'?300:50,dailyContactLimit:r.s.marketProfile==='expanded-12x600'?60:10,sandbox:r.s.sandbox,modelCapUSD:summary.modelCapUSD??.25,autonomy:true,goal:'Autonomous analysis, local training, campaign publication and funded commerce.'},day:d,liveDay:max,totalDays:r.w.totalDays,replay:d<max,frame,steps,orders,redemptions:[],campaigns,costMicros:steps.reduce((s,c)=>s+c.costMicros,0),modelCalls:steps.reduce((n,c)=>n+(c.actor==='GEMINI'?(c.provider?.length||0):0),0),calibrationUpdates:frame?.behavior?.outcome?.calibrationUpdates||0,learning,receipts,paymentJourney,latestCampaign:campaigns.at(-1)||null,teamPending:summary.pending,paymentNote:r.s.paymentNote,comparison:d>=r.w.totalDays?r.s.comparison||null:null,ontology:runOntology({world:r.w,run:r.s,day:d,steps,receipts,reference:summary.reference,hold:clockPaused&&r.s.status==='AWAITING_MAPPING'}),modeledPayments:frame?{captures:frame.stats.orders,deliveries:frame.stats.deliveries,volumeCents:frame.stats.revenueCents}:null};
 }
 function trace(id,customer,at){const r=get(id),day=at==null?r.w.day:Math.min(r.w.day,Number(at)||0),raw=r.w.people.find(p=>key(r.s.runId,p.id)===customer)?.id;if(!raw)throw new SandboxError(404,'SHOPPER_NOT_FOUND','Shopper not found.');
  const requests=r.w.requests.filter(q=>q.customerId===raw&&q.createdDay<day).map(q=>({id:q.id,budgetCents:q.budgetCents,authorizedCents:q.authorizedDay<day?q.authorizedCents:null,deadlineDay:q.deadlineDay,lines:q.lines})),contacts=r.w.growth.contacts.filter(c=>c.customerId===raw&&c.day<day),orders=r.w.orders.filter(o=>o.customerId===raw&&o.day<day).map(o=>{const refunded=r.w.events.some(e=>e.type==='REFUNDED'&&e.captureId===o.id&&e.day<day);return {...o,refundStatus:refunded?'SETTLED':null,refundCents:refunded?o.grossCents:0,feeReturnedCents:refunded?o.feeReturnedCents:undefined,status:o.deliveryDueDay<day?'DELIVERED':'CAPTURED'};});
  return {customerId:customer,asOfDay:day,requests,contacts,orders,deliveries:r.w.deliveries.filter(d=>d.day<day&&orders.some(o=>o.id===d.orderId)),source:'SIMULATED_SHOPPER_TRACE'};
 }
 return {snapshot,trace,step,correctMapping(id,input){
  if(!input||Object.keys(input).some(k=>!['holdId','column'].includes(k))||typeof input.holdId!=='string'||!/^[a-f0-9]{64}$/.test(input.holdId)||input.column!=='basket_id')
   throw new SandboxError(400,'INVALID_MAPPING_CORRECTION','Use the recorded hold and the merchant-confirmed basket_id key.');
  const r=get(id);
  if(r.s.mappingCorrection?.holdId===input.holdId)return snapshot(id);
  const held=r.team?.summary().feedGate?.waiting;
  if(closing||!active.has(id)||r.s.status!=='AWAITING_MAPPING'||held?.holdId!==input.holdId||held.code!=='ambiguous-link')
   throw new SandboxError(409,'STALE_MAPPING_HOLD','This mapping does not belong to the currently held review.');
  r.team.correctMapping(input.holdId,input.column);r.s.mappingCorrection={holdId:input.holdId,column:input.column};
  r.s.status='RUNNING';
  try{persist(r);}catch(error){delete r.s.mappingCorrection;r.s.status='AWAITING_MAPPING';throw error;}
  if(autoPump)r.timer=setTimeout(()=>pump(r),0);return snapshot(id);
 },latest(){const row=db.prepare('SELECT id FROM autonomy_sessions ORDER BY created_at DESC LIMIT 1').get();return row?snapshot(row.id):null;},async start(input){
  if(input.execution!==undefined&&!['fresh','saved'].includes(input.execution))throw new SandboxError(400,'INVALID_AUTONOMY_SETTINGS','Choose fresh planning or a saved policy.');
  if(input.execution==='saved'&&(input.harnessVersion!=='v2'||input.plannerMode!=='single'||input.modelCheck!==true||input.marketProfile!=='expanded-12x600'))throw new SandboxError(400,'INVALID_AUTONOMY_SETTINGS','The saved policy uses the 12-merchant market and one planner.');
  if(input.modelCheck!==undefined&&(typeof input.modelCheck!=='boolean'||input.modelCheck&&input.harnessVersion!=='v2'))throw new SandboxError(400,'INVALID_AUTONOMY_SETTINGS','Model comparison requires a V2 workflow.');
  const feedRequired=input.harnessVersion==='v2'&&input.plannerMode==='single'&&input.modelCheck===true;
  if(input.merchantMapping!==undefined&&(!feedRequired||!plannerMappings.includes(input.merchantMapping)))throw new SandboxError(400,'INVALID_AUTONOMY_SETTINGS','Merchant feed review requires one V2 planner, the verifier and a supported export.');
  const merchantMapping=feedRequired?(input.merchantMapping??'warehouse'):null;
  if(Object.keys(input).some(k=>!['requestId','seed','sandbox','regime','marketProfile','harnessVersion','plannerMode','modelCheck','merchantMapping','execution'].includes(k))||typeof input.requestId!=='string'||input.requestId.length<8||input.requestId.length>100||!Number.isSafeInteger(input.seed)||input.seed<0||input.seed>4294967295||typeof input.sandbox!=='boolean'||input.regime&&!Object.hasOwn(CONTRACT.regimes,input.regime)||input.marketProfile&&!['expanded-12x600','frozen-3x100'].includes(input.marketProfile)||input.harnessVersion&&!['v1','v2'].includes(input.harnessVersion)||input.plannerMode&&!['team','single'].includes(input.plannerMode))throw new SandboxError(400,'INVALID_AUTONOMY_SETTINGS','Choose a seed and a supported market scenario.');
  const old=db.prepare('SELECT id,state_json FROM autonomy_sessions WHERE request_id=?').get(input.requestId);if(old){const saved=JSON.parse(old.state_json).s;if((saved.execution??'fresh')!==(input.execution??'fresh')||saved.seed!==input.seed||saved.sandbox!==input.sandbox||saved.regime!==(input.regime||'discovery')||(saved.marketProfile||'frozen-3x100')!==(input.marketProfile||'frozen-3x100')||(saved.harnessVersion||'v1')!==(input.harnessVersion||'v1')||(saved.plannerMode||'team')!==(input.plannerMode||'team')||Boolean(saved.modelCheck)!==(input.modelCheck??false)||(saved.merchantMapping??(feedRequired?'warehouse':null))!==merchantMapping)throw new SandboxError(409,'REQUEST_CONFLICT','This request belongs to another run.');return snapshot(old.id);}
  if(closing||starting||active.size)throw new SandboxError(409,'AUTONOMY_RUNNING','An autonomous market is already running.');starting=true;let r;
  try{for(const [path,h]of Object.entries(core.sourceHashes))if(createHash('sha256').update(readFileSync(path)).digest('hex')!==h)throw Error('FROZEN_ECONOMY_CHANGED');await mkdir(rootDir,{recursive:true});
   const suffix=digest(input).slice(0,16),s={id:'AUTONOMY-'+suffix,runId:'GARDEN-AUTO-'+suffix,seed:input.seed,execution:input.execution??'fresh',regime:input.regime||'discovery',marketProfile:input.marketProfile||'frozen-3x100',harnessVersion:input.harnessVersion||'v1',plannerMode:input.plannerMode||'team',modelCheck:input.modelCheck??false,merchantMapping,sandbox:input.sandbox,status:'RUNNING',cursor:{},committedDay:0,team:null},w=engineFor(s).createGrowthWorld({seed:s.seed,regime:s.regime}),p=projection(w,s),f=marketFrame(w,s,null);p.autonomyFrame=f;
   store.create(p);r={s,w,team:null,allocator:openAllocator(),stepping:false};db.prepare('INSERT INTO autonomy_sessions VALUES(?,?,?,?,?,?)').run(s.id,input.requestId,s.runId,s.status,JSON.stringify({s,w}),new Date().toISOString());db.prepare('INSERT INTO autonomy_frames VALUES(?,?,?)').run(s.runId,0,JSON.stringify(f));active.set(s.id,r);
   r.team=s.execution==='saved'?await openSavedPolicy():s.harnessVersion==='v2'?await v2ControllerFactory({id:s.id,dir:resolve(rootDir,s.id),mode:s.plannerMode,modelCheck:s.modelCheck,trainingAdvisor:s.merchantMapping?ontologyTrainingAdvisor:null,prior,incumbent:fixed.config,providerFactory,trialFactory:v2TrialFactory,onCheckpoint:async()=>persist(r)}):await openAutonomousCommerce({id:s.id,dir:resolve(rootDir,s.id),prior,incumbent:fixed.config,providerFactory,background:true,recipeSelection:true,developmentEvidence,fundingPrior});
   if(s.merchantMapping)r.team=withPlannerFeed(r.team,{runId:s.runId,mapping:s.merchantMapping});
   persist(r);if(autoPump)r.timer=setTimeout(()=>pump(r),150);return snapshot(s.id);
  }catch(error){if(r){r.s.status='ATTENTION';r.s.warning=error.message;persist(r);r.allocator.close();active.delete(r.s.id);}throw error;}finally{starting=false;}
 },recover(){for(const row of db.prepare("SELECT id,state_json FROM autonomy_sessions WHERE status IN ('RUNNING','SETTLING','AWAITING_MAPPING')").all()){const r=JSON.parse(row.state_json);r.s.status='INTERRUPTED';r.s.warning='Server restarted; checkpoints are retained and uncertain paid calls are not replayed.';persist(r);}},async close(){closing=true;for(const r of active.values())clearTimeout(r.timer);for(const r of active.values()){while(r.stepping)await new Promise(resolve=>setTimeout(resolve,25));if(!active.has(r.s.id))continue;await r.team?.close();r.s.team=r.team?.summary()||r.s.team;r.s.status='INTERRUPTED';persist(r);r.allocator?.close();}active.clear();}};
}
