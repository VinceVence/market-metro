import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {createFixtureSuite} from '../benchmark/fixtures.mjs';
import {runCase,summarizeTrials} from '../benchmark/orchestrator.mjs';
import {createController} from '../benchmark/controllers.mjs';
import {createLlmController,PROMPT_HASH,READER_PROMPT,READER_SCHEMA,PLANNER_PROMPT,validateExtraction} from '../benchmark/llm-controller.mjs';
import {openSpendLedger,createVertexClient,verifySpendCap,MODEL_LIMITS,PRICING,VERTEX_MODEL,PROJECT_ID} from '../benchmark/vertex.mjs';

const root=resolve(import.meta.dirname,'..'),args=process.argv.slice(2);
if(args.some(a=>!['--run','--initialize-ledger'].includes(a)))throw new Error('Use --run to execute the frozen pilot; no unbounded options are accepted.');
const suite=createFixtureSuite(),manifest=JSON.parse(await readFile(resolve(root,'benchmark/manifest.json'),'utf8'));
if(manifest.digest!==suite.digest)throw new Error('Frozen fixture digest changed.');
const previous=JSON.parse(await readFile(resolve(root,'docs/llm-pilot-plan-v2.json'),'utf8'));
const cases=previous.caseIds.map(id=>suite.cases.find(c=>c.id===id));
if(cases.some(c=>!c)||suite.digest!==previous.suiteDigest)throw new Error('Original benchmark cases changed.');
const limits=previous.limits;
const probe={order:{id:'PO-PROBE',merchantId:'M-PROBE',units:17,createdAt:'2026-02-02T12:00:00Z'},documents:[
  {id:'PROBE-ALLOCATION',actor:'warehouse',title:'Allocation ledger',asOf:'2026-02-03T12:00:00Z',text:'Pallet Z9: 11 kits for PO-PROBE; 6 kits for another order. The remaining order units were not loaded.'},
  {id:'PROBE-OLD',actor:'carrier',title:'Earlier shipment-status record',asOf:'2026-02-01T12:00:00Z',text:'This archived shipment-status record predates the current purchase order. No quantity is shown.'},
  {id:'PROBE-CANCEL',actor:'carrier',title:'Final carrier status',asOf:'2026-02-03T12:00:00Z',text:'Replacement shipment cancelled before acceptance. No units delivered against PO-PROBE.'}
]};
const oldReaderSource=await readFile(resolve(root,'.local/benchmarks/v2-source/llm-controller.mjs'),'utf8');
if(!oldReaderSource.includes('export const PLANNER_PROMPT=`'+PLANNER_PROMPT+'`;'))throw new Error('Planner prompt changed; preserve the original comparison.');
const plan={schema:'supply-yard-llm-pilot-v3',projectId:PROJECT_ID,model:VERTEX_MODEL,region:'global',view:'raw',promptHash:PROMPT_HASH,suiteDigest:suite.digest,
  caseIds:cases.map(c=>c.id),split:'development',repeats:previous.repeats,controllers:previous.controllers,limits,modelLimits:MODEL_LIMITS,pricing:PRICING,
  readerProbe:probe,thinking:{reader:'LOW',planner:'MEDIUM'},
  changes:['Stronger Gemini 3.1 Pro model for both methods.','Typed nullable fields, per-document supporting quotes, explicit partial/stale/cancelled records and allocation rows.','Batch newly observed documents; deduplicate equivalent reader costs by unique provider receipt.','Common interpreter refuses missing quantities/status/years instead of treating partial records as answers.'],
  unchanged:['Exact V2 case IDs, raw evidence, private oracle, source tools/prices, limits and repetition count.','Fixed source-routing policy, grader and planner prompt.'],
  semanticControl:'Both arms receive identical per-document extractions only after observing that document. New documents may be read in a batch. Each arm is costed once per unique reader receipt, including shared reuse. Cache keys include model and prompt version. Hidden records never enter the cache until queried.',
  decision:'Do not claim agent benefit unless quality and useful coverage match the fixed-reader arm and equivalent machine cost falls. Human time and production PayPal benefit remain unmeasured.',
  limitations:['Ten known development cases; no independent validation or holdout claim.','Two trials per case are a pilot, not a reliability estimate.','Reader fixes were motivated by the earlier observed development failures; improvement is not independent generalization.','The reader and model changed together; cross-version improvement cannot be assigned to either alone.','Fixed normalized reference uses authored extraction and is not an end-to-end competitor.','Physical wall times are not fair latency comparisons because the second arm reuses reader outputs.']};
const sourceHash=createHash('sha256');
for(const file of ['benchmark/vertex.mjs','benchmark/llm-controller.mjs','benchmark/controllers.mjs','benchmark/orchestrator.mjs','benchmark/environment.mjs','benchmark/analysis.mjs','benchmark/scoring.mjs','scripts/llm-pilot.mjs'])sourceHash.update(await readFile(resolve(root,file)));
plan.implementationHash=sourceHash.digest('hex');
const planPath=resolve(root,'docs/llm-pilot-plan-v3.json');
try{await writeFile(planPath,JSON.stringify(plan,null,2)+'\n',{flag:'wx'});}
catch(e){if(e.code!=='EEXIST')throw e;const frozen=JSON.parse(await readFile(planPath,'utf8'));if(JSON.stringify(frozen)!==JSON.stringify(plan))throw new Error('Pilot configuration/code differs from frozen plan. Version it explicitly; do not overwrite after looking at outcomes.');}
console.log('Frozen V3: same 10 cases × 2 repetitions × 2 policies; Gemini 3.1 Pro. $5 run limit; $8 lifetime including all prior spend; $10 native monthly Vertex cap.');
if(!args.includes('--run')){console.log('No model call made. Run with --run after testing the guards.');process.exit(0);}

