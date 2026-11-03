import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createDeadlineWorld,beginDeadlineDay,observeDeadlineWorld} from '../scripts/commerce-deadlines/environment.mjs';
import {horizonPacket,verifyHorizonSelection,executeHorizonPlan,openHorizonPlanner} from '../scripts/commerce-deadlines/horizon.mjs';

test('horizon solver serves an urgent basket now and replenishes the flexible basket',()=>{
 const packet={id:1,products:[{id:'P',available:1}],inbound:[],merchants:[{id:'M',cashCents:500}],
  choices:[{requestId:'FLEX',offset:0,quantities:{P:1},value:10},{requestId:'URGENT',offset:0,quantities:{P:1},value:6},{requestId:'FLEX',offset:2,quantities:{P:1},value:9}],
  procurement:[{productId:'P',merchantId:'M',arrivalOffset:2,limit:1,unitCostCents:500,penalty:.1,merchantRail:'paypal',supplierRail:'paypal'}]};
 const run=spawnSync('.local/marketing-venv/bin/python',['scripts/commerce-deadlines/horizon-worker.py'],{input:JSON.stringify(packet)+'\n',encoding:'utf8',timeout:10000});
 assert.equal(run.status,0,run.stderr);const answer=JSON.parse(run.stdout);assert.equal(answer.status,0);assert.deepEqual(answer.selected,[1,2]);
 const verified=verifyHorizonSelection(packet,answer);assert.equal(verified.captures[0].requestId,'URGENT');assert.equal(verified.future[0].requestId,'FLEX');
 assert.throws(()=>verifyHorizonSelection(packet,{...answer,selected:[0,1]}),/STOCK_OR_TIMING/);
 assert.throws(()=>verifyHorizonSelection({...packet,merchants:[{id:'M',cashCents:499}]},answer),/CASH/);
 const nested={...packet,merchants:[{id:'M',cashCents:5000}],procurement:[
  {...packet.procurement[0],arrivalOffset:2,limit:3},
  {...packet.procurement[0],arrivalOffset:4,limit:1},
  {...packet.procurement[0],arrivalOffset:6,limit:1}]};
 assert.throws(()=>verifyHorizonSelection(nested,{selected:[],procurement:[{index:1,quantity:1},{index:2,quantity:1}]}),/NESTED_PROCUREMENT_LIMIT/);
});

test('invalid procurement triggers one observed-state repair before atomic commit',async()=>{
 const world=createDeadlineWorld({seed:970102,scenario:'ordinary'});beginDeadlineDay(world);
 const planner=openHorizonPlanner();try{
  const plan=await planner.plan(observeDeadlineWorld(world)),p=world.products[0];let revisions=0;
  const bad={...plan,captures:[],procurements:[{merchantId:p.merchantId,merchantRail:'paypal',supplierRail:'paypal',items:[{productId:p.id,quantity:20}]}]};
  const result=await executeHorizonPlan(world,bad,{repair:(view,options)=>{revisions++;assert.equal(Object.hasOwn(view,'seed'),false);assert.equal(options.procurementOnly,true);return planner.plan(view,options);}});
  assert.equal(revisions,1);assert.equal(result.repair.cause,'PROCUREMENT_EXCEEDS_OBSERVED_DEMAND');
  assert.ok(world.decisions.at(-1).checkpoints.some(c=>c.stage==='VERIFY_REVISED_SUPPLY'));
  assert.ok(world.procurements.every(o=>o.quantity!==20));
 }finally{planner.close();}
});

test('public planning packet excludes hidden state; commit rejects a stale or invalid plan atomically',async()=>{
 const world=createDeadlineWorld({seed:970101,scenario:'scarce_stock'});beginDeadlineDay(world);
 const packet=horizonPacket(observeDeadlineWorld(world));assert.equal(Object.hasOwn(packet,'seed'),false);assert.equal(Object.hasOwn(packet,'privateOrderOutcomes'),false);
 const planner=openHorizonPlanner();try{
  const plan=await planner.plan(observeDeadlineWorld(world)),before=JSON.stringify(world);
  await assert.rejects(()=>executeHorizonPlan(world,{...plan,snapshotHash:'stale'}),/STALE/);assert.equal(JSON.stringify(world),before);
  await assert.rejects(()=>executeHorizonPlan(world,{...plan,captures:[{requestId:'FAKE',items:[]}]}));assert.equal(JSON.stringify(world),before);
  await executeHorizonPlan(world,plan,{repair:planner.plan});assert.equal(world.decisions.at(-1).checkpoints.at(-1).stage,'COMMIT');
 }finally{planner.close();}
});
