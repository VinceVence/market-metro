// Exact-artifact experiment/review/revision/publish protocol. The application
// can supply model-backed roles; local checks can use explicit test doubles.
// This module never fabricates an agent result or calls a paid model by default.
import {writeFile,rename} from 'node:fs/promises';
import {digest} from '../environment.mjs';
import {compileProgram} from './program.mjs';

export function bindExperimentResult(proposal,measurement,modelHash){
 const compiled=compileProgram(proposal.program);
 if(measurement.programHash!==compiled.hash||measurement.modelHash!==modelHash||!measurement.economyUnchanged||measurement.status!=='COMPLETED')throw Error('UNBOUND_EXPERIMENT_RESULT');
 const saved=structuredClone(measurement);
 return {id:proposal.id,hypothesis:proposal.hypothesis,program:structuredClone(proposal.program),programHash:compiled.hash,modelHash,measurement:saved,measurementHash:digest(saved)};
}
export function publishTestedArtifact(artifact,{modelHash,requireInventoryGuard=true}={}){
 if(!artifact||compileProgram(artifact.program).hash!==artifact.programHash||artifact.modelHash!==modelHash||artifact.measurement.programHash!==artifact.programHash||artifact.measurement.modelHash!==modelHash||digest(artifact.measurement)!==artifact.measurementHash)throw Error('TESTED_ARTIFACT_CHANGED');
 const m=artifact.measurement;
 if(m.status!=='COMPLETED'||m.economyUnchanged!==true||m.cashAndContributionPassed!==true||requireInventoryGuard&&m.originalInventoryPassed!==true||!Number.isFinite(m.platformDeltaUSD)||m.platformDeltaUSD<=0)return null;
 return {program:structuredClone(artifact.program),programHash:artifact.programHash,modelHash,evaluationHash:digest(m),scope:'Eligible for a bounded shadow test; not proof of2x or live deployment.'};
}

export async function runExperimentWorkflow({proposer,reviewer,closer,probe,evidence,modelHash,output}){
 const trace=[],candidates={},binding={modelHash,evidenceHash:digest(evidence),actorOrigin:evidence?.actorOrigin??'UNSPECIFIED_NOT_PROOF_OF_FRESH_AGENTS'},
  persist=async(status='RUNNING',extra={})=>{await writeFile(output+'.tmp',JSON.stringify({status,...binding,trace,candidates,...extra},null,2)+'\n');await rename(output+'.tmp',output);};
 // Existing checkpoints are evidence. Refuse an accidental replay/overwrite;
 // paid model retries must be explicit in a new workflow invocation.
 await writeFile(output,JSON.stringify({status:'INITIALIZED',...binding,trace,candidates},null,2)+'\n',{flag:'wx'});
 try{
 const first=await proposer({evidence});compileProgram(first.program);trace.push({stage:'PROPOSE',id:'A',hypothesis:first.hypothesis,programHash:compileProgram(first.program).hash});await persist();
 candidates.A=bindExperimentResult({...first,id:'A'},await probe(first),modelHash);trace.push({stage:'EXPERIMENT',id:'A',measurement:candidates.A.measurement});await persist();
 const review=await reviewer({evidence,candidate:candidates.A});if(!['approve','revise','observe'].includes(review.decision))throw Error('INVALID_EXPERIMENT_REVIEW');trace.push({stage:'REVIEW',review});await persist();
 let selected=review.decision==='approve'?'A':'observe';
 if(review.decision==='revise'){
  const revision={id:'B',hypothesis:review.hypothesis,program:review.program},compiled=compileProgram(revision.program);
  if(compiled.hash===candidates.A.programHash)throw Error('REVISION_MUST_CHANGE_POLICY');
  candidates.B=bindExperimentResult(revision,await probe(revision),modelHash);trace.push({stage:'EXPERIMENT',id:'B',measurement:candidates.B.measurement});await persist();
  const decision=await closer({evidence,candidates});
  if(!['A','B','observe'].includes(decision.selected))throw Error('INVALID_EXPERIMENT_SELECTION');
  const measured=decision.selected==='observe'?0:candidates[decision.selected].measurement.platformDeltaUSD;
  if(!Number.isFinite(decision.measuredDeltaUSD)||Math.abs(decision.measuredDeltaUSD-measured)>.005)throw Error('UNCITED_OR_INVENTED_EXPERIMENT_VALUE');
  selected=decision.selected;trace.push({stage:'SELECT',decision});await persist();
 }
 const artifact=selected==='observe'?null:publishTestedArtifact(candidates[selected],{modelHash});
 trace.push({stage:'PUBLICATION_GATE',selected,published:!!artifact,reason:artifact?'Exact tested program and financial guards passed':'Observation or failed financial guard; original policy retained'});
 const result={status:'COMPLETED',...binding,trace,candidates,selected,artifact,goalAchieved:false};await persist('COMPLETED',{selected,artifact,goalAchieved:false});return result;
 }catch(error){await persist('FAILED',{error:error.message,published:false,goalAchieved:false});throw error;}
}
