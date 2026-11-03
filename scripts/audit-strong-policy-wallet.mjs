// Six previously evaluated markets: an accounting sensitivity, NOT fresh confirmation.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createPolicyWorld,advancePolicyDay} from './policy-lab/economy.mjs';
import {createWalletCorrectedWorld,advanceWalletCorrectedDay} from './policy-lab/wallet-corrected.mjs';
import {POLICIES,scheduleModel,matureMerchantRisk} from './agent-mesh/aggressive-policy.mjs';
import {ROOT,frozenInputs,saveJSON,sha} from './research-lab/data.mjs';
const {catalog}=await frozenInputs(),summary=JSON.parse(await readFile(resolve(ROOT,'docs/agent-mesh/aggressive-policy/summary.json'))),selected=POLICIES.find(p=>p.id===summary.selectedPolicy),cost=summary.financialBridge.allocatedModelUSD;
function run(seed,scenario,policy,corrected,campaignStop=100){
 const create=corrected?createWalletCorrectedWorld:createPolicyWorld,advance=corrected?advanceWalletCorrectedDay:advancePolicyDay;
 const w=create({runId:`AGGRESSIVE-${seed}-${scenario}-${policy.id}`,comparisonId:'ACCOUNTING-SENSITIVITY',branch:'mesh',settings:{seed,scenario,customerCount:100,days:200,budgetCents:5000},catalog,startedAt:'2026-10-26T01:00:00.000Z'}),orders=new Map(),model=scheduleModel(policy);let outreach=0,support=0;
 while(w.tick<214){const day=w.tick;
  if(day>=30&&day<campaignStop&&policy.id!=='organic'){
   const risk=matureMerchantRisk({world:w,orders}),active=!policy.weekdays||policy.weekdays.includes(day%7),indices=risk.filter(m=>!policy.risk||!m.excluded).map(m=>m.index);
   w.policyLab.plan={strategy:active?'recommendations':'observe',audience:'all',merchantIndices:active?indices:[],maxOfferPct:0,epsilon:0};w.policyLab.model=model;
  }
  if(day>=campaignStop)w.policyLab.plan={strategy:'observe',audience:'all',merchantIndices:[],maxOfferPct:0,epsilon:0};
  const {rows}=advance(w);
  for(const o of rows.orders)orders.set(o.order_id,{...o,day,refund:0,fee:rows.transactions.find(t=>t.order_id===o.order_id).fee_cents});
  for(const r of rows.refunds)orders.get(r.order_id).refund+=r.amount_cents;
  if(day>=30)for(const a of rows.policy_lab_actions){outreach+=a.outreach_cents;support+=a.platform_support_cents;}
 }
 return [...orders.values()].filter(o=>o.day>=30).reduce((n,o)=>n+(o.refund?0:o.fee)-(Math.round(o.total_cents*.012)+20),0)-outreach-support;
}
const rows=[];
for(const seed of [111001,111002])for(const scenario of ['steady','budget_squeeze','returns_wave']){
 const organic=run(seed,scenario,POLICIES[0],false),old=(run(seed,scenario,selected,false)-organic)/100-cost;
 const reference=JSON.parse(await readFile(resolve(ROOT,`docs/agent-mesh/aggressive-policy/followup/${seed}-${scenario}.json`)));
 assert.ok(Math.abs(old-reference.deltaUSD)<1e-9,'Original200-day result must reproduce before testing the correction.');
 const fixed=(run(seed,scenario,selected,true)-run(seed,scenario,POLICIES[0],true))/100-cost;
 const continuing=(run(seed,scenario,selected,false,200)-organic)/100-cost;
 rows.push({seed,scenario,originalPlatformDeltaUSD:old,correctedPlatformDeltaUSD:fixed,correctionDifferenceUSD:fixed-old,continuingOriginalPolicyUSD:continuing});
}
const report={policy:selected,scope:'Accounting sensitivity on6 previously examined markets; not fresh confirmation and not representative of all80',days:200,campaignStopsAt:100,originalParityPassed:true,rows,originalMeanUSD:rows.reduce((n,r)=>n+r.originalPlatformDeltaUSD,0)/6,correctedMeanUSD:rows.reduce((n,r)=>n+r.correctedPlatformDeltaUSD,0)/6,
 continuingOriginalMeanUSD:rows.reduce((n,r)=>n+r.continuingOriginalPolicyUSD,0)/6,
 continuationScope:'Same original behavior, policy and$50 virtual budget, with campaigns continuing through day199. Same6 diagnostic cases, not independently selected confirmation. Distinguish ongoing operation from post-campaign durability.',
 changes:'Wallet correction changes only new-credit ceiling and integer-cent rounding. Separate continuation arm uses original accounting and response but runs the original campaign longer. Earlier80-market results are retained.',
 hashes:Object.fromEntries(await Promise.all(['scripts/policy-lab/economy.mjs','scripts/policy-lab/wallet-corrected.mjs', 'scripts/audit-strong-policy-wallet.mjs'].map(async p=>[p,sha(await readFile(resolve(ROOT,p)))]))),newModelCalls:0,newPayments:0};
await saveJSON(resolve(ROOT,'docs/agent-mesh/simulator-audit/strong-policy-wallet-sensitivity.json'),report);console.log(JSON.stringify(report,null,2));
