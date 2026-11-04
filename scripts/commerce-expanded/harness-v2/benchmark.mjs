import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {gzipSync} from 'node:zlib';
import {runCoordinatedCase} from '../runner.mjs';
import {openAllocator} from '../../commerce-deadlines/solver.mjs';
import {openCommerceHarnessV2} from './controller.mjs';
import {read,digest} from './tools.mjs';
import {verifyEconomy,DEVELOPMENT_CASES} from './trials.mjs';
import {VERSION} from './contracts.mjs';

const typed=process.argv.includes('--typed'),study=process.argv.find(a=>a.startsWith('--study='))?.slice(8)||'v21-20261104',seedBase=Number(process.argv.find(a=>a.startsWith('--seed-base='))?.slice(12)||(typed?41873001:32764101));
if(!/^[a-z0-9-]+$/.test(study)||!Number.isSafeInteger(seedBase)||seedBase<1||seedBase>4294967291)throw Error('INVALID_STUDY_REGISTRATION');
const dir='docs/commerce-expanded/harness-v2'+(typed?'/'+study:''),publicPath='demo/data/commerce-harness-v2.json';
if(!process.argv.includes('--run'))throw Error('Use --run for the pre-registered capped pilot.');
const protocol=structuredClone(await verifyEconomy()),ledger=await read('.local/gcp/model-spend.json'),startUSD=ledger.entries.reduce((s,e)=>s+(e.chargedMicros??e.reservedMicros??0),0)/1e6;
if(typed){await mkdir(dir,{recursive:true});try{await readFile(dir+'/protocol.json');throw Error('V21_STUDY_ALREADY_REGISTERED');}catch(e){if(e.code!=='ENOENT')throw e;}protocol.confirmationCases=[];}
if(ledger.entries.some(e=>e.status!=='settled')||startUSD+protocol.caps.pilotUSD>Math.min(50,ledger.lifetimeCapMicros/1e6))throw Error('V2_PILOT_BUDGET_UNAVAILABLE');
if(protocol.confirmationCases.length)throw Error('V2_PILOT_ALREADY_REGISTERED');
protocol.confirmationCases=['discovery','reactivation','low_response','zero_response'].map((regime,i)=>({id:'case-'+(i+1),seed:seedBase+i,regime}));
protocol.version=VERSION;protocol.developmentMarket='Separate frozen development seeds at the same market size as execution';protocol.registeredAt=new Date().toISOString();protocol.status='FROZEN_BEFORE_CONFIRMATION';protocol.startModelSpendUSD=startUSD;
protocol.developmentCases=DEVELOPMENT_CASES;protocol.caps.providerCallsPerRun=14;protocol.caps.transportRetriesPerRun=2;
protocol.caps.initializationRetriesPerRun=1;protocol.caps.localTrialRetriesPerRun=2;
protocol.arms=['fixed','single','team'];protocol.fairness={sharedTools:true,decisionStagesPerReview:6,providerCallsPerRun:14,reviews:[30,60],sameModel:'Flash-Lite for analysis, training selection and initial proposal; Gemini 3.1 Pro for campaign revision',sameDayBoundaries:true,trialMarkets:protocol.developmentCases,modelCostChargedPerRun:true,matchedDevelopmentMarketSize:true,componentTrial:'One supply-preserved alternative when the initial proposal changes fulfillment'};
const sources=['contracts.mjs','controller.mjs','tools.mjs','trials.mjs','trial-worker.mjs','benchmark.mjs'].map(f=>'scripts/commerce-expanded/harness-v2/'+f).concat(['scripts/commerce-growth/autonomy/train-workbench.py','scripts/commerce-growth/autonomy/team-workbench-tools.mjs','scripts/commerce-growth/autonomy/features.mjs','scripts/commerce-growth/autonomy/feedback-features.mjs','scripts/commerce-growth/experiments/program.mjs','scripts/agent-mesh/model-client.mjs','benchmark/vertex.mjs','docs/commerce-growth/autonomy-1/funding-training/dataset.json']);
protocol.implementationHashes=Object.fromEntries(await Promise.all(sources.map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])));
await writeFile(dir+'/protocol.json',JSON.stringify(protocol,null,2)+'\n');
const state={version:protocol.version,status:'RUNNING',protocol,rows:[],current:null,startedAt:protocol.registeredAt,checkpoints:{}};
async function save(){const json=JSON.stringify(state,null,2)+'\n';await writeFile(dir+'/progress.json.tmp',json);await rename(dir+'/progress.json.tmp',dir+'/progress.json');await writeFile(publicPath+'.tmp',json);await rename(publicPath+'.tmp',publicPath);}
const fixed=(await read('docs/commerce-growth/team-1/development/results.json')).selectedFixed,prior=await read('docs/commerce-growth/team-1/training/model.json'),allocator=openAllocator();let controller=null;
try{
 for(const c of protocol.confirmationCases)for(const arm of protocol.arms){
  const runId=(typed?study+'-':'V2-')+c.id+'-'+arm;state.current={caseId:c.id,regime:c.regime,arm,phase:arm==='fixed'?'Strong fixed control':'Fresh agent review',day:0};await save();
  const runDir=resolve(dir,runId);await mkdir(runDir,{recursive:true});
  if(arm!=='fixed')controller=await openCommerceHarnessV2({id:runId,dir:runDir,mode:arm,prior,incumbent:fixed.config,onCheckpoint:async()=>{const summary=controller?.summary();if(summary){state.current.day=summary.lastDay;state.current.phase=summary.checkpoints.at(-1)?.actor||summary.status;state.current.calls=summary.modelCalls;state.current.costUSD=summary.modelCostUSD;}await save();}});
  const metrics=await runCoordinatedCase({seed:c.seed,regime:c.regime},arm==='fixed'?fixed:{id:runId,config:fixed.config},{allocator,prior,controller,trace:arm!=='fixed'});
  const summary=controller?.summary();await controller?.close();controller=null;
  if(metrics.trace){await writeFile(runDir+'/trace.json.gz',gzipSync(JSON.stringify(metrics.trace)));delete metrics.trace;}
  const cost=summary?.modelCostUSD||0,row={...metrics,caseId:c.id,arm,platformBeforeModelUSD:metrics.platformUSD,platformUSD:metrics.platformUSD-cost,modelCostUSD:cost,modelCalls:summary?.modelCalls||0,trainingJobs:summary?.trainingJobs||0,published:summary?.publications.filter(p=>p.published).length||0,revisions:summary?.checkpoints.filter(p=>p.actor==='GEMINI'&&(p.toolName==='propose_campaign_revision'||p.output?.decision==='revise')).length||0,failed:summary?.failed||false,reviewDays:summary?.publications.map(p=>p.day)||[]};
  const reference=state.rows.find(r=>r.caseId===c.id&&r.arm==='fixed');if(reference)for(const f of ['initialHash','opportunityHash','consentHash','incomeCents'])if(row[f]!==reference[f])throw Error('V2_CONFIRMATION_INPUT_MISMATCH_'+f);
  row.recoveredRetries=summary?.retries||0;row.operationRecoveries=summary?.operationRecoveries||{initialization:0,localTrials:[]};if(cost>.25||row.modelCalls>14||row.recoveredRetries>2||row.operationRecoveries.initialization>1||row.operationRecoveries.localTrials.length>2||row.unpaidLiabilities)throw Error('V2_RUN_BOUNDARY_FAILED');
  state.rows.push(row);if(summary)state.checkpoints[c.id+'-'+arm]=summary.checkpoints;await writeFile(runDir+'/result.json',JSON.stringify(row,null,2)+'\n');await save();console.log(JSON.stringify({caseId:c.id,regime:c.regime,arm,paypal:row.platformUSD,merchants:row.retailerUSD,purchases:row.retainedPurchases,cost,calls:row.modelCalls,published:row.published,failed:row.failed}));
 }
 await verifyEconomy();for(const [p,h]of Object.entries(protocol.implementationHashes))if(createHash('sha256').update(await readFile(p)).digest('hex')!==h)throw Error('V2_IMPLEMENTATION_CHANGED_DURING_CONFIRMATION');
 const metrics=['platformUSD','retailerUSD','retainedPurchases','retainedVolumeUSD','terminalCashUSD','terminalInventoryUSD','outreachCostUSD','modelCostUSD'];
 state.means=Object.fromEntries(protocol.arms.map(arm=>{const rows=state.rows.filter(r=>r.arm===arm);return [arm,Object.fromEntries(metrics.map(k=>[k,rows.reduce((s,r)=>s+r[k],0)/rows.length]))];}));
 state.paired=protocol.confirmationCases.map(c=>{const rows=Object.fromEntries(protocol.arms.map(a=>[a,state.rows.find(r=>r.caseId===c.id&&r.arm===a)]));return {caseId:c.id,regime:c.regime,seed:c.seed,teamVsFixed:{paypal:rows.team.platformUSD-rows.fixed.platformUSD,merchants:rows.team.retailerUSD-rows.fixed.retailerUSD,purchases:rows.team.retainedPurchases-rows.fixed.retainedPurchases},teamVsSingle:{paypal:rows.team.platformUSD-rows.single.platformUSD,merchants:rows.team.retailerUSD-rows.single.retailerUSD,purchases:rows.team.retainedPurchases-rows.single.retainedPurchases}};});
 state.costUSD=state.rows.reduce((s,r)=>s+r.modelCostUSD,0);const end=await read('.local/gcp/model-spend.json');state.totalProjectModelUSD=end.entries.reduce((s,e)=>s+(e.chargedMicros??e.reservedMicros??0),0)/1e6;
 if(state.costUSD>2||end.entries.some(e=>e.status!=='settled')||Math.abs(state.totalProjectModelUSD-startUSD-state.costUSD)>1e-6)throw Error('V2_UNRECONCILED_SPEND');
 state.status='COMPLETED';state.current=null;state.completedAt=new Date().toISOString();state.economyUnchanged=true;state.scope='Four pre-registered unseen600-shopper markets. Fresh decisions per arm and case; same tools, call caps, decision dates and exogenous inputs. Development trials use separate matched-size frozen markets. Small pilot, not proof of generalization or actual PayPal profit.';
 state.gates={teamBeatsFixed:state.means.team.platformUSD>state.means.fixed.platformUSD,teamBeatsSingle:state.means.team.platformUSD>state.means.single.platformUSD,merchantProtectedVsFixed:state.means.team.retailerUSD>=state.means.fixed.retailerUSD,merchantProtectedVsSingle:state.means.team.retailerUSD>=state.means.single.retailerUSD,purchasesIncreased:state.means.team.retainedPurchases>state.means.fixed.retainedPurchases,allWorkflowsCompleted:state.rows.every(r=>!r.failed)};
 await writeFile(dir+'/results.json',JSON.stringify(state,null,2)+'\n');await save();console.log(JSON.stringify({status:state.status,means:state.means,costUSD:state.costUSD,gates:state.gates}));
}catch(e){state.status='FAILED';state.error=e.message;await save();throw e;}finally{await controller?.close();allocator.close();}
