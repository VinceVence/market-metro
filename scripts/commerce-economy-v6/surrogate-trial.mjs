// Learning chooses the next experiment; deterministic accounting decides whether
// the result can advance. The incumbent and every failed trial stay in history.
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
import {CASES,SETTINGS} from '../commerce-economy-v5/runner.mjs';
import {hash,mean} from '../commerce-design-v2/evaluate.mjs';
import {draw} from '../marketing/economy.mjs';
import {simulateController,violation,METRICS} from './runner.mjs';
import {QUOTE_LIMITS} from './quotes.mjs';
import {compileExpert} from '../commerce-economy-v5/learning/experts.mjs';
import {loadActionModels} from '../commerce-economy-v5/learning/action-policy.mjs';
const dir='docs/commerce-economy-v6/surrogate-trial-1',BUDGET=12,POOL=384,categories=['Stationery','Electronics','Furniture','Office bundles'];
const read=p=>readFile(p,'utf8').then(JSON.parse);await mkdir(dir,{recursive:true});if(await access(dir+'/protocol.json').then(()=>true,()=>false))throw Error('SURROGATE_PROTOCOL_EXISTS');
const previous=await read('docs/commerce-economy-v6/quote-search-1/development.json'),fixed=await read('docs/commerce-economy-v6/quote-search-1/fixed.json'),reference=fixed.fixed.find(r=>r.id===fixed.reference),parent=previous.rows[0].config,artifact=await loadActionModels(),initial=[...fixed.fixed,...previous.rows];
const save=(n,x)=>writeFile(dir+'/'+n,JSON.stringify(x,null,2)+'\n');
const files=['engine.mjs','operations.mjs','quotes.mjs','runner.mjs','propose-probe.py','surrogate-trial.mjs'].map(f=>'scripts/commerce-economy-v6/'+f);
const protocol={createdAt:new Date().toISOString(),settings:SETTINGS,training:CASES,reference:reference.config,arms:['surrogate','random'],budgetPerArm:BUDGET,candidatePoolPerStep:POOL,searchSeed:901803,initialCandidateCount:initial.length,initialDataHash:hash(initial),goalCostUSD:.204728,hashes:Object.fromEntries(await Promise.all(files.map(async f=>[f,hash(await readFile(f,'utf8'))]))),scope:'Local tool comparison only, with matched12-trial budgets and shared candidate-pool random streams. Both arms start from the same30 prior observed configurations. Gaussian-process constrained expected improvement selects experiments under approximate conditional-independence assumptions; exact simulated accounting and all counterparties control promotion. No paid models, native payments, new buyer behaviors or physics changes. No holdout access unless2x and all financial gates pass.'};protocol.hash=hash(protocol);await save('protocol.json',protocol);
for(const f of files){const to=dir+'/source/'+f;await mkdir(to.slice(0,to.lastIndexOf('/')),{recursive:true});await writeFile(to,await readFile(f));}
const key=c=>{const copy=structuredClone(c);delete copy.id;return hash(copy);};
function generate(step,n){const c=structuredClone(parent),pick=(values,field)=>values[Math.floor(draw(protocol.searchSeed,step,n,field)*values.length)];delete c.id;
 c.quotePlan={byCategory:Object.fromEntries(categories.map((category,i)=>[category,pick(QUOTE_LIMITS.factors,'factor'+i)])),merchantAdjustPct:[0,1,2].map(i=>pick([-5,0,5],'merchant'+i))};
 c.business.economics.pricePct=[0,0,0];c.business.economics.merchantRail=pick(['bank','auto','paypal'],'merchantRail');c.business.economics.supplierRail=pick(['bank','auto','paypal'],'supplierRail');c.business.demand.stockDays=[0,1,2].map(i=>pick([7,14,28],'cover'+i));c.business.demand.useLostDemand=pick([false,true],'lost');c.expert=pick(['catalog_rotation','adjacent_bundle'],'campaign');if(pick([false,true],'trim'))c.cashSchedule={day:70,stockDays:[7,7,7]};else delete c.cashSchedule;return c;
}
function evaluate(c){const rows=CASES.map(m=>{const r=simulateController(m,c,artifact,{policyFactory:w=>compileExpert(w,artifact,c,c.expert)});return {...r,wholesalerUSD:r.commerce.network.wholesalerContributionCents/100,manufacturerUSD:r.commerce.network.manufacturerContributionCents/100};});const metrics=Object.fromEntries([...METRICS,'wholesalerUSD','manufacturerUSD'].map(k=>[k,mean(rows.map(r=>r[k]))]));return {id:c.id,config:c,rows,mean:metrics,ratio:(metrics.platformUSD-protocol.goalCostUSD)/reference.mean.platformUSD,violation:violation(metrics,reference.mean),partnerViolation:['retailerUSD','wholesalerUSD','manufacturerUSD'].reduce((s,k)=>s+Math.max(0,reference.mean[k]-metrics[k]),0)};}
const arms={};for(const arm of protocol.arms){const history=[...initial],seen=new Set(history.map(r=>key(r.config))),trials=[];
 for(let step=0;step<BUDGET;step++){
  const candidates=[],poolKeys=new Set();let attempt=0;while(candidates.length<POOL){const c=generate(step,attempt++),k=key(c);if(seen.has(k)||poolKeys.has(k))continue;poolKeys.add(k);candidates.push(c);}
  const input={history:history.map(r=>({config:r.config,mean:r.mean})),reference:reference.mean,candidates};await save(arm+'-input-'+step+'.json',input);let selection={selected:0,method:'First candidate in the shared random stream',runtimeSeconds:0};
  if(arm==='surrogate'){const output=resolve(dir,arm+'-selection-'+step+'.json');await promisify(execFile)(resolve('.local/marketing-venv/bin/python'),[resolve('scripts/commerce-economy-v6/propose-probe.py'),resolve(dir,arm+'-input-'+step+'.json'),output],{timeout:60000,maxBuffer:16384});selection=await read(output);}
  if(!Number.isInteger(selection.selected)||selection.selected<0||selection.selected>=candidates.length)throw Error('INVALID_SURROGATE_SELECTION');const c=candidates[selection.selected];c.id=arm+'-'+step;seen.add(key(c));
  await save(arm+'-checkpoint-'+step+'.json',{status:'SELECTED',protocolHash:protocol.hash,selection,config:c,evidenceCandidates:history.length,selectedAt:new Date().toISOString()});
  const trial=evaluate(c);trial.selection=selection;trials.push(trial);history.push(trial);await save(arm+'-checkpoint-'+step+'.json',{status:'EVALUATED',protocolHash:protocol.hash,selection,config:c,result:trial.mean,ratio:trial.ratio,violation:trial.violation,partnerViolation:trial.partnerViolation,completedAt:new Date().toISOString()});await save(arm+'.json',{protocolHash:protocol.hash,trials});console.log(JSON.stringify({arm,step,ratio:trial.ratio,violation:trial.violation,partnerViolation:trial.partnerViolation,selectorSeconds:selection.runtimeSeconds}));
 }
 arms[arm]={trials,bestFeasible:trials.filter(r=>r.violation===0&&r.partnerViolation===0).sort((a,b)=>b.ratio-a.ratio)[0]||null};
}
for(const [f,h]of Object.entries(protocol.hashes))if(hash(await readFile(f,'utf8'))!==h)throw Error('FROZEN_SURROGATE_SOURCE_CHANGED');
await save('results.json',{status:'COMPLETED',protocolHash:protocol.hash,reference,arms,advanceToValidation:Object.values(arms).some(a=>a.bestFeasible?.ratio>=2),validationOpened:false,targetAchieved:false,newPaidCalls:0});
