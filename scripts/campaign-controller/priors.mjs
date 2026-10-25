import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readJSON,saveJSON,sha} from '../research-lab/data.mjs';
import {pairedEstimate} from '../policy-lab/benchmark-stats.mjs';
import {BASE,SCENARIOS} from './development.mjs';
import {RECIPES} from './policies.mjs';
export async function buildPriors(){
  const source=await readJSON(resolve(BASE,'precision-result.json')),rows=await readJSON(resolve(BASE,'precision-rows.json'));
  const candidates=[{id:'observe',choice:{recipeId:'observe',merchantIndices:[],durationDays:3},description:'No outreach.',overall:{mean:0,low:0,high:0},profiles:Object.fromEntries(SCENARIOS.map(s=>[s,{mean:0,low:0,high:0}]))},...source.ranking.map(r=>{
    const id=sha(r.choice).slice(0,14);return {id,choice:r.choice,description:r.choice.recipeId==='pooled_support'?'Pooled local ridge model trained on mature randomized contact-eligible DEVELOPMENT history.':RECIPES.find(p=>p.id===r.choice.recipeId).description,
      modelKind:r.choice.recipeId==='pooled_support'?'FITTED_LOCAL_MODEL':'AUTHORED_TARGETING_RULE',overall:{mean:r.mean,low:r.low,high:r.high},profiles:Object.fromEntries(SCENARIOS.map(s=>{const x=pairedEstimate(rows.filter(x=>x.choiceId===id&&x.scenario===s),'deltaUSD');return [s,{mean:x.mean,low:x.low,high:x.high}];}))};
  })];
  const best=(field,profile)=>[...candidates].sort((a,b)=>(profile?b.profiles[profile][field]:b.overall[field])-(profile?a.profiles[profile][field]:a.overall[field])||a.id.localeCompare(b.id))[0].id;
  const rules={static:best('mean'),riskStatic:best('low'),contextual:Object.fromEntries(SCENARIOS.map(s=>[s,best('mean',s)])),riskContextual:Object.fromEntries(SCENARIOS.map(s=>[s,best('low',s)]))};
  const output={version:'precision-priors-v5',sourceHash:sha(source),sample:{seeds:32,markets:160},candidates,rules,disclosure:'These are DEVELOPMENT profiles from separate seeds. Current scenario is not supplied. All comparison baselines have the same candidates and observations. Values describe a repeated static policy; they are not forecasts of the next campaign.'};output.hash=sha(output);await saveJSON(resolve(BASE,'priors.json'),output);console.log(JSON.stringify({candidates:candidates.length,rules},null,2));return output;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await buildPriors();
