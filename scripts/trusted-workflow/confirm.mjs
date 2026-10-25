import {resolve} from 'node:path';
import {readFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {ROOT,readJSON,saveJSON,sha,frozenInputs,runPolicy} from '../research-lab/data.mjs';
import {pairedEstimate} from '../policy-lab/benchmark-stats.mjs';
import {semanticSpec,rulesInterpret,clarify} from './contract.mjs';
import {openWorkflow} from './tools.mjs';
import {session} from './agent.mjs';
import {interpretWithSources} from './source-router.mjs';
import {CONFIRMATION} from './confirmation-cases.mjs';
export const BASE=resolve(ROOT,'docs/policy-lab/benchmarks/v4-1');
const codeFiles=['contract','tools','agent','source-router','confirmation-cases','confirm'].map(n=>'scripts/trusted-workflow/'+n+'.mjs');
const codeHashes=async()=>Object.fromEntries(await Promise.all(codeFiles.map(async f=>[f,sha(await readFile(resolve(ROOT,f)))])));
const NONE={id:'observe',strategy:'observe',audience:'all',merchantIndices:[],maxOfferPct:0,duration:0,penalty:0,epsilon:0,windowDays:42};
export async function freeze(){
  const code=await codeHashes(),file=resolve(BASE,'protocol.json');await frozenInputs();
  try{const old=await readJSON(file);if(sha(old.code)!==sha(code))throw Error('CONFIRMATION_ALREADY_FROZEN');return old;}catch(e){if(e.code!=='ENOENT')throw e;}
  const p={version:'4.1',createdAt:new Date().toISOString(),code,casesHash:sha(CONFIRMATION),priorV4ProtocolHash:sha(await readFile(resolve(ROOT,'docs/policy-lab/benchmarks/v4/protocol.json'))),
    hypothesis:'A source-ID LLM interpreter followed by a predictable trusted workflow completes more varied authored merchant requests than the unchanged capable command parser, without accepting unsupported requests.',
    change:'Replace copied evidence excerpts with selection of existing source sentence IDs. Original text is supplied by code. Preserve the v4 general validators, tools, four models, fixed pilot selector and economic evaluator. Extra LLM experiment planning is not promoted after its adverse v4 result.',
    design:'24 new authored cases, six per family: direct, paraphrase, revision and clarify. One fixed confirmation batch; no tuning on its labels or financial results. Expected specs are evaluator-only. Identical numeric histories, fees, shocks, tools, model and campaign-selection code across methods. The only treatment is interpretation of the brief.',
    criteria:{completion:'LLM completes more exact business goals, with zero unsupported-ready outcomes in these six explicit rejection cases. Report paired discordances and interval.',scope:'This establishes language-interface value only if successful. No claim of more profitable campaigns or necessity for structured-form input.',economics:'Report all simulated platform and merchant differences after actual inference estimates. Do not exclude failures.'},
    budget:'Existing shared $1.50 TW4 suite ceiling, $0.25 per case and $8 lifetime guards remain below the authorized $50 total.',
    limitations:['Authored benchmark, not representative merchant traffic.','Only three merchants and four supported objectives.','Language interpretation can be replaced by a structured form when users can specify the contract directly.','No additional PayPal payments or APAC changes.']};p.hash=sha(p);await saveJSON(file,p);return p;
}
async function caseRun(task,p){
  const id='TW4-CONF-'+sha({protocol:p.hash,task:task.id}).slice(0,14),directory=resolve(BASE,'missions',id),file=resolve(directory,'result.json');
  try{return await readJSON(file);}catch(e){if(e.code!=='ENOENT')throw e;}
  await mkdir(directory,{recursive:true});const {catalog}=await frozenInputs(),s=await session({id,directory:resolve(directory,'requests')});let parsed,readerError=null;const outputs=[];
  try{
    try{parsed=await interpretWithSources(s,task.brief);}catch(e){if(/BUDGET|SPEND|AUTH|PAID_RESULT/.test(e.message))throw e;readerError=e.message;parsed=clarify('Interpretation could not be validated: '+e.message);}
    for(const method of ['rules','reader']){
      const spec=method==='rules'?rulesInterpret(task.brief):parsed,w=await openWorkflow({directory:resolve(directory,method),id:id+'-'+method,task,spec,catalog});let error=null;
      try{const packet=await w.prepare();if(packet)await w.finish(w.fixedChoices(packet));}catch(e){error=e.message;}
      const exact=JSON.stringify(semanticSpec(spec))===JSON.stringify(task.expected);
      outputs.push({method,spec,error,readerError:method==='reader'?readerError:null,state:w.state,policy:w.policy(),grade:{exactInterpretation:exact,goalCompleted:exact&&w.state.completed&&!error&&!(method==='reader'&&readerError),incorrectReady:spec.status==='ready'&&!exact,unsupportedReady:task.expected.status==='clarify'&&spec.status==='ready',unnecessaryClarification:task.expected.status==='ready'&&spec.status==='clarify'}});
    }
  }finally{await s.close();}
  const cost=s.calls.reduce((n,c)=>n+(c.provider?.modelCostMicros||0),0)/1e6;
  const methods=outputs.map(o=>{
    const args={id:'FINAL-'+task.seed,seed:task.seed,scenario:task.scenario,catalog,budgetCents:o.spec.status==='ready'?o.spec.budgetCents:10000,cutoff:45};
    const control=runPolicy({...args,plan:NONE,artifact:null}),score=runPolicy({...args,plan:o.policy.completed?o.policy.plan:NONE,artifact:o.policy.completed?o.policy.artifact:null,includeTrace:true}),allocatedModelUSD=o.method==='reader'?cost:0;
    return {...o,allocatedModelUSD,score,deltaPlatformUSD:(score.platformProxyCents-control.platformProxyCents)/100-allocatedModelUSD,deltaMerchantUSD:(score.merchantContributionCents-control.merchantContributionCents)/100,policy:{decision:o.policy.decision,plan:o.policy.plan,completed:o.policy.completed}};
  });
  const result={id,taskId:task.id,brief:task.brief,family:task.family,seed:task.seed,scenario:task.scenario,expectedSpec:task.expected,protocolHash:p.hash,methods,costUSD:cost,requests:s.calls.length,sharedEvidence:outputs[0].state.snapshotHash===outputs[1].state.snapshotHash};await saveJSON(file,result);return result;
}
export async function run(){
  const p=await readJSON(resolve(BASE,'protocol.json'));if(sha(p.code)!==sha(await codeHashes())||p.casesHash!==sha(CONFIRMATION))throw Error('CONFIRMATION_CODE_OR_CASES_CHANGED');
  const cases=[];for(const task of CONFIRMATION){const c=await caseRun(task,p);cases.push(c);await saveJSON(resolve(BASE,'progress.json'),{done:cases.length,total:24,last:task.id});console.log(JSON.stringify({task:task.id,complete:c.methods.map(m=>[m.method,m.grade.goalCompleted,m.readerError]),costUSD:c.costUSD}));}
  const summaries=['rules','reader'].map(method=>{const rows=cases.map(c=>({...c.methods.find(m=>m.method===method),seed:c.seed}));return {method,cases:24,completed:rows.filter(r=>r.grade.goalCompleted).length,incorrectReady:rows.filter(r=>r.grade.incorrectReady).length,unsupportedReady:rows.filter(r=>r.grade.unsupportedReady).length,unnecessaryClarification:rows.filter(r=>r.grade.unnecessaryClarification).length,costUSD:rows.reduce((n,r)=>n+r.allocatedModelUSD,0),financial:{...pairedEstimate(rows,'deltaPlatformUSD'),interval:'95% paired bootstrap over 24 authored mission/seed cases.'},merchant:{...pairedEstimate(rows,'deltaMerchantUSD'),interval:'95% paired bootstrap over 24 authored mission/seed cases.'}};});
  const diffs=cases.map(c=>({seed:c.seed,delta:Number(c.methods[1].grade.goalCompleted)-Number(c.methods[0].grade.goalCompleted)}));const wins=diffs.filter(d=>d.delta>0).length,losses=diffs.filter(d=>d.delta<0).length,n=wins+losses,k=Math.min(wins,losses);let tail=0,term=2**(-n);for(let i=0;i<=k;i++){if(i)term*=(n-i+1)/i;tail+=term;}
  const ledger=await readJSON(resolve(ROOT,'.local/gcp/model-spend.json'));
  const result={version:'4.1',generatedAt:new Date().toISOString(),protocolHash:p.hash,cases,summaries,contrast:{wins,losses,ties:24-wins-losses,twoSidedExactP:n?Math.min(1,2*tail):1,completionDifference:{...pairedEstimate(diffs,'delta'),interval:'95% paired bootstrap over authored requests, not production users.'}},costs:{actualModelUSD:cases.reduce((n,c)=>n+c.costUSD,0),requests:cases.reduce((n,c)=>n+c.requests,0),suiteUSD:ledger.entries.filter(e=>e.runId.startsWith('market-TW4-')).reduce((n,e)=>n+e.chargedMicros,0)/1e6,lifetimeUSD:ledger.entries.reduce((n,e)=>n+e.chargedMicros,0)/1e6,unsettled:ledger.entries.filter(e=>e.status==='pending').length},integrity:{sharedEvidence:cases.every(c=>c.sharedEvidence),accountingViolations:cases.reduce((n,c)=>n+c.methods.reduce((a,m)=>a+Object.values(m.score.checks).reduce((x,y)=>x+y,0),0),0),allMature:cases.every(c=>c.methods.every(m=>m.score.matureOutcomes===7000))},limitations:p.limitations};
  await saveJSON(resolve(BASE,'result.json'),result);console.log(JSON.stringify({summaries,contrast:result.contrast,costs:result.costs},null,2));return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){if(process.argv[2]==='--freeze')console.log(JSON.stringify(await freeze(),null,2));else if(process.argv[2]==='--run')await run();else throw Error('Use --freeze or --run. Running uses the existing paid-model guards.');}
