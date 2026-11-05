import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createMarketStore} from '../scripts/market-store.mjs';
import {createAutonomyRoom} from '../scripts/commerce-growth/autonomy/live.mjs';
import {createRecordedJudgePlanner} from '../scripts/ontology/planner-demo.mjs';
test('shopping and warehouse writes continue while an agent is waiting; publication uses the next day',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'autonomy-live-')),store=createMarketStore();let release,entered=false,nativeCalls=0;
 const gate=new Promise(resolve=>{release=resolve;}),events=[],providerFactory=async()=>({client:{events,async json(_system,packet,{functions}){
  const name=functions[0].name;if(!entered){entered=true;await gate;}
  events.push({configuredModel:'TEST_DOUBLE',modelCostMicros:0,latencyMs:0});return {name,args:{evidenceId:packet.evidenceId,rationale:'Offline integration check, not a real model decision.',...(name==='analyse_market'?{focus:'fresh_intent',finding:'Observe current intent.'}:name==='choose_model_work'?{decision:'train',family:'forest',windowDays:'100',recipe:'clarify_ambiguous',valuation:'pooled',adaptation:'adaptive_funding',intentScope:'latest'}:{decision:'publish',audience:'all',contactKinds:'recommend',contactsPerDay:'10',minimumNetCents:'0',routing:'fast',forecast:'recent14',coverDays:'7'})}};
 }},async close(){}}),service=createAutonomyRoom({store,market:{mirror:async()=>{nativeCalls++;throw Error('NATIVE_NOT_ALLOWED');}},providerFactory,rootDir:dir,autoPump:false});
 try{
  const start=await service.start({requestId:'offline-live-integration',seed:987499,regime:'discovery',sandbox:false});
  for(let day=0;day<31;day++)await service.step(start.id);
  const before=service.snapshot(start.id);assert.equal(before.teamPending,true);
  for(let day=31;day<36;day++)await service.step(start.id);
  const during=service.snapshot(start.id);assert.equal(during.day,36);assert.equal(during.teamPending,true);assert.ok(during.frame.stats.orders>before.frame.stats.orders,'Customers must transact while the provider is waiting');
  release();for(let i=0;i<600&&service.snapshot(start.id).teamPending;i++)await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(service.snapshot(start.id).teamPending,false);await service.step(start.id);
  const published=service.snapshot(start.id);assert.equal(published.latestCampaign.day,37);assert.equal(published.warning,null);
  assert.ok(published.calibrationUpdates>0);assert.equal(published.learning,null,'Final outcomes must not appear in an unfinished replay');const updates=store.db.prepare("SELECT detail_json FROM events WHERE run_id=? AND event_type='response_model_updated'").all(start.runId);assert.ok(updates.length>0);assert.equal(JSON.parse(updates[0].detail_json).calibration.asOfDay,36);
  const baskets=store.table('autonomy_baskets',start.runId,{limit:500}).rows,orders=store.table('orders',start.runId,{limit:500}).rows;
  assert.equal(baskets.reduce((s,b)=>s+b.gross_cents,0),orders.reduce((s,o)=>s+o.total_cents,0));assert.ok(baskets.length>0);
  assert.equal(store.table('autonomy_ledger',start.runId,{limit:500}).rows.some(e=>['INCOME','HOUSEHOLD_EXPENSE','OUTSIDE_PURCHASE'].includes(e.kind)),false);
  const eventTypes=store.db.prepare('SELECT DISTINCT event_type FROM events WHERE run_id=?').all(start.runId).map(r=>r.event_type);assert.ok(eventTypes.includes('search_intent'));assert.ok(eventTypes.includes('product_view'));
  const inv=store.table('v_inventory',start.runId,{limit:500}).rows;for(const p of published.frame.products)assert.equal(inv.find(i=>i.product_id===p.product_id).on_hand,p.stock);
  const again=await service.start({requestId:'offline-live-integration',seed:987499,regime:'discovery',sandbox:false});assert.equal(again.id,start.id);assert.equal(events.length,3);assert.equal(nativeCalls,0);
 }finally{release();await service.close();store.close();await rm(dir,{recursive:true,force:true});}
});

