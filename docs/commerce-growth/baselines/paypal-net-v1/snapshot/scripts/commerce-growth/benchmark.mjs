import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CONTRACT} from './environment.mjs';
import {GROWTH_POLICIES} from './policies.mjs';
import {runGrowthCase} from './evaluate.mjs';
const dir='docs/commerce-growth/development-1',hash=x=>createHash('sha256').update(x).digest('hex');
await mkdir(dir);const save=(n,v)=>writeFile(dir+'/'+n,JSON.stringify(v,null,2)+'\n');
const files=['docs/commerce-growth/contract.json','scripts/commerce-growth/kernel.mjs','scripts/commerce-growth/environment.mjs','scripts/commerce-growth/policies.mjs','scripts/commerce-growth/evaluate.mjs','scripts/commerce-growth/benchmark.mjs','scripts/commerce-deadlines/environment.mjs','scripts/commerce-deadlines/suppliers.mjs','scripts/commerce-deadlines/policies.mjs','scripts/commerce-deadlines/evaluate.mjs','scripts/behavior-v4/catalog.mjs','scripts/marketing/economy.mjs'];
const sourceHashes=Object.fromEntries(await Promise.all(files.map(async f=>[f,hash(await readFile(f))])));
if(sourceHashes['scripts/commerce-deadlines/environment.mjs']!==CONTRACT.kernelSourceHash)throw Error('ORIGINAL_KERNEL_CHANGED');
const cases=Object.entries(CONTRACT.developmentSeeds).map(([regime,seed])=>({regime,seed})),protocol={createdAt:new Date().toISOString(),version:CONTRACT.version,contract:CONTRACT,cases,policies:GROWTH_POLICIES,sourceHashes,
 scope:'Seven equally weighted development regimes. Rebuilt no-outreach, four outreach-aware fixed baselines and one observed-data Bayesian workflow. Every arm has identical latent needs, consent, funding, catalog, costs, limits and shared warmup. Fixed-fast commerce fulfillment is common to isolate marketing discovery. No final holdout opened, no LLM call and no native payment.',
 selection:'Choose highest mean settled platform net among solvent fixed workflows. Require2x and nonnegative retailer, wholesaler, manufacturer and terminal cash changes, <=110% terminal inventory, no unpaid liabilities, preserved per-retailer contribution, and a valid financial bound before any paid agent trial. More fulfillment-rule comparisons are required before a successful candidate can be promoted to held-out testing.'};
await save('protocol.json',protocol);
for(const f of files){const dest=dir+'/source/'+f;await mkdir(dest.slice(0,dest.lastIndexOf('/')),{recursive:true});await writeFile(dest,await readFile(f));}
const rows=[];let example=null;
try{
 for(const settings of cases)for(const policy of GROWTH_POLICIES){
  const result=await runGrowthCase(settings,policy,{trace:policy.mode==='bayesian'}),{trace,...row}=result;rows.push(row);
  if(trace&&!example){
   const requestById=new Map(trace.requests.map(r=>[r.id,r])),order=trace.orders.find(o=>o.day>=30&&!o.refundStatus&&requestById.get(o.requestId)?.contactId);
   if(order){const request=requestById.get(order.requestId),contact=trace.contacts.find(c=>c.id===request.contactId),decision=trace.decisions.find(d=>d.day===contact.day);example={regime:settings.regime,seed:settings.seed,policy:policy.id,contact,request,decision,order,delivery:trace.deliveries.find(d=>d.orderId===order.id),ledger:trace.ledger.filter(e=>e.reference===order.id||e.reference===contact.id||e.reference===request.id),scope:'First recorded retained outreach purchase; explanatory trace, not a selected performance case or native receipt.'};}
  }
  await save('rows.json',{rows});
  console.log(JSON.stringify({regime:settings.regime,policy:policy.id,platform:row.platformUSD,retailer:row.retailerUSD,contacts:row.contactCount,fundedResponses:row.fundedResponses,recommendedPurchases:row.recommendationPurchases,liabilities:row.unpaidLiabilities,ms:row.reliability.totalWallMs}));
 }
 for(const c of cases){const group=rows.filter(r=>r.seed===c.seed);for(const k of ['initialHash','opportunityHash','consentHash','incomeCents'])if(new Set(group.map(r=>r[k])).size!==1)throw Error('UNMATCHED_GROWTH_CASE_'+k);}
 for(const [f,h]of Object.entries(sourceHashes))if(hash(await readFile(f))!==h)throw Error('FROZEN_GROWTH_SOURCE_CHANGED');
 const keys=['platformUSD','retailerUSD','wholesalerUSD','manufacturerUSD','allPartnerUSD','terminalCashUSD','terminalInventoryUSD','purchases','retainedPurchases','retainedVolumeUSD','fulfilledRequests','contactCount','recommendationsSent','fundedResponses','attributedPurchases','recommendationPurchases','outreachCostUSD','outsidePurchases','unpaidLiabilities'];
 const summary=GROWTH_POLICIES.map(p=>{const group=rows.filter(r=>r.policy===p.id);return {policy:p,mean:Object.fromEntries(keys.map(k=>[k,group.reduce((s,r)=>s+r[k],0)/group.length])),retailers:Object.fromEntries(Object.keys(group[0].merchantContributions).map(k=>[k,group.reduce((s,r)=>s+r.merchantContributions[k],0)/group.length])),reliability:{invariantsPassed:group.every(r=>r.reliability.invariantsPassed),p95DecisionMs:group.reduce((s,r)=>s+r.reliability.p95DecisionMs,0)/group.length,posteriorUpdates:group.reduce((s,r)=>s+r.reliability.learnedPosteriorUpdates,0)}};});
 const reference=summary.filter(r=>r.policy.mode!=='bayesian'&&r.mean.unpaidLiabilities===0).sort((a,b)=>b.mean.platformUSD-a.mean.platformUSD)[0];
 if(!reference)throw Error('NO_SOLVENT_FIXED_REFERENCE');
 const learned=summary.find(r=>r.policy.mode==='bayesian'),ratio=learned.mean.platformUSD/reference.mean.platformUSD,
 gates={platform2x:ratio>=2,retailer:learned.mean.retailerUSD>=reference.mean.retailerUSD,
 wholesaler:learned.mean.wholesalerUSD>=reference.mean.wholesalerUSD,manufacturer:learned.mean.manufacturerUSD>=reference.mean.manufacturerUSD,
 individualRetailers:Object.keys(reference.retailers).every(id=>learned.retailers[id]>=reference.retailers[id]),
 terminalCash:learned.mean.terminalCashUSD>=reference.mean.terminalCashUSD,inventory:learned.mean.terminalInventoryUSD<=reference.mean.terminalInventoryUSD*1.1,
 noUnpaidLiabilities:learned.mean.unpaidLiabilities===0};
 await save('example.json',example);await save('results.json',{status:'COMPLETED',reference:reference.policy.id,ratio,summary,gates,advanceToPaidAgents:false,
  reason:'A bound and sufficient observed-only headroom are required before model spending; this is a numerical baseline audit.',targetAchieved:false,newModelCalls:0,nativePaymentCalls:0,heldOutOpened:false});
 console.log(JSON.stringify({status:'COMPLETED',reference:reference.policy.id,ratio,gates,newModelCalls:0}));
}catch(error){await save('failure.json',{error:error.message,completedRows:rows.length});throw error;}
