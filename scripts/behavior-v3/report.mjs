import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ROOT,sha,saveJSON} from '../research-lab/data.mjs';
import {pairedEstimate} from '../policy-lab/benchmark-stats.mjs';
import {durableReleaseGate} from '../agent-mesh/harness.mjs';
import {lock,read,save} from './benchmark.mjs';
import {run} from './runner.mjs';
const {p,catalog}=await lock(),approval=await read('agent.json'),evaluation=await read('evaluation.json');
if(approval.status!=='COMPLETED'||evaluation.protocolHash!==p.hash)throw Error('V3_REPORT_PROVENANCE');
const policy=approval.review.policyId,cost=approval.costMicros/1e6;
const rows=evaluation.rows.filter(r=>r.policy===policy).map(r=>{const rules=evaluation.rows.find(x=>x.seed===r.seed&&x.scenario===r.scenario&&x.policy==='strong_rules'),none=evaluation.rows.find(x=>x.seed===r.seed&&x.scenario===r.scenario&&x.policy==='none');return {...r,ongoingAfterCostUSD:r.ongoingUSD-cost,durableAfterCostUSD:r.durableUSD-cost,vsRulesUSD:r.durableUSD-rules.durableUSD-cost,growthPct:100*(r.durableUSD-cost)/(none.durable.platformCents/100)};});
const ci=(rs,f)=>({...pairedEstimate(rs,f),interval:'95% percentile bootstrap over seed clusters; equal weighting of this study’s six scenarios. Conditional on the authored V3 model.'});
const stats={ongoing:ci(rows,'ongoingAfterCostUSD'),durable:ci(rows,'durableAfterCostUSD'),vsRules:ci(rows,'vsRulesUSD'),merchant:ci(rows,'merchantUSD'),volume:ci(rows,'volumeUSD'),share:ci(rows,'sharePP'),growth:ci(rows,'growthPct'),acquired:ci(rows,'acquiredDelta'),reactivated:ci(rows,'reactivatedDelta')};
const sensitivity=[];
for(const response of p.sensitivity.response)for(const seed of p.sensitivity.seeds)for(const scenario of p.sensitivity.scenarios){
 const file=`sensitivity/${response}-${seed}-${scenario}.json`;let record;
 try{record=await read(file);if(record.protocolHash!==p.hash)throw Error('V3_SENSITIVITY_CHANGED');}catch(e){if(e.code!=='ENOENT')throw e;const baseline=run({runId:`V3-S-${seed}-${scenario}-none`,seed,scenario,response,catalog,policy:'none'}),candidate=run({runId:`V3-S-${seed}-${scenario}-agent`,seed,scenario,response,catalog,policy});
  if(response===0){for(const k of ['purchases','retainedCents','externalCents','acquired','reactivated','merchantCents'])if(candidate.durable[k]!==baseline.durable[k])throw Error('NULL_RESPONSE_COMMERCE_CHANGED');if(candidate.durable.platformCents-baseline.durable.platformCents!==-candidate.durable.outreachCents)throw Error('NULL_RESPONSE_REWARD_BONUS');}
  record={protocolHash:p.hash,response,seed,scenario,baseline,candidate,deltaUSD:(candidate.durable.platformCents-baseline.durable.platformCents)/100-cost};await save(file,record);
 }sensitivity.push(record);
}
const proof={policyHash:approval.policyHash,source:'INDEPENDENT_PAIRED_SIMULATION',selectedBeforeTest:true,seeds:8,scenarios:6,shoppingDays:230,lastCampaignDay:129,mature:true,integrityPassed:evaluation.rows.every(r=>r.integrity),platformAfterCost:stats.durable,merchant:stats.merchant};
const ledger=JSON.parse(await readFile(resolve(ROOT,'.local/gcp/model-spend.json'))),report={version:p.version,protocolHash:p.hash,selectedPolicy:policy,stats,rows,allPolicies:evaluation.stats,proof,gate:durableReleaseGate(proof,approval.policyHash),cases:48,seeds:8,scenarios:p.evaluationScenarios,approval,assumptions:p.assumptions,
 financialBridge:rows.reduce((a,r)=>{const n=rows.length,base=evaluation.rows.find(x=>x.seed===r.seed&&x.scenario===r.scenario&&x.policy==='none');a.incrementalPaymentMarginUSD+=(r.durableUSD+r.durable.outreachCents/100+r.durable.supportCents/100)/n;a.outreachUSD+=r.durable.outreachCents/100/n;a.subsidyUSD+=r.durable.supportCents/100/n;a.totalCommerceDeltaUSD+=(r.durable.totalCommerceCents-base.durable.totalCommerceCents)/100/n;a.outsideVolumeDeltaUSD+=(r.durable.externalCents-base.durable.externalCents)/100/n;return a;},{incrementalPaymentMarginUSD:0,outreachUSD:0,subsidyUSD:0,totalCommerceDeltaUSD:0,outsideVolumeDeltaUSD:0,modelUSD:cost,netUSD:stats.durable.mean}),
 sensitivity:sensitivity.map(({baseline,candidate,...r})=>({...r,outreachUSD:candidate.durable.outreachCents/100,purchasesDelta:candidate.durable.purchases-baseline.durable.purchases})),
 cost:{newModelUSD:cost,lifetimeUSD:ledger.entries.reduce((n,e)=>n+e.chargedMicros,0)/1e6,pending:ledger.entries.filter(e=>e.status==='pending').length,allocatedPerMarketUSD:cost},
 scope:p.claimBoundary,comparison:'V3 is a new behavior model. Its improvement versus paired V3 controls cannot be compared as a policy-only gain against old V1 losses. The same selected program without an LLM produces the same purchases and avoids the inference cost. Two fresh Gemini decisions selected the program before48 deterministic test executions.',
 assumptionsSummary:['Persistent awareness and active/dormant/prospect relationships','Observed item/topic interests and locally fitted recommender','Competing external purchases and household spending','Satiation and independently specified frequency fatigue','Same authored fees, processing and budget constraints for every policy'],
 zeroResponseDisclosure:'Negative control intentionally loses outreach/model cost. It verifies no automatic reward for campaigns or agent identity. Weak-response cases have only2 seed clusters and are descriptive.'};
await save('report.json',report);await saveJSON(resolve(ROOT,'demo/data/behavior-v3-report.json'),report);
console.log(JSON.stringify({policy,stats,cost:report.cost,gate:report.gate,sensitivity:report.sensitivity.map(s=>({response:s.response,delta:s.deltaUSD}))}));
