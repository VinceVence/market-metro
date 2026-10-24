import test from 'node:test';
import assert from 'node:assert/strict';
import {createMarketStore} from '../scripts/market-store.mjs';
import {createMarketService} from '../scripts/market-service.mjs';
import {createCampaignWorkflow} from '../scripts/marketing/workflow.mjs';
import {createJudgeDemo} from '../scripts/marketing/judge-demo.mjs';
import {demoTimeline,demoFrame} from '../demo/garden/demo-timeline.mjs';
import {campaignStories,guidedTimeline,marketTrend} from '../demo/garden/campaign-story.mjs';
import {SAMPLE_PRODUCTS} from '../demo/market/engine.mjs';

test('judge view replays exact days, sampled rows and same-run receipts without effects',async()=>{
  const store=createMarketStore();let calls=0,providerOrder;
  const paypal={status:()=>({configured:true,mode:'SANDBOX'}),profileKey:()=> 'PRIVATE_PROFILE',list:()=>[],async requestSandbox(path,args){if(path!=='/v2/checkout/orders')return structuredClone(providerOrder);calls++;const unit=structuredClone(args.body.purchase_units[0]);unit.payee={merchant_id:'TESTSTORE'};unit.payments={captures:[{id:'CAPTURETEST000001',status:'COMPLETED',amount:unit.amount,create_time:'2026-10-23T08:00:00Z'}]};providerOrder={id:'ORDERTEST000001',status:'COMPLETED',purchase_units:[unit]};return structuredClone(providerOrder);}};
  const funding={status:()=>({ready:true}),fingerprint:()=> 'PRIVATE_FINGERPRINT',paymentSource:()=>({paypal:{vault_id:'PRIVATE_TOKEN'}})};
  const market=createMarketService({store,paypal,funding,catalog:{products:()=>structuredClone(SAMPLE_PRODUCTS),status:()=>({mode:'SAMPLE',productCount:SAMPLE_PRODUCTS.length})}});
  const workflow=createCampaignWorkflow({store,market,trainImpl:async(_s,w)=>{const coef=Array(23).fill(0);coef[11]=3;return {status:'PROMOTED',reason:'Fixture only',model_type:'logistic',training_rows:2100,validation_rows:700,train_through_day:w.tick-8,validation_from_day:w.tick-7,validation_through_day:w.tick-1,validation_log_loss:.3,baseline_log_loss:.5,candidates:[],artifact:{type:'logistic',coef,intercept:-2,mean:Array(23).fill(0),scale:Array(23).fill(1)}};}});
  try{
    let c=workflow.create({requestId:'judge-view-test',mission:'Check the visual campaign event stream.',seed:42,customerCount:100,budgetCents:30000,objective:'profit',scenario:'rival_sale',nativeSamples:1});
    const id=c.workflowId,step=async(action,parameters={})=>{c=workflow.context(id);const r=await workflow.step(id,{requestId:'test-'+c.revision,action,parameters,expectedRevision:c.revision,contextHash:c.contextHash,actor:'assistant_in_current_chat',rationale:'Explicit test fixture action from observed workflow state.',evidenceIds:[c.checkpoints.filter(p=>p.status==='COMPLETED').at(-1).checkpoint_id]});c=r.context;return r.output;};
    const view=createJudgeDemo({store,workflow,market});assert.equal(view.snapshot(id).days.length,0);
    await step('prepare_history');await step('analyze',{windowDays:14,cuts:['merchants']});const model=await step('train',{windowDays:28,modelTypes:['logistic','tree']});
    const plan=await step('draft_campaign',{title:'Test seeded campaign',message:'Use this coupon on its issued day.',modelId:model.modelId,merchantIds:market.frame(c.runId).merchants.map(m=>m.merchant_id),offerOptions:[5,10],minRecencyDays:0,minExpectedGainCents:0,ranking:'contribution',durationDays:14});await step('launch',{planId:plan.planId});
    await step('advance',{days:7});await step('advance',{days:7});await step('review',{decision:'continue'});await step('advance',{days:6});await step('settle');
    const candidate=c.nativePayments.candidates.find(o=>o.coupon_id);assert(candidate);await step('capture_samples',{orderIds:[candidate.order_id]});await step('evaluate');await step('complete');
    const before=store.catalog(c.runId).map(x=>[x.name,x.count]),snapshot=view.snapshot(id),again=view.snapshot(id);assert.strictEqual(snapshot,again);assert.equal(calls,1);assert.deepEqual(store.catalog(c.runId).map(x=>[x.name,x.count]),before);
    assert.equal(snapshot.days.length,44);assert(snapshot.days.every((d,i)=>d.day===i));assert.equal(snapshot.days.reduce((n,d)=>n+d.purchases,0),store.db.prepare('SELECT COUNT(*) n FROM orders WHERE run_id=?').get(c.runId).n);
    for(const day of snapshot.days)for(const e of day.events){if(e.kind==='purchase'){const o=store.db.prepare('SELECT * FROM orders WHERE order_id=?').get(e.orderId);assert.equal(o.total_cents,e.amountCents);assert.equal(o.customer_id,e.customerId);assert.equal(o.event_date,day.date);}if(e.kind==='coupon')assert(store.db.prepare('SELECT 1 FROM coupons WHERE coupon_id=? AND issued_day=?').get(e.couponId,day.day));}
    const timeline=demoTimeline(snapshot),daySteps=timeline.filter(s=>s.kind==='day');assert.deepEqual(daySteps.map(s=>s.day),Array.from({length:44},(_,i)=>i));
    const receiptIndex=timeline.findIndex(s=>s.checkpoint?.action==='capture_samples');assert(receiptIndex>0);assert(timeline.slice(0,receiptIndex).every(s=>!s.receiptsVisible));assert(timeline[receiptIndex].receiptsVisible);
    assert.equal(demoFrame(snapshot,daySteps[0]).tick,1);assert.equal(demoFrame(snapshot,daySteps[0]).receipts.length,0);assert.equal(demoFrame(snapshot,timeline[receiptIndex]).receipts.length,1);
    const firstDayOrders=snapshot.days[0].purchases;assert.equal(demoFrame(snapshot,daySteps[0]).merchants.reduce((n,m)=>n+m.sold,0),firstDayOrders);
    const guided=guidedTimeline(timeline),skip=guided.find(s=>s.kind==='history_skip');assert.equal(skip.days.length,25);
    assert.deepEqual(guided.filter(s=>s.kind==='day').slice(0,3).map(s=>s.day),[0,1,27]);
    assert.equal(guided.filter(s=>s.kind==='day').length+skip.days.length,44);
    const stories=campaignStories(snapshot),rawStories=campaignStories(c);
    assert.equal(stories.find(s=>s.action==='train').day,28);assert.equal(stories.find(s=>s.action==='review').day,36);
    assert.deepEqual(stories.map(s=>[s.day,s.title,s.choice]),rawStories.map(s=>[s.day,s.title,s.choice]));
    assert(stories.find(s=>s.action==='review').result[0].includes('No retraining'));
    const text=JSON.stringify(snapshot);for(const privateValue of ['PRIVATE_TOKEN','PRIVATE_PROFILE','PRIVATE_FINGERPRINT','privateTraits','artifact_json'])assert(!text.includes(privateValue));
  }finally{store.close();}
});