const configPath=resolve(root,'.local/gcp/config.json'),config=JSON.parse(await readFile(configPath,'utf8'));
const auth=await promisify(execFile)(config.pythonPath,['-B',resolve(root,'scripts/vertex-token.py'),configPath],{timeout:30_000,maxBuffer:16_384});
const token=auth.stdout.trim();if(!token||token.length<20)throw new Error('ADC_TOKEN_UNAVAILABLE');
const cap=await verifySpendCap(config,token),runId=randomUUID();
const ledger=await openSpendLedger(resolve(root,'.local/gcp/model-spend.json'),{initialize:args.includes('--initialize-ledger'),runId});
const spendBefore=ledger.snapshot().lifetimeChargedMicros,client=createVertexClient({token,ledger}),trials=[],references=[],started=new Date().toISOString();
let probeResult=null;
const reportPath=resolve(root,'.local/benchmarks/llm-pilot-'+runId+'.json');await mkdir(resolve(root,'.local/benchmarks'),{recursive:true});
const save=async status=>{
  const ids=plan.controllers;
  const report={schema:plan.schema,status,runId,startedAt:started,updatedAt:new Date().toISOString(),plan,cap,trials,references,probeResult,spendBefore,
    byController:ids.map(id=>({id,...summarizeTrials(trials.filter(t=>t.controller.id===id))})),
    inputAudit:cases.map(c=>({caseId:c.id,matched:new Set(trials.filter(t=>t.caseId===c.id).map(t=>t.inputDigest)).size===1})),
    spend:ledger.snapshot(),benefit:{status:'NOT_ESTABLISHED',humanMinutes:null,totalHandlingCostMicros:null}};
  await writeFile(reportPath+'.tmp',JSON.stringify(report,null,2)+'\n');await rename(reportPath+'.tmp',reportPath);return report;
};
try{
  await save('RUNNING');
  const output=await client.json(READER_PROMPT,probe,{caseId:'READER-PROBE',trialId:'READER-PROBE',stage:'reader',schema:READER_SCHEMA});
  const parsed=validateExtraction(output,probe.documents),allocation=parsed.get('PROBE-ALLOCATION'),old=parsed.get('PROBE-OLD'),cancel=parsed.get('PROBE-CANCEL');
  const checks={allocation:allocation.kind==='manifest'&&allocation.allocations.some(a=>a.orderId==='PO-PROBE'&&a.units===11)&&allocation.allocations.some(a=>a.orderId===null&&a.units===6),partialOld:old.kind==='order_delivery'&&old.units===undefined,cancel:cancel.kind==='order_delivery'&&cancel.status==='CANCELLED'&&cancel.units===0};
  probeResult={checks,output,event:client.events.at(-1)};await save('RUNNING');
  if(Object.values(checks).some(v=>!v))throw new Error('READER_PROBE_FAILED: fix the reading contract before spending on a full comparison.');
  console.log('Shared reader probe passed: allocation rows, incomplete old record, explicit cancelled shipment.');
  for(const fixture of cases){
    references.push({...await runCase(fixture,createController('fixed_workflow'),{limits}),family:fixture.family});
    for(let repeat=0;repeat<plan.repeats;repeat++){
      const semanticCache=new Map();
      for(const id of plan.controllers){
        const controller=createLlmController(id,client,{view:'raw',semanticCache});
        const trial=await runCase(fixture,controller,{limits,view:'raw'});trials.push({...trial,family:fixture.family,split:fixture.split,repeat});
        await save('RUNNING');
        console.log(JSON.stringify({caseId:fixture.id,controller:id,repeat,ready:trial.grade.correctReady,unsupported:trial.grade.unsupportedReady,stop:trial.stopReason,error:trial.controllerError||null,toolCalls:trial.metrics.toolCalls,modelCostMicros:trial.cost.modelCostMicros}));
        if(ledger.snapshot().circuit||trial.controllerError==='MODEL_SPEND_LIMIT'||trial.controllerError?.startsWith('VERTEX_HTTP_'))throw new Error('Pilot stopped: provider rejection/uncertainty or spending guard.');
      }
    }
  }
  const report=await save('PILOT_COMPLETED');
  await writeFile(resolve(root,'docs/llm-pilot-results-v3.json'),JSON.stringify({schema:report.schema,status:report.status,runId,startedAt:started,completedAt:report.updatedAt,plan,byController:report.byController,inputAudit:report.inputAudit,probeResult,
    actualProviderCalls:client.events.length,actualProviderCostMicros:ledger.snapshot().runChargedMicros,lifetimeCostMicros:ledger.snapshot().lifetimeChargedMicros,spendBefore,benefit:report.benefit,limitations:plan.limitations,fullTrace:reportPath},null,2)+'\n');
  console.table(report.byController.map(r=>({controller:r.id,trials:r.trials,ready:r.correctReady,unsupported:r.unsupportedReady,unnecessary:r.unnecessaryEscalations,toolUSD:r.assumedToolCostMicros/1e6,modelUSD:r.modelCostMicros/1e6})));
  console.log('Actual provider token estimate USD '+(ledger.snapshot().runChargedMicros/1e6).toFixed(6)+'; report '+reportPath);
}catch(error){await save('PILOT_STOPPED');console.error(error.message);console.error('Partial report retained: '+reportPath);process.exitCode=1;}
finally{await ledger.close();}
