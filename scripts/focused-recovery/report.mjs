import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ROOT,sha,saveJSON} from '../research-lab/data.mjs';
import {pairedEstimate} from '../policy-lab/benchmark-stats.mjs';
import {durableReleaseGate} from '../agent-mesh/harness.mjs';
import {protocol,read,save,POLICIES} from './benchmark.mjs';
const {p}=await protocol(),r=await read('candidate-validation.json'),contract=await read('candidate-validation-protocol.json');
if(r.protocolHash!==contract.hash||contract.parentHash!==p.hash||sha(await readFile(resolve(ROOT,'scripts/focused-recovery/validate-candidate.mjs')))!==contract.scriptHash)throw Error('CONFIRMATION_PROVENANCE_FAILED');
const policy=POLICIES.find(x=>x.id===r.candidate),policyHash=sha({policy,engine:p.code,window:p.campaignDays});
const integrity=r.rows.every(x=>Object.values(x.checks).every(n=>n===0));
const proof={policyHash,source:'INDEPENDENT_PAIRED_SIMULATION',selectedBeforeTest:true,seeds:12,scenarios:5,shoppingDays:400,lastCampaignDay:199,mature:true,integrityPassed:integrity,platformAfterCost:r.stats.platform,merchant:r.stats.merchant};
const average=(xs,k)=>xs.reduce((n,x)=>n+x[k],0)/xs.length;
const policies=['organic','broad-quality-route',r.candidate].map(id=>{
 const xs=r.rows.filter(x=>x.policy===id),allocation=id===r.candidate?.10:0;
 const values=xs.map(x=>({...x,afterCost:x.deltaUSD-allocation})),platform=pairedEstimate(values,'afterCost'),outreachUSD=average(xs,'outreachCents')/100;
 return {id,platform,merchant:pairedEstimate(xs,'merchantDeltaUSD'),volume:pairedEstimate(xs,'volumeDeltaUSD'),meanRecommendations:average(xs,'recommendations'),meanPurchases:average(xs,'purchases'),
  bridge:{extraMarginUSD:average(xs,'deltaUSD')+outreachUSD,outreachUSD,modelAllowanceUSD:allocation,netUSD:platform.mean}};
});
const broad=policies[1],focused=policies[2],ledger=JSON.parse(await readFile(resolve(ROOT,'.local/gcp/model-spend.json'),'utf8'));
const lifetimeUSD=ledger.entries.reduce((n,e)=>n+e.chargedMicros,0)/1e6;
const costGroups=['AGGRESSIVE8-','RECOVERY9-'].map(prefix=>({prefix,usd:ledger.entries.filter(e=>e.runId.startsWith('market-'+prefix)).reduce((n,e)=>n+e.chargedMicros,0)/1e6}));
const old=JSON.parse(await readFile(resolve(ROOT,'docs/agent-mesh/aggressive-policy/summary.json'),'utf8'));
const report={version:1,protocolHash:contract.hash,policy,policyHash,proof,gate:durableReleaseGate(proof,policyHash),stats:r.stats,policies,
  lossReductionPct:100*(Math.abs(broad.platform.mean)-Math.abs(focused.platform.mean))/Math.abs(broad.platform.mean),
  marketCount:60,seeds:12,scenarios:p.scenarios,shoppingDays:400,campaignDays:[30,199],planner:contract.planner,
  trajectory:Array.from({length:370},(_,i)=>({day:i+31,...Object.fromEntries(policies.map(q=>[q.id,r.rows.filter(x=>x.policy===q.id).reduce((n,x)=>n+x.trajectory[i].deltaUSD,0)/60-q.bridge.modelAllowanceUSD]))})),
  cases:r.chosen.map(({trajectory,decisions,...x})=>x),oldShortWindow:{days100:old.stats.platform.mean,days200:old.durability.platform.mean},
  cost:{focusedModelUSD:0,iterationModelUSD:costGroups.reduce((n,x)=>n+x.usd,0),lifetimeUSD,costGroups,prospectiveAllowanceUSD:.10,pending:ledger.entries.filter(e=>e.status==='pending').length,circuit:ledger.circuit},
  assumptions:'Original closed-market behavioral and financial equations. Cached Channel3 prices; simulated customers, inventory, orders, returns, processing costs and fees. The outside-store variant was rejected in development and was not used here. No actual PayPal profit, native payments or merchant outcomes are claimed.',
  provenance:'The candidate was chosen here in chat after development, before60 fresh markets. No new Gemini calls for this candidate. These are60 deterministic executions, not60 LLM decisions. The $0.10 allowance is hypothetical per-deployment inference, not an incurred charge.',
  comparison:'The broad-quality-route baseline is the same recent-return-aware program with the same170-day authority, budget, merchant risk estimator and recommendation scorer, without the customer exposure/lapse filter. No-campaign remains the primary economic control.',
  sources:{contract:'/data/focused-validation-protocol.json',raw:'/data/focused-validation.json',earlier:'/aggressive-results.html',research:'/growth-lab.html'}};
await save('report.json',report);await saveJSON(resolve(ROOT,'demo/data/campaign-improvements.json'),report);await saveJSON(resolve(ROOT,'demo/data/focused-validation-protocol.json'),contract);await saveJSON(resolve(ROOT,'demo/data/focused-validation.json'),r);
console.log(JSON.stringify({candidate:r.candidate,gate:report.gate,policies:policies.map(p=>({policy:p.id,net:p.platform.mean})),lossReductionPct:report.lossReductionPct,cost:report.cost}));
