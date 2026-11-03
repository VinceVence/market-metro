import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {CASES,incumbent,SETTINGS} from '../runner.mjs';
import {loadActionModels} from './action-policy.mjs';
import {assess,violation} from './evaluation.mjs';
import {hash} from '../../commerce-design-v2/evaluate.mjs';
const dir='docs/commerce-economy-v5/liquidity-controller-1';await mkdir(dir,{recursive:true});
if(await access(dir+'/protocol.json').then(()=>true,()=>false))throw Error('LIQUIDITY_PROTOCOL_EXISTS');
const prior=JSON.parse(await readFile('docs/commerce-economy-v5/joint-controller-1/finalists.json','utf8')),artifact=await loadActionModels();
const configs=[prior.reference];
for(const selected of prior.finalists.slice(0,2))for(const day of [60,70,80])configs.push({...selected,id:selected.id+'-cash-'+day,cashSchedule:{day,stockDays:[7,7,7]}});
const base=prior.finalists[0];
for(const discovery of ['observed_price','observed_value','category_interest'])for(const intervalDays of [7,14,28])configs.push({...base,kind:'discovery',id:discovery+'-'+intervalDays,discovery,intervalDays,cashSchedule:{day:70,stockDays:[7,7,7]}});
// The fixed family receives the same newly exercised invitation choices. It
// retains fixed business settings so the commercial-controller gain is visible.
for(const discovery of ['observed_price','category_interest'])configs.push({id:'fixed-'+discovery,kind:'discovery',business:incumbent(),discovery,intervalDays:7,modelName:'ridge',thresholdCents:0});
const files=['engine.mjs','operations.mjs','network.mjs','policies.mjs','learning/features.mjs','learning/pair-features.mjs','learning/actions.mjs','learning/action-policy.mjs','learning/discovery-policy.mjs','learning/evaluation.mjs','learning/liquidity-trial.mjs'].map(f=>'scripts/commerce-economy-v5/'+f);
const protocol={createdAt:new Date().toISOString(),development:CASES,validation:CASES.map((c,i)=>({...c,seed:735200+i})),settings:SETTINGS,configs,designCostUSD:.140734,hashes:Object.fromEntries(await Promise.all(files.map(async f=>[f,hash(await readFile(f,'utf8'))]))),scope:'Controller-only test. Frozen economic rules. Cash schedule reduces planned cover in the final30 days of a known100-day campaign; this must be disclosed and is not evidence for an unlimited-horizon business. New invitation choices require observed interest and existing simulated consent. No API calls.',selection:'Select strongest financially feasible fixed comparator on development. Freeze3 feasible joint finalists before new validation. No test opening below2x after design cost and all four financial gates.'};protocol.hash=hash(protocol);
const save=(n,v)=>writeFile(dir+'/'+n,JSON.stringify(v,null,2)+'\n');await save('protocol.json',protocol);
for(const f of files){const target=dir+'/source/'+f;await mkdir(target.slice(0,target.lastIndexOf('/')),{recursive:true});await writeFile(target,await readFile(f));}
const rows=[];for(const c of configs){const r=assess(CASES,c,artifact);rows.push(r);console.log(JSON.stringify({phase:'development',id:r.id,ratio:r.mean.platformUSD/rows[0].mean.platformUSD,violation:violation(r.mean,rows[0].mean),metrics:r.mean}));await save('development.json',{protocolHash:protocol.hash,rows});}
const reference=rows.filter(r=>r.id.startsWith('fixed')&&violation(r.mean,rows[0].mean)<1e-8).sort((a,b)=>b.mean.platformUSD-a.mean.platformUSD)[0],finalists=rows.filter(r=>!r.id.startsWith('fixed')&&violation(r.mean,reference.mean)<1e-8).sort((a,b)=>b.mean.platformUSD-a.mean.platformUSD).slice(0,3);
await save('finalists.json',{at:new Date().toISOString(),protocolHash:protocol.hash,reference:reference.config,finalists:finalists.map(r=>r.config)});
for(const [f,h]of Object.entries(protocol.hashes))if(hash(await readFile(f,'utf8'))!==h)throw Error('FROZEN_SOURCE_CHANGED');
const validation=[reference.config,...finalists.map(r=>r.config)].map(c=>assess(protocol.validation,c,artifact));
for(const r of validation){r.violation=violation(r.mean,validation[0].mean);r.ratio=(r.mean.platformUSD-(r.id===reference.id?0:protocol.designCostUSD))/validation[0].mean.platformUSD;console.log(JSON.stringify({phase:'validation',id:r.id,ratio:r.ratio,violation:r.violation}));}
await save('results.json',{protocolHash:protocol.hash,status:'COMPLETED',validation,newPaidCalls:0,targetAchieved:false,advanceToHeldout:validation.slice(1).some(r=>r.violation<1e-8&&r.ratio>=2)});