test('the live room restores the held day, persists both checks and dispatches one campaign after correction',async()=>{
  const store=createMarketStore(),dir=await mkdtemp(join(tmpdir(),'metro-planner-feed-'));
  let cloud=0,native=0;
  const room=createAutonomyRoom({store,autoPump:false,rootDir:dir,v2ControllerFactory:async()=>createRecordedJudgePlanner(),
    providerFactory:async()=>{cloud++;throw Error('Unexpected provider call');},market:{mirror(){native++;throw Error('Unexpected payment');}}});
  try{
    const settings={requestId:'feed-hold-live-test',seed:92111706,regime:'reactivation',marketProfile:'expanded-12x600',
      harnessVersion:'v2',plannerMode:'single',modelCheck:true,merchantMapping:'two-links',sandbox:false};
    const initial=await room.start(settings);
    const count=(table)=>store.db.prepare('SELECT COUNT(*) n FROM '+table+' WHERE run_id=?').get(initial.runId).n;
    await assert.rejects(room.start({...settings,merchantMapping:'warehouse'}),e=>e.code==='REQUEST_CONFLICT');
    for(let i=0;i<30;i++)await room.step(initial.id);
    const opening=[count('orders'),count('autonomy_contacts'),count('autonomy_frames')];
    await room.step(initial.id);await room.step(initial.id);
    const held=room.snapshot(initial.id);assert.equal(held.status,'AWAITING_MAPPING');assert.equal(held.liveDay,30);
    assert.ok(held.clockPaused);assert.equal(held.reviewDay,31);assert.equal(held.campaigns.length,0);
    assert.equal(held.feedHold.code,'ambiguous-link');assert.equal(held.steps.filter(c=>c.actor==='MERCHANT_FEED_GATE').length,1);
    assert.deepEqual([count('orders'),count('autonomy_contacts'),count('autonomy_frames')],opening);
    assert.equal(room.snapshot(initial.id,29).feedHold,null);
    const repair={holdId:held.feedHold.holdId,column:'basket_id'};
    assert.throws(()=>room.correctMapping(initial.id,{...repair,column:'second_ticket'}),e=>e.code==='INVALID_MAPPING_CORRECTION');
    assert.throws(()=>room.correctMapping(initial.id,{...repair,holdId:'0'.repeat(64)}),e=>e.code==='STALE_MAPPING_HOLD');
    assert.equal(room.correctMapping(initial.id,repair).status,'RUNNING');room.correctMapping(initial.id,repair);
    await room.step(initial.id);
    const after=room.snapshot(initial.id);assert.equal(after.liveDay,31);assert.equal(after.feedHold,null);assert.equal(after.campaigns.length,1);
    const [before,cert]=after.steps.filter(c=>c.actor==='MERCHANT_FEED_GATE').map(c=>c.output);
    assert.equal(before.rowsHash,cert.rowsHash);assert.equal(before.snapshotHash,cert.snapshotHash);
    assert.deepEqual(cert.metrics,{purchases:715,merchantOrders:976,splitBaskets:261,grossCents:6773000});
    const pub=after.steps.find(c=>c.actor==='TRUSTED_PUBLISHER');assert.equal(pub.input.merchantFeed.schemaHash,cert.schemaHash);
    assert.equal(count('autonomy_contacts')-opening[1],36);
    const contacts=store.db.prepare('SELECT kind,count(*) n FROM autonomy_contacts WHERE run_id=? AND day=30 GROUP BY kind').all(initial.runId);
    assert.deepEqual(Object.fromEntries(contacts.map(c=>[c.kind,c.n])),{ask_need:5,recommend:31});
    const saved=JSON.parse(store.db.prepare('SELECT state_json FROM autonomy_sessions WHERE id=?').get(initial.id).state_json);
    assert.equal(saved.s.mappingCorrection.holdId,repair.holdId);assert.equal(saved.s.team.feedGate.correction.column,'basket_id');
    room.correctMapping(initial.id,repair);assert.equal(count('autonomy_contacts')-opening[1],36);assert.equal(cloud+native,0);
  }finally{await room.close();store.close();await rm(dir,{recursive:true,force:true});}
});
