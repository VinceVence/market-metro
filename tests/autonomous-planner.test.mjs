import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createMarketStore} from '../scripts/market-store.mjs';
import {createMarketService} from '../scripts/market-service.mjs';
import {createCampaignWorkflow} from '../scripts/marketing/workflow.mjs';
import {createAutonomousPlanner,decodeDecision,plannerPacket,plannerSchema,plannerFunctions,availablePlannerActions} from '../scripts/marketing/autonomous-planner.mjs';
import {openSpendLedger,createVertexClient,PROJECT_ID} from '../benchmark/vertex.mjs';
import {reviewPlannerTimeout} from '../scripts/marketing/review-planner-timeout.mjs';
import {SAMPLE_PRODUCTS} from '../demo/market/engine.mjs';

const input={requestId:'autonomous-fixture',seed:314,customerCount:100,budgetCents:30000,objective:'retention',scenario:'rival_sale',nativeSamples:0};
async function fixture(t){
  const dir=await mkdtemp(join(tmpdir(),'metro-autonomous-')),store=createMarketStore(join(dir,'test.sqlite'));
  const paypal={status:()=>({configured:false}),profileKey:()=> 'TEST',list:()=>[],requestSandbox:()=>{throw Error('PAYMENT_FORBIDDEN');}};
  const catalog={products:()=>structuredClone(SAMPLE_PRODUCTS),status:()=>({mode:'SAMPLE'})};
  const market=createMarketService({store,paypal,catalog});let fits=0;
  const workflow=createCampaignWorkflow({store,market,trainImpl:async(_s,w)=>{fits++;const coef=Array(23).fill(0);coef[11]=3;return {status:'PROMOTED',reason:'Test-only fitted artifact',model_type:'logistic',dataset_hash:'a'.repeat(64),training_rows:2100,validation_rows:700,train_through_day:w.tick-8,validation_from_day:w.tick-7,validation_through_day:w.tick-1,validation_log_loss:.3,baseline_log_loss:.5,brier_score:.1,candidates:[],artifact:{type:'logistic',coef,mean:Array(23).fill(0),scale:Array(23).fill(1),intercept:-2},runtime_ms:1};}});
  t.after(()=>{store.close();return rm(dir,{recursive:true,force:true});});return {dir,store,workflow,market,fits:()=>fits};
}
function fakeChoice(p){
  const phase=p.workflow.phase,analysis=p.evidence.find(e=>e.action==='analyze')?.result;let action,parameters={};
  if(phase==='GOAL_SET')action='prepare_history';
  else if(phase==='HISTORY_READY'){action='analyze';parameters={windowDays:14,cuts:['merchants','products','market']};}
  else if(phase==='ANALYZED'){action='train';parameters={windowDays:28,modelTypes:['logistic','tree']};}
  else if(phase==='MODEL_READY'){action='draft_campaign';parameters={title:'Fixture campaign',message:'Test coupon for simulated shoppers.',modelId:p.models[0].id,merchantIds:analysis.merchants.map(m=>m.value),offerOptions:[5,10],minRecencyDays:3,minExpectedGainCents:0,ranking:'incremental_purchase_probability',durationDays:14};}
  else if(phase==='PLAN_VALIDATED'){action='launch';parameters={planId:p.draftPlan.plan_id};}
  else if(phase==='RUNNING'&&p.workflow.attention){if(analysis?.cutoffExclusive!==p.workflow.day){action='analyze';parameters={windowDays:14,cuts:['daily','model_health']};}else{action='review';parameters={decision:'continue'};}}
  else if(phase==='RUNNING'){action='advance';parameters={days:Math.min(7,p.workflow.endDay-p.workflow.day)};}
  else if(phase==='OUTCOMES_READY')action=p.workflow.settled?'evaluate':'settle';
  else if(phase==='EVALUATED')action='complete';
  return {action,parameters,rationale:'Explicitly fake model fixture selects an allowed action from observed test state.',evidenceIds:[p.completedEvidenceIds.at(-1)]};
}

