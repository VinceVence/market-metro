// Connect already-tested recommendation and complete-basket tools. Economic
// transitions, action limits, opening funds and the fixed comparator stay frozen.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {CONTRACT,digest} from '../environment.mjs';
import {valueResources} from './policy-value.mjs';
import {workbenchPlan} from './team-workbench-tools.mjs';
import {compileProgram,executeProgramCommerce} from '../experiments/program.mjs';
import {runCoordinatedCase} from '../team/runner.mjs';
import {openAllocator} from '../../commerce-deadlines/solver.mjs';

export async function coordinationResources(){
 const r=await valueResources(),revision=JSON.parse(await readFile('docs/commerce-growth/experiments-1/balanced-revision-1/revision-frozen.json','utf8'));
 return {...r,balanced:compileProgram(revision.revision.program)};
}
export function coordinationController(r,arm){
 const expert=arm==='expert_baskets';
 return {plan:view=>workbenchPlan(view,{model:expert?r.expert:r.incumbent,campaign:{kind:expert?'ranked_discovery':'intent_assistance',objective:'joint'},prior:r.prior,fundingPrior:r.fundingPrior,configuration:r.fixed.config})};
}
export async function runCoordination(settings,arm,r,allocator,{trace=false}={}){
 if(!['fixed','numerical','numerical_baskets','expert_baskets'].includes(arm))throw Error('UNKNOWN_COORDINATION_ARM');
 return runCoordinatedCase(settings,{id:'net-'+arm,config:r.fixed.config},{allocator,prior:r.prior,trace,
  ...(arm==='fixed'?{}:{controller:coordinationController(r,arm)}),
  ...(arm.endsWith('_baskets')?{commerceExecutor:(w,_config,a,key)=>executeProgramCommerce(w,r.balanced,r.prior,a,key)}:{})});
}
export function summarizeCoordination(rows,arms){
 const fields=['platformUSD','retailerUSD','wholesalerUSD','manufacturerUSD','allPartnerUSD','terminalCashUSD','terminalInventoryUSD','retainedPurchases','retainedVolumeUSD','outreachCostUSD','unpaidLiabilities'];
 const summary=Object.fromEntries(arms.map(arm=>{const rs=rows.filter(r=>r.arm===arm);return [arm,Object.fromEntries(fields.map(k=>[k,rs.reduce((s,r)=>s+r[k],0)/rs.length]))];}));
 const differences={};for(const arm of arms.filter(a=>!['fixed','numerical'].includes(a))){differences[arm]={};for(const base of ['fixed','numerical']){const rs=rows.filter(r=>r.arm===arm),d=rs.map(r=>{const b=rows.find(b=>b.arm===base&&b.case===r.case);return {case:r.case,platformUSD:r.platformUSD-b.platformUSD,retailerUSD:r.retailerUSD-b.retailerUSD,cashUSD:r.terminalCashUSD-b.terminalCashUSD,purchases:r.retainedPurchases-b.retainedPurchases};});differences[arm][base]={meanNetUSD:d.reduce((s,r)=>s+r.platformUSD,0)/d.length,meanRetailerUSD:d.reduce((s,r)=>s+r.retailerUSD,0)/d.length,meanCashUSD:d.reduce((s,r)=>s+r.cashUSD,0)/d.length,inventoryRatio:summary[arm].terminalInventoryUSD/summary[base].terminalInventoryUSD,merchantDeltas:Object.fromEntries(Object.keys(rs[0].merchantContributions).map(id=>[id,rs.reduce((s,r)=>s+r.merchantContributions[id]-rows.find(b=>b.arm===base&&b.case===r.case).merchantContributions[id],0)/rs.length])),paired:d};}}
 return {summary,differences};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)&&process.argv.includes('--development')){
 const root='docs/commerce-growth/roc-net-goal-1',dir=root+'/net-coordination-development-1';await mkdir(dir);
 const r=await coordinationResources(),core=JSON.parse(await readFile('docs/commerce-growth/development-1/protocol.json','utf8')),arms=['fixed','numerical','numerical_baskets','expert_baskets'],cases=Object.keys(CONTRACT.regimes).map((regime,i)=>({id:'D'+i,regime,seed:997610+i*2})),rows=[],programHashes={};
 const paths=['scripts/commerce-growth/autonomy/net-coordination.mjs','scripts/commerce-growth/team/runner.mjs','scripts/commerce-growth/team/control.mjs','scripts/commerce-growth/experiments/program.mjs','scripts/commerce-growth/experiments/baskets.mjs','scripts/commerce-growth/autonomy/team-workbench-tools.mjs','scripts/commerce-growth/autonomy/features.mjs'];
 await mkdir(dir+'/source');for(const p of paths){programHashes[p]=createHash('sha256').update(await readFile(p)).digest('hex');await copyFile(p,dir+'/source/'+p.replaceAll('/','--'));}
 const verify=async()=>{for(const [p,h]of Object.entries({...core.sourceHashes,...programHashes}))if(createHash('sha256').update(await readFile(p)).digest('hex')!==h)throw Error('FROZEN_SOURCE_CHANGED: '+p);};
 const save=(name,value)=>writeFile(dir+'/'+name,JSON.stringify(value,null,2)+'\n');
 await save('protocol.json',{registeredAt:new Date().toISOString(),cases,arms,economyHashes:core.sourceHashes,programHashes,programHash:r.balanced.hash,modelHashes:{incumbent:r.incumbent.modelHash,expert:r.expert.modelHash},source:'DEVELOPMENT_ON_PREVIOUSLY_OPENED_MARKETS',actor:'Development assistant connected existing tools; no application model decisions in this probe.',primary:'Settled modeled PayPal contribution; require aggregate retailer and partner cash protection and closing inventory <=110% fixed. Report every merchant. No fresh-confirmation or LLM-value claim.'});
 const allocator=openAllocator();try{for(const c of cases){let base;for(const arm of arms){await verify();const result=await runCoordination(c,arm,r,allocator);base??=result;for(const k of ['initialHash','opportunityHash','consentHash','incomeCents'])if(result[k]!==base[k])throw Error('UNPAIRED_COORDINATION_CASE');rows.push({case:c.id,arm,...result});await save('rows.json',{rows});console.log(JSON.stringify({case:c.id,arm,net:result.platformUSD,retailer:result.retailerUSD,purchases:result.retainedPurchases}));}}
  await verify();const report={status:'COMPLETED',...summarizeCoordination(rows,arms),newProviderCalls:0,modelCostUSD:0,nativePayments:0,economyUnchanged:true};await save('results.json',report);console.log(JSON.stringify({status:report.status,comparisons:Object.fromEntries(Object.entries(report.differences).map(([a,d])=>[a,Object.fromEntries(Object.entries(d).map(([b,v])=>[b,{net:v.meanNetUSD,retailer:v.meanRetailerUSD,cash:v.meanCashUSD,inventoryRatio:v.inventoryRatio}]))]))}));
 }catch(e){await save('failure.json',{error:e.message,completedRows:rows.length});throw e;}finally{allocator.close();}
}
