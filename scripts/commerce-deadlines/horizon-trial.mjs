// One frozen candidate, all six existing development markets. This is a local
// coordination ablation, not a new held-out claim and not a paid agent trial.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {HORIZON_CONTRACT,openHorizonPlanner} from './horizon.mjs';
import {FIXED_POLICIES,runDeadlineCase} from './evaluate.mjs';
const trial=process.argv[2]||'horizon-trial-1';if(!/^horizon-trial-\d+$/.test(trial))throw Error('INVALID_TRIAL_NAME');
const dir='docs/commerce-deadlines/'+trial,hash=x=>createHash('sha256').update(x).digest('hex');
await mkdir(dir);const save=(name,value)=>writeFile(dir+'/'+name,JSON.stringify(value,null,2)+'\n');
const original=JSON.parse(await readFile('docs/commerce-deadlines/development-1/protocol.json','utf8')),
 oldRows=JSON.parse(await readFile('docs/commerce-deadlines/development-1/rows.json','utf8')).rows;
const sourceFiles=['environment.mjs','suppliers.mjs','policies.mjs','evaluate.mjs','horizon.mjs','horizon-worker.py','horizon-trial.mjs'].map(f=>'scripts/commerce-deadlines/'+f);
const sourceHashes=Object.fromEntries(await Promise.all(sourceFiles.map(async f=>[f,hash(await readFile(f))])));
const protocol={createdAt:new Date().toISOString(),cases:original.cases,contract:HORIZON_CONTRACT,reference:'fixed_fast',sourceHashes,
 scope:'Single predeclared numerical controller using only current public observations. Same frozen buyers, funding, fees, request streams, deadlines and fulfillment as the48-run development audit. Same rolling Gamma-Poisson model and basket generator; the new tool jointly schedules known funded baskets and procurement over10 days. Future forecasts are not future facts. All monetary/stock changes pass an atomic trusted execution gate.',
 goals:{platformRatio:2,merchantContribution:'preserve',supplierContribution:'preserve',terminalCash:'preserve',inventoryMaxRatio:1.1},
 advancement:'This cannot prove2x where a valid upper bound is lower. No new paid model calls; measure coordination improvements and retain failures. No final held-out markets opened.',source:'NUMERICAL_NOT_LLM',newModelCalls:0,nativePaymentCalls:0};
await save('protocol.json',protocol);
for(const f of sourceFiles){const target=dir+'/source/'+f;await mkdir(target.slice(0,target.lastIndexOf('/')),{recursive:true});await writeFile(target,await readFile(f));}
const controller=openHorizonPlanner(),rows=[];let example=null;
try{
 for(const c of protocol.cases){
  const fixed=await runDeadlineCase(c,FIXED_POLICIES.find(p=>p.id==='fixed_fast'));
  const old=oldRows.find(r=>r.seed===c.seed&&r.policy==='fixed_fast');
  for(const k of ['platformUSD','retailerUSD','wholesalerUSD','manufacturerUSD','terminalCashUSD','terminalInventoryUSD','initialHash','requestStreamHash'])if(fixed[k]!==old[k])throw Error('BASELINE_CHANGED_'+k);
  rows.push(fixed);
  const next=await runDeadlineCase(c,{id:HORIZON_CONTRACT.id},{controller,trace:true});
  if(next.initialHash!==fixed.initialHash||next.requestStreamHash!==fixed.requestStreamHash||next.incomeCents!==fixed.incomeCents)throw Error('UNMATCHED_MARKET');
  if(!example){const decision=next.trace.decisions.find(d=>d.source===HORIZON_CONTRACT.source&&d.future.length>0&&d.captured>0);if(decision)example={case:c,decision,following:next.trace.decisions.filter(d=>d.day>decision.day&&d.day<=decision.day+7).map(d=>({day:d.day,captured:d.captured,procuredUnits:d.procuredUnits,source:d.source})),scheduledRequestOutcomes:decision.future.map(q=>({requestId:q.requestId,plannedCaptureDay:q.captureDay,actualOrder:next.trace.orders.find(o=>o.requestId===q.requestId)||null}))};}
  const {trace,...row}=next;rows.push(row);await save('rows.json',{rows});
  console.log(JSON.stringify({scenario:c.scenario,fixed:fixed.platformUSD,horizon:row.platformUSD,ratio:row.platformUSD/fixed.platformUSD,retailerDelta:row.retailerUSD-fixed.retailerUSD,unpaidLiabilities:row.unpaidLiabilities,wallMs:row.reliability.totalWallMs}));
 }
 for(const [f,h]of Object.entries(sourceHashes))if(hash(await readFile(f))!==h)throw Error('FROZEN_CONTROLLER_CHANGED');
 const keys=['platformUSD','retailerUSD','wholesalerUSD','manufacturerUSD','allPartnerUSD','terminalCashUSD','terminalInventoryUSD','fulfilledRequests','retainedRequests','retainedVolumeUSD','unpaidLiabilities'];
 const summary=['fixed_fast',HORIZON_CONTRACT.id].map(policy=>{const group=rows.filter(r=>r.policy===policy);return {policy,mean:Object.fromEntries(keys.map(k=>[k,group.reduce((s,r)=>s+r[k],0)/group.length])),reliability:{invariantsPassed:group.every(r=>r.reliability.invariantsPassed),solverNonoptimal:group.reduce((s,r)=>s+r.reliability.solverNonoptimal,0),meanP95DecisionMs:group.reduce((s,r)=>s+r.reliability.p95DecisionMs,0)/group.length}};});
 const [fixed,joint]=summary,ratio=joint.mean.platformUSD/fixed.mean.platformUSD;
 const gates={platform2x:ratio>=2,retailer:joint.mean.retailerUSD>=fixed.mean.retailerUSD,wholesaler:joint.mean.wholesalerUSD>=fixed.mean.wholesalerUSD,manufacturer:joint.mean.manufacturerUSD>=fixed.mean.manufacturerUSD,terminalCash:joint.mean.terminalCashUSD>=fixed.mean.terminalCashUSD,inventory:joint.mean.terminalInventoryUSD<=fixed.mean.terminalInventoryUSD*1.1,noUnpaidLiabilities:joint.mean.unpaidLiabilities===0};
 await save('example.json',example);await save('results.json',{status:'COMPLETED',ratio,summary,gates,advanceToValidation:Object.values(gates).every(Boolean),targetAchieved:false,newModelCalls:0,nativePaymentCalls:0,source:'NUMERICAL_NOT_LLM',baselineReproducedExactly:true});
 console.log(JSON.stringify({status:'COMPLETED',ratio,gates,newModelCalls:0}));
}catch(e){await save('failure.json',{error:e.message,completedRows:rows.length});throw e;}finally{controller.close();}
