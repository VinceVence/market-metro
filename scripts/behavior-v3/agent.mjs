import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ROOT,sha} from '../research-lab/data.mjs';
import {openTeamVertex} from '../agent-mesh/model-client.mjs';
import {lock,read,save} from './benchmark.mjs';
import {POLICIES,train,publicEvidence} from './policies.mjs';
import {createRunner} from './runner.mjs';
const {p,catalog}=await lock(),development=await read('development.json');
try{const old=await read('agent.json'),saved=await read('agent-protocol.json');if(old.status!=='COMPLETED'||old.protocolHash!==saved.hash||saved.simulationHash!==p.hash)throw Error('INSPECT_PREVIOUS_AGENT_RESULT');console.log(JSON.stringify({existing:true,status:old.status,policy:old.review.policyId}));process.exit(0);}catch(e){if(e.code!=='ENOENT')throw e;}
const r=createRunner({runId:'V3-PLANNING-EVIDENCE',seed:p.demo.seed,scenario:p.demo.scenario,catalog,policy:'none'});while(r.world.tick<30)r.step();train(r.world);
const evidence={id:'V3-DEV-'+sha({development,observations:publicEvidence(r.world)}).slice(0,16),stage:'DEVELOPMENT_ONLY',development:{seeds:3,markets:15,stats:development.stats},currentMarket:publicEvidence(r.world),policies:POLICIES,
 authority:'Choose one allowed tested program for days30–129,$50 virtual promotion budget,7-day contact gap. Stock/margins/budget enforced in code. Local recommender fits every14days; the retained legacy program deliberately uses price/familiarity/week phase instead of the fitted ranking. No direct SQL, hidden customer traits, future outcomes, model-parameter edits or payments.',
 limitations:'New authored, uncalibrated behavior model. These are synthetic development outcomes, not real PayPal profit. The independent test set is unopened. Never claim an LLM-specific numerical advantage over the identical selected program executed without an LLM.'};
const properties={policyId:{type:'STRING',enum:POLICIES.map(x=>x.id)},rationale:{type:'STRING'},evidenceId:{type:'STRING',enum:[evidence.id]}};
const functions=name=>[{name,description:'Choose one tested campaign program or no campaign; give a concise public justification.',parameters:{type:'OBJECT',properties,required:Object.keys(properties)}}];
const system='You are the Market Metro campaign scientist. Use observed simulation data, local model validation and development comparisons to choose a campaign. Optimize modeled PayPal retained fees minus returns, processing, outreach and subsidies while preserving merchant contribution. Consider both the100-day active period and100-day post-campaign follow-up. You may retain the earlier strong policy when the evidence supports it. Explain exactly what the data supports, what the fitted model does and does not control, and what you would monitor. Do not invent a new numerical advantage or claim validation on unseen markets. Return a tool call with the exact evidenceId.';
const contract={version:1,simulationHash:p.hash,evidenceHash:sha(evidence),modelRoute:'hybrid',calls:2,maxUSD:.25,system,functions:functions('propose_policy')};contract.hash=sha(contract);
try{const old=await read('agent.json');if(old.protocolHash!==contract.hash)throw Error('AGENT_EVIDENCE_CHANGED');console.log(JSON.stringify({existing:true,status:old.status,policy:old.review?.policyId}));process.exit(0);}catch(e){if(e.code!=='ENOENT')throw e;}
try{await read('agent-pending.json');throw Error('INSPECT_PENDING_BEFORE_RETRY');}catch(e){if(e.code!=='ENOENT')throw e;}
const ledger=JSON.parse(await readFile(resolve(ROOT,'.local/gcp/model-spend.json')));if(ledger.circuit||ledger.entries.some(e=>e.status==='pending'))throw Error('MODEL_LEDGER_NOT_IDLE');
await save('agent-protocol.json',contract);const requests=[{system,packet:evidence,functions:functions('propose_policy')}];await save('agent-pending.json',{protocolHash:contract.hash,requests});
const client=await openTeamVertex('BEHAVIOR-V3-APPROVAL-1',{route:'hybrid',proEndpoint:'custom_tools'}),validate=(x,name)=>{if(x?.name!==name||!POLICIES.some(p=>p.id===x.args?.policyId)||x.args?.evidenceId!==evidence.id||typeof x.args.rationale!=='string'||x.args.rationale.length<10||x.args.rationale.length>2200)throw Error('INVALID_V3_AGENT_DECISION');return x.args;};
let outcome;
try{
 const proposal=validate(await client.client.json(system,evidence,{caseId:'V3-PROPOSE',trialId:'V3-APPROVAL',functions:functions('propose_policy')}),'propose_policy');
 const reviewSystem='You are an independent campaign reviewer. Review the proposed program and the development evidence without the proposer rationale. Choose the same program, another allowed program, or none. Check merchant value, longer follow-up, cost, new-model assumptions and the limits of three development seeds. State the concrete justification and monitoring criteria. Do not claim fresh-test or real PayPal profitability. The same numerical program without an LLM will have the same commerce behavior at lower inference cost. Cite the exact evidenceId.';
 const packet={evidence,proposedPolicyId:proposal.policyId};requests.push({system:reviewSystem,packet,functions:functions('review_policy')});await save('agent-pending.json',{protocolHash:contract.hash,requests});
 const review=validate(await client.client.json(reviewSystem,packet,{caseId:'V3-REVIEW',trialId:'V3-APPROVAL',functions:functions('review_policy')}),'review_policy');
 const s=development.stats.find(s=>s.policy===review.policyId);if(review.policyId!=='none'&&(s.durable.mean<=.25||s.merchant.mean<0))throw Error('DEVELOPMENT_ECONOMICS_GATE');
 outcome={status:'COMPLETED',protocolHash:contract.hash,proposal,review,policy:POLICIES.find(p=>p.id===review.policyId),policyHash:sha({simulation:p.hash,policy:review.policyId}),evidence,requests,provider:client.client.events,costMicros:client.client.events.reduce((n,e)=>n+(e.modelCostMicros??e.reservedMicros??0),0),scope:'Two fresh Gemini roles. All subsequent numerical benchmark runs reuse this selected policy, not fresh conversations.'};
}catch(e){outcome={status:'FAILED',protocolHash:contract.hash,error:e.message,requests,provider:client.client.events,costMicros:client.client.events.reduce((n,e)=>n+(e.modelCostMicros??e.reservedMicros??0),0)};}
finally{await client.close();}
await save('agent.json',outcome);console.log(JSON.stringify({status:outcome.status,policy:outcome.review?.policyId,costUSD:outcome.costMicros/1e6,error:outcome.error}));
