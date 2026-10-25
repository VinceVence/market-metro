import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {ROOT,frozenInputs,saveJSON,readJSON,sha} from '../research-lab/data.mjs';
import {createFreshWorld} from '../policy-lab/fresh-world.mjs';
import {ACTIONS} from '../policy-lab/economy.mjs';
import {trainBandit} from '../policy-lab/learner.mjs';
import {pairedEstimate} from '../policy-lab/benchmark-stats.mjs';
import {compileCampaign} from './policies.mjs';
import {BASE,SCENARIOS} from './development.mjs';

// Pool only pre-shock randomized histories from independent DEVELOPMENT markets.
// Contact-ineligible controls are excluded to improve treatment/control support.
export async function fitPooled(){
  const {catalog}=await frozenInputs(),rows=[],seeds=Array.from({length:64},(_,i)=>94001+i);
  for(const seed of seeds){const w=createFreshWorld({id:'POOL-'+seed,seed,scenario:'steady',settings:{customerCount:100,days:100,budgetCents:30000},catalog,startedAt:'2026-10-25T00:00:00.000Z'});while(w.world.tick<30)w.step();for(const a of w.actions)if(a.matures_day<=30&&a.reward_cents!==null&&JSON.parse(a.eligible_json).length>1)rows.push(a);}
  const artifact=trainBandit(rows,{cutoffDay:30,windowDays:42,actions:ACTIONS});for(const arm of Object.values(artifact.arms))arm.inverse=Array.from({length:7},()=>Array(7).fill(0));
  artifact.type='pooled_randomized_common_support_ridge';artifact.disclosure='Fitted on mature, contact-eligible pre-shock randomized DEVELOPMENT observations. Seven original features; prediction error is not causal policy lift.';
  const result={createdAt:new Date().toISOString(),trainingSeeds:seeds,rows:rows.length,datasetHash:sha(rows.map(r=>[r.action_id,r.context_json,r.selected_action,r.reward_cents,r.propensity])),artifact,sourceCodeHash:sha(await readFile(resolve(ROOT,'scripts/policy-lab/learner.mjs')))};await saveJSON(resolve(BASE,'pooled-model.json'),result);return result;
}
export function runPooledChoice({id,seed,scenario,catalog,choice,pooled}){
  const w=createFreshWorld({id,seed,scenario,settings:{customerCount:100,days:100,budgetCents:30000},catalog,startedAt:'2026-10-25T00:00:00.000Z'});let pending;
  while(w.world.tick<114){if([30,55,80].includes(w.world.tick)){
    const compiled=choice.recipeId==='pooled_support'?{plan:{id:'pooled_support',strategy:'recommendations',audience:'all',merchantIndices:choice.merchantIndices,maxOfferPct:0,duration:choice.durationDays,penalty:choice.penalty,epsilon:0,windowDays:42},model:pooled.artifact}:compileCampaign(choice,w);pending={...compiled,cutoff:w.world.tick,day:w.world.tick+1};
  }if(pending&&pending.day===w.world.tick){w.publish(pending.plan,pending.model,pending.cutoff);pending=null;}w.step();}return w.result(choice.recipeId);
}
export async function precisionAudit(){
  const {catalog}=await frozenInputs(),pooled=await fitPooled();
  const seeds=Array.from({length:32},(_,i)=>93001+i),choices=[
    {recipeId:'recent_value',merchantIndices:[0,1,2],durationDays:14},
    {recipeId:'premium_alternative',merchantIndices:[1,2],durationDays:7},
    {recipeId:'premium_alternative',merchantIndices:[1,2],durationDays:3},
    {recipeId:'active_premium',merchantIndices:[0,1,2],durationDays:7},
    ...[0,.02,.05].flatMap(penalty=>[[0,1,2],[0,2],[1,2]].map(merchantIndices=>({recipeId:'pooled_support',merchantIndices,durationDays:7,penalty})))
  ];
  const protocol={phase:'DEVELOPMENT_PRECISION_AUDIT',createdAt:new Date().toISOString(),seeds,scenarios:SCENARIOS,choices,pooledHash:sha(pooled),scope:'One fixed 32-seed batch to investigate whether the earlier selected gains generalize. All these data are development, never final LLM evidence.'};await saveJSON(resolve(BASE,'precision-protocol.json'),protocol);
  const rows=[];for(const seed of seeds)for(const scenario of SCENARIOS){const args={id:'PRECISION-'+seed,seed,scenario,catalog,pooled},no=runPooledChoice({...args,choice:{recipeId:'observe',merchantIndices:[],durationDays:3}});
    for(const choice of choices){const r=runPooledChoice({...args,choice});rows.push({seed,scenario,choiceId:sha(choice).slice(0,14),choice,deltaUSD:(r.platformProxyCents-no.platformProxyCents)/100,merchantDeltaUSD:(r.merchantContributionCents-no.merchantContributionCents)/100,recommendations:r.recommendations,violations:Object.values(r.checks).reduce((n,x)=>n+x,0)});}
    if(scenario===SCENARIOS.at(-1))console.log(JSON.stringify({seed,completedSeeds:seed-seeds[0]+1,totalSeeds:seeds.length}));
  }
  const ranking=choices.map(choice=>{const rs=rows.filter(r=>r.choiceId===sha(choice).slice(0,14));return {choice,...pairedEstimate(rs,'deltaUSD'),merchant:pairedEstimate(rs,'merchantDeltaUSD'),recommendations:rs.reduce((n,r)=>n+r.recommendations,0)/rs.length};}).sort((a,b)=>b.mean-a.mean);
  const out={generatedAt:new Date().toISOString(),protocolHash:sha(protocol),ranking,violations:rows.reduce((n,r)=>n+r.violations,0),cases:seeds.length*SCENARIOS.length,rollouts:seeds.length*SCENARIOS.length*(choices.length+1),limits:'Development search and confirmation of policy headroom only. Selecting the best result is still optimistic and does not establish LLM value.'};await saveJSON(resolve(BASE,'precision-rows.json'),rows);await saveJSON(resolve(BASE,'precision-result.json'),out);console.log(JSON.stringify({modelRows:pooled.rows,ranking,violations:out.violations},null,2));return out;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await precisionAudit();
