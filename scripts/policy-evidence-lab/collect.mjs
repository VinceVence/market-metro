// Development labels for timed campaign decisions. No LLM or provider calls.
// Future counterfactual labels are allowed only in these development markets;
// they must never be exposed for a held-out market at planning time.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {ROOT,readJSON,saveJSON,sha,frozenInputs} from '../research-lab/data.mjs';
import {createFreshWorld} from '../policy-lab/fresh-world.mjs';
import {candidateCompilation} from '../campaign-controller/runtime.mjs';
import {marketEvidence,recordStocks} from '../campaign-controller/evidence.mjs';
import {pairedEstimate} from '../policy-lab/benchmark-stats.mjs';
import {assertFrozen} from '../campaign-controller/benchmark.mjs';

export const BASE=resolve(ROOT,'docs/policy-lab/benchmarks/v6');
export const CONDITIONS=['steady','rival_sale','budget_squeeze','supply_delay','returns_wave'];
export const DAYS=[30,55,80];
const oldBase=resolve(ROOT,'docs/policy-lab/benchmarks/v5');
const inputs=async()=>({...(await frozenInputs()),priors:await readJSON(resolve(oldBase,'priors.json')),pooled:await readJSON(resolve(oldBase,'pooled-model.json'))});
export async function protocol(){
  await assertFrozen(await readJSON(resolve(oldBase,'protocol.json')));
  const code=sha(await readFile(import.meta.filename)),data=await inputs(),file=resolve(BASE,'development-protocol.json');
  const spec={version:6,phase:'DEVELOPMENT_ONLY',code,engineHash:data.originalBenchmarkHash,priorV2Hash:data.v2ProtocolHash,priorsHash:sha(data.priors),pooledHash:sha(data.pooled),
    trainingSeeds:Array.from({length:32},(_,i)=>100001+i),developmentValidationSeeds:Array.from({length:16},(_,i)=>101001+i),conditions:CONDITIONS,reviewDays:DAYS,
    purpose:'Learn decision-specific expected long-horizon value from past simulated interventions; compare against constant-per-day and original development-prior selectors before considering another paid LLM trial.',
    labels:'For each observed cutoff, execute exactly one candidate campaign one day later, then observe until day 114. Label is its final modeled contribution difference versus the same-seed no-outreach world. No other campaign is published.',
    observations:'Only common-monitor data at the cutoff. Current scenario, private shopper traits, current-world future and evaluator scores are not prediction features.',
    costs:'Local CPU only; no LLM, new catalog request, native PayPal payment or cloud job.',
    limits:['Single-intervention effects are not additive across a sequence; validate the complete deployed sequence separately.','Future-informed greedy choices are diagnostic only and are forbidden as deployable decisions or LLM evidence.','All data in this protocol are development; none prove final LLM advantage.','The frozen v5 validation is closed and cannot be used to fit or select this model. V5 confirmation seeds remain unopened.']};
  spec.hash=sha(spec);
  try{const previous=await readJSON(file);if(previous.hash!==spec.hash)throw Error('DEVELOPMENT_PROTOCOL_CHANGED');return {spec:previous,data};}catch(e){if(e.code!=='ENOENT')throw e;}
  await saveJSON(file,spec);return {spec,data};
}

