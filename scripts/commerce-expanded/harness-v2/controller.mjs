import {mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {openTeamVertex} from '../../agent-mesh/model-client.mjs';
import {outreachPlan} from '../../commerce-growth/team/control.mjs';
import {read,digest,datasetOverview,inspectDemand,inspectCurrent,matureOwnRows,fitModel,compileCampaign,scoreCampaign,captureInputs,FEATURES,FAMILIES,KINDS} from './tools.mjs';
import {createTrialTool,publicationGate,selectPublication} from './trials.mjs';
import {checkCampaignModel,MODEL_CHECK} from './model-check.mjs';
import {VERSION,MODEL_CAP_MICROS,en,textSchema as str,campaignSchema,toolDeclaration,validateToolReply,canonicalHash,freeze,marketProfileFor,validate} from './contracts.mjs';

const instructions='You operate a checkpointed commerce experiment workflow. Economic dates PAUSE while you investigate, train, test and revise. Improve retained purchases and modeled PayPal contribution while protecting merchants. The same tools, evidence and six-decision review budget are available to a single planner and the three-role team. Use tool results to change decisions, not merely narrate them. No hidden needs, future active-market outcomes, household wallets or seeds are available. Immediate funding is not eventual purchase: some requests fund later. Training and development trials are synthetic and conditional; they do not establish causal lift or production profit. You propose experiments and revisions; you cannot publish or veto a tested candidate. A deterministic controller ranks all eligible measured candidates and owns final publication. Stop searching with finish_review, or propose one revision with propose_campaign_revision. Every publication binds the exact tested campaign and model. You cannot edit SQL, simulation behavior, rewards, fees or budgets. Never claim significance or optimality without evidence.';

export function retryableModelFailure(error,event){return event?.status==='rejected'&&[429,500,502,503,504].includes(event.httpStatus)&&error.message==='VERTEX_HTTP_'+event.httpStatus;}
const roleBriefs={
 'Market analyst':'Own the demand hypothesis and dataset handoff. Identify who the incumbent underserves using observed interest, responses, stock and mature outcomes. Distinguish missing evidence from poor response; specify which features could discriminate the opportunity.',
 'ML scientist':'Own prediction quality and model handoff. Design a meaningful model/feature comparison for the analyst hypothesis. Inspect contact-type and source-market validation, not only pooled AUC. Explain limitations; a good classifier is not yet a profitable campaign.',
 'Commerce manager':'Own campaign economics. Use the analyst hypothesis and selected model; compare component trials and observed response. Seek additional retained commerce, protect merchant contribution and cash, and avoid supplier-fee gains from unnecessary stock. Revise based on measured differences.'
};

export async function openCommerceHarnessV2({id,dir,mode='team',modelCheck=false,trainingAdvisor=null,prior,incumbent,providerFactory=openTeamVertex,trialFactory=createTrialTool,onCheckpoint=async()=>{}}){
 if(!['team','single'].includes(mode))throw Error('V2_INVALID_MODE');await mkdir(dir,{recursive:true});
 const historical=(await read('docs/commerce-growth/autonomy-1/funding-training/dataset.json')).rows;
 const state={version:VERSION,modelCapUSD:MODEL_CAP_MICROS/1e6,id,mode,status:'READY',pending:false,failed:false,retries:0,rounds:0,lastDay:null,checkpoints:[],publications:[],training:[],schedule:[]};
 if(modelCheck)state.modelCheckVersion=MODEL_CHECK;
 const observed=[],models={};let provider=null,trialTool=null,closed=false,reviewJob=null,lastPlan=null,inFlight=false;
 const costs=()=> (provider?.client.events||[]).reduce((s,e)=>s+(e.modelCostMicros??e.reservedMicros??0),0)/1e6;
 const operationRecoveries=()=>({initialization:provider?.initializationRetries||0,localTrials:trialTool?.recoveryEvents||[]});
 let writes=Promise.resolve();
 function save(){const snapshot=JSON.stringify({...state,modelCostUSD:costs(),operationRecoveries:operationRecoveries()},null,2)+'\n';const job=async()=>{await writeFile(dir+'/checkpoints.json.tmp',snapshot);await rename(dir+'/checkpoints.json.tmp',dir+'/checkpoints.json');await onCheckpoint();};writes=writes.then(job,job);return writes;}
 async function tool(role,actor,day,input,fn){const cp={role,actor,day,status:'STARTED',input,startedAt:new Date().toISOString()};state.checkpoints.push(cp);await save();try{const output=await fn();if(actor==='LOCAL_TRAINING_TOOL')Object.assign(cp.input,{rows:output.trainingRows,ownMatureRows:output.ownMatureRows});Object.assign(cp,{status:'COMPLETED',completedDay:day,output,finishedAt:new Date().toISOString()});await save();return output;}catch(e){Object.assign(cp,{status:'FAILED',completedDay:day,error:e.message,errorDetails:{code:e.code??null,signal:e.signal??null,killed:e.killed===true}});await save();throw e;}}
 async function ask(role,name,day,input,fields,alternatives=[]){
  if(state.checkpoints.filter(c=>c.actor==='GEMINI'&&c.day===day).length>=6||state.checkpoints.filter(c=>c.actor==='GEMINI').length>=12)throw Error('V2_CALL_CAP');
  const brief=mode==='single'?Object.values(roleBriefs).join(' '):roleBriefs[role];role=mode==='single'?'Single commerce planner':role;const evidenceId=digest(input),cp={role,actor:'GEMINI',day,status:'STARTED',input:{...structuredClone(input),evidenceId},roleBrief:brief,startedAt:new Date().toISOString()};state.checkpoints.push(cp);await save();let start=0;
  try{
   provider??=await providerFactory('HARNESS-V2-'+id,{route:'first_review_pro',capMicros:MODEL_CAP_MICROS});start=provider.client.events.length;
   const declarations=[toolDeclaration(name,fields,evidenceId),...alternatives.map(t=>toolDeclaration(t.name,t.fields,evidenceId))];
   cp.allowedTools=declarations.map(t=>t.name);
   let result;
   for(let attempt=0;attempt<2;attempt++){
    if(provider.client.events.length>=14)throw Error('V2_PROVIDER_CALL_CAP');
    const before=provider.client.events.length;
    try{result=validateToolReply(await provider.client.json(instructions+' Your current role is '+role+'. '+brief,structuredClone(cp.input),{caseId:role+'-'+name+'-'+day+(attempt?'-retry':''),trialId:id,reviewDay:day,functions:declarations}),declarations);break;}
    catch(error){const events=provider.client.events.slice(before);
     if(attempt||state.retries>=2||events.length!==1||!retryableModelFailure(error,events[0]))throw error;
     state.retries++;cp.retries??=[];cp.retries.push({error:error.message,evidenceId,provider:events[0]});cp.provider=provider.client.events.slice(start);await save();
    }
   }
   Object.assign(cp,{status:'VALIDATED',completedDay:day,toolName:result.name,output:result.args,provider:provider.client.events.slice(start),finishedAt:new Date().toISOString()});await save();return {...result.args,toolName:result.name};
  }catch(e){Object.assign(cp,{status:'FAILED',completedDay:day,error:e.message,errorDetails:{code:e.code??null,signal:e.signal??null,killed:e.killed===true,initializationAttempts:e.initializationAttempts??null},provider:provider?.client.events.slice(start)||[]});await save();throw e;}
 }
 async function review(view,feedEvidence){
  const day=view.day,context=freeze({day,marketProfile:marketProfileFor(view),snapshotHash:canonicalHash(view)});state.pending=true;state.status='REVIEWING';state.rounds++;await save();
  try{
   const own=matureOwnRows(observed,view),active=state.schedule.at(-1),currentConfig=active?.configuration||incumbent,recent=view.outreach.history.filter(c=>c.day<day&&c.day>=day-28),overview={day,marketScale:view.scale||{shoppers:100,merchants:3},historical:datasetOverview(historical),ownMature:datasetOverview(own),budgetCents:view.outreach.remainingBudgetCents,currentSnapshotHash:context.snapshotHash,currentModel:active?.modelHash||null,currentPolicy:{configuration:currentConfig,campaign:active?.campaign||null,source:active?'TESTED_CAMPAIGN':'STRONG_FIXED'},observedResponse:{contacts:recent.length,responded:recent.filter(c=>c.responded).length,rate:recent.length?recent.filter(c=>c.responded).length/recent.length:null,meaning:'Observed response, not immediate payment or eventual retained purchase.'},previousReviews:state.publications.map(p=>({day:p.day,published:p.published,experiments:p.experiments,...(p.modelComparison?{modelComparison:p.modelComparison}:{})})),clock:'Dates wait at this boundary; no simulated transactions occur during this review.'};
   if(trainingAdvisor)overview.certifiedPurchaseHistory={throughDay:feedEvidence.throughDay,checkouts:feedEvidence.metrics.purchases,sourceHash:feedEvidence.rowsHash};
   const query=await ask('Market analyst','choose_investigation',day,{overview,queries:{category:'Compare observed category interest, stock and outcomes.',intent:'Compare fresh/search/browse inquiry and recommendation cohorts.',payment_funnel:'Distinguish response, immediate funding, pending outcomes and delayed retained purchases.',recency:'Compare new and returning customer observations.'}},{lens:en(['category','intent','payment_funnel','recency']),windowDays:en(['28','56','100'])});
   const analysis=await tool('Market analyst','LOCAL_ANALYSIS',day,{lens:query.lens,windowDays:Number(query.windowDays)},async()=>({current:inspectCurrent(view,query.lens,Number(query.windowDays)),historical:inspectDemand(historical,{lens:query.lens,windowDays:Number(query.windowDays)}),title:'Demand investigation completed'}));
   const data=await ask('Market analyst','define_dataset',day,{overview,analysis,featureRecipes:{existing:'Original16 observed features; stock normalized per100shoppers.',intent_context:'Add actual pre-contact shopper interest freshness, including general inquiries with no SKU.',market_feedback:'Add prior-day contact/response/funding/mature-retention aggregates; train feedback directly rather than shifting retained odds with immediate funding.'},task:'Choose a dataset recipe and window supported by the investigation. Explain the commercial bottleneck.'},{featureView:en(FEATURES),windowDays:en(['28','56','100']),opportunity:str});
   const trainingAdvice=trainingAdvisor?await tool('ML scientist','LOCAL_TRAINING_MAP',day,{featureView:data.featureView,windowDays:Number(data.windowDays)},()=>trainingAdvisor.describe(historical,own,data,day)):null;
   const jobs=await ask('ML scientist','choose_training_experiments',day,{overview,analysis,data,...(trainingAdvice?{trainingAdvice}:{}),recipes:{forest:'Direct retained-purchase forest.',logistic:'Regularized direct retained-purchase model.',response_hurdle:'P(response) times P(retained given response), preserving delayed-funded purchases.',boosted:'Shallow gradient-boosted retained-purchase classifier.'},task:'Choose two distinct experiments. Vary family or remove/change the feature recipe for an ablation. Both train locally and retain mature delayed positives.'},{first:en(FAMILIES),second:en(FAMILIES),secondFeatureView:en(FEATURES)},trainingAdvice?.eligible?[{name:'compare_ontology_features',fields:{first:en(FAMILIES)}}]:[]);
   const candidates=[];
   const useTriage=jobs.toolName==='compare_ontology_features';
   for(const [i,[family,featureView]]of [[jobs.first,data.featureView],useTriage?['boosted','ontology_product_retention']:[jobs.second,jobs.secondFeatureView]].entries()){
    if(i&&family===jobs.first&&featureView===data.featureView){await tool('ML scientist','REUSED_EXPERIMENT',day,{},async()=>({title:'Duplicate model specification reused; no second fit claimed.'}));continue;}
    const fitDir=resolve(dir,'review-'+day,'fit-'+i),spec={family,featureView,windowDays:Number(data.windowDays)};
    let model;await tool('ML scientist','LOCAL_TRAINING_TOOL',day,{...spec,rows:historical.length+own.length,ownMatureRows:own.length,cutoffDay:day},async()=>{
     model=useTriage&&i===1?await trainingAdvisor.fit(fitDir,historical,own,candidates[0],day):await fitModel(fitDir,historical,own,spec,day);models[model.modelHash]=model;candidates.push(model);state.training.push({modelId:model.id,modelHash:model.modelHash,report:model.report});
     return {modelId:model.id,family,recipe:featureView,featureNames:model.artifact.trainingFields??model.artifact.featureNames,...(model.report.featureTriage?{featureTriage:model.report.featureTriage}:{}),metrics:model.report.metrics,coarse:model.report.coarse,inquiryValue:model.report.inquiryValue,validationPassed:model.report.metrics.logLoss<=model.report.coarse.logLoss,runtimeSeconds:model.report.runtimeSeconds,trainingRows:model.artifact.trainingRows,ownMatureRows:model.ownRows,artifactFile:fitDir+'/model.json',modelHash:model.modelHash,title:'Local model experiment completed'};
    });
   }
   const experiments=candidates.map(m=>({modelId:m.id,modelHash:m.modelHash,spec:m.artifact.spec,ownRows:m.ownRows,report:{rows:m.report.rows,positives:m.report.positives,...(m.report.featureTriage?{featureTriage:m.report.featureTriage}:{}),metrics:m.report.metrics,coarse:m.report.coarse,byContactType:m.report.byContactType,inquiryValue:m.report.inquiryValue,sourceMarkets:m.report.wholeMarketFolds.map(f=>({market:f.market,rows:f.rows,logLossDelta:f.metrics.logLoss-f.coarse.logLoss,auc:f.metrics.auc})),scope:m.report.scope}}));
   const science=await ask('ML scientist','select_trained_artifact',day,{overview,analysis,data,experiments,task:useTriage?'Compare byContactType.recommend on the same product-contact observation population for both models. Inspect the selected fields and market-specific errors. Choose an artifact for a financial trial.':'Select a trained artifact. Model validation is not campaign profit; the next role will run the exact campaign.'},{modelId:en(candidates.map(m=>m.id)),finding:str});
   const chosen=candidates.find(m=>m.id===science.modelId);
   const proposal=await ask('Commerce manager','propose_campaign_trial',day,{overview,analysis,data,science,modelReport:experiments.find(m=>m.modelId===chosen.id).report,allowedActions:{kind:KINDS,inquiryRouting:'Queries without a product SKU use a reply-calibrated payment/merchant value head, not placeholder product features. It updates from observed replies and mature outcomes. open_discovery permits positive-value inquiries without recent product interest; recent-only campaigns cannot reach them.',contactsPer100:'3/6/10 means18/36/60contacts in600shoppers.',supplierSettlement:'paypal_fast is modeled PayPal supplier settlement; allow_bank_delay can choose slower bank settlement when feasible.',objective:'joint ranks payment plus merchant order contribution; paypal ranks payment contribution.',forecast:'Choose a fitted recent/adaptive demand forecast; inventory remains constrained by observed requests and cash.',productPreference:'lowest_acceptable_price / requested_preference refers to PRODUCTS, never shopper segments.'},task:'Propose a campaign that addresses a gap in the current policy. Use observed response and previous reviews; AUC alone does not establish incremental sales. Retain current supply settings unless demand/stock evidence supports a change. If supply changes, the verifier also tests this campaign with incumbent supply to isolate its contribution. Trials include separate discovery, low-response and no-response markets; never active-market future.'},{campaign:campaignSchema});
   const contract=compileCampaign(proposal.campaign,chosen,incumbent,context);
   if(!trialTool)await tool('Verifier','LOCAL_TRIAL_SETUP',day,{},async()=>{trialTool=await trialFactory({fixed:{id:'fixed_cover_joint',config:incumbent},prior,marketProfile:context.marketProfile});return {title:'Development trial tool ready',scope:'Matched-size '+context.marketProfile+' development worlds; no active-market future.'};});
   // The tool itself is not serialized into the checkpoint.
   if(typeof trialTool.evaluate!=='function')throw Error('V2_TRIAL_TOOL_UNAVAILABLE');
   const incumbentTrial=await tool('Verifier','LOCAL_CAMPAIGN_TRIAL',day,{contractHash:state.schedule.at(-1)?.hash||'FIXED',purpose:'incumbent continuation'},()=>trialTool.evaluate(null,null,state.schedule,models,context));
   const firstTrial=await tool('Commerce manager','LOCAL_CAMPAIGN_TRIAL',day,{contractHash:contract.hash,modelHash:chosen.modelHash},()=>trialTool.evaluate(contract,chosen,state.schedule,models,context));
   const firstGate=publicationGate(contract,chosen,firstTrial,incumbentTrial);
   const tested=[{contract,model:chosen,trial:firstTrial}];let agentRequest='finish_review';
   if(canonicalHash(contract.configuration)!==canonicalHash(currentConfig)){
    const marketingOnly=compileCampaign({...proposal.campaign,forecast:currentConfig.forecast,coverDays:String(currentConfig.coverDays),supplierSettlement:currentConfig.routing==='fast'?'paypal_fast':'allow_bank_delay',productPreference:currentConfig.target==='cheap'?'lowest_acceptable_price':'requested_preference'},chosen,currentConfig,context);
    const trial=await tool('Verifier','LOCAL_CAMPAIGN_TRIAL',day,{contractHash:marketingOnly.hash,modelHash:chosen.modelHash,purpose:'isolate marketing; retain incumbent supply'},()=>trialTool.evaluate(marketingOnly,chosen,state.schedule,models,context));
    publicationGate(marketingOnly,chosen,trial,incumbentTrial);tested.push({contract:marketingOnly,model:chosen,trial});
   }
   // Revision is optional. It cannot veto an already measured eligible candidate.
   try{
    const response=await ask('Commerce manager','propose_campaign_revision',day,{overview,analysis,science,proposal,firstTrial,firstGate,incumbentTrial,componentTrials:tested.map(c=>({campaign:c.contract.campaign,measurement:c.trial.measurement,cases:c.trial.cases,gate:publicationGate(c.contract,c.model,c.trial,incumbentTrial)})),availableModels:experiments,task:'Use measured component differences, per-market merchant outcomes and observed response to diagnose the result. Supplier fees without retained commerce or partner cash are not sufficient. Revise one supported dimension or call finish_review. Do not repeat a rejected experiment without new evidence. The controller considers the initial, supply-preserved and revised candidates; you cannot veto or publish one.'},{modelId:en(candidates.map(m=>m.id)),campaign:campaignSchema},[{name:'finish_review',fields:{}}]);
    agentRequest=response.toolName;
    if(response.toolName==='propose_campaign_revision'){
     const model=candidates.find(m=>m.id===response.modelId),revision=compileCampaign(response.campaign,model,incumbent,context);
     if(tested.some(c=>c.contract.hash===revision.hash))await tool('Coordinator','UNCHANGED_PROPOSAL',day,{contractHash:revision.hash},async()=>({title:'Already tested proposal retained; no duplicate trial or failed workflow.'}));
     else{
      const trial=await tool('Commerce manager','LOCAL_CAMPAIGN_TRIAL',day,{contractHash:revision.hash,modelHash:model.modelHash,revision:true},()=>trialTool.evaluate(revision,model,state.schedule,models,context));
      publicationGate(revision,model,trial,incumbentTrial);tested.push({contract:revision,model,trial});
     }
    }
   }catch(e){state.failed=true;state.checkpoints.push({role:'Coordinator',actor:'REJECTED_REVISION',day,completedDay:day,status:'FAILED',error:e.message,output:{body:'Revision rejected. The controller will assess the previously completed trial; no uncertain model call is retried.'}});}
   let selection, modelComparison;
   if(modelCheck){
    const report=await tool('Verifier','LOCAL_MODEL_COMPARISON',day,{candidateModels:candidates.map(m=>m.id)},async()=>{
     const check=await checkCampaignModel({tested,trained:candidates,incumbentTrial,context,
      evaluate:(candidate,model)=>trialTool.evaluate(candidate,model,state.schedule,models,context)});
     selection=check.selection;
     if(check.admitted)tested.push(check.admitted);
     return check.report;
    });
    const {status,reason,anchor,alternative,selectedContractHash}=report;
    modelComparison={status,reason,anchor,alternative,selectedContractHash};
   }else selection=selectPublication(tested,incumbentTrial,context);
   const publish=selection.decision.decision==='publish';
   if(publish)state.schedule.push(selection.selected.contract);
   const published=state.schedule.at(-1),campaign=published?.campaign,selectedTrial=selection.selected?.trial||incumbentTrial;
   await tool('Coordinator','TRUSTED_PUBLISHER',day,{agentRequest,candidateHashes:tested.map(c=>c.contract.hash)},async()=>({...selection.decision,effectiveDay:day,modelId:published?models[published.modelHash].id:null,campaign:campaign?{...campaign,audience:campaign.kind==='reactivation'?'lapsed':'all',contactsPerDay:campaign.contactsPer100}:null,contractHash:published?.hash||'FIXED',testedContractHash:selectedTrial.contractHash,trialHash:selectedTrial.trialHash,receiptHash:selectedTrial.receiptHash,automated:true,nativePayments:false}));
   state.publications.push({day,published:publish,agentRequest,...selection.decision,...(modelComparison?{modelComparison}:{}),contractHash:published?.hash||'FIXED',trialHash:selectedTrial.trialHash,experiments:tested.map(c=>({campaign:c.contract.campaign,model:c.model.artifact.selected,measurement:c.trial.measurement,gate:publicationGate(c.contract,c.model,c.trial,incumbentTrial)}))});state.status=state.failed?'FALLBACK':'READY';
  }catch(e){state.failed=true;state.status='FALLBACK';state.checkpoints.push({role:'Coordinator',actor:'TRUSTED_FALLBACK',day,completedDay:day,status:'FAILED',error:e.message,output:{body:'Review stopped: '+e.message+'. Last published policy stays active.'}});}
  finally{state.pending=false;await save();}
 }
 async function decide(view,feedEvidence){
  state.lastDay=view.day;
  if(!state.failed&&[30,60].includes(view.day)&&!state.publications.some(p=>p.day===view.day)){reviewJob=review(view,feedEvidence);await reviewJob;}
  const contract=state.schedule.at(-1),proposal=contract?scoreCampaign(view,{contract,model:models[contract.modelHash],prior}):{...outreachPlan(view,incumbent,prior),configuration:incumbent,agentCampaign:false,reason:'Strong fixed workflow retained by the deterministic controller.'};
  if(view.day<60)observed.push(...captureInputs(view,proposal.actions,prior));return proposal;
 }
 return {async plan(view,feedEvidence=null){
  if(closed)throw Error('V2_CONTROLLER_CLOSED');validate(view.day,{type:'INTEGER',minimum:0,maximum:391});const hash=canonicalHash(view);
  const reviewDay=[30,60].includes(view.day);
  if(trainingAdvisor&&reviewDay&&(feedEvidence?.decision!=='CERTIFY'||feedEvidence.snapshotHash!==hash||feedEvidence.throughDay!==view.day||
    feedEvidence.metrics?.purchases!==view.pastOrders.length))throw Error('TRAINING_REQUIRES_CERTIFIED_PURCHASE_HISTORY');
  if(lastPlan?.day===view.day){if(lastPlan.hash!==hash)throw Error('V2_REVIEW_INPUT_CHANGED');return structuredClone(await lastPlan.promise);}
  if(inFlight||lastPlan&&view.day<lastPlan.day)throw Error('V2_INVALID_DAY_ORDER');
  inFlight=true;lastPlan={day:view.day,hash,promise:decide(freeze(structuredClone(view)),trainingAdvisor&&reviewDay?structuredClone(feedEvidence):null).finally(()=>{inFlight=false;})};
  return structuredClone(await lastPlan.promise);
 },summary(){return {...state,operationRecoveries:operationRecoveries(),clockMode:'decision_barrier',modelCalls:(provider?.client.events||[]).length,modelCostUSD:costs(),trainingJobs:state.training.length,calibrationUpdates:0,activeContract:state.schedule.at(-1)||null};},async close(){closed=true;await reviewJob;await provider?.close();await save();}};
}
