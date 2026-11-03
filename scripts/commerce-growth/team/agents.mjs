import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {openTeamVertex} from '../../agent-mesh/model-client.mjs';
import {OPTIONS,DEFAULT,validateConfig,fitForecast,outreachPlan} from './control.mjs';
import {buildCandidates} from '../../commerce-deadlines/policies.mjs';
import {digest} from '../environment.mjs';

const OUTREACH=['outreach','maxAge','contactsPerDay','arrivalDays','coldContacts'];
const SUPPLY=['forecast','coverDays','allocation','target','routing'];
const PREFIX='market-GROWTH-TEAM-1-';
export async function experimentSpend(){
 const ledger=JSON.parse(await readFile('.local/gcp/model-spend.json','utf8')),entries=ledger.entries.filter(e=>e.runId.startsWith(PREFIX));
 return {calls:entries.length,chargedMicros:entries.reduce((s,e)=>s+e.chargedMicros,0),unsettled:entries.filter(e=>e.status!=='settled').length,lifetimeMicros:ledger.entries.reduce((s,e)=>s+e.chargedMicros,0)};
}
export function publicEvidence(view,prior){
 const byCategory={};for(const p of view.products){const row=byCategory[p.category]??={available:0,products:0};row.available+=p.available;row.products++;}
 const mature=view.pastOrders.filter(o=>o.day+14<view.day),recent=mature.filter(o=>o.day>=view.day-40),contacts=view.outreach.history.filter(c=>c.day+26<view.day);
 const rates={};for(const c of contacts){const parts=c.observedBucket.split('|'),key=c.kind+'|'+parts[2],o=mature.find(o=>o.requestId===c.requestId),r=rates[key]??={contacts:0,retained:0};r.contacts++;r.retained+=Number(!!o&&!['SETTLED','PENDING_FUNDS'].includes(o.refundStatus));}
 const forecast=fitForecast(view,'adaptive'),preview=outreachPlan(view,DEFAULT,prior);
 return {day:view.day,marketDays:view.marketDays,snapshotHash:digest(view),openFundedRequests:view.requests.filter(r=>r.status==='AUTHORIZED').length,
  feasibleCurrentBaskets:buildCandidates(view).length,stock:byCategory,merchantCash:view.merchants.map(m=>({id:m.id,spendableCents:m.cashCents})),
  demandModel:{chosenByPastOnlyValidation:forecast.selected,validationLoss:forecast.scores,highestRates:Object.entries(forecast.rates).sort((a,b)=>b[1]-a[1]).slice(0,5)},
  marketing:{budgetRemainingCents:view.outreach.remainingBudgetCents,contacts:view.outreach.history.length,matureResponseGroups:rates,developmentCalibration:prior.groups,topObservedChoices:preview.ranking.slice(0,5)},
  maturedOutcome:{orders:recent.length,retained:recent.filter(o=>!['SETTLED','PENDING_FUNDS'].includes(o.refundStatus)).length,retailNetCents:recent.reduce((s,o)=>s+(o.refundStatus==='SETTLED'?0:o.feeCents)-o.processingCents,0)},
  limits:'Current observed data only. Demand validation is retrospective; future needs, response draws, wallets, seed and regime are unavailable. Predicted scores are not causal lift or future profit.'};
}
function declaration(name,fields){
 const properties=Object.fromEntries(fields.map(k=>[k,{type:typeof OPTIONS[k][0]==='number'?'INTEGER':'STRING',...(typeof OPTIONS[k][0]==='string'?{enum:OPTIONS[k]}:{}),description:'Choose one of '+OPTIONS[k].join(', ')}]));
 return {name,description:'Publish a bounded commerce decision. Trusted code validates and executes it; no SQL, code, funds creation or external payment access.',parameters:{type:'OBJECT',required:['configuration','rationale'],properties:{configuration:{type:'OBJECT',required:fields,properties},rationale:{type:'STRING',description:'Brief decision justification tied to the observed evidence, at most45 words. Do not claim measured future gains.'}}}};
}

