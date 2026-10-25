import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openSpendLedger,createVertexClient,verifySpendCap,PROJECT_ID,MODEL_LIMITS} from '../benchmark/vertex.mjs';
import {createLlmController,validateExtraction} from '../benchmark/llm-controller.mjs';
import {createFixtureSuite} from '../benchmark/fixtures.mjs';
import {runCase} from '../benchmark/orchestrator.mjs';
import {analyzeEvidence} from '../benchmark/analysis.mjs';

const response=body=>({ok:true,json:async()=>body});
const providerResponse=text=>response({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(text)}]}}],usageMetadata:{promptTokenCount:1000,candidatesTokenCount:100,thoughtsTokenCount:10},modelVersion:'gemini-3.1-pro-preview'});
const record=(kind,fields={},quote='test source')=>({kind,orderId:null,units:null,status:null,batchId:null,entityId:null,years:null,days:null,allocations:[],quotes:[quote],...fields});
async function temporary(fn){const dir=await mkdtemp(join(tmpdir(),'supply-vertex-'));try{await fn(join(dir,'ledger.json'));}finally{await rm(dir,{recursive:true,force:true});}}

test('money ledger requires explicit initialization, locks writers, and preserves reservations across crashes',async()=>temporary(async path=>{
  await assert.rejects(()=>openSpendLedger(path),/ENOENT/);
  const ledger=await openSpendLedger(path,{initialize:true});
  await assert.rejects(()=>openSpendLedger(path),/EEXIST/);
  await ledger.reserve({caseId:'case'});await ledger.close();
  const saved=JSON.parse(await readFile(path,'utf8'));assert.equal(saved.entries[0].chargedMicros,150000);
  await assert.rejects(()=>openSpendLedger(path,{initialize:true}),/SPEND_CIRCUIT_OPEN/);
}));

test('admission enforces both run and lifetime limits before any next paid request',async()=>temporary(async path=>{
  const base={version:1,projectId:PROJECT_ID,lifetimeCapMicros:8_000_000,circuit:null};
  const entry=i=>({id:String(i),runId:'run',status:'settled',reservedMicros:150000,chargedMicros:150000});
  await writeFile(path,JSON.stringify({...base,entries:Array.from({length:33},(_,i)=>entry(i))}));
  let ledger=await openSpendLedger(path,{runId:'run'});await assert.rejects(()=>ledger.reserve({}),/MODEL_SPEND_LIMIT/);await ledger.close();
  await writeFile(path,JSON.stringify({...base,entries:Array.from({length:53},(_,i)=>entry(i))}));
  ledger=await openSpendLedger(path,{runId:'fresh'});await assert.rejects(()=>ledger.reserve({}),/MODEL_SPEND_LIMIT/);await ledger.close();
}));

test('provider is pinned to new project, reserves first and meters thinking tokens without exposing auth',async()=>temporary(async path=>{
  const ledger=await openSpendLedger(path,{initialize:true});let calls=0;
  try{
    const client=createVertexClient({token:'secret-for-test',ledger,fetchFn:async(url,options)=>{
      calls++;assert.match(url,/projects\/supply-yard-pilot-261021\/locations\/global/);
      assert.equal(ledger.snapshot().entries.at(-1).status,'pending');
      assert.equal(JSON.parse(options.body).generationConfig.maxOutputTokens,4096);return providerResponse({type:'finish'});
    }});
    assert.deepEqual(await client.json('test',{foo:1},{caseId:'one',trialId:'one'}),{type:'finish'});
    assert.equal(calls,1);assert.equal(ledger.snapshot().runChargedMicros,3320);
    assert.equal(client.events[0].thinkingTokens,10);assert.ok(!JSON.stringify(ledger.snapshot()).includes('secret-for-test'));
    await assert.rejects(()=>client.json('x'.repeat(MODEL_LIMITS.maxInputBytes+1),{},{}),/MODEL_INPUT_LIMIT/);assert.equal(calls,1);
  }finally{await ledger.close();}
}));

