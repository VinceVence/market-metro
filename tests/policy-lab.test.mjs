import test from 'node:test';
import assert from 'node:assert/strict';
import {createMarketStore} from '../scripts/market-store.mjs';
import {createMarketService} from '../scripts/market-service.mjs';
import {createPolicyLab,rulesPlan,validatePolicyDecision} from '../scripts/policy-lab/service.mjs';
import {createPolicyWorld,advancePolicyDay,merchantTerms} from '../scripts/policy-lab/economy.mjs';
import {trainBandit,chooseBandit} from '../scripts/policy-lab/learner.mjs';
import {SAMPLE_PRODUCTS} from '../demo/market/engine.mjs';

function fixture(t,overrides={}){
  const store=createMarketStore(),paypal={status:()=>({configured:false}),profileKey:()=> 'FIXTURE',list:()=>[]},catalog={products:()=>structuredClone(SAMPLE_PRODUCTS),status:()=>({mode:'SAMPLE'})};
  const market=createMarketService({store,paypal,catalog}),requests=[];
  const client={events:[],async json(system,p,{functions}){
    requests.push({system,packet:p});assert(!/privateTraits|weeklyIncome|merchantAffinity|privateEconomics/.test(JSON.stringify(p)));
    this.events.push({status:'settled',modelCostMicros:100,modelVersion:'EXPLICIT_TEST_FIXTURE'});
    let d;if(functions[0].name==='close_experiment')d={decision:'collect_more_evidence'};
    else if(functions[0].name==='investigate_market')d={cut:'merchant_switching',hypothesis:'Investigate observed substitution before offering a discount.'};
    else if(functions[0].name==='propose_policy')d=rulesPlan(p);
    else d={decision:'approve',merchantIndices:p.proposal.merchantIndices,maxOfferPct:p.proposal.maxOfferPct,epsilon:p.proposal.epsilon};
    return {name:functions[0].name,args:{...d,...(p.asOfDay===undefined?{}:{asOfDay:p.asOfDay}),rationale:'Explicit test fixture based on the supplied observations.',evidenceIds:p.evidenceIds||[p.evidenceId]}};
  }};
  const lab=createPolicyLab({store,market,autoTimers:false,clientFactory:async()=>({client,close:async()=>{}}),...overrides});
  t.after(async()=>{await lab.close();store.close();});return {store,market,lab,requests,client};
}
const settings={requestId:'policy-lab-test-314',seed:314,customerCount:100,days:100,dayMs:1500,budgetCents:30000,scenario:'rival_sale',nativeSample:false};

test('paired policy worlds complete with real local fits, mature outcomes, conserved budgets and warehouse lineage',async t=>{
  const f=fixture(t),id=f.lab.start(settings).runId;assert.equal(f.lab.start(settings).runId,id);
  assert.throws(()=>f.lab.start({...settings,budgetCents:999}),/different settings/);
  f.lab.control(id,{action:'resume'});
  for(let day=1;day<=114;day++){
    f.lab.tick(id,{triggerReview:false});
    if(day===30){const branches=f.lab.snapshot(id).branches;assert.deepEqual(branches.map(b=>b.purchases),[0,0,0]);const w=f.store.state(id),b=f.store.state(id+'-RULES');assert.equal(w.stats.revenueCents,b.stats.revenueCents);assert.equal(w.stats.orders,b.stats.orders);}
    if([30,55,80].includes(day))await f.lab.review(id);
  }
  const s=f.lab.snapshot(id);assert.equal(s.day,114);assert.equal(s.clock,'COMPLETE');assert.equal(s.modelCalls,9);assert.equal(s.models.length,3);assert.equal(s.teamStatus,'IDLE');assert.equal(s.lastError,null);
  assert(s.branches.every(b=>b.decisions===7000&&b.matureObservations===7000));assert(s.branches.every(b=>b.jointBudgetSpentCents<=settings.budgetCents));
  assert.equal(s.branches[2].offers,0);assert.equal(s.branches[2].recommendations,0);
  assert.equal(f.store.db.prepare('PRAGMA foreign_key_check').all().length,0);
  assert(f.store.table('v_policy_customer_journey',id).rows.some(r=>r.order_id));
  for(const m of s.models){const n=f.store.db.prepare('SELECT COUNT(*) n FROM policy_lab_actions WHERE run_id=? AND day<? AND matures_day<=? AND day>=?').get(id,m.cutoff_day,m.cutoff_day,m.cutoff_day-42).n;assert.equal(m.training_rows,n);assert(m.validation_rows>0);}
  assert.equal(f.market.frame(id).policyLab.branch,'mesh');await assert.rejects(()=>f.market.advance(id),/Policy Lab/);
  assert.equal(f.lab.trace(id,s.people[0].customer_id).events.length,100);
  const count=f.store.table('orders',id).count;f.lab.tick(id);await f.lab.review(id);assert.equal(f.store.table('orders',id).count,count);
  const original=f.client.json.bind(f.client);let badCitation=true;f.client.json=async(...args)=>{const output=await original(...args);if(output.name==='close_experiment'&&badCitation){badCitation=false;output.args.evidenceIds=['WRONG'];}return output;};
  await assert.rejects(()=>f.lab.conclude(id),/grounded/);const conclusion=await f.lab.conclude(id);assert.equal(conclusion.executedPayment,false);assert.equal(conclusion.executedNewCampaign,false);assert.deepEqual(await f.lab.conclude(id),conclusion);assert.equal(f.lab.snapshot(id).modelCalls,11);
});

