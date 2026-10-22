import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createFixtureSuite,fixtureManifest} from '../benchmark/fixtures.mjs';
import {createCaseEnvironment} from '../benchmark/environment.mjs';
import {createController} from '../benchmark/controllers.mjs';
import {runCase,runBenchmark,attachHumanCostStudy} from '../benchmark/orchestrator.mjs';
import {createBenchmarkService} from '../benchmark/service.mjs';
import {createSupplyYardServer} from '../scripts/serve.mjs';

const suite=createFixtureSuite(),pick=family=>suite.cases.find(c=>c.family===family);
const custom=chooseNext=>({meta:{id:'test-controller',kind:'test',version:'1'},chooseNext});
const escalate=questions=>({type:'finish',result:{status:'escalate',answers:{},findings:[],unresolvedQuestions:questions,summary:'Escalate.'}});

test('48 frozen authored cases are reproducible and split by entire family',()=>{
  const manifest=fixtureManifest(suite),again=createFixtureSuite();
  assert.equal(manifest.totalCases,48);assert.deepEqual(manifest.splits,{development:32,holdout:16});
  assert.equal(suite.digest,again.digest);assert.notEqual(suite.digest,createFixtureSuite(774).digest);
  assert.equal(new Set(suite.cases.map(c=>c.id)).size,48);
  for(const f of manifest.families)assert.equal(new Set(suite.cases.filter(c=>c.family===f.family).map(c=>c.split)).size,1);
  assert.match(manifest.holdoutLimit,/Not independently blinded/);
});

test('observations exclude oracle, family, split and unretrieved answers; raw mode excludes authored normalization',()=>{
  const fixture=pick('mixed_pallet_partial_order'),env=createCaseEnvironment(fixture),first=env.observe();
  for(const key of ['oracle','sources','family','split','variant'])assert.equal(first[key],undefined);
  assert.ok(!JSON.stringify(first).includes(fixture.sources.get_dispatch_manifest.documents[0].id));
  assert.throws(()=>first.case.questions.push('oracle'),TypeError);
  env.call({tool:'get_dispatch_manifest',args:{orderId:first.case.order.id}});
  assert.ok(env.observe().evidence.length>first.evidence.length);
  assert.ok(!JSON.stringify(env.observe('raw')).includes('"normalized"'));
  assert.equal(first.evidence.length,fixture.packet.initialEvidence.length);
  const raw=env.observe('raw');assert.ok(raw.evidence.some(d=>d.text.includes('P7:')));
});

test('all baselines use identical inputs; fixed workflow is a competent early-stopping reference',async()=>{
  const report=await runBenchmark(),fixed=report.byController.find(r=>r.id==='fixed_workflow');
  assert.equal(report.trials.length,144);assert.ok(report.inputAudit.every(a=>a.matched));
  assert.equal(fixed.correctReady,41);assert.equal(fixed.correctEscalations,7);assert.equal(fixed.unsupportedReady,0);
  assert.equal(fixed.missedMaterialFindings,0);assert.equal(fixed.toolCalls,60);
  const clean=report.trials.filter(t=>t.family==='clean_complete'&&t.controller.id==='fixed_workflow');
  assert.ok(clean.every(t=>t.metrics.toolCalls===0&&t.grade.correctReady));
  assert.ok(report.byController.every(r=>r.llmTrials===0&&r.totalHandlingCostMicros===null));
  assert.equal(report.benefit.status,'NOT_ESTABLISHED');
  assert.ok(report.byController.find(r=>r.id==='cost_aware_script').assumedToolCostMicros>=fixed.assumedToolCostMicros,'Do not force a cost-aware control win.');
});

test('each trial gets fresh state and identical repetitions preserve outcomes without claiming independent evidence',async()=>{
  const before=structuredClone(suite.cases);
  const result=await runBenchmark({split:'holdout',controllers:['fixed_workflow'],repeats:2});
  for(const c of suite.cases.filter(c=>c.split==='holdout')){
    const [a,b]=result.trials.filter(t=>t.caseId===c.id);
    assert.deepEqual(a.grade,b.grade);assert.deepEqual(a.history,b.history);assert.equal(a.inputDigest,b.inputDigest);
  }
  assert.deepEqual(suite.cases,before);assert.match(result.repeatMeaning,/not independent/);
});

