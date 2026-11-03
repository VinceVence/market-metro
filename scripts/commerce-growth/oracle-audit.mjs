// EVALUATOR ONLY. Gives outreach selection hidden need and response information.
// This is NOT an agent, a deployable policy or evidence of learned performance.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createGrowthWorld,GROWTH_REGIMES,GROWTH_RULES} from './environment.mjs';
import {runGrowthCase} from './evaluate.mjs';
const dir='docs/commerce-growth/oracle-audit-1';await mkdir(dir);
const protocol=JSON.parse(await readFile('docs/commerce-growth/development-1/protocol.json','utf8')),
 baseline=JSON.parse(await readFile('docs/commerce-growth/development-1/results.json','utf8')),rows=[];
await writeFile(dir+'/protocol.json',JSON.stringify({source:'EVALUATOR_ONLY_PRIVATE_INFORMATION',cases:protocol.cases,
 scope:'One diagnostic: perfect knowledge of currently active hidden needs and response draws. Every contact still uses consent, funding, quota and procurement checks. Fulfillment remains the common fixed-fast workflow. Not an upper bound, not a deployment candidate, no final held-out evaluation or paid model calls.'},null,2)+'\n');
for(const settings of protocol.cases){
 const truth=createGrowthWorld(settings),regime=GROWTH_REGIMES[settings.regime];
 const controller={async plan(view){
  const seen=new Set(view.outreach.history.filter(c=>c.requestId).map(c=>c.requestId)),choices=[];
  for(const person of view.audience){
   if(!person.marketingConsent||person.hasOpenRequest||person.lastContactDay!=null&&view.day-person.lastContactDay<GROWTH_RULES.customerContactGapDays)continue;
   const pending=truth.growth.needs.filter(n=>!n.organic&&!seen.has(n.request.id)&&n.request.customerId===person.customerId&&n.request.createdDay<=view.day&&n.request.deadlineDay>=view.day+2).sort((a,b)=>a.request.deadlineDay-b.request.deadlineDay);
   for(const p of truth.catalog){
    const need=pending.find(n=>n.request.lines.some(l=>l.acceptableCatalogIds.includes(p.id)));
    if(!need||need.responseDraw>=regime.responseProbability)continue;
    choices.push({customerId:person.customerId,kind:'recommend',category:p.category,catalogId:p.id,
     value:need.request.budgetCents,deadline:need.request.deadlineDay});
   }
  }
  choices.sort((a,b)=>a.deadline-b.deadline||b.value-a.value||a.customerId.localeCompare(b.customerId));
  const limit=view.day>=30&&view.day<view.marketDays?Math.min(GROWTH_RULES.dailyContactLimit,Math.floor(Math.min(view.outreach.remainingBudgetCents,view.outreach.availablePlatformCashCents)/GROWTH_RULES.outreachCostCents)):0;
  const actions=[],customers=new Set();for(const c of choices){if(actions.length>=limit)break;if(customers.has(c.customerId))continue;customers.add(c.customerId);const {value,deadline,...action}=c;actions.push(action);}
  return {actions,reason:'Evaluator-only perfect-information contact choice; not an application agent.'};
 }};
 const result=await runGrowthCase(settings,{id:'oracle_current_need',mode:'evaluator'},{controller});rows.push(result);
 console.log(JSON.stringify({regime:settings.regime,platformUSD:result.platformUSD,contacts:result.contactCount,retained:result.retainedPurchases}));
 await writeFile(dir+'/rows.json',JSON.stringify({rows},null,2)+'\n');
}
const reference=baseline.summary.find(r=>r.policy.id===baseline.reference),mean=rows.reduce((s,r)=>s+r.platformUSD,0)/rows.length;
const result={source:'EVALUATOR_ONLY_PRIVATE_INFORMATION',meanPlatformUSD:mean,ratioToFixed:mean/reference.mean.platformUSD,
 goalAchieved:false,deploymentAllowed:false,newModelCalls:0,nativePaymentCalls:0,
 scope:'Feasible hidden-information contact diagnostic with fixed-fast fulfillment. This is neither an upper bound nor an observed-only policy and cannot pass the agent advancement gate.'};
await writeFile(dir+'/results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
