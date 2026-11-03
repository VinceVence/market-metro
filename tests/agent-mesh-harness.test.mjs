import test from 'node:test';
import assert from 'node:assert/strict';
import {campaignPreflight,publicationCheck,policyIdentity,durableReleaseGate} from '../scripts/agent-mesh/harness.mjs';

const plan={strategy:'mixed',audience:'all',merchantIndices:[0],maxOfferPct:10,windowDays:42,epsilon:0,asOfDay:30};
const facts={caps:{merchants:[{index:0,maxOfferPct:5}]},modelCheck:{beatConstant:false},randomizedEffects:[{action:'coupon5:0',audience:'all',treated:{observations:40},control:{observations:50},directRewardDifferenceCents:-4}]};

test('economic preflight rejects permission-only coupons and returns actionable feedback',()=>{
  const result=campaignPreflight(plan,facts);
  assert.equal(result.status,'REVISE');assert.equal(result.checks.length,1);
  assert.equal(result.checks[0].action,'coupon5:0');assert.equal(result.checks[0].effectiveCap,5);
  assert.equal(result.issues[0].code,'COUPON_VALUE_UNSUPPORTED');
  assert.ok(result.warnings.some(s=>s.includes('constant')));
  const revised=campaignPreflight({...plan,strategy:'recommendations',maxOfferPct:0},facts);
  assert.equal(revised.status,'PILOT_ONLY');assert.equal(revised.limits.pilotDays,7);
  assert.equal(revised.limits.jointPilotBudgetCents,500);
});

test('positive historical coupon mean authorizes only an experiment, sparse or missing evidence cannot pass',()=>{
  const f=structuredClone(facts);f.randomizedEffects[0].directRewardDifferenceCents=3;
  assert.equal(campaignPreflight(plan,f).status,'PILOT_ONLY');
  f.randomizedEffects[0].treated.observations=19;assert.equal(campaignPreflight(plan,f).status,'REVISE');
  f.randomizedEffects=[];assert.equal(campaignPreflight(plan,f).checks[0].directDifferenceCents,null);
});

test('publication revalidates age and observed market phases without reading future simulator state',()=>{
  const p={...plan,strategy:'recommendations',maxOfferPct:0};
  assert.equal(publicationCheck(p,facts,{currentDay:31}).status,'PILOT_ONLY');
  assert.equal(publicationCheck(p,facts,{currentDay:45}).issues[0].code,'STALE_ANALYSIS');
  assert.equal(publicationCheck({...p,asOfDay:55},facts,{currentDay:64,announcements:[{day:35,text:'Sale through day60.'}]}).issues[0].code,'MARKET_CHANGED');
  assert.equal(publicationCheck(p,facts,{currentDay:36,announcements:[{day:35,change:'New observed sale.'}]}).issues[0].code,'MARKET_CHANGED');
  assert.equal(publicationCheck({...p,strategy:'observe'},facts,{currentDay:99}).status,'OBSERVE');
});

test('authorization identity excludes prose but binds every executable policy setting',()=>{
  assert.equal(policyIdentity(plan),policyIdentity({...plan,rationale:'New explanation'}));
  for(const change of [{audience:'lapsed'},{merchantIndices:[1]},{maxOfferPct:5},{epsilon:.1},{asOfDay:55}])assert.notEqual(policyIdentity(plan),policyIdentity({...plan,...change}));
});

test('short-window gains and policy substitutions cannot pass the durable release gate',()=>{
 const proof={policyHash:'p',source:'INDEPENDENT_PAIRED_SIMULATION',selectedBeforeTest:true,seeds:12,scenarios:5,shoppingDays:400,lastCampaignDay:199,mature:true,integrityPassed:true,platformAfterCost:{low:1},merchant:{low:1}};
 assert.equal(durableReleaseGate(proof,'p').status,'PASS');
 assert.equal(durableReleaseGate({...proof,shoppingDays:114},'p').status,'BLOCKED');
 assert.equal(durableReleaseGate({...proof,platformAfterCost:{low:-.1}},'p').status,'BLOCKED');
 assert.equal(durableReleaseGate(proof,'other-policy').status,'BLOCKED');
 assert.equal(durableReleaseGate({...proof,selectedBeforeTest:false},'p').status,'BLOCKED');
 assert.equal(durableReleaseGate({...proof,seeds:1},'p').status,'BLOCKED');
 assert.equal(durableReleaseGate(null,'p').status,'BLOCKED');
});
