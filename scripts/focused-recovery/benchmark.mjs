import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createFreshWorld} from './world.mjs';
import {scheduleModel} from '../agent-mesh/aggressive-policy.mjs';
import {recentRisk} from '../agent-mesh/recovery-policy.mjs';
import {frozenInputs,ROOT,sha,saveJSON} from '../research-lab/data.mjs';
import {pairedEstimate} from '../policy-lab/benchmark-stats.mjs';
import {assertFrozen} from '../campaign-controller/benchmark.mjs';
export const BASE=resolve(ROOT,'docs/agent-mesh/focused-recovery'),save=(f,v)=>saveJSON(resolve(BASE,f),v),read=async f=>JSON.parse(await readFile(resolve(BASE,f),'utf8'));
export const POLICIES=[
 {id:'organic',focus:false},
 {id:'broad-quality-route',focus:false},
 {id:'exposed-customers',focus:true},
 {id:'exposed-high-value',focus:true,floor:.5},
 {id:'exposed-refunded',focus:true,requireRefund:true},
 {id:'exposed-lapsed',focus:true,requireLapsed:true}
];
export function makeRunner({seed,scenario,catalog,policy,days=400,id}){
 const r=createFreshWorld({id:id||`FOCUSED-${seed}-${scenario}-${policy.id}`,seed,scenario,catalog,startedAt:'2026-10-26T01:00:00.000Z',settings:{customerCount:100,days,budgetCents:5000}}),model=scheduleModel({...policy,floor:policy.floor||0,loyal:true});
 const step=r.step,decisions=[];let previous=null;
 r.step=()=>{
  const day=r.world.tick;
  if(day>=30&&day<200&&policy.id!=='organic'){
   const risk=recentRisk(r),exposedMerchants=risk.filter(m=>m.excluded).map(m=>m.index),safe=risk.filter(m=>!m.excluded).map(m=>m.index),active=exposedMerchants.length>0;
   r.world.policyLab.focusedPolicy=policy.focus?{exposedMerchants,requireRefund:!!policy.requireRefund,requireLapsed:!!policy.requireLapsed}:null;
   r.publish({id:policy.id,strategy:active?'recommendations':'observe',audience:'all',merchantIndices:active?safe:[],maxOfferPct:0,duration:1,penalty:0,epsilon:0},model,day);
   const signature=JSON.stringify({exposedMerchants,safe});if(signature!==previous){decisions.push({day,active,exposedMerchants,safe,risk,actor:'CODE_EXECUTION_OF_AUDITED_PROGRAM'});previous=signature;}
  }
  return step();
 };
 return Object.assign(r,{decisions});
}
export function runFocused(input){const r=makeRunner(input);while(r.world.tick<r.world.totalTicks)r.step();const out=r.result(input.policy.id);if(Object.values(out.checks).some(x=>x!==0)||r.actions.some(a=>a.day>=200&&a.selected_action!=='none'))throw Error('FOCUSED_INVARIANT_FAILED');return {...out,decisions:r.decisions};}
export async function protocol(){
 await assertFrozen(JSON.parse(await readFile(resolve(ROOT,'docs/policy-lab/benchmarks/v5/protocol.json'))));
 const {catalog,originalBenchmarkHash}=await frozenInputs(),code={};for(const f of ['scripts/focused-recovery/economy.mjs','scripts/focused-recovery/world.mjs','scripts/focused-recovery/benchmark.mjs','scripts/agent-mesh/recovery-policy.mjs','scripts/agent-mesh/aggressive-policy.mjs'])code[f]=sha(await readFile(resolve(ROOT,f)));
 const p={version:1,code,originalBenchmarkHash,catalogHash:sha(catalog),developmentSeeds:[114001,114002,114003],confirmationSeeds:[117001,117002,117003,117004,117005,117006,117007,117008],scenarios:['steady','rival_sale','budget_squeeze','supply_delay','returns_wave'],policies:POLICIES,
  days:400,campaignDays:[30,199],customers:100,budgetCents:5000,allocatedInferenceUSD:.10,selection:'Select highest mean400-day paired platform value, requiring positive lower95% and nonnegative merchant lower95% in development. Then lock. No confirmation tuning.',
  scope:'Original closed-market economics. New observable policy condition: last merchant is in the current high-return group. Same recent40 mature-order risk estimator for all policies. Expand campaign authority equally from70 to170days, then200days without new outreach. No changed fees, response, demand, price, latent traits or inventory.',
  observations:'Prior merchant identity, past observed refund count, recency, public product price, matured merchant return rates. No future refunds or hidden preferences.',demo:{seed:118001,scenario:'returns_wave'},cloudCalls:0};p.hash=sha(p);
 try{if((await read('protocol.json')).hash!==p.hash)throw Error('FOCUSED_PROTOCOL_CHANGED');}catch(e){if(e.code!=='ENOENT')throw e;await save('protocol.json',p);}return {p,catalog};
}
async function main(){
 const {p,catalog}=await protocol(),stage=process.argv.includes('--confirm')?'confirmation':'development',seeds=stage==='development'?p.developmentSeeds:p.confirmationSeeds;
 let selected=stage==='confirmation'?(await read('development.json')).selectedPolicy:null;
 const policies=stage==='development'?POLICIES:POLICIES.filter(x=>['organic','broad-quality-route',selected].includes(x.id)),rows=[];let n=0;
 for(const seed of seeds)for(const scenario of p.scenarios){const f=`${stage}/${seed}-${scenario}.json`;let record;
  try{record=await read(f);if(record.protocolHash!==p.hash)throw Error('FOCUSED_CASE_CHANGED');}catch(e){if(e.code!=='ENOENT')throw e;const organic=runFocused({seed,scenario,catalog,policy:POLICIES[0]}),scores=[];
   for(const policy of policies){const s=policy.id==='organic'?organic:runFocused({seed,scenario,catalog,policy}),{daily,fits,publications,...small}=s;
    scores.push({...small,deltaUSD:(s.platformProxyCents-organic.platformProxyCents)/100,merchantDeltaUSD:(s.merchantContributionCents-organic.merchantContributionCents)/100,volumeDeltaUSD:(s.retainedCents-organic.retainedCents)/100,
     trajectory:daily.map((d,i)=>({day:d.day,deltaUSD:(d.platformProxyCents-organic.daily[i].platformProxyCents)/100}))});}
   record={protocolHash:p.hash,seed,scenario,scores};await save(f,record);
  }rows.push(...record.scores);if(++n%5===0)console.log(JSON.stringify({stage,done:n,total:seeds.length*5}));
 }
 const stats=policies.map(p=>{const xs=rows.filter(r=>r.policy===p.id);return {policy:p.id,platform:pairedEstimate(xs,'deltaUSD'),merchant:pairedEstimate(xs,'merchantDeltaUSD'),volume:pairedEstimate(xs,'volumeDeltaUSD')};});
 if(stage==='development')selected=[...stats].filter(s=>s.policy!=='organic'&&s.platform.low>.10&&s.merchant.low>=0).sort((a,b)=>b.platform.mean-a.platform.mean)[0]?.policy||'organic';
 await save(stage+'.json',{protocolHash:p.hash,selectedPolicy:selected,rows,stats});console.log(JSON.stringify({stage,selected,stats}));
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
