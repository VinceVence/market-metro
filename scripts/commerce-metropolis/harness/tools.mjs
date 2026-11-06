import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
import {digest} from '../../commerce-growth/environment.mjs';
import {predictResponse,predictContribution,predictSharedContribution} from '../../commerce-growth/autonomy/features.mjs';
import {prepareTraining,FEATURE_VIEWS,datasetOverview,inspectDemand} from '../../commerce-growth/autonomy/team-workbench-tools.mjs';
import {validateConfig} from '../../commerce-growth/team/control.mjs';
import {VERSION,campaignSchema,contextSchema,validate,freeze,canonicalHash,marketProfileFor} from './contracts.mjs';
import {fitInquiryValue,inquiryValueEstimates,inquiryBucket} from '../../commerce-expanded/harness-v2/inquiry-value.mjs';

export {digest,datasetOverview,inspectDemand};
export const read=async p=>JSON.parse(await readFile(p,'utf8'));
export const FEATURES=['existing','intent_context','market_feedback'];
export const FAMILIES=['forest','logistic','response_hurdle','boosted'];
export const KINDS=campaignSchema.properties.kind.enum;

const viewCaches=new WeakMap();
function indexed(view){
 let c=viewCaches.get(view);if(c)return c;
 c={people:new Map(view.audience.map(p=>[p.customerId,p])),products:new Map(view.products.map(p=>[p.id,p])),
  catalog:new Map(),byCatalog:new Map(),orders:new Map(),signals:new Map(),ordersByRequest:new Map(view.pastOrders.map(o=>[o.requestId,o])),feedback:{},candidates:null};
 const push=(map,key,row)=>{if(!map.has(key))map.set(key,[]);map.get(key).push(row);};
 for(const p of view.products){if(!c.catalog.has(p.catalogId))c.catalog.set(p.catalogId,p);push(c.byCatalog,p.catalogId,p);}
 for(const o of view.pastOrders)push(c.orders,o.customerId,o);
 for(const s of view.signals)if(view.day-s.day<=7)push(c.signals,s.customerId,s);
 for(const kind of ['recommend','ask_need']){
  const recent=view.outreach.history.filter(r=>r.kind===kind&&r.day<view.day&&r.day>=view.day-28),mature=view.outreach.history.filter(r=>r.kind===kind&&r.day>=view.day-54&&r.day+26<view.day);
  c.feedback[kind]={market_contacts_log:Math.log1p(recent.length/(view.scale.contactMultiplier||1)),
   market_response_rate:(recent.filter(r=>r.responded).length+1)/(recent.length+4),market_authorization_rate:(recent.filter(r=>r.authorized).length+1)/(recent.length+4),
   market_mature_retention_rate:(mature.filter(r=>{const o=c.ordersByRequest.get(r.requestId);return o&&!['SETTLED','PENDING_FUNDS'].includes(o.refundStatus);}).length+1)/(mature.length+10)};
 }
 viewCaches.set(view,c);return c;
}