test('bounded Flash-Lite reasoning override preserves defaults, output limits and spend accounting',async()=>temporary(async path=>{
  const ledger=await openSpendLedger(path,{initialize:true,profile:'flash_lite',runId:'thinking-check'}),levels=[];
  try{
    const client=createVertexClient({token:'test-only',ledger,profile:'flash_lite',requestGapMs:0,fetchFn:async(_url,options)=>{
      const request=JSON.parse(options.body);levels.push(request.generationConfig.thinkingConfig.thinkingLevel);assert.equal(request.generationConfig.maxOutputTokens,2048);assert.equal(request.generationConfig.thinkingConfig.includeThoughts,false);
      return response({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"ok":true}'}]}}],usageMetadata:{promptTokenCount:1000,candidatesTokenCount:100,thoughtsTokenCount:10},modelVersion:'gemini-3.1-flash-lite'});
    }});
    await client.json('test',{}, {trialId:'one'});await client.json('test',{}, {trialId:'two',thinkingLevel:'MEDIUM'});
    assert.deepEqual(levels,['MINIMAL','MEDIUM']);assert.equal(ledger.snapshot().runChargedMicros,830);
    await assert.rejects(()=>client.json('test',{}, {thinkingLevel:'UNBOUNDED'}),/INVALID_THINKING_LEVEL/);assert.equal(levels.length,2);
  }finally{await ledger.close();}
}));

test('unknown provider outcomes retain full reservation, open circuit and never retry',async()=>temporary(async path=>{
  const ledger=await openSpendLedger(path,{initialize:true});let calls=0;
  try{
    const client=createVertexClient({token:'test',ledger,requestGapMs:0,fetchFn:async()=>{calls++;throw new Error('network timeout');}});
    await assert.rejects(()=>client.json('test',{},{}),/network timeout/);
    await assert.rejects(()=>client.json('test',{},{}),/SPEND_CIRCUIT_OPEN/);
    assert.equal(calls,1);assert.equal(ledger.snapshot().runChargedMicros,150000);assert.equal(client.events[0].modelCostMicros,null);
  }finally{await ledger.close();}
}));

test('budget preflight requires configured USD10 Vertex cap on exactly the new project',async()=>{
  const config={projectId:PROJECT_ID,projectNumber:'123',budgetName:'billingAccounts/AAAAAA-BBBBBB-CCCCCC/budgets/abcd-1234'};
  const cap={name:config.budgetName,amount:{specifiedAmount:{currencyCode:'USD',units:'10'}},budgetFilter:{projects:['projects/123'],services:['services/C7E2-9256-1C43'],calendarPeriod:'MONTH',creditTypesTreatment:'EXCLUDE_ALL_CREDITS'},spendCap:{outputState:'CONFIGURED'}};
  assert.equal((await verifySpendCap(config,'test',async()=>response(cap))).amountUSD,10);
  for(const bad of [{...cap,spendCap:{}},{...cap,budgetFilter:{...cap.budgetFilter,projects:['projects/minttown-apac-2026']}},{...cap,amount:{specifiedAmount:{currencyCode:'USD',units:'100'}}}]){
    await assert.rejects(()=>verifySpendCap(config,'test',async()=>response(bad)),/NOT_CONFIGURED/);
  }
});

test('shared reader cache keeps exact semantic parity without revealing unretrieved documents',async()=>{
  const fixture=createFixtureSuite().cases.find(c=>c.family==='clean_complete'),known=new Map(fixture.packet.initialEvidence.map(d=>[d.id,d.normalized]));
  const client={events:[],async json(system,payload,options){
    assert.ok(!JSON.stringify(payload).includes('"oracle"'));
    let value;
    if(options.stage==='reader'){
      assert.ok(!JSON.stringify(payload).includes('"normalized"'));
      value={documents:payload.documents.map(d=>({id:d.id,normalized:record(known.get(d.id).kind,Object.fromEntries(Object.entries(known.get(d.id)).filter(([k])=>k!=='entityId')),d.text)}))};
    }else value={type:'finish',reason:'Current independent order proof is sufficient.'};
    this.events.push({...options,reservationId:'fake-'+this.events.length,status:'settled',inputTokens:100,outputTokens:20,thinkingTokens:0,modelCostMicros:55});return value;
  }};
  const cache=new Map(),limits={decisionTimeoutMs:1000};
  const fixed=await runCase(fixture,createLlmController('fixed_llm_reader',client,{semanticCache:cache}),{view:'raw',limits});
  const agent=await runCase(fixture,createLlmController('adaptive_llm',client,{semanticCache:cache}),{view:'raw',limits});
  assert.equal(fixed.grade.correctReady,true);assert.equal(agent.grade.correctReady,true);assert.equal(fixed.inputDigest,agent.inputDigest);
  assert.equal(agent.metrics.actualProviderCalls,1);assert.equal(agent.metrics.reusedReaderCalls,1);
  assert.equal(fixed.metrics.modelCalls,1,'An initial document batch is billed once, not once per document.');
  assert.equal(agent.cost.modelCostMicros,110);assert.equal(agent.cost.actualProviderCostMicros,55);
  assert.deepEqual(fixed.model.readerTrace.map(d=>d.normalized),agent.model.readerTrace.map(d=>d.normalized));
  assert.equal(agent.cost.totalHandlingCostMicros,null);
});

test('reader rejects foreign IDs and malformed allocation; planner cannot execute payment actions',async()=>{
  assert.throws(()=>validateExtraction({documents:[{id:'other',normalized:{kind:'unknown'}}]},[{id:'one'}]),/INVALID_READER_CLAIM/);
  assert.throws(()=>validateExtraction({documents:[{id:'one',normalized:record('manifest',{allocations:null})}]},[{id:'one',text:'test source'}]),/INVALID_MANIFEST/);
  const fixture=createFixtureSuite().cases[0];
  const client={events:[],async json(){return {type:'tool',tool:'release_reserve',reason:'Untrusted document tried to authorize a release.'};}};
  const trial=await runCase(fixture,createLlmController('adaptive_llm',client,{view:'normalized'}));
  assert.equal(trial.stopReason,'TOOL_DENIED');assert.equal(trial.grade.unauthorizedAction,true);
});

test('both policies share a failed reader extraction without giving the adaptive arm a fresh attempt',async()=>{
  const fixture=createFixtureSuite().cases.find(c=>c.family==='clean_complete');
  const client={events:[],async json(system,payload,options){this.events.push({...options,reservationId:'fake-'+this.events.length,status:'settled',inputTokens:100,outputTokens:20,modelCostMicros:55});return {documents:payload.documents.map((d,i)=>({id:i?'fabricated':d.id,normalized:record('unknown',{},d.text)}))};}};
  const cache=new Map();
  const fixed=await runCase(fixture,createLlmController('fixed_llm_reader',client,{semanticCache:cache}),{view:'raw'});
  const adaptive=await runCase(fixture,createLlmController('adaptive_llm',client,{semanticCache:cache}),{view:'raw'});
  assert.equal(client.events.length,1);assert.equal(fixed.controllerError,'INVALID_READER_CLAIM');assert.equal(adaptive.controllerError,fixed.controllerError);
  assert.equal(fixed.cost.modelCostMicros,adaptive.cost.modelCostMicros);assert.equal(adaptive.metrics.actualProviderCalls,0);
});

test('expired prices and pre-aborted requests cannot spend',async()=>temporary(async path=>{
  const ledger=await openSpendLedger(path,{initialize:true});
  try{
    const client=createVertexClient({token:'test',ledger,now:()=>new Date('2027-01-01'),fetchFn:()=>{throw new Error('must not execute');}});
    await assert.rejects(()=>client.json('test',{},{}),/REVERIFY_MODEL_PRICE/);assert.equal(ledger.snapshot().entries.length,0);
    const live=createVertexClient({token:'test',ledger,fetchFn:()=>{throw new Error('must not execute');}});
    await assert.rejects(()=>live.json('test',{},{signal:AbortSignal.abort()}),/MODEL_ABORTED/);assert.equal(ledger.snapshot().entries.length,0);
  }finally{await ledger.close();}
}));

test('model upgrade retains historical spend and settles new requests at their reserved price',async()=>temporary(async path=>{
  await writeFile(path,JSON.stringify({version:1,projectId:PROJECT_ID,lifetimeCapMicros:8_000_000,circuit:null,entries:[{id:'historical',runId:'old',status:'settled',reservedMicros:30000,chargedMicros:415}]}));
  const ledger=await openSpendLedger(path);
  try{const id=await ledger.reserve({});await ledger.settle(id,{inputTokens:1000,outputTokens:100,thinkingTokens:10});assert.equal(ledger.snapshot().lifetimeChargedMicros,3735);assert.equal(ledger.snapshot().entries[0].chargedMicros,415);}
  finally{await ledger.close();}
}));

test('definitive HTTP429 is recorded without token charges and is never automatically retried',async()=>temporary(async path=>{
  const ledger=await openSpendLedger(path,{initialize:true});let calls=0;
  try{
    const client=createVertexClient({token:'test',ledger,fetchFn:async()=>{calls++;return {ok:false,status:429,json:async()=>({error:{status:'RESOURCE_EXHAUSTED',message:'capacity'}})};}});
    await assert.rejects(()=>client.json('test',{},{}),/VERTEX_HTTP_429/);assert.equal(calls,1);assert.equal(ledger.snapshot().runChargedMicros,0);assert.equal(ledger.snapshot().entries[0].httpStatus,429);assert.equal(client.events[0].status,'rejected');
  }finally{await ledger.close();}
}));

test('grounded reader preserves allocations, partial stale records and explicit cancellation without inventing zero',()=>{
  const old='2026-01-01T00:00:00Z',current='2026-01-03T00:00:00Z';
  const docs=[
    {id:'manifest',text:'Batch Z: 11 for PO-X; 6 for another order.',actor:'warehouse',asOf:current},
    {id:'old',text:'An old shipment-status snapshot is attached; quantity is not recorded.',actor:'carrier',asOf:old},
    {id:'cancel',text:'Shipment cancelled. No units delivered for PO-X.',actor:'carrier',asOf:current}
  ];
  const output={documents:[
    {id:'manifest',normalized:record('manifest',{batchId:'Z',allocations:[{orderId:'PO-X',units:11,quote:'11 for PO-X'},{orderId:null,units:6,quote:'6 for another order'}]},docs[0].text)},
    {id:'old',normalized:record('order_delivery',{orderId:'PO-X'},docs[1].text)},
    {id:'cancel',normalized:record('order_delivery',{orderId:'PO-X',units:0,status:'CANCELLED'},docs[2].text)}
  ]};
  const parsed=validateExtraction(output,docs);
  assert.deepEqual(parsed.get('manifest').allocations,[{orderId:'PO-X',units:11},{orderId:null,units:6}]);
  assert.equal(parsed.get('old').kind,'order_delivery');assert.equal(parsed.get('old').units,undefined);
  const observation={case:{order:{id:'PO-X',createdAt:'2026-01-02T00:00:00Z'},asOf:current,questions:['delivered_units']},evidence:docs.map(d=>({...d,normalized:parsed.get(d.id)})),history:[]};
  const a=analyzeEvidence(observation);assert.equal(a.answers.delivered_units.value,0);assert.deepEqual(a.findings,['STALE_EVIDENCE','REPLACEMENT_CANCELLED']);
  observation.evidence=observation.evidence.filter(d=>d.id!=='cancel');assert.deepEqual(analyzeEvidence(observation).missing,['delivered_units']);
  const invented=structuredClone(output);invented.documents[0].normalized.allocations[0].quote='99 kits confirmed';assert.throws(()=>validateExtraction(invented,docs),/INVALID_MANIFEST/);
});

test('unknown refund/year/quantity stay unresolved; same legal entity is not falsely labelled a mismatch',()=>{
  const observation={case:{order:{id:'P',merchantId:'M',createdAt:'2026-01-01'},asOf:'2026-01-03',questions:['delivered_units','refund_status','business_years']},history:[],evidence:[
    {id:'d',actor:'carrier',asOf:'2026-01-02',normalized:{kind:'order_delivery',orderId:'P'}},
    {id:'r',actor:'payments',asOf:'2026-01-02',normalized:{kind:'refund',orderId:'P'}},
    {id:'b',actor:'registry',asOf:'2026-01-02',normalized:{kind:'business_history',entityId:'M'}}
  ]};
  const a=analyzeEvidence(observation);assert.deepEqual(a.answers,{});assert.deepEqual(a.missing,observation.case.questions);assert.ok(!a.findings.includes('ENTITY_MISMATCH'));
});
