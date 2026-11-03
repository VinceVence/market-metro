import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgentMesh,meshEconomics} from '../scripts/agent-mesh/integration.mjs';
import {createMarketStore} from '../scripts/market-store.mjs';
import {createMarketService} from '../scripts/market-service.mjs';
import {SAMPLE_PRODUCTS} from '../demo/market/engine.mjs';
import {authorizePilot} from '../scripts/agent-mesh/harness.mjs';

const settings={requestId:'mesh-integration-test',seed:314,customerCount:100,days:100,dayMs:1500,budgetCents:30000,scenario:'rival_sale',nativeSample:false,mode:'gemini'};
function fixture(t,{blockFirst=false}={}){
  const store=createMarketStore(),paypal={status:()=>({configured:false}),profileKey:()=> 'FIXTURE',list:()=>[]},catalog={products:()=>structuredClone(SAMPLE_PRODUCTS),status:()=>({mode:'SAMPLE'})};
  const market=createMarketService({store,paypal,catalog}),requests=[];let release,enter,blocked=blockFirst,opens=0,closes=0;
  const entered=new Promise(r=>enter=r),client={events:[],async json(system,p,{functions}){
    const name=functions[0].name;requests.push({name,packet:structuredClone(p),openCount:opens,closeCount:closes});
    assert.ok(!/privateTraits|weeklyIncome|merchantAffinity|privateEconomics/.test(JSON.stringify(p)));
    if(blocked){blocked=false;enter();await new Promise(r=>release=r);}
    this.events.push({status:'settled',modelCostMicros:1000,modelVersion:'EXPLICIT_LOCAL_TEST_FIXTURE'});
    const common={rationale:'Explicit local test response grounded in the provided evidence.',evidenceIds:p.evidenceIds||[p.evidenceId]};
    if(name==='close_experiment')return {name,args:{...common,decision:'collect_more_evidence'}};
    common.asOfDay=p.asOfDay;
    if(name==='investigate_market')return {name,args:{...common,cut:'returns',hypothesis:'Check mature returns before subsidizing more purchases.'}};
    if(name==='propose_policy')return {name,args:{...common,strategy:'recommendations',audience:'all',merchantIndices:[0,2],maxOfferPct:0,windowDays:42,epsilon:0,retrain:true}};
    assert.equal(Object.hasOwn(p.proposal,'rationale'),false);
    return {name,args:{...common,decision:'narrow',merchantIndices:[0],maxOfferPct:0,epsilon:0}};
  }};
  const mesh=createAgentMesh({store,market,autoTimers:false,clientFactory:async()=>{opens++;return {client,close:async()=>{closes++;}};}});
  t.after(async()=>{await mesh.close();store.close();});return {store,market,mesh,requests,client,entered,release:()=>release()};
}

test('mesh economics charges inference once and cannot promote a raw-fee gain smaller than its cost',()=>{
  const branches=[['mesh',10001],['rules',10000],['organic',10000]].map(([branch,platformProxyCents])=>({branch,platformProxyCents,matureObservations:10,decisions:10}));
  const e=meshEconomics({clock:'COMPLETE',branches,modelCostMicros:20000});assert.equal(e.agentExceedsBothControls,false);assert.equal(e.rows[0].platformAfterInferenceUSD,99.99);assert.equal(e.rows[0].inferenceUSD,.02);
  assert.equal(meshEconomics({clock:'RUNNING',branches,modelCostMicros:0}).complete,false);assert.equal(branches[0].platformProxyCents,10001);
});

test('team model route is explicit, immutable for an existing run and visible per role',async t=>{
  const f=fixture(t),s=f.mesh.start({...settings,requestId:'hybrid-routing-test',teamModel:'hybrid'});
  assert.equal(s.mesh.modelRoute,'hybrid');assert.equal(s.mesh.roles[0].model,'gemini-3.1-flash-lite');assert.equal(s.mesh.roles[1].model,'gemini-3.1-pro-preview-customtools');
  assert.throws(()=>f.mesh.start({...settings,requestId:'hybrid-routing-test',teamModel:'lite'}),/saved model route/);
  assert.throws(()=>f.mesh.start({...settings,requestId:'hybrid-invalid-test',teamModel:'unlimited'}),/bounded hybrid/);
});

test('three roles produce checked handoffs and share warehouse lineage with rules and no campaign',async t=>{
  const f=fixture(t),id=f.mesh.start(settings).runId;assert.throws(()=>f.mesh.control(id,{action:'conclude'}),/outcome tail/);
  f.mesh.control(id,{action:'resume'});for(let day=1;day<=114;day++){f.mesh.tick(id,{triggerReview:false});if([30,55,80].includes(day))await f.mesh.review(id);}
  const s=f.mesh.snapshot(id);assert.equal(s.modelCalls,9);assert.equal(s.mesh.handoffs.length,3);assert.ok(s.mesh.handoffs.every(h=>h.reviewer.decision==='narrow'&&h.execution.policy.merchantIndices.length===1));
  assert.equal(s.mesh.version,'campaign-harness-v3');
  for(const row of s.checkpoints.filter(c=>c.actor==='GEMINI_3_1_FLASH_LITE')){assert.ok(row.input.system.includes('Additional evidence contract'));assert.ok(row.output.evidenceIds.includes(row.input.packet.checkedFacts.evidenceId));assert.ok(row.input.functions[0].parameters.properties.evidenceIds.items.enum.includes(row.input.packet.checkedFacts.evidenceId));}
  assert.equal(s.checkpoints.filter(c=>c.role==='Verified evidence worker').length,9);
  assert.equal(s.mesh.economics.complete,true);assert.equal(s.mesh.economics.rows[0].inferenceUSD,.009);assert.equal(s.receipts.length,0);assert.ok(s.mesh.catalog.length>0);
  assert.ok(s.branches.every(b=>b.matureObservations===b.decisions));assert.equal(f.store.db.prepare('PRAGMA foreign_key_check').all().length,0);
  await f.mesh.conclude(id);assert.equal(f.mesh.snapshot(id).mesh.audits.length,1);assert.equal(f.mesh.snapshot(id).modelCalls,10);
});

