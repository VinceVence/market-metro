import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {mapTrainingTask,productTask,trainingMatrix} from '../scripts/ontology/training.mjs';
import {loadScaleInputs} from '../scripts/commerce-expanded/harness-v2/merchant-scale.mjs';
import {createSupplyYardServer} from '../scripts/serve.mjs';
import {selectTrainingFeatures,llmTrainingAdvisor} from '../scripts/ontology/planner-training.mjs';
import {toolDeclaration,validateToolReply,canonicalHash} from '../scripts/commerce-expanded/harness-v2/contracts.mjs';

const read=async path=>JSON.parse(await readFile(path,'utf8'));

test('real planner feature tools constrain time, grain and requested inputs before execution',()=>{
  const plan=mapTrainingTask(productTask);
  const allowed=plan.paths.flatMap(p=>p.fields),evidenceId=canonicalHash(plan);
  const definition=llmTrainingAdvisor.experiment({allowedFeatures:allowed});
  const tool=toolDeclaration(definition.name,definition.fields,evidenceId);
  const args={first:'boosted',target:productTask,features:['recency','search','market_response_rate'],rationale:'Test prior interest and observed responses.',evidenceId};
  validateToolReply({name:definition.name,args},[tool]);
  assert.deepEqual(selectTrainingFeatures(plan,args.features),['search','recency','market_response_rate']);
  assert.throws(()=>selectTrainingFeatures(plan,['search','recency','authorized']),/unavailable/);
  assert.throws(()=>selectTrainingFeatures(plan,['search','search','recency']),/Repeated/);
  assert.throws(()=>selectTrainingFeatures(plan,['recency','prior_purchases']),/intent/);
  assert.throws(()=>validateToolReply({name:definition.name,args:{...args,features:['search','authorized']}},[tool]),/CONTRACT_INVALID/);
});

test('the business question determines the label, observation time, entity and unit',()=>{
  const alias={name:'quiet_days',concept:'recency',entity:'shopper',unit:'days',availableAt:'before_contact'};
  const bad={name:'current_payment',concept:'market_authorization_rate',entity:'feedback',unit:'fraction',availableAt:'after_contact'};
  const mapped=mapTrainingTask(productTask,['search',alias,'market_authorization_rate',bad,'authorized','customerId','retailNetCents']);
  assert.deepEqual(mapped.bindings,{search:'search',recency:'quiet_days',market_authorization_rate:'market_authorization_rate'});
  assert.deepEqual(mapped.recipes.at(-1).fields,['search','quiet_days','market_authorization_rate']);
  assert.ok(mapped.excluded.some(row=>row.fields.includes('current_payment')));
  assert.throws(()=>mapTrainingTask(productTask,['search',{...alias,unit:'USD'}]),/MISSING_PRECONTACT_RELATION/);
  assert.throws(()=>mapTrainingTask(productTask,['search',alias,'recency']),/AMBIGUOUS_TRAINING_CONCEPT/);
  assert.equal(mapTrainingTask('inquiry_value').decision,'USE_INQUIRY_HEAD');
  assert.equal(mapTrainingTask('campaign_net').decision,'RUN_PAIRED_SETTLEMENT');
  assert.equal(mapTrainingTask('exact_sku').decision,'HOLD_MISSING_LABEL');
});

test('the training cohort excludes immature labels and rejects duplicate or mismatched contacts',async()=>{
  const [{model},{rows}]=await Promise.all([loadScaleInputs(),read('docs/commerce-growth/autonomy-1/funding-training/dataset.json')]);
  const original=trainingMatrix(rows,[],model,30);
  const products=original.rows.filter(r=>r.kind==='recommend');
  assert.deepEqual([original.rows.length,products.length,products.filter(r=>r.target).length],[2762,1230,116]);
  const contact={episode:-1,sourcePolicy:'current',day:30,labelCompleteDay:56,customerId:'holdout-shopper',
    observedBucket:'recommend|fresh|search',kind:'recommend',catalogId:'item',retained:1,featureVectors:{market_feedback:products[0].x}};
  assert.equal(trainingMatrix(rows,[contact],model,56).ownRows,0);
  assert.equal(trainingMatrix(rows,[contact],model,57).ownRows,1);
  assert.throws(()=>trainingMatrix(rows,[contact,contact],model,57),/DUPLICATE_TRAINING_CONTACT/);
  assert.throws(()=>trainingMatrix(rows,[{...contact,catalogId:null}],model,57),/INVALID_CONTACT_TRAINING_GRAIN/);
});

