import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createCaseEnvironment,validateLimits} from './environment.mjs';
import {createFixtureSuite,fixtureManifest,TOOL_CATALOG} from './fixtures.mjs';
import {createController,CONTROLLERS} from './controllers.mjs';
import {gradeTrial} from './scoring.mjs';

const implementationHashReady=(async()=>{
  const hash=createHash('sha256');
  for(const file of ['fixtures.mjs','analysis.mjs','controllers.mjs','environment.mjs','scoring.mjs','orchestrator.mjs'])hash.update(await readFile(new URL(file,import.meta.url)));
  return hash.digest('hex');
})();

const ESCALATE=questions=>({status:'escalate',answers:{},findings:[],unresolvedQuestions:[...questions],summary:'Harness stopped this trial; human review required.'});
function validResult(r){
  return r&&['ready_for_human_review','escalate','needs_evidence'].includes(r.status)&&r.answers&&typeof r.answers==='object'&&!Array.isArray(r.answers)
    &&Object.keys(r.answers).length<=12&&Object.values(r.answers).every(a=>a&&['string','number','boolean'].includes(typeof a.value)
      &&(typeof a.value!=='number'||Number.isSafeInteger(a.value))&&Array.isArray(a.evidence)&&a.evidence.length<=20&&a.evidence.every(s=>typeof s==='string'))
    &&Array.isArray(r.findings)&&r.findings.length<=20&&r.findings.every(s=>typeof s==='string')
    &&Array.isArray(r.unresolvedQuestions)&&r.unresolvedQuestions.every(s=>typeof s==='string')&&typeof r.summary==='string'&&r.summary.length<=4000;
}
async function chooseWithDeadline(controller,observation,ms){
  const abort=new AbortController();let timer;
  try{return await Promise.race([Promise.resolve().then(()=>controller.chooseNext(observation,{signal:abort.signal})),new Promise((_,reject)=>{
    timer=setTimeout(()=>{abort.abort();reject(new Error('CONTROLLER_TIMEOUT'));},ms);
  })]);}finally{clearTimeout(timer);}
}

export async function runCase(fixture,controller,{limits={},view='normalized'}={}){
  if(!controller?.meta?.id||typeof controller.chooseNext!=='function')throw new Error('A controller with metadata and chooseNext is required.');
  if(!['scripted','diagnostic','test','llm'].includes(controller.meta.kind)||controller.meta.kind==='llm'&&typeof controller.modelUsage!=='function')throw new Error('An LLM controller requires a metered model adapter.');
  const budget=validateLimits(limits),environment=createCaseEnvironment({packet:fixture.packet,sources:fixture.sources},budget),started=performance.now();
  let terminal=ESCALATE(fixture.packet.questions),stopReason='TURN_LIMIT',controllerError=null;
  while(environment.nextTurn()){
    let action;
    try{action=await chooseWithDeadline(controller,environment.observe(view),budget.decisionTimeoutMs);}
    catch(error){stopReason=error.message==='CONTROLLER_TIMEOUT'?'CONTROLLER_TIMEOUT':'CONTROLLER_ERROR';controllerError=String(error.message).slice(0,200);break;}
    if(action?.type==='finish'){
      if(validResult(action.result)){terminal=action.result;stopReason='CONTROLLER_FINISHED';}
      else stopReason='INVALID_RESULT';
      break;
    }
    if(action?.type!=='tool'){stopReason='INVALID_ACTION';break;}
    const response=environment.call(action);
    if(response.status==='DENIED'){stopReason='TOOL_DENIED';break;}
    if(response.status==='BUDGET_EXHAUSTED'){stopReason='BUDGET_EXHAUSTED';break;}
  }
  const trial=environment.close(terminal,stopReason);
  trial.controller={...controller.meta};trial.observationView=view;
  trial.inputDigest=createHash('sha256').update(JSON.stringify({packet:fixture.packet,sources:fixture.sources,tools:TOOL_CATALOG,limits:budget,view})).digest('hex');
  trial.metrics.wallTimeMs=Math.round((performance.now()-started)*1000)/1000;
  trial.metrics.modelCalls=0;trial.metrics.inputTokens=0;trial.metrics.outputTokens=0;
  trial.cost={assumedToolCostMicros:trial.metrics.assumedToolCostMicros,modelCostMicros:controller.meta.kind==='scripted'||controller.meta.kind==='diagnostic'?0:null,
    humanReviewMinutes:null,humanCorrectionMinutes:null,totalHandlingCostMicros:null,measurementComplete:false};
  if(controller.meta.kind==='llm'){
    const usage=controller.modelUsage();trial.model=usage;
    for(const key of ['modelCalls','actualProviderCalls','reusedReaderCalls','inputTokens','outputTokens','thinkingTokens'])trial.metrics[key]=usage[key];
    trial.cost.modelCostMicros=usage.modelCostMicros;trial.cost.actualProviderCostMicros=usage.actualProviderCostMicros;
    trial.cost.modelCostBasis=usage.measurement;
  }
  if(controllerError)trial.controllerError=controllerError;
  trial.grade=gradeTrial(fixture,trial);
  return trial;
}

