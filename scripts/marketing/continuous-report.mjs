import {WorkflowError} from './workflow.mjs';

export function continuousReport(store,id){
  const w=store.state(id);
  if(!w?.continuous)throw new WorkflowError(404,'RUN_NOT_FOUND','Choose a continuous market.');
  const parse=value=>value?JSON.parse(value):null;
  const phases=Object.fromEntries(['history','live'].map(phase=>{
    const s=w[phase];
    return [phase,{purchases:s.orders,visits:s.visits,paymentVolumeCents:s.revenueCents,refundCents:s.refundsCents,modeledFeeCents:s.feesCents,modeledContributionCents:s.revenueCents-s.refundsCents-s.feesCents-s.costCents-s.deliveryCostCents-s.spendCents,couponsIssued:s.offers,couponsSeen:s.seen,couponsRedeemed:s.redemptions,discountCents:s.discountCents,outreachCents:s.spendCents,recommendations:s.recommendations||0,recommendationClicks:s.recommendationClicks||0,recommendationPurchases:s.recommendationPurchases||0}];
  }));
  const calls=store.db.prepare('SELECT * FROM marketing_planner_calls WHERE run_id=? ORDER BY rowid').all(id).map(row=>{
    const input=parse(row.input_json),choice=parse(row.choice_json),provider=parse(row.provider_json);
    return {id:row.call_id,reviewId:row.review_id,stage:row.stage,attempt:row.attempt,status:row.status,decidedDay:row.decision_day,decidedHour:row.decision_hour,evidenceThroughDay:row.evidence_day,model:row.model,choice,rationale:choice?.rationale||null,targetProducts:input?.payload.products?.filter(p=>choice?.productIds?.includes(p.productId))||[],evidence:{recentPurchases:input?.payload.recentPurchases,previousPurchases:input?.payload.previousPurchases,lapsedCustomers:input?.payload.lapsedCustomers,remainingBudgetCents:input?.payload.remainingBudgetCents,campaignOutcomes:input?.payload.campaignOutcomes,trainingResult:input?.payload.trainingResult,model:input?.payload.model,recommender:input?.payload.recommender},provider,error:parse(row.error_json),startedAt:row.started_at,finishedAt:row.finished_at};
  });
  const workerLog=store.db.prepare('SELECT day,role,action,message,evidence_json,status,source FROM team_decisions WHERE run_id=? AND day>=30 ORDER BY rowid').all(id).map(row=>({...row,evidence:parse(row.evidence_json),evidence_json:undefined}));
  const offerModels=store.db.prepare('SELECT model_id,day,status,model_type,training_rows,validation_rows,validation_log_loss,baseline_log_loss,runtime_ms,candidates_json,artifact_json IS NOT NULL AS has_artifact FROM model_runs WHERE run_id=? ORDER BY day').all(id).map(row=>({...row,candidates:parse(row.candidates_json),candidates_json:undefined}));
  const recommenders=store.db.prepare('SELECT model_id,day,model_type,training_rows,validation_purchases,candidate_recall,baseline_recall,runtime_ms,reason FROM recommendation_models WHERE run_id=? ORDER BY day').all(id);
  const budgetId=w.continuous.budgetId||id,budgetReceipts=store.db.prepare('SELECT provider_json FROM marketing_planner_calls WHERE budget_id=? OR (budget_id IS NULL AND run_id=?)').all(budgetId,budgetId).map(r=>parse(r.provider_json)).filter(Boolean);
  const budgetAccountedMicros=budgetReceipts.reduce((n,r)=>n+(r.modelCostMicros??(r.status==='uncertain'?r.reservedMicros:0)),0);
  const completeCalls=calls.filter(row=>row.status==='VALIDATED'),metered=calls.filter(row=>row.provider?.status==='settled');
  return {
    runId:id,status:w.continuous.clock,completedDays:w.tick,elapsedHours:w.tick*24+(w.continuous.hour||0),settings:{seed:w.seed,mode:w.continuous.mode,...w.continuous.settings},
    scope:'Seeded simulated shoppers and merchant finances; cached Channel3 listings. LLM decisions are distinct from local worker actions. Associated purchases do not establish causal lift.',
    phases,totals:Object.fromEntries(Object.keys(phases.live).map(key=>[key,phases.history[key]+phases.live[key]])),
    planner:{budgetId,budgetAccountedMicros,model:calls[0]?.model||null,teamStatus:w.continuous.teamStatus,lastError:w.continuous.lastError||null,analysisEnabled:w.continuous.teamEnabled,attempts:calls.length,providerAttempts:calls.filter(row=>row.provider).length,validatedDecisions:completeCalls.length,researchDecisions:completeCalls.filter(row=>row.stage==='research').length,publicationDecisions:completeCalls.filter(row=>row.stage==='publish').length,rejectedOrFailed:calls.filter(row=>['REJECTED','FAILED'].includes(row.status)).length,pending:calls.filter(row=>row.status==='REQUESTED').length,reviews:w.continuous.reviews,campaignsPublished:workerLog.filter(row=>row.action==='PUBLISH_PRODUCT_CAMPAIGN').length,meteredCostMicros:metered.reduce((n,row)=>n+(row.provider.modelCostMicros||0),0),reservedUnknownMicros:calls.filter(row=>row.provider?.status==='uncertain').reduce((n,row)=>n+(row.provider.reservedMicros||0),0),capMicros:250000,inputTokens:metered.reduce((n,row)=>n+(row.provider.inputTokens||0),0),outputTokens:metered.reduce((n,row)=>n+(row.provider.outputTokens||0),0),thinkingTokens:metered.reduce((n,row)=>n+(row.provider.thinkingTokens||0),0),costBasis:'Provider-reported tokens multiplied by the saved standard price; estimate, not a billing invoice.'},
    models:{trainingJobs:offerModels.length+recommenders.length,offerResponseJobs:offerModels.length,recommenderFits:recommenders.length,offerCandidateFits:offerModels.reduce((n,row)=>n+(row.candidates?.length||0),0),offerModels,recommenders},
    nativePayments:store.db.prepare('SELECT receipt_id,order_id,status,paypal_order_id,capture_id,gross_cents,fee_cents FROM paypal_receipts WHERE run_id=?').all(id),
    decisions:calls.filter(row=>row.evidenceThroughDay>=30),workerLog,
    dailyDecisionCounts:Array.from({length:Math.max(0,w.tick-29)},(_,i)=>({day:i+30,decisions:completeCalls.filter(row=>row.decidedDay===i+30).length})),
    generatedAt:new Date().toISOString()
  };
}
