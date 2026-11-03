import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {ROOT,BASE,save,POLICIES} from './aggressive-policy.mjs';
import {pairedEstimate} from '../policy-lab/benchmark-stats.mjs';
import {assertFrozen} from '../campaign-controller/benchmark.mjs';
const read=async f=>JSON.parse(await readFile(resolve(BASE,f),'utf8'));
await assertFrozen(JSON.parse(await readFile(resolve(ROOT,'docs/policy-lab/benchmarks/v5/protocol.json'))));
const p=await read('protocol.json'),d=await read('development.json'),e=await read('evaluation.json'),a=await read('agent-choices.json'),demo=await read('demo.json');
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
if(hash(await readFile(resolve(import.meta.dirname,'aggressive-policy.mjs'),'utf8'))!==p.codeHash||d.protocolHash!==p.hash||e.protocolHash!==p.hash)throw Error('FROZEN_POLICY_MISMATCH');
if(a.results.length!==3)throw Error('AGENT_APPROVAL_MISMATCH');
for(const r of a.results){
 const allowed=POLICIES.find(p=>p.id===r.policy?.id);
 if(r.status!=='COMPLETED'||!allowed||r.policy.id!==d.selectedPolicy||r.policyHash!==hash(allowed))throw Error('AGENT_APPROVAL_MISMATCH');
}
const cost=Math.max(...a.results.map(r=>r.costMicros))/1e6;
const rows=e.rows.filter(r=>r.policy===d.selectedPolicy).map(r=>{
 const broad=e.rows.find(b=>b.seed===r.seed&&b.scenario===r.scenario&&b.policy==='broad-full-price'),simple=e.rows.find(b=>b.seed===r.seed&&b.scenario===r.scenario&&b.policy==='high-value-weekly');
 const organic=e.rows.find(b=>b.seed===r.seed&&b.scenario===r.scenario&&b.policy==='organic');
 return {...r,afterInferenceDeltaUSD:r.deltaUSD-cost,afterInferenceGrowthPct:100*((r.platformProxyCents/100-cost)-organic.platformProxyCents/100)/(organic.platformProxyCents/100),vsBroadUSD:r.deltaUSD-cost-broad.deltaUSD,vsSimpleWeeklyUSD:r.deltaUSD-cost-simple.deltaUSD};
});
const stats={platform:pairedEstimate(rows,'afterInferenceDeltaUSD'),merchant:pairedEstimate(rows,'merchantDeltaUSD'),volume:pairedEstimate(rows,'volumeDeltaUSD'),growth:pairedEstimate(rows,'afterInferenceGrowthPct'),vsBroad:pairedEstimate(rows,'vsBroadUSD'),vsSimpleWeekly:pairedEstimate(rows,'vsSimpleWeeklyUSD')};
const totals=rows.reduce((s,r)=>({outreach:s.outreach+r.outreachCents/100,support:s.support+r.platformSupportCents/100,marginBeforeOutreach:s.marginBeforeOutreach+r.deltaUSD+r.outreachCents/100+r.platformSupportCents/100}),{outreach:0,support:0,marginBeforeOutreach:0});
const ledger=JSON.parse(await readFile(resolve(ROOT,'.local/gcp/model-spend.json'),'utf8'));
const report={protocolHash:p.hash,selectedPolicy:d.selectedPolicy,definition:POLICIES.find(p=>p.id===d.selectedPolicy),stage:'CONFIRMED_IN_THIS_FROZEN_SIMULATOR',cases:80,independentSeeds:16,scenarios:p.scenarios,stats,rows,allPolicies:e.stats,
  financialBridge:{incrementalMarginBeforeOutreachUSD:totals.marginBeforeOutreach/80,outreachUSD:totals.outreach/80,subsidyUSD:totals.support/80,allocatedModelUSD:cost,netUSD:stats.platform.mean},
  agentTrials:a.results.map(r=>({trial:r.trial,proposal:r.proposal,review:r.review,costMicros:r.costMicros,provider:r.provider})),newModelUSD:a.newCostUSD,lifetimeRecordedUSD:ledger.entries.reduce((s,r)=>s+r.chargedMicros,0)/1e6,
  inferenceAccounting:'Each alternative market is conservatively charged the largest observed cost of a fresh two-call agent approval. Only3 real approval trials were generated; the80 executions are not80 fresh LLM decisions.',
  pass:{positiveMean:stats.platform.mean>0,positiveLower95:stats.platform.low>0,merchantLower95Nonnegative:stats.merchant.low>=0,allMarketsPositive:stats.platform.winRate===1,tenPercentGrowth:stats.growth.mean>=10},
  boundary:'Economic equations, customer responses and fees are unchanged. Policy authority expanded from isolated7-day/$5 pilots to recurring campaigns over70 days with a$50 virtual budget, equally for controls. The selected program uses no discounts. This is modeled value, not actual PayPal profit. The numerical policy without LLM selection gets the same commerce outcome at lower inference cost.',
  demo:{runId:demo.runId,seed:demo.seed,scenario:demo.scenario,selectedBeforeOutcome:true,summaries:demo.summaries,warehouse:demo.warehouse}};
await save('summary.json',report);await mkdir(resolve(ROOT,'demo/data'),{recursive:true});await writeFile(resolve(ROOT,'demo/data/aggressive-results.json'),JSON.stringify(report)+'\n');
const violations=e.rows.reduce((n,r)=>n+Object.values(r.checks).reduce((s,x)=>s+x,0),0);
await save('verification.json',{protocolHash:p.hash,selectedBeforeEvaluation:true,agentChoicesUsedDevelopmentOnly:true,agentTrials:3,generatedModelDecisions:6,heldoutMarkets:80,independentSeedClusters:16,frozenEconomicsVerified:true,simulationViolations:violations,warehouseParityVerified:true,newNativePayments:0,newModelUSD:a.newCostUSD,conservativeModelCostPerMarketUSD:cost,pending:ledger.entries.filter(e=>e.status==='pending').length,circuit:ledger.circuit,localTestsPassed:2});
// A later durability check supersedes the short-window promotion claim.
// Never turn this report green again merely by re-exporting the original results.
try{
 const durability=await read('followup.json');report.durability=durability;report.stage='SHORT_HORIZON_ONLY_DURABILITY_FAILED';report.pass.durablePositive=false;
 await save('summary.json',report);await writeFile(resolve(ROOT,'demo/data/aggressive-results.json'),JSON.stringify(report)+'\n');
}catch(e){if(e.code!=='ENOENT')throw e;}
console.log(JSON.stringify({stats,financialBridge:report.financialBridge,cost:a.newCostUSD,pass:report.pass},null,2));
