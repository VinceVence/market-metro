import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {canonicalHash,validateTrialReceipt} from '../scripts/commerce-expanded/harness-v2/contracts.mjs';
import {liveTraining} from '../demo/commerce/live-training.mjs';

const read=async path=>JSON.parse(await readFile(path,'utf8'));

test('fresh planner comparisons reconcile paid decisions, selected features and settled net',async()=>{
  const result=await read('demo/data/ontology-live-campaign.json');
  const registration=await read('docs/ontology/live/registration.json');
  assert.equal(result.registrationHash,canonicalHash(registration));
  assert.deepEqual(result.protocol,registration.protocol);
  const judge=await read('demo/data/judge-reactivation.json');
  for(const key of ['paypal','merchants','purchases','volume'])assert.equal(result.rows.fixed[key],judge.fixed[key]);
  for(const [path,hash] of Object.entries(registration.sources)){
    assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'),hash,path);
  }
  const responses=[];
  for(const arm of ['planner','ontology']){
    const review=result.reviews[arm],row=result.rows[arm];
    assert.ok(review.complete);
    assert.equal(review.decisions.length,6);
    assert.ok(review.decisions.every(d=>d.status==='VALIDATED'));
    const events=review.decisions.flatMap(d=>d.provider);
    responses.push(...events.filter(e=>e.status==='settled').map(e=>e.responseId));
    assert.equal(events.reduce((n,e)=>n+e.micros,0),review.paidMicros);
    assert.ok(review.paidMicros<=result.protocol.perPlannerCapMicros);
    assert.equal(row.aiCost,review.paidMicros/1e6);
    assert.ok(Math.abs(row.paypal-(row.paypalBeforeAI-row.aiCost))<1e-8);
    assert.equal(row.unpaidLiabilities,0);
    if(review.contract){
      assert.equal(review.contract.context.snapshotHash,registration.snapshotHash);
      assert.ok(review.models.some(m=>m.modelHash===review.contract.modelHash));
    }
    for(const t of review.toolResults.filter(t=>t.actor==='LOCAL_CAMPAIGN_TRIAL'&&t.status==='COMPLETED'))validateTrialReceipt(t.output);
  }
  assert.equal(new Set(responses).size,responses.length);assert.ok(responses.every(Boolean));
  assert.equal(result.calls,responses.length);
  const ontology=result.reviews.ontology,request=ontology.decisions.find(d=>d.tool==='train_ontology_model').choice;
  const fitted=ontology.models.find(m=>m.spec.selection==='llm_selected');
  assert.deepEqual([...fitted.fields].sort(),[...request.features].sort());
  assert.equal(fitted.report.featureTriage.reason,request.rationale);
  assert.equal(request.target,'retained_recommendation');
  assert.equal(result.rows.fixed.aiCost,0);assert.equal(result.nativePayments,0);
  assert.equal(Math.round(result.cost.studyUSD*1e6),result.reviews.planner.paidMicros+result.reviews.ontology.paidMicros);
  assert.ok(result.cost.projectUSD<50);
  const html=liveTraining(result);
  for(const label of ['Fixed rules','Planner + ontology','Gemini requested','simulated','day 126'])assert.ok(html.includes(label),label);
});
