// Exercise the default single planner's training and financial tools without a provider.
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {openCommerceHarnessV2} from '../commerce-expanded/harness-v2/controller.mjs';
import {loadScaleInputs} from '../commerce-expanded/harness-v2/merchant-scale.mjs';
import {canonicalHash} from '../commerce-expanded/harness-v2/contracts.mjs';
import {observedMarket} from './planner-demo.mjs';
import {withPlannerFeed} from './planner-gate.mjs';
import {ontologyTrainingAdvisor} from './training-advisor.mjs';

const root='.local/ontology-training/reviews';await mkdir(root,{recursive:true});
const dir=await mkdtemp(join(root,'review-'));
const {view,runId}=await observedMarket(),{contract,model,prior}=await loadScaleInputs();
const terms={...contract.campaign,contactsPer100:String(contract.campaign.contactsPer100),coverDays:String(contract.campaign.coverDays)};
const selected=[];
const localTools={events:[],async json(_instructions,p,{functions}){
  let name=functions[0].name,args;
  switch(name){
    case 'choose_investigation':assert.equal(p.overview.certifiedPurchaseHistory.checkouts,view.pastOrders.length);args={lens:'category',windowDays:'28'};break;
    case 'define_dataset':args={featureView:'market_feedback',windowDays:'28',opportunity:'Evaluate retained purchases following product-specific recommendations.'};break;
    case 'choose_training_experiments':assert.ok(p.trainingAdvice.eligible);name='compare_ontology_features';args={first:'boosted'};break;
    case 'select_trained_artifact':assert.equal(p.experiments.length,2);assert.ok(p.experiments[1].report.featureTriage);
      args={modelId:p.experiments[0].modelId,finding:'Test the existing ranking first, then compare the ontology challenger on identical terms.'};break;
    case 'propose_campaign_trial':args={campaign:terms};break;
    case 'propose_campaign_revision':name='finish_review';args={};break;
    default:throw Error('Unexpected replay tool '+name);
  }
  assert.ok(functions.some(f=>f.name===name));selected.push(name);
  return {name,args:{...args,evidenceId:p.evidenceId,rationale:'Offline scripted tool selection for a matched, numerically verified campaign trial.'}};
}};
const planner=await openCommerceHarnessV2({id:'ontology-local-review',dir,mode:'single',modelCheck:true,trainingAdvisor:ontologyTrainingAdvisor,
  prior,incumbent:contract.configuration,providerFactory:async()=>({client:localTools,async close(){}})});
const gated=withPlannerFeed(planner,{runId,mapping:'two-links'});
try{
  const held=await gated.plan(view);assert.ok(held.held);assert.equal(selected.length,0);
  gated.correctMapping(held.holdId,'basket_id');await gated.plan(view);
  const s=gated.summary();assert.equal(s.failed,false,JSON.stringify(s.checkpoints.filter(c=>c.status==='FAILED')));
  assert.equal(s.trainingJobs,2);assert.equal(s.modelCalls,0);assert.equal(s.modelCostUSD,0);assert.equal(selected.length,6);
  const experiment=s.checkpoints.find(c=>c.actor==='LOCAL_MODEL_COMPARISON')?.output,publisher=s.checkpoints.find(c=>c.actor==='TRUSTED_PUBLISHER')?.output;
  assert.ok(experiment&&publisher);assert.equal(s.training[0].modelHash,model.modelHash);
  const fitted=JSON.parse(await readFile(join(dir,'review-'+view.day,'fit-1','model.json'),'utf8'));
  const frozen=JSON.parse(gunzipSync(await readFile('docs/ontology/training/models.json.gz'))).models.ontology;
  assert.deepEqual(fitted.artifact.models,frozen.artifact.models);
  assert.deepEqual(fitted.artifact.trainingFields,frozen.artifact.trainingFields);
  const result={driver:'SCRIPTED_TOOL_CHOICES_WITH_REAL_LOCAL_FITS_AND_REAL_DEVELOPMENT_TRIALS',day:view.day+1,seed:92111706,
    observationHash:canonicalHash(view),tools:selected,fitCount:s.trainingJobs,incumbentHash:model.modelHash,challengerHash:s.training[1].modelHash,
    featureJob:s.training[1].report.featureTriage,decision:publisher.decision,selectedContractHash:publisher.selectedContractHash,
    modelCheck:experiment.status,reason:experiment.reason,failedChecks:experiment.failedChecks??[],incumbentTrial:experiment.anchor??null,
    challengerTrial:experiment.alternative??null,verifiedReceipt:publisher.receiptHash,newModelCalls:0,newPayments:0};
  const path=process.argv.includes('--publish')?'demo/data/ontology-training-review.json':join(dir,'result.json');
  await writeFile(path,JSON.stringify(result,null,2)+'\n');console.log(path,JSON.stringify(result));
}finally{await gated.close();}
