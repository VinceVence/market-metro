// One development revision based on the measured store-profit loss. This is
// authored in the current chat, not represented as a fresh application LLM run.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CONTRACT,digest} from '../environment.mjs';
import {compileProgram,SEED_PROGRAMS,field} from './program.mjs';
import {runProgramCase} from './runner.mjs';
import {openAllocator} from '../../commerce-deadlines/solver.mjs';
import {runExperimentWorkflow} from './workflow.mjs';
const root='docs/commerce-growth/experiments-1',dir=root+'/revision-1';await mkdir(dir);
const local=JSON.parse(await readFile(root+'/local-probe/results.json','utf8')),prior=JSON.parse(await readFile('docs/commerce-growth/team-1/training/model.json','utf8')),
 baseRows=JSON.parse(await readFile('docs/commerce-growth/team-1/development/rows.json','utf8')).rows.filter(r=>r.policy===local.reference.policy.id),
 original=SEED_PROGRAMS.find(p=>p.id==='response_value'),revision={...original,id:'neutral_merchant_revision',hypothesis:'Remove the margin-ranking tie-break that concentrates traffic at the lowest-cost retailer, while keeping the response-value outreach policy.',program:{...original.program,basketScore:field('platform_usd')}};
await writeFile(dir+'/revision-frozen.json',JSON.stringify({createdAt:new Date().toISOString(),original,revision,source:'DEVELOPMENT_ASSISTANT_AUTHORED_NO_APPLICATION_LLM_CALLS',modelHash:digest(prior)},null,2)+'\n');
const allocator=openAllocator(),rows=[];
try{
 for(const [regime,seed]of Object.entries(CONTRACT.developmentSeeds)){const r=await runProgramCase({regime,seed},revision,{allocator,prior});rows.push(r);await writeFile(dir+'/rows.json',JSON.stringify({rows},null,2)+'\n');console.log(JSON.stringify({regime,platform:r.platformUSD,retailer:r.retailerUSD,cash:r.terminalCashUSD,merchantContributions:r.merchantContributions}));}
 const keys=Object.keys(local.summary[0].mean),mean=Object.fromEntries(keys.map(k=>[k,rows.reduce((s,r)=>s+r[k],0)/rows.length])),merchantDeltas=Object.fromEntries(Object.keys(rows[0].merchantContributions).map(id=>[id,rows.reduce((s,r)=>s+r.merchantContributions[id],0)/rows.length-baseRows.reduce((s,r)=>s+r.merchantContributions[id],0)/baseRows.length]));
 const contributionPassed=['retailerUSD','wholesalerUSD','manufacturerUSD','terminalCashUSD'].every(k=>mean[k]>=local.reference.mean[k])&&Object.values(merchantDeltas).every(v=>v>=0)&&mean.unpaidLiabilities===0;
 const summary={id:revision.id,mean,merchantDeltas,ratio:mean.platformUSD/local.reference.mean.platformUSD,cashContributionPassed:contributionPassed,originalInventoryPassed:mean.terminalInventoryUSD<=local.reference.mean.terminalInventoryUSD*1.1,goalAchieved:false,newModelCalls:0};
 await writeFile(dir+'/results.json',JSON.stringify(summary,null,2)+'\n');
 const core=JSON.parse(await readFile('docs/commerce-growth/development-1/protocol.json','utf8'));for(const [file,h]of Object.entries(core.sourceHashes))if(createHash('sha256').update(await readFile(file)).digest('hex')!==h)throw Error('FROZEN_ECONOMY_CHANGED');
 function measured(program,row){return {status:'COMPLETED',programHash:compileProgram(program).hash,modelHash:digest(prior),economyUnchanged:true,platformDeltaUSD:row.mean.platformUSD-local.reference.mean.platformUSD,cashAndContributionPassed:row.cashContributionPassed,originalInventoryPassed:row.originalInventoryPassed,metrics:row.mean,merchantDeltas:row.merchantDeltas,scope:'Previously completed matched development probe; no unseen performance claim.'};}
 const a=measured(original.program,local.summary.find(r=>r.id==='response_value')),b=measured(revision.program,summary);
 const workflow=await runExperimentWorkflow({modelHash:digest(prior),output:dir+'/workflow.json',evidence:{source:'Recorded development experiments',problem:'A positive aggregate result masked a loss at MERCHANT-0',actorOrigin:'Development assistant in this chat; no application-model invocation'},
  proposer:async()=>original,probe:async p=>compileProgram(p.program).hash===a.programHash?a:b,
  reviewer:async()=>({decision:'revise',hypothesis:revision.hypothesis,program:revision.program,rationale:'Measured per-store loss warrants testing a neutral allocation objective instead of assuming aggregate margin maximization helps every merchant.'}),
  closer:async()=>{const feasible=[['A',a],['B',b]].filter(([,r])=>r.cashAndContributionPassed&&r.originalInventoryPassed&&r.platformDeltaUSD>0).sort((x,y)=>y[1].platformDeltaUSD-x[1].platformDeltaUSD);return feasible.length?{selected:feasible[0][0],measuredDeltaUSD:feasible[0][1].platformDeltaUSD}:{selected:'observe',measuredDeltaUSD:0};}});
 console.log(JSON.stringify({...summary,workflowSelected:workflow.selected,published:!!workflow.artifact}));
}finally{allocator.close();}
