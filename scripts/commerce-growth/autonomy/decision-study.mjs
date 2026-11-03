// One bounded fresh-agent study. Six paid calls total; no native payments.
// No policy changes after confirmation seeds are opened. All artifacts retained.
import {readFile,writeFile,mkdir,copyFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {CONTRACT,digest} from '../environment.mjs';
import {runCoordinatedCase} from '../team/runner.mjs';
import {openAllocator} from '../../commerce-deadlines/solver.mjs';
import {openTeamVertex} from '../../agent-mesh/model-client.mjs';
import {compileCampaign,campaignPlan,NUMERICAL_CAMPAIGN,CAMPAIGN_FIELDS,selectMeasuredCampaign} from './campaign-experiment.mjs';

const load=async p=>JSON.parse(await readFile(p,'utf8'));
const metrics=['platformUSD','retailerUSD','retainedPurchases','retainedVolumeUSD','recommendationPurchases','attributedPurchases','contactCount','fundedResponses','outreachCostUSD','terminalCashUSD','terminalInventoryUSD','unpaidLiabilities'];
const mean=rows=>Object.fromEntries(metrics.map(k=>[k,rows.reduce((s,r)=>s+r[k],0)/rows.length]));
const json=x=>JSON.stringify(x,null,2)+'\n';
const system=`You operate an autonomous simulated commerce campaign using typed tools. The objective is more retained purchases and settled modeled PayPal contribution while protecting aggregate retailer contribution. Analyze the supplied market evidence, propose an executable campaign, test it, and revise from measured results. You may choose the incumbent when changes do not help. All agents and the single planner have identical information, models, tools and call/trial budgets. You may use planning, independent criticism, data science and commercial judgment at every stage. Do not invent metrics, hidden customer needs, funding, seeds, or claims of statistical significance. These are uncalibrated simulation assumptions, not real PayPal profit. Do not merely narrate: your bounded expression will actually decide which shoppers are contacted and which observed product is recommended. Preserve consent and existing funds. Your program cannot change prices, invent needs, mutate SQL or call payment APIs. Observe all measured losses, not just a favorable market. A response is not a retained sale; inventory/fulfillment and displaced sales can reverse immediate score gains.`;
const enumSchema=values=>({type:'STRING',enum:values});
const textSchema={type:'STRING'};

export function summarizeExperiment(rows,fixed){
 const m=mean(rows),b=mean(fixed);
 return {...m,platformDeltaUSD:m.platformUSD-b.platformUSD,retailerDeltaUSD:m.retailerUSD-b.retailerUSD,
  retainedDelta:m.retainedPurchases-b.retainedPurchases,perMarket:rows.map((r,i)=>({market:i+1,platformDeltaUSD:r.platformUSD-fixed[i].platformUSD,retailerDeltaUSD:r.retailerUSD-fixed[i].retailerUSD,retainedDelta:r.retainedPurchases-fixed[i].retainedPurchases,contacts:r.contactCount,recommendationPurchases:r.recommendationPurchases})),scope:'Completed historical development scenarios. No unseen-seed result.'};
}
export function parseCampaignDecision(args){
 if(typeof args.hypothesis!=='string'||!args.hypothesis.trim()||args.hypothesis.length>1200||typeof args.rationale!=='string'||args.rationale.length>1800)throw Error('INVALID_CAMPAIGN_EXPLANATION');
 const compiled=compileCampaign({gate:JSON.parse(args.gateJSON),score:JSON.parse(args.scoreJSON),limit:args.limit});
 return {hypothesis:args.hypothesis,rationale:args.rationale,program:compiled.program,programHash:compiled.hash};
}
export function decisionAttribution(comparisons,arms,numericalHash){
 // Different prompt lengths can change cost while producing the same policy.
 // That is not evidence that collaboration improved the commerce decision.
 const improved=c=>c.platformDeltaUSD>.005&&c.afterActualDesignCostDeltaUSD>0&&c.retainedDelta>=0&&c.retailerDeltaUSD>=0;
 return {multiAgentBenefitObserved:arms.team.programHash!==arms.single.programHash&&improved(comparisons.single_planner),
  llmBenefitBeyondNumericalControlObserved:arms.team.programHash!==numericalHash&&improved(comparisons.shared_numerical_models),
  sameSelectedProgram:arms.team.programHash===arms.single.programHash,
  selectedNumericalControl:arms.team.programHash===numericalHash};
}

export async function runDecisionStudy(dir){
 await mkdir(dir);const core=await load('docs/commerce-growth/development-1/protocol.json'),
  fixed=(await load('docs/commerce-growth/team-1/development/results.json')).selectedFixed,
  artifact=await load('docs/commerce-growth/autonomy-1/shared-value-training-1/models.json'),
  prior=await load('docs/commerce-growth/team-1/training/model.json'),fundingPrior=await load('docs/commerce-growth/autonomy-1/funding-training/funding-prior.json'),
  resources={artifact,prior,fundingPrior},training=await load('docs/commerce-growth/autonomy-1/funding-training/dataset.json'),
  development=Object.entries(CONTRACT.developmentSeeds).map(([regime,seed])=>({regime,seed})),
  confirmation=development.map(({regime},i)=>({regime,seed:991210+i})),
  modelHash=digest(resources),id='DECISION-'+digest({dir,at:new Date().toISOString()}).slice(0,16),
  state={id,status:'INITIALIZED',calls:[],arms:{},rows:[],modelHash,confirmationOpened:false},cache=new Map(),allocator=openAllocator();let provider=null;
 const save=async(name,value)=>{await writeFile(dir+'/'+name+'.tmp',json(value));await rename(dir+'/'+name+'.tmp',dir+'/'+name);};
 const verify=async()=>{for(const [p,h]of Object.entries(core.sourceHashes))if(createHash('sha256').update(await readFile(p)).digest('hex')!==h)throw Error('FROZEN_ECONOMY_CHANGED');};
 const protocol={id,createdAt:new Date().toISOString(),development,confirmation,modelHash,economyHashes:core.sourceHashes,fixed,
  primary:'Paired settled modeled platform net after all actual design-call cost, with aggregate retailer contribution reported and used as a development publication guard.',
  secondary:['retained purchases','exact recommended-product purchases','merchant contribution','failed contacts','unpaid liabilities','model tokens/cost','LLM-authored changes vs shared numerical tool','multi-agent vs equal-budget single planner'],
  arms:['strong_fixed','shared_numerical_models','single_planner','specialist_team'],
  equalBudget:{model:'gemini-3.1-flash-lite',thinking:'MEDIUM',callsPerArm:3,candidateTrialsPerArm:2,sharedEvidenceAndModels:true},
  additionalCostCapUSD:.25,maxCalls:6,nativePayments:0,
  stopRule:'One design/critique/selection cycle per arm, then one seven-market confirmation. No tuning on confirmation outcomes and no automatic paid retry.',
  interpretation:'Seven paired confirmation markets are a screening pilot. Simulation gain is not production ROI. Shared local ML is a separate control; multiple role names alone are not evidence of multi-agent value.'};
 await verify();await save('protocol.json',protocol);
 for(const p of ['scripts/commerce-growth/autonomy/decision-study.mjs','scripts/commerce-growth/autonomy/campaign-experiment.mjs','scripts/commerce-growth/autonomy/features.mjs','scripts/commerce-growth/autonomy/inquiry-expert.mjs','scripts/commerce-growth/autonomy/funding-calibration.mjs','scripts/commerce-growth/experiments/program.mjs','scripts/commerce-growth/team/runner.mjs','scripts/commerce-growth/team/control.mjs'])await copyFile(p,dir+'/'+p.replaceAll('/','--'));
 async function simulate(program,cases,arm,phase){
  const compiled=program?compileCampaign(program):null,rows=[];
  for(const settings of cases){
   const key=digest({settings,programHash:compiled?.hash??'fixed',modelHash});
   let r=cache.get(key);if(!r){
    r=await runCoordinatedCase(settings,compiled?{id:'campaign_'+compiled.hash.slice(0,12)}:fixed,{allocator,prior,trace:true,
     controller:compiled?{plan:async view=>campaignPlan(view,compiled,resources,fixed.config)}:null});
    const trace=r.trace;delete r.trace;await save(phase+'-'+settings.seed+'-'+(compiled?.hash.slice(0,12)||'fixed')+'-trace.json',trace);
    cache.set(key,r);
   }
   rows.push({...r,policy:arm});state.rows.push({phase,arm,programHash:compiled?.hash??'fixed',...r});await save('progress.json',state);
   console.log(JSON.stringify({phase,arm,regime:settings.regime,net:r.platformUSD,merchant:r.retailerUSD,retained:r.retainedPurchases}));
  }
  return rows;
 }
 async function ask(arm,stage,packet,properties){
  if(state.calls.length>=6)throw Error('DECISION_STUDY_CALL_CAP');
  const evidenceId=digest(packet),role=arm==='single'?'Single commerce planner':{propose:'Campaign strategist',review:'Measurement scientist and campaign critic',select:'Commerce coordinator'}[stage],
   cp={arm,stage,role,evidenceId,input:packet,status:'STARTED',startedAt:new Date().toISOString()};state.calls.push(cp);await save('progress.json',state);
  provider??=await openTeamVertex(id,{route:'lite',capMicros:250000});const start=provider.client.events.length;
  const name={propose:'propose_policy',review:'review_policy',select:'close_experiment'}[stage];
  try{
   const result=await provider.client.json(system+' Your current role: '+role+'.', {...packet,evidenceId}, {caseId:arm+'-'+stage,trialId:id,functions:[{name,description:'Commit an executable campaign or a selection bound to the measured artifact.',parameters:{type:'OBJECT',properties:{...properties,evidenceId:enumSchema([evidenceId])},required:[...Object.keys(properties),'evidenceId']}}]});
   if(result.name!==name||result.args?.evidenceId!==evidenceId)throw Error('INVALID_DECISION_HANDOFF');
   Object.assign(cp,{status:'COMPLETED',output:result.args,provider:provider.client.events.slice(start),finishedAt:new Date().toISOString()});await save('progress.json',state);return result.args;
  }catch(e){Object.assign(cp,{status:'FAILED',error:e.message,provider:provider.client.events.slice(start)});await save('progress.json',state);throw e;}
 }
 try{
  state.status='DEVELOPMENT';const fixedRows=await simulate(null,development,'strong_fixed','development'),numericRows=await simulate(NUMERICAL_CAMPAIGN,development,'shared_numerical_models','development'),
   numeric={program:NUMERICAL_CAMPAIGN,programHash:compileCampaign(NUMERICAL_CAMPAIGN).hash,measurement:summarizeExperiment(numericRows,fixedRows)},
   base={program:null,programHash:'fixed',measurement:summarizeExperiment(fixedRows,fixedRows)},groups={};
  for(const r of training.rows){const age=r.x[0],kind=r.kind,group=kind+' / '+(r.x[1]?'search':age<8?'browse':'general inquiry'),g=groups[group]??={contacts:0,retained:0,funded:0,paymentNetUSD:0,retailerOrderContributionUSD:0};g.contacts++;g.retained+=r.retained;g.funded+=Number(r.authorized);g.paymentNetUSD+=r.retailNetCents/100;g.retailerOrderContributionUSD+=(r.merchantOrderContributionCents||0)/100;}
  const evidence={objective:protocol.primary,history:{rows:training.rows.length,groups,modelValidation:(await load('docs/commerce-growth/autonomy-1/shared-value-training-1/model-report.json')).summary,scope:'Historical observational contacts under two collection policies. These rates are not randomized causal uplift.'},
   controls:{fixed:base,numerical:numeric},
   features:CAMPAIGN_FIELDS,featureMeaning:{age:'Age of this product signal;99 for general inquiry.',interest_age:'Age of shopper latest signal, including for inquiry;99 if none.',search:'This product signal is a SEARCH.',latest_search:'The latest shopper signal is a SEARCH; otherwise may be an ambiguous BROWSE.',latest_product:'Recommendation matches the latest expressed product.',arrival_days:'0 if stock exists; confirmed/latest inbound lead otherwise;99 when none.',ml_probability:'Historical forest retained-purchase probability adjusted by prior-day funding rate; inquiry uses mature intent-age outcomes.',ml_paypal_net_usd:'Expected retained retail payment fee minus processing/contact cost. Includes a whole-request value estimate, not merely the recommended SKU.',ml_merchant_net_usd:'Conditional estimate of retained retailer order contribution minus goods, delivery and fees. Does not include inventory holding or displaced future sales.',ml_joint_net_usd:'Sum of those two estimates.',expected_net_usd:'Coarse product-price and grouped response estimate; weaker than model, supplied for diagnosis.',local_sample_count:'Only matured observed contacts; no future outcomes.'},
   syntax:{node:'number OR {"field":"allowed_name"} OR {"op":"operator","args":[nodes]}',operators:'add,mul,min,max,and,or (2-4 args); sub,div,lt,lte,gt,gte (2 args); if (3 args); log1p (1 arg)',bounds:'100 total gate+score nodes; depth10; constants abs<=1000; limit integer1..10. Gate>0 qualifies; score>0 ranks. At most one contact per consenting shopper;7-day contact gap; hard budget and100-day market cap enforced outside your program.'},
   constraints:'Only contact gate, ranking and maximum daily capacity change. Product catalogue, fulfillment, supplier settlement, customer needs and funds are identical. Organic shopping continues. Do not manufacture extra economic levers.',
   tools:'Your first proposal is tested on the same7historical scenarios. Then you may revise once and test again. A third call selects A, B, numerical or fixed using the exact result hashes. Only afterwards are seven unseen seeds opened.'};
  await save('shared-evidence.json',evidence);
  const properties={hypothesis:textSchema,rationale:textSchema,gateJSON:{type:'STRING',description:'A JSON string encoding the bounded gate expression.'},scoreJSON:{type:'STRING',description:'A JSON string encoding the bounded ranking expression.'},limit:{type:'INTEGER',minimum:1,maximum:10}};
  // Both arms see the same starting evidence. Neither sees the other arm's work.
  for(const arm of ['single','team']){
   const a=parseCampaignDecision(await ask(arm,'propose',{evidence,task:'Propose a campaign that addresses an observed gap. Preserve a strong existing policy if no justified change is available.'},properties));
   a.measurement=summarizeExperiment(await simulate(a.program,development,arm+'_A','development'),fixedRows);
   const review=await ask(arm,'review',{evidence,candidate:a,task:'Critique the measured first campaign. Keep it exactly or submit one revised executable campaign. Address observed losses, contact waste, merchant effects and alternative hypotheses; do not assume a narrative is evidence.'},{decision:enumSchema(['keep','revise']),...properties});
   const b=review.decision==='keep'?structuredClone(a):parseCampaignDecision(review);
   if(review.decision==='keep'&&compileCampaign({gate:JSON.parse(review.gateJSON),score:JSON.parse(review.scoreJSON),limit:review.limit}).hash!==a.programHash)throw Error('KEEP_CHANGED_PROGRAM');
   b.measurement=review.decision==='keep'?a.measurement:summarizeExperiment(await simulate(b.program,development,arm+'_B','development'),fixedRows);
   const candidates={A:a,B:b,numerical:numeric,fixed:base},measured=Object.fromEntries(Object.entries(candidates).map(([key,c])=>[key,{...c,measurementHash:digest(c.measurement)}]));
   const selected=await ask(arm,'select',{evidence,candidates:measured,priorReview:review,task:'Select the exact tested campaign. Positive mean payment improvement and nonnegative aggregate retailer delta are required to publish; otherwise keep fixed. Account for contact costs, refunds and7-market variation. You may select numerical. State what measurements support the choice and its limits.'},{selected:enumSchema(Object.keys(candidates)),programHash:textSchema,measurementHash:textSchema,rationale:textSchema});
   const publication=selectMeasuredCampaign(selected,candidates),chosen=candidates[publication.selected];
   state.arms[arm]={candidates,review,selection:selected,publication,program:chosen.program,programHash:chosen.programHash};await save('progress.json',state);
  }
  await verify();const armCost=arm=>state.calls.filter(c=>c.arm===arm).flatMap(c=>c.provider||[]).reduce((s,e)=>s+(e.modelCostMicros??e.reservedMicros??0),0)/1e6;
  const spend={single:armCost('single'),team:armCost('team')};await save('frozen-decisions.json',{at:new Date().toISOString(),modelHash,arms:state.arms,spend,confirmation,confirmationOpened:false});
  state.confirmationOpened=true;state.status='CONFIRMATION';await save('progress.json',state);
  const confirmationRows={};for(const [arm,program]of Object.entries({strong_fixed:null,shared_numerical_models:NUMERICAL_CAMPAIGN,single_planner:state.arms.single.program,specialist_team:state.arms.team.program}))confirmationRows[arm]=await simulate(program,confirmation,arm,'confirmation');
  for(let i=0;i<confirmation.length;i++)for(const rows of Object.values(confirmationRows))for(const key of ['initialHash','opportunityHash','consentHash','incomeCents'])if(rows[i][key]!==confirmationRows.strong_fixed[i][key])throw Error('UNMATCHED_CONFIRMATION_'+key);
  await verify();const summary=Object.fromEntries(Object.entries(confirmationRows).map(([arm,rows])=>[arm,{...summarizeExperiment(rows,confirmationRows.strong_fixed),scope:'Seven unseen seeds with policies frozen before opening.',designCostUSD:arm==='single_planner'?spend.single:arm==='specialist_team'?spend.team:0}]));
  for(const s of Object.values(summary))s.netAfterDesignCostUSD=s.platformUSD-s.designCostUSD/confirmation.length;
  const comparisons={};for(const ref of ['strong_fixed','shared_numerical_models','single_planner']){const delta=confirmationRows.specialist_team.map((r,i)=>r.platformUSD-confirmationRows[ref][i].platformUSD),avg=delta.reduce((a,b)=>a+b,0)/delta.length;comparisons[ref]={platformDeltaUSD:avg,afterActualDesignCostDeltaUSD:summary.specialist_team.netAfterDesignCostUSD-summary[ref].netAfterDesignCostUSD,retailerDeltaUSD:summary.specialist_team.retailerUSD-summary[ref].retailerUSD,retainedDelta:summary.specialist_team.retainedPurchases-summary[ref].retainedPurchases,wins:delta.filter(x=>x>.005).length,ties:delta.filter(x=>Math.abs(x)<=.005).length,losses:delta.filter(x=>x<-.005).length,pairedDeltasUSD:delta};}
  const result={status:'COMPLETED',id,summary,comparisons,spend,totalModelCostUSD:spend.single+spend.team,freshModelCalls:state.calls.length,nativePaymentCalls:0,economyUnchanged:true,
   ...decisionAttribution(comparisons,state.arms,compileCampaign(NUMERICAL_CAMPAIGN).hash),
   scope:protocol.interpretation};
  state.status='COMPLETED';await save('confirmation-rows.json',confirmationRows);await save('results.json',result);await save('progress.json',state);console.log(json(result));return result;
 }catch(e){state.status='FAILED';state.error=e.message;await save('progress.json',state);throw e;}
 finally{allocator.close();await provider?.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){if(!process.argv.includes('--run-authorized'))throw Error('EXPLICIT_RUN_FLAG_REQUIRED');await runDecisionStudy(process.argv[2]);}
