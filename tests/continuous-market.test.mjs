import test from 'node:test';
import assert from 'node:assert/strict';
import {createMarketStore} from '../scripts/market-store.mjs';
import {createMarketService} from '../scripts/market-service.mjs';
import {createContinuousMarket,localMarketingChoice,validateLiveChoice,CONTINUOUS_TOOLS,continuousFunctions} from '../scripts/marketing/continuous-market.mjs';
import {SAMPLE_PRODUCTS} from '../demo/market/engine.mjs';
import {trainRecommender,rankProducts} from '../scripts/marketing/recommender.mjs';
import {continuousReport} from '../scripts/marketing/continuous-report.mjs';

function fitted(w){const coef=Array(23).fill(0);coef[11]=3;return {status:'PROMOTED',reason:'Explicit test fixture model',model_type:'logistic',training_rows:6300,validation_rows:2100,train_through_day:w.tick-8,validation_from_day:w.tick-7,validation_through_day:w.tick-1,validation_log_loss:.2,baseline_log_loss:.3,candidates:[],artifact:{type:'logistic',coef,mean:Array(23).fill(0),scale:Array(23).fill(1),intercept:-2}};}
function fixture(t,options={}){const store=createMarketStore(),paypal={status:()=>({configured:false}),profileKey:()=> 'TEST',list:()=>[],requestSandbox:()=>{throw Error('NO_PAYMENT_ALLOWED');}},catalog={products:()=>structuredClone(SAMPLE_PRODUCTS),status:()=>({mode:'SAMPLE'})};const market=createMarketService({store,paypal,catalog});const live=createContinuousMarket({store,market,autoTimers:false,clientFactory:()=>{throw Error('NO_CLOUD_ALLOWED');},...options});t.after(async()=>{await live.close();store.close();});return {store,market,live};}

test('shopping continues while a model is fitting; publication never rewinds market records',async t=>{
  let finishFit,entered;const trainingStarted=new Promise(r=>entered=r);
  const f=fixture(t,{trainImpl:async(_s,w)=>{entered();return new Promise(r=>finishFit=()=>r(fitted(w)));}});
  const start=f.live.start({clockUnit:'day',requestId:'continuous-test-314',seed:314,mode:'local',campaigns:['reactivation'],objective:'reactivation'}),id=start.runId;
  assert.equal(start.day,28);assert.equal(start.people.returned,0);assert.equal(start.people.returnedWithCoupon,0);assert.equal(start.payments.candidates.length,0);assert.equal(f.live.start({clockUnit:'day',requestId:'continuous-test-314',seed:314,mode:'local',campaigns:['reactivation'],objective:'reactivation'}).runId,id);
  f.live.tick(id,{triggerReview:false});f.live.tick(id,{triggerReview:false});
  const work=f.live.review(id);await trainingStarted;
  const before=f.live.snapshot(id),ordersBefore=f.store.table('orders',id).count;assert.equal(before.team.teamStatus,'TRAINING');
  for(let i=0;i<3;i++)f.live.tick(id,{triggerReview:false});
  assert.equal(f.live.snapshot(id).day,33);assert(f.store.table('orders',id).count>ordersBefore);
  await assert.rejects(()=>f.market.advance(id,1),/independent market clock/);
  finishFit();await work;
  const after=f.live.snapshot(id);assert.equal(after.day,33);assert.equal(after.analysis.asOfDay,33);assert.equal(after.log.find(r=>r.action==='OBSERVE_TRENDS').evidence.asOfDay,30);assert.equal(after.team.plan.effectiveDay,33);
  assert.equal(after.log.find(r=>r.action==='MODEL_RESULT').evidence.marketDaysDuringJob,3);
  assert.equal(f.store.db.prepare('SELECT MAX(day) n FROM customer_days WHERE run_id=?').get(id).n,32);
  assert.equal(f.store.db.prepare('SELECT validation_through_day FROM model_runs WHERE run_id=?').get(id).validation_through_day,29);
  f.live.control(id,{action:'toggle_team'});const tick=f.live.snapshot(id).day;f.live.tick(id);assert.equal(f.live.snapshot(id).day,tick+1);
  for(let i=0;i<16;i++)f.live.tick(id,{triggerReview:false});
  const final=f.live.snapshot(id);assert(final.people.returned>0);assert(f.store.db.prepare('SELECT COUNT(*) n FROM coupons WHERE run_id=? AND issued_day>=33').get(id).n>0);
  assert.equal(final.team.modelCalls,0);assert.equal(final.payments.receipts.length,0);
  const published=new Set(after.team.plan.productIds);
  for(const c of f.store.db.prepare('SELECT * FROM coupons WHERE run_id=? AND issued_day>=33').all(id)){
    assert(published.has(c.product_id));assert(c.issued_day<after.team.plan.expiresDay);
    const u=f.store.state(id).customers.find(u=>u.customer_id===c.customer_id);assert.equal(u.arm,'TARGETABLE');
    const observed=f.store.db.prepare('SELECT recency_days FROM customer_days WHERE run_id=? AND day=? AND customer_id=?').get(id,c.issued_day,c.customer_id);assert(observed.recency_days>=7);
  }
  const paused=f.live.control(id,{action:'pause'}).day;f.live.tick(id);assert.equal(f.live.snapshot(id).day,paused);
});

