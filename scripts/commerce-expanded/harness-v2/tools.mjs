import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
import {digest} from '../../commerce-growth/environment.mjs';
import {contactFeatures} from '../../commerce-growth/experiments/program.mjs';
import {RESPONSE_FIELDS,responseFeatures,predictResponse,predictContribution,predictSharedContribution} from '../../commerce-growth/autonomy/features.mjs';
import {prepareTraining,FEATURE_VIEWS,datasetOverview,inspectDemand} from '../../commerce-growth/autonomy/team-workbench-tools.mjs';
import {observedFeedbackHistory,feedbackFeatures} from '../../commerce-growth/autonomy/feedback-features.mjs';
import {validateConfig} from '../../commerce-growth/team/control.mjs';

export {digest,datasetOverview,inspectDemand};
export const read=async p=>JSON.parse(await readFile(p,'utf8'));
export const FEATURES=['existing','intent_context','market_feedback'];
export const FAMILIES=['forest','logistic','response_hurdle'];
export const KINDS=['product_recommendations','intent_assistance','ranked_discovery','reactivation','open_discovery','hold'];

export function inputFeatures(view,c,fields,history=null){
 const person=view.audience.find(p=>p.customerId===c.action.customerId),age=person.signal?view.day-person.signal.day:99;
 const base=responseFeatures(view,c),scale=view.scale?.contactMultiplier||1;base[RESPONSE_FIELDS.indexOf('stock')]/=scale;
 const values={...Object.fromEntries(RESPONSE_FIELDS.map((k,i)=>[k,base[i]])),customer_intent_fresh:Number(age<=2),customer_intent_recent:Number(age>2&&age<=7)};
 if(fields.some(k=>k.startsWith('market_'))){Object.assign(values,feedbackFeatures(history||observedFeedbackHistory(view),view.day,c.action.customerId,c.action.kind));values.market_contacts_log=Math.log1p(Math.expm1(values.market_contacts_log)/scale);}
 const x=fields.map(k=>values[k]);if(x.some(n=>!Number.isFinite(n)))throw Error('V2_INVALID_FEATURES');return x;
}

export function inspectCurrent(view,lens){
 if(!['category','intent','payment_funnel','recency'].includes(lens))throw Error('V2_INVALID_QUERY');
 const contacts=view.outreach.history.filter(c=>c.day<view.day),orders=new Map(view.pastOrders.map(o=>[o.requestId,o])),groups={};
 for(const c of contacts){const o=orders.get(c.requestId),mature=c.day+26<view.day,retained=mature&&!!o&&!['SETTLED','PENDING_FUNDS'].includes(o.refundStatus),person=view.audience.find(p=>p.customerId===c.customerId),key=lens==='category'?c.category:lens==='intent'?c.kind+'|'+c.observedBucket.split('|')[2]:lens==='recency'?(person?.purchaseCount?'returning':'new'):c.kind;
  const g=groups[key]??={contacts:0,responded:0,immediateFunding:0,mature:0,retained:0,pending:0,lateFundedRetained:0};g.contacts++;g.responded+=Number(c.responded);g.immediateFunding+=Number(c.authorized);g.mature+=Number(mature);g.pending+=Number(!mature);g.retained+=Number(retained);g.lateFundedRetained+=Number(retained&&!c.authorized);
 }
 const categories={};for(const p of view.products){const g=categories[p.category]??={available:0,interest7:0,fundedUnits:0};g.available+=p.available;}
 for(const s of view.signals)if(s.day>=view.day-7&&s.day<=view.day)categories[s.category].interest7++;
 for(const r of view.requests)if(r.status==='AUTHORIZED')for(const l of r.lines)categories[l.category].fundedUnits+=l.quantity;
 return {day:view.day,lens,groups,categories,openFundedRequests:view.requests.filter(r=>r.status==='AUTHORIZED').length,scope:'Observed past contacts and orders; final labels withheld until day+26. Recency grouping uses current observed customer status. No latent needs or household wallets.'};
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
 artifact.normalization='stock and market contact counts per 100 shoppers';const modelHash=digest(artifact),result={id:'V2-MODEL-'+modelHash.slice(0,12),modelHash,artifact,report,cutoffDay:day,ownRows:current.length};
 await writeFile(dir+'/model.json',JSON.stringify(result));return result;
}

