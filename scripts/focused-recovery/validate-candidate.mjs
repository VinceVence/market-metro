// Exploratory confirmation of the best mean candidate, despite its failed
// development confidence gate. This does not change the original rollout choice.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ROOT,sha} from '../research-lab/data.mjs';
import {pairedEstimate} from '../policy-lab/benchmark-stats.mjs';
import {protocol,read,save,POLICIES,runFocused} from './benchmark.mjs';
const {p,catalog}=await protocol(),development=await read('development.json');
const candidate=[...development.stats].filter(s=>s.policy!=='organic'&&s.merchant.mean>=0).sort((a,b)=>b.platform.mean-a.platform.mean)[0]?.policy;
if(!candidate)throw Error('NO_EXPLORATORY_CANDIDATE');
const contract={version:1,parentHash:p.hash,scriptHash:sha(await readFile(import.meta.filename)),developmentHash:sha(development),candidate,
  seeds:Array.from({length:12},(_,i)=>119001+i),scenarios:p.scenarios,days:400,window:[30,199],allocatedInferenceUSD:.10,
  interpretation:'One bounded exploratory confirmation. Original predeclared confidence gate chose organic. This separate protocol evaluates the top development mean with positive mean merchant contribution before viewing any fresh outcomes. No tuning or further seed search.',
  planner:{actor:'CHAT_ASSISTANT',decision:'Test '+candidate,rationale:'Use observed prior merchant exposure plus lapse, reducing irrelevant contacts. Development mean improved but confidence overlaps zero. Keep scaled deployment off until independent confirmation.'}};contract.hash=sha(contract);
try{if((await read('candidate-validation-protocol.json')).hash!==contract.hash)throw Error('VALIDATION_PROTOCOL_CHANGED');}catch(e){if(e.code!=='ENOENT')throw e;await save('candidate-validation-protocol.json',contract);}
const policies=POLICIES.filter(x=>['organic','broad-quality-route',candidate].includes(x.id)),rows=[];let completed=0;
for(const seed of contract.seeds)for(const scenario of contract.scenarios){
 const file=`candidate-validation/${seed}-${scenario}.json`;let record;
 try{record=await read(file);if(record.protocolHash!==contract.hash)throw Error('VALIDATION_CASE_CHANGED');}catch(e){
  if(e.code!=='ENOENT')throw e;const organic=runFocused({seed,scenario,catalog,policy:POLICIES[0]}),scores=[];
  for(const policy of policies){const s=policy.id==='organic'?organic:runFocused({seed,scenario,catalog,policy}),{daily,fits,publications,...small}=s;
   scores.push({...small,deltaUSD:(s.platformProxyCents-organic.platformProxyCents)/100,merchantDeltaUSD:(s.merchantContributionCents-organic.merchantContributionCents)/100,volumeDeltaUSD:(s.retainedCents-organic.retainedCents)/100,
    trajectory:daily.map((d,i)=>({day:d.day,deltaUSD:(d.platformProxyCents-organic.daily[i].platformProxyCents)/100}))});}
  record={protocolHash:contract.hash,seed,scenario,scores};await save(file,record);
 }
 rows.push(...record.scores);if(++completed%5===0)console.log(JSON.stringify({done:completed,total:60}));
}
const chosen=rows.filter(r=>r.policy===candidate).map(r=>{const broad=rows.find(b=>b.seed===r.seed&&b.scenario===r.scenario&&b.policy==='broad-quality-route');return {...r,afterCostUSD:r.deltaUSD-.10,vsBroadUSD:r.deltaUSD-broad.deltaUSD-.10};});
const stats={platform:pairedEstimate(chosen,'afterCostUSD'),merchant:pairedEstimate(chosen,'merchantDeltaUSD'),volume:pairedEstimate(chosen,'volumeDeltaUSD'),vsBroad:pairedEstimate(chosen,'vsBroadUSD')};
await save('candidate-validation.json',{protocolHash:contract.hash,candidate,rows,chosen,stats,passes:stats.platform.low>0&&stats.merchant.low>=0,allocatedModelUSD:.10,actualNewModelUSD:0,agentDisclosure:'The chat assistant proposed this candidate; no fresh provider call. All60 policy executions are deterministic. The$0.10 cost is a prospective conservative allowance, not actual spending.'});
console.log(JSON.stringify({candidate,stats}));
