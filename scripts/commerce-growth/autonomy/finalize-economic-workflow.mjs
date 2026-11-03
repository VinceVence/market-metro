// One bounded design session, then an untouched confirmation cohort. This
// evaluates a planner's workflow, not a claim that more personas add value.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CONTRACT,digest} from '../environment.mjs';
import {verifyBaseline} from '../baseline.mjs';
import {economicResources,makeEconomicSnapshot,runEconomicPatch} from './economic-runtime.mjs';
import {inspectEconomy} from './economic-tools.mjs';
import {openEconomicHarness} from './economic-harness.mjs';
import {openTeamVertex} from '../../agent-mesh/model-client.mjs';
import {openAllocator} from '../../commerce-deadlines/solver.mjs';
import {pairedBootstrap} from './net-revision-study.mjs';

const FIELDS=['platformUSD','retailerUSD','terminalCashUSD','terminalInventoryUSD','retainedPurchases','retainedVolumeUSD','outreachCostUSD','unpaidLiabilities'];
const mean=(rows,key)=>rows.reduce((s,r)=>s+r[key],0)/rows.length;
export const summarize=rows=>Object.fromEntries(FIELDS.map(k=>[k,mean(rows,k)]));
export function paymentContribution(ledger){
 const result={retailFees:0,supplierFees:0,processing:0,outreach:0,refunds:0,other:0};
 for(const e of ledger.filter(e=>e.day>=30)){
  const cents=(e.to==='platform'?e.cents:0)-(e.from==='platform'?e.cents:0);if(!cents)continue;
  const key=e.kind==='SUPPLIER_PAYMENT_FEE'?'supplierFees':e.kind.includes('PROCESSING')?'processing':e.kind.includes('OUTREACH')?'outreach':e.kind==='PAYMENT_FEE_RETURN'?'refunds':e.kind==='PAYMENT_FEE'?'retailFees':'other';result[key]+=cents/100;
 }return result;
}
export function economicGates(candidate,baseline,costUSD=0){
 return {positivePayPalNet:candidate.platformUSD-costUSD>baseline.platformUSD,
  retailerValue:candidate.retailerUSD>=baseline.retailerUSD,
  partnerCash:candidate.terminalCashUSD>=baseline.terminalCashUSD,
  retainedVolume:candidate.retainedVolumeUSD>=baseline.retainedVolumeUSD,
  inventory:candidate.terminalInventoryUSD<=baseline.terminalInventoryUSD*1.1,
  allLiabilitiesSettled:candidate.unpaidLiabilities===0};
}
function paired(a,b){for(const k of ['initialHash','opportunityHash','consentHash','incomeCents'])if(a[k]!==b[k])throw Error('UNPAIRED_FINALIZATION: '+k);}
function withoutTrace(result){const {trace,...r}=result;return r;}