export function summarizeTrials(trials){
  const sum=fn=>trials.reduce((n,t)=>n+fn(t),0),count=trials.length;
  return {trials:count,correctReady:sum(t=>Number(t.grade.correctReady)),unsupportedReady:sum(t=>Number(t.grade.unsupportedReady)),
    correctEscalations:sum(t=>Number(t.grade.correctEscalation)),unnecessaryEscalations:sum(t=>Number(t.grade.unnecessaryEscalation)),
    budgetLimited:sum(t=>Number(t.grade.budgetLimited)),unauthorizedActions:sum(t=>Number(t.grade.unauthorizedAction)),
    harnessStops:sum(t=>Number(t.stopReason!=='CONTROLLER_FINISHED')),
    missedMaterialFindings:sum(t=>t.grade.missedFindings.length),unsupportedFacts:sum(t=>t.grade.unsupportedAnswers.length+t.grade.unsupportedFindings.length),
    unsupportedExposureCents:sum(t=>t.grade.unsupportedExposureCents),toolCalls:sum(t=>t.metrics.toolCalls),
    assumedToolCostMicros:sum(t=>t.cost.assumedToolCostMicros),wallTimeMs:sum(t=>t.metrics.wallTimeMs),
    virtualSourceLatencyMs:sum(t=>t.metrics.virtualSourceLatencyMs),usefulCompletionRate:count?sum(t=>Number(t.grade.correctReady))/count:0,
    modelCalls:sum(t=>t.metrics.modelCalls),llmTrials:sum(t=>Number(t.controller.kind==='llm')),
    modelCostMicros:trials.every(t=>Number.isSafeInteger(t.cost.modelCostMicros))?sum(t=>t.cost.modelCostMicros):null,
    humanMinutes:null,totalHandlingCostMicros:null};
}