export function world({id,seed,scenario,catalog}){
  return createFreshWorld({id,seed,scenario,catalog,settings:{customerCount:100,days:100,budgetCents:30000},startedAt:'2026-10-25T00:00:00.000Z'});
}
export function rollout({id,seed,scenario,catalog,pooled,schedule=[],observe=false}){
  const w=world({id,seed,scenario,catalog}),stocks=[],observations=[];let pending;
  while(w.world.tick<114){
    const day=w.world.tick;
    if(observe&&DAYS.includes(day))observations.push(marketEvidence(w,stocks));
    const action=schedule.find(s=>s.day===day);
    if(action)pending={...candidateCompilation(action.candidate,w,pooled),cutoff:day,publishDay:day+1};
    if(pending&&day===pending.publishDay){w.publish(pending.plan,pending.model,pending.cutoff);pending=null;}
    w.step();if(observe)recordStocks(w,stocks);
  }
  return {score:w.result('decision_specific'),observations};
}
export function collectCase({seed,scenario,data,protocolHash}){
  const id='EVID6-'+seed+'-'+scenario,base={id,seed,scenario,catalog:data.catalog,pooled:data.pooled};
  const control=rollout({...base,observe:true}),labels=[];let rollouts=1;
  for(const day of DAYS)for(const candidate of data.priors.candidates){
    const result=candidate.id==='observe'?control:rollout({...base,schedule:[{day,candidate}]});rollouts+=Number(candidate.id!=='observe');
    labels.push({day,candidateId:candidate.id,platformDeltaUSD:(result.score.platformProxyCents-control.score.platformProxyCents)/100,
      merchantDeltaUSD:(result.score.merchantContributionCents-control.score.merchantContributionCents)/100,
      purchaseDelta:result.score.purchases-control.score.purchases,recommendations:result.score.recommendations,checks:result.score.checks});
  }
  const schedule=DAYS.map(day=>({day,candidate:data.priors.candidates.find(c=>c.id===labels.filter(r=>r.day===day).sort((a,b)=>b.platformDeltaUSD-a.platformDeltaUSD||a.candidateId.localeCompare(b.candidateId))[0].candidateId)}));
  const diagnostic=rollout({...base,schedule});rollouts++;
  return {id,seed,scenario,protocolHash,observations:control.observations,labels,rollouts,
    diagnostic:{kind:'FUTURE_INFORMED_GREEDY_NOT_DEPLOYABLE',choices:schedule.map(s=>({day:s.day,candidateId:s.candidate.id})),platformDeltaUSD:(diagnostic.score.platformProxyCents-control.score.platformProxyCents)/100,merchantDeltaUSD:(diagnostic.score.merchantContributionCents-control.score.merchantContributionCents)/100,checks:diagnostic.score.checks,
      limit:'Uses future outcomes in development to diagnose opportunity. It is not a valid controller or a rigorous upper bound on all policy sequences.'}};
}
export async function collect({limit=32}={}){
  if(!Number.isInteger(limit)||limit<1||limit>32)throw Error('DEVELOPMENT_LIMIT_MUST_BE_1_TO_32');
  const {spec,data}=await protocol(),cases=[];
  for(const seed of spec.trainingSeeds.slice(0,limit)){
    const path=resolve(BASE,'development',seed+'.json');let records;
    try{records=await readJSON(path);if(records.protocolHash!==spec.hash)throw Error('CASE_PROTOCOL_CHANGED');}catch(e){if(e.code!=='ENOENT')throw e;records={protocolHash:spec.hash,seed,cases:CONDITIONS.map(scenario=>collectCase({seed,scenario,data,protocolHash:spec.hash}))};await saveJSON(path,records);}
    cases.push(...records.cases);const progress={phase:'DEVELOPMENT_ONLY',completedSeeds:cases.length/5,totalSeeds:spec.trainingSeeds.length,rollouts:cases.reduce((n,c)=>n+c.rollouts,0),protocolHash:spec.hash};await saveJSON(resolve(BASE,'development-progress.json'),progress);console.log(JSON.stringify(progress));
  }
  if(cases.length!==spec.trainingSeeds.length*5)return;
  const rows=cases.map(c=>({seed:c.seed,scenario:c.scenario,delta:c.diagnostic.platformDeltaUSD}));
  const byDay=DAYS.map(day=>({day,candidates:data.priors.candidates.map(candidate=>({id:candidate.id,...pairedEstimate(cases.map(c=>({seed:c.seed,scenario:c.scenario,delta:c.labels.find(r=>r.day===day&&r.candidateId===candidate.id).platformDeltaUSD})),'delta')}))}));
  const out={phase:'DEVELOPMENT_ONLY',protocolHash:spec.hash,cases:cases.length,rollouts:cases.reduce((n,c)=>n+c.rollouts,0),byDay,
    futureInformedDiagnostic:pairedEstimate(rows,'delta'),violations:cases.reduce((n,c)=>n+c.labels.reduce((m,r)=>m+Object.values(r.checks).reduce((s,v)=>s+v,0),0)+Object.values(c.diagnostic.checks).reduce((s,v)=>s+v,0),0),limits:spec.limits};
  await saveJSON(resolve(BASE,'development-summary.json'),out);console.log(JSON.stringify({phase:out.phase,cases:out.cases,rollouts:out.rollouts,violations:out.violations,diagnostic:out.futureInformedDiagnostic},null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await collect({limit:process.argv[2]?Number(process.argv[2]):32});
