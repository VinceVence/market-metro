// Explicit operator review, never callable by Gemini or the automatic runner.
// Keep the failed review and its full cost ceiling; do not retry that inference.
import {open,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {ROOT,readJSON,saveJSON,sha} from '../research-lab/data.mjs';
import {BASE} from './development.mjs';
import {assertFrozen} from './benchmark.mjs';
import {FLASH_LITE_PROFILE,PROJECT_ID} from '../../benchmark/vertex.mjs';

export function reconciledState(state,{id,failed,checkpoint,blocked}){
  const next=structuredClone(state),p=failed.provider,entry=next.entries.find(e=>e.id===p?.reservationId);
  if(!/^CAMP5-validation-[a-f0-9]{16}$/.test(id)||failed.status!=='FAILED'||failed.response||p?.status!=='uncertain'||!failed.error?.includes('timeout')||p.caseId!==id+'-review-30'||checkpoint.cutoff!==30||checkpoint.decision!==null||checkpoint.error!==failed.error||checkpoint.selections.llm!=='observe'||checkpoint.selections.firstChoice!=='observe')throw Error('NO_UNAMBIGUOUS_FAILED_REVIEW');
  if(blocked.status!=='FAILED'||blocked.error!=='SPEND_CIRCUIT_OPEN'||blocked.provider||blocked.response||next.entries.some(e=>e.caseId===id+'-review-55'))throw Error('LATER_DISPATCH_NOT_PROVEN_ABSENT');
  if(next.version!==1||next.projectId!==PROJECT_ID||next.lifetimeCapMicros!==8000000||next.circuit!=='UNKNOWN_PROVIDER_OUTCOME'||next.entries.filter(e=>e.status!=='settled').length!==1||entry?.status!=='uncertain'||entry.runId!=='market-'+id||entry.model!==FLASH_LITE_PROFILE.model||entry.stage!=='campaign_data_planning'||entry.caseId!==p.caseId||entry.reservedMicros!==30000||entry.chargedMicros!==30000||!Number.isSafeInteger(entry.inputBytes)||entry.inputBytes<1||entry.inputBytes>FLASH_LITE_PROFILE.limits.maxInputBytes)throw Error('UNCERTAIN_COST_REVIEW_UNSAFE');
  entry.reconciliation={at:new Date().toISOString(),previousStatus:entry.status,previousChargedMicros:entry.chargedMicros,costBasis:'unmetered_reservation_ceiling',actualUsageKnown:false,
    decision:'Keep the full $0.03 reservation charged. No decision was received or executed. Retain the failed day-30 review and its no-outreach fallback; never retry it. The blocked day-55 attempt had no ledger reservation or dispatch and may proceed after this review.'};
  entry.status='settled';next.circuit=null;return next;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const id=process.argv[2];if(!/^CAMP5-validation-[a-f0-9]{16}$/.test(id||''))throw Error('EXACT_VALIDATION_CASE_REQUIRED');
  await assertFrozen(await readJSON(resolve(BASE,'protocol.json')));
  const directory=resolve(BASE,'validation',id),ledgerPath=resolve(ROOT,'.local/gcp/model-spend.json'),lock=await open(ledgerPath+'.lock','wx',0o600);
  try{
    const original=await readFile(ledgerPath,'utf8'),state=JSON.parse(original),failed=await readJSON(resolve(directory,'requests/review-30.json')),checkpoint=await readJSON(resolve(directory,'review-30.json')),blocked=await readJSON(resolve(directory,'requests/review-55.json'));
    const next=reconciledState(state,{id,failed,checkpoint,blocked}),entry=next.entries.find(e=>e.id===failed.provider.reservationId);
    await writeFile(ledgerPath+'.timeout-review-'+entry.id+'.json',original,{flag:'wx',mode:0o600});
    await saveJSON(resolve(directory,'operator-timeout-review.json'),{at:entry.reconciliation.at,caseId:id,reservationId:entry.id,retainedCostUSD:entry.chargedMicros/1e6,actualUsageKnown:false,failedReviewRetained:true,retryFailedReview:false,blockedRequestHash:sha(blocked),decision:entry.reconciliation.decision});
    await writeFile(ledgerPath+'.tmp',JSON.stringify(next,null,2)+'\n',{mode:0o600});await rename(ledgerPath+'.tmp',ledgerPath);
    await rename(resolve(directory,'requests/review-55.json'),resolve(directory,'requests/review-55.blocked-no-dispatch.json'));
    console.log(JSON.stringify({id,retainedCostUSD:.03,actualUsageKnown:false,failedReviewRetained:true,circuitClearedAfterOperatorReview:true}));
  }finally{await lock.close();await unlink(ledgerPath+'.lock');}
}
