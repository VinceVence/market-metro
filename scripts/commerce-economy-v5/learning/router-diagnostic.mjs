import {readFile,writeFile,access} from 'node:fs/promises';
import {createWorld,stepWorld} from '../engine.mjs';
import {SETTINGS} from '../runner.mjs';
import {authoredCatalog} from '../../behavior-v4/catalog.mjs';
import {hash,mean} from '../../commerce-design-v2/evaluate.mjs';
import {routerDataset,ROUTER_FEATURES} from './router-features.mjs';
import {EXPERTS,compileExpert} from './experts.mjs';
import {loadActionModels} from './action-policy.mjs';
import {simulateController,violation,METRICS} from './evaluation.mjs';
const dir='docs/commerce-economy-v5/expert-headroom-1',data=JSON.parse(await readFile(dir+'/results.json','utf8')),p=JSON.parse(await readFile(dir+'/protocol.json','utf8'));
if(process.argv[2]==='prepare'){
 if(await access(dir+'/router-data.json').then(()=>true,()=>false))throw Error('ROUTER_DATA_EXISTS');
 const rows=[];for(const market of data.results){const w=createWorld({...SETTINGS,seed:market.seed,scenario:market.scenario,runId:'JOINT-EVAL-'+market.seed,catalog:authoredCatalog()});while(w.tick<30)stepWorld(w);
  for(const feature of routerDataset(w)){const control=market.arms.incumbent.customerOutcomes[feature.index];rows.push({episode:market.seed,scenario:market.scenario,...feature,outcomes:EXPERTS.map(e=>{const o=market.arms[e].customerOutcomes[feature.index];return [o.platformCents-control.platformCents,o.retailerCents-control.retailerCents];})});}
 }
 await writeFile(dir+'/router-data.json',JSON.stringify({features:ROUTER_FEATURES,experts:EXPERTS,rows,protocolHash:p.hash,scope:'Six historical development markets only. Leave-one-whole-market-out diagnostic. Features are computed at day30 and exclude identity, seed, private need, tastes, wallet or future outcomes. Labels are paired whole-policy simulated outcomes. This is a learnability probe, not a final test or causal field experiment.'}));console.log(JSON.stringify({rows:rows.length,features:ROUTER_FEATURES.length}));
}else if(process.argv[2]==='evaluate'){
 if(await access(dir+'/router-results.json').then(()=>true,()=>false))throw Error('ROUTER_RESULTS_EXIST');
 const predictions=JSON.parse(await readFile(dir+'/router-predictions.json','utf8')),artifact=await loadActionModels(),results=[];
 for(const model of ['ridge','forest'])for(const market of data.results){
  const selected=predictions.models[model].filter(r=>r.episode===market.seed);if(selected.length!==SETTINGS.customers)throw Error('INCOMPLETE_CROSSFIT_PREDICTIONS');
  const choices=Object.fromEntries(selected.map(r=>[r.index,r.expert]));
  const row=simulateController({seed:market.seed,scenario:market.scenario},p.businessController,artifact,{customerOutcomes:true,policyFactory:w=>{const policies=Object.fromEntries(EXPERTS.map(e=>[e,compileExpert(w,artifact,p.businessController,e)]));return input=>policies[choices[input.customer.index]](input);}});
  results.push({model,seed:market.seed,scenario:market.scenario,row,fixed:market.fixed,selection:choices});console.log(JSON.stringify({model,scenario:market.scenario,ratio:row.platformUSD/market.fixed.platformUSD,violation:violation(row,market.fixed)}));
 }
 const aggregate=xs=>Object.fromEntries(METRICS.map(k=>[k,mean(xs.map(x=>x[k]))])),summary=Object.fromEntries(['ridge','forest'].map(model=>{const rs=results.filter(r=>r.model===model),fixed=aggregate(rs.map(r=>r.fixed)),actual=aggregate(rs.map(r=>r.row));return [model,{fixed,actual,ratio:actual.platformUSD/fixed.platformUSD,violation:violation(actual,fixed)}];}));
 await writeFile(dir+'/router-results.json',JSON.stringify({results,summary,scope:'Leave-one-development-market-out diagnostic; no final test or fresh validation. Future outcomes are labels only, never inputs to each held-out fold. No paid calls.',targetAchieved:false},null,2));
}else throw Error('Use prepare or evaluate');
