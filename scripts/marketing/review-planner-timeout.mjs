import {open,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {FLASH_LITE_PROFILE,PROJECT_ID} from '../../benchmark/vertex.mjs';

// Operator review only. Never called by the model or the automatic runner.
// No action escaped the failed inference. Keep its entire reservation as spent;
// the actual provider charge remains unknown and must not be reported as metered.
export async function reviewPlannerTimeout({db,ledgerPath,workflowId}){
  const session=db.prepare('SELECT * FROM planner_sessions WHERE workflow_id=?').get(workflowId);
  const turn=db.prepare('SELECT * FROM planner_turns WHERE workflow_id=? ORDER BY turn_index DESC LIMIT 1').get(workflowId);
  const provider=turn?.provider_json?JSON.parse(turn.provider_json):null;
  if(session?.status!=='PAUSED'||session.model!==FLASH_LITE_PROFILE.model||session.spend_cap_micros!==250000||turn?.status!=='FAILED'||turn.request_json||turn.decision_json||turn.checkpoint_id||provider?.status!=='uncertain'||!provider.error?.includes('timeout'))throw Error('TIMEOUT_REVIEW_UNSAFE');
  const lock=await open(ledgerPath+'.lock','wx',0o600);
  try{
    const original=await readFile(ledgerPath,'utf8'),state=JSON.parse(original),entry=state.entries.find(e=>e.id===provider.reservationId);
    if(state.version!==1||state.projectId!==PROJECT_ID||state.lifetimeCapMicros!==8000000||state.circuit!=='UNKNOWN_PROVIDER_OUTCOME'||state.entries.filter(e=>e.status!=='settled').length!==1||entry?.status!=='uncertain'||entry.runId!=='market-'+workflowId||entry.model!==FLASH_LITE_PROFILE.model||entry.stage!=='planner'||entry.reservedMicros!==30000||entry.chargedMicros!==30000)throw Error('TIMEOUT_LEDGER_REVIEW_UNSAFE');
    // Input bytes and output tokens are bounded by this profile. This allowance
    // deliberately exceeds their priced maximum and is never released on retry.
    if(!Number.isSafeInteger(entry.inputBytes)||entry.inputBytes<1||entry.inputBytes>FLASH_LITE_PROFILE.limits.maxInputBytes)throw Error('TIMEOUT_INPUT_UNBOUNDED');
    await writeFile(ledgerPath+'.timeout-review-'+entry.id+'.json',original,{flag:'wx',mode:0o600});
    entry.reconciliation={at:new Date().toISOString(),previousStatus:entry.status,previousChargedMicros:entry.chargedMicros,decision:'Charge the full reservation to the budget. No model decision, executable request or checkpoint exists. Actual provider usage remains unknown.',costBasis:'unmetered_reservation_ceiling',turnId:turn.turn_id};
    entry.status='settled';state.circuit=null;
    await writeFile(ledgerPath+'.tmp',JSON.stringify(state,null,2)+'\n',{mode:0o600});await rename(ledgerPath+'.tmp',ledgerPath);
    return {workflowId,turnId:turn.turn_id,reservedCostCeilingMicros:entry.chargedMicros,actualCostKnown:false};
  }finally{await lock.close();await unlink(ledgerPath+'.lock');}
}