test('Gemini adapter uses dated public evidence and metered choices without owning the shopping clock',async t=>{
  let calls=0;const client={events:[],async json(_prompt,packet){calls++;assert(!JSON.stringify(packet).includes('privateTraits'));assert(!JSON.stringify(packet).includes('weeklyIncome'));this.events.push({status:'settled',modelCostMicros:100});return {name:'submit_marketing_choice',args:localMarketingChoice(packet,packet.stage)};}};
  const f=fixture(t,{trainImpl:async(_s,w)=>fitted(w),clientFactory:async()=>({client,close:async()=>{}})});
  const id=f.live.start({clockUnit:'day',requestId:'continuous-gemini-fake',seed:314,mode:'gemini',campaigns:['reactivation'],objective:'reactivation'}).runId;f.live.tick(id,{triggerReview:false});f.live.tick(id,{triggerReview:false});await f.live.review(id);
  const s=f.live.snapshot(id);assert.equal(calls,2);assert.equal(s.team.modelCostMicros,200);assert.equal(s.clock,'RUNNING');assert(s.team.plan);
  const report=f.live.analyze(id);assert.equal(localMarketingChoice({...report,remainingBudgetCents:0},'publish').decision,'wait');assert.throws(()=>validateLiveChoice({...localMarketingChoice(report,'research'),productIds:['FOREIGN']},report),/observed products/);
  assert.throws(()=>validateLiveChoice({...localMarketingChoice(report,'research'),evidenceDay:report.asOfDay+1},report),/snapshot day/);
  assert.throws(()=>validateLiveChoice({...localMarketingChoice(report,'research'),offerPct:90},report),/bounded campaign/);
});

test('an analyst failure does not stop shopping or publish an unvalidated campaign',async t=>{
  const f=fixture(t,{clientFactory:async()=>{throw Error('TEST_PROVIDER_FAILURE');}}),id=f.live.start({clockUnit:'day',requestId:'continuous-error-fixture',seed:22,mode:'gemini'}).runId;
  await f.live.review(id);const s=f.live.snapshot(id);assert.equal(s.clock,'RUNNING');assert.equal(s.team.teamStatus,'ERROR');assert.equal(s.team.plan,null);
  f.live.tick(id);assert.equal(f.live.snapshot(id).day,s.day+1);
});

