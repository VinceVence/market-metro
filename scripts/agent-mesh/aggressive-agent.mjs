// Fresh agent choices see development evidence only. Evaluation remains sealed.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {openTeamVertex} from './model-client.mjs';
import {ROOT,BASE,POLICIES,save} from './aggressive-policy.mjs';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const read=async f=>JSON.parse(await readFile(resolve(BASE,f),'utf8'));
const source=await read('development.json'),protocol=await read('protocol.json');
if(source.protocolHash!==protocol.hash)throw Error('DEVELOPMENT_MISMATCH');
const evidence={id:'DEV-'+sha(source).slice(0,16),stage:'DEVELOPMENT_ONLY',markets:20,independentSeeds:4,policies:POLICIES,results:source.stats,
 publicDefinitions:{floor:'Catalog-price score filter.0.5 excludes the$31.99 products and allows the$89 item in this fixed catalog. This is a transparent rule, not estimated dollars.',loyal:'Prefer the retailer of the observed previous purchase when prices tie.',weekdays:'Public virtual week phases.0,1 means recurring first two days; null means daily. The simulation has a fixed weekly budget cycle, not a claim about real-world paydays.',risk:'Exclude a merchant only after20 matured observed orders and posterior return rate above10%, using a Beta(1,19) prior. Pending future returns and hidden traits cannot be read.'},
 authority:'Operate days30–99 under a$50 VIRTUAL budget with unchanged seven-day contact gap, stock checks, merchant margin floors and economics. No coupons, native payments or arbitrary code. All policies and controls share this envelope.',
 limits:'No final evaluation results are available. Development selection is not confirmation. The financial metric is modeled retained fees minus costs, not actual PayPal profit. Learned/transparent numerical policy design is distinct from the LLM choosing and governing it.'};