test('a guessed correct value without retrieved supporting citations fails the grader',async()=>{
  const fixture=pick('mixed_pallet_partial_order'),expected=fixture.oracle.answers.delivered_units;
  const trial=await runCase(fixture,custom(async()=>({type:'finish',result:{status:'ready_for_human_review',answers:{delivered_units:{value:expected.value,evidence:expected.supportSets[0]}},findings:['BATCH_SCOPE'],unresolvedQuestions:[],summary:'I guessed the hidden answer.'}})));
  assert.equal(trial.grade.correctReady,false);assert.equal(trial.grade.unsupportedReady,true);
  assert.deepEqual(trial.grade.unsupportedAnswers,['delivered_units']);
});

test('inflated fulfillment and citations from merchant claims are flagged as unsupported gross, not provider loss',async()=>{
  const fixture=pick('mixed_pallet_partial_order'),trial=await runCase(fixture,custom(async o=>({type:'finish',result:{status:'ready_for_human_review',answers:{delivered_units:{value:o.case.order.units,evidence:[o.evidence[0].id]}},findings:[],unresolvedQuestions:[],summary:'Everything is delivered.'}})));
  assert.equal(trial.grade.unsupportedReady,true);assert.ok(trial.grade.unsupportedExposureCents>0);
  assert.match(trial.grade.disclosure,/not realized PayPal loss/);
});

test('blanket escalation cannot earn useful completion or hide unnecessary escalations',async()=>{
  const report=await runBenchmark({controllers:['abstain_control']});
  assert.equal(report.byController[0].correctReady,0);assert.equal(report.byController[0].unnecessaryEscalations,41);
  assert.equal(report.byController[0].usefulCompletionRate,0);assert.equal(report.benefit.status,'NOT_ESTABLISHED');
});

test('budgets bound repeated calls and turn loops; constrained infeasibility is separately scored',async()=>{
  const f=pick('mixed_pallet_partial_order');
  const repeated=await runCase(f,custom(async o=>({type:'tool',tool:'refresh_carrier_record',args:{orderId:o.case.order.id}})),{limits:{maxCalls:2,maxCostMicros:60000}});
  assert.equal(repeated.metrics.toolCalls,2);assert.equal(repeated.metrics.assumedToolCostMicros,60000);assert.equal(repeated.stopReason,'BUDGET_EXHAUSTED');
  const low=await runBenchmark({controllers:['fixed_workflow'],limits:{maxCalls:0,maxCostMicros:0}});
  assert.ok(low.byController[0].budgetLimited>0);assert.equal(low.byController[0].unsupportedReady,0);
  assert.equal(low.byController[0].unnecessaryEscalations,0);
  const turnLimited=await runCase(f,custom(async o=>({type:'tool',tool:'refresh_carrier_record',args:{orderId:o.case.order.id}})),{limits:{maxCalls:20,maxCostMicros:1000000,maxTurns:2}});
  assert.equal(turnLimited.stopReason,'TURN_LIMIT');assert.equal(turnLimited.metrics.decisionTurns,2);assert.equal(turnLimited.metrics.toolCalls,2);
});

test('an escalation with fabricated or uncited findings cannot receive correct-escalation credit',async()=>{
  const f=suite.cases.find(c=>c.family==='business_context_scope'&&!c.oracle.resolvable);
  const guessed=await runCase(f,custom(async o=>({type:'finish',result:{status:'escalate',answers:{},findings:['ENTITY_MISMATCH'],findingEvidence:{ENTITY_MISMATCH:[o.evidence[0].id]},unresolvedQuestions:['business_years'],summary:'Unsupported allegation.'}})));
  assert.equal(guessed.grade.correctEscalation,false);assert.deepEqual(guessed.grade.unsupportedFindings,['ENTITY_MISMATCH']);
});

test('unauthorized payment tools and wrong-order requests are blocked before any action',async()=>{
  const f=pick('unresolvable_or_untrusted');
  for(const action of [{type:'tool',tool:'release_reserve',args:{orderId:f.packet.order.id}},{type:'tool',tool:'refresh_carrier_record',args:{orderId:'OTHER'}}]){
    const trial=await runCase(f,custom(async()=>action));
    assert.equal(trial.stopReason,'TOOL_DENIED');assert.equal(trial.metrics.toolCalls,0);assert.equal(trial.grade.unauthorizedAction,true);
    assert.equal(trial.grade.correctEscalation,false);
  }
});

