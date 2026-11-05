import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {prepareTraining} from '../commerce-growth/autonomy/team-workbench-tools.mjs';
import {predictResponse,RESPONSE_FIELDS} from '../commerce-growth/autonomy/features.mjs';
import {MARKET_FEEDBACK_FIELDS} from '../commerce-growth/autonomy/feedback-features.mjs';
import {digest} from '../commerce-expanded/harness-v2/tools.mjs';

// Each relation names the entity supplying the value and when it is available.
// These are reviewed candidate paths. Historical validation decides which paths to retain.
const relations=[
  {id:'intent',path:'Recommendation → product interest observed before contact',fields:['age','search','signal_count','category_affinity','sku_purchase_recency','signal_after_sku_purchase','customer_intent_fresh','customer_intent_recent']},
  {id:'shopper',path:'Contact → shopper → earlier checkouts',fields:['recency','prior_purchases']},
  {id:'offer',path:'Recommendation → listed item → current price, category and available supply',fields:['price_usd','stock','arrival_days','stationery','electronics','furniture','bundles']},
  {id:'feedback',path:'Contact → same action in earlier market history',fields:MARKET_FEEDBACK_FIELDS}
];
const excluded=[
  {fields:['responded','authorized','fundingObservedDay'],reason:'Outcomes of the current contact become known after targeting.'},
  {fields:['retained','retainedGrossCents','retailNetCents','merchantOrderContributionCents','labelCompleteDay'],reason:'Settlement supplies labels, evaluation values and maturity checks.'},
  {fields:['customerId','catalogId','episode','regime','sourcePolicy'],reason:'Keys and market identifiers support joins, grouping or validation.'},
  {fields:['is_recommendation'],reason:'Contact kind is constant inside the product recommendation cohort.'}
];
// The names in the frozen feature store are one physical mapping of these concepts.
// Callers with a data dictionary can supply aliases and timing/grain declarations.
const units={age:'days',search:'flag',signal_count:'count',category_affinity:'fraction',sku_purchase_recency:'days',
  signal_after_sku_purchase:'flag',customer_intent_fresh:'flag',customer_intent_recent:'flag',recency:'days',
  prior_purchases:'checkouts',price_usd:'USD',stock:'units',arrival_days:'days',stationery:'flag',electronics:'flag',
  furniture:'flag',bundles:'flag',market_contacts_log:'log count',market_response_rate:'fraction',
  market_authorization_rate:'fraction',market_mature_retention_rate:'fraction'};
function bindFeatures(columns){
  const fields=[],rejected=[],bindings={};
  const names=new Set();
  for(const c of columns){
    const name=typeof c==='string'?c:c?.name,concept=typeof c==='string'?c:c?.concept;
    if(typeof name!=='string'||!name||names.has(name))throw Error('AMBIGUOUS_TRAINING_SCHEMA');
    names.add(name);
    const relation=relations.find(r=>r.fields.includes(concept));
    let reason;
    const protectedName=excluded.find(r=>r.fields.includes(name));
    if(protectedName)reason=protectedName.reason;
    else if(!relation)reason=excluded.find(r=>r.fields.includes(concept))?.reason??'No reviewed pre-contact relation.';
    else if(Object.hasOwn(units,name)&&name!==concept)reason='The known source field conflicts with the proposed concept.';
    else if(typeof c!=='string'&&(c.availableAt!=='before_contact'||c.entity!==relation.id||c.unit!==units[concept]))
      reason='Availability, entity grain or units disagree with the reviewed feature definition.';
    if(reason){rejected.push({fields:[name],reason});continue;}
    if(Object.hasOwn(bindings,concept))throw Error('AMBIGUOUS_TRAINING_CONCEPT');
    bindings[concept]=name;fields.push(concept);
  }
  return {fields,rejected,bindings};
}
export const productTask='retained_recommendation';
export function mapTrainingTask(task,available=[...RESPONSE_FIELDS,...MARKET_FEEDBACK_FIELDS]){
  if(task==='inquiry_value')return {task,decision:'USE_INQUIRY_HEAD',target:'Reply and settled value following a needs inquiry',grain:'One consented needs inquiry',
    paths:['Inquiry → shopper’s prior intent bucket','Inquiry → earlier replies and mature payment / merchant outcomes'],
    excluded:['SKU price, stock and SKU purchase recency have no product to refer to.'],tool:'fitInquiryValue / inquiryValueEstimates'};
  if(task==='campaign_net')return {task,decision:'RUN_PAIRED_SETTLEMENT',target:'Incremental modeled PayPal and merchant contribution',grain:'One policy and matched counterfactual per market',
    paths:['Published campaign → funded request → capture → fulfillment and refunds','Same market → comparator policy → settled net'],
    excluded:['A single contact’s realized fee cannot identify counterfactual campaign profit.'],tool:'runCoordinatedCase'};
  if(task==='exact_sku')return {task,decision:'HOLD_MISSING_LABEL',target:'Retained purchase containing the exact recommended SKU',grain:'One product recommendation',
    paths:['Recommendation → request → retained basket → fulfilled item'],excluded:['Historical contact training rows lack the fulfilled basket item IDs.'],tool:null};
  if(task!==productTask)throw Error('UNKNOWN_TRAINING_TASK');
  if(!Array.isArray(available))throw Error('AMBIGUOUS_TRAINING_SCHEMA');
  const {fields,rejected,bindings}=bindFeatures(available);
  const paths=relations.map(r=>({...r,fields:r.fields.filter(f=>fields.includes(f))})).filter(r=>r.fields.length);
  if(!paths.some(p=>p.id==='intent')||!paths.some(p=>p.id==='shopper'))throw Error('MISSING_PRECONTACT_RELATION');
  const recipes=[];
  for(const [name,groups] of [['intent_shopper',['intent','shopper']],['with_supply',['intent','shopper','offer']],
    ['with_market_history',['intent','shopper','feedback']],['all_linked',['intent','shopper','offer','feedback']]]){
    const allowed=new Set(paths.filter(r=>groups.includes(r.id)).flatMap(r=>r.fields)),cols=fields.filter(f=>allowed.has(f)).map(f=>bindings[f]);
    if(!recipes.some(r=>r.fields.join('|')===cols.join('|')))recipes.push({name,fields:cols});
  }
  return {task,decision:'FIT_PRODUCT_MODEL',target:'A retained basket following a product recommendation',grain:'One product contact with a catalog item',
    label:'retained',maturityDays:26,paths,recipes,bindings,excluded:[...excluded,...rejected.filter(r=>!excluded.some(e=>e.fields.includes(r.fields[0])))]};
}

