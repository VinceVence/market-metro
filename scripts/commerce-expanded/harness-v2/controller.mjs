import {mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {openTeamVertex} from '../../agent-mesh/model-client.mjs';
import {outreachPlan} from '../../commerce-growth/team/control.mjs';
import {read,digest,datasetOverview,inspectDemand,inspectCurrent,matureOwnRows,fitModel,compileCampaign,scoreCampaign,captureInputs,FEATURES,FAMILIES,KINDS} from './tools.mjs';
import {createTrialTool,publicationGate} from './trials.mjs';

const en=values=>({type:'STRING',enum:values}),str={type:'STRING'};
const campaignSchema={type:'OBJECT',properties:{kind:en(KINDS),objective:en(['paypal','joint']),contactsPer100:en(['3','6','10']),forecast:en(['recent7','recent14','adaptive']),coverDays:en(['0','3','7']),routing:en(['fast','auto']),target:en(['cheap','preferred'])},required:['kind','objective','contactsPer100','forecast','coverDays','routing','target']};
const instructions='You operate a checkpointed commerce experiment workflow. Economic dates PAUSE while you investigate, train, test and revise. Improve retained purchases and modeled PayPal contribution while protecting merchants. The same tools, evidence and six-call review budget are available to a single planner and the three-role team. Use tool results to change decisions, not merely narrate them. No hidden needs, future active-market outcomes, household wallets or seeds are available. Immediate funding is not eventual purchase: some requests fund later. Training and development trials are synthetic, conditional and small-scale; they do not establish causal lift or production profit. Every publication must bind the exact tested campaign and model. You cannot edit SQL, simulation behavior, rewards, fees or budgets. Never claim significance or optimality without evidence.';

export async function openCommerceHarnessV2({id,dir,mode='team',prior,incumbent,providerFactory=openTeamVertex,trialFactory=createTrialTool,onCheckpoint=async()=>{}}){
 if(!['team','single'].includes(mode))throw Error('V2_INVALID_MODE');await mkdir(dir,{recursive:true});
 const historical=(await read('docs/commerce-growth/autonomy-1/funding-training/dataset.json')).rows;
 const state={version:'commerce-harness-v2',id,mode,status:'READY',pending:false,failed:false,rounds:0,lastDay:null,checkpoints:[],publications:[],training:[],schedule:[]};
 const observed=[],models={};let provider=null,trialTool=null,closed=false,reviewJob=null;
 const costs=()=> (provider?.client.events||[]).reduce((s,e)=>s+(e.modelCostMicros??e.reservedMicros??0),0)/1e6;
 let writes=Promise.resolve();
 function save(){const snapshot=JSON.stringify({...state,modelCostUSD:costs()},null,2)+'\n';const job=async()=>{await writeFile(dir+'/checkpoints.json.tmp',snapshot);await rename(dir+'/checkpoints.json.tmp',dir+'/checkpoints.json');await onCheckpoint();};writes=writes.then(job,job);return writes;}
 async function tool(role,actor,day,input,fn){const cp={role,actor,day,status:'STARTED',input,startedAt:new Date().toISOString()};state.checkpoints.push(cp);await save();try{const output=await fn();if(actor==='LOCAL_TRAINING_TOOL')Object.assign(cp.input,{rows:output.trainingRows,ownMatureRows:output.ownMatureRows});Object.assign(cp,{status:'COMPLETED',completedDay:day,output,finishedAt:new Date().toISOString()});await save();return output;}catch(e){Object.assign(cp,{status:'FAILED',completedDay:day,error:e.message});await save();throw e;}}
 async function ask(role,name,day,input,fields){
  if(state.checkpoints.filter(c=>c.actor==='GEMINI'&&c.day===day).length>=6||state.checkpoints.filter(c=>c.actor==='GEMINI').length>=12)throw Error('V2_CALL_CAP');
  role=mode==='single'?'Single commerce planner':role;const evidenceId=digest(input),cp={role,actor:'GEMINI',day,status:'STARTED',input:{...input,evidenceId},startedAt:new Date().toISOString()};state.checkpoints.push(cp);await save();let start=0;
  try{
   provider??=await providerFactory('HARNESS-V2-'+id,{route:'lite',capMicros:250000});start=provider.client.events.length;
   const result=await provider.client.json(instructions+' Your current role is '+role+'.',cp.input,{caseId:role+'-'+name+'-'+day,trialId:id,functions:[{name,description:'Commit a bounded analytical decision and its evidence reference.',parameters:{type:'OBJECT',properties:{...fields,rationale:str,evidenceId:en([evidenceId])},required:[...Object.keys(fields),'rationale','evidenceId']}}]});
   if(result.name!==name||result.args?.evidenceId!==evidenceId||typeof result.args.rationale!=='string'||result.args.rationale.length>2200)throw Error('V2_INVALID_HANDOFF');
   for(const [key,schema]of Object.entries(fields))if(schema.enum&&!schema.enum.includes(result.args[key]))throw Error('V2_INVALID_FIELD_'+key);
   Object.assign(cp,{status:'VALIDATED',completedDay:day,output:result.args,provider:provider.client.events.slice(start),finishedAt:new Date().toISOString()});await save();return result.args;
  }catch(e){Object.assign(cp,{status:'FAILED',completedDay:day,error:e.message,provider:provider?.client.events.slice(start)||[]});await save();throw e;}
 }
 async function review(view){
  const day=view.day;state.pending=true;state.status='REVIEWING';state.rounds++;await save();
  try{
   const own=matureOwnRows(observed,view),overview={day,marketScale:view.scale||{shoppers:100,merchants:3},historical:datasetOverview(historical),ownMature:datasetOverview(own),budgetCents:view.outreach.remainingBudgetCents,currentSnapshotHash:digest(view),currentModel:state.schedule.at(-1)?.modelHash||null,clock:'Dates wait at this boundary; no simulated transactions occur during this review.'};
   const query=await ask('Market analyst','choose_investigation',day,{overview,queries:{category:'Compare observed category interest, stock and outcomes.',intent:'Compare fresh/search/browse inquiry and recommendation cohorts.',payment_funnel:'Distinguish response, immediate funding, pending outcomes and delayed retained purchases.',recency:'Compare new and returning customer observations.'}},{lens:en(['category','intent','payment_funnel','recency']),windowDays:en(['28','56','100'])});
   const analysis=await tool('Market analyst','LOCAL_ANALYSIS',day,{lens:query.lens,windowDays:Number(query.windowDays)},async()=>({current:inspectCurrent(view,query.lens),historical:inspectDemand(historical,{lens:query.lens,windowDays:Number(query.windowDays)}),title:'Demand investigation completed'}));
   const data=await ask('Market analyst','define_dataset',day,{overview,analysis,featureRecipes:{existing:'Original16 observed features; stock normalized per100shoppers.',intent_context:'Add actual pre-contact shopper interest freshness, including general inquiries with no SKU.',market_feedback:'Add prior-day contact/response/funding/mature-retention aggregates; train feedback directly rather than shifting retained odds with immediate funding.'},task:'Choose a dataset recipe and window supported by the investigation. Explain the commercial bottleneck.'},{featureView:en(FEATURES),windowDays:en(['28','56','100']),opportunity:str});
   const jobs=await ask('ML scientist','choose_training_experiments',day,{overview,analysis,data,recipes:{forest:'Direct retained-purchase forest.',logistic:'Regularized direct retained-purchase model.',response_hurdle:'P(response) times P(retained given response), preserving delayed-funded purchases.'},task:'Choose two distinct experiments. Vary family or remove/change the feature recipe for an ablation. Both train locally and retain mature delayed positives.'},{first:en(FAMILIES),second:en(FAMILIES),secondFeatureView:en(FEATURES)});
   if(jobs.first===jobs.second&&data.featureView===jobs.secondFeatureView)throw Error('V2_DUPLICATE_MODEL_EXPERIMENT');
   const candidates=[];
   for(const [i,[family,featureView]]of [[jobs.first,data.featureView],[jobs.second,jobs.secondFeatureView]].entries()){
    const fitDir=resolve(dir,'review-'+day,'fit-'+i),spec={family,featureView,windowDays:Number(data.windowDays)};
    let model;await tool('ML scientist','LOCAL_TRAINING_TOOL',day,{...spec,rows:historical.length+own.length,ownMatureRows:own.length,cutoffDay:day},async()=>{
     model=await fitModel(fitDir,historical,own,spec,day);models[model.modelHash]=model;candidates.push(model);state.training.push({modelId:model.id,modelHash:model.modelHash,report:model.report});
     return {modelId:model.id,family,recipe:featureView,featureNames:model.artifact.featureNames,metrics:model.report.metrics,coarse:model.report.coarse,validationPassed:model.report.metrics.logLoss<=model.report.coarse.logLoss,runtimeSeconds:model.report.runtimeSeconds,trainingRows:model.artifact.trainingRows,ownMatureRows:model.ownRows,artifactFile:fitDir+'/model.json',modelHash:model.modelHash,title:'Local model experiment completed'};
    });
   }
   const science=await ask('ML scientist','select_trained_artifact',day,{overview,analysis,data,experiments:candidates.map(m=>({modelId:m.id,modelHash:m.modelHash,spec:m.artifact.spec,report:m.report,ownRows:m.ownRows})),task:'Select a trained artifact. Model validation is not campaign profit; the next role will run the exact campaign.'},{modelId:en(candidates.map(m=>m.id)),finding:str});
   const chosen=candidates.find(m=>m.id===science.modelId);
   const proposal=await ask('Commerce manager','propose_campaign_trial',day,{overview,analysis,data,science,modelReport:chosen.report,allowedActions:{kind:KINDS,contactsPer100:'3/6/10 means18/36/60contacts in600shoppers.',routing:'fast is modeled PayPal supplier settlement; auto permits bank lag when feasible.',objective:'joint ranks payment plus merchant order contribution; paypal ranks payment contribution.',forecast:'Choose a fitted recent/adaptive demand forecast; inventory remains constrained by observed requests and cash.'},task:'Propose an exact campaign and supply configuration to test. The trial uses two separate100-shopper completed development markets, not the active600-shopper future. Generalization must be measured later.'},{campaign:campaignSchema});
   const contract=compileCampaign(proposal.campaign,chosen,incumbent,day);
   if(!trialTool)await tool('Verifier','LOCAL_TRIAL_SETUP',day,{},async()=>{trialTool=await trialFactory({fixed:{id:'fixed_cover_joint',config:incumbent},prior});return {title:'Development trial tool ready',scope:'Two independent frozen100-shopper development worlds; no active-market future.'};});
   // The tool itself is not serialized into the checkpoint.
   if(typeof trialTool.evaluate!=='function')throw Error('V2_TRIAL_TOOL_UNAVAILABLE');
   const incumbentTrial=await tool('Verifier','LOCAL_CAMPAIGN_TRIAL',day,{contractHash:state.schedule.at(-1)?.hash||'FIXED',purpose:'incumbent continuation'},()=>trialTool.evaluate(null,null,state.schedule,models));
   const firstTrial=await tool('Commerce manager','LOCAL_CAMPAIGN_TRIAL',day,{contractHash:contract.hash,modelHash:chosen.modelHash},()=>trialTool.evaluate(contract,chosen,state.schedule,models));
   const firstGate=publicationGate(contract,chosen,firstTrial,incumbentTrial);
   const revise=await ask('Commerce manager','revise_after_trial',day,{overview,analysis,science,proposal,firstTrial,firstGate,incumbentTrial,availableModels:candidates.map(m=>({modelId:m.id,modelHash:m.modelHash,report:m.report})),task:'Use measured results. Publish this tested candidate, retain incumbent, or revise ONCE using an available trained model and another exact campaign. A revised contract will be measured and can publish only if it improves development PayPal net without reducing merchant contribution or retained purchases. Do not infer future confirmation outcomes.'},{decision:en(['publish','retain','revise']),modelId:en(candidates.map(m=>m.id)),campaign:campaignSchema});
   let selected=null,selectedModel=null,gate=firstGate,trial=firstTrial;
   if(revise.decision==='publish'){selected=contract;selectedModel=chosen;}
   if(revise.decision==='revise'){
    selectedModel=candidates.find(m=>m.id===revise.modelId);selected=compileCampaign(revise.campaign,selectedModel,incumbent,day);
    if(selected.hash===contract.hash)throw Error('V2_REVISION_MUST_CHANGE_CONTRACT');
    trial=await tool('Commerce manager','LOCAL_CAMPAIGN_TRIAL',day,{contractHash:selected.hash,modelHash:selectedModel.modelHash,revision:true},()=>trialTool.evaluate(selected,selectedModel,state.schedule,models));gate=publicationGate(selected,selectedModel,trial,incumbentTrial);
   }
   const publish=!!selected&&gate.passed;
   if(publish)state.schedule.push(selected);
   const active=state.schedule.at(-1),campaign=active?.campaign;
   await tool('Coordinator','TRUSTED_PUBLISHER',day,{requested:revise.decision,contractHash:selected?.hash||null,trialHash:trial.trialHash},async()=>({decision:publish?'publish':'keep',effectiveDay:day,modelId:active?models[active.modelHash].id:null,campaign:campaign?{...campaign,audience:campaign.kind==='reactivation'?'lapsed':'all',contactsPerDay:campaign.contactsPer100}:null,contractHash:active?.hash||'FIXED',testedContractHash:trial.contractHash,gate,reason:publish?'The exact tested contract passed development financial and model checks.':'Retained the last policy; the proposed contract did not pass or the agent chose to retain.',automated:true,nativePayments:false}));
   state.publications.push({day,published:publish,decision:revise.decision,contractHash:active?.hash||'FIXED',trialHash:trial.trialHash,gate});state.status='READY';
  }catch(e){state.failed=true;state.status='FALLBACK';state.checkpoints.push({role:'Coordinator',actor:'TRUSTED_FALLBACK',day,completedDay:day,status:'FAILED',error:e.message,output:{body:'Review stopped: '+e.message+'. Last published policy stays active.'}});}
  finally{state.pending=false;await save();}
 }
 return {async plan(view){
  if(closed)throw Error('V2_CONTROLLER_CLOSED');state.lastDay=view.day;
  if(!state.failed&&[30,60].includes(view.day)&&!state.publications.some(p=>p.day===view.day)){reviewJob=review(structuredClone(view));await reviewJob;}
  const contract=state.schedule.at(-1),proposal=contract?scoreCampaign(view,{contract,model:models[contract.modelHash],prior}):{...outreachPlan(view,incumbent,prior),configuration:incumbent,agentCampaign:false,reason:'Strong fixed workflow retained by the publication gate.'};
  observed.push(...captureInputs(view,proposal.actions,prior));return proposal;
 },summary(){return {...state,clockMode:'decision_barrier',modelCalls:(provider?.client.events||[]).length,modelCostUSD:costs(),trainingJobs:state.training.length,calibrationUpdates:0,activeContract:state.schedule.at(-1)||null};},async close(){closed=true;await reviewJob;await provider?.close();await save();}};
}
