import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {frozenInputs,ROOT,saveJSON,sha,readJSON} from '../research-lab/data.mjs';
import {readFile} from 'node:fs/promises';
import {pairedEstimate} from '../policy-lab/benchmark-stats.mjs';
import {RECIPES,MERCHANT_SETS,runCandidate} from './policies.mjs';
export const BASE=resolve(ROOT,'docs/policy-lab/benchmarks/v5');
export const DEV_SEEDS=[91001,91002,91003,91004,91005,91006];
export const SCENARIOS=['steady','rival_sale','budget_squeeze','supply_delay','returns_wave'];
export async function audit(){
  const {catalog}=await frozenInputs(),codeHash=sha(await readFile(resolve(ROOT,'scripts/campaign-controller/policies.mjs'))),choices=RECIPES.filter(r=>r.id!=='observe').flatMap(r=>MERCHANT_SETS.flatMap(merchantIndices=>[3,7,14].map(durationDays=>({recipeId:r.id,merchantIndices,durationDays}))));
  const protocol={phase:'DEVELOPMENT_ONLY',codeHash,seeds:DEV_SEEDS,scenarios:SCENARIOS,choices,metric:'Incremental modeled platform contribution versus no campaign, before inference. Same frozen environment and common random draws.',limits:'This is an opportunity audit, not evidence of LLM advantage or held-out policy performance.'};await saveJSON(resolve(BASE,'development-protocol.json'),protocol);
  const rows=[];let rollouts=0;
  for(const seed of DEV_SEEDS)for(const scenario of SCENARIOS){
    const args={id:'DEV5-'+seed,seed,scenario,catalog},no=runCandidate({...args,choice:{recipeId:'observe',merchantIndices:[],durationDays:3}});rollouts++;
    for(const choice of choices){const score=runCandidate({...args,choice});rollouts++;rows.push({seed,scenario,choiceId:sha(choice).slice(0,14),choice,deltaUSD:(score.platformProxyCents-no.platformProxyCents)/100,merchantDeltaUSD:(score.merchantContributionCents-no.merchantContributionCents)/100,recommendations:score.recommendations,spendCents:score.jointBudgetSpentCents,violations:Object.values(score.checks).reduce((n,x)=>n+x,0)});}
    console.log(JSON.stringify({seed,scenario,rollouts}));await saveJSON(resolve(BASE,'development-progress.json'),{seed,scenario,rollouts});
  }
  const ranked=choices.map(choice=>{const selected=rows.filter(r=>r.choiceId===sha(choice).slice(0,14));return {choice,...pairedEstimate(selected,'deltaUSD'),merchant:pairedEstimate(selected,'merchantDeltaUSD'),recommendations:selected.reduce((n,r)=>n+r.recommendations,0)/selected.length};}).sort((a,b)=>b.mean-a.mean);
  const out={generatedAt:new Date().toISOString(),protocolHash:sha(protocol),rollouts,configurations:choices.length,ranking:ranked,violations:rows.reduce((n,r)=>n+r.violations,0),selectionBias:'All policies are compared on development only. Choosing a maximum produces optimistic estimates. No evaluation seeds have been generated or supplied to an LLM.'};await saveJSON(resolve(BASE,'development-rows.json'),rows);await saveJSON(resolve(BASE,'development-result.json'),out);console.log(JSON.stringify({rollouts,top:ranked.slice(0,8),violations:out.violations},null,2));return out;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await audit();