test('app runner completes a checkpointed campaign without chat and records each provider receipt',async t=>{
  const f=await fixture(t);let calls=0,closed=0;
  const client={events:[],async json(_s,p,options){calls++;assert(!JSON.stringify(p).includes('privateTraits'));const value=fakeChoice(p);assert(options.functions.some(f=>f.name===value.action));this.events.push({reservationId:'fake-'+calls,status:'settled',modelCostMicros:100,inputTokens:100,outputTokens:50,thinkingTokens:0,modelVersion:'test-fake'});return {name:value.action,args:{...value.parameters,rationale:value.rationale,evidenceIds:value.evidenceIds}};}};
  const planner=createAutonomousPlanner({...f,clientFactory:async()=>({client,cap:{state:'TEST_ONLY'},close:async()=>{closed++;}})});
  const c=planner.start(input);assert.equal(planner.start(input).workflowId,c.workflowId);
  const done=await planner.wait(c.workflowId);assert.equal(done.phase,'COMPLETED');assert.equal(done.autonomy.status,'COMPLETED');
  assert.equal(done.autonomy.modelCostMicros,calls*100);assert.equal(done.evaluation.paidModelCalls,calls);assert.equal(done.evaluation.modelApiCostMicros,calls*100);
  assert.equal(f.fits(),1);assert.equal(closed,1);assert(calls<20);
  assert(done.checkpoints.some(c=>c.action==='review'));assert(done.checkpoints.every(c=>c.actor==='vertex_planner'));
  assert.equal(done.evaluation.decisions,1600);assert.equal(done.evaluation.nativePayments.length,0);
  assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM campaign_customer_decisions WHERE arm='HOLDOUT' AND coupon_id IS NOT NULL").get().n,0);
  const before=calls;planner.resume(c.workflowId);await planner.wait(c.workflowId);assert.equal(calls,before);
  assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM planner_turns WHERE status<>'COMPLETED'").get().n,0);
});

test('invalid model actions get one bounded repair and cannot reach a payment tool',async t=>{
  const f=await fixture(t);let calls=0;
  const client={events:[],async json(){calls++;this.events.push({status:'settled',modelCostMicros:10});return {action:'capture_samples',argumentsJson:'{}',rationale:'Try an unauthorized payment action.',evidenceIds:['invented']};}};
  const p=createAutonomousPlanner({...f,clientFactory:async()=>({client,cap:{},close:async()=>{}})}),c=p.start(input),done=await p.wait(c.workflowId);
  assert.equal(calls,2);assert.equal(done.autonomy.status,'PAUSED');assert.equal(done.phase,'GOAL_SET');assert.equal(done.autonomy.modelCostMicros,20);assert.equal(done.nativePayments.completed,0);
});

test('planner schema and decoder preserve numeric argument types',async t=>{
  const f=await fixture(t),c=f.workflow.create({...input,mission:'Check structured numeric tool arguments.',actor:'vertex_planner'});
  const ready=(await f.workflow.step(c.workflowId,decodeDecision(fakeChoice(plannerPacket(c)),c,'typed-history'))).context;
  assert.equal(plannerSchema(ready).properties.parameters.properties.windowDays.type,'INTEGER');
  const declaration=plannerFunctions(ready).find(f=>f.name==='analyze');assert(declaration.parameters.required.includes('cuts'));assert.equal(declaration.parameters.properties.cuts.type,'ARRAY');
  const value={action:'analyze',parameters:{windowDays:28,cuts:['market']},rationale:'Read the observed numeric day window.',evidenceIds:[ready.checkpoints.at(-1).checkpoint_id]};
  assert.equal(decodeDecision(value,ready,'typed-analysis').parameters.windowDays,28);
  assert.throws(()=>decodeDecision({...value,parameters:{...value.parameters,windowDays:'28'}},ready,'bad-analysis'),/windowDays must have JSON type INTEGER/);
});

test('unchanged-state analysis loops are bounded without choosing the business action',()=>{
  const c={phase:'RUNNING',day:35,attention:null,modelSummaries:[{status:'PROMOTED'}],checkpoints:[{action:'analyze',status:'COMPLETED',output:{cutoffExclusive:35}},{action:'analyze',status:'COMPLETED',output:{cutoffExclusive:35}},{action:'review',status:'COMPLETED',output:{day:35,decision:'continue'}}]};
  const choices=availablePlannerActions(c);assert(!choices.includes('analyze'));assert(!choices.includes('review'));assert(choices.includes('train'));assert(choices.includes('draft_campaign'));assert(choices.includes('advance'));
  const changed=availablePlannerActions({...c,day:36,attention:{kind:'OBSERVED_MARKET_CHANGE'}});assert(changed.includes('analyze'));assert(changed.includes('review'));assert(!changed.includes('advance'));
});

