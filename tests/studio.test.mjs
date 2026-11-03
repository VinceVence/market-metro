import test from 'node:test';
import assert from 'node:assert/strict';
import {createMarketStore} from '../scripts/market-store.mjs';
import {authoredCatalog,usableCatalog} from '../scripts/behavior-v4/catalog.mjs';
import {createRunner,run} from '../scripts/behavior-v4/runner.mjs';
import {publicEvidence} from '../scripts/behavior-v4/policies.mjs';
import {studioSnapshot} from '../scripts/studio/data.mjs';
import {createStudioService} from '../scripts/studio/service.mjs';
import {compileDashboard,styleReport} from '../demo/studio/widgets.mjs';
import {validateGrounding,validateHandoff} from '../scripts/studio/contract.mjs';
import {coverEvidence} from '../demo/studio/coverage.mjs';

const runId='GARDEN-OWN-1111111111111111';
const input=(extra={})=>({runId,seed:150001,catalog:authoredCatalog(),customers:20,days:70,campaignStop:55,scenario:'steady',policy:'personalized',...extra});
function fixture(){
 const store=createMarketStore(),r=createRunner(input());store.create(r.world);
 while(r.world.tick<r.world.totalTicks){const b=r.step();store.transaction(()=>{for(const [table,rows] of Object.entries(b.rows))if(rows.length)store.insert(table,rows);store.saveState(r.world);});}
 for(const m of r.world.behavior.models)store.insert('recommendation_models',[{model_id:m.id,run_id:runId,day:m.cutoff,model_type:m.type,training_rows:m.trainingRows,candidate_recall:m.candidateRecall,baseline_recall:m.baselineRecall,reason:m.reason}]);
 return store;
}
const root={requestId:'studio-test-analyst-1',runId,cutoff:40,question:'Review sales and refund evidence.'};
function fakeClient({invalid=false,fail=false}={}){
 const calls=[];
 return {calls,open:async(id,options)=>{const events=[];return {client:{events,json:async(system,packet,{functions})=>{
  calls.push({id,options,packet});events.push({modelCostMicros:1200,configuredModel:'OFFLINE_TEST_ONLY'});
  if(fail)throw Error('SIMULATED_PROVIDER_FAILURE');
  const name=functions[0].name,common={snapshotId:packet.snapshotId,rationale:'Inspect observed sales with refund costs; no causal uplift claim.'};
  return {name,args:name==='inspect_market'?{...common,focus:'sales',hypothesis:'Refund shares may differ by merchant.',evidence:packet.evidence.slice(0,2).map(e=>({metricId:e.id,value:e.value})),nextStep:'Compare observed merchant refund shares.',limitation:'Observed totals do not prove causal campaign lift.'}:{...common,analysisId:packet.analysisId,title:'Sales evidence',widgets:invalid?['net_sales','unsafe_sql','orders']:['net_sales','merchant_sales','payment_evidence']}};
 }},close:async()=>{}};}};
}

