// Bounded development ablation. No LLM calls, unseen seeds or native payments.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CONTRACT,digest} from '../environment.mjs';
import {compileProgram,SEED_PROGRAMS,field} from './program.mjs';
import {runProgramCase} from './runner.mjs';
import {openAllocator} from '../../commerce-deadlines/solver.mjs';
const dir='docs/commerce-growth/experiments-1/bundled-1';await mkdir(dir);
const load=async p=>JSON.parse(await readFile(p,'utf8')),
 prior=await load('docs/commerce-growth/team-1/training/model.json'),
 core=await load('docs/commerce-growth/development-1/protocol.json'),
 old=await load('docs/commerce-growth/experiments-1/local-probe/results.json'),
 comparison=await load('docs/commerce-growth/experiments-1/revision-1/results.json'),
 baselineRows=(await load('docs/commerce-growth/team-1/development/rows.json')).rows.filter(r=>r.policy===old.reference.policy.id),
 response=SEED_PROGRAMS.find(p=>p.id==='response_value'),intent=SEED_PROGRAMS.find(p=>p.id==='intent_replenishment'),
 base={...response.program,basketScore:field('platform_usd'),fulfillment:'funded_baskets'},
 candidates=[{id:'complete_baskets',hypothesis:'Commit cash to complete funded baskets using existing or arriving approved alternatives, before speculative stock.',program:base},
 {id:'complete_baskets_with_intent',hypothesis:'After feasible complete baskets, reserve stock for observed product interest rather than solely historical request counts.',program:{...base,stockTarget:intent.program.stockTarget}}];
async function verifyFrozen(){for(const [file,h]of Object.entries(core.sourceHashes))if(createHash('sha256').update(await readFile(file)).digest('hex')!==h)throw Error('FROZEN_ECONOMY_CHANGED');}
await verifyFrozen();const sources={};for(const file of ['program.mjs','baskets.mjs','runner.mjs','bundled-study.mjs']){
 const path='scripts/commerce-growth/experiments/'+file,body=await readFile(path);sources[path]=createHash('sha256').update(body).digest('hex');await copyFile(path,dir+'/'+file);
}
await writeFile(dir+'/protocol.json',JSON.stringify({createdAt:new Date().toISOString(),candidates,cases:CONTRACT.developmentSeeds,modelHash:digest(prior),controllerHashes:sources,economyHashes:core.sourceHashes,source:'DEVELOPMENT_ASSISTANT_AUTHORED_NOT_FRESH_APPLICATION_AGENTS',newPaidCalls:0,unseenSeedsOpened:false},null,2)+'\n');
const rows=[],allocator=openAllocator();
try{
 for(const [regime,seed]of Object.entries(CONTRACT.developmentSeeds))for(const candidate of candidates){
  const result=await runProgramCase({regime,seed},candidate,{allocator,prior}),fixed=baselineRows.find(r=>r.seed===seed);
  for(const key of ['initialHash','opportunityHash','consentHash','incomeCents'])if(result[key]!==fixed[key])throw Error('UNMATCHED_CASE_'+key);
  rows.push(result);await writeFile(dir+'/rows.json',JSON.stringify({rows},null,2)+'\n');
  console.log(JSON.stringify({regime,policy:candidate.id,platform:result.platformUSD,retained:result.retainedPurchases,cash:result.terminalCashUSD,unpaid:result.unpaidLiabilities}));
 }
 await verifyFrozen();
 const summary=candidates.map(p=>{
  const group=rows.filter(r=>r.policy===p.id),keys=Object.keys(comparison.mean),mean=Object.fromEntries(keys.map(k=>[k,group.reduce((s,r)=>s+r[k],0)/group.length])),
   merchantDeltas=Object.fromEntries(Object.keys(group[0].merchantContributions).map(id=>[id,group.reduce((s,r)=>s+r.merchantContributions[id],0)/group.length-baselineRows.reduce((s,r)=>s+r.merchantContributions[id],0)/baselineRows.length])),
   cashContributionPassed=Object.values(merchantDeltas).every(v=>v>=0)&&['retailerUSD','wholesalerUSD','manufacturerUSD','terminalCashUSD'].every(k=>mean[k]>=old.reference.mean[k])&&mean.unpaidLiabilities===0;
  return {id:p.id,programHash:compileProgram(p.program).hash,mean,merchantDeltas,ratio:mean.platformUSD/old.reference.mean.platformUSD,deltaVsSameOutreachSKUPlannerUSD:mean.platformUSD-comparison.mean.platformUSD,cashContributionPassed,originalInventoryPassed:mean.terminalInventoryUSD<=old.reference.mean.terminalInventoryUSD*1.1};
 });
 const result={status:'COMPLETED',reference:old.reference,comparison,summary,goalAchieved:false,newModelCalls:0,nativePaymentCalls:0,heldOutOpened:false,environmentUnchanged:true,scope:'Local development ablation. Gains would establish a controller effect, not application-agent value or unseen generalization.'};
 await writeFile(dir+'/results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,summary}));
}catch(error){await writeFile(dir+'/failure.json',JSON.stringify({error:error.message,completedRows:rows.length},null,2)+'\n');throw error;}finally{allocator.close();}
