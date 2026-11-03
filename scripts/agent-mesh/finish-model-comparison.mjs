// Finish exactly the saved day80 review after reallocating unused trial budget.
// App campaigns retain their250000 cap. Total comparison remains below500000.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {openTeamVertex} from './model-client.mjs';
import {approvedPlan,evaluateDecisions} from './model-comparison.mjs';
import {validatePolicyDecision} from '../policy-lab/service.mjs';
import {publicationCheck} from './harness.mjs';
import {trainBandit} from '../policy-lab/learner.mjs';
import {ACTIONS} from '../policy-lab/economy.mjs';
const base=resolve(import.meta.dirname,'../../docs/agent-mesh/model-comparison');
const read=async f=>JSON.parse(await readFile(resolve(base,f),'utf8'));
const save=async(f,x)=>writeFile(resolve(base,f),JSON.stringify(x,null,2)+'\n');
const result=await read('alternative-result.json'),evidence=await read('evidence.json'),day80=await read('custom-tools-80.json'),last=day80.trace.at(-1);
if(day80.error!=='TEAM_MODEL_BUDGET_EXHAUSTED'||last.role!=='Outcome reviewer'||last.provider||!day80.proposal)throw Error('NO_UNSENT_FINAL_REVIEW');
if(result.outcomes.lite.score.costMicros+300000>500000)throw Error('TOTAL_TRIAL_CAP');
await writeFile(resolve(base,'final-review-resume.json'),JSON.stringify({at:new Date().toISOString(),reason:'Pro spent110102 micros; adding the150000 reservation totals260102, above250000. Reallocate unused Lite allowance; no task or evidence changes.',proCapMicros:300000,totalTrialCapMicros:500000,remainingRequests:1,savedInputHash:last.inputHash},null,2),{flag:'wx'});
const resource=await openTeamVertex('MODEL-COMPARE-V1-hybrid',{route:'hybrid',proEndpoint:'custom_tools',capMicros:300000});
const item={...last,status:'REQUESTING',error:undefined,resumed:true};
try{
 const {system,packet,functions}=item.request;
 const response=await resource.client.json(system,packet,{caseId:'hybrid-D80-final-review-resume',trialId:'hybrid',stage:'planner',functions});item.response=response;
 if(response.name!=='review_policy')throw Error('INVALID_MODEL_TOOL');
 const review=validatePolicyDecision('Outcome reviewer',response.args,packet);
 if(!review.evidenceIds.includes(packet.checkedFacts.evidenceId))throw Error('VERIFIED_FACTS_CITATION_REQUIRED');
 const plan=approvedPlan(day80.proposal,review),facts=evidence.cases.find(c=>c.day===80).facts;
 const gate=publicationCheck(plan,facts,{currentDay:81,announcements:facts.announcements});item.gate=gate;if(gate.issues.length)throw Error('PUBLISH_BLOCKED');
 const c=evidence.cases.find(c=>c.day===80),model=day80.proposal.retrain?trainBandit(c.rows,{cutoffDay:80,windowDays:day80.proposal.windowDays,actions:ACTIONS}):c.priorModel;
 Object.assign(day80,{status:'COMPLETED',review,plan,model,error:null});item.status='COMPLETED';
}catch(e){item.status='REJECTED';item.error=e.message;day80.error=e.message;}
finally{item.provider=resource.client.events.at(-1)||null;day80.trace.push(item);await resource.close();await save('custom-tools-80-completed.json',day80);}
const decisions=[await read('custom-tools-30.json'),await read('custom-tools-55.json'),day80],valid=decisions.every(d=>d.status==='COMPLETED');
const costMicros=decisions.flatMap(d=>d.trace).reduce((n,t)=>n+(t.provider?.modelCostMicros??t.provider?.reservedMicros??0),0);
const score=valid?evaluateDecisions(evidence,decisions,{method:'hybrid',costMicros}):null;
if(score){score.deltaUSD=score.platformAfterInferenceUSD-result.outcomes.organic.score.platformAfterInferenceUSD;score.merchantDeltaUSD=(score.merchantContributionCents-result.outcomes.organic.score.merchantContributionCents)/100;}
result.outcomes.hybrid={model:'gemini-3.1-pro-preview-customtools',valid,decisions,score,error:valid?null:day80.error};
result.status=valid?'COMPLETE':'INCOMPLETE';result.newCostUSD=(costMicros+result.outcomes.lite.score.costMicros)/1e6;result.completedAt=new Date().toISOString();
result.paidCalls=[...decisions,...result.outcomes.lite.decisions].flatMap(d=>d.trace).filter(t=>t.provider?.status==='settled').length;
result.budgetAmendment='Pro admission cap300000; Lite already completed8210; total remains below500000. Same prompts, six generated decisions per model, unchanged experiment controls.';
await save('final-result.json',result);console.log(JSON.stringify({status:result.status,costUSD:result.newCostUSD,paidCalls:result.paidCalls,hybrid:score&&{deltaUSD:score.deltaUSD,merchantDeltaUSD:score.merchantDeltaUSD}}));
