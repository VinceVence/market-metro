import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {trainExpertWorkbench} from '../scripts/commerce-growth/autonomy/expert-stack.mjs';
test('Expert combiner trains on separate completed markets and preserves numerical parity',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'commerce-experts-'));
 try{const m=await trainExpertWorkbench(dir+'/fit',{featureView:'expert_scores',windowDays:100},'expert_pool',{
  referencePath:'docs/commerce-growth/roc-net-goal-1/pilot-1/reference-prediction-data.json',
  incumbentPath:'docs/commerce-growth/autonomy-1/shared-value-training-1/models.json',feedbackPath:'docs/commerce-growth/roc-net-goal-1/feedback-probe-1/forest/models.json'});
  assert.equal(m.report.rows,3882);assert.equal(m.artifact.calibrationEpisodes.length,14);assert.equal(m.artifact.featureNames.length,21);assert.ok(m.report.metrics.auc>0&&m.report.metrics.auc<1);
  assert.equal(m.artifact.calibrationEpisodes.some(id=>m.artifact.trainingEpisodes.includes(id)),false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
