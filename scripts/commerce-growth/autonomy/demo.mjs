// One bounded autonomous demonstration, not an open-ended policy search.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {openAutonomousCommerce,scoreLearnedContacts} from './controller.mjs';
import {runCoordinatedCase} from '../team/runner.mjs';
import {openAllocator} from '../../commerce-deadlines/solver.mjs';
import {digest} from '../environment.mjs';
const root='docs/commerce-growth/autonomy-1',dir=root+'/demo-1',load=async p=>JSON.parse(await readFile(p,'utf8'));
await mkdir(dir);const fixed=(await load('docs/commerce-growth/team-1/development/results.json')).selectedFixed,prior=await load('docs/commerce-growth/team-1/training/model.json'),core=await load('docs/commerce-growth/development-1/protocol.json'),
 artifact=await load(root+'/training/models.json'),training=(await load(root+'/training/dataset.json')).rows,settings={seed:987401,regime:'discovery'},rows=[];
if(artifact.trainingEpisodes.includes(settings.seed))throw Error('DEMO_SEED_IN_TRAINING');
artifact.valueMeans=Object.fromEntries(['recommend','ask_need'].map(kind=>{const a=training.filter(r=>r.kind===kind),yes=a.filter(r=>r.retained),no=a.filter(r=>!r.retained);return [kind,{retainedNetCents:yes.reduce((s,r)=>s+r.retailNetCents,0)/Math.max(1,yes.length),failedNetCents:no.reduce((s,r)=>s+r.retailNetCents,0)/Math.max(1,no.length)}];}));
async function verify(){for(const [path,h]of Object.entries(core.sourceHashes))if(createHash('sha256').update(await readFile(path)).digest('hex')!==h)throw Error('FROZEN_ECONOMY_CHANGED');}
await verify();
const hashes={};for(const name of ['controller.mjs','features.mjs','train.py','demo.mjs']){const path='scripts/commerce-growth/autonomy/'+name;hashes[path]=createHash('sha256').update(await readFile(path)).digest('hex');await copyFile(path,dir+'/'+name);}
const protocol={createdAt:new Date().toISOString(),settings,fixed,arms:['strong_fixed','fixed_workflow_with_intent_model','autonomous_team'],modelCallCap:6,modelSpendCapUSD:.25,nativePaymentCalls:0,economyHashes:core.sourceHashes,controllerHashes:hashes,trainingDataHash:artifact.datasetHash,
 scope:'One fresh disjoint-seed demonstration. Same initial world, funds, needs and shocks. Shows operation and a paired economic comparison; not repeatable population superiority. Review boundaries hold virtual time in this offline comparison; live async integration is a separate implementation step. The2x target is not a prerequisite under the user scope clarification.'};
await writeFile(dir+'/protocol.json',JSON.stringify(protocol,null,2)+'\n');
const allocator=openAllocator();let team;
try{
 for(const arm of protocol.arms){let controller=null;
  if(arm==='fixed_workflow_with_intent_model'){const model={id:'HISTORICAL-'+digest(artifact).slice(0,12),family:artifact.selected,artifact,cutoff:30},campaign={audience:'all',contactKinds:'both',contactsPerDay:'10',minimumNetCents:'0',stopped:false};controller={plan:async view=>scoreLearnedContacts(view,{prior,model,campaign,supply:fixed.config})};}
  if(arm==='autonomous_team'){team=await openAutonomousCommerce({id:'DEMO-1',dir:dir+'/team',prior,incumbent:fixed.config});controller=team;}
  const result=await runCoordinatedCase(settings,{...fixed,id:arm},{controller,allocator,prior,trace:true});
  if(team){result.agent=team.summary();if(result.agent.modelCalls>6||result.agent.modelCostUSD>.25)throw Error('AUTONOMY_BUDGET_EXCEEDED');}
  const {trace,...row}=result;rows.push(row);await writeFile(dir+'/'+arm+'-trajectory.json',JSON.stringify(trace));await writeFile(dir+'/rows.json',JSON.stringify({rows},null,2)+'\n');console.log(JSON.stringify({arm,platformUSD:row.platformUSD,retailerUSD:row.retailerUSD,retainedPurchases:row.retainedPurchases,modelCalls:row.agent?.modelCalls||0,modelCostUSD:row.agent?.modelCostUSD||0,failed:row.agent?.failed||false}));
 }
 for(const key of ['initialHash','opportunityHash','consentHash','incomeCents'])if(new Set(rows.map(r=>r[key])).size!==1)throw Error('UNPAIRED_DEMO_'+key);
 await verify();const baseline=rows[0],agent=rows[2],afterCost=agent.platformUSD-agent.agent.modelCostUSD,result={status:'COMPLETED',settings,rows,platformRatio:afterCost/baseline.platformUSD,platformDeltaUSD:afterCost-baseline.platformUSD,retailerDeltaUSD:agent.retailerUSD-baseline.retailerUSD,recommendationDelta:agent.recommendationPurchases-baseline.recommendationPurchases,
  versusFixedMLUSD:afterCost-rows[1].platformUSD,autonomyCompleted:!agent.agent.failed&&agent.agent.trainingJobs>0&&agent.agent.publications>0,modelCostUSD:agent.agent.modelCostUSD,modelCalls:agent.agent.modelCalls,nativePayments:0,goalAchieved:false,scope:protocol.scope};
 await writeFile(dir+'/results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,ratio:result.platformRatio,platformDelta:result.platformDeltaUSD,retailerDelta:result.retailerDeltaUSD,autonomyCompleted:result.autonomyCompleted,costUSD:result.modelCostUSD}));
}catch(error){await writeFile(dir+'/failure.json',JSON.stringify({error:error.message,completedRows:rows.length},null,2)+'\n');throw error;}finally{await team?.close();allocator.close();}
