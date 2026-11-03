import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ROOT,BASE,POLICIES,sha,save} from './recovery-policy.mjs';
import {openTeamVertex} from './model-client.mjs';
const read=async f=>JSON.parse(await readFile(resolve(BASE,f),'utf8'));
const development=await read('development.json'),parent=await read('protocol.json');
const evidence={id:'RECOVERY-DEV-'+sha(development).slice(0,16),stage:'DEVELOPMENT_ONLY',independentSeeds:4,markets:20,shoppingDays:400,campaignStopsAt:100,policies:POLICIES,results:development.stats,
  observations:'Merchant quality is estimated from the latest40 matured observed orders, using a Beta(1,19) prior. At least20 matured orders and smoothed returns above10% trigger the quality route. Returned customers are identified only by observed prior refunds. No hidden customer traits or future refunds are exposed.',
  objective:'Sustained modeled platform contribution after returns, processing, outreach and model cost; preserve merchant contribution. No discounts, no changed economics, no native payments. Same$50 virtual budget and contact/stock/margin limits for every competitor.',
  caution:'Four development seed clusters are exploratory. The strategy with the highest mean can still fail independent confirmation. Final evaluation is not available.'};
const props={policyId:{type:'STRING',enum:POLICIES.map(p=>p.id)},rationale:{type:'STRING'},evidenceId:{type:'STRING',enum:[evidence.id]}};
const tools=name=>[{name,description:'Select a constrained recovery recommendation policy or organic.',parameters:{type:'OBJECT',properties:props,required:Object.keys(props)}}];
const system='You are a commerce campaign strategist. Identify whether the observed refund/merchant-quality conditions support a bounded recovery recommendation program. Use the supplied400-day development outcomes, not short-window volume. Select one allowed program and explain its business mechanism and uncertainty. The program can target shoppers with prior observed refunds and route away from merchants with elevated mature return rates. You are not resolving disputes or moving funds. Do not invent positive results or claim independent confirmation. Cite the exact evidenceId.';
const protocol={version:1,parentHash:parent.hash,evidenceHash:sha(evidence),trials:3,maxCalls:6,maxSpendUSD:.5,system,functions:tools('propose_policy'),selectionBeforeTest:true};protocol.hash=sha(protocol);
try{if((await read('agent-protocol.json')).hash!==protocol.hash)throw Error('RECOVERY_AGENT_PROTOCOL_CHANGED');}catch(e){if(e.code!=='ENOENT')throw e;await save('agent-protocol.json',protocol);}
const results=[];
const validate=(raw,name)=>{const x=raw?.args;if(raw?.name!==name||!POLICIES.some(p=>p.id===x?.policyId)||x.evidenceId!==evidence.id||typeof x.rationale!=='string'||x.rationale.length<10||x.rationale.length>1800)throw Error('INVALID_RECOVERY_DECISION');return x;};
for(let trial=1;trial<=3;trial++){
 const file=`agents/trial-${trial}.json`;try{const old=await read(file);if(old.protocolHash!==protocol.hash)throw Error('WRONG_TRIAL');results.push(old);continue;}catch(e){if(e.code!=='ENOENT')throw e;}
 try{await read(`agents/trial-${trial}-pending.json`);throw Error('PENDING_RECOVERY_TRIAL');}catch(e){if(e.code!=='ENOENT')throw e;}
 const ledger=JSON.parse(await readFile(resolve(ROOT,'.local/gcp/model-spend.json'),'utf8'));if(ledger.circuit||ledger.entries.filter(e=>e.runId.startsWith('market-RECOVERY9-')).reduce((n,e)=>n+e.chargedMicros,0)+150000>500000)throw Error('RECOVERY_MODEL_BUDGET');
 const requests=[{system,packet:evidence,functions:tools('propose_policy')}];await save(`agents/trial-${trial}-pending.json`,{protocolHash:protocol.hash,requests});
 const r=await openTeamVertex('RECOVERY9-'+trial,{route:'hybrid',proEndpoint:'custom_tools'});let outcome;
 try{
  const proposal=validate(await r.client.json(system,evidence,{caseId:`RECOVERY9-${trial}-PLAN`,trialId:'RECOVERY9-'+trial,functions:tools('propose_policy')}),'propose_policy');
  const reviewSystem='Independently review the proposed commerce recovery program using development outcomes through400 shopping days, with campaigns stopped at100. Choose the same allowed program, a safer allowed alternative, or organic. Do not see or rely on the proposer rationale. Consider durable modeled platform value, merchant value, sparse development seeds and false-positive quality signals. This is a bounded simulation approval, not actual PayPal profit, dispute resolution or authorization to move money. Cite the exact evidenceId.';
  const packet={evidence,proposal:POLICIES.find(p=>p.id===proposal.policyId)};requests.push({system:reviewSystem,packet,functions:tools('review_policy')});await save(`agents/trial-${trial}-pending.json`,{protocolHash:protocol.hash,requests});
  const review=validate(await r.client.json(reviewSystem,packet,{caseId:`RECOVERY9-${trial}-REVIEW`,trialId:'RECOVERY9-'+trial,functions:tools('review_policy')}),'review_policy');
  const policy=POLICIES.find(p=>p.id===review.policyId),stats=development.stats.find(s=>s.policy===policy.id);if(policy.id!=='organic'&&(stats.platform.mean<=0||stats.merchant.mean<0))throw Error('RECOVERY_DEVELOPMENT_GATE');
  outcome={protocolHash:protocol.hash,trial,status:'COMPLETED',proposal,review,policy,policyHash:sha(policy),evidenceId:evidence.id,requests,provider:r.client.events,costMicros:r.client.events.reduce((n,e)=>n+(e.modelCostMicros??e.reservedMicros??0),0)};
 }catch(e){outcome={protocolHash:protocol.hash,trial,status:'FAILED',error:e.message,requests,provider:r.client.events,costMicros:r.client.events.reduce((n,e)=>n+(e.modelCostMicros??e.reservedMicros??0),0)};}
 finally{await r.close();}
 await save(file,outcome);results.push(outcome);console.log(JSON.stringify({trial,status:outcome.status,policy:outcome.policy?.id,error:outcome.error,costUSD:outcome.costMicros/1e6}));if(outcome.status!=='COMPLETED')break;
}
await save('agent-choices.json',{protocolHash:protocol.hash,evidence,results,costUSD:results.reduce((n,r)=>n+r.costMicros,0)/1e6,scope:'Three fresh policy approval trials before confirmation outcomes; execution is deterministic and the same policy is available to numerical controls.'});
