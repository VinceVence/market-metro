// Rebuild the measured judge run locally. Neither preparation nor publication calls PayPal or Gemini.
import assert from 'node:assert/strict';
import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createMarketStore} from '../../market-store.mjs';
import {createAutonomyRoom} from '../../commerce-growth/autonomy/live.mjs';
import {key,legKey} from '../../commerce-growth/autonomy/live-data.mjs';
import {runCoordinatedCase} from '../runner.mjs';
import {openAllocator} from '../../commerce-deadlines/solver.mjs';
import {canonicalHash,validateTrialReceipt} from './contracts.mjs';
import {assertBinding,fitModel,read,scoreCampaign} from './tools.mjs';
import {verifyEconomy} from './trials.mjs';

const seed=92111706,folder='docs/commerce-expanded/model-check/reactivation-fresh';
const prepared='.local/judge-reactivation/prepared.json',published='demo/data/judge-reactivation.json';
const {lockHash,...decisions}=await read(join(folder,'decisions.json'));
const study=await read('demo/data/commerce-reactivation-fresh.json');
assert.equal(canonicalHash(decisions),lockHash);assert.equal(study.lockHash,lockHash);
assert.equal(canonicalHash((await verifyEconomy()).economyHashes),study.economyHash);
const result=study.cases.find(c=>c.seed===seed),agent=decisions.arms.find(a=>a.seed===seed&&a.arm==='single');
const verified=agent.comparison;
assert.ok(agent.complete && verified.status==='switched');
validateTrialReceipt(verified.receipt);assert.equal(verified.receipt.contractHash,agent.checked.hash);
const store=createMarketStore(resolve('.local/market-metro.sqlite'));
const save=async(path,obj)=>{await writeFile(path+'.tmp',JSON.stringify(obj)+'\n');await rename(path+'.tmp',path);};
function match(raw,saved,cost=0){
  for(const [actual,expected] of [[raw.platformUSD-cost,saved.paypal],[raw.retailerUSD,saved.merchants],
    [raw.retainedPurchases,saved.purchases],[raw.retainedVolumeUSD,saved.volume],[raw.unpaidLiabilities,0]])
    assert.ok(Math.abs(actual-expected)<1e-6,`Settlement mismatch: ${actual} vs ${expected}`);
}

