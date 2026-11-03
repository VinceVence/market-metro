// Structural audit, not a policy search. No LLM, cloud or payment calls.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createPolicyWorld,advancePolicyDay,ACTIONS,modeledFee} from './policy-lab/economy.mjs';
import {draw} from './marketing/economy.mjs';
import {frozenInputs,ROOT,sha,saveJSON} from './research-lab/data.mjs';
import {assertFrozen} from './campaign-controller/benchmark.mjs';

await assertFrozen(JSON.parse(await readFile(resolve(ROOT,'docs/policy-lab/benchmarks/v5/protocol.json'))));
const {catalog}=await frozenInputs(),base=resolve(ROOT,'docs/agent-mesh/simulator-audit');
const world=(seed,customers=1,days=100,scenario='steady')=>createPolicyWorld({runId:'AUDIT-'+seed,comparisonId:'AUDIT',branch:'mesh',settings:{seed,customerCount:customers,days,budgetCents:5000,scenario},catalog,startedAt:'2026-10-26T01:00:00.000Z'});
function choose(w,action){
 const index=action==='none'?null:Number(action.split(':')[1]);
 w.policyLab.plan={strategy:action==='none'?'observe':action.startsWith('coupon')?'mixed':'recommendations',audience:'all',merchantIndices:index===null?[]:[index],maxOfferPct:5,epsilon:0};
 w.policyLab.model={arms:Object.fromEntries(ACTIONS.map(id=>[id,{count:0,coef:[id===action?1:-1,0,0,0,0,0,0],inverse:Array.from({length:7},()=>Array(7).fill(0))}]))};
 w.policyLab.policyVersion='CAUSAL_WIRING_AUDIT';
}
const samples=[];
for(let seed=810001;seed<=810128;seed++){
 const w=world(seed);while(w.tick<37)advancePolicyDay(w);
 const merchant=Math.max(0,w.customers[0].lastMerchantIndex),control=structuredClone(w),copy=structuredClone(w),treatment=structuredClone(w);
 choose(control,'none');choose(copy,'none');choose(treatment,'recommend:'+merchant);
 const no=advancePolicyDay(control),duplicate=advancePolicyDay(copy),yes=advancePolicyDay(treatment);
 assert.deepEqual(no,duplicate,'Identical state and policy must reproduce identical events.');
 assert.equal(yes.rows.policy_lab_actions[0].selected_action,'recommend:'+merchant);
 const c=control.customers[0],t=treatment.customers[0],before=w.customers[0];
 samples.push({seed,day:37,merchant,read:draw(seed,'read-offer',37,0)<.8,visitDraw:draw(seed,'visit-market',37,0),
  before:{walletCents:before.wallet,lastPurchaseDay:before.lastPurchase,fatigue:w.privateTraits[0].fatigue,baseActivity:w.privateTraits[0].activity},
  without:{visited:c.history.at(-1).visited,purchased:c.history.at(-1).purchased,merchant:no.rows.orders[0]?.merchant_id??null,grossCents:no.rows.orders[0]?.total_cents??0},
  with:{visited:t.history.at(-1).visited,purchased:t.history.at(-1).purchased,merchant:yes.rows.orders[0]?.merchant_id??null,grossCents:yes.rows.orders[0]?.total_cents??0}});
}
const firstIncremental=samples.find(s=>!s.without.purchased&&s.with.purchased);
assert.ok(firstIncremental,'At least one paired fixture must demonstrate a purchase caused by the recommendation.');

// Measure the fatigue impulse through the actual unmodified state transition.
const initial=world(810001,1,120);while(initial.tick<37)advancePolicyDay(initial);
const plain=structuredClone(initial),contact=structuredClone(initial);
choose(plain,'none');choose(contact,'recommend:0');advancePolicyDay(plain);advancePolicyDay(contact);
choose(contact,'none');const fatigue=[];
for(let lag=1;lag<=60;lag++){
 const difference=contact.privateTraits[0].fatigue-plain.privateTraits[0].fatigue;
 assert.ok(Math.abs(difference-.2*.9**(lag-1))<1e-10);
 fatigue.push({lag,fatigueDifference:difference,visitProbabilityReduction:.04*difference});
 advancePolicyDay(plain);advancePolicyDay(contact);
}
const delayedVisitPenalty=fatigue.reduce((n,x)=>n+x.visitProbabilityReduction,0),immediateExpectedVisitBoost=.8*.10;

