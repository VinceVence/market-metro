import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createMarketStore} from '../scripts/market-store.mjs';
import {createMarketService} from '../scripts/market-service.mjs';
import {createCampaignWorkflow} from '../scripts/marketing/workflow.mjs';
import {createCampaignDemo} from '../scripts/marketing/campaign-demo.mjs';
import {SAMPLE_PRODUCTS} from '../demo/market/engine.mjs';
import {SandboxError} from '../scripts/paypal-sandbox.mjs';
import {createSupplyYardServer} from '../scripts/serve.mjs';

async function fixture(t,{nativeSamples=0,scenario='steady'}={}){
  const dir=await mkdtemp(join(tmpdir(),'campaign-workflow-'));
  let store=createMarketStore(join(dir,'test.sqlite')),market,workflow;
  const state={fits:0,creates:0,readsFail:0,orders:new Map(),keys:new Map()};
  const paypal={list:()=>[],status:()=>({configured:true,mode:'SANDBOX'}),profileKey:()=> 'PRIVATE_PROFILE',async requestSandbox(path,args={}){
    if(path==='/v2/checkout/orders'){
      let o=state.keys.get(args.requestId);
      if(!o){state.creates++;const unit=structuredClone(args.body.purchase_units[0]);unit.payee={merchant_id:'SANDBOXMERCHANT'};unit.payments={captures:[{id:'CAPTURETEST'+String(state.creates).padStart(6,'0'),status:'COMPLETED',amount:unit.amount,create_time:'2026-10-22T09:00:00Z',seller_receivable_breakdown:{gross_amount:unit.amount,paypal_fee:{currency_code:'USD',value:'1.00'},net_amount:{currency_code:'USD',value:(Number(unit.amount.value)-1).toFixed(2)}}}]};o={id:'ORDERTEST'+String(state.creates).padStart(6,'0'),status:'COMPLETED',purchase_units:[unit]};state.keys.set(args.requestId,o);state.orders.set(o.id,o);}return structuredClone(o);
    }
    if(state.readsFail>0){state.readsFail--;throw new SandboxError(502,'SIMULATED_LOST_RESPONSE','Provider read unavailable.');}
    const order=state.orders.get(path.split('/').at(-1));assert(order);return structuredClone(order);
  }};
  const funding={status:()=>({ready:true,mode:'SANDBOX'}),fingerprint:()=> 'PRIVATE_WALLET',paymentSource:()=>({paypal:{vault_id:'PRIVATE_TOKEN'}})};
  const catalog={products:()=>structuredClone(SAMPLE_PRODUCTS),status:()=>({mode:'SAMPLE'}),sync:()=>{throw Error('CATALOG_CALL_FORBIDDEN');}};
  const trainImpl=async(_store,w,options)=>{state.fits++;assert(w.tick>=28);assert.deepEqual(options.modelTypes,['logistic','tree']);const coef=Array(23).fill(0);coef[11]=3;return {status:'PROMOTED',reason:'Fixture model passed the shared gate.',model_type:'logistic',dataset_hash:'a'.repeat(64),training_rows:2100,validation_rows:700,train_through_day:w.tick-8,validation_from_day:w.tick-7,validation_through_day:w.tick-1,validation_log_loss:.3,baseline_log_loss:.5,champion_log_loss:null,brier_score:.1,candidates:[{type:'logistic',log_loss:.3},{type:'tree',log_loss:.4}],artifact:{type:'logistic',coef,mean:Array(23).fill(0),scale:Array(23).fill(1),intercept:-2},runtime_ms:10};};
  function services(){market=createMarketService({store,paypal,catalog,funding});workflow=createCampaignWorkflow({store,market,trainImpl});}
  services();t.after(async()=>{store.close();await rm(dir,{recursive:true,force:true});});
  const mission={requestId:'test-mission',mission:'Improve repeat buying with bounded coupon offers.',seed:42,customerCount:100,budgetCents:30000,objective:'profit',scenario,nativeSamples};
  const initial=workflow.create(mission);let last;
  const f={state,paypal,mission,id:initial.workflowId,get store(){return store;},get market(){return market;},get workflow(){return workflow;},get last(){return last;},restart(){store.close();store=createMarketStore(join(dir,'test.sqlite'));services();},async step(action,parameters={},requestId=action){const c=workflow.context(initial.workflowId);last={requestId,expectedRevision:c.revision,contextHash:c.contextHash,action,parameters,rationale:'Test planner uses the saved observed checkpoint to select this tool.',evidenceIds:[c.checkpoints.filter(c=>c.status==='COMPLETED').at(-1).checkpoint_id],actor:'assistant_in_current_chat'};return workflow.step(initial.workflowId,last);}};
  return f;
}
async function launch(f){
  await f.step('prepare_history');await f.step('analyze',{windowDays:14,cuts:['merchants','segments','market','offers']});
  const fitted=await f.step('train',{windowDays:28,modelTypes:['logistic','tree']});
  const w=f.store.state(fitted.context.runId);
  const drafted=await f.step('draft_campaign',{title:'Come back to the market',message:'A small offer for your next visit.',modelId:fitted.output.modelId,merchantIds:w.merchants.map(m=>m.merchant_id),offerOptions:[5,10],minRecencyDays:0,minExpectedGainCents:0,ranking:'contribution',durationDays:14});
  await f.step('launch',{planId:drafted.output.planId});
}

