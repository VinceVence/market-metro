import {resolve} from 'node:path';
import {readFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {ROOT,frozenInputs,readJSON,saveJSON,sha,runPolicy} from '../research-lab/data.mjs';
import {pairedEstimate} from '../policy-lab/benchmark-stats.mjs';
import {semanticSpec,rulesInterpret,clarify} from './contract.mjs';
import {openWorkflow} from './tools.mjs';
import {session,interpret,chooseExperiments} from './agent.mjs';
import {DEVELOPMENT,EVALUATION} from './cases.mjs';

export const BASE=resolve(ROOT,'docs/policy-lab/benchmarks/v4');
const CODE=['contract','tools','agent','cases','benchmark'].map(n=>'scripts/trusted-workflow/'+n+'.mjs');
const LABELS={rules:'Command parser + trusted workflow',reader:'Gemini interpretation + trusted workflow',adaptive:'Same interpretation + adaptive Gemini plan'};
const estimate=(rows,field)=>({...pairedEstimate(rows,field),interval:'95% paired bootstrap over authored mission/seed cases; exploratory, not population-general.'});
const NONE={id:'observe',strategy:'observe',audience:'all',merchantIndices:[],maxOfferPct:0,duration:0,penalty:0,epsilon:0,windowDays:42};
export async function hashes(){return Object.fromEntries(await Promise.all(CODE.map(async p=>[p,sha(await readFile(resolve(ROOT,p)))])));}
export async function spend(){const ledger=await readJSON(resolve(ROOT,'.local/gcp/model-spend.json'));return {suiteUSD:ledger.entries.filter(e=>e.runId.startsWith('market-TW4-')).reduce((n,e)=>n+e.chargedMicros,0)/1e6,lifetimeUSD:ledger.entries.reduce((n,e)=>n+e.chargedMicros,0)/1e6,unsettled:ledger.entries.filter(e=>e.status==='pending').length,circuit:ledger.circuit};}
export async function freeze(){
  const input=await frozenInputs(),code=await hashes(),file=resolve(BASE,'protocol.json');
  try{const p=await readJSON(file);if(sha(p.code)!==sha(code))throw Error('V4_PROTOCOL_ALREADY_FROZEN');return p;}catch(e){if(e.code!=='ENOENT')throw e;}
  const p={version:4,createdAt:new Date().toISOString(),code,prior:{v1:input.originalBenchmarkHash,v2:input.v2ProtocolHash,v3:sha(await readFile(resolve(ROOT,'docs/policy-lab/benchmarks/v3/protocol.json')))},casesHash:sha(EVALUATION),tasks:EVALUATION.map(({expected,...task})=>task),budget:await spend(),suiteCapUSD:1.5,
    hypotheses:['Semantic interpretation improves exact authored-business-goal completion relative to a capable documented command parser.','Extra LLM experiment planning adds benefit relative to the same semantic interpretation followed by deterministic model comparison and pilot selection.'],
    fairness:'Identical observed numeric rows and goals for all methods. Reader and adaptive arms share one actual LLM interpretation. Both fit the same four recipes and have exactly two development pilot slots. All decisions use the same validation and final financial evaluator. Rules has no semantic LLM; that contrast tests language interpretation, not orchestration.',
    evaluation:'24 authored cases: six direct requests, six paraphrases, six revisions/negations and six ambiguous/unsupported requests. Expected specifications are evaluation-only; runtime validation checks schema and general authority, never expected answers. No final economic outcomes enter the planner. Finance uses independent final seeds and a 14-day return tail.',
    successCriteria:{semantic:'More exact supported/clarify outcomes than command parsing with no incorrect-ready outputs on the six unsupported cases. Report exact paired discordances and uncertainty; do not extrapolate to production.',adaptive:'Equal or better exact completion and positive paired financial improvement after inference cost over the shared-reader workflow. If not established, prefer the shared-reader workflow.',recovery:'Offline crash/resume tests preserve completed artifact and effect identities without repeated completed training, pilots or simulated publications.'},
    limitations:['Authored language benchmark; not representative merchant data or blinded human annotations.','Four recipes, two pilot slots and seven original features limit strategic headroom.','No production PayPal ROI or novel framework claim.','No new sandbox payments; existing receipts remain integration evidence.']};
  p.hash=sha(p);await saveJSON(file,p);return p;
}
function grade(spec,expected,completed){const exact=JSON.stringify(semanticSpec(spec))===JSON.stringify(expected);return {exactInterpretation:exact,goalCompleted:exact&&completed,incorrectReady:spec.status==='ready'&&!exact,unsupportedReady:expected.status==='clarify'&&spec.status==='ready',unnecessaryClarification:expected.status==='ready'&&spec.status==='clarify'};}
async function runCase(task,protocol,dev){
  const {catalog}=await frozenInputs(),id='TW4-'+(dev?'DEV-':'EVAL-')+sha({code:protocol.code,taskId:task.id}).slice(0,14),dir=resolve(BASE,dev?'development':'missions',id),file=resolve(dir,'result.json');
  try{return await readJSON(file);}catch(e){if(e.code!=='ENOENT')throw e;}
  await mkdir(dir,{recursive:true});const s=await session({id,directory:resolve(dir,'requests')});const started=Date.now();let parsed,readerError=null;const outputs=[];
  try{
    try{parsed=await interpret(s,task.brief);}catch(e){readerError=e.message;const budget=await spend();if(budget.circuit||budget.unsettled||/BUDGET|SPEND|AUTH|PAID_RESULT/.test(e.message))throw e;parsed=clarify('Reader failed its typed contract: '+e.message);}
    for(const method of ['rules','reader','adaptive']){
      const spec=method==='rules'?rulesInterpret(task.brief):parsed;
      const w=await openWorkflow({directory:resolve(dir,method),id:id+'-'+method,task,spec,catalog});let error=null,planReason=null;
      try{
        const packet=await w.prepare();
        if(packet){let choices;if(method==='adaptive'){const plan=await chooseExperiments(s,{...packet,brief:task.brief});choices=plan.choices;planReason=plan.reason;}else choices=w.fixedChoices(packet);
          await w.finish(choices);
        }
      }catch(e){error=e.message;const budget=await spend();if(budget.circuit||budget.unsettled||/BUDGET|SPEND|AUTH|PAID_RESULT/.test(e.message))throw e;}
      const raw=method==='rules'?spec:s.calls.find(c=>c.stage==='trusted_semantic_router')?.response?.args;
      let rawCorrect=false;try{const {sourceEvidence,...value}=raw||{};rawCorrect=JSON.stringify(semanticSpec(value))===JSON.stringify(task.expected);}catch{}
      outputs.push({method,spec,error,readerError:method==='rules'?null:readerError,planReason,state:w.state,policy:w.policy(),grade:{...grade(spec,task.expected,w.state.completed&&!error&&!(method!=='rules'&&readerError)),rawInterpretationCorrect:rawCorrect,incorrectReadyAttempt:raw?.status==='ready'&&!rawCorrect}});
    }
  }finally{await s.close();}
  const native=s.calls.filter(c=>c.provider),readerCost=native.filter(c=>c.stage==='trusted_semantic_router').reduce((n,c)=>n+c.provider.modelCostMicros,0)/1e6,plannerCost=native.filter(c=>c.stage==='trusted_adaptive_plan').reduce((n,c)=>n+c.provider.modelCostMicros,0)/1e6;
  const methods=outputs.map(o=>{
    const budget=o.spec.status==='ready'?o.spec.budgetCents:10000;
    const args={id:'FINAL-'+task.seed,seed:task.seed,scenario:task.scenario,catalog,budgetCents:budget,cutoff:45};
    const control=runPolicy({...args,plan:NONE,artifact:null});
    const score=runPolicy({...args,plan:o.policy.completed?o.policy.plan:NONE,artifact:o.policy.completed?o.policy.artifact:null,includeTrace:true});
    const allocatedModelUSD=o.method==='rules'?0:readerCost+(o.method==='adaptive'?plannerCost:0);
    return {...o,allocatedModelUSD,score,deltaPlatformUSD:(score.platformProxyCents-control.platformProxyCents)/100-allocatedModelUSD,deltaMerchantUSD:(score.merchantContributionCents-control.merchantContributionCents)/100,control:{platformProxyCents:control.platformProxyCents,purchases:control.purchases},policy:{decision:o.policy.decision,plan:o.policy.plan,completed:o.policy.completed}};
  });
  const result={id,taskId:task.id,family:task.family,brief:task.brief,seed:task.seed,scenario:task.scenario,protocolHash:protocol.hash||'DEVELOPMENT',expectedSpec:task.expected,methods,costs:{actualModelUSD:readerCost+plannerCost,readerUSD:readerCost,plannerUSD:plannerCost,requests:native.length},elapsedMs:Date.now()-started,sharedEvidence:outputs.every(o=>o.state.snapshotHash===outputs[0].state.snapshotHash),evaluationUnsealedAfterCommit:true};
  await saveJSON(file,result);return result;
}
function pairedSuccess(a,b){let wins=0,losses=0,ties=0;for(let i=0;i<a.length;i++){const d=Number(a[i])-Number(b[i]);if(d>0)wins++;else if(d<0)losses++;else ties++;}const n=wins+losses,k=Math.min(wins,losses);let tail=0,term=2**(-n);for(let j=0;j<=k;j++){if(j)term*= (n-j+1)/j;tail+=term;}return {wins,losses,ties,twoSidedExactP:n?Math.min(1,2*tail):1,test:'Exact paired discordance sign test; authored cases, not population sampling.'};}
export async function run(dev=false){
  const protocol=dev?{code:await hashes()}:await readJSON(resolve(BASE,'protocol.json'));
  if(!dev&&(sha(protocol.code)!==sha(await hashes())||protocol.casesHash!==sha(EVALUATION)))throw Error('FROZEN_V4_CHANGED');
  const cases=[];for(const task of dev?DEVELOPMENT:EVALUATION){const result=await runCase(task,protocol,dev);cases.push(result);await saveJSON(resolve(BASE,dev?'development-progress.json':'progress.json'),{completed:cases.length,total:dev?DEVELOPMENT.length:EVALUATION.length,last:result.taskId,cost:await spend()});console.log(JSON.stringify({task:result.taskId,grade:result.methods.map(m=>[m.method,m.grade.goalCompleted,m.policy.decision]),costUSD:result.costs.actualModelUSD}));}
  const summaries=Object.keys(LABELS).map(method=>{const rows=cases.map(c=>({...c.methods.find(m=>m.method===method),seed:c.seed}));return {method,label:LABELS[method],cases:rows.length,complete:rows.filter(r=>r.grade.goalCompleted).length,exactInterpretation:rows.filter(r=>r.grade.exactInterpretation).length,rawInterpretationCorrect:rows.filter(r=>r.grade.rawInterpretationCorrect).length,incorrectReadyAttempts:rows.filter(r=>r.grade.incorrectReadyAttempt).length,incorrectReady:rows.filter(r=>r.grade.incorrectReady).length,unsupportedReady:rows.filter(r=>r.grade.unsupportedReady).length,unnecessaryClarification:rows.filter(r=>r.grade.unnecessaryClarification).length,workflowFailures:rows.filter(r=>r.error).length,modelCostUSD:rows.reduce((n,r)=>n+r.allocatedModelUSD,0),financial:estimate(rows,'deltaPlatformUSD'),merchant:estimate(rows,'deltaMerchantUSD')};});
  const get=method=>cases.map(c=>c.methods.find(m=>m.method===method).grade.goalCompleted),result={version:4,phase:dev?'DEVELOPMENT':'FROZEN_EVALUATION',generatedAt:new Date().toISOString(),protocolHash:protocol.hash||null,labels:LABELS,cases,summaries,contrasts:{readerVsRules:pairedSuccess(get('reader'),get('rules')),adaptiveVsReader:pairedSuccess(get('adaptive'),get('reader')),adaptiveFinancial:estimate(cases.map(c=>({seed:c.seed,delta:c.methods.find(m=>m.method==='adaptive').deltaPlatformUSD-c.methods.find(m=>m.method==='reader').deltaPlatformUSD})),'delta')},costs:{actualModelUSD:cases.reduce((n,c)=>n+c.costs.actualModelUSD,0),requests:cases.reduce((n,c)=>n+c.costs.requests,0),...await spend()},integrity:{sharedEvidence:cases.every(c=>c.sharedEvidence),allMature:cases.every(c=>c.methods.every(m=>m.score.matureOutcomes===7000)),accountingViolations:cases.reduce((n,c)=>n+c.methods.reduce((a,m)=>a+Object.values(m.score.checks).reduce((x,y)=>x+y,0),0),0)},limitations:protocol.limitations||['Development results, not held-out evaluation.']};
  await saveJSON(resolve(BASE,dev?'development-result.json':'result.json'),result);if(dev)await saveJSON(resolve(BASE,'development-summary-'+sha(protocol.code).slice(0,12)+'.json'),result);return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  if(process.argv[2]==='--freeze')console.log(JSON.stringify(await freeze(),null,2));
  else if(['--dev','--run'].includes(process.argv[2])){const r=await run(process.argv[2]==='--dev');console.log(JSON.stringify({summaries:r.summaries,contrasts:r.contrasts,costs:r.costs,integrity:r.integrity},null,2));}
  else throw Error('Use --dev, --freeze or --run. --dev and --run may make bounded paid model calls.');
}