async function main(){
 if(!process.argv.includes('--run-llm'))throw Error('EXPLICIT_MODEL_TRIAL_FLAG_REQUIRED');
 const root='docs/commerce-growth/economic-final-1',save=(p,v)=>writeFile(root+'/'+p,JSON.stringify(v,null,2)+'\n');
 await mkdir(root);await mkdir(root+'/source');
 const r=await economicResources(),targetSettings=r.manifest.regressionCases.find(c=>c.id==='C6'),historical=r.manifest.regressionCases.filter(c=>c.panel===1),reviewDay=60,
  confirmation=Object.keys(CONTRACT.regimes).flatMap((regime,i)=>[0,1].map(panel=>({id:'F'+(i*2+panel),regime,panel,seed:1006510+i*2+panel}))),
  limits={modelCalls:11,proposals:2,modelFits:2,trials:2},hashes={},providerCapUSD=.30;
 for(const c of confirmation)if([...r.incumbent.artifact.trainingEpisodes??[],...r.expert.artifact.trainingEpisodes??[],...r.expert.artifact.calibrationEpisodes??[],...r.manifest.regressionCases.map(c=>c.seed)].includes(c.seed))throw Error('CONFIRMATION_OVERLAPS_KNOWN_DATA');
 const paths=['scripts/commerce-growth/autonomy/finalize-economic-workflow.mjs','scripts/commerce-growth/autonomy/economic-harness.mjs','scripts/commerce-growth/autonomy/economic-tools.mjs','scripts/commerce-growth/autonomy/economic-runtime.mjs','scripts/commerce-growth/team/runner.mjs','scripts/commerce-growth/team/control.mjs','scripts/commerce-growth/experiments/program.mjs','scripts/commerce-growth/experiments/baskets.mjs','scripts/commerce-growth/autonomy/team-workbench-tools.mjs'];
 for(const p of paths){hashes[p]=createHash('sha256').update(await readFile(p)).digest('hex');await copyFile(p,root+'/source/'+p.replaceAll('/','--'));}
 const verify=async()=>{await verifyBaseline();for(const[p,h]of Object.entries(hashes))if(createHash('sha256').update(await readFile(p)).digest('hex')!==h)throw Error('FINALIZATION_SOURCE_CHANGED: '+p);};
 const protocol={registeredAt:new Date().toISOString(),targetSettings,historical,reviewDay,confirmation,limits,providerCapUSD,economyHashes:r.manifest.economyHashes,programHashes:hashes,
  primary:'Final selected workflow vs locked v1 and strong fixed: paired settled modeled platform contribution after AI costs. Report retailer contribution, partner cash, inventory, retained purchases and volume, ledger components, each regime and confidence intervals. Never tune after confirmation opens.',
  control:'Also evaluate the first proposed intervention without the historical review gate. This isolates the effect of reviewing this same planner proposal, not a multi-agent or equal-call architecture comparison.',
  costAllocation:'Charge full current workflow design cost once across all14 confirmation markets, plus original v1 design cost. Report one-market cost separately. Failed earlier economic workflow costs are also shown as research overhead.',
  boundaries:'Authored economy unchanged. Historical panel excludes the current target and all confirmation seeds. Planner sees past-only target observations, not target future, confirmation cases, seeds or regime labels. No native payments, APAC, or subagents.'};
 await save('protocol.json',protocol);
 const allocator=openAllocator(),historyCache=new Map(),rows=[];let provider,state,modelCostUSD=0;
 try{
  await verify();const view=await makeEconomicSnapshot(targetSettings,r,allocator,reviewDay);await save('public-observation.json',view);
  const brief={objective:'Improve settled modeled PayPal net while preserving retailer contribution, partner cash and retained retail volume. Supplier fee growth without merchant or retail value is not sufficient.',
   priorFailure:{source:'Different previous historical experiment',description:'Changing reactivation, forecast stock and bank settlement together lost $83.15 platform contribution and $253.89 retailer contribution. It did not isolate a component effect.'},
   task:'Use the available indicators to diagnose an actual opportunity. Prefer an interpretable intervention. You may revise after a failed historical test, within two total proposals. Avoid interpreting listings without stock as unfilled authorized demand or a short quiet window as permanent absence of demand. You choose the tools, hypotheses and artifacts; do not force a change.',
   historicalTest:'H1 is now a balanced seven-market completed-history panel. The exact same proposed temporary policy is applied independently at the same review day in every historical market. Financial gates use aggregate outcomes. The panel and target are not fresh confirmation data.',
   finalization:'Keep v1 unless a historically activated candidate passes all financial gates. Fresh confirmation occurs only after your final decision is frozen, without more feedback or tuning.'};
  const harness=await openEconomicHarness({view,resources:r,path:root+'/checkpoints.json',limits,brief,historyDescription:{id:'H1',markets:historical.length,description:brief.historicalTest},compareHistorical:async candidate=>{
   await verify();const trials=[];
   for(const [i,c]of historical.entries()){
    if(!historyCache.has(c.id))historyCache.set(c.id,await r.runBaseline(c,r,allocator));
    const baseline=historyCache.get(c.id),result=await runEconomicPatch(c,candidate,r,allocator);paired(result,baseline);
    trials.push({market:'H'+(i+1),baseline:withoutTrace(baseline),candidate:withoutTrace(result)});
    console.log(JSON.stringify({phase:'historical',candidate:candidate.id,market:i+1,netDelta:result.platformUSD-baseline.platformUSD}));
   }
   const baseline=summarize(trials.map(t=>t.baseline)),proposed=summarize(trials.map(t=>t.candidate)),gates=economicGates(proposed,baseline),activeDays=trials.reduce((s,t)=>s+t.candidate.activeDays.length,0),output={source:'DIFFERENT_COMPLETED_HISTORICAL_MARKET',candidateId:candidate.id,economyUnchanged:true,historicalMarket:'H1',markets:historical.length,activeDays,baseline,candidate:proposed,delta:Object.fromEntries(FIELDS.map(k=>[k,proposed[k]-baseline[k]])),gates,eligible:activeDays>0&&Object.values(gates).every(Boolean),perMarket:trials.map(t=>({market:t.market,activeDays:t.candidate.activeDays.length,netDelta:t.candidate.platformUSD-t.baseline.platformUSD,retailerDelta:t.candidate.retailerUSD-t.baseline.retailerUSD,cashDelta:t.candidate.terminalCashUSD-t.baseline.terminalCashUSD})),scope:'Balanced completed-history panel, not unseen evidence. Full settlement tail included; averages before workflow design cost. No target future.'};
   await save(candidate.id+'-historical.json',{output,trials});await verify();return output;
  }});
  provider=await openTeamVertex('ECONOMIC-FINAL-1',{route:'research',capMicros:300000});state=await harness.run(provider);modelCostUSD=state.costUSD??0;await provider.close();provider=null;
  const selected=state.recommendation.candidate_id??'v1',first=Object.values(state.candidates)[0]??null;
  // Freeze the LLM's exact output before evaluating any confirmation seed.
  await save('frozen-decision.json',{frozenAt:new Date().toISOString(),status:state.status,decision:state.recommendation,selectedHash:selected==='v1'?r.manifest.decisionHash:digest(state.candidates[selected]),firstProposal:first?.id??null,modelCostUSD});
  console.log(JSON.stringify({phase:'design_complete',status:state.status,selected,modelCostUSD}));
  const arms=['fixed','baseline_v1','workflow',...(first?['unreviewed_proposal']:[])],workflowCost=modelCostUSD+r.manifest.designCostUSD;
  for(const c of confirmation){
   await verify();const baseline=await r.runBaseline(c,r,allocator,{trace:true}),fixed=await r.runFixed(c,r,allocator),cache=new Map([['v1',baseline]]);
   const get=async id=>{if(!cache.has(id))cache.set(id,await runEconomicPatch(c,state.candidates[id],r,allocator,{trace:true}));return cache.get(id);};
   const results={fixed,baseline_v1:baseline,workflow:await get(selected),...(first?{unreviewed_proposal:await get(first.id)}:{})};
   for(const [arm,result]of Object.entries(results)){
    paired(result,baseline);const row=withoutTrace(result),cost=(arm==='fixed'?0:arm==='baseline_v1'?r.manifest.designCostUSD:workflowCost)/confirmation.length;
    if(result.trace){row.paymentBreakdown=paymentContribution(result.trace.ledger);if(Math.abs(Object.values(row.paymentBreakdown).reduce((s,n)=>s+n,0)-row.platformUSD)>.011)throw Error('PLATFORM_LEDGER_MISMATCH');}
    rows.push({...row,case:c.id,arm,modelCostUSD:cost,netAfterModelUSD:row.platformUSD-cost});
   }
   // One complete evidence sample, every financial row, and all decisions in
   // the intervention period. No hidden observations enter model prompts.
   if(c.id==='F0')await save('example-ledger.json',{baseline:baseline.trace.ledger,workflow:(await get(selected)).trace.ledger});
   await save('rows.json',{status:'RUNNING',rows});console.log(JSON.stringify({phase:'confirmation',case:c.id,baseline:baseline.platformUSD,workflow:results.workflow.platformUSD,fixed:fixed.platformUSD}));
  }
  await verify();const summary=Object.fromEntries(arms.map(a=>{const rs=rows.filter(r=>r.arm===a);return[a,{...summarize(rs),netAfterModelUSD:mean(rs,'netAfterModelUSD'),paymentBreakdown:rs[0].paymentBreakdown?Object.fromEntries(Object.keys(rs[0].paymentBreakdown).map(k=>[k,rs.reduce((s,r)=>s+r.paymentBreakdown[k],0)/rs.length])):null}];})),differences={};
  for(const base of arms.filter(a=>a!=='workflow')){
   const pairs=confirmation.map(c=>{const a=rows.find(r=>r.case===c.id&&r.arm==='workflow'),b=rows.find(r=>r.case===c.id&&r.arm===base);return {case:c.id,regime:c.regime,panel:c.panel,net:a.netAfterModelUSD-b.netAfterModelUSD,retailer:a.retailerUSD-b.retailerUSD,cash:a.terminalCashUSD-b.terminalCashUSD,retained:a.retainedPurchases-b.retainedPurchases};});
   differences[base]={meanNetUSD:mean(pairs,'net'),meanRetailerUSD:mean(pairs,'retailer'),meanCashUSD:mean(pairs,'cash'),meanRetained:mean(pairs,'retained'),interval:pairedBootstrap(pairs.map(p=>p.net)),wins:pairs.filter(p=>p.net>.005).length,losses:pairs.filter(p=>p.net<-.005).length,paired:pairs,panels:[0,1].map(p=>({panel:p,netUSD:mean(pairs.filter(r=>r.panel===p),'net')}))};
  }
  const ledger=JSON.parse(await readFile('.local/gcp/model-spend.json','utf8')),priorEconomicCost=.128574,gates=economicGates(summary.workflow,summary.baseline_v1,modelCostUSD/confirmation.length),report={status:'COMPLETED',selected:state.recommendation,summary,differences,modelCostUSD,priorEconomicCost,allEconomicResearchCostUSD:modelCostUSD+priorEconomicCost,fullCostNetDeltaVsV1:differences.baseline_v1.meanNetUSD-priorEconomicCost/confirmation.length,projectLedgerUSD:ledger.entries.reduce((s,e)=>s+(e.chargedMicros??e.reservedMicros??0),0)/1e6,providerCalls:state.providerCalls,localFits:Object.keys(state.models).length,historicalTrials:Object.keys(state.trials).length,confirmationMarkets:confirmation.length,confirmationProviderCalls:0,gates,eligibleForPromotion:Object.values(gates).every(Boolean)&&differences.baseline_v1.interval.low>0,economyUnchanged:true,nativePayments:0,promoted:false,scope:protocol.primary,architectureClaim:'A fresh planner-directed workflow with trusted tools and historical review. No claim of specialist-agent superiority; first-proposal comparison measures this planner review effect only.'};
  await save('results.json',report);await save('rows.json',{status:'COMPLETED',rows});
  await writeFile('demo/data/commerce-economic-final.json',JSON.stringify({report,protocol,state,overview:inspectEconomy(view,['demand','outreach','inventory','liquidity','supply','payments'],7)}));
  console.log(JSON.stringify({status:report.status,selected,vsFixed:differences.fixed.meanNetUSD,vsV1:differences.baseline_v1.meanNetUSD,interval:differences.baseline_v1.interval,gates,modelCostUSD,projectLedgerUSD:report.projectLedgerUSD}));
 }catch(e){await save('failure.json',{error:e.message,completedRows:rows.length});throw e;}finally{await provider?.close();allocator.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
