// Shared deterministic interpretation of retrieved source claims. No fixtures or oracle imports.
export function analyzeEvidence(observation){
  const {order,questions}=observation.case,documents=observation.evidence;
  const current=d=>Date.parse(d.asOf)>=Date.parse(order.createdAt)&&Date.parse(d.asOf)<=Date.parse(observation.case.asOf);
  const relevant=d=>d.normalized?.orderId===order.id;
  const answers={},findings=new Set(),findingEvidence={},needs=new Set();
  const flag=(code,doc)=>{findings.add(code);findingEvidence[code]=[doc.id];};
  const attempts=new Set(observation.history.filter(h=>h.type==='tool').map(h=>h.tool));
  const stale=documents.find(d=>d.normalized?.kind==='order_delivery'&&Date.parse(d.asOf)<Date.parse(order.createdAt));
  if(stale)flag('STALE_EVIDENCE',stale);
  const batch=documents.find(d=>d.normalized?.kind==='batch_delivery'&&current(d));
  const manifests=documents.filter(d=>d.normalized?.kind==='manifest'&&current(d));
  const orderRecords=documents.filter(d=>d.normalized?.kind==='order_delivery'&&relevant(d)&&current(d)&&['carrier','office'].includes(d.actor));
  // A correctly classified partial document is useful context, but an absent quantity is not zero.
  const direct=orderRecords.filter(d=>Number.isSafeInteger(d.normalized.units)&&d.normalized.units>=0);
  if(batch){
    flag('BATCH_SCOPE',batch);
    const manifest=manifests.find(d=>typeof batch.normalized.batchId==='string'&&d.normalized.batchId===batch.normalized.batchId);
    const allocation=manifest?.normalized.allocations.find(a=>a.orderId===order.id);
    const office=direct.find(d=>d.actor==='office');
    if(allocation&&office&&allocation.units===office.normalized.units)answers.delivered_units={value:allocation.units,evidence:[manifest.id,office.id]};
    else{if(!manifest)needs.add('get_dispatch_manifest');if(!office)needs.add('get_office_receiving_log');}
  }else if(direct.length){
    const sorted=[...direct].sort((a,b)=>Date.parse(b.asOf)-Date.parse(a.asOf));
    const latest=sorted[0],sameTime=sorted.filter(d=>d.asOf===latest.asOf);
    if(sameTime.every(d=>d.normalized.units===latest.normalized.units))answers.delivered_units={value:latest.normalized.units,evidence:[latest.id]};
    else needs.add('get_dispatch_manifest');
  }else{needs.add('refresh_carrier_record');needs.add('get_office_receiving_log');}
  const cancelled=orderRecords.find(d=>d.normalized.status==='CANCELLED');if(cancelled)flag('REPLACEMENT_CANCELLED',cancelled);
  if(questions.includes('refund_status')){
    const record=documents.filter(d=>d.actor==='payments'&&d.normalized?.kind==='refund'&&relevant(d)&&current(d)).sort((a,b)=>Date.parse(b.asOf)-Date.parse(a.asOf))[0];
    if(record&&['PENDING','COMPLETED'].includes(record.normalized.status))answers.refund_status={value:record.normalized.status,evidence:[record.id]};else needs.add('get_cancellation_refund_history');
  }
  if(questions.includes('business_years')){
    const tenure=documents.find(d=>d.normalized?.kind==='platform_tenure');if(tenure)flag('PLATFORM_TENURE_IS_NOT_BUSINESS_AGE',tenure);
    const records=documents.filter(d=>d.actor==='registry'&&d.normalized?.kind==='business_history'&&current(d));
    const match=records.find(d=>d.normalized.entityId===order.merchantId);
    if(match&&Number.isSafeInteger(match.normalized.years)&&match.normalized.years>=0)answers.business_years={value:match.normalized.years,evidence:[match.id]};
    else{needs.add('request_missing_document_in_simulator');if(!match&&records.length)flag('ENTITY_MISMATCH',records[0]);}
  }
  for(const key of Object.keys(answers))if(!questions.includes(key))delete answers[key];
  const missing=questions.filter(key=>!(key in answers));
  const candidates=[...needs].filter(tool=>!attempts.has(tool));
  return {answers,findings:[...findings],findingEvidence,missing,candidates};
}

export function recommendation(analysis){
  return {status:analysis.missing.length?'escalate':'ready_for_human_review',answers:analysis.answers,findings:analysis.findings,findingEvidence:analysis.findingEvidence,
    unresolvedQuestions:analysis.missing,summary:analysis.missing.length?'Independent evidence remains unavailable or conflicting. Human follow-up required.':'Requested facts are supported under the authored evidence rule. A human owns the reserve decision.'};
}
