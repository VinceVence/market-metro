import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {frozenInputs,observedWorld,createSnapshot,boundedQuery,compileFeature,fitCandidate,FIELDS} from '../scripts/research-lab/data.mjs';
import {createWorkspace,runFixedWorkflow,validateCampaign,LIMITS} from '../scripts/research-lab/workspace.mjs';
const contract={budgetCents:3000,maxCouponPct:0,maxDurationDays:7,audience:'all',allowedMerchantIndices:[0,1,2]};
async function setup(t){const dir=await mkdtemp(resolve(tmpdir(),'research-lab-'));t.after(()=>rm(dir,{recursive:true,force:true}));const {catalog}=await frozenInputs();return {dir,catalog,runner:observedWorld({id:'TEST',seed:314,scenario:'rival_sale',catalog})};}
test('read-only analyst SQL returns real observed aggregates and rejects writes, attachments and allocation functions',async t=>{
  const f=await setup(t),path=resolve(f.dir,'snapshot.sqlite');createSnapshot(path,f.runner);
  const result=await boundedQuery(path,'SELECT COUNT(*) AS n, MAX(day) AS last_day FROM observations');assert.equal(result.rows[0].n,4500);assert.equal(result.rows[0].last_day,44);
  for(const sql of ["DELETE FROM orders","SELECT * FROM orders; ATTACH DATABASE '/tmp/other' AS o","SELECT load_extension('bad')","SELECT randomblob(1000000000)","SELECT writefile('/tmp/should-not-exist','data')"]){await assert.rejects(()=>boundedQuery(path,sql));}
  const mature=await boundedQuery(path,'SELECT MAX(day) AS last_day FROM observations WHERE reward_cents IS NOT NULL');assert.equal(mature.rows[0].last_day,31);
  const schema=await boundedQuery(path,"SELECT name FROM sqlite_master WHERE type='table'");assert(!/private|traits|evaluation|future/.test(JSON.stringify(schema)));
});
test('generated linear features compile exactly; unsafe, nonlinear and target-dependent programs are rejected',async t=>{
  const f=await setup(t);assert.deepEqual(compileFeature('(recency_30d - purchases_7d) / 2'),[0,.5,-.5,0,0,0,0]);
  for(const bad of ['reward_cents','purchases_7d * price_scale','1 / 0','process.exit()','Math.random()','1000 * price_scale'])assert.throws(()=>compileFeature(bad));
  const m=fitCandidate(f.runner.actions,{family:'ridge',features:['recency_30d - purchases_7d','price_scale','offers_7d + recent_refunds'],windowDays:42,cutoffDay:45});
  const full=fitCandidate(f.runner.actions,{family:'ridge',features:FIELDS,windowDays:42,cutoffDay:45});assert.equal(full.summary.features.length,6);
  for(const a of f.runner.actions.slice(0,100)){const x=JSON.parse(a.context_json),phi=m.vectors.map(v=>v.reduce((s,k,i)=>s+k*x[i],0)),raw=m.rawArtifact.arms[a.selected_action].coef.reduce((s,c,i)=>s+c*phi[i],0),compiled=m.artifact.arms[a.selected_action].coef.reduce((s,c,i)=>s+c*x[i],0);assert(Math.abs(raw-compiled)<1e-9);}
  assert(m.summary.validationRows>0);assert(m.artifact.arms.none.coef.length===FIELDS.length);
});
test('research pipeline fitting cannot learn from future or immature rewards',async t=>{
  const f=await setup(t),spec={family:'ridge',features:['recency_30d','price_scale'],windowDays:42,cutoffDay:45};
  const clean=fitCandidate(f.runner.actions,spec),poison=fitCandidate([...f.runner.actions,{day:99,matures_day:0,selected_action:'none',context_json:'[1,0,0,0,0,0,0]',reward_cents:999999},{day:30,matures_day:999,selected_action:'none',context_json:'[1,0,0,0,0,0,0]',reward_cents:999999}],spec);
  assert.deepEqual(clean.artifact.arms,poison.artifact.arms);
});
test('fixed and automated-search workflows use actual query/model/pilot tools, preserve budgets and resume without duplicate effects',async t=>{
  const f=await setup(t),task={seed:314,scenario:'rival_sale',brief:'Test observed data.'};
  for(const search of [false,true]){
    const id=search?'AUTO':'FIXED',dir=resolve(f.dir,id),w=await createWorkspace({directory:dir,id,task,catalog:f.catalog,contract});
    await runFixedWorkflow(w,{search});assert(w.state.completed);assert.equal(w.state.models.length,search?4:1);assert.equal(w.state.pilots.length,2);assert(w.state.pilots.every(p=>p.replicas.length===3&&p.validity));
    const q=w.state.journal.find(j=>j.action==='query_warehouse'),size=w.state.journal.length;assert.deepEqual(await w.execute(q.action,q.parameters,q.id),q.output);assert.equal(w.state.journal.length,size);await assert.rejects(()=>w.execute(q.action,{...q.parameters,sql:'SELECT 1'},q.id),/CONFLICT/);
    const resumed=await createWorkspace({directory:dir,id,task,catalog:f.catalog,contract});assert(resumed.state.completed);assert.deepEqual(resumed.state.commit,w.state.commit);
    const packet=JSON.stringify(w.packet());assert(!/privateTraits|weeklyIncome|merchantAffinity|62001|52001/.test(packet));
  }
});
test('campaign authority is fixed outside the model and unknown evidence cannot authorize effects',async t=>{
  const f=await setup(t),task={seed:314,scenario:'steady',brief:'Test'},w=await createWorkspace({directory:f.dir,id:'AUTH',task,catalog:f.catalog,contract});
  const plan={title:'Test campaign',audience:'all',merchantIndices:[0],maxOfferPct:0,durationDays:3,penaltyUSD:.3};assert(validateCampaign(plan,contract));
  for(const bad of [{...plan,maxOfferPct:5},{...plan,merchantIndices:[3]},{...plan,durationDays:30},{...plan,capturePayment:true},{...plan,penaltyUSD:Infinity}])assert.throws(()=>validateCampaign(bad,contract));
  await assert.rejects(()=>w.execute('query_warehouse',{sql:'SELECT 1',rationale:'Need evidence.',evidenceIds:['another-workspace']},'BAD'));
  assert.equal(w.state.journal.length,0);assert.equal(LIMITS.pilots,2);
});