function candidates(view,prior){
 const cache=indexed(view);if(cache.candidates)return cache.candidates;
 const result=[];
 const inventory=new Map([...cache.byCatalog].map(([id,products])=>{const ids=new Set(products.map(p=>p.id)),stock=products.reduce((n,p)=>n+p.available,0),inbound=view.inbound.filter(p=>ids.has(p.productId));return [id,{stock,arrival:stock>0?0:inbound.length?Math.max(0,Math.min(...inbound.map(p=>(p.confirmedArrivalDay??p.latestArrivalDay)-view.day))):99}];}));
 for(const person of view.audience){
  if(!person.marketingConsent||person.hasOpenRequest||person.lastContactDay!=null&&view.day-person.lastContactDay<view.outreach.rules.customerContactGapDays)continue;
  const signal=person.signal,age=signal?view.day-signal.day:99,orders=cache.orders.get(person.customerId)||[];
  const items=orders.flatMap(o=>o.items),categoryCounts=new Map();
  for(const item of items){const category=cache.products.get(item.productId)?.category;categoryCounts.set(category,(categoryCounts.get(category)||0)+1);}
  for(const kind of signal?['recommend','ask_need']:['ask_need']){
   const product=kind==='recommend'?cache.catalog.get(signal.catalogId):null;if(kind==='recommend'&&!product)continue;
   const a={customerId:person.customerId,kind,catalogId:product?.catalogId??null,category:product?.category??'*'};
   const matching=product?(cache.signals.get(person.customerId)||[]).filter(s=>s.catalogId===product.catalogId):[];
   if(product&&!matching.some(s=>s.day===signal.day))matching.push(signal);
   const recent=product?orders.filter(o=>o.items.some(i=>cache.products.get(i.productId)?.catalogId===product.catalogId)).at(-1)?.day:null;
   const stock=product?inventory.get(product.catalogId):{stock:0,arrival:99};
   const inquiryPrior=prior.groups['ask_need|cold'];
   const features={age:product?age:99,search:Number(product&&signal.kind==='SEARCH'),signal_count:matching.length,
    category_affinity:(categoryCounts.get(a.category)||0)/Math.max(1,items.length),price_usd:product?product.priceCents/100:inquiryPrior?.retained?inquiryPrior.grossCents/inquiryPrior.retained/100:40,
    stock:stock.stock,arrival_days:stock.arrival,recency:person.lastPurchaseDay==null?99:view.day-person.lastPurchaseDay,prior_purchases:person.purchaseCount,
    is_recommendation:Number(kind==='recommend'),sku_purchase_recency:recent==null?99:view.day-recent,signal_after_sku_purchase:Number(product&&(recent==null||signal.day>recent)),
    stationery:Number(a.category==='Stationery'),electronics:Number(a.category==='Electronics'),furniture:Number(a.category==='Furniture'),bundles:Number(a.category==='Office bundles'),
    customer_intent_fresh:Number(age<=2),customer_intent_recent:Number(age>2&&age<=7),...cache.feedback[kind]};
   result.push({action:a,features});
  }
 }
 cache.candidates=result;return result;
}

export function inputFeatures(view,candidate,fields){
 const values={...candidate.features,stock:candidate.features.stock/(view.scale.contactMultiplier||1)};
 const x=fields.map(name=>values[name]);if(x.some(n=>!Number.isFinite(n)))throw Error('METROPOLIS_MODEL_INPUT');return x;
}

