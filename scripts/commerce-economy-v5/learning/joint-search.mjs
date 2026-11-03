// Bounded controller search: combine learned campaigns with the existing legal
// commercial controls. No physics changes, model API calls or test-set queries.
import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {incumbent,CASES,SETTINGS} from '../runner.mjs';
import {draw} from '../../marketing/economy.mjs';
import {hash} from '../../commerce-design-v2/evaluate.mjs';
import {loadActionModels} from './action-policy.mjs';
import {assess,violation} from './evaluation.mjs';

const dir='docs/commerce-economy-v5/joint-controller-1',budget=64,searchSeed=75631;
await mkdir(dir,{recursive:true});
if(await access(dir+'/protocol.json').then(()=>true,()=>false))throw Error('JOINT_PROTOCOL_EXISTS');
const artifact=await loadActionModels(),commercial=JSON.parse(await readFile('docs/commerce-economy-v5/search-1/audited-report.json','utf8')).arms.multi.config;
const files=['scripts/commerce-economy-v5/engine.mjs','scripts/commerce-economy-v5/operations.mjs','scripts/commerce-economy-v5/network.mjs','scripts/commerce-economy-v5/policies.mjs','scripts/commerce-economy-v5/learning/features.mjs','scripts/commerce-economy-v5/learning/pair-features.mjs','scripts/commerce-economy-v5/learning/actions.mjs','scripts/commerce-economy-v5/learning/action-policy.mjs','scripts/commerce-economy-v5/learning/evaluation.mjs','scripts/commerce-economy-v5/learning/joint-search.mjs'];
const save=(n,v)=>writeFile(dir+'/'+n,JSON.stringify(v,null,2)+'\n');
const protocol={createdAt:new Date().toISOString(),development:CASES,validation:CASES.map((c,i)=>({...c,seed:724200+i})),settings:SETTINGS,budget,searchSeed,designCostUSD:.140734,modelHash:hash(artifact),hashes:Object.fromEntries(await Promise.all(files.map(async f=>[f,hash(await readFile(f,'utf8'))]))),scope:'Controller development only. Same frozen v5.2 economics, same legal controls, matched observed-data readers. Previously collected local response models. Strongest financially feasible of3 fixed heuristics selected on development.64 joint proposals; up to3 feasible finalists frozen before new validation. Retain all failures. No final test, no fresh LLM claim, no native payments.',selection:'Absolute platform net after all current-goal model cost; partner contribution, retailer contribution and cash >= fixed, inventory <=110% fixed.2x plus all guards required to advance to final held-out evaluation.'};
protocol.hash=hash(protocol);await save('protocol.json',protocol);
for(const f of files){const to=dir+'/source/'+f;await mkdir(to.slice(0,to.lastIndexOf('/')),{recursive:true});await writeFile(to,await readFile(f));}
const baselines=['fixed','winback','coupon'].map(kind=>assess(CASES,{id:'fixed_'+kind,business:incumbent(),kind},artifact)),reference=baselines.filter(r=>violation(r.mean,baselines[0].mean)<1e-8).sort((a,b)=>b.mean.platformUSD-a.mean.platformUSD)[0];
await save('baselines.json',{baselines,reference:reference.id});
const proposals=[],rows=[],seen=new Set();
function propose(prices,stock,window,rail='paypal',modelName='ridge',thresholdCents=0){const business=structuredClone(commercial);business.economics.pricePct=prices;business.economics.merchantRail=rail;business.economics.supplierRail='paypal';business.demand.stockDays=[stock,stock,stock];business.demand.windowDays=window;proposals.push({kind:'learned',business,modelName,thresholdCents});}
propose([0,-10,10],14,14,'auto');
for(const prices of [[10,10,10],[10,0,10],[10,-10,10],[0,-10,10]])for(const stock of [7,14,28])propose(prices,stock,14);
const fields=[...[0,1,2].map(i=>({path:['business','economics','pricePct',i],values:[-10,-5,0,5,10]})),...[0,1,2].map(i=>({path:['business','demand','stockDays',i],values:[7,14,28]})),{path:['business','demand','windowDays'],values:[7,14,28]},{path:['business','demand','useLostDemand'],values:[true,false]},{path:['business','economics','merchantRail'],values:['auto','paypal']},{path:['business','economics','supplierRail'],values:['auto','paypal']},{path:['thresholdCents'],values:[0,20]},{path:['business','lifecycle','subscriptions'],values:[true,false]},{path:['business','lifecycle','minimumRepeat'],values:[1,2,3]},{path:['business','lifecycle','interval'],values:['observed',7,14,28]}];
let attempt=0;
while(rows.length<budget){
 let c=proposals.shift();
 if(!c){const ranked=[...rows].sort((a,b)=>b.fitness-a.fitness).slice(0,6),parent=ranked[Math.floor(draw(searchSeed,attempt,'parent')*ranked.length)];c=structuredClone(parent.config);delete c.id;
  const edits=draw(searchSeed,attempt,'edits')<.7?1:2;
  for(let j=0;j<edits;j++){const field=fields[Math.floor(draw(searchSeed,attempt,j,'field')*fields.length)],value=field.values[Math.floor(draw(searchSeed,attempt,j,'value')*field.values.length)];let node=c;for(const k of field.path.slice(0,-1))node=node[k];node[field.path.at(-1)]=value;}
 }
 if(++attempt>10000)throw Error('CANDIDATE_SPACE_EXHAUSTED');
 const id=hash(c).slice(0,16);if(seen.has(id))continue;seen.add(id);c.id=id;
 const r=assess(CASES,c,artifact);r.violation=violation(r.mean,reference.mean);r.fitness=r.mean.platformUSD-2*r.violation;r.ratio=(r.mean.platformUSD-protocol.designCostUSD)/reference.mean.platformUSD;rows.push(r);
 await save('development.json',{protocolHash:protocol.hash,reference,rows});
 console.log(JSON.stringify({n:rows.length,ratio:r.ratio,violation:r.violation,prices:c.business.economics.pricePct,stock:c.business.demand.stockDays,best:Math.max(...rows.filter(x=>x.violation<1e-8).map(x=>x.ratio))}));
}
const finalists=rows.filter(r=>r.violation<1e-8).sort((a,b)=>b.ratio-a.ratio).slice(0,3);
await save('finalists.json',{protocolHash:protocol.hash,frozenAt:new Date().toISOString(),reference:reference.config,finalists:finalists.map(r=>r.config)});
for(const [f,h]of Object.entries(protocol.hashes))if(hash(await readFile(f,'utf8'))!==h)throw Error('FROZEN_SOURCE_CHANGED');
const validation=[reference.config,...finalists.map(r=>r.config)].map(c=>assess(protocol.validation,c,artifact)),base=validation[0].mean;
for(const r of validation){r.violation=violation(r.mean,base);r.netAfterDesignUSD=r.mean.platformUSD-(r.id===reference.id?0:protocol.designCostUSD);r.ratio=r.netAfterDesignUSD/base.platformUSD;console.log(JSON.stringify({phase:'validation',id:r.id,ratio:r.ratio,violation:r.violation}));}
await save('results.json',{protocolHash:protocol.hash,status:'COMPLETED',reference:reference.id,validation,advanceToHeldout:validation.slice(1).some(r=>r.violation<1e-8&&r.ratio>=2),targetAchieved:false,newPaidCalls:0});
