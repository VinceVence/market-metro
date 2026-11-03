// A separately recorded provider endpoint, not another retry of a failed job.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {openTeamVertex} from './model-client.mjs';
import {decideCase,evaluateDecisions} from './model-comparison.mjs';
const base=resolve(import.meta.dirname,'../../docs/agent-mesh/model-comparison');
const read=async f=>JSON.parse(await readFile(resolve(base,f),'utf8'));
const save=async(f,x)=>writeFile(resolve(base,f),JSON.stringify(x,null,2)+'\n');
const original=await read('recovery-result.json'),p=await read('protocol.json'),evidence=await read('evidence.json');
if(original.status!=='PROVIDER_BLOCKED'||original.outcomes.hybrid.error!=='VERTEX_HTTP_429')throw Error('ALTERNATIVE_NOT_REQUIRED');
for(const [file,digest]of Object.entries(p.code).filter(([f])=>f!=='model-client.mjs'))if(createHash('sha256').update(await readFile(resolve(import.meta.dirname,file),'utf8')).digest('hex')!==digest)throw Error('EVIDENCE_OR_HARNESS_CHANGED');
await writeFile(resolve(base,'alternative-protocol.json'),JSON.stringify({parentHash:p.hash,model:'gemini-3.1-pro-preview-customtools',reason:'Standard Pro returned two definitive uncharged429 responses.',sameEvidence:true,sameHarness:true,maxEndpointAttempts:1,price:'Same as Gemini3.1 Pro per official Google model documentation.',pricingSource:'https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-1-pro',capUSD:.25,sharesPreviousProLedger:true,at:new Date().toISOString(),clientHash:createHash('sha256').update(await readFile(resolve(import.meta.dirname,'model-client.mjs'),'utf8')).digest('hex')},null,2),{flag:'wx'});
const resource=await openTeamVertex('MODEL-COMPARE-V1-hybrid',{route:'hybrid',proEndpoint:'custom_tools'}),decisions=[];
try{
 for(const c of evidence.cases){
  const r=await decideCase(c,resource.client,{method:'hybrid',onCheckpoint:trace=>save('custom-tools-'+c.day+'-pending.json',{parentProtocolHash:p.hash,trace})});
  await save('custom-tools-'+c.day+'.json',r);decisions.push(r);
  console.log(JSON.stringify({day:c.day,status:r.status,error:r.error,strategy:r.plan.strategy,merchants:r.plan.merchantIndices,maxOfferPct:r.plan.maxOfferPct,calls:r.trace.length}));
  if(r.status==='FAILED_CLOSED')break;
 }
}finally{await resource.close();}
const costMicros=decisions.flatMap(d=>d.trace).reduce((n,t)=>n+(t.provider?.modelCostMicros??t.provider?.reservedMicros??0),0),valid=decisions.length===3&&decisions.every(d=>d.status==='COMPLETED');
const score=valid?evaluateDecisions(evidence,decisions,{method:'hybrid',costMicros}):null;
if(score){score.deltaUSD=score.platformAfterInferenceUSD-original.outcomes.organic.score.platformAfterInferenceUSD;score.merchantDeltaUSD=(score.merchantContributionCents-original.outcomes.organic.score.merchantContributionCents)/100;}
original.outcomes.hybrid={model:'gemini-3.1-pro-preview-customtools',valid,decisions,score,error:valid?null:decisions.at(-1)?.error};
original.status=valid?'COMPLETE':'PROVIDER_BLOCKED';original.completedAt=new Date().toISOString();original.transportRejections=2;
original.newCostUSD=(costMicros+original.outcomes.lite.score.costMicros)/1e6;
original.paidCalls=decisions.flatMap(d=>d.trace).filter(t=>t.provider?.status==='settled').length+original.outcomes.lite.decisions.flatMap(d=>d.trace).filter(t=>t.provider?.status==='settled').length;
await save('alternative-result.json',original);console.log(JSON.stringify({status:original.status,newCostUSD:original.newCostUSD,hybrid:score&&{deltaUSD:score.deltaUSD,merchantDeltaUSD:score.merchantDeltaUSD,purchases:score.purchases}}));
