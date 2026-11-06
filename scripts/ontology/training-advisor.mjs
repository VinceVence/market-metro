import {writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {FEATURE_VIEWS} from '../commerce-growth/autonomy/team-workbench-tools.mjs';
import {fitInquiryValue} from '../commerce-expanded/harness-v2/inquiry-value.mjs';
import {read,compileCampaign,scoreCampaign,assertBinding} from '../commerce-expanded/harness-v2/tools.mjs';
import {loadScaleInputs} from '../commerce-expanded/harness-v2/merchant-scale.mjs';
import {canonicalHash} from '../commerce-expanded/harness-v2/contracts.mjs';
import {verifyMerchantFeed} from '../../demo/commerce/feed-verifier.mjs';
import {observedReviewFeed} from './planner-gate.mjs';
import {observedMarket} from './planner-demo.mjs';
import {fitTrainingChoices,mapTrainingTask,productTask,trainingMatrix} from './training.mjs';

export const ontologyTrainingAdvisor={
  describe(historical,own,data,day){
    const spec={featureView:data.featureView,windowDays:Number(data.windowDays)};
    const matrix=trainingMatrix(historical,own,{artifact:{spec,featureNames:FEATURE_VIEWS[spec.featureView]}},day);
    const sku=matrix.rows.filter(r=>r.kind==='recommend'),markets=new Set(sku.map(r=>r.market)),positives=sku.filter(r=>r.target===1).length;
    const eligible=sku.length>=200&&positives>=20&&markets.size>=3&&[...markets].every(m=>{
      const train=sku.filter(r=>r.market!==m);return train.some(r=>r.target===1)&&train.some(r=>r.target===0);
    });
    return {title:'Mapped the prediction target to training data',eligible,opportunity:data.opportunity,
      body:`The retained-product training job has ${sku.length} mature recommendation rows and ${positives} positives. The ${matrix.rows.length-sku.length} productless inquiries have their own reply/value model.`,
      target:matrix.plan.target,grain:matrix.plan.grain,sourceMarkets:markets.size,recommendations:sku.length,retained:positives,
      inquiries:matrix.rows.length-sku.length,excluded:matrix.plan.excluded.map(e=>e.fields.join(', ')),
      featureTrials:matrix.plan.recipes.map(r=>({name:r.name,fields:r.fields.length})),
      action:eligible?'Use compare_ontology_features to fit a conventional first model and an action-specific boosted challenger. Compare on common product contacts; use settled campaign trials for publication.':'Keep the conventional training path until mature SKU support is sufficient.',
      analysis:'Funding this contact happens after targeting. Prior-day cohort funding is an available predictor. Actual net requires a paired settlement comparison.'};
  },
  async fit(dir,historical,own,base,day){
    const {models,audit}=await fitTrainingChoices(dir,historical,own,base,day);
    const model=models.ontology;
    model.report.featureTriage.recipe=audit.choices.ontology;
    await writeFile(join(dir,'model.json'),JSON.stringify(model));await writeFile(join(dir,'report.json'),JSON.stringify(model.report,null,2)+'\n');
    return model;
  }
};

let archive=null;
function study(){
  return archive??=Promise.all([read('demo/data/ontology-training.json'),
    readFile('docs/ontology/training/models.json.gz').then(b=>JSON.parse(gunzipSync(b))),
    read('demo/data/ontology-training-review.json')]).catch(e=>{archive=null;throw e;});
}
const key=a=>JSON.stringify([a.customerId,a.kind,a.catalogId]);
export async function trainingReview(task){
  const route=mapTrainingTask(task);
  if(route.decision==='HOLD_MISSING_LABEL')return {route};
  if(route.decision==='USE_INQUIRY_HEAD'){
    const {rows}=await read('docs/commerce-growth/autonomy-1/funding-training/dataset.json'),head=fitInquiryValue(rows.filter(r=>r.labelCompleteDay===r.day+26&&r.labelCompleteDay<126));
    return {route,rows:head.rows,cohorts:Object.fromEntries(Object.entries(head.groups).map(([k,g])=>[k,{contacts:g.n,replies:g.responded,retained:g.retained}]))};
  }
  const [result,bundle,launch]=await study();
  const evidence={quality:result.quality,totals:result.totals,promotion:result.promotion,recommendPromotion:result.recommendPromotion,
    cases:result.cases.map(c=>({seed:c.seed,regime:c.regime,outcomes:c.outcomes,changedDays:c.changedDays})),launch,newModelCalls:0,newPayments:0};
  if(route.decision==='RUN_PAIRED_SETTLEMENT')return {route,evidence};
  const [{contract,model:incumbent,prior},{view,runId}]=await Promise.all([loadScaleInputs(),observedMarket()]);
  const feed=verifyMerchantFeed(observedReviewFeed(view,runId));
  if(feed.decision!=='CERTIFY'||canonicalHash(view)!==contract.context.snapshotHash||incumbent.modelHash!==bundle.baselineHash)throw Error('UNVERIFIED_TRAINING_PREVIEW');
  const terms={...contract.campaign,contactsPer100:String(contract.campaign.contactsPer100),coverDays:String(contract.campaign.coverDays)};
  const candidate=bundle.models.ontology,updated=compileCampaign(terms,candidate,contract.configuration,contract.context);
  assertBinding(updated,candidate);
  const original=scoreCampaign(view,{contract,model:incumbent,prior}).actions,challenger=scoreCampaign(view,{contract:updated,model:candidate,prior}).actions;
  const a=new Set(original.map(key)),b=new Set(challenger.map(key));
  const describe=x=>({...x,product:x.catalogId?view.products.find(p=>p.catalogId===x.catalogId)?.title:null});
  return {route,checkpoint:bundle.audit,certified:feed.metrics.purchases,modelHash:candidate.modelHash,day:view.day+1,
    changes:{added:challenger.filter(x=>!a.has(key(x))).map(describe),removed:original.filter(x=>!b.has(key(x))).map(describe)},evidence};
}
