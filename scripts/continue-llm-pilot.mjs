// Explicit operator recovery of a saved V2 HTTP429 interruption, never an automatic model retry.
import {readFile,writeFile,rename} from 'node:fs/promises';
import {openSync,closeSync,unlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {createFixtureSuite} from '../benchmark/fixtures.mjs';
import {runCase,summarizeTrials} from '../benchmark/orchestrator.mjs';
import {createController} from '../benchmark/controllers.mjs';
import {createLlmController,READER_PROMPT} from '../benchmark/llm-controller.mjs';
import {openSpendLedger,createVertexClient,verifySpendCap} from '../benchmark/vertex.mjs';

const root=resolve(import.meta.dirname,'..'),runId=process.argv[2];
if(!/^[a-f0-9-]{36}$/.test(runId||'')||process.argv.length!==3)throw new Error('Supply one saved V2 run UUID.');
const path=resolve(root,'.local/benchmarks/llm-pilot-'+runId+'.json');
// Serialize reconciliation itself, before the normal ledger writer lock is acquired.
const recoveryLock=path+'.recovery.lock',recoveryFd=openSync(recoveryLock,'wx',0o600);
process.once('exit',()=>{closeSync(recoveryFd);unlinkSync(recoveryLock);});
const report=JSON.parse(await readFile(path,'utf8'));
if(report.status!=='PILOT_STOPPED'||report.plan.schema!=='supply-yard-llm-pilot-v2'||report.recovery)throw new Error('Only one explicit recovery of a stopped V2 run is permitted.');
const failed=report.trials.at(-1);if(failed?.controllerError!=='VERTEX_HTTP_429')throw new Error('Recovery requires a definitive HTTP429; unknown outcomes cannot be cleared.');
const hash=createHash('sha256');
for(const file of ['benchmark/vertex.mjs','benchmark/llm-controller.mjs','benchmark/orchestrator.mjs','benchmark/environment.mjs','benchmark/analysis.mjs','benchmark/scoring.mjs','scripts/llm-pilot.mjs'])hash.update(await readFile(resolve(root,file)));
if(hash.digest('hex')!==report.plan.implementationHash)throw new Error('Policy implementation changed; do not resume this frozen comparison.');
const ledgerPath=resolve(root,'.local/gcp/model-spend.json'),state=JSON.parse(await readFile(ledgerPath,'utf8'));
const uncertain=state.entries.filter(e=>e.status!=='settled'),event=failed.model.events.find(e=>e.error==='VERTEX_HTTP_429');
if(uncertain.length!==1||uncertain[0].id!==event?.reservationId||uncertain[0].runId!==runId||event.httpStatus!==429)throw new Error('Unmatched provider outcome; preserve circuit.');
// Reviewed non-200 response: Google documents no token charge. Keep original reservation and audit.
const entry=uncertain[0];entry.reconciliation={at:new Date().toISOString(),previousStatus:entry.status,previousChargedMicros:entry.chargedMicros,observedHttpStatus:429,decision:'Definitive rejected request has no token charge; preserve prior usage and continue same run allowance.',source:'https://cloud.google.com/vertex-ai/generative-ai/pricing'};
entry.status='settled';entry.chargedMicros=0;state.circuit=null;
await writeFile(ledgerPath+'.tmp',JSON.stringify(state,null,2)+'\n',{mode:0o600});await rename(ledgerPath+'.tmp',ledgerPath);
const cfgPath=resolve(root,'.local/gcp/config.json'),cfg=JSON.parse(await readFile(cfgPath,'utf8'));
const {stdout}=await promisify(execFile)(cfg.pythonPath,['-B',resolve(root,'scripts/vertex-token.py'),cfgPath],{timeout:30000,maxBuffer:16384});
const token=stdout.trim();report.cap=await verifySpendCap(cfg,token);
const ledger=await openSpendLedger(ledgerPath,{runId}),client=createVertexClient({token,ledger,requestGapMs:12000,fetchFn:async(...args)=>{
  const response=await fetch(...args);
  if(!response.ok){
    const body=await response.clone().json().catch(()=>null);
    report.lastProviderFailure={httpStatus:response.status,message:body?.error?.message,status:body?.error?.status,details:body?.error?.details};
    console.error(JSON.stringify({providerFailure:report.lastProviderFailure}));
  }
  return response;
}});
report.infrastructureAttempts=[failed];report.trials.pop();
report.recovery={at:new Date().toISOString(),scriptHash:createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'),minRequestGapMs:12000,reason:'Explicit bounded recovery after HTTP429; same prompts, cases, model, grader and cumulative $1 run allowance. Provider failures remain separately reported; quality metrics are conditional on completed provider execution.'};
const save=async status=>{
  Object.assign(report,{status,updatedAt:new Date().toISOString(),spend:ledger.snapshot(),byController:report.plan.controllers.map(id=>({id,...summarizeTrials(report.trials.filter(t=>t.controller.id===id))})),inputAudit:report.plan.caseIds.map(caseId=>({caseId,matched:new Set(report.trials.filter(t=>t.caseId===caseId).map(t=>t.inputDigest)).size===1}))});
  await writeFile(path+'.tmp',JSON.stringify(report,null,2)+'\n');await rename(path+'.tmp',path);
};
try{
  const suite=createFixtureSuite();if(suite.digest!==report.plan.suiteDigest)throw new Error('Fixture changed.');
  for(const caseId of report.plan.caseIds){
    const fixture=suite.cases.find(c=>c.id===caseId);
    if(!report.references.some(t=>t.caseId===caseId))report.references.push({...await runCase(fixture,createController('fixed_workflow'),{limits:report.plan.limits}),family:fixture.family});
    for(let repeat=0;repeat<report.plan.repeats;repeat++){
      const cache=new Map(),prior=[...report.trials,...report.infrastructureAttempts].filter(t=>t.caseId===caseId&&t.repeat===repeat);
      for(const trial of prior)for(const extracted of trial.model.readerTrace){
        const document=structuredClone(trial.observedEvidence.find(d=>d.id===extracted.documentId));delete document.normalized;
        const key=createHash('sha256').update(JSON.stringify({prompt:READER_PROMPT,order:fixture.packet.order,document})).digest('hex');cache.set(key,structuredClone(extracted));
      }
      for(const id of report.plan.controllers){
        if(report.trials.some(t=>t.caseId===caseId&&t.repeat===repeat&&t.controller.id===id))continue;
        const trial=await runCase(fixture,createLlmController(id,client,{view:'raw',semanticCache:cache}),{limits:report.plan.limits,view:'raw'});
        report.trials.push({...trial,repeat,family:fixture.family,split:fixture.split});await save('RUNNING');
        console.log(JSON.stringify({caseId,controller:id,repeat,ready:trial.grade.correctReady,unsupported:trial.grade.unsupportedReady,error:trial.controllerError||null}));
        if(ledger.snapshot().circuit||trial.controllerError==='MODEL_SPEND_LIMIT')throw new Error('Provider/spend guard stopped continuation. No further recovery permitted.');
      }
    }
  }
  await save('PILOT_COMPLETED');
  console.table(report.byController);console.log('Saved completed pilot '+path);
}catch(error){await save('PILOT_STOPPED');console.error(error.message);process.exitCode=1;}
finally{await ledger.close();}
