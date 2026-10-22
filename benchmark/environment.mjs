// Capability boundary for trusted controllers: only a copied case and retrieved documents escape.
import {TOOL_CATALOG} from './fixtures.mjs';

export const DEFAULT_LIMITS=Object.freeze({maxCalls:8,maxTurns:10,maxCostMicros:300000,decisionTimeoutMs:1000});
export function validateLimits(input={}){
  if(Object.keys(input).some(k=>!(k in DEFAULT_LIMITS)))throw new Error('Unknown budget setting.');
  const limits={...DEFAULT_LIMITS,...input};
  for(const [key,max] of [['maxCalls',20],['maxTurns',30],['maxCostMicros',10000000],['decisionTimeoutMs',120000]]){
    if(!Number.isSafeInteger(limits[key])||limits[key]<(key==='maxCalls'||key==='maxCostMicros'?0:1)||limits[key]>max)throw new Error('Invalid '+key+'.');
  }
  return limits;
}
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;}

export function createCaseEnvironment(input,settings={}){
  const limits=validateLimits(settings),packet=structuredClone(input.packet),sources=structuredClone(input.sources);
  const evidence=new Map(packet.initialEvidence.map(d=>[d.id,d])),history=[];
  let calls=0,turns=0,costMicros=0,virtualLatencyMs=0,finished=false,violation=null;
  function observe(view='normalized'){
    if(!['normalized','raw'].includes(view))throw new Error('Unknown observation view.');
    const visibleCase=structuredClone(packet);delete visibleCase.initialEvidence;
    const docs=structuredClone([...evidence.values()]);
    if(view==='raw')docs.forEach(d=>delete d.normalized);
    const visibleHistory=structuredClone(history);
    if(view==='raw')for(const h of visibleHistory)for(const d of h.response?.documents||[])delete d.normalized;
    return freeze({case:visibleCase,evidence:docs,history:visibleHistory,tools:structuredClone(TOOL_CATALOG),
      observationMode:view==='normalized'?'AUTHORED_NORMALIZED_CLAIMS':'RAW_AUTHORED_DOCUMENTS',
      budget:{remainingCalls:limits.maxCalls-calls,remainingTurns:limits.maxTurns-turns,remainingCostMicros:limits.maxCostMicros-costMicros},
      authority:'Read-only simulated evidence. No payment, refund, message or reserve mutation tools.'});
  }
  function nextTurn(){if(finished)throw new Error('Trial already closed.');if(turns>=limits.maxTurns)return false;turns++;return true;}
  function call(action){
    if(finished)throw new Error('Trial already closed.');
    const tool=TOOL_CATALOG.find(t=>t.name===action?.tool),args=action?.args;
    if(!tool||!args||Object.keys(args).some(k=>k!=='orderId')||args.orderId!==packet.order.id){
      violation='UNAUTHORIZED_OR_INVALID_TOOL';history.push({type:'rejected_tool',tool:String(action?.tool).slice(0,100),error:violation});return {status:'DENIED',error:violation};
    }
    if(calls>=limits.maxCalls||costMicros+tool.costMicros>limits.maxCostMicros){
      history.push({type:'budget_rejection',tool:tool.name,error:'BUDGET_EXHAUSTED'});return {status:'BUDGET_EXHAUSTED'};
    }
    calls++;costMicros+=tool.costMicros;virtualLatencyMs+=tool.latencyMs;
    const response=structuredClone(sources[tool.name]??{status:'UNAVAILABLE',message:'No permitted record.'});
    for(const doc of response.documents||[])evidence.set(doc.id,structuredClone(doc));
    history.push({type:'tool',tool:tool.name,args:structuredClone(args),reason:String(action.reason||'').slice(0,500),costMicros:tool.costMicros,virtualLatencyMs:tool.latencyMs,response:structuredClone(response)});
    return freeze(structuredClone(response));
  }
  function close(result,stopReason){
    if(finished)throw new Error('Trial already closed.');finished=true;
    history.push({type:'finish',stopReason,result:structuredClone(result)});
    const caseSummary=structuredClone(packet);delete caseSummary.initialEvidence;
    return {caseId:packet.caseId,case:caseSummary,initialEvidenceIds:packet.initialEvidence.map(d=>d.id),stopReason,result:structuredClone(result),history:structuredClone(history),observedEvidence:structuredClone([...evidence.values()]),
      metrics:{toolCalls:calls,decisionTurns:turns,assumedToolCostMicros:costMicros,virtualSourceLatencyMs:virtualLatencyMs},
      violation,limits:{...limits}};
  }
  return {observe,nextTurn,call,close};
}