test('configured full-price recommendations produce exposures, independent responses and joined payments',async t=>{
  const f=fixture(t,{trainImpl:async()=>{throw Error('RECOMMENDATIONS_DO_NOT_NEED_OFFER_MODEL');}});
  const input={clockUnit:'day',mode:'local',requestId:'ranker-world-test',seed:314,merchantCount:6,customerCount:100,campaigns:['recommendation'],objective:'discovery',budgetCents:900,totalDays:60,dayMs:5000,reviewEveryDays:7};
  const id=f.live.start(input).runId;assert.equal(f.live.start(input).runId,id);
  assert.throws(()=>f.live.start({clockUnit:'day',...input,merchantCount:8}),/different settings/);
  assert.throws(()=>f.live.start({clockUnit:'day',...input,requestId:'invalid-campaign',campaigns:['spam']}),/supported campaign/);
  const w=f.store.state(id);assert.equal(w.merchants.length,6);assert.equal(w.customers.length,100);assert.equal(w.totalTicks,60);
  f.live.tick(id,{triggerReview:false});f.live.tick(id,{triggerReview:false});await f.live.review(id);
  const published=f.live.snapshot(id);assert.equal(published.team.plan.campaignType,'recommendation');assert.equal(published.team.plan.offerPct,0);assert.equal(published.team.modelCalls,0);
  assert(!JSON.stringify(published).includes('profiles'));assert.equal(published.team.recommender.cutoff,30);
  const frozen=structuredClone(f.store.state(id)),fit=trainRecommender(f.store,frozen);
  for(let i=0;i<9;i++)f.live.tick(id,{triggerReview:false});
  assert.deepEqual(trainRecommender(f.store,frozen).artifact,fit.artifact,'future data must not enter a frozen fit');
  const exposures=f.store.db.prepare('SELECT * FROM recommendations WHERE run_id=?').all(id);
  assert(exposures.length>0);assert(exposures.some(r=>!r.clicked));assert(exposures.some(r=>r.clicked&&!r.order_id));assert(exposures.some(r=>r.order_id));
  assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM coupons WHERE run_id=? AND issued_day>=28').get(id).n,0);
  for(const r of exposures){assert.equal(w.customers.find(u=>u.customer_id===r.customer_id).arm,'TARGETABLE');assert(r.day>=30&&r.day<40);const ranked=JSON.parse(r.alternatives_json);assert.equal(ranked[0].productId,r.product_id);}
  const journey=f.store.table('v_recommendation_journey',id,{limit:500}).rows;assert.equal(journey.length,exposures.length);
  const bought=journey.find(r=>r.order_id);assert(bought.transaction_id);assert.equal(bought.discount_cents,0);assert.equal(bought.capture_id,null);
  const trace=f.live.trace(id,bought.customer_id);assert.equal(trace.story.kind,'recommendation');assert(trace.story.decision);assert(trace.story.model);assert.equal(trace.story.receipt,undefined);assert(trace.story.payment);
  assert(f.live.snapshot(id).frame.live.budgetSpentCents<=input.budgetCents);
  const rec0=fit.artifact;assert.equal(rankProducts(rec0,w.products,'new-customer').length,18);
  const report=f.live.analyze(id);assert.equal(localMarketingChoice({...report,remainingBudgetCents:0},'publish').decision,'wait');
  assert.throws(()=>validateLiveChoice({...localMarketingChoice(report,'publish'),offerPct:10},report),/compatible/);
  assert.throws(()=>validateLiveChoice({...localMarketingChoice(report,'publish'),campaignType:'reactivation'},report),/enabled/);
});

test('different configured objectives can select different campaigns; disabled types cannot be published',async t=>{
  const f=fixture(t),id=f.live.start({clockUnit:'day',mode:'local',requestId:'strategy-choice-test',seed:314}).runId,report=f.live.analyze(id);
  const common={...report,model:{available:true},recommender:{available:true,cutoff:28},enabledCampaigns:['recommendation','reactivation','trend_promotion']};
  assert.equal(localMarketingChoice({...common,businessObjective:'discovery'},'publish').campaignType,'recommendation');
  assert.equal(localMarketingChoice({...common,businessObjective:'reactivation',lapsedCustomers:290},'publish').campaignType,'reactivation');
  assert.equal(localMarketingChoice({...common,businessObjective:'conversion',products:common.products.map(p=>({...p,previousViews:0,recentViews:100}))},'publish').campaignType,'trend_promotion');
});

test('a fitted recommendation candidate cannot serve shoppers before the publication checkpoint',async t=>{
  let publish,atPublish;const waiting=new Promise(r=>atPublish=r),client={events:[],async json(_prompt,packet){
    const choice={name:'submit_marketing_choice',args:localMarketingChoice(packet,packet.stage)};
    if(packet.stage==='publish'){atPublish();return new Promise(r=>publish=()=>r(choice));}return choice;
  }};
  const f=fixture(t,{clientFactory:async()=>({client,close:async()=>{}})}),id=f.live.start({clockUnit:'day',requestId:'pending-ranker-publication',mode:'gemini',campaigns:['recommendation'],objective:'discovery'}).runId;
  const job=f.live.review(id);await waiting;
  assert(f.store.state(id).continuous.recommenderCandidate);assert.equal(f.store.state(id).continuous.recommender,undefined);
  f.live.tick(id,{triggerReview:false});assert.equal(f.store.table('recommendations',id).count,0);
  publish();await job;f.live.tick(id,{triggerReview:false});assert(f.store.table('recommendations',id).count>0);
});

