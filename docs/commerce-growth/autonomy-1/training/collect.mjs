// Enrich historical observations without changing the frozen economy. The
// fixed arm is instrumented through its existing controller hook, not edited.
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CONTRACT,digest} from '../environment.mjs';
import {outreachPlan} from '../team/control.mjs';
import {runCoordinatedCase} from '../team/runner.mjs';
import {contactFeatures} from '../experiments/program.mjs';
import {openAllocator} from '../../commerce-deadlines/solver.mjs';
import {RESPONSE_FIELDS,responseFeatures} from './features.mjs';
const dir='docs/commerce-growth/autonomy-1/training';await mkdir(dir);
const load=async p=>JSON.parse(await readFile(p,'utf8')),core=await load('docs/commerce-growth/development-1/protocol.json'),
 prior=await load('docs/commerce-growth/team-1/training/model.json'),development=await load('docs/commerce-growth/team-1/development/results.json'),fixed=development.selectedFixed,
 reference=(await load('docs/commerce-growth/team-1/development/rows.json')).rows.filter(r=>r.policy===fixed.id);
async function verify(){for(const [path,h]of Object.entries(core.sourceHashes))if(createHash('sha256').update(await readFile(path)).digest('hex')!==h)throw Error('FROZEN_ECONOMY_CHANGED');}
await verify();
const protocol={createdAt:new Date().toISOString(),features:RESPONSE_FIELDS,cases:CONTRACT.developmentSeeds,collectionPolicies:['fixed','observed_exploration'],fixed,modelCostUSD:0,nativePayments:0,economyHashes:core.sourceHashes,
 scope:'Historical synthetic training observations, not unseen evaluation or agent calls. Features captured before contact; labels use completed orders after the clearing tail. Exploration is hashed candidate ordering. Conditional purchase prediction, not causal uplift. Entire market episodes must stay together in validation.'};
await writeFile(dir+'/protocol.json',JSON.stringify(protocol,null,2)+'\n');for(const name of ['collect.mjs','features.mjs'])await copyFile('scripts/commerce-growth/autonomy/'+name,dir+'/'+name);
const allocator=openAllocator(),rows=[],episodes=[];
try{
 for(const [regime,seed]of Object.entries(CONTRACT.developmentSeeds))for(const mode of protocol.collectionPolicies){
  const observed=[],controller={async plan(view){
   const candidates=contactFeatures(view,prior,7);let plan=outreachPlan(view,fixed.config,prior);
   if(mode==='observed_exploration'){
    const limit=view.day>=30&&view.day<view.marketDays?Math.min(view.outreach.rules.dailyContactLimit-view.outreach.contactsToday,Math.floor(Math.min(view.outreach.remainingBudgetCents,view.outreach.availablePlatformCashCents)/view.outreach.rules.outreachCostCents)):0,
     choices=candidates.map(c=>({...c,priority:digest({salt:'observed-exploration-1',day:view.day,action:c.action})})).sort((a,b)=>a.priority.localeCompare(b.priority)),selected=[],seen=new Set();
    if(limit>0)for(const c of choices){if(seen.has(c.action.customerId))continue;seen.add(c.action.customerId);selected.push(c.action);if(selected.length>=limit)break;}
    plan={actions:selected,ranking:[],reason:'Historical data-collection exploration; no LLM invocation.'};
   }
   for(const action of plan.actions){const c=candidates.find(c=>c.action.customerId===action.customerId&&c.action.kind===action.kind&&c.action.catalogId===action.catalogId&&c.action.category===action.category);if(!c)throw Error('UNMATCHED_OBSERVATION');observed.push({episode:seed,regime,sourcePolicy:mode,day:view.day,customerId:action.customerId,kind:action.kind,catalogId:action.catalogId,x:responseFeatures(view,c)});}
   return {...plan,configuration:fixed.config};
  }};
  const result=await runCoordinatedCase({regime,seed},{id:'collect_'+mode},{controller,allocator,prior,trace:true}),expected=reference.find(r=>r.seed===seed);
  for(const key of ['initialHash','opportunityHash','consentHash','incomeCents'])if(result[key]!==expected[key])throw Error('UNMATCHED_COLLECTION_'+key);
  if(mode==='fixed')for(const k of ['platformUSD','retailerUSD','retainedPurchases','terminalCashUSD','terminalInventoryUSD'])if(Math.abs(result[k]-expected[k])>.0001)throw Error('FIXED_REPRODUCTION_FAILED_'+k);
  if(result.unpaidLiabilities)throw Error('UNMATURED_TRAINING_OUTCOME');
  for(const row of observed){const c=result.trace.contacts.find(c=>c.day===row.day&&c.customerId===row.customerId&&c.kind===row.kind&&c.catalogId===row.catalogId);if(!c)throw Error('UNMATCHED_CONTACT_OUTCOME');const o=result.trace.orders.find(o=>o.requestId===c.requestId),retained=Boolean(o&&!['SETTLED','PENDING_FUNDS'].includes(o.refundStatus));rows.push({...row,retained:Number(retained),retailNetCents:(o?(retained?o.feeCents:0)-o.processingCents:0)-c.costCents,retainedGrossCents:retained?o.grossCents:0,labelCompleteDay:row.day+26});}
  episodes.push({regime,seed,sourcePolicy:mode,rows:observed.length,retained:rows.filter(r=>r.episode===seed&&r.sourcePolicy===mode&&r.retained).length,platformUSD:result.platformUSD,reproducedFixed:mode==='fixed',unpaidLiabilities:0});
  await writeFile(dir+'/dataset.json',JSON.stringify({featureNames:RESPONSE_FIELDS,rows}));await writeFile(dir+'/progress.json',JSON.stringify({status:'RUNNING',episodes,rows:rows.length},null,2)+'\n');console.log(JSON.stringify(episodes.at(-1)));
 }
 await verify();const result={status:'COMPLETED',episodes,rows:rows.length,positiveRows:rows.filter(r=>r.retained).length,datasetHash:digest(rows),modelCalls:0,nativePayments:0,source:'OBSERVED_SYNTHETIC_TRAINING_ONLY'};await writeFile(dir+'/progress.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,rows:result.rows,positiveRows:result.positiveRows}));
}finally{allocator.close();}
