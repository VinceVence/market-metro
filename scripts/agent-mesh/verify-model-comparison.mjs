// Replay only: reconstruct every training artifact from the exact saved inputs,
// check it against the metrics the reviewer saw, then evaluate without inference.
import assert from 'node:assert/strict';
import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {trainBandit} from '../policy-lab/learner.mjs';
import {ACTIONS} from '../policy-lab/economy.mjs';
import {evaluateDecisions} from './model-comparison.mjs';
const base=resolve(import.meta.dirname,'../../docs/agent-mesh/model-comparison'),read=async f=>JSON.parse(await readFile(resolve(base,f),'utf8'));
const r=await read('final-result.json'),evidence=await read('evidence.json'),audit=[];
await copyFile(resolve(base,'final-result.json'),resolve(base,'superseded-replay-missing-model.json'),1).catch(e=>{if(e.code!=='EEXIST')throw e;});
for(const method of ['lite','hybrid']){
 for(const d of r.outcomes[method].decisions){
  const c=evidence.cases.find(c=>c.day===d.day),model=d.proposal.retrain?trainBandit(c.rows,{cutoffDay:d.day,windowDays:d.proposal.windowDays,actions:ACTIONS}):c.priorModel;
  const expected=[...d.trace].reverse().find(t=>t.role==='Outcome reviewer'&&t.status==='COMPLETED').request.packet.model;
  if(expected){assert.ok(model);for(const k of ['mse','baselineMse','trainingRows','validationRows'])assert.equal(model[k],expected[k]);assert.equal(model.cutoffDay,expected.cutoff);}
  audit.push({method,day:d.day,retrain:d.proposal.retrain,reviewerObservedMetricsMatch:true,restoredMissingArtifact:!d.model&&Boolean(model),active:d.plan.strategy!=='observe'});
  d.model=model;
 }
 const previous=r.outcomes[method].score,score=evaluateDecisions(evidence,r.outcomes[method].decisions,{method,costMicros:previous.costMicros});
 score.deltaUSD=score.platformAfterInferenceUSD-r.outcomes.organic.score.platformAfterInferenceUSD;score.merchantDeltaUSD=(score.merchantContributionCents-r.outcomes.organic.score.merchantContributionCents)/100;
 assert.ok(Object.values(score.checks).every(n=>n===0));r.outcomes[method].score=score;
}
r.replayCorrection={reason:'Budget-resume path dropped day80 trained artifact. Restored from saved mature training rows; all model metrics match the actual reviewer request. All decisions/costs unchanged. Original incorrect replay retained separately.',audit,newProviderCalls:0};
await writeFile(resolve(base,'final-result.json'),JSON.stringify(r,null,2));await writeFile(resolve(base,'replay-verification.json'),JSON.stringify(r.replayCorrection,null,2));
console.log(JSON.stringify({cost:r.newCostUSD,paidCalls:r.paidCalls,results:Object.fromEntries(['lite','hybrid'].map(m=>[m,{platformDelta:r.outcomes[m].score.deltaUSD,merchantDelta:r.outcomes[m].score.merchantDeltaUSD,purchases:r.outcomes[m].score.purchases,offers:r.outcomes[m].score.offers,redemptions:r.outcomes[m].score.redemptions}]))}));