test('hourly markets begin empty at Day 1 and persist real hourly events without future training rows',async t=>{
  const f=fixture(t),start=f.live.start({mode:'local',requestId:'hourly-day-one-test',seed:314,customerCount:50,merchantCount:4,totalDays:42,hourMs:100,campaigns:['recommendation']});
  const id=start.runId;
  assert.deepEqual(start.simTime,{day:1,hour:0,elapsedHours:0,completedDays:0,complete:false});
  assert.equal(start.log.find(row=>row.action==='SET_OBJECTIVE').evidence.marketTime.day,1);
  assert.equal(start.clock,'PAUSED');assert.equal(f.store.table('orders',id).count,0);assert.equal(f.store.table('customer_days',id).count,0);
  assert.throws(()=>f.live.control(id,{action:'analyze'}),/28 completed days/);
  f.live.control(id,{action:'resume'});
  for(let h=0;h<12;h++)f.live.tick(id,{triggerReview:false});
  assert.equal(f.live.snapshot(id).simTime.hour,12);assert.equal(f.store.state(id).daily.length,0);
  assert(f.store.table('customer_days',id).count>0);assert(f.store.table('customer_days',id).count<50);
  f.live.control(id,{action:'pause'});f.live.tick(id);assert.equal(f.live.snapshot(id).simTime.hour,12);
  f.live.control(id,{action:'resume'});
  for(let h=12;h<24;h++)f.live.tick(id,{triggerReview:false});
  assert.equal(f.store.table('customer_days',id).count,50);assert.equal(f.store.state(id).daily.length,1);
  assert.equal(f.live.snapshot(id).simTime.day,2);assert.equal(f.live.snapshot(id).simTime.hour,0);
  assert(f.store.db.prepare("SELECT COUNT(DISTINCT json_extract(detail_json,'$.hour')) n FROM events WHERE run_id=?").get(id).n>1);
  const completed=f.store.state(id),frozen=trainRecommender(f.store,completed);
  for(let h=0;h<8;h++)f.live.tick(id,{triggerReview:false});
  assert.equal(trainRecommender(f.store,completed).datasetHash,frozen.datasetHash);
  assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM (SELECT customer_id,day,COUNT(*) c FROM customer_days WHERE run_id=? GROUP BY customer_id,day HAVING c>1)').get(id).n,0);
  assert.equal(f.live.snapshot(id).team.modelCalls,0);
});

test('hourly campaign launch and daily budgets survive a full season',async t=>{
  const f=fixture(t),id=f.live.start({mode:'local',requestId:'hourly-full-season',seed:314,customerCount:50,merchantCount:4,totalDays:42,budgetCents:500,objective:'discovery',campaigns:['recommendation']}).runId;
  f.live.control(id,{action:'resume'});
  for(let h=0;h<30*24;h++)f.live.tick(id,{triggerReview:false});
  await f.live.review(id);assert.equal(f.live.snapshot(id).team.plan.campaignType,'recommendation');
  for(let h=30*24;h<42*24;h++)f.live.tick(id,{triggerReview:false});
  const s=f.live.snapshot(id);assert.equal(s.clock,'COMPLETE');assert.equal(s.simTime.elapsedHours,42*24);
  assert.equal(f.store.table('customer_days',id).count,50*42);assert.equal(f.store.state(id).daily.length,42);
  assert(f.store.table('recommendations',id).count>0);assert(s.frame.live.budgetSpentCents<=500);
  assert.equal(f.store.table('orders',id).count,f.store.table('deliveries',id).count);
  assert.deepEqual(f.store.db.prepare('PRAGMA foreign_key_check').all(),[]);
  assert.throws(()=>f.live.control(id,{action:'resume'}),/completed/);
});

