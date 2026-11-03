// Incumbent-preserving, budget-matched numerical search over frozen controls.
// No model calls, new business mechanisms, private features or native payments.
import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {incumbent,evaluate,CASES,VALIDATION,SETTINGS,validateComponent} from './runner.mjs';
import {draw} from '../marketing/economy.mjs';
import {hash} from '../commerce-design-v2/evaluate.mjs';
const DIR='docs/commerce-economy-v5/search-1',PREVIOUS='docs/commerce-economy-v5/agent-network-1';
const read=path=>readFile(path,'utf8').then(JSON.parse),save=async(name,value)=>writeFile(DIR+'/'+name,JSON.stringify(value,null,2)+'\n');
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const key=c=>hash(canonical({...c,lifecycle:{...c.lifecycle,interval:String(c.lifecycle.interval)}}));
const domains=[
 ...[0,1,2].map(i=>({path:['demand','stockDays',i],values:[7,14,28]})),
 {path:['demand','windowDays'],values:[7,14,28]}, {path:['demand','retrainDays'],values:[7,14,28]}, {path:['demand','useLostDemand'],values:[false,true]}, {path:['demand','topK'],values:[1,2,3,4]},
 ...[0,1,2].map(i=>({path:['economics','pricePct',i],values:[-10,-5,0,5,10]})),
 {path:['economics','merchantRail'],values:['auto','bank','paypal']},{path:['economics','supplierRail'],values:['auto','bank','paypal']},
 {path:['lifecycle','marketing'],values:['weekly_featured','personalized','portfolio']},{path:['lifecycle','subscriptions'],values:[false,true]},
 {path:['lifecycle','interval'],values:['observed','7','14','28']},{path:['lifecycle','minimumRepeat'],values:[1,2,3]},{path:['lifecycle','discountPct'],values:[0,5]}
];
const TRAIN=[...CASES,...VALIDATION],FRESH_VALIDATION=CASES.map((c,i)=>({...c,seed:570200+i})),MAX=64,SEARCH_SEED=770001;
const files=['scripts/commerce-economy-v5/engine.mjs','scripts/commerce-economy-v5/operations.mjs','scripts/commerce-economy-v5/network.mjs','scripts/commerce-economy-v5/policies.mjs','scripts/commerce-economy-v5/runner.mjs','scripts/commerce-economy-v5/search.mjs','scripts/behavior-v4/engine.mjs','scripts/behavior-v4/policies.mjs','scripts/behavior-v4/catalog.mjs','scripts/marketing/recommender.mjs','scripts/marketing/economy.mjs','scripts/policy-lab/wallet-corrected.mjs','demo/market/engine.mjs'];
const sources=async()=>Object.fromEntries(await Promise.all(files.map(async f=>[f,hash(await readFile(f,'utf8'))])));
function violation(m,b){return Math.max(0,b.allPartnerUSD-m.allPartnerUSD)+Math.max(0,b.retailerUSD-m.retailerUSD)+Math.max(0,b.terminalCashUSD-m.terminalCashUSD)+Math.max(0,m.terminalInventoryUSD-b.terminalInventoryUSD*1.1);}
function mutate(config,n,arm){const c=structuredClone(config),edits=draw(SEARCH_SEED,arm,n,'edits')<.65?1:2;for(let i=0;i<edits;i++){const d=domains[Math.floor(draw(SEARCH_SEED,arm,n,i,'field')*domains.length)],v=d.values[Math.floor(draw(SEARCH_SEED,arm,n,i,'value')*d.values.length)];let p=c;for(const k of d.path.slice(0,-1))p=p[k];p[d.path.at(-1)]=v;}return c;}
async function seedPlans(arm){
 const base=incumbent(),seeds=[{config:base,origin:'shared incumbent'}];
 if(arm==='numerical'){
  for(const rail of ['bank','paypal']){const c=structuredClone(base);c.economics.merchantRail=rail;c.economics.supplierRail=rail;seeds.push({config:c,origin:'numerical rail anchor'});}
  for(const price of [-5,5,10]){const c=structuredClone(base);c.economics.pricePct=[price,price,price];seeds.push({config:c,origin:'numerical price anchor'});}
 }else{const previous=await read(PREVIOUS+'/'+arm+'.json');
  // Seed each role's alternatives independently, retaining other incumbent
  // components. Subsequent mutations can combine them through measured search.
  for(const role of ['demand','economics','lifecycle'])for(const option of previous.components[role])seeds.push({config:{...structuredClone(base),[role]:option.parameters},origin:role+': '+option.name});
 }
 return seeds;
}
await mkdir(DIR,{recursive:true});if(await access(DIR+'/protocol.json').then(()=>true,()=>false))throw Error('SEARCH_PROTOCOL_EXISTS_NO_OVERWRITE');
const p={createdAt:new Date().toISOString(),settings:SETTINGS,training:TRAIN,validation:FRESH_VALIDATION,searchSeed:SEARCH_SEED,candidateBudgetPerArm:MAX,arms:['numerical','single','multi'],hashes:await sources(),scope:'Previously opened validation seeds become training data. New validation remains unopened until every arm finishes search and freezes four finalists. This reuses prior agent decisions; it is not a fresh-agent benchmark. Same64 total candidate evaluations per arm, same local optimizer and allowed controls. Model costs remain assigned to their originating arm. No additional paid calls. Economic simulator frozen.',selection:'Hard guards for all-partner contribution, retailer contribution, terminal cash and excess inventory. Training fitness = platform contribution minus2 times summed constraint violations. New validation chooses among four frozen feasible finalists plus incumbent. >=2x after full model cost and all guards is required to open held-out tests.'};p.hash=hash(p);await save('protocol.json',p);
for(const f of files){const path=DIR+'/source/'+f;await mkdir(path.slice(0,path.lastIndexOf('/')),{recursive:true});await writeFile(path,await readFile(f));}
const baseline=evaluate(TRAIN,incumbent()).mean,arms={};
for(const arm of p.arms){const seeds=await seedPlans(arm),rows=[],seen=new Set();let tries=0;const start=performance.now();
 while(rows.length<MAX){let candidate;if(seeds.length)candidate=seeds.shift();else{
  const feasible=rows.filter(r=>r.violation<1e-6).sort((a,b)=>b.metrics.platformUSD-a.metrics.platformUSD).slice(0,6),frontier=[...rows].sort((a,b)=>b.fitness-a.fitness).slice(0,8),parents=tries%3?feasible:frontier,chosen=parents[Math.floor(draw(SEARCH_SEED,arm,tries,'parent')*parents.length)];candidate={config:mutate(chosen.config,tries,arm),origin:'local mutation of '+chosen.id};
 }
 tries++;if(tries>10000)throw Error('SEARCH_GENERATION_EXHAUSTED');const id=key(candidate.config);if(seen.has(id))continue;seen.add(id);for(const role of ['demand','economics','lifecycle'])validateComponent(role,candidate.config[role]);
 const m=evaluate(TRAIN,candidate.config).mean,v=violation(m,baseline),row={...candidate,id,metrics:m,violation:v,fitness:m.platformUSD-2*v,ratio:m.platformUSD/baseline.platformUSD};rows.push(row);
 if(rows.length%8===0)console.log(JSON.stringify({arm,candidates:rows.length,bestFeasibleRatio:Math.max(...rows.filter(r=>r.violation<1e-6).map(r=>r.ratio))}));
 }
 const finalists=rows.filter(r=>r.violation<1e-6).sort((a,b)=>b.metrics.platformUSD-a.metrics.platformUSD).slice(0,4);arms[arm]={rows,finalists,runtimeMs:Math.round(performance.now()-start),modelCostUSD:arm==='numerical'?0:(await read(PREVIOUS+'/'+arm+'.json')).costUSD};await save(arm+'.json',arms[arm]);
}
await save('finalists-frozen.json',{at:new Date().toISOString(),protocolHash:p.hash,finalists:Object.fromEntries(p.arms.map(arm=>[arm,arms[arm].finalists.map(f=>f.id)]))});
if(JSON.stringify(await sources())!==JSON.stringify(p.hashes))throw Error('FROZEN_SEARCH_SOURCE_CHANGED');const b=evaluate(FRESH_VALIDATION,incumbent()).mean;
for(const arm of p.arms){for(const candidate of arms[arm].finalists){candidate.validation=evaluate(FRESH_VALIDATION,candidate.config).mean;candidate.validationViolation=violation(candidate.validation,b);candidate.validationRatio=(candidate.validation.platformUSD-arms[arm].modelCostUSD)/b.platformUSD;}
 arms[arm].selected=arms[arm].finalists.filter(c=>c.validationViolation<1e-6).sort((a,b)=>b.validationRatio-a.validationRatio)[0]||null;arms[arm].advanceToHeldout=!!arms[arm].selected&&arms[arm].selected.validationRatio>=2;await save(arm+'.json',arms[arm]);console.log(JSON.stringify({arm,ratio:arms[arm].selected?.validationRatio,advance:arms[arm].advanceToHeldout}));}
await save('results.json',{protocolHash:p.hash,status:'COMPLETED',trainingFixed:baseline,validationFixed:b,arms,newModelCalls:0,newModelCostUSD:0,targetAchieved:false,scope:'Independent validation only; no held-out target claim.'});
