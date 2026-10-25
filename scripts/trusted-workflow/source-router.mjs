import {SPEC_FUNCTION,AUTHORITY,MERCHANTS,GOALS,groundInterpretation} from './contract.mjs';
import {READER_PROMPT} from './agent.mjs';

// v4.1 changes the evidence interface, not the frozen v4 reader or evaluator.
// The model selects existing source IDs; code supplies the exact source text.
export function sourceUnits(brief){
  return [...new Intl.Segmenter('en',{granularity:'sentence'}).segment(brief)].map((s,i)=>({id:'S'+String(i+1).padStart(3,'0'),start:s.index,end:s.index+s.segment.length,text:s.segment.trim()}));
}
export function bindSourceSelection(args,brief,units){
  const {sourceIds,...spec}=args||{};
  if(!sourceIds||typeof sourceIds!=='object'||Array.isArray(sourceIds))throw Error('SOURCE_IDS_REQUIRED');
  const byId=new Map(units.map(u=>[u.id,u.text]));
  const sourceEvidence=Object.fromEntries(Object.entries(sourceIds).map(([field,id])=>{
    if(id!==null&&!byId.has(id))throw Error('UNKNOWN_SOURCE_ID');return [field,id===null?null:byId.get(id)];
  }));
  return groundInterpretation({...spec,sourceEvidence},brief);
}
export async function interpretWithSources(session,brief){
  const units=sourceUnits(brief),schema=structuredClone(SPEC_FUNCTION);
  delete schema.parameters.properties.sourceEvidence;
  schema.parameters.properties.sourceIds={type:'OBJECT',properties:Object.fromEntries(['goal','merchants','budget','discount','duration','inactivity'].map(k=>[k,{type:'STRING',nullable:true,enum:units.map(u=>u.id),description:'ID of the existing source sentence supporting '+k+'. Null if absent or irrelevant.'}])),required:['goal','merchants','budget','discount','duration','inactivity']};
  schema.parameters.required=schema.parameters.required.map(k=>k==='sourceEvidence'?'sourceIds':k);
  const system=READER_PROMPT.replace(/For each non-null field,[\s\S]*/,'Select sourceIds from the provided immutable source units. Do not copy or rewrite source text. Each source ID must support that particular field, not an abandoned alternative. Preserve the actual requested numeric values. A request for 30 inactive days requires clarification, not a 7-day substitute. Missing budget requires clarification, not the maximum ceiling. The general authority is a safety ceiling, not permission to fill missing requirements. Clarification is successful for unsupported or ambiguous requests. Keep a short public reason; no private chain of thought or profit prediction.');
  const out=await session.call({key:'shared-reader',system,packet:{brief,sourceUnits:units,merchantDirectory:MERCHANTS,goals:GOALS,authority:AUTHORITY},functions:[schema],stage:'trusted_semantic_router'});
  if(out.name!=='interpret_mission')throw Error('WRONG_READER_FUNCTION');return bindSourceSelection(out.args,brief,units);
}