test('100-day Gemini reviews retain actual choices, costs and statistics beyond three cycles',async t=>{
  const f=fixture(t,{clientFactory:async()=>({client:{events:[],async json(_prompt,packet){this.events.push({status:'settled',modelCostMicros:100,inputTokens:200,outputTokens:50});return {name:'submit_marketing_choice',args:localMarketingChoice(packet,packet.stage)};}},close:async()=>{}})});
  const id=f.live.start({requestId:'hundred-day-fake-gemini',clockUnit:'day',mode:'gemini',totalDays:100,customerCount:50,merchantCount:4,objective:'discovery',campaigns:['recommendation']}).runId;
  assert.equal(f.live.snapshot(id).team.maxReviews,10);
  while(f.store.state(id).tick<100){
    const day=f.store.state(id).tick;
    if(day>=30&&(day-30)%7===0)await f.live.review(id);
    f.live.tick(id,{triggerReview:false});
  }
  const r=continuousReport(f.store,id);
  assert.equal(r.completedDays,100);assert.equal(r.planner.reviews,10);assert.equal(r.planner.validatedDecisions,20);assert.equal(r.planner.meteredCostMicros,2000);
  assert.equal(r.models.recommenderFits,10);assert.equal(r.decisions.length,20);assert.equal(r.dailyDecisionCounts.length,71);
  assert.equal(r.phases.live.recommendations,f.store.table('recommendations',id).count);
  assert.equal(r.totals.couponsIssued,f.store.table('coupons',id).count);
  assert.equal(r.totals.purchases,f.store.table('orders',id).count);
  assert(r.decisions.every(d=>d.rationale&&d.evidenceThroughDay>=30));
  assert(r.workerLog.filter(d=>d.action==='FIT_RECOMMENDER').every(d=>d.source==='LOCAL_TOOL_CONTINUOUS_MARKETING'));
});

test('a contract correction is recorded and counted, with no scripted replacement decision',async t=>{
  let calls=0;const client={events:[],async json(_prompt,packet){calls++;this.events.push({status:'settled',modelCostMicros:100});const args=localMarketingChoice(packet,packet.stage);if(calls===1)args.productIds=['FOREIGN_PRODUCT'];if(calls===2)assert(packet.previousValidationError);return {name:'submit_marketing_choice',args};}};
  const f=fixture(t,{clientFactory:async()=>({client,close:async()=>{}})}),id=f.live.start({requestId:'correct-contract-test',clockUnit:'day',mode:'gemini',customerCount:50,merchantCount:4,objective:'discovery',campaigns:['recommendation']}).runId;
  f.live.tick(id,{triggerReview:false});f.live.tick(id,{triggerReview:false});await f.live.review(id);
  const r=continuousReport(f.store,id);assert.equal(calls,3);assert.equal(r.planner.rejectedOrFailed,1);assert.equal(r.planner.validatedDecisions,2);assert.equal(r.planner.meteredCostMicros,300);
  assert.deepEqual(r.decisions.map(d=>d.status),['REJECTED','VALIDATED','VALIDATED']);
});

test('Vertex tool schemas use string enums and keep discount values numeric',()=>{
  function check(value){if(!value||typeof value!=='object')return;if(value.enum)assert(value.enum.every(x=>typeof x==='string'));for(const child of Object.values(value))check(child);}
  check(CONTINUOUS_TOOLS);assert.equal(CONTINUOUS_TOOLS[0].parameters.properties.offerPct.type,'INTEGER');
});

test('publication exposes only ready campaigns and cannot pretend to retrain',()=>{
  const report={enabledCampaigns:['recommendation','reactivation','trend_promotion'],recommender:{available:true},model:{available:false}};
  const props=continuousFunctions('publish',report)[0].parameters.properties;
  assert.deepEqual(props.campaignType.enum,['recommendation']);
  assert.deepEqual(continuousFunctions('publish',{...report,recommender:null})[0].parameters.properties.decision.enum,['wait']);
  const packet={...report,asOfDay:30,products:[{productId:'P1'}]};
  const choice={decision:'launch',campaignType:'recommendation',retrain:true,modelTypes:['tree'],productIds:['P1'],offerPct:0,objective:'discovery',rationale:'Recorded observations support this product.',evidenceDay:30};
  assert.throws(()=>validateLiveChoice(choice,packet,'publish'),/cannot train/);
  assert.equal(validateLiveChoice({...choice,retrain:false},packet,'publish').decision,'launch');
});
