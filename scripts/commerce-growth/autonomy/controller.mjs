// Application agents own analysis, training and campaign choices. Numerical
// scoring and payment/fulfillment execution remain ordinary trusted tools.
import {readFile,writeFile,mkdir,rename,copyFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
import {openTeamVertex} from '../../agent-mesh/model-client.mjs';
import {outreachPlan,validateConfig} from '../team/control.mjs';
import {contactFeatures} from '../experiments/program.mjs';
import {digest} from '../environment.mjs';
import {RULES} from '../kernel.mjs';
import {responseFeatures,predictResponse,predictContribution,predictSharedContribution,RESPONSE_FIELDS} from './features.mjs';
import {inquiryEstimate} from './inquiry-expert.mjs';
import {fitFundingCalibration,fundingCohort,adjustForFunding} from './funding-calibration.mjs';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const enumerated=values=>({type:'STRING',enum:values});
const rationale={type:'STRING',description:'One concise explanation citing observed evidence. Predictions are estimates, not proven future profit.'};

export async function openAutonomousCommerce({id,dir,prior,incumbent,providerFactory=openTeamVertex,background=false,valueAware=false,recipeSelection=false,developmentEvidence=[],fundingPrior=null}){
 await mkdir(dir);await copyFile('scripts/commerce-growth/autonomy/train.py',resolve(dir,'train.py'));const historical=(await read('docs/commerce-growth/autonomy-1/training/dataset.json')).rows,trainingReport=await read('docs/commerce-growth/autonomy-1/training/model-report.json');
 const historicalIntent={};for(const row of historical){const key=row.kind==='ask_need'?'general_inquiries':row.x[RESPONSE_FIELDS.indexOf('search')]?'product_searches':'product_browses',g=historicalIntent[key]??={contacts:0,retained:0,netCents:0};g.contacts++;g.retained+=row.retained;g.netCents+=row.retailNetCents;}
 const checkpoints=[],observed=[];let provider=null,model=null,supply=validateConfig(incumbent),campaign=null,rounds=0,calls=0,failed=false,firstDay=null,lastDay=null,firstResponseRate=null,pending=false,reviewJob=null,closing=false,calibrationUpdates=0,lastCalibrationHash=null,lastCalibrationDay=-Infinity;
 const state=()=>({id,status:failed?'FALLBACK':pending?'REVIEWING':'READY',rounds,calls,background,pending,lastDay,activeModel:model?.id??null,campaign,supply,checkpoints,calibrationUpdates,modelCostUSD:(provider?.client.events||[]).reduce((s,e)=>s+(e.modelCostMicros??e.reservedMicros??0),0)/1e6});
 let checkpointWrites=Promise.resolve();
 function save(){const snapshot=JSON.stringify(state(),null,2)+'\n',persist=async()=>{await writeFile(dir+'/checkpoints.json.tmp',snapshot);await rename(dir+'/checkpoints.json.tmp',dir+'/checkpoints.json');};checkpointWrites=checkpointWrites.then(persist,persist);return checkpointWrites;}
 function matured(view){return observed.filter(r=>r.day+26<view.day).map(row=>{const c=view.outreach.history.find(c=>c.day===row.day&&c.customerId===row.customerId&&c.kind===row.kind&&c.catalogId===row.catalogId),o=c&&view.pastOrders.find(o=>o.requestId===c.requestId),retained=Boolean(o&&!['SETTLED','PENDING_FUNDS'].includes(o.refundStatus));return {...row,episode:-1,sourcePolicy:'current_autonomous_campaign',regime:'NOT_A_FEATURE',retained:Number(retained),retailNetCents:(o?(retained?o.feeCents:0)-o.processingCents:0)-(c?.costCents??5),retainedGrossCents:retained?o.grossCents:0,labelCompleteDay:row.day+26};});}
 function evidence(view,reason){
  const recent=view.outreach.history.filter(c=>c.day<view.day).slice(-20),labels=matured(view),orders=view.pastOrders.filter(o=>o.day+14<view.day),stock={};
  for(const p of view.products)stock[p.category]=(stock[p.category]||0)+p.available;
  const e={day:view.day,reason,remainingMarketDays:view.marketDays-view.day,contactBudgetCents:view.outreach.remainingBudgetCents,stock,...(view.scale?{marketScale:view.scale,contactQuotaMeaning:'Campaign contactsPerDay is per 100 shoppers; multiply by contactMultiplier for the total daily cap. Model previews already show total contacts. Virtual outreach money is separate from the real $0.25 model cap.'}:{}),
   openFundedRequests:view.requests.filter(r=>r.status==='AUTHORIZED').length,urgentRequests:view.requests.filter(r=>r.status==='AUTHORIZED'&&r.deadlineDay-view.day<=5).length,
   recentContacts:recent.length,recentFundedResponses:recent.filter(c=>c.authorized).length,matureOwnResponses:labels.length,ownRetainedRate:labels.length?labels.reduce((s,r)=>s+r.retained,0)/labels.length:null,
   matureOrders:orders.length,retainedPaymentVolumeCents:orders.filter(o=>!['SETTLED','PENDING_FUNDS'].includes(o.refundStatus)).reduce((s,o)=>s+o.grossCents,0),
   modelValidation:model?.report.summary??trainingReport.summary,activeModel:model?{id:model.id,family:model.family,recipe:model.inquiryExpert==='ambiguous'?'clarify_ambiguous':model.inquiryExpert?'inquiry_expert':'unified',valuation:model.artifact.valueModel?'contextual':'pooled',adaptation:model.adaptiveFunding?'adaptive_funding':'historical',intentScope:model.intentScope||'all_recent',cutoffDay:model.cutoff,trainingRows:model.artifact.trainingRows}:null,activeCampaign:campaign,
   ...(fundingPrior?{fundingEvidence:fitFundingCalibration(view,fundingPrior),outcomeDefinitions:{funded:'Buyer approved existing funds for the request. Available immediately after contact.',retained:'Captured purchase with no refund after the observation horizon. Available only after maturation.',comparison:'Compare rates only with the same outcome definition and cohort. Historical pooled rates are not the current market rate.'}}:{}),
   paypal:{mode:'MODELED_PAYMENTS_NATIVE_CALLS_DISABLED',capture:'Only existing authorized buyer funds can be captured for a complete in-stock basket.',supplierSettlement:'PayPal is modeled as immediate; bank settlement adds two days per stage. Physical delivery still takes time.',fees:{retailRate:RULES.feeRate,fixedCents:RULES.feeFixedCents,processingRate:RULES.processingRate,processingFixedCents:RULES.processingFixedCents},refunds:'Refunds and processing/outreach costs reduce settled modeled contribution; a response is not a sale.'},
   scope:'Current observed data and completed historical training markets. No hidden needs, future response draws, buyer wallets, regime labels or simulation seed.'};
  return {...e,evidenceId:digest(e)};
 }
 async function ask(role,name,input,properties){
  if(calls>=6)throw Error('AUTONOMY_CALL_CAP');calls++;const cp={role,actor:'GEMINI',day:input.day,status:'STARTED',input,startedAt:new Date().toISOString()};checkpoints.push(cp);await save();
  let start=0;
  try{
   provider??=await providerFactory('AUTONOMY-'+id,{route:'lite',capMicros:250000});start=provider.client.events.length;
   const fn={name,description:'Commit the role decision using the supplied evidence and trusted tools.',parameters:{type:'OBJECT',properties:{...properties,rationale,evidenceId:enumerated([input.evidenceId])},required:[...Object.keys(properties),'rationale','evidenceId']}},
    result=await provider.client.json(`You are the ${role} in an autonomous commerce team. Improve retained purchases and settled modeled PayPal contribution, protecting merchant margins and contact consent. You can use local ML and numerical tools; you do not need to solve every shopper decision with an LLM. Examine measured evidence, choose useful work, and retain a good policy when change is unsupported. Do not infer hidden needs, invent results, claim production profit, or output SQL/code. Never call a policy optimal or a difference significant without a supporting test. Do not compare funding rate with retained-purchase rate as though they have the same label or cohort. The economic simulation is frozen. Your decision is automatically validated and executed; no human approval is required for these bounded simulation actions. The2x target is a stretch, not a reason to avoid useful work.`,input,{caseId:role+'-'+input.day,trialId:id,functions:[fn]});
   if(result.name!==name||!result.args||result.args.evidenceId!==input.evidenceId||typeof result.args.rationale!=='string'||result.args.rationale.length>1200)throw Error('INVALID_AUTONOMOUS_HANDOFF');
   for(const [key,schema]of Object.entries(properties))if(schema.enum&&!schema.enum.includes(result.args[key]))throw Error('INVALID_AGENT_FIELD_'+key);
   Object.assign(cp,{status:'VALIDATED',output:result.args,provider:provider.client.events.slice(start),completedDay:Math.max(input.day,lastDay??input.day),finishedAt:new Date().toISOString()});await save();return result.args;
  }catch(error){Object.assign(cp,{status:'FAILED',error:error.message,completedDay:Math.max(input.day,lastDay??input.day),provider:provider?.client.events.slice(start)||[]});await save();throw error;}
 }
 async function train(view,choice){
  const path=dir+'/model-day-'+view.day;await mkdir(path);const own=matured(view),window=Number(choice.windowDays),rows=[...historical.filter(r=>r.day>=Math.max(30,100-window)),...own],useValue=choice.valuation==='contextual'||choice.valuation===undefined&&valueAware,recipe=choice.recipe||'unified',adaptiveFunding=Boolean(fundingPrior&&choice.adaptation==='adaptive_funding');
  const cp={role:'ML scientist',actor:'LOCAL_TRAINING_TOOL',day:view.day,status:'STARTED',input:{family:choice.family,recipe,valuation:useValue?'contextual':'pooled',windowDays:window,rows:rows.length,ownMatureRows:own.length,cutoffDay:view.day},startedAt:new Date().toISOString()};checkpoints.push(cp);await save();
  try{
  await writeFile(path+'/dataset.json',JSON.stringify({featureNames:RESPONSE_FIELDS,rows}));await writeFile(path+'/progress.json',JSON.stringify({status:'COMPLETED'}));
  await promisify(execFile)(resolve('.local/marketing-venv/bin/python'),[resolve(dir,'train.py'),resolve(path),...(useValue?['--value-aware']:[])],{timeout:60000,maxBuffer:100000});
  const artifact=await read(path+'/models.json'),report=await read(path+'/model-report.json'),parity=await read(path+'/parity.json');
  if(parity.some(r=>Math.abs(predictResponse(artifact.models[r.family],r.x)-r.expected)>1e-9))throw Error('MODEL_PORTABILITY_FAILED');
  if(useValue&&parity.some(r=>Math.abs(predictContribution(artifact,r.family,r.x,r.kind).expectedNetCents-r.expectedNetCents)>1e-7))throw Error('VALUE_MODEL_PORTABILITY_FAILED');
  if(recipe!=='unified'){
   artifact.inquiryRouting=recipe==='clarify_ambiguous'?'ambiguous':true;
   artifact.inquiryPrior=structuredClone(prior);
   artifact.inquiryScope='Contextual inquiry reward posterior, matched to current observed shopper intent and updated from mature local outcomes. Forest validation metrics cover the recommendation classifier, not this separate component.';
  }
  artifact.adaptiveFunding=adaptiveFunding;artifact.intentScope=choice.intentScope||'all_recent';if(adaptiveFunding)artifact.fundingPrior=structuredClone(fundingPrior);
  await writeFile(path+'/models.json.tmp',JSON.stringify(artifact,null,2)+'\n');await rename(path+'/models.json.tmp',path+'/models.json');
  const quality=report.summary[choice.family].logLoss<=report.summary.coarse.logLoss;
  Object.assign(cp,{status:quality?'COMPLETED':'REJECTED',output:{modelId:'INTENT-'+digest(artifact).slice(0,16),family:choice.family,recipe,valuation:useValue?'contextual':'pooled',adaptation:adaptiveFunding?'adaptive_funding':'historical',intentScope:artifact.intentScope,inquiryPriorRows:recipe==='unified'?0:prior.rows,metrics:report.summary[choice.family],coarse:report.summary.coarse,validationPassed:quality,runtimeSeconds:report.runtimeSeconds,scope:'Classifier validation and recorded training-market evidence; not proof of this campaign\'s future profit. Funding adjustment is evaluated separately.'},completedDay:Math.max(view.day,lastDay??view.day),finishedAt:new Date().toISOString()});await save();
  return {summary:cp.output,candidate:quality?{id:cp.output.modelId,cutoff:view.day,family:choice.family,artifact,report,inquiryExpert:artifact.inquiryRouting||false,inquiryPrior:artifact.inquiryPrior||prior,adaptiveFunding,fundingPrior:artifact.fundingPrior,intentScope:artifact.intentScope}:null};
  }catch(error){Object.assign(cp,{status:'FAILED',error:error.message,completedDay:Math.max(view.day,lastDay??view.day),finishedAt:new Date().toISOString()});await save();throw error;}
 }
 async function review(view,reason){
  rounds++;try{
   const packet=evidence(view,reason),{modelValidation,activeModel,...commercialEvidence}=packet,
    analysis=await ask('Market analyst','analyse_market',{...commercialEvidence,historicalIntent,analysisTask:'Identify a specific commercial opportunity or failure from contact, conversion, funding and stock evidence. Model selection belongs to the scientist; do not substitute a model accuracy summary for market analysis.'},{focus:enumerated(['fresh_intent','reactivation','availability','conversion_quality']),finding:{type:'STRING'}});
   const science=await ask('ML scientist','choose_model_work',{...packet,analyst:analysis,developmentEvidence,
    ...(recipeSelection?{recipeMeaning:{unified:'Use the fitted classifier for both contact types.',inquiry_expert:'Use the fitted classifier for product recommendations and an observed intent-age reward posterior for inquiries.',clarify_ambiguous:'Use that inquiry expert for browsing ambiguity; explicit product searches keep product recommendations.'},valuationMeaning:{pooled:'Use measured average retained payment value by contact kind.',contextual:'Train a conditional payment-value forest on observed retained purchases.'},inquiryCalibration:prior.groups}:{}),
    ...(fundingPrior?{adaptationMeaning:{historical:'Use the fitted historical classifier directly. Appending a few local rows can leave historical behavior dominant.',adaptive_funding:'Adjust recommendation odds each day from prior-day observed funding response, using an eight-contact historical prior and a rolling28-day window. No paid calls for these local updates. Inquiry reward already has its own local update.'},intentScopeMeaning:{latest:'Only recommend the latest expressed product. Inquiries may clarify uncertain browsing.',all_recent:'The model may choose any product with observed interest in the past seven days.'}}:{}),
    validationScope:'Historical classifier metrics cover the full100-day training window. Development policy outcomes are known training markets, not future gains. Choose the model/routing recipe for the business objective, not accuracy alone. A retain decision keeps the exact existing model, adaptation and routing.'},
    {decision:enumerated(['train','retain']),family:enumerated(['forest','logistic']),windowDays:enumerated(['28','56','100']),...(recipeSelection?{recipe:enumerated(['unified','inquiry_expert','clarify_ambiguous']),valuation:enumerated(['pooled','contextual'])}:{}),...(fundingPrior?{adaptation:enumerated(['historical','adaptive_funding']),intentScope:enumerated(['latest','all_recent'])}:{})});
   const trained=science.decision==='train'||!model?await train(view,science):{summary:{retainedModel:model.id,metrics:model.report.summary[model.family],validationPassed:true},candidate:model},candidateModel=trained.candidate||model;
   const previews=[];if(candidateModel)for(const contactKinds of ['recommend','both'])for(const contactsPerDay of ['3','6','10']){
    const c={audience:'all',contactKinds,contactsPerDay,minimumNetCents:'0',stopped:false},p=scoreLearnedContacts(view,{prior,model:candidateModel,campaign:c,supply}),expected=p.ranking?.reduce((s,r)=>s+r.expectedNetCents,0)||0;
    previews.push({contactKinds,contactsPerDay:Number(contactsPerDay),totalDailyCap:Number(contactsPerDay)*(view.scale?.contactMultiplier||1),eligibleSelected:p.actions.length,recommendations:p.actions.filter(a=>a.kind==='recommend').length,generalInquiries:p.actions.filter(a=>a.kind==='ask_need').length,expectedNetCents:Math.round(expected),contactCostCents:p.actions.length*view.outreach.rules.outreachCostCents,scope:'Current-snapshot model estimate, not measured future campaign profit.'});
   }
   const proposal=await ask('Commerce manager','publish_commerce_policy',{...evidence(view,reason),analyst:analysis,scientist:science,trainingResult:trained.summary,campaignPreviews:previews,currentSupplyContract:supply,developmentEvidence,
    actionMeaning:{audience:'lapsed requires a previous purchase and at least14 days since it; recent_interest requires a product signal. all includes any eligible contact.',minimumNetCents:'Threshold on modeled expected retail payment contribution after contact cost; estimated from observed retained/failed outcomes.',routing:'fast uses modeled PayPal supplier settlement. auto can use bank settlement when deadlines permit. Neither changes retail captures.',modelRoles:'The model ranks eligible contacts locally; the campaign is automatically applied. A smaller contact limit can discard positive-value opportunities shown in the preview. Keep the existing stock and settlement settings unless fulfillment evidence justifies changing them; conservative is not by itself an economic reason.'}},
    {decision:enumerated(['publish','keep','stop']),audience:enumerated(['all','recent_interest','lapsed']),contactKinds:enumerated(['recommend','both']),contactsPerDay:enumerated(['3','6','10']),minimumNetCents:enumerated(['0','5','10']),routing:enumerated(['fast','auto']),forecast:enumerated(['recent14','adaptive']),coverDays:enumerated(['3','7'])});
   const effectiveDay=background?Math.max(view.day,(lastDay??view.day)+1):view.day;
   if(effectiveDay>=view.marketDays){checkpoints.push({role:'Coordinator',actor:'TRUSTED_PUBLISHER',day:view.day,completedDay:lastDay,status:'EXPIRED',output:{decision:'keep',reason:'The market closed during review. Existing orders settle; no late campaign is launched.'}});return;}
   if(proposal.decision==='stop')campaign={...proposal,stopped:true,publishedDay:effectiveDay};
   else if(proposal.decision==='publish'){
    if(!candidateModel)throw Error('NO_VALIDATED_MODEL_TO_PUBLISH');model=candidateModel;campaign={...proposal,stopped:false,modelId:model.id,publishedDay:effectiveDay};
    supply=validateConfig({...incumbent,routing:proposal.routing,forecast:proposal.forecast,coverDays:Number(proposal.coverDays)});
   }
   checkpoints.push({role:'Coordinator',actor:'TRUSTED_PUBLISHER',day:view.day,completedDay:lastDay,status:'COMPLETED',output:{decision:proposal.decision,effectiveDay,modelId:model?.id??null,campaign,supply,automated:true,checks:['observed features only','validated model artifact','consent and contact budget','funded complete baskets','merchant margin floor','idempotent simulated payments'],nativePayments:false}});
   firstDay??=effectiveDay;firstResponseRate??=packet.recentContacts?packet.recentFundedResponses/packet.recentContacts:null;await save();
  }catch(error){failed=true;checkpoints.push({role:'Coordinator',actor:'TRUSTED_FALLBACK',day:view.day,completedDay:lastDay,status:'FAILED',error:error.message,output:{decision:'Keep the last valid campaign or original fixed workflow; do not retry uncertain paid calls.'}});await save();}
  finally{pending=false;await save();}
 }
 function choose(view){
  if(campaign?.stopped)return {actions:[],ranking:[],configuration:supply,reason:'The commerce agent stopped new outreach; existing orders and organic shopping continue.'};
  if(!model||!campaign)return {...outreachPlan(view,incumbent,prior),configuration:incumbent,reason:'Original fixed workflow remains active until a validated campaign is published.'};
  return scoreLearnedContacts(view,{prior,model,campaign,supply});
 }
 return {async plan(view){
  lastDay=view.day;const recent=view.outreach.history.slice(-20),rate=recent.length?recent.filter(c=>c.authorized).length/recent.length:null,
   changed=recent.length>=20&&firstResponseRate!==null&&Math.abs(rate-firstResponseRate)>.1;
  if(rounds>0&&firstResponseRate===null&&recent.length>=20)firstResponseRate=rate;
  if(!failed&&!pending&&!closing&&view.day<view.marketDays&&(rounds===0&&view.day>=30||rounds===1&&view.day>=60&&view.day>=(firstDay??30)+14&&(changed||view.day>=75))){
   pending=true;reviewJob=review(structuredClone(view),rounds===0?'First campaign: inspect historical validation and current commerce signals.':changed?'Observed funded-response rate changed by more than10 percentage points.':'Periodic review: inspect matured campaign outcomes before deciding whether to retrain.');if(!background)await reviewJob;
  }
  const proposal=choose(view),candidates=contactFeatures(view,prior,7);proposal.agentCampaign=Boolean(model&&campaign&&!campaign.stopped&&proposal.model?.id===model.id);
  const calibration=proposal.model?.calibration;if(calibration){const h=digest(calibration.groups);if(h!==lastCalibrationHash){calibrationUpdates++;lastCalibrationHash=h;
   if(calibration.rows&&view.day-lastCalibrationDay>=7){lastCalibrationDay=view.day;const groups=Object.entries(calibration.groups).filter(([key])=>key.startsWith('recommend|')),n=groups.reduce((s,[,g])=>s+g.contacts,0),funded=groups.reduce((s,[,g])=>s+g.funded,0);checkpoints.push({role:'ML scientist',actor:'LOCAL_CALIBRATION',day:view.day,completedDay:view.day,status:'COMPLETED',input:{modelId:model.id,windowDays:calibration.windowDays,throughDay:view.day-1},output:{title:'Market response updated',body:`${funded} of ${n} recent recommendation contacts produced funded requests. The local model updated its response estimates before choosing the next contacts.`,calibration}});await save();}
  }}
  for(const a of proposal.actions){const c=candidates.find(c=>c.action.customerId===a.customerId&&c.action.kind===a.kind&&c.action.catalogId===a.catalogId&&c.action.category===a.category);if(c)observed.push({day:view.day,customerId:a.customerId,kind:a.kind,catalogId:a.catalogId,x:responseFeatures(view,c)});}
  return proposal;
 },async close(){closing=true;await reviewJob;await provider?.close();await save();},summary(){const events=provider?.client.events||[];return {...state(),failed,lastDay,modelCalls:events.length,modelCostUSD:events.reduce((s,e)=>s+(e.modelCostMicros??e.reservedMicros??0),0)/1e6,providerLatencyMs:events.reduce((s,e)=>s+(e.latencyMs||0),0),trainingJobs:checkpoints.filter(c=>c.actor==='LOCAL_TRAINING_TOOL').length,publications:checkpoints.filter(c=>c.actor==='TRUSTED_PUBLISHER'&&c.status==='COMPLETED'&&c.output.decision==='publish').length,nativePayments:0};}};
}

// Shared with the fixed-ML comparator. Any benefit of the trained model must
// not be mislabeled as a benefit of additional LLM roles.
export function scoreLearnedContacts(view,{prior,model,campaign,supply}){
  if(campaign.stopped||view.day<30||view.day>=view.marketDays)return {actions:[],ranking:[],configuration:supply,reason:'No new outreach; existing orders still settle.'};
  const limit=Math.min(Number(campaign.contactsPerDay)*(view.scale?.contactMultiplier||1),view.outreach.rules.dailyContactLimit-view.outreach.contactsToday,Math.floor(Math.min(view.outreach.remainingBudgetCents,view.outreach.availablePlatformCashCents)/view.outreach.rules.outreachCostCents));
  if(limit<=0)return {actions:[],configuration:supply};
  // An audience qualifies shoppers, not action kinds. A shopper with recent
  // interest can receive an inquiry when the agent explicitly permits both.
  const recentInterest=new Set(view.signals.filter(s=>view.day-s.day>=0&&view.day-s.day<=7).map(s=>s.customerId));
  for(const person of view.audience)if(person.signal&&view.day-person.signal.day>=0&&view.day-person.signal.day<=7)recentInterest.add(person.customerId);
  const calibration=model.adaptiveFunding?fitFundingCalibration(view,model.fundingPrior):null;
  const ranked=contactFeatures(view,prior,7).filter(c=>campaign.contactKinds==='both'||c.action.kind==='recommend').filter(c=>campaign.audience!=='lapsed'||c.features.prior_purchases>0&&c.features.recency>=14).filter(c=>campaign.audience!=='recent_interest'||recentInterest.has(c.action.customerId)).filter(c=>model.intentScope!=='latest'||c.action.kind!=='recommend'||c.action.catalogId===view.audience.find(p=>p.customerId===c.action.customerId)?.signal?.catalogId).filter(c=>!(c.action.kind==='ask_need'&&model.inquiryExpert==='ambiguous'&&view.audience.find(p=>p.customerId===c.action.customerId)?.signal?.kind==='SEARCH')).filter(c=>c.action.kind!=='recommend'||c.features.stock>0||c.features.arrival_days<=5).map(c=>{
   const x=responseFeatures(view,c);let estimate=c.action.kind==='ask_need'&&model.inquiryExpert?inquiryEstimate(view,model.inquiryPrior||prior,c.action.customerId):predictContribution(model.artifact,model.family,x,c.action.kind);
   // The inquiry expert already updates its retained-outcome posterior.
   // Calibrate recommendation scores once; do not double-count inquiry data.
   if(calibration&&c.action.kind==='recommend')estimate=adjustForFunding(estimate,calibration,fundingCohort(view,c.action),model.artifact.valueMeans[c.action.kind].failedNetCents);
   if(model.objective==='shared_contribution')estimate={...estimate,...predictSharedContribution(model.artifact,estimate.probability,x,c.action.kind)};
   return {...c,x,...estimate};
  }).filter(c=>c.expectedNetCents>Number(campaign.minimumNetCents)&&(model.objective!=='shared_contribution'||c.expectedSharedNetCents>c.expectedNetCents)).sort((a,b)=>(model.objective==='shared_contribution'?b.expectedSharedNetCents-a.expectedSharedNetCents:b.expectedNetCents-a.expectedNetCents)||a.action.customerId.localeCompare(b.action.customerId));
  const selected=[],seen=new Set();for(const c of ranked){if(seen.has(c.action.customerId))continue;seen.add(c.action.customerId);selected.push(c);if(selected.length>=limit)break;}
  return {actions:selected.map(c=>c.action),ranking:selected.map(c=>({customerId:c.action.customerId,catalogId:c.action.catalogId,probability:c.probability,expectedNetCents:c.expectedNetCents,...(Number.isFinite(c.expectedSharedNetCents)?{expectedMerchantNetCents:c.expectedSharedNetCents-c.expectedNetCents,expectedSharedNetCents:c.expectedSharedNetCents}:{}),modelId:model.id,estimator:c.model||model.family,...(c.calibration?{calibration:c.calibration}:{})})),configuration:supply,reason:model.objective==='shared_contribution'?'Rank expected payment plus retailer order contribution; require positive estimated value for both. These are predictions, not protected future profits.':calibration?'Local intent scores adjusted using recent observed funding response, then checked against contact cost.':'Locally trained models rank observed intent by expected retained payment contribution under the active campaign.',model:{id:model.id,type:(model.inquiryExpert?model.family+' + inquiry reward posterior':model.family)+(calibration?' + market funding adjustment':''),rows:model.artifact.trainingRows,cutoffDay:model.cutoff,...(calibration?{calibration}:{})}};
}