async function prepare(){
  await mkdir('.local/judge-reactivation',{recursive:true});
  const review=JSON.parse(gunzipSync(await readFile(join(folder,'judge-review.json.gz'))));
  assert.equal(review.id,agent.id);assert.equal(review.schedule[0].hash,agent.checked.hash);
  assert.equal(review.modelCostUSD,agent.paidMicros/1e6);
  assert.deepEqual(review.checkpoints.filter(c=>c.actor==='GEMINI').map(c=>c.output),agent.decisions.map(d=>d.recommendation));
  const fixed=(await read('docs/commerce-growth/team-1/development/results.json')).selectedFixed;
  const prior=await read('docs/commerce-growth/team-1/training/model.json'),models=new Map();
  for(const spec of agent.models){
    let model;
    try{model=await read(join('.local/reactivation-fresh-r1',agent.id,'review-30','fit-'+spec.slot,'model.json'));}
    catch(e){if(e.code!=='ENOENT')throw e;
      const {rows}=await read('docs/commerce-growth/autonomy-1/funding-training/dataset.json');
      model=await fitModel(join('.local/judge-reactivation',spec.hash),rows,[],spec.spec,30);}
    assert.equal(model.modelHash,spec.hash);assert.deepEqual(model.report.metrics,spec.metrics);
    models.set(spec.hash,model);
  }
  for(const contract of [agent.checked,agent.original])assertBinding(contract,models.get(contract.modelHash));
  const settings={seed,regime:'reactivation'},price=agent.paidMicros/1e6;
  let day=-1;
  const room=createAutonomyRoom({store,autoPump:false,market:{mirror(){throw Error('OFFLINE_REPLAY');}},
    v2ControllerFactory:async()=>({
      async plan(view){day=view.day;if(day===30)assert.equal(canonicalHash(view),agent.snapshotHash);
        return scoreCampaign(view,{contract:agent.checked,model:models.get(agent.checked.modelHash),prior});},
      summary(){const ready=day>=30;return {version:review.version,modelCapUSD:review.modelCapUSD,mode:'single',
        failed:false,pending:false,checkpoints:ready?review.checkpoints:[],publications:ready?review.publications:[],
        schedule:ready?[agent.checked]:[],activeContract:ready?agent.checked:null,modelCalls:ready?6:0,
        modelCostUSD:ready?price:0,trainingJobs:ready?2:0,recordedReplay:{study:'reactivation-fresh-r1',
          sourceHash:lockHash,caseId:'pair6-single',originalModelCostUSD:price,newModelCostUSD:0}};},async close(){}
    })});
  let session;
  try{
    session=await room.start({requestId:'judge-single-'+agent.checked.hash,seed,regime:settings.regime,marketProfile:'expanded-12x600',
      harnessVersion:'v2',plannerMode:'single',modelCheck:true,sandbox:false});
    if(session.status==='RUNNING'){
      // Step the real day loop. Inspect status cheaply between steps instead of serializing the whole workspace 126 times.
      const status=store.db.prepare('SELECT status FROM autonomy_sessions WHERE id=?');
      for(let i=0;i<session.totalDays&&status.get(session.id).status==='RUNNING';i++)await room.step(session.id);
      session=room.snapshot(session.id);
    }
    assert.equal(session.status,'COMPLETED',session.warning);
    match(session.comparison.team,result.rows.single_checked);
    match(session.comparison.fixed,result.rows.fixed);
    assert.equal(session.settings.plannerMode,'single');assert.equal(session.settings.modelCheck,true);
  }finally{await room.close();}
  const {s,w}=JSON.parse(store.db.prepare('SELECT state_json FROM autonomy_sessions WHERE id=?').get(session.id).state_json);
  const retained=o=>o.day>=30 && o.status==='DELIVERED' && !o.refundStatus;
  const references={},allocator=openAllocator();
  try{
    for(const [name,contract] of [['fixed',null],['single_original',agent.original]]){
      const r=await runCoordinatedCase(settings,fixed,{allocator,prior,trace:true,
        controller:contract&&{plan:view=>scoreCampaign(view,{contract,model:models.get(contract.modelHash),prior})}});
      match(r,result.rows[name],contract?price:0);
      assert.equal(r.opportunityHash,result.opportunityHash);assert.equal(r.initialHash,s.initialHash);
      references[name]=new Set(r.trace.orders.filter(retained).map(o=>o.requestId));
    }
  }finally{allocator.close();}
  const choices=[];
  for(const order of w.orders.filter(retained)){
    if(order.merchants.length!==1||order.grossCents<1||order.grossCents>10000||references.fixed.has(order.requestId))continue;
    const contact=w.growth.contacts.find(c=>c.requestId===order.requestId && c.consentChecked && c.responded);
    if(!contact || contact.kind!=='recommend')continue;
    const item=order.items.find(i=>w.products.find(p=>p.id===i.productId)?.catalogId===contact.catalogId);
    if(!item)continue;
    const previous=w.orders.filter(o=>o.customerId===order.customerId && o.day<contact.day && !o.refundStatus).at(-1);
    const gap=previous?contact.day-previous.day:null;
    choices.push({order,contact,item,previous,gap,originalBought:references.single_original.has(order.requestId)});
  }
  // Prefer a returning shopper who was quiet for two weeks, then a purchase added by the verifier.
  choices.sort((a,b)=>Number(b.gap>=14)-Number(a.gap>=14)||Number(a.originalBought)-Number(b.originalBought)||a.order.day-b.order.day||a.order.id.localeCompare(b.order.id));
  assert.ok(choices.length,'No eligible outreach purchase in the verified market');
  const {order,contact,item,gap,previous,originalBought}=choices[0],runId=session.runId;
  const customer=key(runId,order.customerId),orderId=legKey(runId,order,order.merchants[0]);
  const request=w.requests.find(q=>q.id===order.requestId),delivery=w.deliveries.find(d=>d.orderId===order.id);
  const row=store.db.prepare('SELECT order_id,customer_id,merchant_id,total_cents,status,currency FROM orders WHERE run_id=? AND order_id=?').get(runId,orderId);
  assert.ok(row && request?.contactId===contact.id && delivery && row.status==='PAID' && row.currency==='USD');
  assert.equal(row.customer_id,customer);assert.equal(row.total_cents,order.grossCents);
  const findFrame=store.db.prepare('SELECT frame_json FROM autonomy_frames WHERE run_id=? AND day=?');
  const frames={};
  for(const d of new Set([1,31,contact.day+1,order.day+1,delivery.day+1,session.liveDay])){
    const f=JSON.parse(findFrame.get(runId,d).frame_json);
    const shown=new Set(Array.from({length:f.visibleCustomerLimit},(_,i)=>f.customers[Math.floor(i*f.customers.length/f.visibleCustomerLimit)].id));shown.add(customer);
    frames[d]={runId,tick:f.tick,merchantCount:f.merchantCount,customerCount:f.customerCount,
      visibleCustomerLimit:shown.size,featuredIds:[customer],merchants:f.merchants.map(({merchant_id,name,sold,stock,position,category})=>({merchant_id,name,sold,stock,position,category})),
      customers:f.customers.filter(u=>shown.has(u.id)).map(({id,index,name,segment,lastAction,lastMerchant,purchases,offers})=>({id,index,name,segment,lastAction,lastMerchant,purchases,offers})),
      activities:f.activities.filter(e=>e.customerId===customer),orders:f.stats.orders};
  }
  const checkpoints=review.checkpoints,overview=checkpoints[0].input.overview;
  const analysis=checkpoints.find(c=>c.actor==='LOCAL_ANALYSIS').output.current;
  const dataset=agent.decisions.find(d=>d.tool==='define_dataset').recommendation;
  const proposal=agent.decisions.find(d=>d.tool==='propose_campaign_trial').recommendation;
  const rank=w.decisions.find(d=>d.day===contact.day)?.ranking.find(r=>r.customerId===order.customerId);
  assert.ok(rank?.modelId && rank.modelId===verified.alternative.modelId);
  const product=w.products.find(p=>p.id===item.productId);
  const snapshot={version:1,lockHash,seed,sessionId:session.id,runId,source:'RECORDED_REACTIVATION_SIMULATION',
    evidence:{categories:analysis.categories,openFundedRequests:analysis.openFundedRequests,observedContacts:overview.ownMature.observations,
      historicalRows:overview.historical.observations,retained:overview.historical.retained,retainedAfterDelay:overview.historical.retainedWithoutImmediateFunding},
    decision:{dataset:dataset.featureView,window:Number(dataset.windowDays),kind:agent.checked.campaign.kind,
      per100:agent.checked.campaign.contactsPer100,rationale:proposal.rationale,reviewCostUSD:price,decisions:agent.decisions.length,
      original:verified.anchor,chosen:verified.alternative,contractHash:agent.checked.hash},
    shopper:{name:w.people.find(p=>p.id===order.customerId).index+1,id:customer,contactId:contact.id,contactDay:contact.day+1,
      previousDay:previous?previous.day+1:null,daysSincePurchase:gap,requestId:request.id,fundedDay:request.authorizedDay+1,
      purchaseDay:order.day+1,deliveryDay:delivery.day+1,onTime:delivery.onTime,basketId:order.id,orderId,merchantId:row.merchant_id,
      merchant:w.merchants.find(m=>m.id===order.merchants[0].id).name,product:product.title,
      items:order.items.map(i=>({title:w.products.find(p=>p.id===i.productId).title,quantity:i.quantity})),grossCents:row.total_cents,
      fixedBought:false,originalBought,modelId:rank.modelId},
    fixed:result.rows.fixed,planner:result.rows.single_checked,vsFixed:result.comparisons.singleVsFixed,vsOriginal:result.comparisons.singleVerifier,
    marketDays:100,settledDay:session.liveDay,frames};
  await save(prepared,snapshot);
  console.log(JSON.stringify({session:session.id,runId,orderId,grossCents:row.total_cents,customer,previousGap:gap,originalBought}));
}

