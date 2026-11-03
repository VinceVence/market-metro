// Numerical development-only economics check. No new LLM or confirmation data.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {digest} from '../environment.mjs';
import {runCoordinatedCase} from '../team/runner.mjs';
import {openAllocator} from '../../commerce-deadlines/solver.mjs';
import {workbenchPlan} from './team-workbench-tools.mjs';
import {summarizeExperiment} from './decision-study.mjs';
const dir='docs/commerce-growth/roc-net-goal-1/feedback-commerce-1',root='docs/commerce-growth/roc-net-goal-1/feedback-probe-1',load=async p=>JSON.parse(await readFile(p,'utf8'));await mkdir(dir);
const old=await load('docs/commerce-growth/team-workbench-1/confirmation-rows.json'),p=await load('docs/commerce-growth/team-workbench-1/protocol.json'),prior=await load('docs/commerce-growth/team-1/training/model.json'),fundingPrior=await load('docs/commerce-growth/autonomy-1/funding-training/funding-prior.json'),fixed=(await load('docs/commerce-growth/team-1/development/results.json')).selectedFixed,
 candidates=['forest','boosted'].flatMap(family=>[{kind:'intent_assistance',objective:'joint'},{kind:'ranked_discovery',objective:'paypal'}].map(campaign=>({family,campaign}))),rows=[],summaries=[],allocator=openAllocator();
await writeFile(dir+'/protocol.json',JSON.stringify({source:'NUMERICAL_DEVELOPMENT_PROBE',cases:p.confirmation,candidates,modelCalls:0,freshConfirmation:false},null,2)+'\n');
try{for(const c of candidates){const artifact=await load(root+'/'+c.family+'/models.json'),model={id:'PROBE-'+digest(artifact).slice(0,16),modelHash:digest(artifact),artifact},id=c.family+'_'+c.campaign.kind,group=[];
 for(const settings of p.confirmation){const r=await runCoordinatedCase(settings,{id},{allocator,prior,controller:{plan:async view=>workbenchPlan(view,{model,campaign:c.campaign,prior,fundingPrior,configuration:fixed.config})}}),f=old.fixed.find(x=>x.seed===r.seed);for(const k of ['initialHash','opportunityHash','consentHash','incomeCents'])if(r[k]!==f[k])throw Error('UNMATCHED_CASE');group.push(r);rows.push(r);await writeFile(dir+'/rows.json',JSON.stringify({rows},null,2)+'\n');console.log(JSON.stringify({id,regime:r.regime,platform:r.platformUSD,retailers:r.retailerUSD}));}
 const summary={id,family:c.family,campaign:c.campaign,...summarizeExperiment(group,old.fixed),versusExistingNumerical:summarizeExperiment(group,old.numerical)};summaries.push(summary);await writeFile(dir+'/results.json',JSON.stringify({status:summaries.length===candidates.length?'COMPLETED':'RUNNING',summaries,modelCalls:0,freshConfirmation:false},null,2)+'\n');
}console.log(JSON.stringify(summaries.map(s=>({id:s.id,netGain:s.platformDeltaUSD,retailerGain:s.retailerDeltaUSD,vsNumerical:s.versusExistingNumerical.platformDeltaUSD})),null,2));}finally{allocator.close();}
