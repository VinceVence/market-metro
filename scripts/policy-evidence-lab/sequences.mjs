// Fixed offline exploration trajectories. No changes to the simulator, no API calls.
import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {ROOT,readJSON,saveJSON,sha} from '../research-lab/data.mjs';
import {candidateCompilation} from '../campaign-controller/runtime.mjs';
import {BASE,protocol,world,DAYS,CONDITIONS,rollout} from './collect.mjs';
import {features,FEATURE_NAMES} from './features.mjs';
import {draw} from '../marketing/economy.mjs';

export function stateVector(observation,pastActions,candidateCount){
  if(pastActions.length>2||pastActions.some(a=>!Number.isInteger(a)||a<0||a>=candidateCount))throw Error('INVALID_ACTION_HISTORY');
  return [...features(observation),...[0,1].flatMap(step=>Array.from({length:candidateCount},(_,a)=>Number(pastActions[step]===a)))];
}
export function explorationSchedules(seed,scenario,count){
  const offsets=[1,2].map(i=>1+Math.floor(draw(seed,'sequence-offset',scenario,i)*(count-1)));
  return [...Array.from({length:count},(_,i)=>[i,i,i]),...Array.from({length:count},(_,i)=>[i,(i+offsets[0])%count,(i+offsets[1])%count])];
}
function periodValues(runner){
  const boundaries=[30,55,80,100],out=[];
  for(let i=0;i<3;i++){
    const rows=runner.actions.filter(a=>a.day>=boundaries[i]&&a.day<boundaries[i+1]);
    if(rows.some(a=>a.reward_cents===null))throw Error('IMMATURE_SEQUENCE_REWARD');
    out.push({platformCents:rows.reduce((n,a)=>n+a.reward_cents,0),merchantCents:rows.reduce((n,a)=>{const o=runner.orders.get(a.order_id);return n+a.platform_support_cents+(o?o.total_cents-o.refund-o.fee+(o.refund?o.fee:0)-o.cost_cents-o.delivery_cost_cents:0);},0)});
  }
  return out;
}
export function trajectory({id,seed,scenario,data,observations,actions,choose}){
  const runner=world({id,seed,scenario,catalog:data.catalog}),chosen=[],reviews=[];let pending;
  while(runner.world.tick<114){
    const day=runner.world.tick,stage=DAYS.indexOf(day);
    if(stage!==-1){
      const state=stateVector(observations[stage],chosen,data.priors.candidates.length);
      const action=choose?choose({stage,state,pastActions:[...chosen]}):actions[stage];
      if(!Number.isInteger(action)||!data.priors.candidates[action])throw Error('INVALID_SEQUENCE_ACTION');
      chosen.push(action);const candidate=data.priors.candidates[action];
      pending={...candidateCompilation(candidate,runner,data.pooled),publishDay:day+1,cutoff:day};reviews.push({day,action,candidateId:candidate.id,stateHash:sha(state)});
    }
    if(pending&&day===pending.publishDay){runner.publish(pending.plan,pending.model,pending.cutoff);pending=null;}runner.step();
  }
  const score=runner.result('sequence'),periods=periodValues(runner);
  assert.equal(periods.reduce((n,p)=>n+p.platformCents,0),score.platformProxyCents);
  assert.equal(periods.reduce((n,p)=>n+p.merchantCents,0),score.merchantContributionCents);
  return {actions:chosen,score,periods,reviews};
}
export async function sequenceProtocol(){
  const {spec,data}=await protocol();
  const p={phase:'OFFLINE_RL_DEVELOPMENT_ONLY',parentProtocolHash:spec.hash,codeHash:sha(await readFile(import.meta.filename)),featureCodeHash:sha(await readFile(resolve(ROOT,'scripts/policy-evidence-lab/features.mjs'))),
    trainingSeeds:spec.trainingSeeds,developmentValidationSeeds:Array.from({length:16},(_,i)=>102001+i),conditions:CONDITIONS,reviewDays:DAYS,candidateIds:data.priors.candidates.map(c=>c.id),
    stateFeatures:[...FEATURE_NAMES,...[0,1].flatMap(t=>data.priors.candidates.map(c=>'prior_'+t+'_'+c.id))],
    exploration:'14 constant sequences plus 14 balanced sequences with seed-keyed nonzero cyclic offsets; fixed before outcomes. All 14 actions appear twice at every review in each market.',
    reward:'Mature modeled platform and merchant contribution difference versus the same no-outreach world in each decision interval. Three interval rewards sum exactly to the full-run difference. Undiscounted finite horizon.',
    observations:'Same no-outreach monitor packet for all methods, plus each controller knows its own prior chosen actions. No treatment-branch outcomes, hidden traits or future labels are policy inputs.',
    learning:'Finite-horizon fitted Q recursion over observed histories. This is a partially observed approximation, not a claim that the aggregate state is Markov.',
    limits:['Offline training uses complete development trajectories; the future is a training label, never a current inference feature.','Repeated prefixes are deduplicated when fitting; shopper rows are not independent experiments.','No paid LLM evaluation or economic superiority claim in this development phase.','Finite 100-day horizon may favor bringing purchases forward; apparent gains require sensitivity checks before promotion.']};p.hash=sha(p);
  const file=resolve(BASE,'sequence-protocol.json');try{assert.deepEqual(await readJSON(file),p);}catch(e){if(e.code!=='ENOENT')throw e;await saveJSON(file,p);}return {spec:p,data};
}
export function sequenceCase({seed,scenario,data,protocolHash}){
  const args={seed,scenario,data,id:'SEQ6-'+seed+'-'+scenario},controlMonitor=rollout({...args,catalog:data.catalog,pooled:data.pooled,observe:true});
  const observations=controlMonitor.observations,control=trajectory({...args,observations,actions:[0,0,0]}),episodes=[];
  for(const actions of explorationSchedules(seed,scenario,data.priors.candidates.length)){
    const result=actions.every(a=>a===0)?control:trajectory({...args,observations,actions});
    const rewards=result.periods.map((p,i)=>[(p.platformCents-control.periods[i].platformCents)/100,(p.merchantCents-control.periods[i].merchantCents)/100]);
    episodes.push({actions,rewards,checks:result.score.checks});
  }
  const prefixes=new Map();for(const episode of episodes)for(let stage=0;stage<3;stage++){
    const key=stage+':'+episode.actions.slice(0,stage+1).join(','),reward=episode.rewards[stage];
    if(prefixes.has(key))assert.deepEqual(reward,prefixes.get(key),'Future choices must not change earlier interval rewards');else prefixes.set(key,reward);
  }
  return {seed,scenario,protocolHash,observations,episodes,uniquePrefixRewards:prefixes.size};
}
export async function collectSequences(){
  const {spec,data}=await sequenceProtocol();let episodes=0,violations=0;
  for(const seed of spec.trainingSeeds){const file=resolve(BASE,'sequences',seed+'.json');let record;
    try{record=await readJSON(file);assert.equal(record.protocolHash,spec.hash);}catch(e){if(e.code!=='ENOENT')throw e;record={protocolHash:spec.hash,cases:CONDITIONS.map(scenario=>sequenceCase({seed,scenario,data,protocolHash:spec.hash}))};await saveJSON(file,record);}
    for(const c of record.cases)for(const episode of c.episodes){episodes++;violations+=Object.values(episode.checks).reduce((n,v)=>n+v,0);}
    const progress={completedSeeds:seed-spec.trainingSeeds[0]+1,totalSeeds:spec.trainingSeeds.length,episodes,violations,cloudCalls:0};await saveJSON(resolve(BASE,'sequence-progress.json'),progress);console.log(JSON.stringify(progress));
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await collectSequences();
