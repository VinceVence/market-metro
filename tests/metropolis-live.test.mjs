import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createGrowthWorld,beginGrowthDay,endGrowthDay} from '../scripts/commerce-metropolis/environment.mjs';
import {RULES as largeRules,reserveBasket,captureReservation} from '../scripts/commerce-metropolis/kernel.mjs';
import {RULES as oldRules} from '../scripts/commerce-expanded/kernel.mjs';
import {LIVE_SIZES} from '../scripts/commerce-metropolis/profiles.mjs';
import {createMarketStore} from '../scripts/market-store.mjs';
import {createAutonomyRoom} from '../scripts/commerce-growth/autonomy/live.mjs';
import {loadScaleInputs} from '../scripts/commerce-expanded/harness-v2/merchant-scale.mjs';
import {compileCampaign,scoreCampaign,fixedOutreach} from '../scripts/commerce-metropolis/harness/tools.mjs';
import {scoreCampaign as originalScore,read} from '../scripts/commerce-expanded/harness-v2/tools.mjs';
import {outreachPlan} from '../scripts/commerce-growth/team/control.mjs';
import {verifyLargeFeed} from '../scripts/commerce-metropolis/feed-verifier.mjs';
import {merchantFeedFromLedger} from '../scripts/ontology/judge-feed.mjs';

test('large ontology feeds certify every complete checkout and detect cross-page faults',()=>{
  const source={runId:'large-test',checkouts:Array.from({length:7001},(_,i)=>['basket-'+i,400,Array.from({length:4},(_,j)=>['order-'+i+'-'+j,'merchant-'+j,100])])};
  for(const format of ['warehouse','renamed','flat']){
    const feed=merchantFeedFromLedger(source,format),result=verifyLargeFeed(feed);
    assert.equal(result.decision,'CERTIFY');assert.equal(result.pages,8);
    assert.deepEqual(result.metrics,{purchases:7001,merchantOrders:28004,splitBaskets:7001,grossCents:2800400});
    const broken=structuredClone(feed),legs=broken.tables.find(t=>t.grain==='merchant order');
    legs.rows.at(-1)[0]=legs.rows[0][0];const duplicate=verifyLargeFeed(broken);
    assert.equal(duplicate.code,'duplicate-order');assert.equal(duplicate.metrics,null);
    const badMoney=structuredClone(feed);badMoney.tables.find(t=>t.grain==='merchant order').rows.at(-1)[3]=99;
    assert.equal(verifyLargeFeed(badMoney).decision,'HOLD');
  }
  assert.equal(verifyLargeFeed(merchantFeedFromLedger(source,'ambiguous')).code,'ambiguous-link');
});

test('live size tiers create one real population and preserve the monetary rules',()=>{
  assert.deepEqual(largeRules,oldRules);
  assert.deepEqual(LIVE_SIZES,[96,192,384]);
  assert.throws(()=>createGrowthWorld({seed:92111706,regime:'reactivation',merchantCount:768,customers:38400}),/INVALID_DEADLINE_SETTINGS/);
  for(const merchants of LIVE_SIZES){
    const w=createGrowthWorld({seed:92111706,regime:'reactivation',merchantCount:merchants,customers:merchants*50});
    assert.equal(w.merchants.length,merchants);assert.equal(w.people.length,merchants*50);assert.equal(w.products.length,merchants*4);
    assert.equal(w.growth.needs.length,0,'Future need records are generated on their own day');
    assert.equal(w.growth.rules.dailyContactLimit,w.people.length/10);
    assert.ok(w.merchants.every(m=>m.startingCashCents===225000));assert.ok(w.products.every(p=>p.initialStock===12));
  }
});