// Diagnostic accounting samples only; not an independent profit benchmark.
const budget=[];
for(const seed of [119001,119002,119003])for(const scenario of ['steady','budget_squeeze']){
 const w=world(seed,100,400,scenario),initialWalletCents=w.customers.reduce((n,u)=>n+u.wallet,0);
 let creditedIncomeCents=0,scheduledIncomeCents=0,existingBalanceClippedCents=0,maxBalanceErrorCents=0;
 while(w.tick<w.totalTicks){
  const day=w.tick,before=w.customers.reduce((n,u)=>n+u.wallet,0);
  if(day>0&&day<400&&day%7===0){
   scheduledIncomeCents+=w.privateTraits.reduce((n,t)=>n+t.weeklyIncome*(scenario==='budget_squeeze'&&day>=35?.65:1),0);
   for(const u of w.customers){const due=w.pending.filter(p=>p.customerIndex===u.index&&p.refund&&!p.refunded&&p.returnDay<=day).reduce((n,p)=>n+p.gross,0);existingBalanceClippedCents+=Math.max(0,u.wallet+due-50000);}
  }
  const {rows}=advancePolicyDay(w),after=w.customers.reduce((n,u)=>n+u.wallet,0);
  creditedIncomeCents+=after-before+rows.orders.reduce((n,o)=>n+o.total_cents,0)-rows.refunds.reduce((n,r)=>n+r.amount_cents,0);
  maxBalanceErrorCents=Math.max(maxBalanceErrorCents,Math.abs(initialWalletCents+creditedIncomeCents-(w.stats.revenueCents-w.stats.refundsCents)-after));
 }
 assert.ok(maxBalanceErrorCents<1e-5);const finalWalletCents=w.customers.reduce((n,u)=>n+u.wallet,0),netSpendCents=w.stats.revenueCents-w.stats.refundsCents;
 budget.push({seed,scenario,customers:100,initialWalletCents,scheduledIncomeCents,creditedIncomeCents,existingBalanceClippedCents,netSpendCents,finalWalletCents,shareOfAvailableBudgetSpent:netSpendCents/(initialWalletCents+creditedIncomeCents),maxBalanceErrorCents,baseline:'30 days of shared randomized history, then no campaigns'});
}
const report={version:1,sourceHashes:Object.fromEntries(await Promise.all(['scripts/policy-lab/economy.mjs','scripts/marketing/economy.mjs', 'scripts/audit-campaign-response.mjs'].map(async p=>[p,sha(await readFile(resolve(ROOT,p)))]))),
 scope:'Structural audit of unchanged frozen simulator. Single-shopper fixtures prove causal wiring, not profitable campaigns or population effect estimates.',
 wiring:{fixtures:samples.length,changedVisits:samples.filter(s=>s.without.visited!==s.with.visited).length,changedPurchases:samples.filter(s=>s.without.purchased!==s.with.purchased).length,changedMerchants:samples.filter(s=>s.without.purchased&&s.with.purchased&&s.without.merchant!==s.with.merchant).length,firstIncremental,samples},
 fatigue:{immediateExpectedVisitBoost,delayedVisitPenalty60Days:delayedVisitPenalty,netExpectedAdditionalVisits60Days:immediateExpectedVisitBoost-delayedVisitPenalty,infiniteHorizonPenalty:.04*.2/(1-.9),assumptions:'One isolated contact;80% read rate;10-point same-day visit boost; every sent contact adds0.2 fatigue, decaying0.9 daily; each fatigue unit costs0.04 visit probability. Probability clipping is inactive at these normal activity levels. This cancels expected visits, not necessarily purchases: recommendation choice utility also changes.',trajectory:fatigue},
 budget,
 feeMix:[3199,8900].map(grossCents=>{const fee=modeledFee(grossCents),processing=Math.round(grossCents*.012)+20;return {grossCents,feeCents:fee,processingCents:processing,platformMarginCents:fee-processing,marginPct:100*(fee-processing)/grossCents};}),
 structuralLimits:[
  {issue:'No persistent acquisition/churn/reactivation state',evidence:'activity, merchantAffinity and loyalty are initialized and do not learn from campaign exposure or purchase. Lapsed status is observed recency, not a change in latent future propensity.'},
  {issue:'Uniform recommendation relevance',evidence:'Read recommendation adds0.55 choice utility for any shopper. Category is uniformly drawn before action selection; inherited product affinity is not used in the policy-lab transition. Actions choose merchant/discount, not a different product category.'},
  {issue:'Captive fixed-budget economy',evidence:'Every modeled retailer is a PayPal merchant. The outside option is no purchase; there is no competing payment network or retained wallet share. Campaigns can spend allowance earlier without expanding long-run available money.'},
  {issue:'Uncalibrated economic proxy',evidence:'Fees, processing costs, fatigue and response coefficients are authored assumptions. Higher-priced products have lower platform margin per dollar under the fixed-fee component.'}
 ],newModelCalls:0,newPayments:0,oldEngineModified:false};
await saveJSON(resolve(base,'audit.json'),report);
console.log(JSON.stringify({wiring:{fixtures:samples.length,changedVisits:report.wiring.changedVisits,changedPurchases:report.wiring.changedPurchases,firstIncremental},fatigue:{immediateExpectedVisitBoost,delayedVisitPenalty,net:immediateExpectedVisitBoost-delayedVisitPenalty},budget:budget.map(({seed,scenario,shareOfAvailableBudgetSpent,finalWalletCents,existingBalanceClippedCents})=>({seed,scenario,shareOfAvailableBudgetSpent,finalWalletCents,existingBalanceClippedCents})),feeMix:report.feeMix},null,2));
