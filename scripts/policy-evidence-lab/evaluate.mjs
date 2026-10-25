import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {ROOT,readJSON,saveJSON,sha} from '../research-lab/data.mjs';
import {pairedEstimate} from '../policy-lab/benchmark-stats.mjs';
import {candidateCompilation} from '../campaign-controller/runtime.mjs';
import {rulesPlan} from '../policy-lab/service.mjs';
import {marketEvidence,recordStocks,inferredRegime} from '../campaign-controller/evidence.mjs';
import {BASE,protocol,world,DAYS,CONDITIONS} from './collect.mjs';
import {FEATURE_NAMES,features,predict,choosePolicy} from './features.mjs';

export async function table(){
  const {spec,data}=await protocol(),rows=[],candidateIds=data.priors.candidates.map(c=>c.id);
  for(const seed of spec.trainingSeeds){const records=await readJSON(resolve(BASE,'development',seed+'.json'));assert.equal(records.protocolHash,spec.hash);
    for(const c of records.cases)for(const e of c.observations)rows.push({seed,day:e.asOfDay,x:features(e),platform:candidateIds.map(id=>c.labels.find(r=>r.day===e.asOfDay&&r.candidateId===id).platformDeltaUSD),merchant:candidateIds.map(id=>c.labels.find(r=>r.day===e.asOfDay&&r.candidateId===id).merchantDeltaUSD)});
  }
  const output={phase:'DEVELOPMENT_ONLY',features:FEATURE_NAMES,candidateIds,rows,protocolHash:spec.hash};output.hash=sha(output);await saveJSON(resolve(BASE,'training-table.json'),output);console.log(JSON.stringify({rows:rows.length,features:FEATURE_NAMES.length,candidateCount:candidateIds.length}));
}
export function evaluateCase({seed,scenario,data,fitted}){
  const modelNames=Object.keys(fitted.models['30']),methods=['organic','static','contextual','original',...modelNames],base={seed,scenario,catalog:data.catalog};
  const observer=world({...base,id:'OBS6-'+seed}),runners=Object.fromEntries(methods.map(method=>[method,world({...base,id:'VAL6-'+seed+'-'+method})])),stock=[],reviews=[];let pending;
  while(observer.world.tick<114){
    const day=observer.world.tick;
    if(DAYS.includes(day)){
      const evidence=marketEvidence(observer,stock),x=features(evidence),regime=inferredRegime(evidence),decisions=Object.fromEntries(modelNames.map(name=>[name,choosePolicy(fitted.models[String(day)][name],fitted,x)]));
      const selections={organic:'observe',static:data.priors.rules.static,contextual:data.priors.rules.contextual[regime],...Object.fromEntries(modelNames.map(name=>[name,decisions[name].candidateId]))};
      const compiled=Object.fromEntries(methods.filter(m=>m!=='original').map(m=>[m,candidateCompilation(data.priors.candidates.find(c=>c.id===selections[m]),observer,data.pooled)]));
      compiled.original={plan:{...rulesPlan(observer.evidence()),id:'unchanged_original_rules',duration:25,penalty:0},model:observer.fit(day,42)};
      reviews.push({day,evidenceId:evidence.evidenceId,featureHash:sha(x),decisions,selections});pending={publishDay:day+1,cutoff:day,compiled};
    }
    if(pending&&day===pending.publishDay){for(const method of methods){const c=pending.compiled[method];runners[method].publish(c.plan,c.model,pending.cutoff);}pending=null;}
    observer.step();recordStocks(observer,stock);for(const runner of Object.values(runners))runner.step();
  }
  const scores=methods.map(method=>({method,...runners[method].result(method)})),control=scores[0];
  return {seed,scenario,reviews,branches:scores.map(({daily,fits,...score})=>({...score,deltaPlatformUSD:(score.platformProxyCents-control.platformProxyCents)/100,deltaMerchantUSD:(score.merchantContributionCents-control.merchantContributionCents)/100}))};
}
export async function evaluate(){
  const {spec,data}=await protocol(),fitted=await readJSON(resolve(BASE,'value-models.json'));
  for(const row of fitted.parity){const actual=predict(fitted.models[String(row.day)][row.model],row.x);assert.ok(actual.every((x,i)=>Math.abs(x-row.expected[i])<1e-8),'Python / JS value-model parity');}
  const p={phase:'DEVELOPMENT_VALIDATION_ONLY',collectionProtocolHash:spec.hash,modelHash:sha(fitted),featureCodeHash:sha(await readFile(resolve(ROOT,'scripts/policy-evidence-lab/features.mjs'))),evaluationCodeHash:sha(await readFile(import.meta.filename)),seeds:spec.developmentValidationSeeds,scenarios:CONDITIONS,
    fairness:'Same shared monitor, candidate authority, publication delay, seeds and frozen world. Every code selector sees the same observations. No LLM is evaluated in this stage.',
    limits:'Development evidence used to select the next controller; not final LLM superiority or confirmation. Single-intervention labels do not establish additive sequence value.'};p.hash=sha(p);
  const path=resolve(BASE,'development-validation-protocol.json');try{assert.deepEqual(await readJSON(path),p);}catch(e){if(e.code!=='ENOENT')throw e;await saveJSON(path,p);}
  const cases=[];for(const seed of p.seeds){
    const file=resolve(BASE,'development-validation',seed+'.json');let record;
    try{record=await readJSON(file);assert.equal(record.protocolHash,p.hash);}catch(e){if(e.code!=='ENOENT')throw e;record={protocolHash:p.hash,cases:CONDITIONS.map(scenario=>evaluateCase({seed,scenario,data,fitted}))};await saveJSON(file,record);}
    cases.push(...record.cases);console.log(JSON.stringify({completedSeeds:cases.length/5,totalSeeds:p.seeds.length}));
  }
  const rows=cases.flatMap(c=>c.branches),names=cases[0].branches.map(b=>b.method),stats=names.map(method=>({method,platform:pairedEstimate(rows.filter(r=>r.method===method),'deltaPlatformUSD'),merchant:pairedEstimate(rows.filter(r=>r.method===method),'deltaMerchantUSD')}));
  const violations=rows.reduce((n,r)=>n+Object.values(r.checks).reduce((s,v)=>s+v,0),0),out={phase:p.phase,protocolHash:p.hash,cases,stats,violations,cloudCalls:0,parityChecks:fitted.parity.length};await saveJSON(resolve(BASE,'development-validation-result.json'),out);console.log(JSON.stringify({stats,violations,cloudCalls:0},null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){if(process.argv[2]==='--table')await table();else if(process.argv[2]==='--evaluate')await evaluate();else throw Error('Use --table or --evaluate');}