test('plain-language explanations use preceding evidence and keep a market signal separate from causality',()=>{
  const analysis=(id,previous,current,rival=0)=>({id,action:'analyze',status:'COMPLETED',parameters:{windowDays:14,cuts:['market']},output:{observations:4200,market:[{label:'previous7',observations:2100,purchases:previous,observedRivalPromotionRate:0},{label:'latest7',observations:2100,purchases:current,observedRivalPromotionRate:rival}]}});
  const data={goal:{budgetCents:30000},startDay:28,checkpoints:[{id:'history',action:'prepare_history',status:'COMPLETED',output:{completedDays:28}},analysis('before',141,156),{id:'train',action:'train',actor:'vertex_planner',status:'COMPLETED',parameters:{windowDays:28,modelTypes:['logistic','tree']},output:{status:'PROMOTED',model_type:'logistic',training_rows:6300,validation_rows:2100,validation_log_loss:.222,baseline_log_loss:.264}},analysis('future',155,114,1)]};
  const stories=campaignStories(data),training=stories.find(s=>s.id==='train');
  assert(training.knew.join(' ').includes('141 to 156'));assert(!JSON.stringify(training).includes('114'));
  assert.equal(training.who,'Gemini');assert(training.result.join(' ').includes('Lower is better'));
  assert(stories.at(-1).result.join(' ').includes('does not prove'));
  assert.equal(marketTrend({market:[]}),null);
});
