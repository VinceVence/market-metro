import test from 'node:test';
import assert from 'node:assert/strict';
import {compileCampaign,NUMERICAL_CAMPAIGN,selectMeasuredCampaign} from '../scripts/commerce-growth/autonomy/campaign-experiment.mjs';
import {parseCampaignDecision,decisionAttribution} from '../scripts/commerce-growth/autonomy/decision-study.mjs';
import {digest} from '../scripts/commerce-growth/environment.mjs';

test('Campaign actions are bounded and reject private features, code and invalid capacity',()=>{
 const c=compileCampaign(NUMERICAL_CAMPAIGN);assert.ok(c.hash);assert.ok(Object.isFrozen(c.program.gate));
 for(const field of ['seed','regime','wallet','hidden_need','__proto__'])assert.throws(()=>compileCampaign({...NUMERICAL_CAMPAIGN,score:{field}}),/PRIVATE/);
 assert.throws(()=>compileCampaign({...NUMERICAL_CAMPAIGN,limit:11}),/INVALID/);
 assert.throws(()=>compileCampaign({...NUMERICAL_CAMPAIGN,score:{op:'eval',args:['fetch()']}}),/INVALID/);
 const parsed=parseCampaignDecision({hypothesis:'Test observed interest',rationale:'Measured conditional estimates',gateJSON:JSON.stringify(c.program.gate),scoreJSON:JSON.stringify(c.program.score),limit:10});assert.equal(parsed.programHash,c.hash);
});
test('Lower token cost with identical campaigns is not multi-agent decision improvement',()=>{
 const same={platformDeltaUSD:0,afterActualDesignCostDeltaUSD:.0003,retainedDelta:0,retailerDeltaUSD:0},arms={team:{programHash:'same'},single:{programHash:'same'}};
 const result=decisionAttribution({single_planner:same,shared_numerical_models:same},arms,'same');
 assert.equal(result.multiAgentBenefitObserved,false);assert.equal(result.llmBenefitBeyondNumericalControlObserved,false);assert.equal(result.sameSelectedProgram,true);
});
test('Coordinator cannot publish an unmeasured artifact or hide a merchant loss',()=>{
 const measurement={platformDeltaUSD:2,retailerDeltaUSD:-1,unpaidLiabilities:0},artifacts={A:{programHash:'abc',measurement}},choice={selected:'A',programHash:'abc',measurementHash:digest(measurement),rationale:'Measured gain'};
 assert.equal(selectMeasuredCampaign(choice,artifacts).selected,'fixed');
 assert.throws(()=>selectMeasuredCampaign({...choice,programHash:'different'},artifacts),/UNBOUND/);
 const positive={...measurement,retailerDeltaUSD:1};artifacts.A.measurement=positive;
 assert.throws(()=>selectMeasuredCampaign(choice,artifacts),/UNBOUND/);
 assert.equal(selectMeasuredCampaign({...choice,measurementHash:digest(positive)},artifacts).selected,'A');
});
