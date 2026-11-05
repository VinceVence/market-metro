import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {withPlannerFeed,observedReviewFeed} from '../scripts/ontology/planner-gate.mjs';
import {createSupplyYardServer} from '../scripts/serve.mjs';

test('a hold is single-flight, cutoff-bound and repairable only for the same reviewed rows',async()=>{
  const view={day:30,pastOrders:[{id:'basket-a',day:29,grossCents:300,merchants:[{id:'a',grossCents:100},{id:'b',grossCents:200}]}]};
  let entries=0;
  const inner={async plan(v){entries++;assert.deepEqual(v,view);return {actions:[{kind:'ask_need'}]};},summary:()=>({checkpoints:[]}),async close(){}};
  const gate=withPlannerFeed(inner,{runId:'test',mapping:'two-links'});
  const [h,h2]=await Promise.all([gate.plan(view),gate.plan(structuredClone(view))]);assert.deepEqual(h,h2);
  assert.equal(gate.summary().checkpoints.length,1);assert.equal(entries,0);assert.deepEqual(h.actions,[]);
  assert.throws(()=>gate.correctMapping(h.holdId,'second_ticket'),/UNCONFIRMED/);
  assert.throws(()=>gate.correctMapping('stale','basket_id'),/STALE/);
  await assert.rejects(gate.plan({...view,day:31}),/MAPPING_REQUIRED/);
  await assert.rejects(gate.plan({...view,pastOrders:[]}),/HELD_INPUT_CHANGED/);
  gate.correctMapping(h.holdId,'basket_id');gate.correctMapping(h.holdId,'basket_id');
  const [a,b]=await Promise.all([gate.plan(view),gate.plan(view)]);assert.deepEqual(a,b);assert.equal(entries,1);
  const [before,after]=gate.summary().checkpoints.map(c=>c.output);
  assert.equal(before.metrics,null);assert.equal(after.metrics.purchases,1);assert.equal(after.metrics.merchantOrders,2);
  assert.equal(before.rowsHash,after.rowsHash);assert.equal(before.snapshotHash,after.snapshotHash);assert.notEqual(before.schemaHash,after.schemaHash);
  assert.equal(after.correctedHoldId,h.holdId);
  assert.throws(()=>observedReviewFeed({...view,pastOrders:[{...view.pastOrders[0],day:30}]},'test'),/FUTURE/);
  await gate.close();await assert.rejects(gate.plan(view),/CLOSED/);
});

test('certified flat or renamed inputs release each canonical checkout once and preserve a downstream keep decision',async()=>{
  const view={day:30,pastOrders:[{id:'o',day:1,grossCents:300,merchants:[{id:'A',grossCents:100},{id:'B',grossCents:200}]}]};
  for(const mapping of ['flat','renamed']){
    let entered=0;
    const inner={async plan(v){entered++;assert.deepEqual(v,view);return {actions:[],agentCampaign:false};},summary:()=>({checkpoints:[]}),async close(){}};
    const gate=withPlannerFeed(inner,{mapping,runId:'run'});
    assert.deepEqual(await gate.plan(view),{actions:[],agentCampaign:false});
    assert.equal(entered,1);assert.equal(gate.summary().checkpoints[0].output.metrics.purchases,1);
    await gate.close();
  }
});
test('judge replay requires its own hold and revalidates the recorded financial trials before selecting shoppers',async()=>{
  const server=createSupplyYardServer({},null,null);server.listen(0,'127.0.0.1');await once(server,'listening');
  try{
    const base='http://127.0.0.1:'+server.address().port+'/api/market/ontology/planner';
    assert.equal((await fetch(base+'?phase=bogus')).status,400);assert.equal((await fetch(base+'?phase=corrected&holdId=wrong')).status,409);
    const h=await (await fetch(base)).json();assert.equal(h.before.decision,'HOLD');assert.equal(h.before.plannerEntries,0);assert.equal(h.after,null);
    const url=base+'?phase=corrected&holdId='+h.before.holdId,r=await (await fetch(url)).json();
    assert.equal(r.before.holdId,h.before.holdId);assert.equal(r.after.admission.rowsHash,h.before.rowsHash);
    assert.equal(r.after.admission.snapshotHash,h.before.snapshotHash);assert.equal(r.after.plannerEntries,1);
    assert.equal(r.after.decision,'PUBLISH');assert.equal(r.after.candidatesChecked,3);assert.equal(r.after.recordedDecisions,6);
    assert.deepEqual([r.after.contacts,r.after.recommendations,r.after.inquiries,r.newModelCalls,r.newPayments],[36,31,5,0,0]);
    assert.deepEqual(await (await fetch(url)).json(),r);
  }finally{await new Promise(done=>server.close(done));}
});
