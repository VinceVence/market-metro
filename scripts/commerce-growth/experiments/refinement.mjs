// One measured revision authored in this chat. No application LLM calls.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CONTRACT,digest} from '../environment.mjs';
import {compileProgram,op,field} from './program.mjs';
import {runProgramCase} from './runner.mjs';
import {runExperimentWorkflow} from './workflow.mjs';
import {openAllocator} from '../../commerce-deadlines/solver.mjs';
const root='docs/commerce-growth/experiments-1',merchantMode=process.argv.includes('--merchant-balance'),dir=root+(merchantMode?'/merchant-revision-1':'/balanced-revision-1');await mkdir(dir);
const load=async p=>JSON.parse(await readFile(p,'utf8')),
 study=await load(root+'/bundled-1/results.json'),protocol=await load(root+'/bundled-1/protocol.json'),
 prior=await load('docs/commerce-growth/team-1/training/model.json'),core=await load('docs/commerce-growth/development-1/protocol.json'),
 baseline=(await load('docs/commerce-growth/team-1/development/rows.json')).rows.filter(r=>r.policy===study.reference.policy.id),
 first=merchantMode?(await load(root+'/balanced-revision-1/revision-frozen.json')).revision:protocol.candidates[0],other=protocol.candidates[1],
 firstResult=merchantMode?await load(root+'/balanced-revision-1/results.json'):study.summary[0],
 revision=merchantMode?{id:'merchant_balanced_baskets',hypothesis:'Weight basket contribution using observed warmup merchant shares and post-warmup results, retaining the same contact and stock program.',program:{...first.program,basketScore:op('add',field('platform_usd'),op('mul',.001,field('balanced_retailer_usd')))}}:
 {id:'balanced_complete_baskets',hypothesis:'Blend historical and intent stock targets at48% intent weight: the two measured endpoints harm different retailers, and the inventory guard limits the admissible mixture.',program:{...first.program,stockTarget:op('add',op('mul',.52,first.program.stockTarget),op('mul',.48,other.program.stockTarget))}};
async function verify(){for(const [path,hash]of Object.entries(core.sourceHashes))if(createHash('sha256').update(await readFile(path)).digest('hex')!==hash)throw Error('FROZEN_ECONOMY_CHANGED');}
await verify();await writeFile(dir+'/revision-frozen.json',JSON.stringify({createdAt:new Date().toISOString(),first,revision,actorOrigin:'DEVELOPMENT_ASSISTANT_IN_CHAT_NO_APPLICATION_LLM',evidence:[...study.summary,firstResult],warning:'A proposed revision is not evidence that its financial guards will pass. Measure actual outcomes before publication.'},null,2)+'\n');
for(const name of ['program.mjs','baskets.mjs','runner.mjs','workflow.mjs','refinement.mjs'])await copyFile('scripts/commerce-growth/experiments/'+name,dir+'/'+name);
const measured=(p,s)=>({status:'COMPLETED',programHash:compileProgram(p.program).hash,modelHash:digest(prior),economyUnchanged:true,platformDeltaUSD:s.mean.platformUSD-study.reference.mean.platformUSD,cashAndContributionPassed:s.cashContributionPassed,originalInventoryPassed:s.originalInventoryPassed,metrics:s.mean,merchantDeltas:s.merchantDeltas,scope:'Matched development cases only. No unseen agent-performance claim.'});
const allocator=openAllocator(),rows=[];
try{
 const workflow=await runExperimentWorkflow({output:dir+'/workflow.json',modelHash:digest(prior),evidence:{actorOrigin:'Development assistant in this chat; local numerical execution, no application LLM invocation',earlierExperiments:study.summary,reference:study.reference},
  proposer:async()=>first,probe:async p=>{
   if(compileProgram(p.program).hash===compileProgram(first.program).hash)return measured(first,firstResult);
   for(const [regime,seed]of Object.entries(CONTRACT.developmentSeeds)){
    const r=await runProgramCase({regime,seed},{...p,id:revision.id},{allocator,prior}),b=baseline.find(r=>r.seed===seed);
    for(const key of ['initialHash','opportunityHash','consentHash','incomeCents'])if(r[key]!==b[key])throw Error('UNMATCHED_CASE_'+key);
    rows.push(r);await writeFile(dir+'/rows.json',JSON.stringify({rows},null,2)+'\n');console.log(JSON.stringify({regime,platform:r.platformUSD,retained:r.retainedPurchases}));
   }
   await verify();const mean=Object.fromEntries(Object.keys(study.summary[0].mean).map(k=>[k,rows.reduce((s,r)=>s+r[k],0)/rows.length])),merchantDeltas=Object.fromEntries(Object.keys(rows[0].merchantContributions).map(id=>[id,rows.reduce((s,r)=>s+r.merchantContributions[id],0)/rows.length-baseline.reduce((s,r)=>s+r.merchantContributions[id],0)/baseline.length])),
    summary={id:revision.id,mean,merchantDeltas,ratio:mean.platformUSD/study.reference.mean.platformUSD,cashContributionPassed:Object.values(merchantDeltas).every(v=>v>=0)&&['retailerUSD','wholesalerUSD','manufacturerUSD','terminalCashUSD'].every(k=>mean[k]>=study.reference.mean[k])&&mean.unpaidLiabilities===0,originalInventoryPassed:mean.terminalInventoryUSD<=study.reference.mean.terminalInventoryUSD*1.1,goalAchieved:false,newModelCalls:0};
   await writeFile(dir+'/results.json',JSON.stringify(summary,null,2)+'\n');return measured(p,summary);
  },reviewer:async()=>({decision:'revise',hypothesis:revision.hypothesis,program:revision.program,rationale:merchantMode?'The last stock-only revision still harms a merchant. Test observed contribution balancing in basket allocation without changing its outreach or inventory targets.':'Neither measured endpoint preserves every merchant. Test the mixture before any publication; do not assume its economics from interpolation.'}),
  closer:async({candidates})=>{const valid=Object.entries(candidates).filter(([,r])=>r.measurement.cashAndContributionPassed&&r.measurement.originalInventoryPassed&&r.measurement.platformDeltaUSD>0).sort((a,b)=>b[1].measurement.platformDeltaUSD-a[1].measurement.platformDeltaUSD);return valid.length?{selected:valid[0][0],measuredDeltaUSD:valid[0][1].measurement.platformDeltaUSD}:{selected:'observe',measuredDeltaUSD:0};}});
 console.log(JSON.stringify({status:workflow.status,selected:workflow.selected,published:!!workflow.artifact,goalAchieved:false}));
}finally{allocator.close();}
