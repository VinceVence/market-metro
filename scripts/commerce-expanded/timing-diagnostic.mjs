// Conditional timing sensitivity, not a fresh-LLM policy benchmark.
// Both arms use the SAME historical-only first model and campaign. No second
// model or labels from the original live trajectory are imported.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {runCoordinatedCase} from './runner.mjs';
import {outreachPlan} from '../commerce-growth/team/control.mjs';
import {scoreLearnedContacts} from '../commerce-growth/autonomy/controller.mjs';
import {openAllocator} from '../commerce-deadlines/solver.mjs';

const read=async p=>JSON.parse(await readFile(p,'utf8'));
const dir='docs/commerce-expanded/timing-diagnostic-1';await mkdir(dir,{recursive:true});
const live=await read('docs/commerce-expanded/live-run-1.json'),training=live.steps.find(s=>s.actor==='LOCAL_MODEL'),publication=live.steps.find(s=>s.actor==='TRUSTED_PUBLISHER').output;
if(training.input.ownMatureRows!==0)throw Error('HISTORICAL_ONLY_MODEL_REQUIRED');
const path=resolve(dir,'models.json'),bytes=await readFile(path),artifact=JSON.parse(bytes),report=await read(path.replace('models.json','model-report.json'));
const model={id:training.output.modelId,cutoff:30,family:training.output.family,artifact,report,inquiryExpert:artifact.inquiryRouting||false,inquiryPrior:artifact.inquiryPrior,adaptiveFunding:artifact.adaptiveFunding,fundingPrior:artifact.fundingPrior,intentScope:artifact.intentScope};
const prior=await read('docs/commerce-growth/team-1/training/model.json'),fixed=(await read('docs/commerce-growth/team-1/development/results.json')).selectedFixed;
const protocol={seeds:[20261103,20261104],regime:'discovery',modelHash:createHash('sha256').update(bytes).digest('hex'),campaign:publication.campaign,supply:publication.supply,activationDays:{decision_barrier:30,wall_clock_delay:publication.effectiveDay},paidCalls:0,scope:'Timing-only comparison with a fixed previously chosen campaign and historical-only artifact; one previously seen seed plus one additional seed. No claim of fresh-agent superiority or causal marketing lift.'};
await writeFile(dir+'/protocol.json',JSON.stringify(protocol,null,2)+'\n');
const allocator=openAllocator(),rows=[];
try{
 for(const seed of protocol.seeds)for(const [arm,activationDay]of Object.entries(protocol.activationDays)){
  const controller={async plan(view){
   if(view.day<activationDay)return {...outreachPlan(view,fixed.config,prior),configuration:fixed.config};
   return scoreLearnedContacts(view,{prior,model,campaign:publication.campaign,supply:publication.supply});
  }};
  const result=await runCoordinatedCase({seed,regime:protocol.regime},{id:arm,config:fixed.config},{controller,allocator,prior});rows.push({arm,...result});
  await writeFile(dir+'/progress.json',JSON.stringify({status:'RUNNING',rows},null,2)+'\n');console.log(JSON.stringify({seed,arm,platformUSD:result.platformUSD,retailerUSD:result.retailerUSD,purchases:result.retainedPurchases}));
 }
 const paired=protocol.seeds.map(seed=>{
  const early=rows.find(r=>r.seed===seed&&r.arm==='decision_barrier'),late=rows.find(r=>r.seed===seed&&r.arm==='wall_clock_delay');
  for(const field of ['initialHash','opportunityHash','consentHash','incomeCents'])if(early[field]!==late[field])throw Error('TIMING_COMPARISON_MISMATCH_'+field);
  return {seed,netDeltaUSD:early.platformUSD-late.platformUSD,merchantDeltaUSD:early.retailerUSD-late.retailerUSD,purchaseDelta:early.retainedPurchases-late.retainedPurchases,volumeDeltaUSD:early.retainedVolumeUSD-late.retainedVolumeUSD};
 });
 const result={status:'COMPLETED',protocol,rows,paired,mean:Object.fromEntries(['netDeltaUSD','merchantDeltaUSD','purchaseDelta','volumeDeltaUSD'].map(k=>[k,paired.reduce((s,r)=>s+r[k],0)/paired.length]))};
 await writeFile(dir+'/result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.mean));
}finally{allocator.close();}
