import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {frozenInputs,sha,saveJSON,ROOT} from '../research-lab/data.mjs';
import {assertFrozen} from '../campaign-controller/benchmark.mjs';
import {pairedEstimate} from '../policy-lab/benchmark-stats.mjs';
import {VARIANTS} from './economy.mjs';
import {runOpen,POLICIES} from './run.mjs';
export const BASE=resolve(ROOT,'docs/agent-mesh/open-market'),save=(name,value)=>saveJSON(resolve(BASE,name),value),read=async name=>JSON.parse(await readFile(resolve(BASE,name),'utf8'));
const SCENARIOS=['steady','rival_sale','budget_squeeze','supply_delay','returns_wave'];
export async function protocol(){
  await assertFrozen(JSON.parse(await readFile(resolve(ROOT,'docs/policy-lab/benchmarks/v5/protocol.json'))));
  const {catalog,originalBenchmarkHash}=await frozenInputs();
  const code={};for(const p of ['scripts/open-market/economy.mjs','scripts/open-market/run.mjs','scripts/open-market/benchmark.mjs','scripts/agent-mesh/aggressive-policy.mjs'])code[p]=sha(await readFile(resolve(ROOT,p)));
  const p={version:1,createdFor:'Open-market hypothesis; NOT a result on the previous unchanged closed simulator',code,originalBenchmarkHash,catalogHash:sha(catalog),variants:VARIANTS,
    developmentSeeds:[114001,114002,114003],confirmationSeeds:[115001,115002,115003,115004,115005,115006,115007,115008],scenarios:SCENARIOS,policies:POLICIES,
    shoppingDays:400,campaignWindow:[30,99],customers:100,virtualBudgetCents:5000,conservativeInferenceUSD:.10,
    primary:'Mean paired modeled PayPal contribution at400 days, after outreach, processing, returns and$0.10 allocated inference; nominal outside competitor assumption. Seed-clustered95% intervals. Agent-independent numerical policy gets same outcomes without model cost.',
    selection:'Choose highest development mean on nominal markets with positive platform lower95% and nonnegative merchant lower95%; otherwise organic. Freeze before confirmation. Compare chosen, broad full-price, previous high-value-weekly-return-aware and no campaign on every variant. Do not tune on confirmation.',
    controls:'closed=exact old environment; placebo=no behavioral response/contact-fatigue effect after warmup; stronger=larger outside appeal. All policies face identical scenario, wallet, draw, fee and response functions within each variant.',
    visibility:'Outside purchases, latent affinity, future refunds and confirmation outcomes are excluded from live agent evidence. Outside ledger exists only for evaluator cash/share accounting.',
    economicAssumptions:'External retailer at same product list prices, no stock limit, utility intercept0.1 plus declared appeal,3.5% return probability, same5–13day refund delay. No outside PayPal fees. Choice parameters uncalibrated; no claimed real-world ROI.',
    demo:{seed:116001,scenario:'rival_sale',variant:'nominal',chosenBeforeOutcome:true},cloudCalls:0};p.hash=sha(p);
  try{if((await read('protocol.json')).hash!==p.hash)throw Error('OPEN_PROTOCOL_CHANGED');}catch(e){if(e.code!=='ENOENT')throw e;await save('protocol.json',p);}
  return {p,catalog};
}
export const summarize=rows=>POLICIES.filter(p=>rows.some(r=>r.policy===p.id)).map(p=>{
  const xs=rows.filter(r=>r.policy===p.id);
  return {policy:p.id,platform:pairedEstimate(xs,'deltaUSD'),merchant:pairedEstimate(xs,'merchantDeltaUSD'),volume:pairedEstimate(xs,'volumeDeltaUSD'),outsideVolume:pairedEstimate(xs,'outsideDeltaUSD'),totalCommerce:pairedEstimate(xs,'totalCommerceDeltaUSD'),share:pairedEstimate(xs,'shareDeltaPP'),growth:pairedEstimate(xs,'growthPct')};
});
async function main(){
  const {p,catalog}=await protocol(),stage=process.argv.includes('--confirm')?'confirmation':'development';
  const variants=stage==='development'?['nominal']:Object.keys(VARIANTS),seeds=stage==='development'?p.developmentSeeds:p.confirmationSeeds;
  let selected=stage==='confirmation'?(await read('development.json')).selectedPolicy:null;
  const policies=stage==='development'?POLICIES:POLICIES.filter(x=>['organic','broad-full-price','high-value-weekly-return-aware',selected].includes(x.id));
  const rows=[];let completed=0;
  for(const variant of variants)for(const seed of seeds)for(const scenario of SCENARIOS){
    const file=`${stage}/${variant}-${seed}-${scenario}.json`;let record;
    try{record=await read(file);if(record.protocolHash!==p.hash)throw Error('OPEN_CASE_CHANGED');}catch(e){
      if(e.code!=='ENOENT')throw e;
      const control=runOpen({seed,scenario,variant,catalog,policy:POLICIES[0]}),scores=[];
      for(const policy of policies){
        const s=policy.id==='organic'?control:runOpen({seed,scenario,variant,catalog,policy}),{daily,decisions,...compact}=s;
        scores.push({...compact,deltaUSD:(s.platformProxyCents-control.platformProxyCents)/100,merchantDeltaUSD:(s.merchantContributionCents-control.merchantContributionCents)/100,volumeDeltaUSD:(s.retainedCents-control.retainedCents)/100,outsideDeltaUSD:(s.externalRetainedCents-control.externalRetainedCents)/100,totalCommerceDeltaUSD:(s.totalCommerceCents-control.totalCommerceCents)/100,shareDeltaPP:100*(s.paymentShare-control.paymentShare),growthPct:100*(s.platformProxyCents-control.platformProxyCents)/control.platformProxyCents,
          trajectory:daily.map((d,i)=>({day:d.day+1,deltaUSD:(d.platformProxyCents-control.daily[i].platformProxyCents)/100,volumeDeltaUSD:(d.retainedCents-control.daily[i].retainedCents)/100,outsideDeltaUSD:(d.externalRetainedCents-control.daily[i].externalRetainedCents)/100}))});
      }
      record={protocolHash:p.hash,variant,seed,scenario,scores};await save(file,record);
    }
    rows.push(...record.scores);completed++;if(completed%5===0)console.log(JSON.stringify({stage,variant,completed,total:seeds.length*5*variants.length}));
  }
  const stats=Object.fromEntries(variants.map(v=>[v,summarize(rows.filter(r=>r.variant===v))]));
  if(stage==='development')selected=[...stats.nominal].filter(s=>s.policy!=='organic'&&s.platform.low>p.conservativeInferenceUSD&&s.merchant.low>=0).sort((a,b)=>b.platform.mean-a.platform.mean)[0]?.policy||'organic';
  await save(stage+'.json',{protocolHash:p.hash,stage,selectedPolicy:selected,stats,rows});
  console.log(JSON.stringify({stage,selectedPolicy:selected,stats:Object.fromEntries(Object.entries(stats).map(([v,xs])=>[v,xs.map(s=>({policy:s.policy,mean:s.platform.mean,low:s.platform.low,high:s.platform.high,merchant:s.merchant.mean,growth:s.growth.mean,share:s.share.mean}))]))}));
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
