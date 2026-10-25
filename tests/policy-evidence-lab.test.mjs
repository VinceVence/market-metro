import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {ROOT,readJSON,frozenInputs} from '../scripts/research-lab/data.mjs';
import {collectCase,rollout,DAYS} from '../scripts/policy-evidence-lab/collect.mjs';
import {choosePolicy,predict,features,FEATURE_NAMES} from '../scripts/policy-evidence-lab/features.mjs';
import {sequenceCase,stateVector,explorationSchedules} from '../scripts/policy-evidence-lab/sequences.mjs';
import {chooseQ} from '../scripts/policy-evidence-lab/q-policy.mjs';

test('timed intervention labels preserve observed cutoffs, frozen accounting and no-outreach identity',async()=>{
  const {catalog}=await frozenInputs(),base=resolve(ROOT,'docs/policy-lab/benchmarks/v5'),priors=await readJSON(resolve(base,'priors.json')),pooled=await readJSON(resolve(base,'pooled-model.json'));
  const data={catalog,pooled,priors:{...priors,candidates:[priors.candidates[0],priors.candidates[1]]}};
  const result=collectCase({seed:100000,scenario:'returns_wave',data,protocolHash:'TEST'});
  assert.deepEqual(result.observations.map(o=>o.asOfDay),DAYS);assert.equal(result.labels.length,6);
  for(const label of result.labels){assert.ok(Object.values(label.checks).every(x=>x===0));if(label.candidateId==='observe')assert.equal(label.platformDeltaUSD,0);}
  for(const observation of result.observations){assert.equal(Object.hasOwn(observation,'scenario'),false);assert.equal(Object.hasOwn(observation,'future'),false);}
  const x=features(result.observations[0]);assert.equal(x.length,FEATURE_NAMES.length);assert.deepEqual(x,features({...result.observations[0],scenario:'untrusted',futureReward:9999,privateTraits:[999]}));
  const args={id:'TEMPORAL-TEST',seed:100000,scenario:'returns_wave',catalog,pooled};
  const a=rollout({...args,observe:true}),b=rollout({...args,observe:true,schedule:[{day:55,candidate:priors.candidates[1]}]});
  assert.deepEqual(a.observations.slice(0,2),b.observations.slice(0,2));assert.equal(b.score.publications.length,1);assert.equal(b.score.publications[0].effectiveDay,56);
});

test('learned policy respects modeled break-even and merchant constraints without inventing an outcome',()=>{
  const packet={candidateIds:['observe','a','b']};
  assert.equal(choosePolicy({kind:'constant',mean:[999,3,2,999,-1,4]},packet,[]).candidateId,'b');
  assert.equal(choosePolicy({kind:'constant',mean:[999,-3,-2,999,1,4]},packet,[]).candidateId,'observe');
  assert.deepEqual(predict({kind:'ridge',coef:[[2,3]],intercept:[1]},[1,2]),[9]);
  assert.throws(()=>choosePolicy({kind:'constant',mean:[1,2,3]},packet,[]),/INVALID_POLICY_PREDICTIONS/);
});

test('sequence exploration is balanced; maturity/accounting and past-only state hold under different future plans',async()=>{
  const choices=14,schedules=explorationSchedules(100000,'steady',choices);assert.equal(new Set(schedules.map(s=>s.join(','))).size,28);
  for(let stage=0;stage<3;stage++)for(let a=0;a<choices;a++)assert.equal(schedules.filter(s=>s[stage]===a).length,2);
  const {catalog}=await frozenInputs(),base=resolve(ROOT,'docs/policy-lab/benchmarks/v5'),priors=await readJSON(resolve(base,'priors.json')),pooled=await readJSON(resolve(base,'pooled-model.json'));
  const data={catalog,pooled,priors:{...priors,candidates:priors.candidates.slice(0,3)}};
  const result=sequenceCase({seed:100000,scenario:'returns_wave',data,protocolHash:'TEST'});
  assert.equal(result.episodes.length,6);assert.ok(result.episodes.every(e=>Object.values(e.checks).every(x=>x===0)));
  const s=stateVector(result.observations[1],[1],3);assert.deepEqual(s.slice(-6),[0,1,0,0,0,0]);assert.throws(()=>stateVector(result.observations[1],[0,1,2],3));
});

test('Q choice compares continuation value with waiting, retaining merchant guard and unavoidable carryover',()=>{
  assert.equal(chooseQ([{action:0,platform:-2,merchant:-2},{action:1,platform:-1,merchant:-1}]),1);
  assert.equal(chooseQ([{action:0,platform:1,merchant:1},{action:1,platform:5,merchant:-1}]),0);
  assert.equal(chooseQ([{action:0,platform:1,merchant:1},{action:1,platform:1,merchant:1}]),0);
});
