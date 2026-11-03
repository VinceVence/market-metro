import test from 'node:test';
import assert from 'node:assert/strict';
import {frozenInputs} from '../scripts/research-lab/data.mjs';
import {createPolicyWorld,advancePolicyDay} from '../scripts/policy-lab/economy.mjs';
import {advanceFocusedDay} from '../scripts/focused-recovery/economy.mjs';
import {scheduleModel} from '../scripts/agent-mesh/aggressive-policy.mjs';
import {runFocused,POLICIES} from '../scripts/focused-recovery/benchmark.mjs';
const {catalog}=await frozenInputs();
test('policy-context adapter preserves original active and organic transition rows',()=>{
 const input={runId:'FOCUSED-PARITY',comparisonId:'P',branch:'mesh',settings:{seed:738,scenario:'returns_wave',customerCount:40,days:120,budgetCents:5000},catalog,startedAt:'2026-10-26T01:00:00.000Z'};
 const old=createPolicyWorld(input),next=createPolicyWorld(input);
 for(let day=0;day<134;day++){
  if(day===30)for(const w of [old,next]){w.policyLab.plan={strategy:'recommendations',audience:'all',merchantIndices:[0,1,2],maxOfferPct:0,epsilon:0};w.policyLab.model=scheduleModel({id:'broad',floor:0,loyal:true});}
  assert.deepEqual(advanceFocusedDay(next),advancePolicyDay(old));
 }
});
test('focused audience refuses contacts without observed exposure and never changes prices',()=>{
 const input={runId:'FOCUS-GATE',comparisonId:'P',branch:'mesh',settings:{seed:739,scenario:'steady',customerCount:40,days:120,budgetCents:5000},catalog,startedAt:'2026-10-26T01:00:00.000Z'},w=createPolicyWorld(input);
 for(let d=0;d<30;d++)advanceFocusedDay(w);
 w.policyLab.focusedPolicy={exposedMerchants:[],requireRefund:false,requireLapsed:false};w.policyLab.model=scheduleModel({id:'broad',floor:0,loyal:true});w.policyLab.plan={strategy:'recommendations',audience:'all',merchantIndices:[0,1,2],maxOfferPct:0,epsilon:0};
 const b=advanceFocusedDay(w);assert.ok(b.rows.policy_lab_actions.every(a=>a.selected_action==='none'));assert.equal(b.rows.coupons.length,0);
});