test('shopping advances during LLM reasoning and proposals never leak future or other-world data',async t=>{
  let release,entered;const started=new Promise(r=>entered=r);let block=true;
  const f=fixture(t);const original=f.client.json.bind(f.client);f.client.json=async(...args)=>{if(block){block=false;entered();await new Promise(r=>release=r);}return original(...args);};
  const id=f.lab.start({...settings,requestId:'policy-async-check'}).runId;f.lab.control(id,{action:'resume'});for(let i=0;i<30;i++)f.lab.tick(id,{triggerReview:false});
  const job=f.lab.review(id);await started;const before=f.store.table('orders',id).count;for(let i=0;i<3;i++)f.lab.tick(id,{triggerReview:false});assert(f.store.table('orders',id).count>before);release();await job;
  assert.equal(f.lab.snapshot(id).day,33);assert(f.requests.every(r=>r.packet.asOfDay===30));assert.equal(f.lab.snapshot(id).plan.effectiveDay,33);
  assert(!f.requests.some(r=>JSON.stringify(r.packet).includes(id+'-ORGANIC')));
});

test('failed inference retains a checkpoint, stops the team and does not stop or script the market',async t=>{
  const f=fixture(t,{clientFactory:async()=>{throw Error('TEST_CLOUD_FAILURE');}}),id=f.lab.start({...settings,requestId:'policy-failure-check'}).runId;
  f.lab.control(id,{action:'resume'});for(let i=0;i<30;i++)f.lab.tick(id,{triggerReview:false});await f.lab.review(id);const s=f.lab.snapshot(id);assert.equal(s.teamStatus,'ERROR');assert.equal(s.plan,null);assert(s.checkpoints.some(c=>c.status==='FAILED'));f.lab.tick(id);assert.equal(f.lab.snapshot(id).day,31);assert.equal(f.lab.snapshot(id).modelCalls,0);
});

test('one typed correction preserves a rejected model output and stays inside the same trial ledger',async t=>{
  const f=fixture(t),original=f.client.json.bind(f.client);let invalid=true;
  f.client.json=async(...args)=>{const value=await original(...args);if(value.name==='propose_policy'&&invalid){invalid=false;value.args.windowDays=30;}return value;};
  const id=f.lab.start({...settings,requestId:'policy-correction-case'}).runId;f.lab.control(id,{action:'resume'});for(let i=0;i<30;i++)f.lab.tick(id,{triggerReview:false});await f.lab.review(id);
  const s=f.lab.snapshot(id);assert.equal(s.teamStatus,'IDLE');assert.equal(s.modelCalls,4);assert.equal(s.checkpoints.find(c=>c.status==='FAILED').output.rawDecision.windowDays,30);assert(s.checkpoints.some(c=>c.checkpoint_id.endsWith('-CORRECTION')&&c.status==='COMPLETED'));assert(s.plan);
});

test('reward fitting excludes immature/future records and learns action-dependent coefficients',()=>{
  const rows=Array.from({length:200},(_,i)=>({day:Math.floor(i/10),matures_day:Math.floor(i/10)+14,selected_action:i%2?'offer':'none',context_json:JSON.stringify([1,i%5/5,0,0,0,0,0]),reward_cents:i%2?100:-20}));
  const opts={cutoffDay:30,windowDays:42,actions:['none','offer']},model=trainBandit(rows,opts);assert.equal(model.trainingRows,170);
  const contaminated=[...rows,{day:50,matures_day:0,selected_action:'offer',context_json:'[]',reward_cents:999999},{day:1,matures_day:999,selected_action:'offer',context_json:'[]',reward_cents:999999}];
  assert.deepEqual(trainBandit(contaminated,opts).arms,model.arms);assert(model.arms.offer.coef[0]>.9);
  const decision=chooseBandit(model,[{id:'none',features:[1,0,0,0,0,0,0]},{id:'offer',features:[1,0,0,0,0,0,0]}],{epsilon:.1,draw:[.9,.1]});assert.equal(decision.id,'offer');assert(Math.abs(decision.propensity-.95)<1e-12);
});

test('merchant restrictions are finite and control decisions cannot expand a proposal',()=>{
  const w=createPolicyWorld({runId:'test-world',comparisonId:'test-world',branch:'mesh',settings:{...settings,mode:'gemini'},catalog:SAMPLE_PRODUCTS,startedAt:'2026-10-24T01:00:00Z'});
  assert(merchantTerms(w).every(t=>[0,5,10].includes(t.maxOfferPct)));const copy=structuredClone(w);assert.deepEqual(advancePolicyDay(w),advancePolicyDay(copy));
  const packet={asOfDay:30,evidenceIds:['observed'],proposal:{merchantIndices:[1],maxOfferPct:5,epsilon:.1}};
  const base={decision:'narrow',merchantIndices:[1],maxOfferPct:5,epsilon:.1,asOfDay:30,rationale:'Keep the supplied constraints.',evidenceIds:['observed']};
  assert.throws(()=>validatePolicyDecision('Outcome reviewer',{...base,maxOfferPct:10},packet),/never expand/);
  assert.throws(()=>validatePolicyDecision('Outcome reviewer',{...base,evidenceIds:['future']},packet),/exact snapshot/);
});

test('cached Channel3 price range supports the two desk kits and89-dollar bundle without fabricated products',()=>{
  const catalog=[3199,3199,17999,8900].map((priceCents,i)=>({...SAMPLE_PRODUCTS[i],priceCents,channel3Id:'fixture-'+i,source:'CHANNEL3_API'}));
  const w=createPolicyWorld({runId:'CATALOG',comparisonId:'CATALOG',branch:'mesh',settings:{...settings,mode:'gemini'},catalog,startedAt:'2026-10-24T01:00:00Z'});
  assert.equal(w.products.length,9);assert.deepEqual(w.products.slice(0,3).map(p=>p.price_cents),[3199,3199,8900]);assert(w.products.every(p=>p.source==='CHANNEL3_API'));
});