export function scoreCampaign(view,{contract,model,prior}){
 assertBinding(contract,model);if(contract.context.marketProfile!==marketProfileFor(view))throw Error('V2_EXECUTION_MARKET_MISMATCH');
 const {campaign,configuration}=contract;
 if(campaign.kind==='hold'||view.day<30||view.day>=view.marketDays)return {actions:[],ranking:[],configuration,agentCampaign:true,reason:'Organic shopping and fulfillment continue.'};
 const limit=Math.floor(Math.min(campaign.contactsPer100*view.scale.contactMultiplier,view.outreach.rules.dailyContactLimit-view.outreach.contactsToday,
  Math.min(view.outreach.remainingBudgetCents,view.outreach.availablePlatformCashCents)/view.outreach.rules.outreachCostCents));
 if(limit<=0)return {actions:[],ranking:[],configuration};
 const cache=indexed(view),fields=model.artifact.featureNames,inquiries=inquiryValueEstimates(view,model.artifact.inquiryValue);
 const ranked=candidates(view,prior).filter(c=>{const p=cache.people.get(c.action.customerId),age=p.signal?view.day-p.signal.day:99;
  if(campaign.kind==='reactivation'&&(!p.purchaseCount||p.lastPurchaseDay==null||view.day-p.lastPurchaseDay<14))return false;
  if(age>7&&!(campaign.kind==='open_discovery'&&c.action.kind==='ask_need'))return false;
  if(c.action.kind==='recommend')return c.features.stock>0||c.features.arrival_days<=5;
  return campaign.kind!=='product_recommendations'&&(campaign.kind!=='intent_assistance'||p.signal?.kind!=='SEARCH');
 }).map(c=>{const inquiry=c.action.kind==='ask_need'?inquiries.get(inquiryBucket(view,cache.people.get(c.action.customerId))):null,
   x=inquiry?null:inputFeatures(view,c,fields),estimate=inquiry||predictContribution(model.artifact,model.artifact.selected,x,c.action.kind,fields),
   shared=inquiry?{expectedSharedNetCents:inquiry.expectedSharedNetCents}:predictSharedContribution(model.artifact,estimate.probability,x,c.action.kind,fields);
  return {...c,...estimate,...shared,score:campaign.objective==='joint'?shared.expectedSharedNetCents:estimate.expectedNetCents};
 }).filter(c=>c.expectedNetCents>0&&c.expectedSharedNetCents>c.expectedNetCents).sort((a,b)=>b.score-a.score||a.action.customerId.localeCompare(b.action.customerId));
 const selected=[],seen=new Set();for(const c of ranked){if(seen.has(c.action.customerId))continue;seen.add(c.action.customerId);selected.push(c);if(selected.length>=limit)break;}
 return {actions:selected.map(c=>c.action),ranking:selected.map(c=>({customerId:c.action.customerId,kind:c.action.kind,catalogId:c.action.catalogId,probability:c.probability,expectedNetCents:c.expectedNetCents,expectedMerchantNetCents:c.expectedSharedNetCents-c.expectedNetCents,modelId:model.id})),
  configuration,agentCampaign:true,agentCheckpoint:contract.hash,reason:'Execute the verified policy across one shared market.',model:{id:model.id,type:model.artifact.selected,rows:model.artifact.trainingRows,cutoffDay:model.cutoffDay}};
}

export function captureInputs(view,actions,prior){
 const map=new Map(candidates(view,prior).map(c=>[[c.action.customerId,c.action.kind,c.action.catalogId].join('|'),c]));
 return actions.map(a=>{const c=map.get([a.customerId,a.kind,a.catalogId].join('|'));if(!c)throw Error('MISSING_TRAINING_CONTACT');
  const featureVectors=Object.fromEntries(FEATURES.map(name=>[name,inputFeatures(view,c,FEATURE_VIEWS[name])]));
  return {day:view.day,customerId:a.customerId,kind:a.kind,catalogId:a.catalogId,x:featureVectors.existing,featureVectors};
 });
}

export function fixedOutreach(view,configuration,prior){
 if(view.day<30||view.day>=view.marketDays)return {actions:[],configuration,ranking:[]};
 const limit=Math.floor(Math.min(configuration.contactsPerDay*view.scale.contactMultiplier,view.outreach.rules.dailyContactLimit-view.outreach.contactsToday,Math.min(view.outreach.availablePlatformCashCents,view.outreach.remainingBudgetCents)/view.outreach.rules.outreachCostCents));
 if(limit<=0)return {actions:[],configuration,ranking:[]};
 const rows=candidates(view,prior).filter(c=>c.action.kind==='recommend'&&c.features.age<=configuration.maxAge&&(c.features.stock>0||c.features.arrival_days<=configuration.arrivalDays));
 rows.sort((a,b)=>{const score=c=>(c.features.price_usd*100*.0229+29)*Math.exp(-c.features.age/3)+c.features.search*5;return score(b)-score(a)||a.action.customerId.localeCompare(b.action.customerId);});
 return {actions:rows.slice(0,limit).map(c=>c.action),configuration,ranking:[],reason:'Strong fixed outreach prioritizes recent product interest and available stock.'};
}