test('the controls, economic heads, source fingerprints and four financial results reconcile',async()=>{
  const [report,lock,launch,{model},data]=await Promise.all([
    read('demo/data/ontology-training.json'),read('docs/ontology/training/holdout.json'),
    read('demo/data/ontology-training-review.json'),loadScaleInputs(),readFile('docs/ontology/training/models.json.gz')
  ]);
  assert.deepEqual(report.lock,lock);
  for(const [file,hash] of Object.entries(lock.sources)){
    assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'),hash,file);
  }
  assert.deepEqual(report.cases.map(({seed,regime})=>({seed,regime})),lock.cases);
  const bundle=JSON.parse(gunzipSync(data)),candidate=bundle.models.ontology.artifact;
  for(const key of ['valueModel','valueMeans','sharedValueMeans','sharedValueModel','inquiryValue']){
    assert.deepEqual(candidate[key],model.artifact[key]);
  }
  assert.deepEqual(bundle.audit.search.statistical.map(r=>r.fields),bundle.audit.search.ontology.map(r=>r.fields));
  assert.equal(bundle.audit.selected.statistical.fields.length,candidate.trainingFields.length);
  for(const tree of candidate.models.boosted.trees){
    for(const ix of tree.feature.filter(i=>i>=0))assert.ok(candidate.trainingFields.includes(candidate.featureNames[ix]));
  }
  for(const key of Object.keys(report.totals)){
    for(const metric of ['paypal','merchants','purchases']){
      const sum=report.cases.reduce((s,c)=>s+c.outcomes[key][metric],0);
      assert.ok(Math.abs(sum-report.totals[key][metric])<0.00001);
    }
    if(key!=='fixed')assert.deepEqual([report.quality[key].n,report.quality[key].positives],[4865,679]);
  }
  assert.ok(report.cases[0].outcomes.ontology.paypal<report.cases[0].outcomes.incumbent.paypal);
  assert.equal(report.recommendPromotion,true);
  assert.deepEqual([launch.fitCount,launch.modelCheck,launch.decision,launch.newModelCalls,launch.newPayments],[2,'switched','publish',0,0]);
  assert.equal(launch.incumbentHash,bundle.baselineHash);
  assert.deepEqual(launch.featureJob.fields,candidate.trainingFields);
  assert.equal(launch.verifiedReceipt,launch.challengerTrial.receiptHash);
  assert.equal(launch.selectedContractHash,launch.challengerTrial.contractHash);
});

test('judge routes return the selected analysis and score the recorded snapshot without a provider',async()=>{
  const server=createSupplyYardServer({},null,null);
  try{
    server.listen(0,'127.0.0.1');await once(server,'listening');
    const url='http://127.0.0.1:'+server.address().port+'/api/market/ontology/training?task=';
    const result=async task=>{const r=await fetch(url+task);assert.equal(r.status,200);return r.json();};
    const [fit,inquiry,hold,settled]=await Promise.all([productTask,'inquiry_value','exact_sku','campaign_net'].map(result));
    assert.deepEqual([fit.day,fit.certified,fit.changes.added.length,fit.changes.removed.length],[31,715,4,4]);
    assert.ok(fit.changes.removed.some(r=>r.product==='Stacking Office Stool'&&r.customerId==='BUYER-0585'));
    assert.ok(fit.changes.added.some(r=>r.kind==='ask_need'&&r.customerId==='BUYER-0346'));
    assert.equal(inquiry.rows,3890);assert.equal(Object.values(inquiry.cohorts).reduce((n,c)=>n+c.contacts,0),inquiry.rows);
    assert.equal(hold.route.decision,'HOLD_MISSING_LABEL');assert.equal(hold.checkpoint,undefined);
    assert.equal(settled.route.decision,'RUN_PAIRED_SETTLEMENT');assert.deepEqual(settled.evidence,fit.evidence);
    assert.equal((await fetch(url+'unknown')).status,400);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
