// Independent read/replay checks. Restored checkpoints never call Gemini.
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {ROOT,readJSON,saveJSON,sha,frozenInputs} from '../research-lab/data.mjs';
import {BASE} from './development.mjs';
import {assertFrozen,summarize} from './benchmark.mjs';
import {runControllers} from './runtime.mjs';
import {validate,PROMPT} from './agent.mjs';

const phase=process.argv[2]||'validation',protocol=await readJSON(resolve(BASE,'protocol.json'));
await assertFrozen(protocol);
const inputs=await frozenInputs();assert.equal(inputs.originalBenchmarkHash,protocol.priorEngineHash);assert.equal(inputs.v2ProtocolHash,protocol.priorV2Hash);
const result=await readJSON(resolve(BASE,phase+'-result.json')),priors=await readJSON(resolve(BASE,'priors.json')),pooled=await readJSON(resolve(BASE,'pooled-model.json'));
assert.equal(result.protocolHash,protocol.hash);
const seeds=phase==='confirmation'?protocol.confirmationSeeds:protocol.validationSeeds;
assert.equal(result.cases.length,seeds.length*protocol.scenarios.length);
assert.equal(new Set(result.cases.map(c=>c.seed+'-'+c.scenario)).size,result.cases.length);
const expected=new Set(seeds.flatMap(seed=>protocol.scenarios.map(s=>seed+'-'+s)));
const ledger=await readJSON(resolve(ROOT,'.local/gcp/model-spend.json'));
let nativeCalls=0,reviews=0,checkedCases=0,recordedModelUSD=0;
const fields=['purchases','platformProxyCents','retainedCents','merchantContributionCents','outreachCents','platformSupportCents','jointBudgetSpentCents','offers','recommendations','redemptions','cohortLapsed','reactivatedCustomers','checks','matureOutcomes','publications'];
for(const c of result.cases){
  assert.ok(expected.has(c.seed+'-'+c.scenario));assert.equal(c.protocolHash,protocol.hash);
  assert.equal(c.id,'CAMP5-'+phase+'-'+sha({seed:c.seed,scenario:c.scenario,protocol:protocol.hash}).slice(0,16));
  const directory=resolve(BASE,phase,c.id),charges=ledger.entries.filter(e=>e.runId==='market-'+c.id);
  assert.equal(charges.filter(e=>e.status==='pending').length,0);assert.equal(charges.reduce((n,e)=>n+e.chargedMicros,0)/1e6,c.costs.modelUSD);recordedModelUSD+=c.costs.modelUSD;
  const replay=await runControllers({id:c.id,seed:c.seed,scenario:c.scenario,catalog:inputs.catalog,priors,pooled,
    choose:async()=>{nativeCalls++;throw Error('MODEL_CALL_FORBIDDEN_IN_REPLAY');},
    restore:day=>readJSON(resolve(directory,'review-'+day+'.json'))});
  assert.deepEqual(replay.reviews,c.reviews);
  for(const branch of replay.branches){const stored=c.branches.find(b=>b.method===branch.method);for(const field of fields)assert.deepEqual(branch[field],stored[field],c.id+' '+branch.method+' '+field);}
  const shopperKey=a=>{const match=a.customer_id.match(/-U(\d+)$/);assert.ok(match,'Expected a stable simulated shopper identifier');return a.day+':'+match[1];};
  const controlRows=new Map(replay.runners.organic.actions.map(a=>[shopperKey(a),a]));
  const summarizeAction=(a,runner)=>{if(!a)return null;const o=a.order_id?runner.orders.get(a.order_id):null;return {action:a.selected_action,orderId:a.order_id,purchase:Boolean(o),grossCents:o?.total_cents??0,refundCents:o?.refund??0,retainedFeeCents:o&&!o.refund?o.fee:0,processingCents:o?.processing??0,outreachCents:a.outreach_cents,platformSupportCents:a.platform_support_cents,platformContributionCents:a.reward_cents,source:'SIMULATED'};};
  const customerTraces=c.reviews.map((review,i)=>{
    const end=c.reviews[i+1]?.publishedDay??100,rows=replay.runners.llm.actions.filter(a=>a.day>=review.publishedDay&&a.day<end);
    const contacts=rows.filter(a=>a.selected_action!=='none'),shown=(contacts.length?contacts:rows.filter(a=>a.order_id)).slice(0,5);
    return {reviewDay:review.cutoff,publishedDay:review.publishedDay,windowEndExclusive:end,
      selection:'First five contacted shoppers in event order, or first five ordinary purchases when no outreach occurred. No success filtering.',
      actionCounts:rows.reduce((counts,a)=>(counts[a.selected_action]=(counts[a.selected_action]||0)+1,counts),{}),
      rows:shown.map(a=>{const control=controlRows.get(shopperKey(a));assert.ok(control,'Matched control shopper/day must exist');return {day:a.day,customerId:a.customer_id,treated:summarizeAction(a,replay.runners.llm),noOutreach:summarizeAction(control,replay.runners.organic)};}),
      limitation:'Matched shopper/day under whole policies. Earlier policy actions can alter state; this is not isolated per-contact causal attribution. Outcomes are read after maturity, never fed to the planner.'};
  });
  await saveJSON(resolve(directory,'customer-trace.json'),customerTraces);
  for(const review of c.reviews){
    const req=await readJSON(resolve(directory,'requests/review-'+review.cutoff+'.json'));
    assert.equal(req.system,PROMPT);assert.equal(req.inputHash,sha({system:req.system,packet:req.packet,functions:req.functions,thinkingLevel:req.thinkingLevel}));assert.equal(sha(req.packet),review.packetHash);
    assert.equal(req.packet.authority.nativePayments,false);assert.equal(req.packet.market.asOfDay,review.cutoff);assert.equal(req.thinkingLevel,'MEDIUM');
    assert.ok(!Object.hasOwn(req.packet,'scenario'));assert.ok(!Object.hasOwn(req.packet,'branches'));
    if(!review.error){assert.equal(req.status,'COMPLETED');assert.deepEqual(validate(req.response,req.packet),review.decision);}else assert.ok(req.error);
    assert.ok(charges.some(e=>e.caseId===c.id+'-review-'+review.cutoff));reviews++;
  }
  checkedCases++;
}
const recomputed=summarize(result.cases,protocol,phase);
for(const field of ['stats','primary','organic','revisions','merchant','codeComparisons','gates','passed','violations','decisionChanges','failedReviews'])assert.deepEqual(recomputed[field],result[field],field);
assert.equal(nativeCalls,0);assert.ok(Math.abs(recordedModelUSD-result.costs.modelUSD)<1e-9);
await assertFrozen(protocol);
const out={passed:true,phase,at:new Date().toISOString(),protocolHash:protocol.hash,checkedCases,reviews,nativeModelCallsDuringVerification:nativeCalls,recordedModelUSD,
  checks:['Frozen simulator, catalog, code and protocol match','Complete predeclared seed/scenario grid with no replacements','Every branch reproduces from saved decisions','Evidence, prompt and request identities match','Provider cost ledger reconciles to every case','Statistical summaries and promotion gates recompute','No native payment or new inference during verification'],
  economicGatesPassed:result.passed,limitation:'Integrity verification is separate from positive economic evidence.'};
await saveJSON(resolve(BASE,'verification.json'),out);console.log(JSON.stringify(out,null,2));
