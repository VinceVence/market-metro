import {DatabaseSync} from 'node:sqlite';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {openTeamVertex} from './model-client.mjs';
import {campaignPreflight,publicationCheck,HARNESS_LIMITS} from './harness.mjs';
import {compactFacts,GROUNDING_HASH} from './grounding.mjs';
import {validatePolicyDecision,rulesPlan} from '../policy-lab/service.mjs';
import {trainBandit} from '../policy-lab/learner.mjs';
import {ACTIONS} from '../policy-lab/economy.mjs';
import {createFreshWorld} from '../policy-lab/fresh-world.mjs';
import {assertFrozen} from '../campaign-controller/benchmark.mjs';

const ROOT=resolve(import.meta.dirname,'../..'),BASE=resolve(ROOT,'docs/agent-mesh/model-comparison');
export const SOURCE_RUN='GARDEN-LAB-34d3bea264e0c053';
const sha=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const save=async(name,x)=>{await mkdir(BASE,{recursive:true});await writeFile(resolve(BASE,name),JSON.stringify(x,null,2)+'\n');};
const read=async name=>JSON.parse(await readFile(resolve(BASE,name),'utf8'));
const observe=day=>({strategy:'observe',audience:'all',merchantIndices:[],maxOfferPct:0,windowDays:42,epsilon:0,retrain:false,asOfDay:day});

export function approvedPlan(proposal,review){
  return review.decision==='reject'?observe(proposal.asOfDay):review.decision==='narrow'?{...proposal,merchantIndices:review.merchantIndices,maxOfferPct:review.maxOfferPct,epsilon:review.epsilon}:proposal;
}
export function ruleWithHarness(packet,facts){
  let plan={...rulesPlan(packet),asOfDay:packet.asOfDay};
  if(campaignPreflight(plan,facts).issues.length)plan={...plan,strategy:'recommendations',maxOfferPct:0,epsilon:0};
  return plan;
}

export function loadComparisonEvidence(db){
  const state=JSON.parse(db.prepare('SELECT state_json FROM run_state WHERE run_id=?').get(SOURCE_RUN).state_json);
  const checkpoints=db.prepare('SELECT * FROM policy_lab_checkpoints WHERE run_id=? ORDER BY rowid').all(SOURCE_RUN).map(c=>({...c,input:JSON.parse(c.input_json),output:JSON.parse(c.output_json||'null')}));
  const cases=[30,55,80].map(day=>{
    const science=checkpoints.find(c=>c.role==='Experiment scientist'&&c.input?.packet?.asOfDay===day&&!c.checkpoint_id.includes('CORRECTION'));
    const review=checkpoints.find(c=>c.role==='Outcome reviewer'&&c.input?.packet?.asOfDay===day&&!c.checkpoint_id.includes('CORRECTION'));
    const facts=checkpoints.find(c=>c.checkpoint_id===science.input.packet.checkedFacts.evidenceId).output;
    const modelId=facts.modelCheck?.modelId;
    const priorModel=modelId?JSON.parse(db.prepare('SELECT artifact_json FROM policy_lab_models WHERE model_id=?').get(modelId).artifact_json):null;
    const rows=db.prepare('SELECT day,matures_day,selected_action,context_json,reward_cents FROM policy_lab_actions WHERE run_id=? AND day<? AND matures_day<=? ORDER BY day,customer_id').all(SOURCE_RUN,day,day);
    if(rows.some(r=>r.day>=day||r.matures_day>day)||priorModel?.cutoffDay>day)throw Error('FUTURE_EVIDENCE');
    const packet=structuredClone(science.input.packet);delete packet.correction;delete packet.harnessFeedback;
    return {day,scienceSystem:science.input.system,scienceFunctions:science.input.functions,packet,facts,priorModel,rows,
      reviewSystem:review.input.system,reviewFunctions:review.input.functions,financial:review.input.packet.financial,inputHash:sha({system:science.input.system,packet,functions:science.input.functions})};
  });
  const catalog=state.products.slice(0,3).map(p=>({title:p.title,priceCents:p.price_cents,currency:'USD',channel3Id:p.channel3_product_id,brand:p.brand,category:p.category,source:p.source,sourceUrl:p.source_url,imageUrl:p.image_url}));
  return {sourceRun:SOURCE_RUN,seed:state.seed,scenario:state.scenario,startedAt:state.startedAt,catalog,cases};
}