export function compileCampaign(raw,model,incumbent,day){
 const allowed=['kind','objective','contactsPer100','forecast','coverDays','routing','target'];
 if(!raw||Object.keys(raw).sort().join()!==allowed.sort().join()||!KINDS.includes(raw.kind)||!['paypal','joint'].includes(raw.objective)||![3,6,10].includes(Number(raw.contactsPer100))||!['recent7','recent14','adaptive'].includes(raw.forecast)||![0,3,7].includes(Number(raw.coverDays))||!['fast','auto'].includes(raw.routing)||!['cheap','preferred'].includes(raw.target))throw Error('V2_INVALID_CAMPAIGN');
 if(!model?.modelHash||model.modelHash!==digest(model.artifact))throw Error('V2_MODEL_HASH_MISMATCH');
 const campaign={kind:raw.kind,objective:raw.objective,contactsPer100:Number(raw.contactsPer100),forecast:raw.forecast,coverDays:Number(raw.coverDays),routing:raw.routing,target:raw.target},configuration=validateConfig({...incumbent,forecast:raw.forecast,coverDays:campaign.coverDays,routing:raw.routing,target:raw.target});
 const bound={version:'commerce-harness-v2',modelHash:model.modelHash,campaign,configuration,activationDay:day};return Object.freeze({...bound,hash:digest(bound)});
}
export function assertBinding(contract,model){const {hash,...bound}=contract;if(digest(bound)!==hash||contract.modelHash!==model.modelHash||digest(model.artifact)!==model.modelHash)throw Error('V2_UNBOUND_CAMPAIGN');}

export function scoreCampaign(view,{contract,model,prior}){
 assertBinding(contract,model);const {campaign,configuration}=contract;
 if(campaign.kind==='hold'||view.day<30||view.day>=view.marketDays)return {actions:[],ranking:[],configuration,agentCampaign:true,reason:'Retain organic shopping and fulfillment; no campaign contacts.'};
 const limit=Math.min(campaign.contactsPer100*(view.scale?.contactMultiplier||1),view.outreach.rules.dailyContactLimit-view.outreach.contactsToday,Math.floor(Math.min(view.outreach.remainingBudgetCents,view.outreach.availablePlatformCashCents)/view.outreach.rules.outreachCostCents));
 if(limit<=0)return {actions:[],ranking:[],configuration};
 const people=new Map(view.audience.map(p=>[p.customerId,p])),history=observedFeedbackHistory(view),fields=model.artifact.featureNames;
 const ranked=contactFeatures(view,prior,7).filter(c=>{const p=people.get(c.action.customerId),age=p.signal?view.day-p.signal.day:99;
  if(campaign.kind==='reactivation'&&(!p.purchaseCount||p.lastPurchaseDay==null||view.day-p.lastPurchaseDay<14))return false;
  if(age>7&&!(campaign.kind==='open_discovery'&&c.action.kind==='ask_need'))return false;
  if(c.action.kind==='recommend')return c.action.catalogId===p.signal?.catalogId&&(c.features.stock>0||c.features.arrival_days<=5);
  return campaign.kind!=='product_recommendations'&&(campaign.kind!=='intent_assistance'||p.signal?.kind!=='SEARCH');
 }).map(c=>{const x=inputFeatures(view,c,fields,history),estimate=predictContribution(model.artifact,model.artifact.selected,x,c.action.kind,fields),shared=predictSharedContribution(model.artifact,estimate.probability,x,c.action.kind,fields);return {...c,...estimate,...shared,score:campaign.objective==='joint'?shared.expectedSharedNetCents:estimate.expectedNetCents};}).filter(c=>c.expectedNetCents>0&&c.expectedSharedNetCents>c.expectedNetCents).sort((a,b)=>b.score-a.score||a.action.customerId.localeCompare(b.action.customerId));
 const selected=[],seen=new Set();for(const c of ranked){if(seen.has(c.action.customerId))continue;seen.add(c.action.customerId);selected.push(c);if(selected.length>=limit)break;}
 return {actions:selected.map(c=>c.action),ranking:selected.map(c=>({customerId:c.action.customerId,kind:c.action.kind,catalogId:c.action.catalogId,probability:c.probability,expectedNetCents:c.expectedNetCents,expectedMerchantNetCents:c.expectedSharedNetCents-c.expectedNetCents,modelId:model.id})),configuration,agentCampaign:true,agentCheckpoint:contract.hash,reason:'Execute the exact tested '+campaign.kind+' contract with '+model.artifact.selected+'; no immediate-funding odds shortcut.',model:{id:model.id,type:model.artifact.selected,rows:model.artifact.trainingRows,cutoffDay:model.cutoffDay}};
}

export function captureInputs(view,actions,prior){
 if(!actions.length)return [];const candidates=contactFeatures(view,prior,7),history=observedFeedbackHistory(view);
 return actions.map(a=>{const c=candidates.find(c=>['customerId','kind','catalogId','category'].every(k=>c.action[k]===a[k]));if(!c)throw Error('V2_MISSING_INPUT');const featureVectors=Object.fromEntries(FEATURES.map(f=>[f,inputFeatures(view,c,FEATURE_VIEWS[f],history)]));return {day:view.day,customerId:a.customerId,kind:a.kind,catalogId:a.catalogId,x:featureVectors.existing,featureVectors};});
}
