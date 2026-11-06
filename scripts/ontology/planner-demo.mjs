// Read-only replay. Both the live room and this example enter through withPlannerFeed.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {warmGrowthWorld} from '../commerce-expanded/commerce.mjs';
import {beginGrowthDay,observeGrowthWorld} from '../commerce-expanded/environment.mjs';
import {canonicalHash} from '../commerce-expanded/harness-v2/contracts.mjs';
import {checkCampaignModel} from '../commerce-expanded/harness-v2/model-check.mjs';
import {loadScaleInputs} from '../commerce-expanded/harness-v2/merchant-scale.mjs';
import {compileCampaign,scoreCampaign,read} from '../commerce-expanded/harness-v2/tools.mjs';
import {withPlannerFeed} from './planner-gate.mjs';

let observation;
export function observedMarket(){
  return observation??=(async()=>{
    const {seed,runId}=await read('demo/data/judge-reactivation.json');
    const world=warmGrowthWorld({seed,regime:'reactivation'});beginGrowthDay(world);
    const view=observeGrowthWorld(world);assert.equal(view.day,30);
    return {seed,runId,view};
  })().catch(e=>{observation=undefined;throw e;});
}

export function createRecordedJudgePlanner(){
  let decision=null,entries=0,active=null,published=null;
  return {
    async plan(view){
      if(active)return scoreCampaign(view,active);
      entries++;
      const [review,{contract,model,prior},originalModel,lock,development]=await Promise.all([
        readFile('docs/commerce-expanded/model-check/reactivation-fresh/judge-review.json.gz').then(b=>JSON.parse(gunzipSync(b))),
        loadScaleInputs(),readFile('docs/ontology/judge-first-ranker.json.gz').then(b=>JSON.parse(gunzipSync(b))),
        read('docs/commerce-expanded/model-check/reactivation-fresh/decisions.json'),read('docs/commerce-growth/team-1/development/results.json')
      ]);
      assert.equal(review.mode,'single');assert.equal(review.schedule.length,1);
      assert.equal(review.schedule[0].hash,contract.hash);assert.equal(canonicalHash(view),contract.context.snapshotHash);
      const cp=review.checkpoints.filter(c=>c.day===view.day);
      const calls=cp.filter(c=>c.actor==='GEMINI');
      assert.equal(calls.length,6);assert.ok(calls.every(c=>c.status==='VALIDATED'&&c.input.evidenceId===c.output.evidenceId));
      const proposed=calls.find(c=>c.toolName==='propose_campaign_trial');
      const priorTrial=cp.find(c=>c.actor==='LOCAL_CAMPAIGN_TRIAL'&&c.output.contractHash==='FIXED').output;
      const comparison=cp.find(c=>c.actor==='LOCAL_MODEL_COMPARISON').output;
      const publication=cp.find(c=>c.actor==='TRUSTED_PUBLISHER').output;
      const models=[originalModel,model].map(m=>({...m,report:review.training.find(t=>t.modelHash===m.modelHash).report}));
      const {lockHash,...locked}=lock;assert.equal(canonicalHash(locked),lockHash);
      const arm=lock.arms.find(a=>a.id===review.id);
      assert.equal(arm.snapshotHash,contract.context.snapshotHash);assert.equal(arm.checked.hash,contract.hash);
      assert.deepEqual(calls.map(c=>c.output),arm.decisions.map(d=>d.recommendation));
      const initial=compileCampaign(proposed.output.campaign,models[0],development.selectedFixed.config,contract.context);
      const tested=[initial,arm.original].map(c=>({contract:c,model:models[0],
        trial:cp.find(p=>p.actor==='LOCAL_CAMPAIGN_TRIAL'&&p.output.contractHash===c.hash).output}));
      // Re-evaluate all proposals under their sealed development receipts before scoring shoppers.
      const {selection:selected,report}=await checkCampaignModel({tested,trained:models,incumbentTrial:priorTrial,context:contract.context,
        async evaluate(c,m){assert.equal(c.hash,comparison.receipt.contractHash);assert.equal(m.modelHash,comparison.receipt.modelHash);return comparison.receipt;}});
      assert.equal(report.status,'switched');
      assert.equal(selected.decision.decision,'publish');assert.equal(selected.selected.contract.hash,publication.contractHash);
      assert.deepEqual(selected.decision.candidates.map(c=>c.contractHash),publication.candidates.map(c=>c.contractHash));
      assert.equal(comparison.receipt.receiptHash,publication.receiptHash);
      active={contract:selected.selected.contract,model:selected.selected.model,prior};
      const plan=scoreCampaign(view,active);
      published={role:'Coordinator',actor:'TRUSTED_PUBLISHER',day:view.day,completedDay:view.day,status:'COMPLETED',
        input:{source:'RECORDED_CAMPAIGN_PROPOSAL'},output:{...publication,...selected.decision}};
      const first=plan.actions.find(a=>a.kind==='recommend');
      decision={decision:'PUBLISH',campaign:contract.campaign.kind,objective:contract.campaign.objective,
        limit:contract.campaign.contactsPer100*view.scale.contactMultiplier,recordedDecisions:calls.length,
        proposal:proposed.output.rationale,contractHash:contract.hash,receiptHash:publication.receiptHash,
        candidatesChecked:selected.decision.candidates.length,model:selected.selected.model.artifact.selected,contacts:plan.actions.length,
        recommendations:plan.actions.filter(a=>a.kind==='recommend').length,inquiries:plan.actions.filter(a=>a.kind==='ask_need').length,
        example:first?{shopper:first.customerId,product:view.products.find(p=>p.catalogId===first.catalogId).title}:null};
      return plan;
    },
    summary(){return {status:'READY',pending:false,failed:false,modelCostUSD:0,modelCalls:0,
      recordedReplay:{originalModelDecisions:6,newModelCostUSD:0},checkpoints:published?[published]:[],entries,decision};},
    async close(){}
  };
}

export async function plannerFeedDemo(phase='hold',holdId){
  if(!['hold','corrected'].includes(phase))throw RangeError('Unknown campaign replay phase');
  const {seed,runId,view}=await observedMarket();
  const planner=withPlannerFeed(createRecordedJudgePlanner(),{runId,mapping:'two-links'});
  try{
    const held=await planner.plan(view),initial=planner.summary();
    assert.equal(held.held,true);assert.equal(initial.entries,0);
    const before={...initial.checkpoints[0].output,plannerEntries:initial.entries,contacts:held.actions.length,published:false};
    const result={seed,runId,reviewDay:view.day+1,throughDay:view.day,before,after:null,newModelCalls:0,newPayments:0,
      source:'LOCAL_REPLAY_OF_RECORDED_SINGLE_PLANNER'};
    if(phase==='hold')return result;
    if(holdId!==held.holdId)throw RangeError('Stale campaign mapping hold');
    planner.correctMapping(holdId,'basket_id');
    const action=await planner.plan(view),s=planner.summary(),admitted=s.checkpoints[1].output;
    assert.equal(s.entries,1);assert.equal(action.agentCampaign,true);assert.equal(admitted.correctedHoldId,held.holdId);
    assert.equal(admitted.rowsHash,before.rowsHash);assert.equal(admitted.snapshotHash,before.snapshotHash);
    assert.notEqual(admitted.schemaHash,before.schemaHash);
    result.after={admission:admitted,plannerEntries:s.entries,...s.decision};
    return result;
  }finally{await planner.close();}
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  const held=await plannerFeedDemo();
  console.log(JSON.stringify(await plannerFeedDemo('corrected',held.before.holdId),null,2));
}
