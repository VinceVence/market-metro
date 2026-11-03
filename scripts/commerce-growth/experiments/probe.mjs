import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CONTRACT,digest} from '../environment.mjs';
import {runProgramCase} from './runner.mjs';
import {compileProgram,SEED_PROGRAMS} from './program.mjs';
import {openAllocator} from '../../commerce-deadlines/solver.mjs';
const root='docs/commerce-growth/experiments-1',dir=root+'/local-probe';await mkdir(dir);
const prior=JSON.parse(await readFile('docs/commerce-growth/team-1/training/model.json','utf8')),core=JSON.parse(await readFile('docs/commerce-growth/development-1/protocol.json','utf8')),
 baseline=JSON.parse(await readFile('docs/commerce-growth/team-1/development/results.json','utf8')),reference=baseline.summary.find(s=>s.policy.id===baseline.selectedFixed.id),baselineRows=JSON.parse(await readFile('docs/commerce-growth/team-1/development/rows.json','utf8')).rows.filter(r=>r.policy===reference.policy.id);
for(const [file,h]of Object.entries(core.sourceHashes))if(createHash('sha256').update(await readFile(file)).digest('hex')!==h)throw Error('FROZEN_ECONOMY_CHANGED');
const cases=Object.entries(CONTRACT.developmentSeeds).map(([regime,seed])=>({regime,seed})),protocol={createdAt:new Date().toISOString(),cases,candidates:SEED_PROGRAMS,priorHash:digest(prior),economyHashes:core.sourceHashes,source:'DEVELOPMENT_SEED_PROGRAMS_NOT_APPLICATION_AGENT_OUTPUTS',
 scope:'Four development-authored executable hypotheses; same frozen needs and funds. Broader legal observed-feature contact, basket and per-product inventory decisions. No new response dynamics, prices, users or money. No paid or native calls. No final unseen claim.',
 scorecards:'Retain original financial/inventory guards; also report cash and contribution separately. Neither scorecard can be silently relabeled to promote a failure.'};
await writeFile(dir+'/protocol.json',JSON.stringify(protocol,null,2)+'\n');
const allocator=openAllocator(),rows=[];
try{
 for(const settings of cases)for(const candidate of SEED_PROGRAMS){const result=await runProgramCase(settings,candidate,{allocator,prior});const fixed=baselineRows.find(r=>r.seed===settings.seed);for(const k of ['initialHash','opportunityHash','consentHash','incomeCents'])if(result[k]!==fixed[k])throw Error('UNMATCHED_PROGRAM_CASE_'+k);rows.push(result);await writeFile(dir+'/rows.json',JSON.stringify({rows},null,2)+'\n');console.log(JSON.stringify({regime:settings.regime,program:candidate.id,platform:result.platformUSD,retailer:result.retailerUSD,cash:result.terminalCashUSD,inventory:result.terminalInventoryUSD,purchases:result.retainedPurchases,unpaid:result.unpaidLiabilities}));}
 const keys=['platformUSD','retailerUSD','wholesalerUSD','manufacturerUSD','allPartnerUSD','terminalCashUSD','terminalInventoryUSD','retainedPurchases','retainedVolumeUSD','recommendationPurchases','outreachCostUSD','unpaidLiabilities'];
 const summary=SEED_PROGRAMS.map(p=>{const group=rows.filter(r=>r.policy===p.id),mean=Object.fromEntries(keys.map(k=>[k,group.reduce((s,r)=>s+r[k],0)/group.length]));const merchantDeltas=Object.fromEntries(Object.keys(group[0].merchantContributions).map(id=>[id,group.reduce((s,r)=>s+r.merchantContributions[id],0)/group.length-baselineRows.reduce((s,r)=>s+r.merchantContributions[id],0)/baselineRows.length]));
  const cashContribution=Object.values(merchantDeltas).every(n=>n>=0)&&['retailerUSD','wholesalerUSD','manufacturerUSD','terminalCashUSD'].every(k=>mean[k]>=reference.mean[k])&&mean.unpaidLiabilities===0;
  return {id:p.id,hypothesis:p.hypothesis,programHash:compileProgram(p.program).hash,mean,ratio:mean.platformUSD/reference.mean.platformUSD,merchantDeltas,cashContributionPassed:cashContribution,originalInventoryPassed:mean.terminalInventoryUSD<=reference.mean.terminalInventoryUSD*1.1};});
 const result={status:'COMPLETED',reference,summary,goalAchieved:false,newModelCalls:0,nativePaymentCalls:0,heldOutOpened:false,
  sufficientCashProtectedHeadroom:summary.some(r=>r.ratio>=2&&r.cashContributionPassed),originalPromotionGate:summary.some(r=>r.ratio>=2&&r.cashContributionPassed&&r.originalInventoryPassed)};
 await writeFile(dir+'/results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}catch(error){await writeFile(dir+'/failure.json',JSON.stringify({error:error.message,completedRows:rows.length},null,2)+'\n');throw error;}finally{allocator.close();}
