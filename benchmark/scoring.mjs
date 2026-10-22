// Harness-private grader. It never calls the controller's interpretation function.
import {TOOL_CATALOG} from './fixtures.mjs';

export function isResolvableWithinBudget(fixture,limits){
  if(!fixture.oracle.resolvable)return false;
  const initial=new Set(fixture.packet.initialEvidence.map(d=>d.id)),routes=new Map();
  for(const [tool,response] of Object.entries(fixture.sources))for(const d of response.documents||[])routes.set(d.id,tool);
  let paths=[new Set()];
  for(const expected of Object.values(fixture.oracle.answers)){
    const next=[];
    for(const path of paths)for(const set of expected.supportSets){
      const tools=new Set(path);let possible=true;
      for(const id of set){if(initial.has(id))continue;const tool=routes.get(id);if(!tool){possible=false;break;}tools.add(tool);}
      if(possible)next.push(tools);
    }
    paths=next;
  }
  return paths.some(path=>path.size<=limits.maxCalls&&path.size+1<=limits.maxTurns
    &&[...path].reduce((n,name)=>n+TOOL_CATALOG.find(t=>t.name===name).costMicros,0)<=limits.maxCostMicros);
}

export function gradeTrial(fixture,trial){
  const result=trial.result,seen=new Set(trial.observedEvidence.map(d=>d.id)),expected=fixture.oracle.answers;
  const errors=[],supportedAnswers=[],unsupportedAnswers=[],missingAnswers=[];
  for(const [key,answer] of Object.entries(result.answers)){
    if(!expected[key]){errors.push('Unknown answer field: '+key);unsupportedAnswers.push(key);continue;}
    const citationValid=answer.evidence.every(id=>seen.has(id));
    const sufficient=expected[key].supportSets.some(set=>set.every(id=>answer.evidence.includes(id)));
    if(answer.value!==expected[key].value||!citationValid||!sufficient||expected[key].value===null){
      unsupportedAnswers.push(key);errors.push('Unsupported or incorrect answer: '+key);
    }else supportedAnswers.push(key);
  }
  for(const key of Object.keys(expected))if(!supportedAnswers.includes(key))missingAnswers.push(key);
  const witnesses={
    BATCH_SCOPE:d=>d.normalized?.kind==='batch_delivery',
    STALE_EVIDENCE:d=>d.normalized?.kind==='order_delivery'&&Date.parse(d.asOf)<Date.parse(fixture.packet.order.createdAt),
    REPLACEMENT_CANCELLED:d=>d.normalized?.orderId===fixture.packet.order.id&&d.normalized?.status==='CANCELLED',
    PLATFORM_TENURE_IS_NOT_BUSINESS_AGE:d=>d.normalized?.kind==='platform_tenure',
    ENTITY_MISMATCH:d=>d.normalized?.kind==='business_history'&&d.normalized?.entityId!==fixture.packet.order.merchantId
  };
  const supportedFindings=result.findings.filter(code=>fixture.oracle.requiredFindings.includes(code)
    &&Array.isArray(result.findingEvidence?.[code])&&result.findingEvidence[code].length>0
    &&result.findingEvidence[code].every(id=>seen.has(id))
    &&trial.observedEvidence.some(d=>result.findingEvidence[code].includes(d.id)&&witnesses[code]?.(d)));
  const missedFindings=fixture.oracle.requiredFindings.filter(f=>!supportedFindings.includes(f));
  const unsupportedFindings=result.findings.filter(f=>!supportedFindings.includes(f));
  const resolvable=isResolvableWithinBudget(fixture,trial.limits),ready=result.status==='ready_for_human_review';
  const normalStop=trial.stopReason==='CONTROLLER_FINISHED';
  const correctReady=ready&&normalStop&&resolvable&&!unsupportedAnswers.length&&!missingAnswers.length&&!missedFindings.length&&!unsupportedFindings.length&&!trial.violation;
  const unsupportedReady=ready&&!correctReady;
  const questionsUnknown=Object.entries(expected).filter(([,v])=>v.value===null).map(([k])=>k);
  const correctEscalation=!ready&&normalStop&&!fixture.oracle.resolvable&&questionsUnknown.every(q=>result.unresolvedQuestions.includes(q))&&!unsupportedAnswers.length&&!unsupportedFindings.length&&!missedFindings.length&&!trial.violation;
  const unnecessaryEscalation=!ready&&resolvable;
  const claimedUnits=result.answers.delivered_units?.value;
  const truthUnits=expected.delivered_units?.value;
  const unsupportedExposureCents=Number.isInteger(claimedUnits)?Math.max(0,claimedUnits-(Number.isInteger(truthUnits)?truthUnits:0))*fixture.packet.order.unitPriceCents:0;
  return {correctReady,unsupportedReady,correctEscalation,unnecessaryEscalation,budgetLimited:!resolvable&&fixture.oracle.resolvable,
    resolvableWithinBudget:resolvable,missedFindings,unsupportedFindings,supportedAnswers,unsupportedAnswers,missingAnswers,
    unauthorizedAction:Boolean(trial.violation),unsupportedExposureCents,errors,
    disclosure:'Exposure is unsupported claimed gross in authored fixtures, not realized PayPal loss. Readiness is not authorization to release money.'};
}
