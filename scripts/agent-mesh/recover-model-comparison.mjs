// One operator-authorized transport recovery after a definitive, zero-cost429.
// Original request/result files stay intact. No retry of uncertain outcomes.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {openTeamVertex} from './model-client.mjs';
import {decideCase,evaluateDecisions} from './model-comparison.mjs';
const base=resolve(import.meta.dirname,'../../docs/agent-mesh/model-comparison');
const read=async f=>JSON.parse(await readFile(resolve(base,f),'utf8'));
const save=async(f,x)=>writeFile(resolve(base,f),JSON.stringify(x,null,2)+'\n');
const protocol=await read('protocol.json'),initial=await read('hybrid-30.json'),evidence=await read('evidence.json');
if(initial.trace.length!==1||initial.trace[0].provider?.httpStatus!==429||initial.trace[0].provider?.modelCostMicros!==0)throw Error('NOT_A_KNOWN_ZERO_COST_429');
for(const [file,digest]of Object.entries(protocol.code)){
 const bytes=await readFile(resolve(import.meta.dirname,file),'utf8');if(createHash('sha256').update(bytes).digest('hex')!==digest)throw Error('COMPARISON_SOURCE_CHANGED');
}
const marker=resolve(base,'transport-recovery.json');
await writeFile(marker,JSON.stringify({protocolHash:protocol.hash,reason:'One bounded retry after definitive zero-cost429; same inputs and code.',at:new Date().toISOString(),extraAttemptsAllowed:1},null,2),{flag:'wx'});
const resource=await openTeamVertex('MODEL-COMPARE-V1-hybrid',{route:'hybrid'}),decisions=[];
try{
 for(const c of evidence.cases){
  const result=await decideCase(c,resource.client,{method:'hybrid',onCheckpoint:trace=>save('hybrid-recovery-'+c.day+'-pending.json',{protocolHash:protocol.hash,trace})});
  result.protocolHash=protocol.hash;result.recoveryOf=c.day===30?'hybrid-30.json':null;
  await save('hybrid-recovery-'+c.day+'.json',result);decisions.push(result);
  console.log(JSON.stringify({day:c.day,status:result.status,error:result.error,strategy:result.plan.strategy,merchants:result.plan.merchantIndices,maxOfferPct:result.plan.maxOfferPct,calls:result.trace.length}));
  if(result.status==='FAILED_CLOSED')break;
 }
}finally{await resource.close();}
const original=await read('result.json'),costMicros=decisions.flatMap(d=>d.trace).reduce((n,t)=>n+(t.provider?.modelCostMicros??t.provider?.reservedMicros??0),0);
const valid=decisions.length===3&&decisions.every(d=>d.status==='COMPLETED');
original.outcomes.hybrid={decisions,valid,score:valid?evaluateDecisions(evidence,decisions,{method:'hybrid',costMicros}):null,error:valid?null:decisions.at(-1)?.error};
for(const r of Object.values(original.outcomes)){
 r.valid??=r.decisions.length===3&&r.decisions.every(d=>!d.status||d.status==='COMPLETED');
 if(r.score){r.score.deltaUSD=r.score.platformAfterInferenceUSD-original.outcomes.organic.score.platformAfterInferenceUSD;r.score.merchantDeltaUSD=(r.score.merchantContributionCents-original.outcomes.organic.score.merchantContributionCents)/100;}
}
original.status=valid?'COMPLETE':'PROVIDER_BLOCKED';original.transportRejections=1;
original.completedAt=new Date().toISOString();original.newCostUSD=(costMicros+original.outcomes.lite.score.costMicros)/1e6;
original.paidCalls=decisions.flatMap(d=>d.trace).filter(t=>t.provider?.status==='settled').length+original.outcomes.lite.decisions.flatMap(d=>d.trace).filter(t=>t.provider?.status==='settled').length;
await save('recovery-result.json',original);
console.log(JSON.stringify({status:original.status,newCostUSD:original.newCostUSD,scores:Object.fromEntries(Object.entries(original.outcomes).map(([m,r])=>[m,r.valid?{deltaUSD:r.score.deltaUSD,purchases:r.score.purchases,merchantDeltaUSD:r.score.merchantDeltaUSD}:null]))}));