function fit(caseData,plan){return plan.retrain?trainBandit(caseData.rows,{cutoffDay:caseData.day,windowDays:plan.windowDays,actions:ACTIONS}):caseData.priorModel;}

export async function decideCase(c,client,{method,onCheckpoint=async()=>{}}){
  const trace=[];let n=0;
  async function call(role,system,packet,functions,check){
    for(let attempt=0;attempt<2;attempt++){
      const request={system,packet:structuredClone(packet),functions:structuredClone(functions)},item={role,attempt,inputHash:sha(request),request,status:'REQUESTING'};
      trace.push(item);await onCheckpoint(trace);
      const before=client.events.length;
      try{
        const raw=await client.json(system,packet,{caseId:method+'-D'+c.day+'-'+(++n),trialId:method,stage:'planner',functions});
        item.response=raw;
        if(raw.name!==functions[0].name)throw Error('INVALID_MODEL_TOOL');
        const decision=validatePolicyDecision(role,raw.args,packet),gate=check(decision);item.gate=gate;
        if(!decision.evidenceIds.includes(packet.checkedFacts.evidenceId))throw Error('VERIFIED_FACTS_CITATION_REQUIRED');
        if(gate.issues.length)throw Object.assign(Error(gate.issues.map(x=>x.message).join(' ')),{repairable:true});
        item.status='COMPLETED';return decision;
      }catch(e){
        item.status='REJECTED';item.error=e.code||e.message;
        const repairable=e.repairable||e.code?.startsWith('INVALID_')||e.message==='VERIFIED_FACTS_CITATION_REQUIRED';
        if(!repairable||attempt===1)throw e;
        packet={...packet,harnessFeedback:{previousProposal:item.response?.args,gate:item.gate,remainingRevisions:0},correction:{error:item.error,contract:'Revise once using the same evidence and constraints. Observe/reject are valid. Do not invent new facts.'}};
      }finally{
        item.provider=client.events.length>before?client.events.at(-1):null;await onCheckpoint(trace);
      }
    }
  }
  let proposal,review,model,plan;
  try{
    proposal=await call('Experiment scientist',c.scienceSystem,structuredClone(c.packet),c.scienceFunctions,d=>campaignPreflight(d,c.facts));
    model=fit(c,proposal);if(proposal.strategy!=='observe'&&!model)throw Error('POLICY_MODEL_REQUIRED');
    const factId=`COMPARE-D${c.day}-${method}-FACTS`,modelId=`COMPARE-D${c.day}-${method}-MODEL`;
    const facts={...structuredClone(c.facts),modelCheck:model?{modelId,trainingCutoff:model.cutoffDay,mse:model.mse,constantMse:model.baselineMse,beatConstant:model.mse<model.baselineMse}:null};
    const {growth,investigation,checkedFacts,evidenceIds,...base}=c.packet;
    const {rationale,evidenceIds:unused,...settings}=proposal;
    const packet={...base,proposal:settings,model:model?{modelId,cutoff:model.cutoffDay,trainingRows:model.trainingRows,validationRows:model.validationRows,mse:model.mse,baselineMse:model.baselineMse}:null,financial:c.financial,
      checkedFacts:{evidenceId:factId,...compactFacts(facts)},publicationEvidence:{checkedAtDay:c.day+1,analysisCutoff:c.day,ageDays:1,newAnnouncements:[],scope:'Controlled one-day publication delay; no later observations or outcomes supplied.'},evidenceIds:[...c.packet.evidenceIds,factId,modelId]};
    const functions=structuredClone(c.reviewFunctions);functions[0].parameters.properties.evidenceIds.items.enum=packet.evidenceIds;
    review=await call('Outcome reviewer',c.reviewSystem,packet,functions,d=>publicationCheck(approvedPlan(proposal,d),facts,{currentDay:c.day+1,announcements:facts.announcements}));
    plan=approvedPlan(proposal,review);
    return {day:c.day,method,status:'COMPLETED',proposal,review,plan,model,trace};
  }catch(e){return {day:c.day,method,status:'FAILED_CLOSED',error:e.code||e.message,proposal,review,plan:observe(c.day),model:null,trace};}
}

