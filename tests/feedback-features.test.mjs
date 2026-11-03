import test from 'node:test';import assert from 'node:assert/strict';
import {feedbackFeatures,feedbackByRow} from '../scripts/commerce-growth/autonomy/feedback-features.mjs';
import {trainWorkbench} from '../scripts/commerce-growth/autonomy/team-workbench-tools.mjs';
import {readFile,mkdtemp,rm} from 'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';
test('Feedback excludes today, future events, unmatured labels and other trajectories',()=>{
 const past={episode:1,sourcePolicy:'a',day:30,customerId:'u',kind:'recommend',responded:1,authorized:0,retained:1,labelCompleteDay:56},today={...past,day:50,retained:1},future={...past,day:99,authorized:1};
 const base=feedbackFeatures([past],50,'u','recommend');assert.deepEqual(feedbackFeatures([past,today,future],50,'u','recommend'),base);
 assert.equal(base.market_mature_retention_rate,.1);assert.equal(feedbackFeatures([past],57,'u','recommend').market_mature_retention_rate,2/11);
 const current={...today,day:51},other={...past,episode:2,authorized:1};const x=feedbackByRow([past,current,other]);assert.equal(x[1].market_contacts_log,Math.log(2));assert.equal(x[1].market_authorization_rate,.2);
});
test('Boosted feedback model trains locally and matches exported inference',async()=>{
 const root=await mkdtemp(join(tmpdir(),'commerce-feedback-')),rows=JSON.parse(await readFile('docs/commerce-growth/autonomy-1/funding-training/dataset.json','utf8')).rows;
 try{const model=await trainWorkbench(root+'/model',rows,{featureView:'market_feedback',windowDays:28},'boosted');assert.equal(model.artifact.featureNames.length,20);assert.ok(model.report.metrics.auc>0&&model.report.metrics.auc<=1);assert.ok(Number.isFinite(model.report.metrics.macroMarketAUC));}
 finally{await rm(root,{recursive:true,force:true});}
});
