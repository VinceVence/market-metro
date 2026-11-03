import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createMarketStore} from '../scripts/market-store.mjs';
import {createAutonomyRoom} from '../scripts/commerce-growth/autonomy/live.mjs';
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
