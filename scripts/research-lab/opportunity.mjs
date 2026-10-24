import {frozenInputs,observedWorld,fitCandidate,runPolicy,FIELDS,BASE,saveJSON,sha} from './data.mjs';
import {resolve} from 'node:path';
import {pairedEstimate} from '../policy-lab/benchmark-stats.mjs';

const {catalog,originalBenchmarkHash}=await frozenInputs();
const seeds=[314,2718,1618],scenarios=['steady','rival_sale','budget_squeeze','supply_delay','returns_wave'];
const configs=[];for(const family of ['mean','ridge'])for(const audience of ['all','lapsed'])for(const duration of [3,7,14])for(const maxOfferPct of [0,5])for(const penalty of [0,.3,.6])configs.push({family,audience,duration,maxOfferPct,penalty});
await saveJSON(resolve(BASE,'opportunity-protocol.json'),{createdAt:new Date().toISOString(),originalBenchmarkHash,seeds,scenarios,configurations:configs.length,confirmationSeeds:[62001,62002,62003,62004,62005,62006,62007,62008,62009,62010],cutoff:45,days:100,returnTail:14,scope:'One bounded campaign, followed through day100 and the14-day return tail. CPU search, not a mathematical upper bound or LLM result.'});
const results=[];
for(const seed of seeds)for(const scenario of scenarios){
  const id='OPPORTUNITY-'+seed+'-'+scenario,ctx=observedWorld({id,seed,scenario,catalog});
  const none=runPolicy({id,seed,scenario,catalog,plan:{id:'none',strategy:'observe',audience:'all',merchantIndices:[],maxOfferPct:0,duration:0,penalty:0,epsilon:0,windowDays:42},artifact:null});
  const models=Object.fromEntries(['mean','ridge'].map(family=>[family,fitCandidate(ctx.actions,{family,features:FIELDS.slice(1),windowDays:42,cutoffDay:45}).artifact]));
  for(const config of configs){
    const plan={...config,id:sha(config).slice(0,12),strategy:config.maxOfferPct?'mixed':'recommendations',merchantIndices:[0,1,2],epsilon:0,windowDays:42};
    const result=runPolicy({id,seed,scenario,catalog,plan,artifact:models[config.family]});
    results.push({seed,scenario,configId:plan.id,config,deltaUSD:(result.platformProxyCents-none.platformProxyCents)/100,merchantDeltaUSD:(result.merchantContributionCents-none.merchantContributionCents)/100,spendCents:result.jointBudgetSpentCents,offers:result.offers,recommendations:result.recommendations});
  }
  console.log('Audited '+seed+' '+scenario);
}
const ranking=configs.map(config=>{const id=sha(config).slice(0,12),rows=results.filter(r=>r.configId===id);return {id,config,...pairedEstimate(rows,'deltaUSD')};}).sort((a,b)=>b.mean-a.mean);
const best=ranking[0],confirmation=[];
for(const seed of [62001,62002,62003,62004,62005,62006,62007,62008,62009,62010])for(const scenario of scenarios){
  const id='CONFIRM-'+seed+'-'+scenario,ctx=observedWorld({id,seed,scenario,catalog});
  const none=runPolicy({id,seed,scenario,catalog,plan:{id:'none',strategy:'observe',audience:'all',merchantIndices:[],maxOfferPct:0,duration:0,penalty:0,epsilon:0,windowDays:42},artifact:null});
  const artifact=fitCandidate(ctx.actions,{family:best.config.family,features:FIELDS.slice(1),windowDays:42,cutoffDay:45}).artifact;
  const plan={...best.config,id:best.id,strategy:best.config.maxOfferPct?'mixed':'recommendations',merchantIndices:[0,1,2],epsilon:0,windowDays:42};
  const result=runPolicy({id,seed,scenario,catalog,plan,artifact});confirmation.push({seed,scenario,deltaUSD:(result.platformProxyCents-none.platformProxyCents)/100,merchantDeltaUSD:(result.merchantContributionCents-none.merchantContributionCents)/100,spendCents:result.jointBudgetSpentCents});
}
const hindsight=seeds.flatMap(seed=>scenarios.map(scenario=>{
  const values=results.filter(r=>r.seed===seed&&r.scenario===scenario).map(r=>r.deltaUSD);
  return {seed,scenario,value:Math.max(0,...values)};
}));
const summary={completedAt:new Date().toISOString(),originalBenchmarkHash,modelCalls:0,newPaidUSD:0,configurations:configs.length,developmentCases:15,rollouts:results.length+15+confirmation.length*2,
  bestDevelopment:best,confirmation:pairedEstimate(confirmation,'deltaUSD'),hindsightEnvelope:pairedEstimate(hindsight,'value'),
  caveats:['Development selected the maximum over72 configurations; its result is selection-biased.','Confirmation evaluates only that single selected configuration on new seeds.','The hindsight envelope chooses a winner after outcomes and is not a deployable policy or a true optimal bound.','No market dynamics, prices, budget availability or reward accounting were changed.','Economic headroom for untested policies remains unknown.'],ranking,confirmationRows:confirmation};
await saveJSON(resolve(BASE,'opportunity-results.json'),summary);await saveJSON(resolve(BASE,'opportunity-cases.json'),results);
console.log(JSON.stringify({best:summary.bestDevelopment,confirmation:summary.confirmation,hindsight:summary.hindsightEnvelope,rollouts:summary.rollouts,newPaidUSD:0},null,2));