test('shopping continues while the team reasons; final review waits for the existing provider session',async t=>{
  const f=fixture(t,{blockFirst:true}),id=f.mesh.start({...settings,requestId:'mesh-pending-close'}).runId;f.mesh.control(id,{action:'resume'});
  for(let d=0;d<30;d++)f.mesh.tick(id,{triggerReview:false});const review=f.mesh.review(id);await f.entered;
  const before=f.store.table('orders',id).count;for(let d=30;d<114;d++)f.mesh.tick(id,{triggerReview:false});assert.ok(f.store.table('orders',id).count>before);
  f.mesh.control(id,{action:'conclude'});assert.equal(f.requests.filter(r=>r.name==='close_experiment').length,0);
  f.release();await review;await f.mesh.wait(id);
  const final=f.requests.find(r=>r.name==='close_experiment');assert.ok(final);assert.ok(final.closeCount>=1);assert.equal(final.openCount,2);
  assert.ok(f.requests.filter(r=>r.name!=='close_experiment').every(r=>r.packet.asOfDay===30));assert.equal(f.mesh.snapshot(id).receipts.length,0);
});

test('unsupported promotion response is retained and blocked by the after-cost review',async t=>{
  const f=fixture(t),id=f.mesh.start({...settings,requestId:'mesh-net-guard'}).runId;f.mesh.control(id,{action:'resume'});for(let d=0;d<114;d++)f.mesh.tick(id,{triggerReview:false});
  const original=f.client.json.bind(f.client);f.client.json=async(...args)=>{const r=await original(...args);if(r.name==='close_experiment')r.args.decision='retain_agent_policy';return r;};
  await assert.rejects(()=>f.mesh.conclude(id),/after inference costs/);
  const s=f.mesh.snapshot(id);assert.equal(s.mesh.audits.length,1);assert.equal(s.mesh.audits[0].response.args.decision,'retain_agent_policy');assert.equal(s.mesh.audits[0].verdict.accepted,false);assert.equal(s.receipts.length,0);
});

test('planner receives preflight feedback, revises once, and its capped pilot expires while shopping continues',async t=>{
  const f=fixture(t),id=f.mesh.start({...settings,requestId:'mesh-harness-correction'}).runId;
  const original=f.client.json.bind(f.client);let proposalCalls=0;
  f.client.json=async(...args)=>{
    const r=await original(...args),packet=args[1];
    if(r.name==='propose_policy'&&++proposalCalls===1)Object.assign(r.args,{strategy:'mixed',audience:'lapsed',merchantIndices:[0,1,2],maxOfferPct:10});
    else if(r.name==='propose_policy')assert.ok(packet.harnessFeedback.gate.issues.length);
    return r;
  };
  f.mesh.control(id,{action:'resume'});for(let d=0;d<30;d++)f.mesh.tick(id,{triggerReview:false});
  await f.mesh.review(id);const s=f.mesh.snapshot(id);
  assert.equal(proposalCalls,2);assert.equal(s.modelCalls,4);assert.equal(s.lastError,null);
  const blocked=s.mesh.harness.checkpoints.find(c=>c.output.status==='REVISE');assert.ok(blocked.output.rawAgentResponse);
  const authorization=s.mesh.harness.checkpoints.find(c=>c.output.status==='PILOT_AUTHORIZED').output;
  // A crash after a later authorization but before its publication must not
  // hide the active pilot's expiry checkpoint.
  authorizePilot(f.store,id,id+'-REVIEW-99-REVIEW',{...f.store.state(id).policyLab.plan,strategy:'observe'},{status:'OBSERVE'});
  const spent=f.store.state(id).live.discountCents+f.store.state(id).live.spendCents;
  for(let d=30;d<45;d++)f.mesh.tick(id,{triggerReview:false});
  const after=f.mesh.snapshot(id),w=f.store.state(id);
  assert.equal(w.policyLab.plan.strategy,'observe');assert.ok(after.mesh.harness.checkpoints.some(c=>c.output.status==='PILOT_EXPIRED'));
  assert.ok(w.live.discountCents+w.live.spendCents-spent<=500);
  assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM policy_lab_actions WHERE run_id=? AND day>=? AND selected_action<>'none'").get(id,authorization.expiresDay).n,0);
  assert.ok(f.store.db.prepare('SELECT COUNT(*) n FROM policy_lab_actions WHERE run_id=? AND day>=? AND order_id IS NOT NULL').get(id,authorization.expiresDay).n>0);
  assert.equal(after.receipts.length,0);
});
