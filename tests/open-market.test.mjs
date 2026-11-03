import test from 'node:test';
import assert from 'node:assert/strict';
import {frozenInputs} from '../scripts/research-lab/data.mjs';
import {createPolicyWorld,advancePolicyDay} from '../scripts/policy-lab/economy.mjs';
import {createOpenWorld,advanceOpenDay,cashBalanceError} from '../scripts/open-market/economy.mjs';
import {createOpenRunner,runOpen,POLICIES} from '../scripts/open-market/run.mjs';
const {catalog}=await frozenInputs();
test('closed mode reproduces frozen engine row-for-row and conserves money',()=>{
  const input={runId:'PARITY',comparisonId:'PARITY',branch:'mesh',settings:{seed:731,scenario:'budget_squeeze',customerCount:40,days:120,budgetCents:5000},catalog,startedAt:'2026-10-26T01:00:00.000Z'};
  const old=createPolicyWorld(input),next=createOpenWorld(input,'closed');
  for(let d=0;d<134;d++){assert.deepEqual(advanceOpenDay(next),advancePolicyDay(old));assert.ok(Math.abs(cashBalanceError(next))<1e-5);}
});
test('zero-response campaigns cannot create commerce or modeled platform gain',()=>{
  const input={seed:732,scenario:'returns_wave',variant:'placebo',catalog,customers:40,days:140};
  const control=runOpen({...input,policy:POLICIES[0]}),active=runOpen({...input,policy:POLICIES.find(p=>p.id==='return-aware')});
  for(const k of ['retainedCents','externalRetainedCents','purchases','externalPurchases','grossFeesCents','processingCents'])assert.equal(active[k],control[k],k);
  assert.ok(active.outreachCents>0);assert.equal(active.platformProxyCents-control.platformProxyCents,-active.outreachCents);assert.equal(active.coupons,0);
});
test('outside shopping is paid for but invisible to the agent observation tool',()=>{
  const r=createOpenRunner({seed:733,scenario:'steady',catalog,customers:40,days:140});while(r.world.tick<30)r.step();
  assert.ok(r.world.openMarket.orders.length>0);assert.ok(Math.abs(cashBalanceError(r.world))<1e-5);
  const before=r.evidence();r.world.openMarket.orders.push({secret:'LEAK_MARKER'});r.world.privateTraits[0].wallet='LEAK_MARKER';
  assert.deepEqual(r.evidence(),before);assert.equal(JSON.stringify(before).includes('LEAK_MARKER'),false);
});