test('checkpoints persist and replay without retraining, duplicate coupons or changed warehouse state',async t=>{
  const f=await fixture(t);assert.equal(f.workflow.create(f.mission).workflowId,f.id);
  await launch(f);const train=f.workflow.context(f.id).checkpoints.find(c=>c.action==='train');
  f.restart();assert.equal((await f.workflow.step(f.id,train.input)).replayed,true);assert.equal(f.state.fits,1);
  await f.step('advance',{days:7},'advance-week-one');const input=structuredClone(f.last);
  const before=f.store.db.prepare('SELECT COUNT(*) n FROM coupons').get().n,day=f.workflow.context(f.id).day;
  f.restart();assert.equal((await f.workflow.step(f.id,input)).replayed,true);
  assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM coupons').get().n,before);assert.equal(f.workflow.context(f.id).day,day);
  assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM campaign_customer_decisions').get().n,700);
  const shoppers=f.workflow.customers(f.id);assert.equal(shoppers.length,100);assert(shoppers.every(u=>u.decisionCount===7));assert(shoppers.filter(u=>u.arm==='HOLDOUT').every(u=>u.coupons===0));
  assert.deepEqual(f.store.db.prepare('PRAGMA foreign_key_check').all(),[]);
  const exported=JSON.stringify(f.workflow.export(f.id));for(const key of ['privateTraits','couponEffect','PRIVATE_TOKEN','PRIVATE_PROFILE','PRIVATE_WALLET'])assert(!exported.includes(key));
  await assert.rejects(()=>f.market.advance(f.workflow.context(f.id).runId,1),{code:'WORKFLOW_OWNS_RUN'});
});

test('stale contexts, foreign evidence, altered request keys and unsafe campaign changes fail closed',async t=>{
  const f=await fixture(t);await f.step('prepare_history');
  await assert.rejects(()=>f.workflow.step(f.id,{...f.last,parameters:{days:10}}),{code:'REQUEST_KEY_REUSED'});
  await assert.rejects(()=>f.workflow.step(f.id,{...f.last,requestId:'stale-new-request'}),{code:'STALE_CONTEXT'});
  const c=f.workflow.context(f.id);
  await assert.rejects(()=>f.workflow.step(f.id,{requestId:'foreign-evidence',expectedRevision:c.revision,contextHash:c.contextHash,action:'analyze',parameters:{windowDays:14,cuts:['market']},rationale:'Inspect recent market evidence.',evidenceIds:['OTHER-WORKFLOW'],actor:'assistant_in_current_chat'}),{code:'INVALID_EVIDENCE'});
  await f.step('analyze',{windowDays:14,cuts:['market']});const trained=await f.step('train',{windowDays:28,modelTypes:['logistic','tree']});
  const params={title:'Invalid campaign',message:'An invalid large coupon.',modelId:trained.output.modelId,merchantIds:f.store.state(trained.context.runId).merchants.map(m=>m.merchant_id),offerOptions:[90],minRecencyDays:0,minExpectedGainCents:0,ranking:'contribution',durationDays:14};
  await assert.rejects(()=>f.step('draft_campaign',params),{code:'INVALID_CAMPAIGN_PLAN'});
  assert.equal(f.workflow.context(f.id).phase,'MODEL_READY');assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM campaign_plans').get().n,0);
});

