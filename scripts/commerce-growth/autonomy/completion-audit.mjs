// Verify the user-clarified operational/model-quality goal. Financial study
// outcomes are retained and reported; this never changes a benchmark result.
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import assert from 'node:assert/strict';
import {assertGrowthIntegrity} from '../environment.mjs';
import {evaluateFundingPredictions} from './funding-calibration.mjs';
const dir='docs/commerce-growth/autonomy-1/completion-1',sessionId='AUTONOMY-fbaa1815978e9f39',load=async p=>JSON.parse(await readFile(p,'utf8'));
await mkdir(dir,{recursive:true});
const db=new DatabaseSync('.local/market-metro.sqlite',{readOnly:true});
try{
 const {s,w}=JSON.parse(db.prepare('SELECT state_json FROM autonomy_sessions WHERE id=?').get(sessionId).state_json),study=await load('docs/commerce-growth/autonomy-1/adaptation-live-1/results.json'),protocol=await load('docs/commerce-growth/autonomy-1/adaptation-live-1/protocol.json');
 assert.equal(s.status,'COMPLETED');assert.equal(w.day,w.totalDays);assertGrowthIntegrity(w);
 for(const [path,hash]of Object.entries(protocol.economyHashes))assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'),hash,path);
 const decisions=s.team.checkpoints.filter(c=>c.actor==='GEMINI'),roles=[...new Set(decisions.map(c=>c.role))].sort();
 assert.deepEqual(roles,['Commerce manager','ML scientist','Market analyst']);assert.equal(decisions.length,6);assert.ok(decisions.every(c=>c.status==='VALIDATED'));
 const providers=decisions.flatMap(c=>c.provider||[]);assert.equal(providers.length,6);assert.ok(providers.every(p=>p.responseId&&p.configuredModel==='gemini-3.1-flash-lite'));
 const forbidden=new Set(['seed','regime','walletCents','hiddenNeeds','responseDraw']);
 function inspect(o){if(o&&typeof o==='object')for(const [k,v]of Object.entries(o)){assert.ok(!forbidden.has(k),'Private input key '+k);inspect(v);}}
 for(const d of decisions)inspect(d.input);
 const jobs=s.team.checkpoints.filter(c=>c.actor==='LOCAL_TRAINING_TOOL');assert.equal(jobs.length,1);assert.ok(jobs.every(c=>c.status==='COMPLETED'&&c.output.validationPassed));
 const modelDir='.local/commerce-autonomy/'+sessionId+'/model-day-30',model=await load(modelDir+'/models.json'),report=await load(modelDir+'/model-report.json');
 assert.equal(model.trainingRows,jobs[0].input.rows);assert.ok(!model.trainingEpisodes.includes(s.seed));assert.ok(model.featureNames.every(k=>!forbidden.has(k)));
 assert.ok(report.summary.forest.logLoss<report.summary.coarse.logLoss);assert.equal(model.adaptiveFunding,true);
 const publications=s.team.checkpoints.filter(c=>c.actor==='TRUSTED_PUBLISHER'&&c.output?.decision==='publish');assert.equal(publications.length,2);assert.ok(publications.every(c=>c.status==='COMPLETED'&&c.output.automated));
 assert.ok(study.reviews.every(r=>r.purchasesWhileReviewing>0));assert.ok(s.team.calibrationUpdates>0);
 const updates=db.prepare("SELECT detail_json FROM events WHERE run_id=? AND event_type='response_model_updated'").all(s.runId);assert.ok(updates.length>0);
 const quality=evaluateFundingPredictions(w.decisions,w.growth.contacts,w.orders);assert.equal(quality.observations,study.modelQuality.observations);assert.ok(quality.adapted.brier<quality.base.brier);assert.ok(quality.adapted.logLoss<quality.base.logLoss);
 assert.ok(Math.abs(quality.adapted.brier-study.modelQuality.adapted.brier)<1e-12);
 const ledger=await load('.local/gcp/model-spend.json'),ids=new Set(providers.map(p=>p.reservationId)),entries=ledger.entries.filter(e=>ids.has(e.id));
 assert.equal(ledger.projectId,'supply-yard-pilot-261021');assert.equal(entries.length,6);assert.ok(entries.every(e=>e.status==='settled'));
 const runCost=entries.reduce((n,e)=>n+e.chargedMicros,0)/1e6,lifetime=ledger.entries.reduce((n,e)=>n+e.chargedMicros,0)/1e6;assert.equal(runCost,study.modelCostUSD);assert.ok(runCost<=.25&&lifetime<8&&lifetime<50);
 const baskets=db.prepare('SELECT COUNT(*) n,SUM(gross_cents) gross FROM autonomy_baskets WHERE run_id=?').get(s.runId),legs=db.prepare('SELECT SUM(total_cents) gross FROM orders WHERE run_id=?').get(s.runId);
 assert.equal(baskets.n,w.orders.length);assert.equal(baskets.gross,legs.gross);assert.equal(baskets.gross,w.orders.reduce((n,o)=>n+o.grossCents,0));
 assert.equal(db.prepare('SELECT COUNT(*) n FROM paypal_receipts WHERE run_id=?').get(s.runId).n,0);
 const previousNative=db.prepare("SELECT COUNT(*) n FROM paypal_receipts WHERE status='COMPLETED' AND capture_id IS NOT NULL AND verified_at IS NOT NULL").get().n;assert.ok(previousNative>0);
 for(const p of ['docs/commerce-growth/autonomy-1/validation-1/results.json','docs/commerce-growth/autonomy-1/demo-1/results.json','docs/commerce-growth/autonomy-1/merchant-routing-probe-1/results.json','research/notes/final_report_commerce-agent-performance-e46beb.md','research/notes/final_report_commerce-net-headroom-0335d1.md'])await access(p);
 const checkpoints=await load('.local/commerce-autonomy/'+sessionId+'/checkpoints.json');assert.equal(checkpoints.id,sessionId);assert.equal(checkpoints.calls,6);assert.equal(checkpoints.pending,false);
 const manifest={verifiedAt:new Date().toISOString(),status:'BACKEND_AND_EVIDENCE_VERIFIED_UI_PENDING',acceptedGoal:'Autonomous workflow and model quality; report profit separately.',userClarification:'Focus on autonomous workflow and model quality; report profit separately',
  sessionId,runId:s.runId,roles,decisionCalls:decisions.length,localModelFits:jobs.length,automaticPublications:publications.length,feedbackUpdates:s.team.calibrationUpdates,warehouseUpdateEvents:updates.length,purchasesWhileReviewing:study.reviews.map(r=>r.purchasesWhileReviewing),
  trainingValidation:{rows:model.trainingRows,modelLogLoss:report.summary.forest.logLoss,coarseLogLoss:report.summary.coarse.logLoss},freshRunPredictionQuality:quality,
  cost:{runUSD:runCost,lifetimeRecordedUSD:lifetime,scope:'Provider-token cost estimate; local CPU/energy and billing-invoice reconciliation excluded.'},
  payments:{modeledCheckouts:baskets.n,modeledMerchantLegGrossCents:legs.gross,nativeCallsThisRun:0,priorVerifiedSandboxReceipts:previousNative,scope:'Current demonstration is simulated. Existing native receipts are separate, prior Sandbox integration evidence.'},
  financialResults:{platformAfterModelDeltaUSD:study.comparison.platformDeltaUSD,retailerDeltaUSD:study.comparison.team.retailerUSD-study.comparison.fixed.retailerUSD,eachMerchant:study.merchantDeltas,scope:'Separate modeled outcome, not a completion gate under the user clarification. 2x profit and universal merchant improvement are not claimed.'},
  verifiedRequirements:['Fresh role-specific Gemini decisions','Observed-data-only inputs','Actual local model fitting and validation','Automatic campaign publication','Current-market feedback updating predictions','Shoppers transact during reviews','Improved pre-contact prediction quality on the same issued contacts','Durable saved checkpoints','Warehouse/checkouts/merchant-leg reconciliation','Sandbox integration available and distinctly labeled','Frozen economic sources and original fixed reference','Existing spend and project limits','Negative financial studies retained','Completed Hyperresearch basis retained'],
  ui:{status:'PENDING',required:['Model quality leads the current performance view','Financial positive and negative results remain accessible','Replay opens the market from day1 without new paid calls','Agent evidence and warehouse remain inspectable']},
  limits:['One live seed demonstrates operation and prediction improvement; it is not population-wide superiority.','The statistical adaptation improved predictions; this does not isolate the causal benefit of three agents versus one.','Original financial targets remain unachieved and are not relabeled as passed.']};
 await writeFile(dir+'/audit.json',JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({status:manifest.status,roles,calls:decisions.length,trained:jobs.length,updates:s.team.calibrationUpdates,brierImprovement:quality.brierReduction,runCostUSD:runCost,lifetimeCostUSD:lifetime,previousVerifiedSandboxReceipts:previousNative}));
}finally{db.close();}
