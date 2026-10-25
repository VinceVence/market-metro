// Supplementary diagnostic: continue shopping after the original campaign window.
// The frozen 100-day results stay unchanged. Both policies get the same extension.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {ROOT,readJSON,saveJSON,sha} from '../research-lab/data.mjs';
import {createFreshWorld} from '../policy-lab/fresh-world.mjs';
import {pairedEstimate} from '../policy-lab/benchmark-stats.mjs';
import {candidateCompilation} from '../campaign-controller/runtime.mjs';
import {inferredRegime} from '../campaign-controller/evidence.mjs';
import {BASE,rollout,DAYS} from './collect.mjs';
import {sequenceProtocol,stateVector} from './sequences.mjs';
import {features,choosePolicy} from './features.mjs';
import {qValues,chooseQ} from './q-policy.mjs';

const {spec,data}=await sequenceProtocol(),q=await readJSON(resolve(BASE,'q-models.json')),values=await readJSON(resolve(BASE,'value-models.json'));
const p={phase:'DEVELOPMENT_HORIZON_SENSITIVITY_ONLY',codeHash:sha(await readFile(import.meta.filename)),sequenceProtocolHash:spec.hash,qModelHash:sha(q),valueModelHash:sha(values),
  seeds:Array.from({length:32},(_,i)=>103001+i),scenarios:spec.conditions,horizons:[100,200],campaignReviewDays:DAYS,
  methods:['organic','static','contextual','constant','myopic_trees64','fqi_trees64'],
  purpose:'Check whether apparent 100-day gains are merely purchases brought forward from later days.',
  scope:'Same frozen engine, catalog, costs, 14-day refund observation tail and seed/shock draws. Only the follow-up shopping duration differs. Actions are chosen from observed data at the original review dates and are identical across both horizons. No campaign continues after day 100.',
  limits:['This supplementary sensitivity does not replace or rewrite any original 100-day benchmark.','Development diagnostic only; not final confirmation, LLM superiority or actual PayPal profit.','The policy was fitted for 100 days and is not retrained or re-optimized for the longer follow-up.']};p.hash=sha(p);
const file=resolve(BASE,'horizon-protocol.json');try{assert.deepEqual(await readJSON(file),p);}catch(e){if(e.code!=='ENOENT')throw e;await saveJSON(file,p);}
const rows=[];
for(const seed of p.seeds){
  const path=resolve(BASE,'horizon',seed+'.json');let record;
  try{record=await readJSON(path);assert.equal(record.protocolHash,p.hash);}catch(e){
    if(e.code!=='ENOENT')throw e;const cases=[];
    for(const scenario of p.scenarios){
      const observations=rollout({id:'HOBS6-'+seed,seed,scenario,catalog:data.catalog,pooled:data.pooled,observe:true}).observations;
      const index=id=>q.candidateIds.indexOf(id),sequences={organic:[0,0,0],static:Array(3).fill(index(data.priors.rules.static)),
        contextual:observations.map(e=>index(data.priors.rules.contextual[inferredRegime(e)])),constant:observations.map(e=>index(choosePolicy(values.models[String(e.asOfDay)].constant,values,features(e)).candidateId))};
      for(const method of ['myopic_trees64','fqi_trees64']){const history=[];for(let stage=0;stage<3;stage++)history.push(chooseQ(qValues(q.models[method],stage,stateVector(observations[stage],history,q.candidateIds.length),q.candidateIds.length)));sequences[method]=history;}
      const scores=[];const prefix=new Map();
      for(const horizon of p.horizons)for(const method of p.methods){
        const runner=createFreshWorld({id:'HORIZON6-'+seed+'-'+method+'-'+horizon,seed,scenario,catalog:data.catalog,settings:{customerCount:100,days:horizon,budgetCents:30000},startedAt:'2026-10-25T00:00:00.000Z'});let pending;
        while(runner.world.tick<horizon+14){const day=runner.world.tick,stage=DAYS.indexOf(day);
          if(stage!==-1)pending={...candidateCompilation(data.priors.candidates[sequences[method][stage]],runner,data.pooled),day:day+1,cutoff:day};
          if(pending&&day===pending.day){runner.publish(pending.plan,pending.model,pending.cutoff);pending=null;}runner.step();
        }
        assert.ok(runner.actions.filter(a=>a.day>=100).every(a=>a.selected_action==='none'),'No extra campaign after original window');
        const first=runner.actions.filter(a=>a.day>=30&&a.day<100).reduce((n,a)=>n+a.reward_cents,0);
        if(horizon===100)prefix.set(method,first);else assert.equal(first,prefix.get(method),'The first 100-day financial history must be identical');
        const {daily,fits,...score}=runner.result(method);scores.push({method,horizon,...score});
      }
      cases.push({seed,scenario,sequences,rows:scores.map(s=>{const control=scores.find(c=>c.method==='organic'&&c.horizon===s.horizon);return {...s,deltaPlatformUSD:(s.platformProxyCents-control.platformProxyCents)/100,deltaMerchantUSD:(s.merchantContributionCents-control.merchantContributionCents)/100};})});
    }
    record={protocolHash:p.hash,cases};await saveJSON(path,record);
  }
  rows.push(...record.cases.flatMap(c=>c.rows));console.log(JSON.stringify({completedSeeds:seed-p.seeds[0]+1,totalSeeds:p.seeds.length}));
}
const stats=p.horizons.flatMap(horizon=>p.methods.map(method=>({method,horizon,platform:pairedEstimate(rows.filter(r=>r.method===method&&r.horizon===horizon),'deltaPlatformUSD'),merchant:pairedEstimate(rows.filter(r=>r.method===method&&r.horizon===horizon),'deltaMerchantUSD')})));
const out={phase:p.phase,protocolHash:p.hash,stats,rows,violations:rows.reduce((n,r)=>n+Object.values(r.checks).reduce((s,x)=>s+x,0),0),cloudCalls:0,limits:p.limits};await saveJSON(resolve(BASE,'horizon-result.json'),out);console.log(JSON.stringify({stats,violations:out.violations,cloudCalls:0},null,2));