export function evaluateDecisions(evidence,decisions,{method,costMicros=0}){
  const run=createFreshWorld({id:'MODEL-COMPARE-'+method,seed:evidence.seed,scenario:evidence.scenario,catalog:evidence.catalog,startedAt:evidence.startedAt,settings:{customerCount:100,days:100,budgetCents:30000}});
  let restoreAt=null;
  while(run.world.tick<114){
    const day=run.world.tick;
    if(restoreAt!==null&&day>=restoreAt){run.world.goal.budgetCents=30000;restoreAt=null;}
    const row=decisions.find(x=>x.day+1===day);
    if(row){
      const p=row.plan;
      if(p.strategy!=='observe'&&!row.model)throw Error('ACTIVE_POLICY_WITHOUT_MODEL');
      run.publish({...p,id:method+'-'+row.day,duration:HARNESS_LIMITS.pilotDays,penalty:0},row.model,row.day);
      run.world.goal.budgetCents=Math.min(30000,run.world.live.spendCents+run.world.live.discountCents+HARNESS_LIMITS.jointPilotBudgetCents);restoreAt=day+HARNESS_LIMITS.pilotDays;
    }
    run.step();
  }
  const score=run.result(method);return {...score,costMicros,platformAfterInferenceUSD:score.platformProxyCents/100-costMicros/1e6};
}