export function inspectCurrent(view,lens,windowDays=28){
 if(!['category','intent','payment_funnel','recency'].includes(lens)||![28,56,100].includes(windowDays))throw Error('V2_INVALID_QUERY');
 const people=new Map(view.audience.map(p=>[p.customerId,p]));const contacts=view.outreach.history.filter(c=>c.day<view.day&&c.day>=view.day-windowDays),orders=new Map(view.pastOrders.map(o=>[o.requestId,o])),groups={};
 for(const c of contacts){const o=orders.get(c.requestId),mature=c.day+26<view.day,retained=mature&&!!o&&!['SETTLED','PENDING_FUNDS'].includes(o.refundStatus),person=people.get(c.customerId),key=lens==='category'?c.category:lens==='intent'?c.kind+'|'+c.observedBucket.split('|')[2]:lens==='recency'?(person?.purchaseCount?'returning':'new'):c.kind;
  const g=groups[key]??={contacts:0,responded:0,immediateFunding:0,mature:0,retained:0,pending:0,lateFundedRetained:0};g.contacts++;g.responded+=Number(c.responded);g.immediateFunding+=Number(c.authorized);g.mature+=Number(mature);g.pending+=Number(!mature);g.retained+=Number(retained);g.lateFundedRetained+=Number(retained&&!c.authorized);
 }
 const categories={};for(const p of view.products){const g=categories[p.category]??={available:0,interest7:0,fundedUnits:0};g.available+=p.available;}
 for(const s of view.signals)if(s.day>=view.day-7&&s.day<=view.day)categories[s.category].interest7++;
 for(const r of view.requests)if(r.status==='AUTHORIZED')for(const l of r.lines)categories[l.category].fundedUnits+=l.quantity;
 for(const g of Object.values(groups)){g.matureRetentionRate=g.mature?g.retained/g.mature:null;g.immediateFundingRate=g.contacts?g.immediateFunding/g.contacts:null;}
 return {day:view.day,lens,windowDays,groups,categories,openFundedRequests:view.requests.filter(r=>r.status==='AUTHORIZED').length,scope:'Retention denominator is mature contacts only; null means insufficient labels. Pending outcomes are not failures. Recency grouping uses current observed status. No latent needs or household wallets.'};
}

export function matureOwnRows(observed,view){
 const contacts=new Map(view.outreach.history.map(c=>[[c.day,c.customerId,c.kind,c.catalogId].join('|'),c])),orders=new Map(view.pastOrders.map(o=>[o.requestId,o]));
 return observed.filter(r=>r.day+26<view.day).map(r=>{const c=contacts.get([r.day,r.customerId,r.kind,r.catalogId].join('|'));if(!c)throw Error('V2_MISSING_CONTACT');const o=orders.get(c.requestId),retained=!!o&&!['SETTLED','PENDING_FUNDS'].includes(o.refundStatus);return {...r,episode:-1,sourcePolicy:'current_v2',responded:Number(c.responded),authorized:Number(c.authorized),observedBucket:c.observedBucket,retained:Number(retained),retailNetCents:(o?(retained?o.feeCents:0)-o.processingCents:0)-c.costCents,merchantOrderContributionCents:o?o.merchants.reduce((s,m)=>s+(retained?m.grossCents-m.feeCents:0)-m.costCents-m.deliveryCents,0):0,labelCompleteDay:r.day+26};});
}