test('saved proposals replay without another inference; unknown in-flight inference pauses',async t=>{
  const f=await fixture(t),c=f.workflow.create({...input,mission:'Recover a saved autonomous test workflow.',actor:'vertex_planner'});
  f.store.insert('planner_sessions',[{workflow_id:c.workflowId,run_id:c.runId,model:'gemini-3.1-flash-lite',status:'STARTING',spend_cap_micros:250000,state_json:'{}'}]);
  const decision=fakeChoice(plannerPacket(c)),request=decodeDecision(decision,c,'autonomous-1');
  const first=await f.workflow.step(c.workflowId,request);
  f.store.insert('planner_turns',[{turn_id:c.workflowId+'-TURN-1',workflow_id:c.workflowId,run_id:c.runId,turn_index:1,status:'PROPOSED',input_json:'{}',decision_json:JSON.stringify(decision),request_json:JSON.stringify(request),provider_json:'{"status":"settled","modelCostMicros":10}'}]);
  let opens=0;const p=createAutonomousPlanner({...f,clientFactory:async()=>{opens++;throw new Error('TEST_STOP_BEFORE_NEXT_INFERENCE');}});p.recover();await p.wait(c.workflowId);
  assert.equal(opens,1);assert.equal(f.workflow.context(c.workflowId).revision,first.context.revision);assert.equal(f.store.db.prepare('SELECT status FROM planner_turns').get().status,'COMPLETED');
  f.store.db.prepare("UPDATE planner_sessions SET status='STARTING'").run();f.store.db.prepare("UPDATE planner_turns SET status='PLANNING'").run();p.recover();await p.wait(c.workflowId);
  assert.equal(opens,1);assert.equal(f.workflow.context(c.workflowId).autonomy.error.code,'UNFINISHED_INFERENCE_REQUIRES_REVIEW');assert.throws(()=>p.resume(c.workflowId),/unknown/);
});

test('Flash-Lite uses the shared lifetime ledger, reserves before inference and enforces 25 cents across restart',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'metro-spend-'));t.after(()=>rm(dir,{recursive:true,force:true}));const path=join(dir,'spend.json');
  const historical={id:'old',runId:'old-run',reservedMicros:150000,chargedMicros:1000,status:'settled',pricing:{inputMicrosPerToken:2,outputMicrosPerToken:12}};
  await writeFile(path,JSON.stringify({version:1,projectId:PROJECT_ID,lifetimeCapMicros:8000000,entries:[historical],circuit:null}));
  let ledger=await openSpendLedger(path,{runId:'campaign',profile:'flash_lite'});
  const client=createVertexClient({token:'DO_NOT_EXPORT_TOKEN',ledger,profile:'flash_lite',requestGapMs:0,fetchFn:async(url,options)=>{
    assert(url.endsWith('/gemini-3.1-flash-lite:generateContent'));assert(url.includes('/projects/'+PROJECT_ID+'/'));
    const body=JSON.parse(options.body);assert.equal(body.generationConfig.thinkingConfig.thinkingLevel,'MINIMAL');assert.equal(body.generationConfig.maxOutputTokens,2048);
    assert.equal(ledger.snapshot().entries.at(-1).reservedMicros,30000);
    return {ok:true,json:async()=>({modelVersion:'gemini-3.1-flash-lite',candidates:[{finishReason:'STOP',content:{parts:[{text:'{"action":"analyze"}'}]}}],usageMetadata:{promptTokenCount:1000,candidatesTokenCount:100,thoughtsTokenCount:10}})};
  }});
  assert.deepEqual(await client.json('test',{}),{action:'analyze'});assert.equal(ledger.snapshot().runChargedMicros,415);assert.deepEqual(ledger.snapshot().entries[0],historical);
  assert.throws(()=>createVertexClient({token:'test',ledger}),/PROFILE_MISMATCH/);
  for(let i=0;i<11;i++){const id=await ledger.reserve({stage:'test'});await ledger.settle(id,{inputTokens:80000,outputTokens:0});}
  assert.equal(ledger.snapshot().runChargedMicros,220415);await assert.rejects(()=>ledger.reserve({}),/MODEL_SPEND_LIMIT/);await ledger.close();
  ledger=await openSpendLedger(path,{runId:'campaign',profile:'flash_lite'});await assert.rejects(()=>ledger.reserve({}),/MODEL_SPEND_LIMIT/);await ledger.close();
  const saved=await readFile(path,'utf8');assert(!saved.includes('DO_NOT_EXPORT_TOKEN'));
});

test('Vertex native tool mode carries required typed arguments and rejects multiple actions',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'metro-native-tools-'));
  const ledger=await openSpendLedger(join(dir,'spend.json'),{initialize:true,runId:'native-test',profile:'flash_lite'});t.after(async()=>{await ledger.close();await rm(dir,{recursive:true,force:true});});
  const call={name:'analyze',args:{windowDays:28,cuts:['market'],rationale:'Read completed observations.',evidenceIds:['CP1']}};let multiple=false;
  const client=createVertexClient({token:'TEST',ledger,profile:'flash_lite',requestGapMs:0,fetchFn:async(_url,options)=>{const b=JSON.parse(options.body);assert.equal(b.toolConfig.functionCallingConfig.mode,'ANY');assert.equal(b.generationConfig.responseMimeType,undefined);assert(b.tools[0].functionDeclarations[0].parameters.required.includes('cuts'));return {ok:true,json:async()=>({modelVersion:'gemini-3.1-flash-lite',candidates:[{finishReason:'STOP',content:{parts:multiple?[{functionCall:call},{functionCall:call}]:[{functionCall:call}]}}],usageMetadata:{promptTokenCount:1000,candidatesTokenCount:100}})};}});
  const functions=[{name:'analyze',parameters:{type:'OBJECT',properties:{windowDays:{type:'INTEGER'},cuts:{type:'ARRAY',items:{type:'STRING'}}},required:['windowDays','cuts']}}];
  assert.deepEqual(await client.json('test',{}, {functions}),call);multiple=true;
  await assert.rejects(()=>client.json('test',{}, {functions}),/MODEL_TOOL_CALL_COUNT/);assert.equal(ledger.snapshot().entries.length,2);assert(ledger.snapshot().entries.every(e=>e.status==='settled'));
});

