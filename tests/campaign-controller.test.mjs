import test from 'node:test';
import assert from 'node:assert/strict';
import {frozenInputs} from '../scripts/research-lab/data.mjs';
import {createFreshWorld} from '../scripts/policy-lab/fresh-world.mjs';
import {estimate} from '../scripts/policy-lab/learner.mjs';
import {RECIPES,artifactForRecipe,compileCampaign,runCandidate} from '../scripts/campaign-controller/policies.mjs';
import {marketEvidence,recordStocks,inferredRegime} from '../scripts/campaign-controller/evidence.mjs';
import {mkdtemp,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {ROOT,readJSON} from '../scripts/research-lab/data.mjs';
import {runControllers} from '../scripts/campaign-controller/runtime.mjs';
import {createPlanner,validate} from '../scripts/campaign-controller/agent.mjs';
import {reconciledState} from '../scripts/campaign-controller/reconcile-timeout.mjs';
import {PROJECT_ID,FLASH_LITE_PROFILE} from '../benchmark/vertex.mjs';

test('targeting recipes use the unchanged observed feature interface and stay separate from fitted ML',()=>{
  const premium=artifactForRecipe(RECIPES.find(r=>r.id==='premium'));
  assert.equal(premium.type,'authored_observable_targeting_rule');
  assert.ok(estimate(premium,'recommend:0',[1,0,0,0,.3199,0,0]).score<0);
  assert.ok(estimate(premium,'recommend:0',[1,0,0,0,.89,0,0]).score>0);
  const alternative=artifactForRecipe(RECIPES.find(r=>r.id==='premium_alternative'));
  assert.ok(estimate(alternative,'recommend:0',[1,0,0,0,.89,1,0]).score<0);
  assert.ok(estimate(alternative,'recommend:0',[1,0,0,0,.89,0,0]).score>0);
  assert.equal(estimate(premium,'none',[1,0,0,0,.89,0,0]).score,0);
});

test('trusted campaign contract blocks arbitrary features, rewards, payments and invalid scope',()=>{
  const base={recipeId:'premium',merchantIndices:[1,2],durationDays:3};
  assert.equal(compileCampaign(base,{}).plan.maxOfferPct,0);
  for(const extra of [{recipeId:'hidden_trait'},{merchantIndices:[3]},{merchantIndices:[1,1]},{durationDays:50},{coefficients:[1,2,3]},{payment:true}])assert.throws(()=>compileCampaign({...base,...extra},{}));
});

test('shared monitor exposes mature data and descriptive stock/price signals, never scenario labels',async()=>{
  const {catalog}=await frozenInputs(),m=createFreshWorld({id:'CHECK',seed:91000,scenario:'rival_sale',settings:{customerCount:100,days:100,budgetCents:30000},catalog,startedAt:'2026-10-25T00:00:00.000Z'}),stocks=[];
  while(m.world.tick<55){m.step();recordStocks(m,stocks);}
  const e=marketEvidence(m,stocks);assert.equal(e.asOfDay,55);assert.equal(e.matureRows+e.immatureRows,5500);assert.equal(inferredRegime(e),'rival_sale');
  assert.equal('scenario' in e,false);assert.equal('privateTraits' in e,false);assert.equal('branches' in e,false);
  for(const row of e.merchants)assert.equal(row.returnRate,row.matureOrders?row.matureReturns/row.matureOrders:null);
});

test('new policy artifacts preserve accounting, contact and inventory constraints in a frozen world',async()=>{
  const {catalog}=await frozenInputs(),args={id:'RULE-TEST',seed:91000,scenario:'returns_wave',catalog,choice:{recipeId:'premium_alternative',merchantIndices:[0,2],durationDays:7}};
  const a=runCandidate(args),b=runCandidate(args);assert.equal(a.platformProxyCents,b.platformProxyCents);assert.equal(a.recommendations,b.recommendations);assert.equal(a.offers,0);assert.ok(a.recommendations>0);assert.ok(Object.values(a.checks).every(n=>n===0));assert.equal(a.matureOutcomes,7000);assert.ok(a.reviews.every(r=>r.modelKind==='AUTHORED_TARGETING_RULE'));
});

const decision=(packet,id)=>({candidateId:id,evidenceId:packet.market.evidenceId,reasonCode:'development_prior',observationIds:['demand'],observedCondition:'mixed_or_uncertain',alternativeId:'observe',reason:'Select the predeclared development policy for this replay check.'});

test('matching decisions yield matching outcomes; checkpoints resume without dispatch or future evidence',async()=>{
  const {catalog}=await frozenInputs(),base=resolve(ROOT,'docs/policy-lab/benchmarks/v5');
  const priors=await readJSON(resolve(base,'priors.json')),pooled=await readJSON(resolve(base,'pooled-model.json')),saved=new Map(),packets=[];
  const args={id:'SAME-EVIDENCE',seed:91000,scenario:'rival_sale',catalog,priors,pooled};
  const a=await runControllers({...args,choose:async packet=>{packets.push(structuredClone(packet));return decision(packet,priors.rules.static);},record:async(day,r)=>saved.set(day,structuredClone(r))});
  const outcome=method=>{const {method:_,policy,...rest}=a.branches.find(b=>b.method===method);return rest;};
  assert.deepEqual(outcome('llm'),outcome('static'));
  assert.deepEqual(outcome('firstChoice'),outcome('static'));
  assert.deepEqual(a.reviews.map(r=>[r.cutoff,r.publishedDay]),[[30,31],[55,56],[80,81]]);
  assert.equal(packets.length,3);
  for(const packet of packets){assert.equal(packet.authority.nativePayments,false);for(const key of ['scenario','seed','privateTraits','branches','finalOutcomes'])assert.equal(Object.hasOwn(packet,key),false);}
  const b=await runControllers({...args,choose:async()=>assert.fail('A restored checkpoint must not call a model'),restore:async day=>saved.get(day)});
  assert.deepEqual(a.reviews,b.reviews);
  assert.deepEqual(a.branches.map(({fits,...b})=>b),b.branches.map(({fits,...b})=>b));
  const corrupt=structuredClone(saved.get(30));corrupt.packetHash='changed';
  await assert.rejects(runControllers({...args,restore:async()=>corrupt}),/REVIEW_INPUT_CHANGED/);
});

test('planner rejects fabricated authority and unsupported evidence',()=>{
  const packet={market:{evidenceId:'E-test'},candidates:[{id:'observe'},{id:'bounded'}]},args=decision(packet,'bounded');
  assert.deepEqual(validate({name:'select_campaign',args},packet),args);
  for(const change of [{candidateId:'new'},{evidenceId:'future'},{observationIds:['hidden_traits']},{payment:true},{reasonCode:'guaranteed_profit'}])assert.throws(()=>validate({name:'select_campaign',args:{...args,...change}},packet),/INVALID_CAMPAIGN_DECISION/);
});

test('local planner preflight fails before dispatch and cached results make no provider calls',{skip:!existsSync(resolve(ROOT,'.local/gcp/model-spend.json'))},async()=>{
  const packet={market:{evidenceId:'E-test'},candidates:[{id:'observe'},{id:'bounded'}]},args=decision(packet,'bounded');
  const directory=await mkdtemp(resolve(tmpdir(),'campaign-auth-test-'));let calls=0;
  try{
    const planner=await createPlanner({id:'TEST-NO-DISPATCH',directory,suiteCapUSD:Number.MAX_SAFE_INTEGER,clientFactory:async()=>{calls++;throw Error('VERTEX_AUTH_UNAVAILABLE');}});
    await assert.rejects(planner.choose(packet,30),/VERTEX_AUTH_UNAVAILABLE/);await planner.close();
    const files=await readdir(directory);assert.equal(calls,1);assert.equal(files.length,1);assert.ok(files[0].startsWith('preflight-30-'));assert.equal((await readJSON(resolve(directory,files[0]))).status,'NO_MODEL_DISPATCH');
    const replay=await createPlanner({id:'TEST-NO-DISPATCH',directory,suiteCapUSD:Number.MAX_SAFE_INTEGER,clientFactory:async()=>({client:{events:[],async json(){return {name:'select_campaign',args};}},close:async()=>{}})});
    assert.deepEqual(await replay.choose(packet,30),args);await replay.close();
    const cached=await createPlanner({id:'TEST-NO-DISPATCH',directory,clientFactory:async()=>assert.fail('Saved response must not authenticate or charge')});
    assert.deepEqual(await cached.choose(packet,30),args);await cached.close();
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('operator timeout review preserves every cost and failed decision; ambiguous dispatch cannot be cleared',()=>{
  const id='CAMP5-validation-0123456789abcdef',entry={id:'reservation',runId:'market-'+id,caseId:id+'-review-30',status:'uncertain',model:FLASH_LITE_PROFILE.model,stage:'campaign_data_planning',reservedMicros:30000,chargedMicros:30000,inputBytes:17000};
  const state={version:1,projectId:PROJECT_ID,lifetimeCapMicros:8000000,circuit:'UNKNOWN_PROVIDER_OUTCOME',entries:[{id:'old',status:'settled',chargedMicros:123},entry]};
  const records={id,failed:{status:'FAILED',error:'The operation was aborted due to timeout',provider:{reservationId:'reservation',status:'uncertain',caseId:entry.caseId}},checkpoint:{cutoff:30,decision:null,error:'The operation was aborted due to timeout',selections:{llm:'observe',firstChoice:'observe'}},blocked:{status:'FAILED',error:'SPEND_CIRCUIT_OPEN'}};
  const next=reconciledState(state,records);assert.deepEqual(next.entries[0],state.entries[0]);assert.equal(next.entries[1].chargedMicros,30000);assert.equal(next.entries[1].reconciliation.actualUsageKnown,false);assert.equal(next.circuit,null);assert.equal(state.circuit,'UNKNOWN_PROVIDER_OUTCOME');
  assert.throws(()=>reconciledState(state,{...records,failed:{...records.failed,response:{name:'select_campaign'}}}));
  assert.throws(()=>reconciledState(state,{...records,blocked:{...records.blocked,provider:{}}}));
  assert.throws(()=>reconciledState({...state,entries:[...state.entries,{status:'uncertain'}]},records));
});
