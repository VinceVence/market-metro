import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {CONTRACT,digest} from '../environment.mjs';
import {coordinationResources,summarizeCoordination,runCoordination} from './net-coordination.mjs';
import {workbenchPlan} from './team-workbench-tools.mjs';
import {compileProgram,executeProgramCommerce} from '../experiments/program.mjs';
import {runCoordinatedCase} from '../team/runner.mjs';
import {openAllocator} from '../../commerce-deadlines/solver.mjs';

export async function revisionResources(){
 const root='docs/commerce-growth/roc-net-goal-1',read=async p=>JSON.parse(await readFile(p,'utf8')),r=await coordinationResources(),decision=await read(root+'/net-revision-decision.json');
 if(decision.status!=='COMPLETED'||digest(decision.output)!==decision.decisionHash)throw Error('UNBOUND_MODEL_REVISION');
 const funded=(await read('docs/commerce-growth/experiments-1/bundled-1/protocol.json')).candidates[0].program;
 return {...r,decision,funded:compileProgram(funded)};
}
export function revisionController(r,{audience=r.decision.output.audience}={}){
 const d=r.decision.output,model=d.model==='expert'?r.expert:r.incumbent,campaign={kind:audience==='consented_positive_value'?'open_discovery':d.model==='expert'?'ranked_discovery':'intent_assistance',objective:'joint'};
 return {plan:view=>({...workbenchPlan(view,{model,campaign,prior:r.prior,fundingPrior:r.fundingPrior,configuration:r.fixed.config}),agentCheckpoint:r.decision.decisionHash})};
}
export async function runRevision(c,r,allocator,{trace=false,withoutOutreach=false,withoutFulfillment=false}={}){
 const fulfillment=r.decision.output.fulfillment,program=fulfillment==='funded_baskets'?r.funded:r.balanced;
 return runCoordinatedCase(c,{id:'gemini-net-revision',config:r.fixed.config},{allocator,prior:r.prior,trace,controller:revisionController(r,withoutOutreach?{audience:'recent_interest'}:{}),
  ...(!withoutFulfillment&&fulfillment!=='fixed'?{commerceExecutor:(w,_config,a,key)=>executeProgramCommerce(w,program,r.prior,a,key)}:{})});
}
function contribution(ledger){const sums={retailFees:0,supplierFees:0,processing:0,outreach:0,refunds:0,other:0};for(const l of ledger.filter(l=>l.day>=30)){const amount=(l.to==='platform'?l.cents:0)-(l.from==='platform'?l.cents:0);if(!amount)continue;const key=l.kind==='SUPPLIER_PAYMENT_FEE'?'supplierFees':l.kind.includes('PROCESSING')?'processing':l.kind.includes('OUTREACH')?'outreach':l.kind==='PAYMENT_FEE_RETURN'?'refunds':l.kind==='PAYMENT_FEE'?'retailFees':'other';sums[key]+=amount/100;}return sums;}
export function pairedBootstrap(values){
 let state=614;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;},means=[];
 for(let b=0;b<10000;b++){let total=0;for(let i=0;i<values.length;i++)total+=values[Math.floor(random()*values.length)];means.push(total/values.length);}means.sort((a,b)=>a-b);
 return {low:means[250],high:means[9749],method:'Paired market bootstrap, 10000 draws. Synthetic authored markets; not a production ROI interval.'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)&&(process.argv.includes('--development')||process.argv.includes('--confirmation'))){
 const fresh=process.argv.includes('--confirmation'),root='docs/commerce-growth/roc-net-goal-1',dir=root+(fresh?'/net-revision-confirmation-1':'/net-revision-development-1'),read=async p=>JSON.parse(await readFile(p,'utf8')),r=await revisionResources(),core=await read('docs/commerce-growth/development-1/protocol.json');
 if(fresh){const d=await read(root+'/net-revision-development-1/results.json');if(!d.eligibleForConfirmation)throw Error('DEVELOPMENT_ECONOMIC_GATE_FAILED');}
 await mkdir(dir);const cases=Object.keys(CONTRACT.regimes).flatMap((regime,i)=>Array.from({length:fresh?2:1},(_,panel)=>({id:(fresh?'C':'D')+(i*(fresh?2:1)+panel),regime,panel,seed:(fresh?998610:997610)+i*2+panel}))),arms=fresh?['fixed','numerical','revised','without_outreach','without_fulfillment']:['fixed','numerical','revised'],rows=[],programHashes={};
 if(fresh&&cases.some(c=>[...r.expert.artifact.trainingEpisodes,...r.expert.artifact.calibrationEpisodes].includes(c.seed)))throw Error('CONFIRMATION_OVERLAPS_TRAINING');
 const paths=['scripts/commerce-growth/autonomy/net-revision-study.mjs','scripts/commerce-growth/autonomy/net-coordination.mjs','scripts/commerce-growth/team/runner.mjs','scripts/commerce-growth/team/control.mjs','scripts/commerce-growth/experiments/program.mjs','scripts/commerce-growth/experiments/baskets.mjs','scripts/commerce-growth/autonomy/team-workbench-tools.mjs','scripts/commerce-growth/autonomy/features.mjs','scripts/commerce-growth/autonomy/inquiry-expert.mjs','scripts/commerce-growth/autonomy/funding-calibration.mjs',root+'/net-revision-decision.json','docs/commerce-growth/autonomy-1/shared-value-training-1/models.json','docs/commerce-growth/autonomy-1/funding-training/funding-prior.json','docs/commerce-growth/team-1/training/model.json','docs/commerce-growth/experiments-1/bundled-1/protocol.json'];
 await mkdir(dir+'/source');for(const p of paths){programHashes[p]=createHash('sha256').update(await readFile(p)).digest('hex');if(p.startsWith('scripts/'))await copyFile(p,dir+'/source/'+p.replaceAll('/','--'));}
 const save=(name,v)=>writeFile(dir+'/'+name,JSON.stringify(v,null,2)+'\n'),verify=async()=>{for(const [p,h]of Object.entries({...core.sourceHashes,...programHashes}))if(createHash('sha256').update(await readFile(p)).digest('hex')!==h)throw Error('FROZEN_SOURCE_CHANGED: '+p);};
 await save('protocol.json',{registeredAt:new Date().toISOString(),cases,arms,economyHashes:core.sourceHashes,programHashes,decision:r.decision.output,decisionHash:r.decision.decisionHash,costUSD:r.decision.costUSD,source:fresh?'PROSPECTIVE_CONFIRMATION':'PREVIOUSLY_OPENED_DEVELOPMENT_MARKETS',primary:'Revised policy must improve settled modeled PayPal net after allocated decision cost over fixed and numerical; preserve total retailer and partner cash; closing inventory <=110% fixed; no unpaid liabilities. Report per-merchant deltas, paired cases, two panels, contributions and ablations. No automatic deployment or multi-agent superiority claim.'});
 const priorRows=fresh?null:(await read(root+'/net-coordination-development-1/rows.json')).rows,allocator=openAllocator();
 try{for(const c of cases){let base;for(const arm of arms){await verify();const cached=!fresh&&['fixed','numerical'].includes(arm)?priorRows.find(row=>row.case===c.id&&row.arm===arm):null;
   const result=cached?structuredClone(cached):arm==='fixed'||arm==='numerical'?await runCoordination(c,arm,r,allocator,{trace:fresh}):await runRevision(c,r,allocator,{trace:true,withoutOutreach:arm==='without_outreach',withoutFulfillment:arm==='without_fulfillment'});
   base??=result;for(const k of ['initialHash','opportunityHash','consentHash','incomeCents'])if(result[k]!==base[k])throw Error('UNPAIRED_REVISION');
   if(result.trace){result.paymentBreakdown=contribution(result.trace.ledger);if(Math.abs(Object.values(result.paymentBreakdown).reduce((s,x)=>s+x,0)-result.platformUSD)>.011)throw Error('NET_LEDGER_RECONCILIATION_FAILED');await save(c.id+'-'+arm+'-trace.json',result.trace);delete result.trace;}
   rows.push({...result,case:c.id,arm,modelCostUSD:arm==='revised'?r.decision.costUSD/cases.length:0,netAfterModelUSD:result.platformUSD-(arm==='revised'?r.decision.costUSD/cases.length:0)});await save('rows.json',{rows});console.log(JSON.stringify({case:c.id,arm,net:result.platformUSD,retailer:result.retailerUSD,cash:result.terminalCashUSD,purchases:result.retainedPurchases}));
  }}await verify();const data=summarizeCoordination(rows,arms),gates={};for(const base of ['fixed','numerical']){const d=data.differences.revised[base];gates[base]={net:d.meanNetUSD-r.decision.costUSD/cases.length>0,retailer:d.meanRetailerUSD>=0,cash:d.meanCashUSD>=0};}
  const report={status:'COMPLETED',...data,costUSD:r.decision.costUSD,newProviderCalls:0,decisionProviderCalls:r.decision.provider.length,nativePayments:0,economyUnchanged:true,gates,inventoryGuard:data.differences.revised.fixed.inventoryRatio<=1.1,unpaidLiabilities:rows.some(row=>row.unpaidLiabilities>0),scope:fresh?'One frozen application-model proposal on two seven-regime seed panels. Ablations isolate outputs, not LLM necessity.':'Development only. The exact fresh Gemini proposal ran with unchanged economic transitions.'};
  report.eligibleForConfirmation=Object.values(gates).every(g=>Object.values(g).every(Boolean))&&report.inventoryGuard&&!report.unpaidLiabilities;
  report.netIntervals=Object.fromEntries(['fixed','numerical'].map(base=>[base,pairedBootstrap(data.differences.revised[base].paired.map(d=>d.platformUSD-r.decision.costUSD/cases.length))]));
  if(fresh)report.panels=[0,1].map(panel=>{const rs=rows.filter(row=>cases.find(c=>c.id===row.case).panel===panel),s=summarizeCoordination(rs,arms);return {panel,differences:s.differences.revised};});
  await save('results.json',report);console.log(JSON.stringify({status:report.status,gates,inventoryGuard:report.inventoryGuard,eligible:report.eligibleForConfirmation,delta:data.differences.revised}));
 }catch(e){await save('failure.json',{error:e.message,completedRows:rows.length});throw e;}finally{allocator.close();}
}
