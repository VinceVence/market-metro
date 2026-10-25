import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {ROOT,readJSON,saveJSON,sha} from '../research-lab/data.mjs';
import {pairedEstimate} from '../policy-lab/benchmark-stats.mjs';
import {BASE,rollout} from './collect.mjs';
import {sequenceProtocol,trajectory} from './sequences.mjs';
import {evaluateCase} from './evaluate.mjs';
import {predictQComponent,qValues,chooseQ} from './q-policy.mjs';

const {spec,data}=await sequenceProtocol(),q=await readJSON(resolve(BASE,'q-models.json')),value=await readJSON(resolve(BASE,'value-models.json'));
for(const p of q.parity){const actual=predictQComponent(q.models[p.variant].stages[String(p.stage)][p.component],p.x);assert.ok(Math.abs(actual-p.expected)<1e-8,'Python / JS Q prediction parity');}
const p={phase:'SEQUENTIAL_DEVELOPMENT_VALIDATION_ONLY',sequenceProtocolHash:spec.hash,qModelHash:sha(q),valueModelHash:sha(value),
  qPolicyCodeHash:sha(await readFile(resolve(ROOT,'scripts/policy-evidence-lab/q-policy.mjs'))),evaluationCodeHash:sha(await readFile(import.meta.filename)),
  seeds:spec.developmentValidationSeeds,scenarios:spec.conditions,methods:['organic','static','contextual','original','constant','ridge_1','ridge_10','ridge_100','trees_leaf8','trees_leaf20',...Object.keys(q.models)],
  primarySequentialContrast:'fqi_trees64 minus myopic_trees64: same sequence training data, model class, constraints and observed-history interface; only the Bellman continuation differs.',
  fairness:'Identical no-outreach observation stream at days 30/55/80, same initial seeds, shocks, authority and publication delay. Q policies may remember their own past choices. Treatment-branch outcomes remain sealed. Legacy/single-intervention learners remain reference controls; myopic Q shares the new training data.',
  limits:['All seeds here are development. Selecting a winner does not establish final economic or LLM superiority.','No LLM, PayPal API, paid cloud compute or fresh Channel3 query in this experiment.','Partial-observation policy history is not a fully observed economic state.','All gains are finite-horizon modeled contribution, not actual PayPal profit.']};p.hash=sha(p);
const path=resolve(BASE,'q-validation-protocol.json');try{assert.deepEqual(await readJSON(path),p);}catch(e){if(e.code!=='ENOENT')throw e;await saveJSON(path,p);}
const cases=[];
for(const seed of p.seeds){
  const file=resolve(BASE,'q-validation',seed+'.json');let record;
  try{record=await readJSON(file);assert.equal(record.protocolHash,p.hash);}catch(e){
    if(e.code!=='ENOENT')throw e;const rows=[];
    for(const scenario of p.scenarios){
      const legacy=evaluateCase({seed,scenario,data,fitted:value}),control=legacy.branches.find(b=>b.method==='organic');
      const observed=rollout({id:'QOBS6-'+seed,seed,scenario,catalog:data.catalog,pooled:data.pooled,observe:true});
      assert.equal(observed.score.platformProxyCents,control.platformProxyCents);
      observed.observations.forEach((e,i)=>assert.equal(e.evidenceId,legacy.reviews[i].evidenceId));
      const branches=[...legacy.branches],decisions={};
      for(const [name,model] of Object.entries(q.models)){
        const choices=[];
        const run=trajectory({id:'QVAL6-'+seed+'-'+name,seed,scenario,data,observations:observed.observations,choose:({stage,state,pastActions})=>{
          const values=qValues(model,stage,state,q.candidateIds.length),action=chooseQ(values);choices.push({stage,day:spec.reviewDays[stage],evidenceId:observed.observations[stage].evidenceId,pastActions,action,candidateId:q.candidateIds[action],values});return action;
        }});
        const {daily,fits,...score}=run.score;branches.push({method:name,...score,deltaPlatformUSD:(score.platformProxyCents-control.platformProxyCents)/100,deltaMerchantUSD:(score.merchantContributionCents-control.merchantContributionCents)/100});decisions[name]=choices;
      }
      rows.push({seed,scenario,branches,decisions,sharedEvidenceIds:observed.observations.map(e=>e.evidenceId)});
    }
    record={protocolHash:p.hash,cases:rows};await saveJSON(file,record);
  }
  cases.push(...record.cases);console.log(JSON.stringify({completedSeeds:cases.length/5,totalSeeds:p.seeds.length}));
}
const rows=cases.flatMap(c=>c.branches),stats=p.methods.map(method=>({method,platform:pairedEstimate(rows.filter(r=>r.method===method),'deltaPlatformUSD'),merchant:pairedEstimate(rows.filter(r=>r.method===method),'deltaMerchantUSD')}));
const contrast=(a,b)=>pairedEstimate(cases.map(c=>({seed:c.seed,scenario:c.scenario,delta:c.branches.find(x=>x.method===a).deltaPlatformUSD-c.branches.find(x=>x.method===b).deltaPlatformUSD})),'delta');
const result={phase:p.phase,protocolHash:p.hash,cases,stats,contrasts:{sequentialVsMyopic:contrast('fqi_trees64','myopic_trees64'),historyVsNoHistory:contrast('fqi_trees64','fqi_no_history')},
  violations:rows.reduce((n,r)=>n+Object.values(r.checks).reduce((s,x)=>s+x,0),0),cloudCalls:0,parityChecks:q.parity.length,limits:p.limits};
await saveJSON(resolve(BASE,'q-validation-result.json'),result);console.log(JSON.stringify({stats,contrasts:result.contrasts,violations:result.violations,cloudCalls:0},null,2));