export async function fitModel(dir,historical,own,contract,day){
 if(!FEATURES.includes(contract.featureView)||!FAMILIES.includes(contract.family)||![28,56,100].includes(contract.windowDays))throw Error('V2_INVALID_TRAINING_JOB');
 await mkdir(dir,{recursive:true});const data=prepareTraining(historical,contract),current=own.filter(r=>r.day>=Math.max(30,day-contract.windowDays));
 for(const r of current){if(r.labelCompleteDay>=day||!r.featureVectors?.[contract.featureView])throw Error('V2_UNMATURED_TRAINING_ROW');data.rows.push({...r,x:r.featureVectors[contract.featureView]});}
 await writeFile(dir+'/dataset.json',JSON.stringify(data));await writeFile(dir+'/spec.json',JSON.stringify(contract));
 await promisify(execFile)(resolve('.local/marketing-venv/bin/python'),[resolve('scripts/commerce-growth/autonomy/train-workbench.py'),resolve(dir)],{timeout:120000,maxBuffer:100000});
 const artifact=await read(dir+'/models.json'),report=await read(dir+'/report.json'),parity=await read(dir+'/parity.json');
 for(const r of parity)if(Math.abs(predictResponse(artifact.models[contract.family],r.x,artifact.featureNames)-r.expected)>1e-9||Math.abs(predictSharedContribution(artifact,r.expected,r.x,r.kind,artifact.featureNames).expectedSharedNetCents-r.expectedSharedNetCents)>1e-7)throw Error('V2_MODEL_PARITY_FAILED');
 artifact.normalization='stock and market contact counts per 100 shoppers';artifact.inquiryValue=fitInquiryValue(historical);
 report.inquiryValue={rows:artifact.inquiryValue.rows,cohorts:Object.fromEntries(Object.entries(artifact.inquiryValue.groups).map(([k,g])=>[k,{contacts:g.n,responseRate:g.responded/g.n,retentionRate:g.retained/g.n,paymentNetPerContactCents:(g.paymentReply+g.paymentSilent)/g.n,merchantNetPerContactCents:(g.sharedReply+g.sharedSilent-g.paymentReply-g.paymentSilent)/g.n}])),sourceHash:artifact.inquiryValue.sourceHash,scope:'Separate reply/value head for inquiries without a SKU. Complete historical outcomes fit value; only prior-day replies and mature current outcomes update it. Strength 8 and window 28 are assumptions; classifier AUC is not this head\'s validation.'};
 const modelHash=digest(artifact),result={id:'V2-MODEL-'+modelHash.slice(0,12),modelHash,artifact,report,cutoffDay:day,ownRows:current.length};
 await writeFile(dir+'/report.json',JSON.stringify(report,null,2)+'\n');await writeFile(dir+'/model.json',JSON.stringify(result));return result;
}

export function compileCampaign(raw,model,incumbent,context){
 validate(raw,campaignSchema);validate(context,contextSchema);
 if(!model?.modelHash||model.modelHash!==digest(model.artifact))throw Error('V2_MODEL_HASH_MISMATCH');
 const campaign={...raw,contactsPer100:Number(raw.contactsPer100),coverDays:Number(raw.coverDays)},configuration=validateConfig({...incumbent,forecast:raw.forecast,coverDays:campaign.coverDays,routing:raw.supplierSettlement==='paypal_fast'?'fast':'auto',target:raw.productPreference==='lowest_acceptable_price'?'cheap':'preferred'});
 const bound={version:VERSION,modelHash:model.modelHash,campaign,configuration,context:{...context},activationDay:context.day};return freeze({...bound,hash:canonicalHash(bound)});
}
export function assertBinding(contract,model){
 if(!contract||Object.keys(contract).sort().join()!=='activationDay,campaign,configuration,context,hash,modelHash,version')throw Error('V2_UNBOUND_CAMPAIGN');
 const {hash,...bound}=contract;validate(contract.context,contextSchema);
 validate(contract.campaign.contactsPer100,{type:'INTEGER'});validate(contract.campaign.coverDays,{type:'INTEGER'});
 validate({...contract.campaign,contactsPer100:String(contract.campaign.contactsPer100),coverDays:String(contract.campaign.coverDays)},campaignSchema);validateConfig(contract.configuration);
 if(contract.configuration.target!==(contract.campaign.productPreference==='lowest_acceptable_price'?'cheap':'preferred')||contract.configuration.routing!==(contract.campaign.supplierSettlement==='paypal_fast'?'fast':'auto')||contract.configuration.forecast!==contract.campaign.forecast||contract.configuration.coverDays!==contract.campaign.coverDays)throw Error('V2_EXECUTION_PLAN_MISMATCH');
 if(contract.version!==VERSION||canonicalHash(bound)!==hash||contract.modelHash!==model?.modelHash||digest(model.artifact)!==model.modelHash||contract.activationDay!==contract.context.day)throw Error('V2_UNBOUND_CAMPAIGN');
}