test('full campaign traces include purchases, refunds and correctly joined native samples; interrupted receipt checkpoint resumes once',async t=>{
  const f=await fixture(t,{nativeSamples:1});await launch(f);
  await f.step('advance',{days:7},'advance-first');await f.step('analyze',{windowDays:14,cuts:['market','segments']},'inspect-midpoint');await f.step('review',{decision:'continue'});await f.step('advance',{days:7},'advance-second');await f.step('settle');
  const run=f.workflow.context(f.id).runId,candidate=f.market.paymentSample(run).candidates.find(c=>c.coupon_id);assert(candidate);
  f.state.readsFail=2;await assert.rejects(()=>f.step('capture_samples',{orderIds:[candidate.order_id]}));const retry=structuredClone(f.last);assert.equal(f.state.creates,1);
  assert.equal(f.workflow.context(f.id).checkpoints.find(c=>c.action==='capture_samples').status,'FAILED');
  f.restart();await f.workflow.step(f.id,retry);assert.equal(f.state.creates,1);
  const evaluated=await f.step('evaluate');const e=evaluated.output,x=e.economics;
  assert.equal(x.contributionCents,x.salesCents-x.refundsCents-x.cogsCents-x.deliveryCents-x.modeledFeesCents-x.outreachCents);
  assert.equal(e.decisions,1600);assert(e.coupons>0);assert(e.redemptions>0);assert.equal(e.nativePayments.length,1);
  const customer=e.nativePayments[0].customer_id,trace=f.workflow.trace(f.id,customer);assert.equal(trace.receipts[0].amount_verified,1);assert(trace.orders.some(o=>o.order_id===candidate.order_id));assert(trace.decisions.some(d=>d.coupon_id===candidate.coupon_id));
  await f.step('complete');const completed=structuredClone(f.last);f.restart();assert.equal((await f.workflow.step(f.id,completed)).replayed,true);assert.equal(f.workflow.context(f.id).phase,'COMPLETED');assert.equal(f.state.creates,1);
  const all=f.workflow.customers(f.id);assert.equal(all.reduce((n,u)=>n+u.purchases,0),e.orders);assert.equal(all.reduce((n,u)=>n+u.coupons,0),e.coupons);assert.equal(all.reduce((n,u)=>n+u.redemptions,0),e.redemptions);
});