export function trainingMatrix(historical,own,base,day){
  const spec=base.artifact.spec;
  const completed=historical.filter(r=>r.labelCompleteDay===r.day+26 && r.labelCompleteDay<126);
  const data=prepareTraining(completed,{featureView:spec.featureView,windowDays:spec.windowDays});
  if(JSON.stringify(data.featureNames)!==JSON.stringify(base.artifact.featureNames))throw Error('TRAINING_SERVING_SCHEMA_MISMATCH');
  const recent=own.filter(r=>r.day>=Math.max(30,day-spec.windowDays)&&r.labelCompleteDay===r.day+26&&r.labelCompleteDay<day);
  const records=[...data.rows,...recent.map(r=>({...r,x:r.featureVectors?.[spec.featureView]}))];
  const keys=new Set(),indicator=data.featureNames.indexOf('is_recommendation');
  const rows=records.map(r=>{
    if(!['ask_need','recommend'].includes(r.kind)||!r.customerId||!r.sourcePolicy||!Number.isInteger(r.episode)||!Number.isInteger(r.day)||
      !Array.isArray(r.x)||r.x.length!==data.featureNames.length||r.x.some(v=>!Number.isFinite(v))||
      Boolean(r.catalogId)!==(r.kind==='recommend')||r.x[indicator]!==Number(r.kind==='recommend')||![0,1].includes(r.retained))throw Error('INVALID_CONTACT_TRAINING_GRAIN');
    const key=JSON.stringify([r.episode,r.sourcePolicy,r.day,r.customerId]);
    if(keys.has(key))throw Error('DUPLICATE_TRAINING_CONTACT');keys.add(key);
    return {market:r.episode,kind:r.kind,bucket:r.observedBucket.split('|')[2],target:r.retained,x:r.x};
  });
  return {names:data.featureNames,rows,plan:mapTrainingTask(productTask,data.featureNames),
    historyRows:completed.length,unmatured:historical.length-completed.length+own.filter(r=>r.labelCompleteDay>=day).length,
    ownRows:recent.filter(r=>r.kind==='recommend').length};
}

export async function fitTrainingChoices(dir,historical,own,base,day,{controls=false}={}){
  const matrix=trainingMatrix(historical,own,base,day);await mkdir(dir,{recursive:true});
  const job={...matrix,controls};const dataHash=digest(job);
  await writeFile(join(dir,'feature-job.json'),JSON.stringify(job));
  await promisify(execFile)(resolve('.local/marketing-venv/bin/python'),[resolve('scripts/ontology/train-features.py'),resolve(dir)],
    {timeout:240000,maxBuffer:250000});
  const output=JSON.parse(await readFile(join(dir,'feature-fits.json'),'utf8')),models={};
  for(const [id,fit] of Object.entries(output.fits)){
    const spec={family:'boosted',windowDays:base.artifact.spec.windowDays,featureView:base.artifact.spec.featureView,
      trainingTask:productTask,selection:id};
    const artifact={...base.artifact,selected:'boosted',models:{boosted:fit.classifier},trainingRows:fit.report.rows,
      trainingEpisodes:fit.markets,datasetHash:dataHash,spec,trainingFields:fit.fields};
    for(const p of fit.parity)if(Math.abs(predictResponse(fit.classifier,p.x,matrix.names)-p.probability)>1e-9)throw Error('FEATURE_MODEL_SERVING_PARITY');
    const modelHash=digest(artifact),report={...fit.report,spec,featureTriage:{selection:id,fields:fit.fields,rows:fit.report.rows,positive:fit.report.positives,
      target:matrix.plan.target},inquiryValue:base.report?.inquiryValue,scope:'Whole historical markets held out. Quality on product contacts only.'};
    models[id]={id:'V2-MODEL-'+modelHash.slice(0,12),modelHash,artifact,report,cutoffDay:day,ownRows:matrix.ownRows};
  }
  const audit={version:'ontology-training-1',plan:matrix.plan,inputFields:matrix.names,historyRows:matrix.historyRows,windowRows:matrix.rows.length,
    routedToInquiries:matrix.rows.filter(r=>r.kind==='ask_need').length,unmatured:matrix.unmatured,dataHash,
    choices:output.choices,selected:Object.fromEntries(Object.entries(models).map(([id,m])=>[id,m.report.featureTriage])),
    search:output.search};
  await writeFile(join(dir,'training-checkpoint.json'),JSON.stringify(audit,null,2)+'\n');
  return {models,audit};
}
