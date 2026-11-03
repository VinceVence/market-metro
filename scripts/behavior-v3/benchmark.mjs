import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {ROOT,sha,saveJSON,frozenInputs} from '../research-lab/data.mjs';
import {assertFrozen} from '../campaign-controller/benchmark.mjs';
import {pairedEstimate} from '../policy-lab/benchmark-stats.mjs';
import {ASSUMPTIONS,VERSION} from './engine.mjs';
import {POLICIES} from './policies.mjs';
import {usableCatalog} from './catalog.mjs';
import {run} from './runner.mjs';
export const BASE=resolve(ROOT,'docs/behavior-v3'),read=async f=>JSON.parse(await readFile(resolve(BASE,f),'utf8')),save=(f,v)=>saveJSON(resolve(BASE,f),v);
export async function lock(){
 await frozenInputs();await assertFrozen(JSON.parse(await readFile(resolve(ROOT,'docs/policy-lab/benchmarks/v5/protocol.json'))));
 let catalog;try{catalog=(await read('catalog.json')).products;}catch(e){if(e.code!=='ENOENT')throw e;catalog=usableCatalog(JSON.parse(await readFile(resolve(ROOT,'.local/market-catalog.json'))).products);await save('catalog.json',{products:catalog,source:'Previously fetched Channel3 data. Derived topics are explicit. No API call.'});}
 const code={};for(const f of ['engine.mjs','catalog.mjs','policies.mjs','runner.mjs','benchmark.mjs'])code[f]=sha(await readFile(resolve(import.meta.dirname,f)));
 const p={version:VERSION,code,catalogHash:sha(catalog),assumptions:ASSUMPTIONS,developmentSeeds:[121001,121002,121003],evaluationSeeds:[122001,122002,122003,122004,122005,122006,122007,122008],developmentScenarios:['steady','rival_sale','budget_squeeze','supply_delay','returns_wave'],evaluationScenarios:['steady','rival_sale','budget_squeeze','supply_delay','returns_wave','preference_shift'],policies:POLICIES,
 customers:100,shoppingDays:230,campaignStop:130,budgetCents:5000,modelAllowanceUSD:.25,
 sensitivity:{seeds:[123001,123002],scenarios:['steady','preference_shift'],response:[.5,0]},demo:{seed:124001,scenario:'preference_shift'},
 scope:'NEW authored behavioral model, not an improvement on the old identical environment. Test ongoing commerce throughday130 and post-campaign persistence throughday230 separately. All refunds mature. No response coefficient is tuned using evaluation results.',
 selection:'Choose a policy using only development data before opening evaluation. Numerical best is a reference; an optional fresh LLM planner/reviewer may choose a different allowed program. Both use the same local fitted ranker and constraints as strong rules. No tuning after test.',
 negativeControl:'At response0, after shared history, campaigns change no private behavior or purchase pathways. They incur outreach cost only. This must not be presented as a failed integrity check or tuned away.',
 claimBoundary:'Behavior/financial assumptions are uncalibrated. Channel3 supplies listings, not customer preferences, inventory or campaign response. Numerical execution is not a fresh LLM decision for every market. No real PayPal profit is measured.'};p.hash=sha(p);
 try{if((await read('protocol.json')).hash!==p.hash)throw Error('BEHAVIOR_PROTOCOL_CHANGED');}catch(e){if(e.code!=='ENOENT')throw e;await save('protocol.json',p);}return {p,catalog};
}
export function stats(rows){return POLICIES.filter(p=>rows.some(r=>r.policy===p.id)).map(p=>{const x=rows.filter(r=>r.policy===p.id);return {policy:p.id,ongoing:pairedEstimate(x,'ongoingUSD'),durable:pairedEstimate(x,'durableUSD'),merchant:pairedEstimate(x,'merchantUSD'),volume:pairedEstimate(x,'volumeUSD'),share:pairedEstimate(x,'sharePP'),acquired:pairedEstimate(x,'acquiredDelta'),reactivated:pairedEstimate(x,'reactivatedDelta')};});}
async function main(){
 const {p,catalog}=await lock(),stage=process.argv.includes('--evaluate')?'evaluation':'development',seeds=stage==='development'?p.developmentSeeds:p.evaluationSeeds,scenarios=stage==='development'?p.developmentScenarios:p.evaluationScenarios,rows=[];let n=0;
 for(const seed of seeds)for(const scenario of scenarios){const file=`${stage}/${seed}-${scenario}.json`;let record;
  try{record=await read(file);if(record.protocolHash!==p.hash)throw Error('CASE_VERSION_CHANGED');}catch(e){if(e.code!=='ENOENT')throw e;const scores=[];let baseline;
   for(const policy of POLICIES){const s=run({runId:`V3-${seed}-${scenario}-${policy.id}`,seed,scenario,catalog,policy:policy.id});if(policy.id==='none')baseline=s;
    scores.push({...s,ongoingUSD:(s.ongoing.platformCents-baseline.ongoing.platformCents)/100,durableUSD:(s.durable.platformCents-baseline.durable.platformCents)/100,merchantUSD:(s.durable.merchantCents-baseline.durable.merchantCents)/100,volumeUSD:(s.durable.retainedCents-baseline.durable.retainedCents)/100,sharePP:100*(s.durable.paymentShare-baseline.durable.paymentShare),acquiredDelta:s.durable.acquired-baseline.durable.acquired,reactivatedDelta:s.durable.customersReactivated-baseline.durable.customersReactivated});}
   record={protocolHash:p.hash,seed,scenario,scores};await save(file,record);
  }rows.push(...record.scores);if(++n%3===0)console.log(JSON.stringify({stage,completed:n,total:seeds.length*scenarios.length}));
 }
 const estimates=stats(rows),selected=stage==='development'?estimates.filter(s=>s.policy!=='none'&&s.durable.mean>p.modelAllowanceUSD&&s.merchant.mean>=0).sort((a,b)=>b.durable.mean-a.durable.mean)[0]?.policy||'none':(await read('development.json')).selectedPolicy;
 await save(stage+'.json',{protocolHash:p.hash,stage,selectedPolicy:selected,rows,stats:estimates});console.log(JSON.stringify({stage,selected,stats:estimates.map(s=>({policy:s.policy,ongoing:s.ongoing.mean,durable:s.durable.mean,low:s.durable.low,high:s.durable.high,merchant:s.merchant.mean,volume:s.volume.mean}))}));
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
