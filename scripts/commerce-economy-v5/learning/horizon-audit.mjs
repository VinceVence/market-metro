// Check a predeclared annual horizon and two budget conventions. These are
// separate diagnostic economies, not a replacement for failed100-day results.
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {CASES,SETTINGS} from '../runner.mjs';
import {hash,mean} from '../../commerce-design-v2/evaluate.mjs';
import {simulateController,violation,METRICS} from './evaluation.mjs';
import {compileExpert} from './experts.mjs';
import {loadActionModels} from './action-policy.mjs';
const dir='docs/commerce-economy-v5/annual-audit-1';await mkdir(dir,{recursive:true});if(await access(dir+'/protocol.json').then(()=>true,()=>false))throw Error('ANNUAL_PROTOCOL_EXISTS');
const prior=JSON.parse(await readFile('docs/commerce-economy-v5/agent-revision-2/protocol.json','utf8')),artifact=await loadActionModels(),cases=[CASES[0],CASES[2],CASES[5]];
const regimes=[{id:'100_days_50USD',days:100,budgetCents:5000},{id:'365_days_50USD',days:365,budgetCents:5000},{id:'365_days_equal_daily_budget',days:365,budgetCents:Math.round(5000*(365-30)/(100-30))}],experts=['incumbent','catalog_rotation','adjacent_bundle'];
const files=['engine.mjs','operations.mjs','network.mjs','policies.mjs','learning/evaluation.mjs','learning/experts.mjs','learning/action-policy.mjs','learning/discovery-policy.mjs','learning/horizon-audit.mjs'].map(f=>'scripts/commerce-economy-v5/'+f);
const protocol={createdAt:new Date().toISOString(),cases,regimes,experts,baseline:prior.reference,candidate:prior.incumbent,hashes:Object.fromEntries(await Promise.all(files.map(async f=>[f,hash(await readFile(f,'utf8'))]))),scope:'Predeclared100-day and365-day development audit; never search a horizon until a desired ratio appears. Every regime gives all arms identical wallets, economic rules, budget and return followup. The annual variants retain either the same50USD marketing cap or the same daily budget. LLM spend is separate and unchanged. Inventory reduction stays30days before the announced campaign horizon. The learned action model retains its original day77 coverage gate; subsequent behavior uses its documented fallback. No final test and no target achievement claim.'};protocol.hash=hash(protocol);await writeFile(dir+'/protocol.json',JSON.stringify(protocol,null,2));
for(const f of files){const target=dir+'/source/'+f;await mkdir(target.slice(0,target.lastIndexOf('/')),{recursive:true});await writeFile(target,await readFile(f));}
const rows=[];for(const regime of regimes)for(const c of cases){const settings={...SETTINGS,days:regime.days,campaignStop:regime.days-10,budgetCents:regime.budgetCents},business=structuredClone(prior.incumbent);business.cashSchedule.day=regime.days-30;
 const fixed=simulateController(c,prior.reference,artifact,{settings}),arms={};
 const paymentOnly=structuredClone(prior.reference);paymentOnly.business.economics.merchantRail='paypal';paymentOnly.business.economics.supplierRail='paypal';arms.fixed_payment_only=simulateController(c,paymentOnly,artifact,{settings});
 for(const e of experts)arms[e]=simulateController(c,business,artifact,{settings,policyFactory:w=>compileExpert(w,artifact,business,e)});
 rows.push({regime:regime.id,...c,fixed,arms});await writeFile(dir+'/results.json',JSON.stringify({protocolHash:protocol.hash,rows,completed:rows.length===regimes.length*cases.length,targetAchieved:false,newPaidCalls:0},null,2));console.log(JSON.stringify({regime:regime.id,scenario:c.scenario,ratios:Object.fromEntries(Object.entries(arms).map(([key,r])=>[key,{ratio:r.platformUSD/fixed.platformUSD,violation:violation(r,fixed)}]))}));
}
const avg=xs=>Object.fromEntries(METRICS.map(k=>[k,mean(xs.map(r=>r[k]))]));
const summary=regimes.map(g=>{const rs=rows.filter(r=>r.regime===g.id),fixed=avg(rs.map(r=>r.fixed));return {...g,fixed,arms:Object.fromEntries(['fixed_payment_only',...experts].map(key=>{const metrics=avg(rs.map(r=>r.arms[key]));return [key,{metrics,ratio:metrics.platformUSD/fixed.platformUSD,violation:violation(metrics,fixed)}];}))};});
await writeFile(dir+'/summary.json',JSON.stringify({protocolHash:protocol.hash,summary,targetAchieved:false,scope:protocol.scope},null,2));