async function publish(){
  const file=await read(prepared),shopper=file.shopper;
  assert.equal(file.lockHash,lockHash);assert.equal(file.seed,seed);assert.deepEqual(file.planner,result.rows.single_checked);
  const receipts=store.db.prepare(`SELECT p.receipt_id,p.run_id,p.order_id,p.merchant_id,p.source,p.currency,p.status,
    p.paypal_order_id,p.capture_id,p.gross_cents,p.fee_cents,p.net_cents,p.captured_at,p.verified_at,o.customer_id,o.total_cents
    FROM paypal_receipts p JOIN orders o ON p.order_id=o.order_id AND p.run_id=o.run_id AND p.merchant_id=o.merchant_id
    WHERE p.run_id=?`).all(file.runId);
  assert.equal(receipts.length,1,'Exactly one joined PayPal test receipt is required to publish');
  const {customer_id,total_cents,...receipt}=receipts[0];
  assert.equal(receipt.source,'PAYPAL_SANDBOX');assert.equal(receipt.status,'COMPLETED');assert.equal(receipt.currency,'USD');
  assert.equal(receipt.order_id,shopper.orderId);assert.equal(receipt.merchant_id,shopper.merchantId);assert.equal(customer_id,shopper.id);
  assert.equal(receipt.gross_cents,shopper.grossCents);assert.equal(total_cents,receipt.gross_cents);
  assert.ok(Number.isInteger(receipt.fee_cents)&&Number.isInteger(receipt.net_cents));assert.equal(receipt.fee_cents+receipt.net_cents,total_cents);
  assert.ok(receipt.capture_id&&receipt.paypal_order_id&&receipt.verified_at);
  await save(published,{...file,receipt});
  console.log('Published verified judge replay',receipt.capture_id);
}
try{if(process.argv.includes('--publish'))await publish();else await prepare();}finally{store.close();}
