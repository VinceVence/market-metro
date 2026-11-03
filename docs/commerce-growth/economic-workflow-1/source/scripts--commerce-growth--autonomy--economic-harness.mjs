// One planner chooses its own tool sequence. Persist model requests, tool
// results and bounded research recommendations; never run arbitrary SQL/code.
import {readFile,writeFile,rename} from 'node:fs/promises';
import {digest} from '../environment.mjs';
import {ECONOMIC_DOMAINS,ECONOMIC_INDICATORS,inspectEconomy,trainEconomicForecast,validateEconomicPatch,requiredEconomicEvidence,economicContactPlan,patchApplies} from './economic-tools.mjs';
import {planFundedBaskets} from '../experiments/baskets.mjs';

const str={type:'STRING'},en=x=>({type:'STRING',enum:x});
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const required=(properties)=>({type:'OBJECT',properties,required:Object.keys(properties)});
const baseArgs=properties=>required({...properties,reason:str});
function toolsFor(state,finalOnly=false){
 const final={name:'select_economic_policy',description:'Finish with v1 or queue an exact tested research candidate. This never deploys or charges a customer.',parameters:baseArgs({decision:en(['keep_v1','queue_shadow']),candidate_id:en(['v1',...Object.keys(state.candidates)]),measured_delta_usd:{type:'NUMBER'}})};
 if(finalOnly)return [final];
 const declarations=[final,
  {name:'inspect_indicators',description:'Read observed economic indicators. Choose the domains and time window needed for your hypothesis.',parameters:baseArgs({domains:{type:'ARRAY',items:en(ECONOMIC_DOMAINS)},window_days:{type:'INTEGER',description:'Use7,14 or28 days.'}})},
  {name:'fit_demand_model',description:'Actually fit a local rolling-demand model; adaptive chooses among7/14/28-day windows using past-only validation.',parameters:baseArgs({method:en(['recent7','recent14','legacy28','adaptive'])})},
  {name:'preview_policy',description:'Compose and preview a temporary conditional commerce policy. It lasts3 or7days then returns to v1. A change needs cited evidence for the affected domains. Forecast cover needs a fitted forecast; deadline settlement needs forecast_cover. Preview does not send messages or move money.',parameters:baseArgs({policy:required({campaign:en(['v1','recommendations','reactivation']),objective:en(['joint','paypal']),inventory:en(['v1','funded_only','forecast_cover']),forecast_id:en(['none',...Object.keys(state.models)]),cover_days:{type:'INTEGER',description:'Use0,3 or7 days of extra demand cover.'},settlement:en(['fast','deadline']),duration_days:{type:'INTEGER',description:'Use3 or7 days; a longer lease is not allowed.'},conditions:{type:'ARRAY',items:required({indicator:en(Object.keys(ECONOMIC_INDICATORS)),operator:en(['above','below']),value:{type:'NUMBER'}})}}),evidence_ids:{type:'ARRAY',items:str}})},
  {name:'run_historical_trial',description:'Compare a previewed candidate with frozen v1 on a different, completed historical market. Not a forecast or rollout of the current market. Maximum one trial.',parameters:baseArgs({candidate_id:en(Object.keys(state.candidates).length?Object.keys(state.candidates):['NO_CANDIDATE_YET']),historical_market:en(['H1'])})}
 ];
 return declarations.filter(d=>d.name!=='preview_policy'||Object.keys(state.evidence).length).filter(d=>d.name!=='fit_demand_model'||Object.keys(state.models).length<state.limits.modelFits).filter(d=>d.name!=='run_historical_trial'||Object.keys(state.candidates).length&&Object.keys(state.trials).length<state.limits.trials);
}
function checkKeys(args,keys){if(!args||Object.keys(args).sort().join()!==[...keys,'reason'].sort().join()||typeof args.reason!=='string'||args.reason.length>2200)throw Error('INVALID_TOOL_ARGUMENTS');}
export async function openEconomicHarness({view,resources,path,historyDescription,compareHistorical,limits={modelCalls:6,proposals:2,modelFits:2,trials:1},resume=false}){
 const snapshotId=digest(view),initial={version:1,status:'RUNNING',snapshotId,day:view.day,baseline:'paypal-net-v1',limits,models:{},evidence:{},candidates:{},trials:{},cache:{},checkpoints:[],providerCalls:0,pending:null},state=resume?JSON.parse(await readFile(path,'utf8')):initial;
 if(state.snapshotId!==snapshotId||JSON.stringify(state.limits)!==JSON.stringify(limits))throw Error('STALE_WORKFLOW_SNAPSHOT');
 const save=async()=>{await writeFile(path+'.tmp',JSON.stringify(state,null,2)+'\n');await rename(path+'.tmp',path);};
 if(!resume)await writeFile(path,JSON.stringify(state,null,2)+'\n',{flag:'wx'});
 async function execute(name,args){
  if(!args||typeof args.reason!=='string'||args.reason.length>2200)throw Error('INVALID_TOOL_ARGUMENTS');
  if(['run_historical_trial','select_economic_policy'].includes(name)&&args?.candidate_id&&args.candidate_id!=='v1'){
   const candidate=state.candidates[args.candidate_id];if(!candidate)throw Error('UNKNOWN_CANDIDATE');const {id,...body}=candidate;if(id!=='P-'+digest(body).slice(0,20)||candidate.snapshotId!==snapshotId)throw Error('CANDIDATE_CHANGED_AFTER_PREVIEW');
  }
  const {reason,...parameters}=args||{},cacheId=digest(canonical({name,parameters}));if(state.cache[cacheId])return state.cache[cacheId];if(state.status!=='RUNNING')throw Error('WORKFLOW_CLOSED');let output;
  if(name==='inspect_indicators'){
   checkKeys(args,['domains','window_days']);output=inspectEconomy(view,args.domains,args.window_days);state.evidence[output.evidenceId]={...output,snapshotId};
  }else if(name==='fit_demand_model'){
   checkKeys(args,['method']);if(Object.keys(state.models).length>=limits.modelFits)throw Error('MODEL_FIT_LIMIT');const model=trainEconomicForecast(view,args.method);state.models[model.id]=model;output={...model,evidenceId:model.id,domains:['demand']};state.evidence[model.id]={snapshotId,domains:['demand'],output};
  }else if(name==='preview_policy'){
   checkKeys(args,['policy','evidence_ids']);if(Object.keys(state.candidates).length>=limits.proposals)throw Error('PROPOSAL_LIMIT');const forecast=args.policy?.forecast_id==='none'?null:state.models[args.policy?.forecast_id],policy=validateEconomicPatch(args.policy,forecast);
   if(forecast){const {id,...body}=forecast;if(forecast.snapshotId!==snapshotId||id!=='F-'+digest(body).slice(0,20))throw Error('FORECAST_CHANGED_AFTER_FIT');}
   if(!Array.isArray(args.evidence_ids)||!args.evidence_ids.length||args.evidence_ids.some(id=>state.evidence[id]?.snapshotId!==snapshotId))throw Error('UNKNOWN_OR_STALE_EVIDENCE');
   const available=new Set(args.evidence_ids.flatMap(id=>state.evidence[id].domains)),missing=requiredEconomicEvidence(policy).filter(d=>!available.has(d));if(missing.length)throw Error('MISSING_EVIDENCE: '+missing.join(','));
   const body={snapshotId,reviewDay:view.day,policy,forecast,evidenceIds:[...args.evidence_ids]},id='P-'+digest(body).slice(0,20),candidate={id,...body};
   const contacts=economicContactPlan(view,resources,candidate),baseContacts=economicContactPlan(view,resources,{...candidate,policy:{...policy,campaign:'v1',objective:'joint'}}),funded=planFundedBaskets(view);output={candidate_id:id,policy,appliesNow:patchApplies(view,candidate),expiresBeforeDay:view.day+policy.duration_days,preview:{selectedContacts:contacts.actions.length,baselineContacts:baseContacts.actions.length,expectedRetailPaymentNetUSD:contacts.ranking.reduce((s,r)=>s+r.expectedNetCents,0)/100,baselineExpectedRetailPaymentNetUSD:baseContacts.ranking.reduce((s,r)=>s+r.expectedNetCents,0)/100,feasibleFundedPlans:funded.decisions.filter(d=>d.status==='COMPLETE_FUNDED_PLAN').length,fundedRestockUnits:funded.orders.flatMap(o=>o.items).reduce((s,i)=>s+i.quantity,0)},scope:'Current read-only preview. Predicted contact value is not causal profit. Funded plan counts describe the existing trusted complete-basket tool; actual policy stock changes are tested in the historical trial.'};state.candidates[id]=candidate;
  }else if(name==='run_historical_trial'){
   checkKeys(args,['candidate_id','historical_market']);if(args.historical_market!=='H1'||!state.candidates[args.candidate_id])throw Error('UNKNOWN_HISTORICAL_TRIAL');if(Object.keys(state.trials).length>=limits.trials)throw Error('HISTORICAL_TRIAL_LIMIT');
   const candidate=state.candidates[args.candidate_id],{id,...body}=candidate;if(id!=='P-'+digest(body).slice(0,20))throw Error('CANDIDATE_CHANGED_AFTER_PREVIEW');output=await compareHistorical(structuredClone(candidate));if(output.source!=='DIFFERENT_COMPLETED_HISTORICAL_MARKET'||output.candidateId!==args.candidate_id||!output.economyUnchanged)throw Error('UNBOUND_HISTORICAL_RESULT');state.trials[args.candidate_id]=output;
  }else if(name==='select_economic_policy'){
   checkKeys(args,['decision','candidate_id','measured_delta_usd']);if(!['keep_v1','queue_shadow'].includes(args.decision)||!Number.isFinite(args.measured_delta_usd))throw Error('INVALID_FINAL_DECISION');
   if(args.decision==='keep_v1'){if(args.candidate_id!=='v1'||args.measured_delta_usd!==0)throw Error('INVALID_BASELINE_SELECTION');}
   else{const t=state.trials[args.candidate_id];if(!t||t.activeDays<1||Math.abs(t.delta.platformUSD-args.measured_delta_usd)>.005)throw Error('UNTESTED_OR_MISQUOTED_SELECTION');}
   output={...args,status:args.decision==='keep_v1'?'BASELINE_RETAINED':'QUEUED_FOR_SHADOW_RESEARCH',promoted:false,scope:'Research recommendation only. A wider fresh-seed comparison is required for a financial improvement claim.'};state.recommendation=output;
  }else throw Error('UNKNOWN_ECONOMIC_TOOL');
  state.cache[cacheId]=output;return output;
 }
 async function finishPending(){const pending=state.pending;if(!pending)return;
  const cp=state.checkpoints.find(c=>c.id===pending.checkpointId);try{cp.output=await execute(pending.name,pending.args);cp.status='COMPLETED';if(pending.name==='select_economic_policy')state.status='COMPLETED';}
  catch(e){cp.status='ERROR';cp.output={error:e.message,scope:'No live mutation occurred. Choose a valid tool or keep v1.'};}state.pending=null;await save();
 }
 return {state,execute,save,async run(provider){
  if(state.status==='COMPLETED')return state;state.status='RUNNING';await finishPending();
  for(;state.status!=='COMPLETED'&&state.providerCalls<limits.modelCalls;){
   const last=state.providerCalls===limits.modelCalls-1,functions=toolsFor(state,last),input={task:'Review this observed market. Choose which economic data to inspect, fit a model if useful, compose a bounded commerce intervention, and test one defensible candidate on a different historical market. Investigate conflicting indicators. You can keep v1. Do not invent economic variables or make unconditional/permanent interventions.',snapshotId,currentDay:view.day,historyThroughDay:view.day-1,customers:view.audience.length,merchants:view.merchants.length,indicatorCatalog:ECONOMIC_INDICATORS,historicalComparison:historyDescription,baseline:'v1 uses broad positive-value inquiries, a local model, complete funded baskets and fast supplier settlement.',actionGrounding:{campaign:['outreach','demand','payments'],inventory:['inventory','liquidity'],settlement:['supply','payments']},remainingModelCalls:limits.modelCalls-state.providerCalls,remainingTrials:limits.trials-Object.keys(state.trials).length,outputs:state.checkpoints.filter(c=>c.actor==='TRUSTED_TOOL').map(c=>({tool:c.tool,input:c.input,output:c.output,status:c.status})),lastTurn:last?'Finish now using select_economic_policy.':'You choose the next tool; no fixed role sequence.'};
   const cp={id:'MODEL-'+state.providerCalls,actor:'GEMINI',status:'STARTED',input};state.checkpoints.push(cp);state.providerCalls++;await save();const before=provider.client.events.length;
   try{const result=await provider.client.json('You are the economic workflow planner for Market Metro. Control the investigation through trusted tools. Interpret demand, stock, merchant liquidity, supply timing and payment economics together. All observations are synthetic and as-of; never infer hidden wallets, latent needs, scenario labels or future outcomes. A historical what-if result is not a live forecast. No raw code, SQL or external payment action is available. Explain each tool choice briefly. Respect the tool/cost budget and keep v1 when evidence does not support a change.',input,{caseId:cp.id,trialId:path,functions});
    if(!functions.some(f=>f.name===result.name))throw Error('UNAVAILABLE_TOOL');Object.assign(cp,{status:'COMPLETED',output:result,provider:provider.client.events.slice(before)});
    const id='TOOL-'+state.checkpoints.length;state.checkpoints.push({id,actor:'TRUSTED_TOOL',tool:result.name,status:'STARTED',input:result.args});state.pending={checkpointId:id,name:result.name,args:result.args};await save();await finishPending();
   }catch(e){Object.assign(cp,{status:'FAILED',error:e.message,provider:provider.client.events.slice(before)});state.status='STOPPED';state.error=e.message;break;}
  }
  if(state.status!=='COMPLETED'){state.status='STOPPED';state.recommendation={decision:'keep_v1',candidate_id:'v1',promoted:false,reason:state.error||'Tool budget exhausted; no unreviewed plan is published.'};}
  state.costUSD=state.checkpoints.flatMap(c=>c.provider||[]).reduce((s,e)=>s+(e.modelCostMicros??e.reservedMicros??0),0)/1e6;await save();return state;
 }};
}