test('a shopper can buy from merchants across the shared market and cash remains conserved',()=>{
  const w=createGrowthWorld({seed:92111706,regime:'ordinary',merchantCount:96,customers:4800});beginGrowthDay(w);
  const request=w.requests.find(r=>r.status==='AUTHORIZED'&&r.authorizedCents>=r.lines.reduce((n,l)=>n+w.catalog.find(p=>p.id===l.preferredCatalogId).priceCents*l.quantity,0)&&r.lines.every(l=>w.catalog.find(p=>p.id===l.preferredCatalogId).priceCents>=2500&&w.products.some(p=>p.catalogId===l.preferredCatalogId&&Number(p.merchantId.split('-')[1])>=24)));
  assert.ok(request);
  const items=request.lines.map(line=>({lineId:line.id,productId:w.products.filter(p=>p.catalogId===line.preferredCatalogId&&Number(p.merchantId.split('-')[1])>=24).sort((a,b)=>a.costCents-b.costCents)[0].id,quantity:line.quantity}));
  reserveBasket(w,{requestId:request.id,items,key:'test-reserve'});
  const capture=captureReservation(w,{requestId:request.id,key:'test-capture'});
  assert.deepEqual(captureReservation(w,{requestId:request.id,key:'test-capture'}),capture);
  assert.equal(w.orders.length,1);assert.ok(w.orders[0].merchants.every(m=>Number(m.id.split('-')[1])>=24));
  endGrowthDay(w);assert.equal(Object.values(w.accounts).reduce((s,n)=>s+n,0),w.initialCashCents+w.incomeCents);
});

test('indexed targeting preserves the reference planner and strong fixed decisions',async()=>{
  const input=await loadScaleInputs(),fixed=(await read('docs/commerce-growth/team-1/development/results.json')).selectedFixed;
  const raw={...input.contract.campaign,contactsPer100:String(input.contract.campaign.contactsPer100),coverDays:String(input.contract.campaign.coverDays)};
  const contract=compileCampaign(raw,input.model,input.contract.configuration,input.contract.context);
  for(const view of input.views){
    assert.deepEqual(scoreCampaign(view,{contract,model:input.model,prior:input.prior}).actions,originalScore(view,{contract:input.contract,model:input.model,prior:input.prior}).actions);
    assert.deepEqual(fixedOutreach(view,fixed.config,input.prior).actions,outreachPlan(view,fixed.config,input.prior).actions);
  }
});

test('the normal live service checkpoints a 96-merchant run and restores its actual world',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'metropolis-live-')),store=createMarketStore();let calls=0;
  const options={store,market:{},autoPump:false,rootDir:dir,providerFactory:async()=>{calls++;throw Error('No paid provider in this test');}};
  const room=createAutonomyRoom(options);let restored;
  try{
    const input={requestId:'metropolis-checkpoint-test',seed:92111706,regime:'reactivation',marketProfile:'metropolis-96',harnessVersion:'v2',plannerMode:'single',modelCheck:true,sandbox:false};
    const start=await room.start(input);for(let d=0;d<3;d++)await room.step(start.id);
    const live=room.snapshot(start.id);assert.equal(live.status,'RUNNING',live.warning);assert.equal(live.day,3);
    assert.equal(live.settings.merchantCount,96);assert.equal(live.settings.customerCount,4800);
    assert.equal(live.frame.customerCount,4800);assert.ok(live.frame.customers.length<=384);assert.equal(calls,0);
    const persisted=JSON.parse(store.db.prepare('SELECT state_json FROM autonomy_sessions WHERE id=?').get(start.id).state_json);
    assert.equal(persisted.worldRef,start.id);assert.equal(persisted.w,undefined);
    assert.ok(store.db.prepare('SELECT length(world_blob) n FROM metropolis_states WHERE session_id=?').get(start.id).n>0);
    await room.close();restored=createAutonomyRoom(options);
    const r=restored.snapshot(start.id);assert.equal(r.day,3);assert.equal(r.frame.stats.orders,live.frame.stats.orders);
    assert.equal(r.ontology.counts.shoppers,4800);assert.equal(r.ontology.counts.merchants,96);
  }finally{await restored?.close();await room.close();store.close();await rm(dir,{recursive:true,force:true});}
});
