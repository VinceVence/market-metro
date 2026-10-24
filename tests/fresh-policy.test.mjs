import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFreshWorld,runLocalCandidate,unchangedRules,POLICY_OPTIONS,policyArtifact} from '../scripts/policy-lab/fresh-world.mjs';
import {validateFreshDecision,decisionTool} from '../scripts/policy-lab/fresh-agent.mjs';
import {verifyFrozenOriginal} from '../scripts/policy-lab/fresh-benchmark.mjs';
const p=JSON.parse(readFileSync(new URL('../docs/policy-lab/benchmarks/v1/protocol.json',import.meta.url))),input=JSON.parse(readFileSync(new URL('../docs/policy-lab/benchmarks/v1/inputs.json',import.meta.url)));
const opts={id:'FRESH-TEST',seed:314,scenario:'rival_sale',settings:p.settings,catalog:input.catalog,startedAt:p.startedAt};

test('original simulator, learner, rules and original benchmark files remain frozen',async()=>{assert.match(await verifyFrozenOriginal(),/^[0-9a-f]{64}$/);});
test('fresh evaluator preserves original rules and no-campaign monetary totals',()=>{
  for(const [choice,branch] of [[unchangedRules,'rules'],['observe','organic']]){
    const result=runLocalCandidate(opts,choice),expected=input.originalBranches.find(b=>b.branch===branch);
    for(const key of ['purchases','platformProxyCents','retainedCents','merchantContributionCents','jointBudgetSpentCents'])assert.equal(result[key],expected[key]);
    assert(Object.values(result.checks).every(v=>v===0));
  }
});
test('short campaigns expire while customers continue buying; policy penalties preserve raw model coefficients',()=>{
  const r=createFreshWorld(opts);while(r.world.tick<30)r.step();const m=r.fit(),raw=JSON.stringify(m),plan={...POLICY_OPTIONS.find(x=>x.id==='recommend_selective'),merchantIndices:[0,1,2],windowDays:42};
  const adjusted=policyArtifact(m,plan);assert.equal(JSON.stringify(m),raw);assert.equal(adjusted.arms.none.coef[0],m.arms.none.coef[0]);assert(Math.abs(adjusted.arms['recommend:0'].coef[0]-(m.arms['recommend:0'].coef[0]-.6))<1e-10);
  r.publish(plan,m);while(r.world.tick<35)r.step();assert.equal(r.world.policyLab.plan.strategy,'observe');assert.equal(JSON.stringify(r.model()),raw);assert(r.actions.some(a=>a.day>=33&&a.order_id));
});
test('fresh decisions must reproduce observed numeric facts, cite pinned evidence and stay inside the menu',()=>{
  const packet={trend:'up',recentPurchases:119,previousPurchases:111,evidenceId:'snapshot',merchants:[{index:1,stock:20}],modelAvailable:false};
  const d={trend:'up',recentPurchases:119,previousPurchases:111,evidenceId:'snapshot',rationale:'Use a small, bounded recommendation experiment.',policyId:'recommend_selective',merchantIndices:[1],modelAction:'retrain',windowDays:42};
  assert.deepEqual(validateFreshDecision('scientist',d,packet),d);
  for(const bad of [{...d,trend:'down'},{...d,recentPurchases:120},{...d,evidenceId:'future'},{...d,merchantIndices:[2]},{...d,modelAction:'reuse'},{...d,capturePayment:true}])assert.throws(()=>validateFreshDecision('scientist',bad,packet));
});
test('agent evidence exposes observed state without seed, future scenario label, hidden personas or control branches',()=>{
  const r=createFreshWorld(opts);while(r.world.tick<30)r.step();const e=r.evidence();assert.equal(e.asOfDay,30);assert(!/privateTraits|merchantAffinity|weeklyIncome|rival_sale|rules_fast/.test(JSON.stringify(e)));assert.equal(e.trend,e.recentPurchases>e.previousPurchases?'up':e.recentPurchases<e.previousPurchases?'down':'flat');
});
test('Vertex tool schemas keep numeric constraints out of string-only enum fields',()=>{
  const visit=x=>{if(x&&typeof x==='object'){if(Array.isArray(x.enum))assert(x.enum.every(v=>typeof v==='string'));Object.values(x).forEach(visit);}};
  for(const role of ['analyst','scientist','reviewer'])visit(decisionTool(role,{evidenceId:'test'}));
});
