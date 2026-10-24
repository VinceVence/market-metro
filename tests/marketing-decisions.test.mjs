import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTION_CONTRACT,evidenceHash,validateDecision,makeOfferPolicy} from '../scripts/marketing/decision-actions.mjs';
import {strongRules} from '../scripts/marketing/decision-rules.mjs';
import {prepareCases,replayCase,evaluateCases,operatingCostCents,PROTOCOL} from '../scripts/marketing/decision-benchmark.mjs';
import {advanceLearningDay} from '../scripts/marketing/economy.mjs';
import {localTrainerStatus} from '../scripts/marketing/trainer.mjs';

const makeDecision=(p,action='KEEP_CURRENT')=>({schema:ACTION_CONTRACT.schema,caseId:p.caseId,evidenceHash:p.evidenceHash,merchantId:p.merchantId,action,evidenceIds:['quality','forecasts'],rationale:'Choose the action from the frozen observed evidence only.'});
const simplePacket=()=>{const p={caseId:'TEST',runId:'R',merchantId:'M',day:42,horizonDays:7,constraints:{minMargin:.2},allowedActions:['KEEP_CURRENT','PAUSE_OFFERS','OFFER_5','OFFER_10','ESCALATE'],evidence:{quality:{paymentReconciled:true,labelLagDays:2},economics:{products:[{margin5:.4}]},models:{candidateStatus:'REJECTED'},forecasts:{options:[{action:'KEEP_CURRENT',estimatedGainVsKeepCents:0},{action:'OFFER_5',estimatedGainVsKeepCents:500},{action:'OFFER_10',estimatedGainVsKeepCents:50},{action:'PAUSE_OFFERS',estimatedGainVsKeepCents:-10}]}}};p.evidenceHash=evidenceHash(p);return p;};

test('action contract rejects stale evidence, foreign scope, unknown actions and extra spending authority',()=>{
  const p=simplePacket(),d=makeDecision(p);
  assert.equal(validateDecision(p,d).action,'KEEP_CURRENT');
  for(const patch of [{evidenceHash:'bad'},{merchantId:'other'},{action:'ARBITRARY_CODE'},{budgetCents:999999},{evidenceIds:['hiddenTruth']}])assert.throws(()=>validateDecision(p,{...d,...patch}));
  const changed=structuredClone(p);changed.day++;
  assert.throws(()=>validateDecision(changed,d),/EVIDENCE/);
  assert.throws(()=>makeOfferPolicy(p,d,{world:{runId:'R',tick:43,goal:{objective:'profit'}}}),/STALE_WORLD/);
});

test('strong rules optimize shared contribution forecasts and do not penalize correctly excluded late labels',()=>{
  const p=simplePacket();assert.equal(strongRules(p).action,'OFFER_5');
  p.allowedActions.push('USE_RECENT_MODEL');p.evidence.models.candidateStatus='PROMOTED';p.evidence.forecasts.options.push({action:'USE_RECENT_MODEL',estimatedGainVsKeepCents:900});p.evidenceHash=evidenceHash(p);
  assert.equal(strongRules(p).action,'USE_RECENT_MODEL');
  p.evidence.economics.products[0].margin5=.1;p.evidenceHash=evidenceHash(p);assert.equal(strongRules(p).action,'PAUSE_OFFERS');
});

test('cost accounting charges shared fitting equally and exposes assumed chat and human costs',()=>{
  const p={sharedFitRuntimeMs:3600};
  const base=operatingCostCents(p,'KEEP_CURRENT',{kind:'rules'});
  assert.equal(operatingCostCents(p,'KEEP_CURRENT',{kind:'chat'})-base,10);
  assert.equal(operatingCostCents(p,'ESCALATE',{kind:'rules'})-base,250);
});

test('offline real-training pilot preserves inputs, executes actions and reconciles paired merchant outcomes',{timeout:120000,skip:!localTrainerStatus().ready},async()=>{
  const originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw new Error('NETWORK_FORBIDDEN');};
  try{
    const {packets,states,rules}=await prepareCases({count:1,customers:100});
    const p=packets[0],state=states[0],before=JSON.stringify(state);
    for(const forbidden of ['privateTraits','couponEffect','weeklyIncome','futureSeeds','"scenario"','"seed"'])assert(!JSON.stringify(p).includes(forbidden),forbidden);
    const w=structuredClone(state.world),same=structuredClone(w);
    const policy=makeOfferPolicy(p,makeDecision(p),{world:same,candidate:state.candidate});
    assert.deepEqual(advanceLearningDay(w),advanceLearningDay(same,{offerPolicy:policy}));
    const keep=replayCase(state,p,'KEEP_CURRENT',1234),repeat=replayCase(state,p,'KEEP_CURRENT',1234),paused=replayCase(state,p,'PAUSE_OFFERS',1234);
    assert.deepEqual(keep,repeat);assert.equal(paused.merchant.coupons,0);assert.equal(paused.guardViolations,0);
    for(const action of p.allowedActions){
      const r=replayCase(state,p,action,4321);
      for(const scope of ['merchant','portfolio']){const x=r[scope];assert.equal(x.contributionCents,x.discountedSalesCents-x.refundCents-x.cogsCents-x.deliveryCents-x.feeCents-x.outreachCents);}
      assert.equal(r.guardViolations,0);
    }
    assert.equal(JSON.stringify(state),before,'Evaluator must not mutate a checkpoint');
    const {runtimeMs,...rule}=rules[0];
    const report=await evaluateCases({packets,states,rules,submission:{decisions:[rule]}});
    assert.equal(report.records[0].chat.merchant.contributionCents,report.records[0].rules.merchant.contributionCents);
    assert(report.records[0].pairedMerchantDifferences.every(d=>d===0));
    assert(Math.abs(report.totals.netDifferenceCents+10)<.01,'same decision pays only the disclosed chat-price assumption');
    assert.equal(report.newPaidApiCalls,0);assert.equal(report.totals.goGatePassed,false);
    assert.equal(report.totalCaseFuturePairs,PROTOCOL.futureReplicates);
  }finally{globalThis.fetch=originalFetch;}
});
