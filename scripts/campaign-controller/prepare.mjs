import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {frozenInputs,ROOT,readJSON,saveJSON,sha} from '../research-lab/data.mjs';
import {pairedEstimate} from '../policy-lab/benchmark-stats.mjs';
import {runCandidate} from './policies.mjs';
import {SCENARIOS,BASE} from './development.mjs';
import {marketEvidence,recordStocks,inferredRegime} from './evidence.mjs';
import {createFreshWorld} from '../policy-lab/fresh-world.mjs';

export async function prepare(){
  const audit=await readJSON(resolve(BASE,'development-result.json')),rows=await readJSON(resolve(BASE,'development-rows.json')),{catalog}=await frozenInputs();
  const grouped=Object.groupBy(rows,r=>r.choiceId),profiles={};
  for(const scenario of SCENARIOS)profiles[scenario]=Object.values(grouped).map(rs=>({choice:rs[0].choice,...pairedEstimate(rs.filter(r=>r.scenario===scenario),'deltaUSD')})).sort((a,b)=>b.mean-a.mean);
  const risk=[...audit.ranking].sort((a,b)=>b.low-a.low||b.mean-a.mean);
  const bestPerRecipe=Object.values(Object.groupBy(audit.ranking,r=>r.choice.recipeId)).map(xs=>xs[0]);
  const unique=new Map();for(const row of [...audit.ranking.slice(0,12),...risk.slice(0,5),...Object.values(profiles).flatMap(xs=>xs.slice(0,3)),...bestPerRecipe])unique.set(sha(row.choice).slice(0,14),row.choice);
  const choices=[{id:'observe',choice:{recipeId:'observe',merchantIndices:[],durationDays:3},overall:{mean:0,low:0,high:0},profiles:Object.fromEntries(SCENARIOS.map(s=>[s,0]))},...[...unique].map(([id,choice])=>{
    const full=audit.ranking.find(r=>sha(r.choice)===sha(choice));return {id,choice,overall:{mean:full.mean,low:full.low,high:full.high},profiles:Object.fromEntries(SCENARIOS.map(s=>[s,profiles[s].find(r=>sha(r.choice)===sha(choice)).mean]))};
  })];
  const rules={static:choices.find(c=>sha(c.choice)===sha(audit.ranking[0].choice)).id,riskStatic:choices.find(c=>sha(c.choice)===sha(risk[0].choice)).id,contextual:Object.fromEntries(SCENARIOS.map(s=>[s,profiles[s][0].mean>0?choices.find(c=>sha(c.choice)===sha(profiles[s][0].choice)).id:'observe']))};
  const output={generatedAt:new Date().toISOString(),developmentHash:sha(audit),choices,rules,disclosure:'Selected from 180 configurations on development seeds. Values are optimistic development estimates, not current-market outcomes or guarantees. Scenario columns are historical profiles, not a supplied current scenario label.'};
  await saveJSON(resolve(BASE,'candidates.json'),output);
  // This second free development set chooses the strongest primary comparator.
  // Its outcomes are not held-out evidence for the final LLM trial.
  const validation=[];
  for(const seed of [92001,92002,92003,92004,92005,92006])for(const scenario of SCENARIOS){
    const observer=createFreshWorld({id:'MON-'+seed,seed,scenario,settings:{customerCount:100,days:100,budgetCents:30000},catalog,startedAt:'2026-10-25T00:00:00.000Z'}),stock=[],evidence={};
    while(observer.world.tick<81){if([30,55,80].includes(observer.world.tick))evidence[observer.world.tick]=marketEvidence(observer,stock);observer.step();recordStocks(observer,stock);}
    const args={id:'RULE-VALIDATE-'+seed,seed,scenario,catalog},no=runCandidate({...args,choice:choices[0].choice});
    for(const mode of ['static','riskStatic','contextual']){
      const result=runCandidate({...args,chooseAtReview:e=>{const id=mode==='contextual'?rules.contextual[inferredRegime(evidence[e.asOfDay])]:rules[mode];return choices.find(c=>c.id===id).choice;}});
      validation.push({seed,scenario,mode,deltaUSD:(result.platformProxyCents-no.platformProxyCents)/100,merchantDeltaUSD:(result.merchantContributionCents-no.merchantContributionCents)/100});
    }
  }
  const ranks=['static','riskStatic','contextual'].map(mode=>({mode,...pairedEstimate(validation.filter(r=>r.mode===mode),'deltaUSD')})).sort((a,b)=>b.mean-a.mean);
  output.primaryComparator=ranks[0].mode;output.codeValidation={seeds:[92001,92002,92003,92004,92005,92006],ranks,rows:validation,disclosure:'Free development validation used to select the comparator. Not a confirmatory economic result.'};output.hash=sha(output);
  await saveJSON(resolve(BASE,'candidates.json'),output);console.log(JSON.stringify({candidates:choices.length,rules,primaryComparator:output.primaryComparator,validation:ranks},null,2));return output;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await prepare();
