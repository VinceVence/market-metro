import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openSpendLedger} from '../benchmark/vertex.mjs';
import {profileFor,capTeamLedger} from '../scripts/agent-mesh/model-client.mjs';
import {approvedPlan,ruleWithHarness,evaluateDecisions} from '../scripts/agent-mesh/model-comparison.mjs';

test('hybrid route reserves Pro for planning and review, never upgrades evidence work',()=>{
  assert.equal(profileFor('hybrid','investigate_market'),'flash_lite');
  for(const tool of ['propose_policy','review_policy','close_experiment'])assert.equal(profileFor('hybrid',tool),'pro');
  assert.equal(profileFor('lite','propose_policy'),'flash_lite');assert.throws(()=>profileFor('unlimited','review_policy'));
  for(const tool of ['prepare_training_data','select_model','select_economic_policy'])assert.equal(profileFor('research',tool),'pro');
  for(const tool of ['inspect_demand','train_models','compare_campaigns','publish_tested_campaign','reconsider_model'])assert.equal(profileFor('research',tool),'flash_lite');
});
test('mixed-model ledger keeps prices and enforces one250000-microdollar envelope',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'market-model-')),path=join(dir,'ledger.json');
  try{
    let ledger=await openSpendLedger(path,{initialize:true,runId:'same-team',profile:'flash_lite'});
    let id=await capTeamLedger(ledger).reserve({});await ledger.settle(id,{inputTokens:4000,outputTokens:0});await ledger.close();
    ledger=await openSpendLedger(path,{runId:'same-team',profile:'pro'});
    const guarded=capTeamLedger(ledger);id=await guarded.reserve({});await ledger.settle(id,{inputTokens:0,outputTokens:8500});
    assert.equal(ledger.snapshot().runChargedMicros,103000);
    await assert.rejects(()=>guarded.reserve({}),/TEAM_MODEL_BUDGET_EXHAUSTED/);
    assert.equal(ledger.snapshot().entries[0].pricing.inputMicrosPerToken,.25);
    assert.equal(ledger.snapshot().entries[1].pricing.inputMicrosPerToken,2);await ledger.close();
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('code baseline receives the same coupon screen and a valid non-discount revision',()=>{
  const packet={asOfDay:55,returnRate:.02,lapsedFraction:.5,remainingBudgetCents:20000,merchants:[{index:0,stock:30,maxOfferPct:5}]};
  const facts={caps:{merchants:packet.merchants},randomizedEffects:[]};
  const plan=ruleWithHarness(packet,facts);assert.equal(plan.strategy,'recommendations');assert.equal(plan.maxOfferPct,0);
  const stopped=approvedPlan(plan,{decision:'reject'});assert.equal(stopped.strategy,'observe');assert.deepEqual(stopped.merchantIndices,[]);
});
test('replay refuses an approved active campaign whose fitted model was lost during resume',()=>{
  const evidence={seed:1,scenario:'steady',startedAt:'2026-10-25T01:00:00.000Z',catalog:[3200,3500,8900].map((priceCents,i)=>({title:'Fixture '+i,priceCents,currency:'USD',source:'TEST_FIXTURE'}))};
  const decisions=[{day:30,plan:{strategy:'recommendations',audience:'all',merchantIndices:[0],maxOfferPct:0,windowDays:42,epsilon:0},model:null}];
  assert.throws(()=>evaluateDecisions(evidence,decisions,{method:'missing-model-test'}),/ACTIVE_POLICY_WITHOUT_MODEL/);
});
