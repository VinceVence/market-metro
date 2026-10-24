import {ACTION_CONTRACT,validateDecision} from './decision-actions.mjs';

// Frozen before the chat trial. No scenario labels, latent traits or future outcomes.
// This baseline optimizes contribution using the SAME shared forecasts the reviewer sees.
export function strongRules(packet){
  const {quality,economics,forecasts,models}=packet.evidence;
  let action='KEEP_CURRENT',reason='Keep the current campaign unless an allowed alternative has positive modeled incremental contribution.';
  if(economics.products.every(p=>p.margin5<packet.constraints.minMargin)){
    action='PAUSE_OFFERS';reason='Every product is below the coupon margin floor; preserve organic purchases and stop proposing discounts.';
  }else if(!quality.paymentReconciled){
    action='ESCALATE';reason='Payment amounts do not reconcile. Preserve the current policy and request review before changing it.';
  }else{
    // Late labels are excluded upstream for BOTH controllers. A model validated on
    // the complete window is still eligible; don't handicap rules with a blanket delay veto.
    const options=forecasts.options.filter(o=>packet.allowedActions.includes(o.action)&&o.action!=='ESCALATE')
      .filter(o=>o.action!=='USE_RECENT_MODEL'||models.candidateStatus==='PROMOTED');
    const best=options.sort((a,b)=>b.estimatedGainVsKeepCents-a.estimatedGainVsKeepCents||a.action.localeCompare(b.action))[0];
    if(best&&best.estimatedGainVsKeepCents>100){action=best.action;reason=`Shared model forecast estimates ${best.estimatedGainVsKeepCents} cents improvement over keep; it clears the $1 inertia threshold. Execution retains stock, contact, holdout, margin and budget checks.`;}
  }
  return validateDecision(packet,{schema:ACTION_CONTRACT.schema,caseId:packet.caseId,evidenceHash:packet.evidenceHash,merchantId:packet.merchantId,action,evidenceIds:['quality','economics','forecasts','models'],rationale:reason});
}