async function main(){
  await assertFrozen(JSON.parse(await readFile(resolve(ROOT,'docs/policy-lab/benchmarks/v5/protocol.json'))));
  const db=new DatabaseSync(resolve(ROOT,'.local/market-metro.sqlite'),{readOnly:true});const evidence=loadComparisonEvidence(db);db.close();
  const files=['model-client.mjs','model-comparison.mjs','grounding.mjs','facts.mjs','harness.mjs'];
  const code=Object.fromEntries(await Promise.all(files.map(async f=>[f,sha(await readFile(resolve(import.meta.dirname,f),'utf8'))])));
  const protocol={version:1,scope:'PAIRED_MODEL_DEVELOPMENT_PILOT',sourceRun:SOURCE_RUN,evidenceHash:sha(evidence),code,groundingHash:GROUNDING_HASH,
    methods:['lite','hybrid','rules_harness','recommend_all','recommend_lapsed','organic'],days:[30,55,80],seed:evidence.seed,scenario:evidence.scenario,
    limits:{perModelArmUSD:.25,totalNewSpendUSD:.50,maxCases:3,maxAttemptsPerRole:2,maxProviderCallsPerArm:18},
    fairness:'Fresh campaign and review decisions on identical recorded own-world evidence and shared investigator handoff. Same typed tools, numerical screen, source training rows and one-day publication delay. Both use MEDIUM reasoning; provider output limits differ (Lite2048, Pro4096). Per-review model fitting follows each proposal; a reviewer sees its own proposal, not the competing output. Results sealed until both arms complete.',
    scopeLimits:['Known development seed, no significance/generalization claim.','Shared replay evidence is fixed, not a new live closed-loop market.','Fresh costs exclude the already-incurred common investigator; historical investigator cost is reported separately.','All campaign returns mature through day114. PayPal financial values are modeled; no new payments.']};
  protocol.hash=sha(protocol);
  try{const saved=await read('protocol.json');if(saved.hash!==protocol.hash)throw Error('COMPARISON_PROTOCOL_CHANGED');}catch(e){if(e.code!=='ENOENT')throw e;await save('protocol.json',protocol);await save('evidence.json',evidence);}
  if(!process.argv.includes('--run')){console.log(JSON.stringify({ready:true,protocolHash:protocol.hash,paidCalls:0}));return;}
  const outcomes={};
  for(const method of ['lite','hybrid']){
    let resource;const decisions=[];
    try{
      for(const c of evidence.cases){
        const file=method+'-'+c.day+'.json';let result;
        try{result=await read(file);if(result.protocolHash!==protocol.hash)throw Error('CASE_PROTOCOL_CHANGED');}catch(e){
          if(e.code!=='ENOENT')throw e;
          try{await read(method+'-'+c.day+'-pending.json');throw Error('INCOMPLETE_MODEL_CASE_REQUIRES_INSPECTION');}catch(p){if(p.code!=='ENOENT')throw p;}
          resource??=await openTeamVertex('MODEL-COMPARE-V1-'+method,{route:method});
          result=await decideCase(c,resource.client,{method,onCheckpoint:trace=>save(method+'-'+c.day+'-pending.json',{protocolHash:protocol.hash,trace})});result.protocolHash=protocol.hash;
          await save(file,result);
          console.log(JSON.stringify({method,day:c.day,status:result.status,strategy:result.plan.strategy,merchantIndices:result.plan.merchantIndices,maxOfferPct:result.plan.maxOfferPct,calls:result.trace.length,costMicros:result.trace.reduce((n,t)=>n+(t.provider?.modelCostMicros??t.provider?.reservedMicros??0),0)}));
        }
        decisions.push(result);
        if(result.status==='FAILED_CLOSED')break;
      }
    }finally{await resource?.close();}
    const costMicros=decisions.flatMap(d=>d.trace).reduce((n,t)=>n+(t.provider?.modelCostMicros??t.provider?.reservedMicros??0),0);
    outcomes[method]={decisions,score:evaluateDecisions(evidence,decisions,{method,costMicros})};
  }
  for(const method of ['rules_harness','recommend_all','recommend_lapsed','organic']){
    const decisions=evidence.cases.map(c=>{const plan=method==='organic'?observe(c.day):method==='rules_harness'?ruleWithHarness(c.packet,c.facts):{...observe(c.day),strategy:'recommendations',audience:method==='recommend_lapsed'?'lapsed':'all',merchantIndices:[0,1,2],retrain:true};return {day:c.day,plan,model:plan.strategy==='observe'?null:fit(c,plan)};});
    outcomes[method]={score:evaluateDecisions(evidence,decisions,{method}),decisions};
  }
  const organic=outcomes.organic.score;for(const r of Object.values(outcomes)){r.score.deltaUSD=r.score.platformAfterInferenceUSD-organic.platformAfterInferenceUSD;r.score.merchantDeltaUSD=(r.score.merchantContributionCents-organic.merchantContributionCents)/100;}
  const result={protocolHash:protocol.hash,completedAt:new Date().toISOString(),scope:protocol.scope,sourceRun:SOURCE_RUN,outcomes,paidCalls:Object.values(outcomes).flatMap(x=>x.decisions.flatMap(d=>d.trace||[])).length,newCostUSD:(outcomes.lite.score.costMicros+outcomes.hybrid.score.costMicros)/1e6,claim:'One development model comparison. Report losses and abstention; do not claim real PayPal profit or multi-seed superiority.'};
  await save('result.json',result);console.log(JSON.stringify(Object.fromEntries(Object.entries(outcomes).map(([k,v])=>[k,{deltaUSD:v.score.deltaUSD,merchantDeltaUSD:v.score.merchantDeltaUSD,purchases:v.score.purchases,costMicros:v.score.costMicros}]))));
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
