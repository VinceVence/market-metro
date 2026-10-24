import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {verifyFrozenOriginal,BRANCHES} from './fresh-benchmark.mjs';
import {validateFreshDecision} from './fresh-agent.mjs';

const ROOT=resolve(import.meta.dirname,'../..'),BASE=resolve(ROOT,'docs/policy-lab/benchmarks/v2');
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const p=await read(resolve(BASE,'protocol.json')),r=await read(resolve(BASE,'result.json')),ledger=await read(resolve(ROOT,'.local/gcp/model-spend.json'));
await verifyFrozenOriginal();for(const [file,expected]of Object.entries(p.code))if(hash(await readFile(resolve(ROOT,file)))!==expected)throw Error('FROZEN_V2_CODE_CHANGED');
const issues=[],expected=p.evaluationSeeds.flatMap(seed=>p.scenarios.map(scenario=>seed+'/'+scenario)),actual=r.cases.map(c=>c.seed+'/'+c.scenario);
if(expected.length!==actual.length||new Set(actual).size!==actual.length||expected.some(k=>!actual.includes(k)))issues.push('Case coverage mismatch');
let calls=0,totalCost=0,numericChecks=0;
for(const c of r.cases){
  const dir=resolve(BASE,'cases',c.caseId),files=(await readdir(dir)).filter(f=>f.startsWith(c.caseId)&&f.endsWith('.json'));
  const records=await Promise.all(files.map(f=>read(resolve(dir,f))));
  if(c.branches.length!==BRANCHES.length||c.branches.some(b=>b.matureOutcomes!==7000||Object.values(b.checks).some(Boolean)))issues.push(c.caseId+': incomplete or invalid economic outcomes');
  const charges=ledger.entries.filter(e=>e.runId==='market-'+c.caseId),cost=charges.reduce((s,e)=>s+e.chargedMicros,0)/1e6;
  if(charges.some(e=>e.status!=='settled')||Math.abs(cost-c.modelCostUSD)>1e-9||charges.length!==c.modelCalls)issues.push(c.caseId+': cost mismatch');
  if(c.modelCostUSD>.25)issues.push(c.caseId+': case budget exceeded');
  const packetKeys=(value)=>value&&typeof value==='object'?Object.entries(value).flatMap(([k,v])=>[k,...packetKeys(v)]):[];
  for(const entry of records){
    const forbidden=['privateTraits','weeklyIncome','merchantAffinity','scenario','evaluationSeeds','branches'];
    if(packetKeys(entry.packet).some(k=>forbidden.includes(k)))issues.push(entry.id+': forbidden input key');
    if(entry.packet.asOfDay!==entry.cutoff)issues.push(entry.id+': evidence cutoff mismatch');
    if(entry.status==='COMPLETED'){
      try{validateFreshDecision(entry.role,entry.output,entry.packet);numericChecks++;}catch(e){issues.push(entry.id+': '+e.message);}
      if(!entry.provider?.responseId||!entry.provider?.modelVersion?.startsWith('gemini-3.1-flash-lite'))issues.push(entry.id+': missing native model provenance');
    }
  }
  const fresh=c.branches.find(b=>b.policy==='fresh_gemini'),organic=c.branches.find(b=>b.policy==='organic');
  if(Math.abs(fresh.deltaPlatformUSD-((fresh.platformProxyCents-organic.platformProxyCents)/100-cost))>1e-8)issues.push(c.caseId+': wrong primary score');
  calls+=charges.length;totalCost+=cost;
}
const suiteCost=ledger.entries.filter(e=>e.runId.startsWith('market-FRESH2-')).reduce((s,e)=>s+e.chargedMicros,0)/1e6;
if(suiteCost>1)issues.push('Suite budget exceeded');
const result={verifiedAt:new Date().toISOString(),passed:issues.length===0,issues,originalSimulatorAndRulesUnchanged:true,policyCodeUnchanged:true,cases:r.cases.length,modelCalls:calls,numericDecisionChecks:numericChecks,evaluationCostUSD:totalCost,suiteCostUSD:suiteCost,lifetimeRecordedUSD:ledger.entries.reduce((s,e)=>s+e.chargedMicros,0)/1e6,semanticAccuracy:'Not established by numeric/schema checks; public rationales require reading.',costBasis:'Provider tokens and preserved spend ledger, not a billing invoice.'};
await writeFile(resolve(BASE,'verification.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(issues.length)process.exitCode=1;