test('active catalog rejects external provenance and contains no imported identifiers',()=>{
 const catalog=authoredCatalog();assert.equal(catalog.length,16);assert.equal(new Set(catalog.map(p=>p.id)).size,16);
 for(const mutation of [{source:'CHANNEL3'},{channel3Id:'external'},{sourceUrl:'https://external.test'},{id:'external-product'},{priceCents:NaN}]){
  const rows=structuredClone(catalog);Object.assign(rows[0],mutation);assert.throws(()=>usableCatalog(rows),/REJECTED/);
 }
 const w=createRunner(input()).world;assert.ok(w.products.every(p=>p.catalog_item_id?.startsWith('MM-')&&p.channel3_product_id===null));
});
test('zero-response paired worlds retain identical purchases; outreach costs remain visible',()=>{
 const none=run(input({response:0,policy:'none'})),contact=run(input({response:0,policy:'portfolio',runId:'CONTROL-TREATMENT'}));
 for(const key of ['purchases','retainedCents','merchantCents','externalCents','reactivated'])assert.equal(contact.durable[key],none.durable[key],key);
 assert.ok(contact.durable.outreachCents>0);assert.equal(contact.durable.platformCents-none.durable.platformCents,-contact.durable.outreachCents);
});
test('trained policy evidence excludes private shopper traits',()=>{
 const r=createRunner(input());while(r.world.tick<44)r.step();const before=publicEvidence(r.world);r.world.behavior.private[0].favoriteBrand='PRIVATE_TEST_MARKER';
 assert.deepEqual(publicEvidence(r.world),before);assert.ok(r.world.behavior.models.length);assert.ok(r.world.behavior.models.every(m=>m.split<m.cutoff));
});
test('Studio snapshot excludes future events, delayed refunds, hidden truth and control branches',()=>{
 const s=fixture();try{const snapshot=studioSnapshot(s,runId,40),rows=snapshot.sources.find(x=>x.id==='sales').data;
  assert.ok(rows.length>0);assert.ok(rows.every(r=>r.day<=40));assert.equal(snapshot.summary.orders,s.db.prepare('SELECT COUNT(*) n FROM orders WHERE run_id=? AND event_ts<?').get(runId,snapshot.asOf).n);
  const visibleRefunds=s.db.prepare('SELECT COALESCE(SUM(amount_cents),0) n FROM refunds WHERE run_id=? AND event_ts<?').get(runId,snapshot.asOf).n;
  assert.equal(snapshot.summary.refundUSD,visibleRefunds/100);
  const baseline=JSON.stringify(snapshot),world=s.state(runId);world.behavior.private[0].favoriteBrand='HIDDEN';s.saveState(world);
  assert.equal(JSON.stringify(studioSnapshot(s,runId,40)),baseline);assert.ok(!baseline.includes('HIDDEN'));
  assert.equal(snapshot.summary.verifiedCaptures,0);assert.throws(()=>studioSnapshot(s,runId,999),/already generated/);assert.throws(()=>studioSnapshot(s,'GARDEN-BEHAVIOR-1111111111111111',40),/authored/);
  s.db.prepare("UPDATE products SET source='CHANNEL3' WHERE product_id=?").run(world.products[0].product_id);assert.throws(()=>studioSnapshot(s,runId,40),/External catalog/);
 }finally{s.close();}
});
test('analyst and designer share checked evidence and budget; replay cannot recharge or mutate transactions',async()=>{
 const s=fixture(),mock=fakeClient(),service=createStudioService({store:s,clientFactory:mock.open});
 try{const before=JSON.stringify(s.export(runId).tables),a=await service.analyze(root);
  const duplicate=await service.analyze(root);assert.equal(duplicate.step_id,a.step_id);assert.equal(mock.calls.length,1);
  await assert.rejects(service.analyze({...root,question:'Different question'}),/different evidence/);
  const d=await service.design({requestId:'studio-test-designer-1',analysisId:a.step_id});
  assert.equal(mock.calls.length,2);assert.equal(mock.calls[0].id,mock.calls[1].id);assert.equal(d.snapshot_id,a.snapshot_id);assert.equal(d.cost_micros,1200);
  const again=await service.design({requestId:'studio-test-designer-2',analysisId:a.step_id});assert.equal(again.step_id,d.step_id);assert.equal(mock.calls.length,2);
  const state=compileDashboard(d.output.widgets);const saved=service.saveReport({runId,cutoff:40,snapshotId:a.snapshot_id,state,sourceStep:d.step_id});assert.ok(saved.saved);assert.deepEqual(service.report(runId,40).state,state);
  const corrupt=structuredClone(state);corrupt.pages[0].widgets.net_sales.dataMapping.value[0].id='summary.refundUSD';assert.throws(()=>service.saveReport({runId,cutoff:40,snapshotId:a.snapshot_id,state:corrupt,sourceStep:d.step_id}),/approved warehouse fields/);
  assert.equal(JSON.stringify(s.export(runId).tables),before);assert.equal(service.steps(runId).length,2);
 }finally{s.close();}
});
test('grounding rejects fabricated values and designer must preserve the analyst and required views',()=>{
 const facts=[{id:'orders',value:137},{id:'models',value:0}],answer={evidence:[{metricId:'orders',value:137},{metricId:'models',value:0}],nextStep:'Collect more observations.',limitation:'No fitted model yet.'};
 validateGrounding(answer,facts);assert.throws(()=>validateGrounding({...answer,evidence:[{metricId:'orders',value:138},{metricId:'models',value:0}]},facts),/UNSUPPORTED/);
 assert.throws(()=>validateGrounding({...answer,evidence:[{metricId:'futureSales',value:0},{metricId:'models',value:0}]},facts),/UNSUPPORTED/);
 assert.throws(()=>validateHandoff({analysisId:'other',widgets:['model_quality','orders','payment_evidence']},{focus:'models'},'current'),/WRONG_PARENT/);
 assert.throws(()=>validateHandoff({analysisId:'current',widgets:['net_sales','orders','payment_evidence']},{focus:'models'},'current'),/MISSING_EVIDENCE_VIEW/);
});
test('compact game-office layout preserves fields, separates cards and keeps the original editable',()=>{
 const normal=compileDashboard(['net_sales','merchant_sales','refunds','campaign_costs','payment_evidence','model_quality']),before=structuredClone(normal),small=styleReport(normal,{compact:true});
 assert.deepEqual(normal,before);assert.deepEqual(small.pages[0].widgets,normal.pages[0].widgets);
 const cells=Object.values(small.pages[0].widgetLayout);assert.ok(cells.every(c=>c.xTrack===0&&c.xSpan===24));const sorted=cells.sort((a,b)=>a.yTrack-b.yTrack);for(let i=1;i<sorted.length;i++)assert.ok(sorted[i].yTrack>=sorted[i-1].yTrack+sorted[i-1].ySpan);
});
test('coverage guard adds a cited refund view without inventing another model decision',()=>{
 const model=['merchant_sales','net_sales','payment_evidence','model_quality','campaign_costs'],original=[...model],plan=coverEvidence({focus:'sales',evidence:[{metricId:'merchant2.refundUSD',value:238}]},model);
 assert.deepEqual(model,original);assert.deepEqual(plan.added,['refunds']);assert.equal(plan.widgets.length,6);assert.ok(plan.widgets.includes('refunds'));assert.deepEqual(plan.removed,[]);
});
test('failed model attempt is recorded and never automatically retried',async()=>{
 const s=fixture(),mock=fakeClient({fail:true}),service=createStudioService({store:s,clientFactory:mock.open});
 try{await assert.rejects(service.analyze(root),/SIMULATED_PROVIDER_FAILURE/);await assert.rejects(service.analyze(root),/will not be charged again/);assert.equal(mock.calls.length,1);assert.equal(service.steps(runId)[0].cost_micros,1200);assert.equal(service.steps(runId)[0].status,'FAILED');}finally{s.close();}
});
test('concurrent identical requests are coalesced into one provider call',async()=>{
 const s=fixture(),mock=fakeClient(),service=createStudioService({store:s,clientFactory:mock.open});
 try{const [a,b]=await Promise.all([service.analyze(root),service.analyze(root)]);assert.equal(a.step_id,b.step_id);assert.equal(mock.calls.length,1);}finally{s.close();}
});
test('designer rejects unapproved widgets and snapshot changes before execution',async()=>{
 const s=fixture(),mock=fakeClient({invalid:true}),service=createStudioService({store:s,clientFactory:mock.open});
 try{const a=await service.analyze(root);await assert.rejects(service.design({requestId:'invalid-design-1',analysisId:a.step_id}),/INVALID_WIDGET_PLAN/);assert.equal(service.report(runId,40).state,null);
  const a2=await service.analyze({...root,requestId:'second-analysis-1'});s.db.prepare('UPDATE orders SET total_cents=total_cents+1 WHERE order_id=(SELECT order_id FROM orders WHERE run_id=? ORDER BY event_ts LIMIT 1)').run(runId);
  await assert.rejects(service.design({requestId:'stale-design-1',analysisId:a2.step_id}),/evidence changed/);
 }finally{s.close();}
});
test('report persistence rejects stale evidence and unsafe state; layout changes preserve other pages',()=>{
 const s=fixture(),service=createStudioService({store:s,clientFactory:fakeClient().open});try{
  const snapshot=service.snapshot(runId,40),state=compileDashboard(['net_sales','orders','payment_evidence']);
  assert.throws(()=>service.saveReport({runId,cutoff:40,snapshotId:'stale',state}),/snapshot changed/);
  assert.throws(()=>service.saveReport({runId,cutoff:40,snapshotId:snapshot.id,state:JSON.parse('{"pages":[],"__proto__":{}}')}),/Unsafe state/);
  assert.throws(()=>service.saveReport({runId,cutoff:40,snapshotId:snapshot.id,state,sourceStep:'not-approved'}),/completed designer/);
  const old={...state,pages:[...state.pages,{id:'other',widgets:{}}]},next=compileDashboard(['daily_sales'],{previous:old,pageId:'overview'});assert.equal(next.pages.length,2);assert.deepEqual(next.pages[1],old.pages[1]);assert.throws(()=>compileDashboard(['unsafe_sql']),/Invalid widget/);
 }finally{s.close();}
});
