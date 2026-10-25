import {readFile,mkdir,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {ROOT,readJSON,saveJSON,sha,frozenInputs} from '../research-lab/data.mjs';
import {pairedEstimate} from '../policy-lab/benchmark-stats.mjs';
import {BASE,SCENARIOS} from './development.mjs';
import {runControllers,METHODS} from './runtime.mjs';
import {createPlanner} from './agent.mjs';

const FILES=['policies','evidence','agent','priors','pooled','runtime','benchmark'].map(n=>'scripts/campaign-controller/'+n+'.mjs');
export const codeHashes=async()=>Object.fromEntries(await Promise.all(FILES.map(async path=>[path,sha(await readFile(resolve(ROOT,path)))])));
export async function spend(){const x=await readJSON(resolve(ROOT,'.local/gcp/model-spend.json'));return {suiteUSD:x.entries.filter(e=>e.runId.startsWith('market-CAMP5-')).reduce((n,e)=>n+e.chargedMicros,0)/1e6,lifetimeUSD:x.entries.reduce((n,e)=>n+e.chargedMicros,0)/1e6,pending:x.entries.filter(e=>e.status==='pending').length,circuit:x.circuit};}
export async function selectComparator(){
  const {catalog}=await frozenInputs(),priors=await readJSON(resolve(BASE,'priors.json')),pooled=await readJSON(resolve(BASE,'pooled-model.json')),seeds=Array.from({length:8},(_,i)=>95001+i),rows=[];
  await saveJSON(resolve(BASE,'comparator-protocol.json'),{phase:'DEVELOPMENT_COMPARATOR_SELECTION',seeds,scenarios:SCENARIOS,priorsHash:sha(priors),source:'All methods use the same no-outreach monitor and one-day publication delay. This data selects the primary comparator; it is not held-out evidence.'});
  for(const seed of seeds)for(const scenario of SCENARIOS){const r=await runControllers({id:'DEV-CODE-'+sha({seed,scenario}).slice(0,12),seed,scenario,catalog,priors,pooled,includeLLM:false});const no=r.branches.find(b=>b.method==='organic');for(const b of r.branches)rows.push({...b,deltaUSD:(b.platformProxyCents-no.platformProxyCents)/100});}
  const ranking=['static','riskStatic','contextual','riskContextual','original'].map(method=>({method,...pairedEstimate(rows.filter(r=>r.method===method),'deltaUSD')})).sort((a,b)=>b.mean-a.mean||a.method.localeCompare(b.method));
  const result={phase:'DEVELOPMENT_ONLY',generatedAt:new Date().toISOString(),rows,ranking,primaryComparator:ranking[0].method,priorsHash:sha(priors)};await saveJSON(resolve(BASE,'comparator-result.json'),result);console.log(JSON.stringify({ranking,primaryComparator:result.primaryComparator},null,2));return result;
}
export async function freeze(){
  const file=resolve(BASE,'protocol.json'),code=await codeHashes(),inputs=await frozenInputs(),priors=await readJSON(resolve(BASE,'priors.json')),pooled=await readJSON(resolve(BASE,'pooled-model.json')),selection=await readJSON(resolve(BASE,'comparator-result.json'));
  try{const existing=await readJSON(file);if(sha(existing.code)!==sha(code))throw Error('CAMPAIGN_PROTOCOL_ALREADY_FROZEN');return existing;}catch(e){if(e.code!=='ENOENT')throw e;}
  const p={version:5,createdAt:new Date().toISOString(),code,priorEngineHash:inputs.originalBenchmarkHash,priorV2Hash:inputs.v2ProtocolHash,priorsHash:sha(priors),pooledHash:sha(pooled),comparatorSelectionHash:sha(selection),primaryComparator:selection.primaryComparator,
    validationSeeds:Array.from({length:16},(_,i)=>96001+i),confirmationSeeds:Array.from({length:16},(_,i)=>97001+i),scenarios:SCENARIOS,reviewDays:[30,55,80],methods:METHODS,
    objective:'Paired incremental modeled platform contribution after all inferred model costs, outreach and delayed refund outcomes. This is not actual PayPal profit.',
    fairness:'Same initial seed, catalog, world dynamics, exogenous draws, authority and shared observed monitor packet. All publication occurs one virtual day after each review. Own evaluated-branch and final control outcomes are sealed from every controller. This isolates policy routing on identical evidence; it is not a production closed-loop deployment.',
    baselines:'Best development-selected static and contextual rules, risk-sensitive variants, unchanged original rules, no outreach, and the first LLM choice repeated with only its first model-call cost. Every candidate available to Gemini is available to code.',
    phases:'One fixed 16-seed validation batch followed by one independent 16-seed confirmation only if validation passes. No policy or prompt tuning on these outcomes. A failed version remains failed; a new version needs a new protocol and seeds.',
    gates:{meanGainVsOrganicUSD:.5,lower95VsOrganicUSD:0,meanGainVsPrimaryCodeUSD:.5,lower95VsPrimaryCodeUSD:0,lower95RevisionGainUSD:0,meanMerchantGainVsOrganicUSD:0,hardViolations:0},
    cost:{suiteCapUSD:2,perCaseCapUSD:.25,existingLifetimeCapUSD:8,userTotalCeilingUSD:50,localCompute:'Measured but unpriced; not assumed economically free.',before:await spend()},
    limits:['A positive average does not mean every seed is positive. All losses and failed decisions remain in results.','The objective is the frozen finite-horizon economic proxy, not calibrated PayPal margins.','Shared observations come from an independent no-outreach monitor, not from each treatment branch.','Conditional on the five authored scenarios and the defined policy class.','Authored rules remain labeled rules; fitted local models remain labeled ML.']};p.hash=sha(p);await saveJSON(file,p);console.log(JSON.stringify({hash:p.hash,primary:p.primaryComparator,validationCases:80,confirmationCases:80,cost:p.cost},null,2));return p;
}
export async function runCase({seed,scenario,protocol,phase='validation'}){
  const id='CAMP5-'+phase+'-'+sha({seed,scenario,protocol:protocol.hash}).slice(0,16),directory=resolve(BASE,phase,id),file=resolve(directory,'result.json');
  try{return await readJSON(file);}catch(e){if(e.code!=='ENOENT')throw e;}
  await mkdir(directory,{recursive:true});const {catalog}=await frozenInputs(),priors=await readJSON(resolve(BASE,'priors.json')),pooled=await readJSON(resolve(BASE,'pooled-model.json'));
  const planner=await createPlanner({id,directory:resolve(directory,'requests'),suiteCapUSD:2});let result;
  try{result=await runControllers({id,seed,scenario,catalog,priors,pooled,choose:(packet,step)=>planner.choose(packet,step),record:(day,r)=>saveJSON(resolve(directory,'review-'+day+'.json'),r),restore:async day=>{try{return await readJSON(resolve(directory,'review-'+day+'.json'));}catch(e){if(e.code!=='ENOENT')throw e;return null;}}});}finally{await planner.close();}
  const ledger=await readJSON(resolve(ROOT,'.local/gcp/model-spend.json')),charges=ledger.entries.filter(e=>e.runId==='market-'+id),modelUSD=charges.reduce((n,e)=>n+e.chargedMicros,0)/1e6;
  if(charges.some(e=>e.status==='pending'))throw Error('UNSETTLED_CAMPAIGN_SPEND');
  const firstCost=charges.filter(e=>e.caseId===id+'-review-30').reduce((n,e)=>n+e.chargedMicros,0)/1e6,no=result.branches.find(b=>b.method==='organic'),primary=result.branches.find(b=>b.method===protocol.primaryComparator),first=result.branches.find(b=>b.method==='firstChoice');
  const branches=result.branches.map(b=>{const cost=b.method==='llm'?modelUSD:b.method==='firstChoice'?firstCost:0;return {...b,allocatedModelUSD:cost,deltaPlatformUSD:(b.platformProxyCents-no.platformProxyCents)/100-cost,deltaVsCodeUSD:(b.platformProxyCents-primary.platformProxyCents)/100-cost,deltaVsFirstUSD:(b.platformProxyCents-first.platformProxyCents)/100-cost+firstCost,deltaMerchantUSD:(b.merchantContributionCents-no.merchantContributionCents)/100};});
  const llm=result.runners.llm,trace=llm.actions.filter(a=>a.day>=30&&(a.selected_action!=='none'||a.order_id)).slice(0,40).map(a=>({day:a.day,customerId:a.customer_id,action:a.selected_action,orderId:a.order_id,rewardCents:a.reward_cents}));
  const record={id,phase,seed,scenario,protocolHash:protocol.hash,primaryComparator:protocol.primaryComparator,reviews:result.reviews,branches,trace,costs:{modelUSD,calls:charges.length,firstCallUSD:firstCost},errors:result.reviews.filter(r=>r.error).map(r=>({day:r.cutoff,error:r.error})),revisionCount:result.reviews.slice(1).filter((r,i)=>r.decision?.candidateId!==result.reviews[i].decision?.candidateId).length};
  await saveJSON(file,record);return record;
}
export function summarize(cases,p,phase){
  const rows=cases.flatMap(c=>c.branches),stats=METHODS.map(method=>({method,platform:pairedEstimate(rows.filter(r=>r.method===method),'deltaPlatformUSD'),merchant:pairedEstimate(rows.filter(r=>r.method===method),'deltaMerchantUSD')})),llm=rows.filter(r=>r.method==='llm');
  const primary=pairedEstimate(llm,'deltaVsCodeUSD'),organic=pairedEstimate(llm,'deltaPlatformUSD'),revisions=pairedEstimate(llm,'deltaVsFirstUSD'),merchant=pairedEstimate(llm,'deltaMerchantUSD'),violations=rows.reduce((n,r)=>n+Object.values(r.checks).reduce((s,x)=>s+x,0),0),g=p.gates;
  const gates={positiveModeledValue:organic.mean>=g.meanGainVsOrganicUSD&&organic.low>g.lower95VsOrganicUSD,beatsStrongCode:primary.mean>=g.meanGainVsPrimaryCodeUSD&&primary.low>g.lower95VsPrimaryCodeUSD,revisionsAddValue:revisions.low>g.lower95RevisionGainUSD,merchantNonnegative:merchant.mean>=g.meanMerchantGainVsOrganicUSD,accountingAndAuthority:violations===0};
  return {phase,generatedAt:new Date().toISOString(),protocolHash:p.hash,primaryComparator:p.primaryComparator,cases,stats,primary,organic,revisions,merchant,gates,passed:Object.values(gates).every(Boolean),violations,costs:{modelUSD:cases.reduce((n,c)=>n+c.costs.modelUSD,0),calls:cases.reduce((n,c)=>n+c.costs.calls,0)},decisionChanges:cases.reduce((n,c)=>n+c.revisionCount,0),failedReviews:cases.reduce((n,c)=>n+c.errors.length,0),limits:p.limits};
}
export async function run(phase){
  let p;if(phase==='pilot'){p={code:await codeHashes(),hash:'DEV-'+sha(await codeHashes()).slice(0,16),primaryComparator:(await readJSON(resolve(BASE,'comparator-result.json'))).primaryComparator,gates:{meanGainVsOrganicUSD:.5,lower95VsOrganicUSD:0,meanGainVsPrimaryCodeUSD:.5,lower95VsPrimaryCodeUSD:0,lower95RevisionGainUSD:0,meanMerchantGainVsOrganicUSD:0},limits:['Development pilot; not held-out evidence.']};}
  else{p=await readJSON(resolve(BASE,'protocol.json'));if(sha(await codeHashes())!==sha(p.code))throw Error('FROZEN_CAMPAIGN_CODE_CHANGED');if(phase==='confirmation'&&!(await readJSON(resolve(BASE,'validation-result.json'))).passed)throw Error('VALIDATION_GATE_NOT_MET');}
  const seeds=phase==='pilot'?[95009]:phase==='confirmation'?p.confirmationSeeds:p.validationSeeds,cases=[];
  for(const seed of seeds)for(const scenario of SCENARIOS){const c=await runCase({seed,scenario,protocol:p,phase});cases.push(c);await saveJSON(resolve(BASE,phase+'-progress.json'),{phase,completed:cases.length,total:seeds.length*5,last:c.id,cost:await spend()});console.log(JSON.stringify({case:c.id,progress:cases.length+'/'+seeds.length*5,delta:c.branches.find(b=>b.method==='llm').deltaPlatformUSD,changes:c.revisionCount,errors:c.errors.length}));}
  const out=summarize(cases,p,phase);out.costs={...out.costs,...await spend()};await saveJSON(resolve(BASE,phase+'-result.json'),out);console.log(JSON.stringify({phase,passed:out.passed,gates:out.gates,organic:out.organic,primary:out.primary,revisions:out.revisions,costs:out.costs},null,2));return out;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const mode=process.argv[2];if(mode==='--select-comparator')await selectComparator();else if(mode==='--freeze')await freeze();else if(mode==='--pilot')await run('pilot');else if(mode==='--validate')await run('validation');else if(mode==='--confirm')await run('confirmation');else throw Error('Use --select-comparator, --freeze, --pilot, --validate or --confirm. Paid modes retain all outcomes and enforce the existing spend guards.');}