test('workflow HTTP reads are available while mutation requires the existing local-origin contract',async t=>{
  const f=await fixture(t);const server=createSupplyYardServer(f.paypal,undefined,f.market,null,f.workflow);await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const origin='http://127.0.0.1:'+server.address().port;
  const list=await (await fetch(origin+'/api/workflows')).json();assert.equal(list.workflows[0].workflowId,f.id);
  const bad=await fetch(origin+'/api/workflows/'+f.id+'/step',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(bad.status,403);
  const missing=await fetch(origin+'/api/workflows/'+f.id+'/trace?customer=foreign');assert.equal(missing.status,404);
});


test('observed market changes stop a multi-day advance at a durable planner-review checkpoint',async t=>{
  const f=await fixture(t,{scenario:'rival_sale'});await launch(f);
  await f.step('advance',{days:7},'before-change');
  const stopped=await f.step('advance',{days:7},'detect-change');
  assert.equal(stopped.output.completedDays,1);assert.equal(stopped.context.day,36);
  assert.equal(stopped.context.attention.indicator,'rival_promotion_exposure');
  const saved=structuredClone(f.last);f.restart();assert.equal((await f.workflow.step(f.id,saved)).replayed,true);
  await assert.rejects(()=>f.step('advance',{days:1},'needs-review'),{code:'PLANNER_REVIEW_REQUIRED'});
  await f.step('analyze',{windowDays:7,cuts:['market']},'inspect-change');
  await f.step('review',{decision:'continue'},'review-change');
  const priorModel=f.store.state(f.workflow.context(f.id).runId).champion.id;
  await f.step('train',{windowDays:21,modelTypes:['logistic','tree']},'train-during-campaign');
  assert.equal(f.workflow.context(f.id).phase,'MODEL_READY');
  assert.equal(f.store.state(f.workflow.context(f.id).runId).champion.id,priorModel);
  await f.step('review',{decision:'continue'},'keep-active-model');
  const finished=await f.step('advance',{days:6},'after-review');
  assert.equal(finished.context.phase,'OUTCOMES_READY');assert.equal(finished.context.day,42);
});

test('guided scripted demo runs real workflow checkpoints, pauses for review and reuses native effects on retries',async t=>{
  const f=await fixture(t);const demo=createCampaignDemo({workflow:f.workflow,market:f.market});
  let snap=demo.start({requestId:'playful-demo-test',seed:314,nativeSamples:1});
  const id=snap.context.workflowId;assert.equal(snap.context.planner,'SCRIPTED_DEMO');
  await assert.rejects(()=>demo.next(f.id,0),{code:'NOT_A_DEMO'});
  let count=0;
  while(snap.context.phase!=='COMPLETED'){
    const rev=snap.context.revision;snap=await demo.next(id,rev);assert(++count<25);
    const again=await demo.next(id,rev);assert.equal(again.replayed,true);assert.equal(again.context.revision,snap.context.revision);
  }
  const e=snap.context.evaluation;
  assert.equal(e.decisions,4800);assert.equal(snap.checks.holdoutCoupons,0);assert.equal(snap.checks.modelFits,1);assert.equal(f.state.creates,1);
  assert.equal(e.nativePayments.length,1);assert.equal(e.nativePayments[0].amount_verified,1);assert(snap.featured.receipts.length===1);
  assert.equal(snap.context.nativePayments.maxOrders,1);assert.equal(snap.context.nativePayments.remaining,0);
  assert(snap.context.modelSummaries.every(m=>m.source==='SCRIPTED_DEMO_LOCAL_SCIKIT_LEARN'));
  await assert.rejects(()=>f.market.mirror(snap.context.runId,[snap.context.nativePayments.candidates[0].order_id]),{code:'SAMPLE_CAP'});
  const actions=snap.context.checkpoints.map(c=>c.action);assert(actions.includes('review'));assert.equal(actions.filter(x=>x==='analyze').length,2);
  assert(snap.context.checkpoints.every(c=>c.actor==='scripted_demo'));
  assert.equal((await demo.next(id,snap.context.revision)).replayed,true);assert.equal(f.state.creates,1);
  assert(snap.checks.budgetSpentCents<=snap.checks.budgetLimitCents);
});

test('planner diagnostics use saved issued-offer predictions and exclude future and foreign observations',async t=>{
  const f=await fixture(t,{scenario:'rival_sale'});await launch(f);
  await f.step('advance',{days:7},'diagnostic-week');await f.step('advance',{days:7},'diagnostic-shock');
  const params={windowDays:14,cuts:['daily','model_health']};
  const a=await f.step('analyze',params,'diagnose-now'),health=a.output.modelHealth,run=a.context.runId;
  assert.equal(a.context.day,36);assert.equal(a.output.daily.length,14);
  assert.equal(health.missingOrInvalidScores,0);
  assert.deepEqual(health.byRivalExposure.map(r=>[r.value,r.observations]),[[0,700],[1,100]]);
  assert.equal(health.candidateTrainingSplit.rivalTrainingRows,0);
  assert.equal(health.candidateTrainingSplit.rivalValidationRows,100);
  const day=health.byDay.find(r=>r.value===35),scores=f.store.db.prepare('SELECT * FROM campaign_customer_decisions WHERE workflow_id=? AND day=35').all(f.id);
  const expected=scores.reduce((n,d)=>n+(d.issued_pct===10?d.p_ten:d.issued_pct===5?d.p_five:d.p_no_offer),0);
  assert(Math.abs(day.expectedPurchases-expected)<1e-10);
  assert(Number.isFinite(day.logLoss)&&day.logLoss>=0);
  const obs=f.store.db.prepare('SELECT * FROM customer_days WHERE run_id=? AND day=35 LIMIT 1').get(run);
  const d=scores.find(r=>r.customer_id===obs.customer_id);
  f.store.insert('customer_days',[{...obs,observation_id:'future-diagnostic-observation',day:36,purchased:1}]);
  f.store.insert('campaign_customer_decisions',[{...d,decision_id:'future-diagnostic-decision',day:36,p_no_offer:1}]);
  // Another workflow can contain the same days without entering this review.
  const other=f.workflow.create({...f.mission,requestId:'foreign-diagnostic-run'});
  const foreignWorld=f.store.state(other.runId);
  f.store.insert('customer_days',[{...obs,observation_id:'foreign-diagnostic-observation',run_id:other.runId,customer_id:foreignWorld.customers[0].customer_id,product_id:foreignWorld.products[0].product_id,purchased:1}]);
  const b=await f.step('analyze',params,'diagnose-again');
  assert.deepEqual(b.output.modelHealth,health);assert.deepEqual(b.output.daily,a.output.daily);
  assert(!JSON.stringify(b.output).includes('privateTraits'));
});