export async function runBenchmark(input={}){
  const allowed=['seed','split','controllers','limits','repeats'];if(Object.keys(input).some(k=>!allowed.includes(k)))throw new Error('Unknown benchmark option.');
  const {seed=773,split='all',controllers=['fixed_workflow','gather_all','cost_aware_script'],repeats=1}=input;
  if(!['all','development','holdout'].includes(split))throw new Error('Unknown split.');
  if(!Array.isArray(controllers)||!controllers.length||controllers.length>4||new Set(controllers).size!==controllers.length||controllers.some(id=>!CONTROLLERS.some(c=>c.id===id)))throw new Error('Unknown or duplicate scripted controller. LLM is not implemented.');
  if(!Number.isInteger(repeats)||repeats<1||repeats>3)throw new Error('Repeats must be 1–3.');
  const limits=validateLimits(input.limits),suite=createFixtureSuite(seed),cases=suite.cases.filter(c=>split==='all'||c.split===split),trials=[];
  const started=performance.now();
  for(const fixture of cases)for(let repeat=0;repeat<repeats;repeat++)for(const id of controllers){
    const trial=await runCase(fixture,createController(id),{limits});
    // Family/split metadata is added only after the controller has finished.
    trials.push({...trial,repeat,family:fixture.family,split:fixture.split});
  }
  const byController=controllers.map(id=>({id,...summarizeTrials(trials.filter(t=>t.controller.id===id))}));
  const byFamily=controllers.flatMap(id=>[...new Set(cases.map(c=>c.family))].map(family=>({id,family,...summarizeTrials(trials.filter(t=>t.controller.id===id&&t.family===family))})));
  const config={seed,split,controllers,repeats,limits,view:'fixture_normalized'};
  const inputAudit=cases.map(c=>({caseId:c.id,matched:new Set(trials.filter(t=>t.caseId===c.id).map(t=>t.inputDigest)).size===1}));
  if(inputAudit.some(a=>!a.matched))throw new Error('Trial inputs diverged across controllers.');
  return {schema:'supply-yard-benchmark-run-v1',status:'SCRIPTED_BASELINES_COMPLETED',suite:fixtureManifest(suite),config,
    implementationHash:await implementationHashReady,inputAudit,
    runKey:createHash('sha256').update(JSON.stringify({digest:suite.digest,config})).digest('hex'),
    createdAt:new Date().toISOString(),wallTimeMs:Math.round(performance.now()-started),byController,byFamily,trials,
    llm:{status:'NOT_IMPLEMENTED',trials:0},repeatMeaning:'Repeated scripted runs test determinism; they are not independent LLM reliability trials.',benefit:{status:'NOT_ESTABLISHED',totalHandlingCostKnown:false,reason:'Tool prices are authored assumptions. No LLM cost or human handling-time study exists; readiness is not an actual reserve decision.'},
    disclosure:'48 authored cases, shared normalized source claims and budgets. These are deterministic controllers, not AI agents or a learned parser. Source documents and evaluator truth stay server-side; controllers see only permitted observations. The in-process adapter is for trusted code, not a sandbox for arbitrary JavaScript. No payment, reserve change, external message or LLM call occurs.'};
}

// Optional offline cost study. Missing human observations remain unknown, never zero.
export function attachHumanCostStudy(report,entries,{hourlyRateCents}={}){
  if(!Number.isSafeInteger(hourlyRateCents)||hourlyRateCents<0||hourlyRateCents>1000000)throw new Error('A valid, explicitly assumed hourly rate is required.');
  if(!Array.isArray(entries))throw new Error('Review log must be an array.');
  const copy=structuredClone(report),used=new Set();
  for(const entry of entries){
    const key=[entry.caseId,entry.controllerId,entry.repeat].join('|');
    if(used.has(key))throw new Error('Duplicate human observation.');used.add(key);
    const trial=copy.trials.find(t=>t.caseId===entry.caseId&&t.controller.id===entry.controllerId&&t.repeat===entry.repeat);
    if(!trial)throw new Error('Human observation does not match a trial.');
    if(!['recorded','assumed'].includes(entry.provenance)||![entry.reviewSeconds,entry.correctionSeconds].every(n=>Number.isFinite(n)&&n>=0&&n<=86400))throw new Error('Invalid human observation.');
    const seconds=entry.reviewSeconds+entry.correctionSeconds,humanCostMicros=Math.round(seconds*hourlyRateCents*10000/3600);
    Object.assign(trial.cost,{humanReviewMinutes:entry.reviewSeconds/60,humanCorrectionMinutes:entry.correctionSeconds/60,
      humanTimeProvenance:entry.provenance,hourlyRateCents,humanCostMicros,
      estimatedHandlingCostMicros:trial.cost.modelCostMicros===null?null:trial.cost.assumedToolCostMicros+trial.cost.modelCostMicros+humanCostMicros});
  }
  copy.humanStudy={records:entries.length,hourlyRateCents,assumption:'Tool prices and labor rate are assumptions. Local compute/maintenance is excluded. This is not actual PayPal ROI.'};
  for(const summary of copy.byController){
    const trials=copy.trials.filter(t=>t.controller.id===summary.id);
    summary.humanMeasurements=trials.filter(t=>t.cost.humanTimeProvenance==='recorded').length;
    summary.estimatedHandlingCostMicros=trials.every(t=>Number.isSafeInteger(t.cost.estimatedHandlingCostMicros))?trials.reduce((n,t)=>n+t.cost.estimatedHandlingCostMicros,0):null;
  }
  return copy;
}