test('timeouts, invalid terminal output and controller failures do not count as successful escalation',async()=>{
  const f=suite.cases.find(c=>!c.oracle.resolvable);
  const timeout=await runCase(f,custom(async()=>new Promise(()=>{})),{limits:{decisionTimeoutMs:5}});
  assert.equal(timeout.stopReason,'CONTROLLER_TIMEOUT');assert.equal(timeout.grade.correctEscalation,false);
  const invalid=await runCase(f,custom(async()=>({type:'finish',result:{status:'ready_for_human_review'}})));
  assert.equal(invalid.stopReason,'INVALID_RESULT');assert.equal(invalid.grade.correctReady,false);
  await assert.rejects(()=>runCase(f,{meta:{id:'future',kind:'llm'},chooseNext:async()=>{throw new Error('Must not execute');}}),/requires a metered/);
  assert.throws(()=>createController('llm_investigator'),/LLM_NOT_IMPLEMENTED/);
});

test('human costs stay unknown until supplied, retain provenance and never mutate grades',async()=>{
  const report=await runBenchmark({split:'holdout',controllers:['fixed_workflow']}),t=report.trials[0];
  const entry={caseId:t.caseId,controllerId:t.controller.id,repeat:t.repeat,reviewSeconds:60,correctionSeconds:30,provenance:'assumed'};
  const priced=attachHumanCostStudy(report,[entry],{hourlyRateCents:3000});
  assert.equal(priced.trials[0].cost.humanCostMicros,750000);
  assert.equal(priced.byController[0].estimatedHandlingCostMicros,null);
  assert.equal(report.trials[0].cost.humanReviewMinutes,null);assert.deepEqual(priced.trials[0].grade,t.grade);
  assert.throws(()=>attachHumanCostStudy(report,[entry,entry],{hourlyRateCents:3000}),/Duplicate/);
  const unknown=structuredClone(report);unknown.trials[0].cost.modelCostMicros=null;
  assert.equal(attachHumanCostStudy(unknown,[entry],{hourlyRateCents:3000}).trials[0].cost.estimatedHandlingCostMicros,null);
});

test('single-flight service preserves reports and rejects changed frozen fixtures',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'supply-benchmark-'));
  try{
    const manifestPath=join(dir,'manifest.json'),storePath=join(dir,'latest.json');
    await writeFile(manifestPath,JSON.stringify(fixtureManifest(suite)));
    let count=0;const service=createBenchmarkService({manifestPath,storePath,runner:async input=>{count++;await new Promise(r=>setTimeout(r,10));return runBenchmark(input);}});
    const input={split:'development',controllers:['fixed_workflow']};
    const first=service.run(input);assert.equal(service.status().running,true);
    await assert.rejects(()=>service.run({split:'holdout'}),/Another benchmark/);
    const [a,b]=await Promise.all([first,service.run(input)]);assert.equal(count,1);assert.equal(a.runKey,b.runKey);
    a.status='changed';assert.equal((await service.latest()).status,'SCRIPTED_BASELINES_COMPLETED');
    assert.equal(JSON.parse(await readFile(storePath,'utf8')).freezeCheck,'MATCHED_FROZEN_MANIFEST');
    const changed=fixtureManifest(suite);changed.digest='invalid';await writeFile(manifestPath,JSON.stringify(changed));
    await assert.rejects(()=>service.run(input),/Frozen fixture digest changed/);
    assert.equal(service.status().running,false);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('HTTP benchmark controls reuse same-origin protection and do not expose fixture source files',async()=>{
  const paypal={status:()=>({}),list:()=>[]};let runs=0;
  const benchmark={status:()=>({llmEnabled:false}),latest:async()=>null,run:async()=>{runs++;return {status:'SCRIPTED_BASELINES_COMPLETED'};}};
  const server=createSupplyYardServer(paypal,benchmark);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin='http://127.0.0.1:'+server.address().port;
  try{
    assert.equal((await fetch(origin+'/api/benchmarks/status')).status,200);
    assert.equal((await fetch(origin+'/benchmark/fixtures.mjs')).status,404);
    assert.equal((await fetch(origin+'/api/benchmarks/run',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
    const response=await fetch(origin+'/api/benchmarks/run',{method:'POST',headers:{'Content-Type':'application/json','X-Supply-Yard':'sandbox',Origin:origin},body:'{}'});
    assert.equal(response.status,200);assert.equal(runs,1);
  }finally{await new Promise(r=>server.close(r));}
});