const system='You are a campaign strategist for Market Metro. Use the supplied development experiment evidence to choose a recurring commerce policy. Optimize modeled platform contribution while preserving merchant value. Be aggressive about scaling a supported intervention, not about indiscriminate spending. Compare targeted high-value timing, merchant familiarity and observed return problems with broad outreach. You cannot change the policy definitions, economics or authorization envelope. No test outcomes, future shopper events or hidden traits are available. Return one tool call, cite the exact evidence ID, and give a concise public justification. Do not claim a held-out or production win.';
const properties={policyId:{type:'STRING',enum:POLICIES.map(p=>p.id)},rationale:{type:'STRING'},evidenceId:{type:'STRING',enum:[evidence.id]}};
const tool=name=>[{name,description:'Select one allowed campaign policy, or organic to abstain.',parameters:{type:'OBJECT',properties,required:Object.keys(properties)}}];
const check=(response,name)=>{if(response?.name!==name||!POLICIES.some(p=>p.id===response.args?.policyId)||response.args?.evidenceId!==evidence.id||typeof response.args?.rationale!=='string'||response.args.rationale.length<10||response.args.rationale.length>1800)throw Error('INVALID_AGENT_POLICY');return response.args;};
const plan={parentProtocolHash:protocol.hash,evidenceHash:sha(evidence),trials:3,maxGeneratedCalls:6,maxTotalUSD:.5,perTrialCapUSD:.25,stage:'FRESH_AGENT_CHOICES_BEFORE_TEST_UNSEAL',system,functions:tool('propose_policy'),reviewFunctions:tool('review_policy')};plan.hash=sha(plan);
try{if((await read('agent-protocol.json')).hash!==plan.hash)throw Error('AGENT_PROTOCOL_CHANGED');}catch(e){if(e.code!=='ENOENT')throw e;await save('agent-protocol.json',plan);}
const results=[];
for(let trial=1;trial<=3;trial++){
 const file=`agents/trial-${trial}.json`;try{const r=await read(file);if(r.protocolHash!==plan.hash)throw Error('TRIAL_PROTOCOL_CHANGED');results.push(r);continue;}catch(e){if(e.code!=='ENOENT')throw e;}
 try{await read(`agents/trial-${trial}-pending.json`);throw Error('PENDING_TRIAL_REQUIRES_INSPECTION');}catch(e){if(e.code!=='ENOENT')throw e;}
 const journal={protocolHash:plan.hash,trial,stage:'REQUESTING',requests:[]};await save(`agents/trial-${trial}-pending.json`,journal);
 const ledger=JSON.parse(await readFile(resolve(ROOT,'.local/gcp/model-spend.json'),'utf8'));
 if(ledger.circuit||ledger.entries.filter(e=>e.runId.startsWith('market-AGGRESSIVE8-')).reduce((n,e)=>n+e.chargedMicros,0)+150000>500000)throw Error('STUDY_BUDGET_OR_CIRCUIT');
 const resource=await openTeamVertex('AGGRESSIVE8-'+trial,{route:'hybrid',proEndpoint:'custom_tools'});let outcome;
 try{
  journal.requests.push({role:'Campaign strategist',system,packet:evidence,functions:tool('propose_policy')});await save(`agents/trial-${trial}-pending.json`,journal);
  const proposal=check(await resource.client.json(system,evidence,{caseId:'AGGRESSIVE8-'+trial+'-PLAN',trialId:'AGGRESSIVE8-'+trial,functions:tool('propose_policy')}),'propose_policy');
  const reviewSystem='You are the independent economic reviewer. Inspect the tested policy definitions and development evidence, without the proposer rationale. Keep the proposed policy, choose a lower-risk allowed alternative, or organic. Favor a credible mean platform improvement and nonnegative merchant contribution, but acknowledge development uncertainty. No changes to policy authority, scoring, returns or real payments. Cite the exact evidence ID and give a concise public rationale.';
  const packet={evidence,proposal:POLICIES.find(p=>p.id===proposal.policyId)};journal.requests.push({role:'Independent reviewer',system:reviewSystem,packet,functions:tool('review_policy')});await save(`agents/trial-${trial}-pending.json`,journal);
  const review=check(await resource.client.json(reviewSystem,packet,{caseId:'AGGRESSIVE8-'+trial+'-REVIEW',trialId:'AGGRESSIVE8-'+trial,functions:tool('review_policy')}),'review_policy');
  const policy=POLICIES.find(p=>p.id===review.policyId),dev=source.stats.find(p=>p.policy===policy.id),eligible=policy.id==='organic'||dev.platform.mean>0&&dev.merchant.mean>=0;
  if(!eligible)throw Error('DEVELOPMENT_ECONOMIC_GATE');
  outcome={protocolHash:plan.hash,trial,status:'COMPLETED',proposal,review,policy,policyHash:sha(policy),developmentEvidenceId:evidence.id,policyEvidenceStage:'DEVELOPMENT_NOT_CONFIRMATION',costMicros:resource.client.events.reduce((s,e)=>s+(e.modelCostMicros??e.reservedMicros??0),0),provider:resource.client.events,journal};
 }catch(e){outcome={protocolHash:plan.hash,trial,status:'FAILED',error:e.message,costMicros:resource.client.events.reduce((s,e)=>s+(e.modelCostMicros??e.reservedMicros??0),0),provider:resource.client.events,journal};}
 finally{await resource.close();}
 await save(file,outcome);results.push(outcome);console.log(JSON.stringify({trial,status:outcome.status,policy:outcome.policy?.id,costUSD:outcome.costMicros/1e6,error:outcome.error}));if(outcome.status!=='COMPLETED')break;
}
await save('agent-choices.json',{protocolHash:plan.hash,evidence,results,newCostUSD:results.reduce((s,r)=>s+r.costMicros,0)/1e6,scope:'Three fresh strategist/reviewer decisions on identical development evidence. No held-out outcomes used; not80 independent agent runs.'});