export async function openAgentTeam({id,dir,prior,incumbent,developmentSummary,mode='multi',providerFactory=openTeamVertex,spendStatus=experimentSpend}){
 if(!['single','multi'].includes(mode))throw Error('INVALID_AGENT_MODE');
 await mkdir(dir);let current=validateConfig(incumbent),provider=null,failed=false;const checkpoints=[];
 const save=()=>writeFile(dir+'/checkpoints.json',JSON.stringify({current,checkpoints},null,2)+'\n');
 const call=async(role,fields,view,upstream)=>{
  const before=await spendStatus();if(before.unsettled||before.calls>=60||before.chargedMicros+30000>250000)throw Error('EXPERIMENT_MODEL_CAP_OR_UNCERTAIN_CALL');
  provider??=await providerFactory('GROWTH-TEAM-1-'+id,{route:'lite',capMicros:250000});
  const fn=declaration('publish_'+role,fields),evidence=publicEvidence(view,prior);
  const packet={role,evidence,currentContract:current,upstream,developmentSummary,
   contractSemantics:{outreach:'legacy_stock reproduces the old fixed workflow; fresh_signal ranks specific recent interest; calibrated uses pooled settled-response estimates plus mature local updates; none stops contacts.',
    maxAge:'Maximum observed signal age; no latent intent is exposed.',arrivalDays:'Expected inbound stock window accepted by targeting.',coldContacts:'At most this many general inquiries without recent specific interest per day.',
    forecast:'Past-only temporal validation compares Poisson forecasts. adaptive selects the lowest observed error.',coverDays:'Extra forecast inventory cover; orders still need actual cash and the frozen procurement limits.',allocation:'joint uses the shared local mixed-integer basket allocator; scarcity is the original greedy rule.',target:'Preferred or cheaper customer-approved product alternatives for replenishment.',routing:'fast uses modeled PayPal settlement; auto uses cheaper bank settlement when observed deadlines permit it.'}};
  const checkpoint={role,day:view.day,status:'CALL_STARTED',input:packet,startedAt:new Date().toISOString()};checkpoints.push(checkpoint);await save();
  const system=`You are the ${role} application agent in Market Metro. Decide your assigned commerce controls using the supplied observed data and measured development evidence. The frozen synthetic economy cannot be edited. The target is settled modeled platform contribution with protected merchant contribution, not contact count. A demand model is an estimate;2x is unproven. No hidden needs, response truth, seed or test outcomes are available. Outreach requires consent and existing funds. Cold inquiries lack a specific observed purchase intent. A sparse estimate must not be treated as reliable merely because an old purchase was expensive. Explain a concrete tradeoff, and keep an existing control when the evidence does not justify a change. Return only your assigned fields through the tool. Rationale at most45 words. The coordinator may revise earlier proposals after seeing their tool checks and actual mature outcomes.`;
  try{
   const answer=await provider.client.json(system,packet,{caseId:id,trialId:'growth-team-unseen-1',functions:[fn]});
   if(answer.name!==fn.name||!answer.args||typeof answer.args.rationale!=='string'||answer.args.rationale.length>900||Object.keys(answer.args.configuration||{}).sort().join()!==[...fields].sort().join())throw Error('INVALID_AGENT_DECISION');
   const candidate=validateConfig({...current,...answer.args.configuration});
   checkpoint.output=answer.args;checkpoint.provider=provider.client.events.at(-1);checkpoint.changedFields=fields.filter(k=>candidate[k]!==current[k]);
   checkpoint.toolChecks={type:'Trusted current-evidence checks, not future simulation outcomes',candidateOutreach:outreachPlan(view,candidate,prior).actions.length,forecast:fitForecast(view,candidate.forecast).selected,maximumDailyContacts:candidate.contactsPerDay,ledgerAuthority:'No direct money or SQL operations'};
   checkpoint.status='VALIDATED';checkpoint.finishedAt=new Date().toISOString();current=candidate;await save();return checkpoint;
  }catch(error){checkpoint.status='FAILED';checkpoint.error=error.message;checkpoint.provider=provider.client.events.at(-1)||null;await save();throw error;}
 };
 return {async plan(view){
  if(!failed&&(view.day===30||view.day===60)){
   try{
    if(view.day===30){const a=await call(mode==='multi'?'outreach_scientist':'planner',mode==='multi'?OUTREACH:Object.keys(OPTIONS),view,[]),b=await call(mode==='multi'?'fulfillment_engineer':'planner',mode==='multi'?SUPPLY:Object.keys(OPTIONS),view,[{role:a.role,output:a.output,checks:a.toolChecks}]);await call(mode==='multi'?'coordinator':'planner',Object.keys(OPTIONS),view,[a,b].map(c=>({role:c.role,output:c.output,checks:c.toolChecks})));}
    else await call(mode==='multi'?'coordinator':'planner',Object.keys(OPTIONS),view,checkpoints.filter(c=>c.status==='VALIDATED').map(c=>({role:c.role,day:c.day,output:c.output,checks:c.toolChecks})));
   }catch(error){failed=true;current=validateConfig(incumbent);checkpoints.push({role:'trusted_fallback',day:view.day,status:'FALLBACK',error:error.message,configuration:current});await save();}
  }
  return {...outreachPlan(view,current,prior),configuration:{...current},agentCheckpoint:checkpoints.at(-1)?{role:checkpoints.at(-1).role,day:checkpoints.at(-1).day,status:checkpoints.at(-1).status}:null};
 },async close(){await provider?.close();await save();},summary(){return {checkpoints,failed,calls:provider?.client.events.length||0,costUSD:(provider?.client.events||[]).reduce((s,e)=>s+(e.modelCostMicros??e.reservedMicros),0)/1e6,latencyMs:(provider?.client.events||[]).reduce((s,e)=>s+(e.latencyMs||0),0),decisionChanges:checkpoints.filter(c=>c.status==='VALIDATED').reduce((s,c)=>s+c.changedFields.length,0)};}};
}
