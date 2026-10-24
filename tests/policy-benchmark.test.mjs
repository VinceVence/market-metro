import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pairedEstimate,compareBranches,benchmarkGates,recoveryMetric} from '../scripts/policy-lab/benchmark-stats.mjs';
import {evaluateCase,assertFrozen} from '../scripts/policy-lab/benchmark.mjs';
import {contractChecks} from '../scripts/policy-lab/benchmark-audit.mjs';
import {validityChecks} from '../scripts/policy-lab/benchmark-validity.mjs';
import {createSupplyYardServer} from '../scripts/serve.mjs';
const read=name=>JSON.parse(readFileSync(resolve(import.meta.dirname,'../docs/policy-lab/benchmarks/v1',name),'utf8'));

test('paired bootstrap clusters scenarios within seed and never treats shopper rows as samples',()=>{
  const rows=[{seed:1,value:0},{seed:1,value:10},{seed:2,value:15},{seed:2,value:25}];
  const a=pairedEstimate(rows,'value');assert.equal(a.mean,12.5);assert.equal(a.seeds,2);assert.equal(a.cases,4);assert(a.low<=a.mean&&a.high>=a.mean);
  assert.deepEqual(pairedEstimate(rows,'value'),a);assert.equal(pairedEstimate([rows[0]],'value').low,null);
  assert.throws(()=>pairedEstimate([{seed:1,value:NaN}],'value'),/NONFINITE/);
});
test('economic delta deducts model allocation exactly once and no-campaign remains zero',()=>{
  const b=(policy,value,cost)=>({policy,platformProxyCents:value,merchantContributionCents:value,retainedCents:value,reactivatedCustomers:1,allocatedModelUSD:cost,daily:[{day:31,platformProxyCents:value,allocatedModelUSD:cost}]});
  const rows=compareBranches([b('organic',10000,0),b('rules_matched',11000,0),b('recorded_v1',12000,.25)]);
  assert.equal(rows[0].deltaPlatformUSD,0);assert.equal(rows[2].deltaPlatformUSD,19.75);assert.equal(rows[2].deltaVsRulesUSD,9.75);assert.equal(rows[2].daily[0].deltaPlatformUSD,19.75);
  assert.throws(()=>compareBranches([b('organic',1,0)]),/MISSING/);
});
test('promotion gates do not equate positive mean or guard validity with economic or multi-agent success',()=>{
  const e={mean:10,low:-1,high:21,worst:-55};
  const gates=benchmarkGates({deltaPlatformUSD:e,deltaVsRulesUSD:e,deltaMerchantUSD:e},{minimumGainUSD:0,maxMerchantLossUSD:0,maxWorstCaseLossUSD:50},true);
  assert.equal(gates.find(g=>g.id==='economic').status,'NOT_DEMONSTRATED');assert.equal(gates.find(g=>g.id==='tail').status,'FAIL');assert.equal(gates.find(g=>g.id==='mesh').status,'NOT_TESTED');
  assert.throws(()=>assertFrozen({sim:'old'},{sim:'new'}),/FROZEN/);
});
test('new measurement adapter reproduces recorded monetary results without calls and preserves control accounting',()=>{
  const protocol=read('protocol.json'),inputs=read('inputs.json'),rows=evaluateCase(314,'rival_sale',protocol,inputs);
  for(const [policy,branch]of [['recorded_v1','mesh'],['rules_fast','rules'],['organic','organic']]){
    const actual=rows.find(r=>r.policy===policy),original=inputs.originalBranches.find(r=>r.branch===branch);
    for(const key of ['purchases','platformProxyCents','retainedCents','merchantContributionCents','jointBudgetSpentCents'])assert.equal(actual[key],original[key],policy+' '+key);
  }
  for(const r of rows){assert(Object.values(r.checks).every(x=>x===0));assert.equal(r.modelCalls,0);assert.equal(r.paymentCalls,0);assert.equal(r.matureOutcomes,7000);}
  const zero=evaluateCase(314,'rival_sale',{...protocol,settings:{...protocol.settings,budgetCents:0}},inputs);
  assert(zero.every(r=>r.offers===0&&r.recommendations===0&&r.jointBudgetSpentCents===0));
});
test('controlled simulator probes and adversarial authority contracts exercise actual runtime guards',()=>{
  const inputs=read('inputs.json');const probes=validityChecks(read('protocol.json'),inputs.catalog,inputs.schedule);
  assert(probes.every(p=>p.passed),JSON.stringify(probes));assert(contractChecks().every(c=>c.passed));
});
test('recovery requires sustained nonnegative rolling increments; missing recovery is censored',()=>{
  let n=0;const recovered=Array.from({length:70},(_,i)=>({day:31+i,deltaPlatformUSD:n+=i<12?-1:2}));
  const r=recoveryMetric(recovered);assert.equal(r.status,'RECOVERED');assert(r.confirmedRecoveryDay>50);
  assert.equal(recoveryMetric(recovered.map((d,i)=>({...d,deltaPlatformUSD:-i}))).status,'CENSORED');
});

test('benchmark artifacts are readable locally with correct types and cannot escape their public directory',async()=>{
  const server=createSupplyYardServer({status:()=>({configured:false})});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
  try{
    const index=await fetch(base+'/benchmarks/v1/index.json');assert.equal(index.status,200);assert.match(index.headers.get('content-type'),/application\/json/);
    const value=await index.json();assert.equal(value.worlds,400);assert.equal(value.costs.newPaidAPICostUSD,0);
    const csv=await fetch(base+'/benchmarks/v1/cases.csv');assert.equal(csv.status,200);assert.match(csv.headers.get('content-type'),/text\/csv/);
    const outside=await fetch(base+'/benchmarks/%2e%2e%2f%2e%2e%2f%2e%2e%2f.env');assert.equal(outside.status,403);
  }finally{await new Promise(r=>server.close(r));}
});
