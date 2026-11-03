// Predeclared development audit of competent, inexpensive campaign controls.
// No agent, RL training, provider call or change to the frozen environment.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {ROOT,frozenInputs,readJSON,saveJSON,sha} from '../research-lab/data.mjs';
import {createFreshWorld} from '../policy-lab/fresh-world.mjs';
import {ACTIONS} from '../policy-lab/economy.mjs';
import {rulesPlan} from '../policy-lab/service.mjs';
import {pairedEstimate} from '../policy-lab/benchmark-stats.mjs';
import {assertFrozen} from '../campaign-controller/benchmark.mjs';

const BASE=resolve(ROOT,'docs/agent-mesh/control-audit');
await assertFrozen(await readJSON(resolve(ROOT,'docs/policy-lab/benchmarks/v5/protocol.json')));
const {catalog,originalBenchmarkHash}=await frozenInputs();
const choices=[{id:'organic',audience:'all',merchants:[]},{id:'original_rules'},
  ...['all','lapsed'].flatMap(audience=>[[0],[1],[2],[0,2]].map(merchants=>({id:audience+'_recommend_'+merchants.join('_'),audience,merchants})))];
const protocol={phase:'DEVELOPMENT_CONTROL_AUDIT_ONLY',codeHash:sha(await readFile(import.meta.filename)),engineHash:originalBenchmarkHash,
  seeds:Array.from({length:16},(_,i)=>105001+i),scenarios:['steady','rival_sale','budget_squeeze','supply_delay','returns_wave'],horizons:[100,200],choices,
  authority:'Recommendation controls have no discounts, seven-day campaigns at the same one-day publication delay after reviews at30/55/80, and the existing budget, contact, stock and margin constraints. Original rules remain an unchanged reference during the original campaign window. All outreach ends by day100 in the extended follow-up.',
  purpose:'Check whether a stronger ordinary reactivation control has durable value before buying more LLM experiments. Candidate choice is a development selection, never held-out agent evidence.',
  costs:'No provider calls. Local compute is unpriced.'};protocol.hash=sha(protocol);
try{assert.deepEqual(await readJSON(resolve(BASE,'protocol.json')),protocol);}catch(e){if(e.code!=='ENOENT')throw e;await saveJSON(resolve(BASE,'protocol.json'),protocol);}
const ruleArtifact={type:'authored_cohort_recommendation_rule',arms:Object.fromEntries(ACTIONS.map(action=>[action,{count:0,coef:[action.startsWith('recommend:')?1:action==='none'?0:-100,0,0,0,0,0,0],inverse:Array.from({length:7},()=>Array(7).fill(0))}])),disclosure:'A simple fixed recommendation rule, not a fitted model.'};
const rows=[];
for(const seed of protocol.seeds){
  const path=resolve(BASE,seed+'.json');let record;
  try{record=await readJSON(path);assert.equal(record.protocolHash,protocol.hash);}catch(e){
    if(e.code!=='ENOENT')throw e;const records=[];
    for(const scenario of protocol.scenarios)for(const horizon of protocol.horizons){
      const scores=[];for(const choice of choices){
        const w=createFreshWorld({id:'CONTROL7-'+seed+'-'+choice.id,seed,scenario,catalog,settings:{customerCount:100,days:horizon,budgetCents:30000},startedAt:'2026-10-25T00:00:00.000Z'});let pending;
        while(w.world.tick<horizon+14){const day=w.world.tick;
          if([30,55,80].includes(day)){
            if(choice.id==='original_rules'){const plan={...rulesPlan(w.evidence()),id:'original_rules',duration:25,penalty:0};w.publish(plan,w.fit(day,42),day);}
            else pending={day:day+1,cutoff:day,plan:{id:choice.id,strategy:choice.merchants.length?'recommendations':'observe',audience:choice.audience,merchantIndices:choice.merchants,maxOfferPct:0,duration:7,penalty:0,epsilon:0,windowDays:42},model:choice.merchants.length?ruleArtifact:null};
          }
          if(day===100)w.publish({id:'campaign_window_closed',strategy:'observe',audience:'all',merchantIndices:[],maxOfferPct:0,duration:1,epsilon:0},null,day);
          if(pending&&day===pending.day){w.publish(pending.plan,pending.model,pending.cutoff);pending=null;}w.step();
        }
        assert.ok(w.actions.filter(a=>a.day>=100).every(a=>a.selected_action==='none'));
        const {daily,fits,publications,...score}=w.result(choice.id);scores.push({method:choice.id,horizon,...score});
      }
      const control=scores[0];records.push(...scores.map(r=>({...r,deltaPlatformUSD:(r.platformProxyCents-control.platformProxyCents)/100,deltaMerchantUSD:(r.merchantContributionCents-control.merchantContributionCents)/100})));
    }
    record={protocolHash:protocol.hash,rows:records};await saveJSON(path,record);
  }
  rows.push(...record.rows);console.log(JSON.stringify({completedSeeds:seed-protocol.seeds[0]+1,totalSeeds:protocol.seeds.length}));
}
const stats=protocol.horizons.flatMap(horizon=>choices.map(c=>({method:c.id,horizon,platform:pairedEstimate(rows.filter(r=>r.horizon===horizon&&r.method===c.id),'deltaPlatformUSD'),merchant:pairedEstimate(rows.filter(r=>r.horizon===horizon&&r.method===c.id),'deltaMerchantUSD')})));
const out={phase:protocol.phase,protocolHash:protocol.hash,rows,stats,cloudCalls:0,violations:rows.reduce((n,r)=>n+Object.values(r.checks).reduce((s,x)=>s+x,0),0)};await saveJSON(resolve(BASE,'result.json'),out);console.log(JSON.stringify({stats,violations:out.violations,cloudCalls:0},null,2));
