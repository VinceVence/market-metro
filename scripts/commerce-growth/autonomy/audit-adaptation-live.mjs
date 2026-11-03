// Read-only audit of the one registered live campaign; never starts a run.
import {readFile,writeFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {balances} from '../../commerce-deadlines/evaluate.mjs';
import {assertGrowthIntegrity} from '../environment.mjs';
const dir='docs/commerce-growth/autonomy-1/adaptation-live-1',load=async p=>JSON.parse(await readFile(p,'utf8')),
 protocol=await load(dir+'/protocol.json'),started=await load(dir+'/started.json'),db=new DatabaseSync('.local/market-metro.sqlite',{readOnly:true});
try{
 const {s,w}=JSON.parse(db.prepare('SELECT state_json FROM autonomy_sessions WHERE id=?').get(started.id).state_json);
 assert.equal(s.status,'COMPLETED');assert.equal(w.day,w.totalDays);assertGrowthIntegrity(w);
 for(const [file,h]of Object.entries(protocol.economyHashes))assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'),h);
 for(const [file,h]of Object.entries(protocol.programHashes))assert.equal(createHash('sha256').update(await readFile(dir+'/source/'+file.replaceAll('/','--'))).digest('hex'),h);
 const providers=s.team.checkpoints.flatMap(c=>c.provider||[]),ids=new Set(providers.map(p=>p.reservationId)),ledger=(await load('.local/gcp/model-spend.json')).entries,
  entries=ledger.filter(e=>ids.has(e.id));assert.equal(entries.length,providers.length);assert.ok(entries.every(e=>e.status==='settled'));assert.equal(entries.reduce((n,e)=>n+e.chargedMicros,0),Math.round(s.team.modelCostUSD*1e6));assert.ok(s.team.modelCostUSD<=.25);assert.ok(providers.length<=6);
 const native=db.prepare('SELECT COUNT(*) n FROM paypal_receipts WHERE run_id=?').get(s.runId).n;assert.equal(native,0);
 const basket=db.prepare('SELECT count(*) n,sum(gross_cents) gross FROM autonomy_baskets WHERE run_id=?').get(s.runId),legs=db.prepare('SELECT sum(total_cents) gross FROM orders WHERE run_id=?').get(s.runId);
 assert.equal(basket.n,w.orders.length);assert.equal(basket.gross,legs.gross);assert.equal(basket.gross,w.orders.reduce((n,o)=>n+o.grossCents,0));
 const observations=[],byRequest=new Map(w.orders.map(o=>[o.requestId,o]));
 for(const d of w.decisions)for(const rank of d.ranking||[]){
  if(!Number.isFinite(rank.calibration?.baseProbability))continue;
  const c=w.growth.contacts.find(c=>c.day===d.day&&c.customerId===rank.customerId&&c.catalogId===rank.catalogId&&c.kind==='recommend');if(!c)continue;
  const o=byRequest.get(c.requestId),y=Number(Boolean(o&&!['SETTLED','PENDING_FUNDS'].includes(o.refundStatus)));
  assert.ok(d.model.calibration.asOfDay<=d.day);observations.push({day:d.day,customerId:c.customerId,contactId:c.id,requestId:c.requestId,orderId:o?.id??null,baseProbability:rank.calibration.baseProbability,adaptedProbability:rank.probability,retained:y,funded:c.authorized,calibration:rank.calibration});
 }
 const metric=field=>({brier:observations.reduce((s,r)=>s+(r[field]-r.retained)**2,0)/Math.max(1,observations.length),logLoss:observations.reduce((s,r)=>{const p=Math.max(1e-9,Math.min(1-1e-9,r[field]));return s-r.retained*Math.log(p)-(1-r.retained)*Math.log(1-p);},0)/Math.max(1,observations.length)}),closing=balances(w),
  merchantDeltas=Object.fromEntries(Object.keys(closing.merchant).map(id=>[id,(closing.merchant[id].equity-s.opening.merchant[id].equity)/100-s.comparison.fixed.merchantContributions[id]])),
  reviews=s.team.checkpoints.filter(c=>c.actor==='TRUSTED_PUBLISHER').map(c=>({observedThroughDay:c.day,publishedDay:c.output.effectiveDay,purchasesWhileReviewing:w.orders.filter(o=>o.day>=c.day&&o.day<c.output.effectiveDay).length,decision:c.output.decision}));
 const report={status:'COMPLETED',id:s.id,runId:s.runId,seed:s.seed,regime:s.regime,days:w.day,marketDays:w.settings.days,modelCalls:s.team.modelCalls,modelCostUSD:s.team.modelCostUSD,lifetimeModelCostUSD:ledger.reduce((s,e)=>s+e.chargedMicros,0)/1e6,trainingJobs:s.team.trainingJobs,publications:s.team.publications,calibrationUpdates:s.team.calibrationUpdates,
  modelQuality:{observations:observations.length,base:metric('baseProbability'),adapted:metric('adaptedProbability'),scope:'Pre-contact predictions on the same issued recommendation contacts in this fresh live market; labels assessed only after settlement. On-policy calibration evidence, not a randomized causal or independent population benchmark.'},
  comparison:s.comparison,merchantDeltas,reviews,nativePaymentCalls:native,checks:{frozenEconomy:true,executedSourcesArchived:true,modelUsageReconciled:true,basketAndMerchantLedgerReconciled:true,noUnpaidLiabilities:s.result.unpaidLiabilities===0,autonomous:!s.team.failed&&s.team.trainingJobs>0&&s.team.publications>0,shoppingContinued:reviews.every(r=>r.purchasesWhileReviewing>0)},scope:protocol.scope};
 await writeFile(dir+'/results.json',JSON.stringify(report,null,2)+'\n');await writeFile(dir+'/checkpoints.json',JSON.stringify(s.team.checkpoints,null,2)+'\n');await writeFile(dir+'/prediction-audit.json',JSON.stringify(observations,null,2)+'\n');
 console.log(JSON.stringify({id:s.id,day:w.day,costUSD:report.modelCostUSD,calls:report.modelCalls,trained:report.trainingJobs,updates:report.calibrationUpdates,platformDeltaUSD:s.comparison.platformDeltaUSD,retailerDeltaUSD:s.result.retailerUSD-s.comparison.fixed.retailerUSD,predictionQuality:report.modelQuality,checks:report.checks}));
}finally{db.close();}
