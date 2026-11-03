import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {datasetOverview,inspectDemand,prepareTraining,trainWorkbench,CONTEXT_FIELDS,validateCampaign} from '../scripts/commerce-growth/autonomy/team-workbench-tools.mjs';
import {RESPONSE_FIELDS,predictResponse} from '../scripts/commerce-growth/autonomy/features.mjs';
const rows=JSON.parse(await readFile('docs/commerce-growth/autonomy-1/funding-training/dataset.json','utf8')).rows;
test('Demand analysis retains late-funded positives and builds only pre-contact context features',()=>{
 const summary=datasetOverview(rows);assert.equal(summary.retainedWithoutResponse,0);assert.ok(summary.retainedWithoutImmediateFunding>0);
 const d=prepareTraining(rows,{featureView:'intent_context',windowDays:100});assert.deepEqual(d.featureNames,CONTEXT_FIELDS);assert.equal(d.rows.length,rows.length);
 assert.equal(d.featureNames.some(k=>['regime','seed','customerId','retained','authorized'].includes(k)),false);
 const i=rows.findIndex(r=>r.kind==='ask_need'&&r.observedBucket.includes('|fresh|'));assert.equal(rows[i].x[0],99);assert.deepEqual(d.rows[i].x.slice(-2),[1,0]);
 assert.throws(()=>prepareTraining(rows,{featureView:'hidden_needs',windowDays:100}),/INVALID/);
 assert.throws(()=>validateCampaign({kind:'invent_demand',objective:'joint'}),/INVALID/);
 const funnel=inspectDemand(rows,{lens:'payment_funnel',windowDays:100});assert.equal(Object.values(funnel.groups).reduce((s,g)=>s+g.retained,0),summary.retained);
});
test('Response hurdle multiplies its two probabilities and rejects a different input contract',()=>{
 const logistic=p=>({family:'logistic',featureNames:RESPONSE_FIELDS,mean:RESPONSE_FIELDS.map(()=>0),scale:RESPONSE_FIELDS.map(()=>1),coefficients:RESPONSE_FIELDS.map(()=>0),intercept:Math.log(p/(1-p))});
 const model={family:'response_hurdle',featureNames:RESPONSE_FIELDS,response:logistic(.3),retainedGivenResponse:logistic(.5)};
 assert.ok(Math.abs(predictResponse(model,RESPONSE_FIELDS.map(()=>0))-.15)<1e-12);
 assert.throws(()=>predictResponse(model,[...RESPONSE_FIELDS.map(()=>0),1]),/INVALID/);
});
test('Real local two-stage training holds out whole markets and ports predictions exactly',async()=>{
 const root=await mkdtemp(join(tmpdir(),'commerce-workbench-'));
 try{const fitted=await trainWorkbench(root+'/model',rows,{featureView:'intent_context',windowDays:28},'response_hurdle');
  assert.equal(fitted.report.status,'COMPLETED');assert.equal(fitted.report.wholeMarketFolds.length,7);assert.ok(Number.isFinite(fitted.report.metrics.brier));assert.equal(fitted.artifact.featureNames.length,18);assert.equal(fitted.artifact.models.response_hurdle.family,'response_hurdle');
 }finally{await rm(root,{recursive:true,force:true});}
});
