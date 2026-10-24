import {mkdir,access,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {observedWorld,createSnapshot,boundedQuery,querySnapshot,fitCandidate,normalizeModelSpec,runPolicy,FIELDS,saveJSON,readJSON,sha} from './data.mjs';
import {pairedEstimate} from '../policy-lab/benchmark-stats.mjs';

export const LIMITS=Object.freeze({queries:6,models:4,pilots:2,steps:16,maxSQLBytes:5000});
export function validateCampaign(plan,contract){
  const keys=['title','audience','merchantIndices','maxOfferPct','durationDays','penaltyUSD'];
  if(!plan||keys.some(k=>!Object.hasOwn(plan,k))||Object.keys(plan).some(k=>!keys.includes(k))||typeof plan.title!=='string'||plan.title.length<3||plan.title.length>100||!['all','lapsed'].includes(plan.audience)||contract.audience==='lapsed'&&plan.audience!=='lapsed'||!Array.isArray(plan.merchantIndices)||!plan.merchantIndices.length||new Set(plan.merchantIndices).size!==plan.merchantIndices.length||plan.merchantIndices.some(i=>!contract.allowedMerchantIndices.includes(i))||![0,5,10].includes(plan.maxOfferPct)||plan.maxOfferPct>contract.maxCouponPct||!Number.isInteger(plan.durationDays)||plan.durationDays<1||plan.durationDays>contract.maxDurationDays||!Number.isFinite(plan.penaltyUSD)||plan.penaltyUSD<0||plan.penaltyUSD>1)throw Error('CAMPAIGN_EXCEEDS_INTERPRETED_CONTRACT');
  return {id:'SPEC-'+sha(plan).slice(0,12),strategy:plan.maxOfferPct?'mixed':'recommendations',audience:plan.audience,merchantIndices:plan.merchantIndices,maxOfferPct:plan.maxOfferPct,duration:plan.durationDays,penalty:plan.penaltyUSD,epsilon:0,windowDays:42};
}
const NONE={id:'observe',strategy:'observe',audience:'all',merchantIndices:[],maxOfferPct:0,duration:0,penalty:0,epsilon:0,windowDays:42};
const toolSchemas={
  inspect_schema:{description:'Read the actual observed SQLite schema and semantics. Contains no evaluation outcomes or hidden shopper traits.',properties:{}},
  query_warehouse:{description:'Execute one read-only SELECT or WITH query on the observed snapshot. Up to100 output rows and2 seconds. Use real column names; queries do not reveal future rows.',properties:{sql:{type:'STRING'}}},
  fit_model:{description:'Train a local candidate from mature past rows. Author up to6 non-intercept LINEAR expressions; the bias/intercept is already included automatically. No target/label columns. Compare chronological MSE to the constant baseline. MSE is not causal lift.',properties:{family:{type:'STRING',enum:['ridge','mean']},features:{type:'ARRAY',items:{type:'STRING'},maxItems:7},windowDays:{type:'INTEGER',description:'Exactly28,42 or56.'}}},
  run_pilot:{description:'Evaluate one candidate campaign against no campaign on3 separate development simulation seeds. These are simulated paired experiments, not real-customer RCTs. Final evaluation seeds are unavailable. All returns mature. A second pilot uses a disjoint seed group.',properties:{modelId:{type:'STRING'},title:{type:'STRING'},audience:{type:'STRING',enum:['all','lapsed']},merchantIndices:{type:'ARRAY',items:{type:'INTEGER'}},maxOfferPct:{type:'INTEGER',description:'0,5 or10, within the interpreted contract.'},durationDays:{type:'INTEGER',description:'1–14 and within the contract.'},penaltyUSD:{type:'NUMBER',description:'0–1 conservative reward penalty; not a calibrated confidence bound.'}}},
  commit_campaign:{description:'Commit an exact tested pilot proposal for independent review, or observe. Cite its mean in USD, not cents; rounding to the nearest cent is allowed. A probe requires positive mean development value and valid constraints; it is not proven uplift. Final evaluation remains hidden. No native payments.',properties:{pilotId:{type:'STRING'},decision:{type:'STRING',enum:['probe','observe']},expectedMeanUSD:{type:'NUMBER'},currency:{type:'STRING',enum:['USD']}}}
};

export async function createWorkspace({directory,id,task,catalog,contract}){
  await mkdir(directory,{recursive:true});const path=resolve(directory,'workspace.json'),snapshot=resolve(directory,'observed.sqlite');
  let state;try{state=await readJSON(path);}catch(e){if(e.code!=='ENOENT')throw e;state={id,contract,completed:false,models:[],pilots:[],journal:[],startedAt:new Date().toISOString()};}
  if(state.id!==id||sha(state.contract)!==sha(contract))throw Error('WORKSPACE_CONTRACT_CHANGED');
  const context=observedWorld({id,seed:task.seed,scenario:task.scenario,catalog,budgetCents:contract.budgetCents,cutoff:45});
  let schema;try{await access(snapshot);schema=querySnapshot(snapshot,"SELECT name,sql FROM sqlite_master WHERE type='table' ORDER BY name").rows;}catch(e){if(e.code!=='ENOENT')throw e;schema=createSnapshot(snapshot,context);}
  await saveJSON(resolve(directory,'schema.json'),schema);
  const snapshotHash=sha(await readFile(snapshot));if(state.snapshotHash&&state.snapshotHash!==snapshotHash)throw Error('OBSERVED_SNAPSHOT_CHANGED');state.snapshotHash=snapshotHash;
  const persist=()=>saveJSON(path,state);
  const completedIds=()=>[...state.journal.filter(j=>j.status!=='RUNNING').map(j=>j.id),...state.models.map(m=>m.id),...state.pilots.map(p=>p.id)];
  const uses=action=>['run_pilot','fit_model'].includes(action)?state.journal.filter(j=>j.action===action&&j.effectStarted).length:state.journal.filter(j=>j.action===action).length;
  function available(){
    if(state.completed)return [];
    const names=state.journal.some(j=>j.action==='inspect_schema'&&j.status==='COMPLETED')?[]:['inspect_schema'];
    if(uses('query_warehouse')<LIMITS.queries)names.push('query_warehouse');
    if(state.journal.some(j=>j.action==='query_warehouse'&&j.status==='COMPLETED')&&uses('fit_model')<LIMITS.models)names.push('fit_model');
    if(state.models.length&&uses('run_pilot')<LIMITS.pilots)names.push('run_pilot');
    if(state.pilots.length)names.push('commit_campaign');
    return names;
  }
  function toolDefinitions(){return available().map(name=>{const spec=toolSchemas[name],known=completedIds(),properties={...spec.properties,rationale:{type:'STRING',description:'Brief public hypothesis, decisive evidence and reason for this next step.'},evidenceIds:{type:'ARRAY',items:known.length?{type:'STRING',enum:known}:{type:'STRING'},description:'Use knownEvidenceIds: recorded results, models or pilots. Failed results may explain repair but do not establish financial benefit.'}};return {name,description:spec.description,parameters:{type:'OBJECT',properties,required:Object.keys(properties)}};});}
  function packet(){
    return {workspaceId:id,brief:task.brief,contract,cutoffDay:45,objective:'Additional modeled PayPal contribution after retained-order fees, processing, subsidy, outreach and actual model cost. Do not edit the reward.',
      availableActions:available(),knownEvidenceIds:completedIds(),remaining:{steps:LIMITS.steps-state.journal.length,queries:LIMITS.queries-uses('query_warehouse'),models:LIMITS.models-uses('fit_model'),pilots:LIMITS.pilots-uses('run_pilot')},
      knownSchema:state.journal.some(j=>j.action==='inspect_schema'&&j.status==='COMPLETED')?schema:undefined,
      financialDefinitions:'Warehouse *_cents columns are cents. Pilot estimate.mean, low and high are USD DOLLARS. gross_cents is merchant payment volume, NOT PayPal revenue. Never subtract fees from gross and call that platform contribution. The authoritative platform target is mature observations.reward_cents: retained fees minus processing, platform incentive reimbursement and outreach. It may be negative. SQL results are exploratory, not the immutable evaluator.',
      safeFeatures:FIELDS.slice(1),featureGrammar:'Up to6 non-intercept linear expressions. Bias/intercept is automatically included. Linear arithmetic only: + - * / and parentheses. Multiplication/division need a constant operand. No reward, future outcomes or post-purchase fields. Example: recency_30d - purchases_7d. All models compile to the unchanged engine interface.',
      models:state.models.map(m=>({id:m.id,...m.summary})),pilots:state.pilots.map(({replicas,artifact,...p})=>p),
      evidence:state.journal.slice(-7).map(j=>({id:j.id,action:j.action,status:j.status,rationale:j.rationale,output:j.action==='query_warehouse'&&j.output?.rows?{...j.output,rows:j.output.rows.slice(0,20),modelPreviewTruncated:j.output.rows.length>20}:j.output})),
      boundaries:'This is a simulation research workspace. Pilot controls are allowed development feedback, distinct from hidden final evaluation controls. No filesystem, network, arbitrary Python, payment or reward-editing tool is available.'};
  }
  async function execute(action,input,key){
    const prior=state.journal.find(j=>j.id===key);if(prior&&(prior.action!==action||sha(prior.parameters)!==sha(input)))throw Error('CHECKPOINT_PAYLOAD_CONFLICT');if(prior?.status==='COMPLETED')return prior.output;if(prior?.status==='FAILED')throw Error(prior.output.error);
    if(state.completed)throw Error('WORKSPACE_ALREADY_COMMITTED');
    if(!prior&&!available().includes(action))throw Error('TOOL_NOT_AVAILABLE_OR_LIMIT_EXCEEDED');
    const spec=toolSchemas[action];if(!spec||!input||typeof input.rationale!=='string'||input.rationale.length<5||input.rationale.length>1600||!Array.isArray(input.evidenceIds)||input.evidenceIds.some(id=>!completedIds().includes(id)))throw Error('INVALID_TOOL_EVIDENCE: cite an exact knownEvidenceId from a recorded result, model or pilot');
    const allowed=[...Object.keys(spec.properties),'rationale','evidenceIds'];if(Object.keys(input).some(k=>!allowed.includes(k))||allowed.some(k=>!Object.hasOwn(input,k)))throw Error('INVALID_TOOL_ARGUMENTS');
    const row=prior||{id:key,action,parameters:input,rationale:input.rationale,status:'RUNNING',startedAt:new Date().toISOString()};if(!prior)state.journal.push(row);await persist();
    try{
      let output;
      if(action==='inspect_schema')output={schema,cutoff:45,description:'Only observed events. reward_cents NULL means immature. orders.observed_refund_cents is incomplete for recent orders. Currency: simulated USD cents. Catalog provenance is cached Channel3.'};
      else if(action==='query_warehouse')output=await boundedQuery(snapshot,input.sql);
      else if(action==='fit_model'){
        const spec=normalizeModelSpec(input);row.effectStarted=true;await persist();
        const result=fitCandidate(context.actions,{...spec,cutoffDay:45}),model={id:key+'-MODEL',...result};state.models.push(model);output={modelId:model.id,...model.summary};
      }else if(action==='run_pilot'){
        const model=state.models.find(m=>m.id===input.modelId);if(!model)throw Error('UNKNOWN_WORKSPACE_MODEL');
        const {modelId,rationale,evidenceIds,...campaign}=input,plan=validateCampaign(campaign,contract),pilotNo=state.pilots.length;
        row.effectStarted=true;await persist();
        const seeds=pilotNo===0?[61001,61002,61003]:[61011,61012,61013],replicas=[];
        for(const seed of seeds){
          const args={id:key+'-PILOT-'+seed,seed,scenario:task.scenario,catalog,budgetCents:contract.budgetCents,cutoff:45};
          const control=runPolicy({...args,plan:NONE,artifact:null}),treatment=runPolicy({...args,plan,artifact:model.artifact});
          replicas.push({seed,deltaUSD:(treatment.platformProxyCents-control.platformProxyCents)/100,merchantDeltaUSD:(treatment.merchantContributionCents-control.merchantContributionCents)/100,spendCents:treatment.jointBudgetSpentCents,orders:treatment.purchases,offers:treatment.offers,recommendations:treatment.recommendations,checks:treatment.checks});
        }
        const estimate={...pairedEstimate(replicas,'deltaUSD'),unit:'USD',interval:'95% percentile bootstrap over3 paired development simulation seeds in this scenario; exploratory, not confirmatory'},pilot={id:key+'-PILOT',modelId,campaign,plan,estimate,replicas,
          validity:replicas.every(r=>Object.values(r.checks).every(n=>n===0)&&r.spendCents<=contract.budgetCents),
          interpretation:'Three independent development-seed paired rollouts, fully matured. Selection-biased when used to choose a campaign. Not final evidence, not real customers, not a mathematical causal guarantee outside this simulator.'};
        state.pilots.push(pilot);const {replicas:raw,...safe}=pilot;output=safe;
      }else if(action==='commit_campaign'){
        const pilot=state.pilots.find(p=>p.id===input.pilotId);if(!pilot||!['probe','observe'].includes(input.decision))throw Error('COMMIT_REQUIRES_COMPLETED_PILOT');
        if(input.currency!=='USD'||!Number.isFinite(input.expectedMeanUSD)||Math.abs(input.expectedMeanUSD-pilot.estimate.mean)>.005001)throw Error('CITE_PILOT_MEAN_IN_USD_WITHIN_HALF_A_CENT');
        if(input.decision==='probe'&&(!pilot.validity||pilot.estimate.mean<=0))throw Error('PROBE_REQUIRES_POSITIVE_VALID_PILOT');
        state.commit={decision:input.decision,pilotId:pilot.id,modelId:pilot.modelId,plan:input.decision==='probe'?pilot.plan:NONE,rationale:input.rationale,pilotEstimate:pilot.estimate,currency:'USD',expectedMeanUSD:pilot.estimate.mean,scope:'BOUNDED_SIMULATION_EXPERIMENT_NOT_PRODUCTION_PROMOTION'};state.completed=true;output=state.commit;
      }
      row.status='COMPLETED';row.output=output;row.finishedAt=new Date().toISOString();await persist();return output;
    }catch(e){row.status='FAILED';row.output={error:String(e.message).slice(0,400)};row.finishedAt=new Date().toISOString();await persist();throw e;}
  }
  await persist();
  return {state,packet,toolDefinitions,execute,completedIds,context,
    async recordRejection(action,input,key,error){state.journal.push({id:key,action,parameters:input,rationale:input?.rationale||'',status:'FAILED',output:{error:String(error).slice(0,400)},finishedAt:new Date().toISOString()});await persist();},
    finalPolicy(){const c=state.commit;if(!c)return {plan:NONE,artifact:null,completed:false};return {plan:c.plan,artifact:c.decision==='probe'?state.models.find(m=>m.id===c.modelId).artifact:null,completed:true};}};
}

export async function runFixedWorkflow(workspace,{search=false}={}){
  const call=async(action,parameters,rationale)=>workspace.execute(action,{...parameters,rationale,evidenceIds:workspace.completedIds()},workspace.state.id+'-STEP-'+String(workspace.state.journal.length+1).padStart(2,'0'));
  await call('inspect_schema',{},'Inspect the observed warehouse contract before querying.');
  await call('query_warehouse',{sql:'SELECT merchant_index, COUNT(*) AS orders, SUM(gross_cents-observed_refund_cents) AS retained_cents FROM orders GROUP BY merchant_index'},'Inspect merchant sales and observed refunds; do not confuse them with causal uplift.');
  await call('query_warehouse',{sql:'SELECT selected_action, COUNT(*) AS n, AVG(reward_cents) AS mean_reward FROM observations WHERE reward_cents IS NOT NULL GROUP BY selected_action'},'Inspect mature outcome support for the local model.');
  const recipes=search?[
    {family:'mean',features:[],windowDays:42},
    {family:'ridge',features:FIELDS.slice(1),windowDays:42},
    {family:'ridge',features:['recency_30d - purchases_7d','offers_7d','price_scale','recent_refunds'],windowDays:28},
    {family:'ridge',features:['recency_30d','purchases_7d','price_scale','observed_merchant_affinity'],windowDays:56}
  ]:[{family:'ridge',features:FIELDS.slice(1),windowDays:42}];
  for(const recipe of recipes)await call('fit_model',recipe,'Fit a predeclared local pipeline on mature observations and inspect temporal validation.');
  const ranked=[...workspace.state.models].sort((a,b)=>a.summary.mse-b.summary.mse),contract=workspace.state.contract;
  for(let i=0;i<2;i++){
    const model=ranked[Math.min(i,ranked.length-1)];
    await call('run_pilot',{modelId:model.id,title:'Bounded recommendation experiment',audience:contract.audience,merchantIndices:contract.allowedMerchantIndices,maxOfferPct:0,durationDays:Math.min(3,contract.maxDurationDays),penaltyUSD:.6},'Test retained contribution after costs on a disjoint development pilot; prediction error is not uplift.');
  }
  const best=[...workspace.state.pilots].filter(p=>p.validity).sort((a,b)=>b.estimate.mean-a.estimate.mean)[0];
  await call('commit_campaign',{pilotId:best.id,decision:best.estimate.mean>0?'probe':'observe',expectedMeanUSD:best.estimate.mean,currency:'USD'},'Commit a bounded probe only when a completed development pilot has positive mean value; otherwise observe. Final evaluation remains sealed.');
}
