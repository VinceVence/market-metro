import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ROOT,read,save,sha,CONFIG,SCENARIOS} from './growth-lab.mjs';
import {selectTestedCandidate} from './growth-agent.mjs';
import {pairedEstimate} from '../policy-lab/benchmark-stats.mjs';
import {assertFrozen} from '../campaign-controller/benchmark.mjs';

await assertFrozen(JSON.parse(await readFile(resolve(ROOT,'docs/policy-lab/benchmarks/v5/protocol.json'))));
const numeric=await read('numeric-result.json'),agent=await read('agent-result.json'),external=await read('external/result.json'),contrasts=await read('contrasts.json');
const p=await read('protocol.json'),ap=await read('agent-protocol.json');
for(const [file,digest]of Object.entries(p.code))if(sha(await readFile(resolve(import.meta.dirname,file+'.mjs'),'utf8'))!==digest)throw Error('NUMERIC_CODE_CHANGED');
for(const [file,digest]of Object.entries(ap.code))if(sha(await readFile(resolve(import.meta.dirname,file+'.mjs'),'utf8'))!==digest)throw Error('AGENT_CODE_CHANGED');
if(agent.validCases!==10)throw Error('INCOMPLETE_AGENT_EVALUATION');
const cases=[];
for(const row of agent.cases){
  const c=await read(`agents/${row.seed}-${row.scenario}.json`);
  if(c.protocolHash!==ap.hash||c.status!=='COMPLETED')throw Error('INVALID_RECORDED_CASE');
  if(c.authorizedCandidate&&!selectTestedCandidate(c.candidates[c.authorizedCandidate],{costUSD:c.score.costMicros/1e6}))throw Error('UNSUPPORTED_RECORDED_AUTHORIZATION');
  if(Object.values(c.score.checks).some(n=>n!==0))throw Error('ACCOUNTING_OR_AUTHORITY_FAILURE');
  cases.push({shopperTrace:c.score.trace||[],seed:c.seed,scenario:c.scenario,evidence:c.evidence,agentChoice:c.agentChoice,authorizedCandidate:c.authorizedCandidate,score:{deltaUSD:c.score.deltaUSD,merchantDeltaUSD:c.score.merchantDeltaUSD,volumeDeltaUSD:c.score.volumeDeltaUSD,offers:c.score.offers,redemptions:c.score.redemptions,purchases:c.score.purchases,recommendations:c.score.recommendations,costMicros:c.score.costMicros},trace:c.trace.map(t=>({role:t.role,status:t.status,candidate:t.candidate,artifact:t.artifact,response:t.response,provider:t.provider})),candidates:Object.fromEntries(Object.entries(c.candidates).map(([id,x])=>[id,{spec:x.spec,model:{id:x.model.modelId,family:x.model.family,trainingScope:x.model.trainingScope,mse:x.model.mse,constantMse:x.model.baselineMse},probe:{id:x.probe.id,platform:x.probe.estimate,merchant:x.probe.merchant,launchable:x.probe.launchable}}]))});
}
const agentRows=agent.rows,matched=numeric.rows.filter(r=>CONFIG.agentSeeds.includes(r.seed));
const matchedSummary=['agent','numeric-selector','reward-recommend','organic'].map(method=>({method,platform:pairedEstimate(method==='agent'?agentRows:matched.filter(r=>r.method===method),'deltaUSD')}));
const promotion={status:'NOT_PROMOTED',largeGrowthDemonstrated:false,reasons:['Mean agent platform contribution is below no campaign.','Mean merchant contribution is negative.','Only2 independent fresh-agent seed clusters; do not interpret narrow bootstrap intervals as robust generalization.','The external dataset estimate is uncertain and is not PayPal ROI.']};
const output={protocolHash:p.hash,agentProtocolHash:ap.hash,generatedAt:new Date().toISOString(),config:CONFIG,numeric:numeric.summary,matchedSummary,agentSummary:agent.summary,contrasts,external,cases,promotion,cost:agent.spend,
  counts:{numericHoldoutCases:40,numericIndependentSeeds:8,freshAgentCases:10,freshAgentIndependentSeeds:2,scenarios:5,completedAgentCases:10,revisedCases:cases.filter(c=>c.candidates.B).length,providerCalls:agent.cases.reduce((s,c)=>s+c.modelCalls,0),earlierUnchargedSchemaRejections:10},
  disclosure:'Numerical targeting:40 untouched evaluation markets. Fresh agents:10 of those markets; no extra independent cases are claimed. Delayed returns withheld from this iteration’s development pass, with runtime probes allowed. The simulator, cost equations and original benchmarks are unchanged. Growth is not demonstrated; this candidate is not promoted to the live default.'};
await save('summary.json',output);await mkdir(resolve(ROOT,'demo/data'),{recursive:true});await writeFile(resolve(ROOT,'demo/data/growth-lab.json'),JSON.stringify(output)+'\n');
await save('verification.json',{verifiedAt:output.generatedAt,frozenSimulatorAndAccounting:true,numericCaseCount:40,freshCaseCount:10,allAgentCasesCompleted:true,exactTestedModelsAndPoliciesVerified:true,promoted:false,modelCalls:output.counts.providerCalls,studyUsageEstimateUSD:agent.spend.usd,pending:agent.spend.pending,circuit:agent.spend.circuit,localChecksPassed:6,noNativePayments:true,noAPACChanges:true,sourceProtocolHashes:[p.hash,ap.hash],externalSourceSha256:(await read('external/protocol.json')).datasetSha256,uncertaintyDisplay:'Agent sample has2 clusters: no inferential confidence band displayed.'});
console.log(JSON.stringify({exported:true,counts:output.counts,cost:output.cost,promotion}));