test('linked retries keep a shared $0.25 cap while each trial retains its call limit',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'metro-shared-cap-')),ledger=await openSpendLedger(join(dir,'spend.json'),{initialize:true,runId:'shared-budget',profile:'flash_lite'});
  t.after(async()=>{await ledger.close();await rm(dir,{recursive:true,force:true});});
  for(let i=0;i<32;i++){const id=await ledger.reserve({trialId:'diagnostic'});await ledger.settle(id,{inputTokens:0,outputTokens:0});}
  await assert.rejects(()=>ledger.reserve({trialId:'diagnostic'}),/MODEL_CALL_LIMIT/);
  for(let i=0;i<12;i++){const id=await ledger.reserve({trialId:'clean-retry'});await ledger.settle(id,{inputTokens:80000,outputTokens:0});}
  assert.equal(ledger.snapshot().runChargedMicros,240000);
  await assert.rejects(()=>ledger.reserve({trialId:'another-retry'}),/MODEL_SPEND_LIMIT/);
});

test('reviewed inference timeout keeps its full reserve and cannot recover a proposed action or erase earlier costs',async t=>{
  const f=await fixture(t),c=f.workflow.create({...input,mission:'Review a failed inference with no executable action.',actor:'vertex_planner'}),path=join(f.dir,'spend.json');
  const old={id:'past',runId:'past',status:'settled',reservedMicros:30000,chargedMicros:2500};
  await writeFile(path,JSON.stringify({version:1,projectId:PROJECT_ID,lifetimeCapMicros:8000000,entries:[old],circuit:null}));
  let ledger=await openSpendLedger(path,{runId:'market-'+c.workflowId,profile:'flash_lite'});
  const id=await ledger.reserve({model:'gemini-3.1-flash-lite',stage:'planner',inputBytes:2000});await ledger.uncertain(id);await ledger.close();
  await assert.rejects(()=>openSpendLedger(path,{runId:'market-'+c.workflowId,profile:'flash_lite'}),/SPEND_CIRCUIT_OPEN/);
  f.store.insert('planner_sessions',[{workflow_id:c.workflowId,run_id:c.runId,model:'gemini-3.1-flash-lite',status:'PAUSED',spend_cap_micros:250000,state_json:'{}'}]);
  f.store.insert('planner_turns',[{turn_id:c.workflowId+'-TURN-1',workflow_id:c.workflowId,run_id:c.runId,turn_index:1,status:'FAILED',request_json:'{}',provider_json:JSON.stringify({reservationId:id,status:'uncertain',error:'The operation was aborted due to timeout'})}]);
  await assert.rejects(()=>reviewPlannerTimeout({db:f.store.db,ledgerPath:path,workflowId:c.workflowId}),/TIMEOUT_REVIEW_UNSAFE/);
  f.store.db.prepare('UPDATE planner_turns SET request_json=NULL').run();
  const reviewed=await reviewPlannerTimeout({db:f.store.db,ledgerPath:path,workflowId:c.workflowId});assert.equal(reviewed.actualCostKnown,false);
  ledger=await openSpendLedger(path,{runId:'market-'+c.workflowId,profile:'flash_lite'});
  assert.equal(ledger.snapshot().runChargedMicros,30000);assert.deepEqual(ledger.snapshot().entries[0],old);
  assert.equal(f.workflow.context(c.workflowId).autonomy.unmeteredCostCeilingMicros,30000);
  for(let i=0;i<7;i++){const r=await ledger.reserve({stage:'test'});await ledger.settle(r,{inputTokens:120000,outputTokens:0});}
  await assert.rejects(()=>ledger.reserve({}),/MODEL_SPEND_LIMIT/);await ledger.close();
  const backup=JSON.parse(await readFile(path+'.timeout-review-'+id+'.json','utf8'));assert.equal(backup.entries.at(-1).status,'uncertain');
});
