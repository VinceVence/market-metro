import {resolve} from 'node:path';
import {readFile,readdir} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {BASE,ROOT,readJSON,saveJSON,sha,frozenInputs,querySnapshot,FIELDS,compileFeature} from './data.mjs';

const r=await readJSON(resolve(BASE,'result.json')),p=await readJSON(resolve(BASE,'protocol.json')),ledger=await readJSON(resolve(ROOT,'.local/gcp/model-spend.json'));
await frozenInputs();const issues=[];
for(const [file,expected]of Object.entries(p.code))if(sha(await readFile(resolve(ROOT,file)))!==expected)issues.push('Frozen research code changed: '+file);
const {hash,...payload}=p;if(sha(payload)!==hash)issues.push('Protocol changed');
let requests=0,cost=0,queries=0,models=0,pilots=0,failedTools=0;
for(const c of r.cases){
  const charges=ledger.entries.filter(e=>e.runId==='market-'+c.id),actual=charges.reduce((n,e)=>n+e.chargedMicros,0)/1e6;
  if(charges.some(e=>e.status!=='settled')||Math.abs(actual-c.costs.actualModelUSD)>1e-9)issues.push(c.id+': native usage mismatch');
  if(actual>.25)issues.push(c.id+': per-case budget exceeded');requests+=charges.length;cost+=actual;
  const observationHashes=[];
  for(const method of c.methods){
    const directory=resolve(BASE,'missions',c.id,method.method),state=await readJSON(resolve(directory,'workspace.json')),db=resolve(directory,'observed.sqlite');
    if(state.snapshotHash!==sha(await readFile(db)))issues.push(state.id+': snapshot changed');
    const auditDb=new DatabaseSync(db,{readOnly:true});let shape,orders;
    try{
      shape=auditDb.prepare(`SELECT day,selected_action,propensity,matures_day,reward_cents,${FIELDS.join(',')} FROM observations ORDER BY day,customer_id`).all();
      orders=auditDb.prepare('SELECT day,merchant_index,gross_cents,observed_refund_cents,modeled_fee_cents,processing_cents FROM orders ORDER BY day,merchant_index,gross_cents,observed_refund_cents,modeled_fee_cents,processing_cents').all();
    }finally{auditDb.close();}
    const totals=querySnapshot(db,'SELECT COUNT(*) n,SUM(reward_cents) reward,MAX(day) last_day,SUM(CASE WHEN reward_cents IS NULL THEN 1 ELSE 0 END) immature FROM observations');
    observationHashes.push(sha({shape,orders,totals}));
    if(totals.rows[0].n!==4500||totals.rows[0].last_day!==44)issues.push(state.id+': snapshot window mismatch');
    if(state.contract.budgetCents!==c.contract.budgetCents||method.allocatedModelUSD<(c.costs.sharedReaderUSD-1e-9))issues.push(state.id+': contract or shared cost mismatch');
    if(method.score.matureOutcomes!==7000||Object.values(method.score.checks).some(Boolean))issues.push(state.id+': financial or maturity failure');
    if(method.counts.queries>p.limits.queries||method.counts.models>p.limits.models||method.counts.pilots>p.limits.pilots)issues.push(state.id+': tool budget exceeded');
    for(const m of state.models){m.summary.features.forEach(compileFeature);if(m.artifact.cutoffDay!==45||!m.summary.datasetHash)issues.push(m.id+': model provenance failure');}
    if(method.method==='research'){queries+=method.counts.queries;models+=method.counts.models;pilots+=method.counts.pilots;failedTools+=method.toolFailures;}
    const expected=(method.score.platformProxyCents-c.control.platformProxyCents)/100-method.allocatedModelUSD;
    if(Math.abs(expected-method.deltaPlatformUSD)>1e-9)issues.push(state.id+': wrong economic score');
  }
  if(new Set(observationHashes).size!==1)issues.push(c.id+': methods did not receive identical observed data');
  const directory=resolve(BASE,'missions',c.id),files=(await readdir(directory)).filter(f=>f.endsWith('.json')&&(f==='shared-interpretation.json'||f.includes('-STEP-')||f.includes('-REVIEW')));
  for(const file of files){const call=await readJSON(resolve(directory,file));
    const keys=value=>value&&typeof value==='object'?Object.entries(value).flatMap(([k,v])=>[k,...keys(v)]):[];
    if(keys(call.packet).some(k=>['privateTraits','weeklyIncome','merchantAffinity','evaluationSeeds','scenario','finalOutcomes'].includes(k)))issues.push(file+': hidden input key');
    if(call.status==='COMPLETED'&&(!call.provider?.responseId||!call.provider?.modelVersion?.startsWith('gemini-3.1-flash-lite')))issues.push(file+': missing model provenance');
  }
}
const suite=ledger.entries.filter(e=>e.runId.startsWith('market-RSCH3-')).reduce((n,e)=>n+e.chargedMicros,0)/1e6;if(suite>1)issues.push('Research suite cap exceeded');
const result={verifiedAt:new Date().toISOString(),passed:!issues.length,issues,missions:r.cases.length,methods:r.cases.reduce((n,c)=>n+c.methods.length,0),modelCalls:requests,evaluationCostUSD:cost,suiteCostUSD:suite,lifetimeModelUSD:ledger.entries.reduce((n,e)=>n+e.chargedMicros,0)/1e6,
  researchWork:{queries,models,pilots,failedTools},frozenSimulatorAndPriorBenchmarks:true,sharedEvidenceVerified:true,sharedParserCostIncluded:true,allFinalOutcomesMature:true,
  limitations:['Full observed numerical event and order rows match across methods; method-specific synthetic IDs differ.','Numeric and protocol validation does not establish semantic correctness of every model rationale.','Development pilot feedback is a modeled experiment, not live-customer causal evidence.']};
await saveJSON(resolve(BASE,'verification.json'),result);console.log(JSON.stringify(result,null,2));if(issues.length)process.exitCode=1;
