// Development-only hindsight diagnostic. This is NOT an executable agent or a
// mathematical upper bound. Test labels are never opened or used for routing.
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {CASES,SETTINGS} from '../runner.mjs';
import {hash,mean} from '../../commerce-design-v2/evaluate.mjs';
import {simulateController,violation,METRICS} from './evaluation.mjs';
import {EXPERTS,compileExpert} from './experts.mjs';
import {loadActionModels} from './action-policy.mjs';
const dir='docs/commerce-economy-v5/expert-headroom-1';await mkdir(dir,{recursive:true});if(await access(dir+'/protocol.json').then(()=>true,()=>false))throw Error('HEADROOM_PROTOCOL_EXISTS');
const prior=JSON.parse(await readFile('docs/commerce-economy-v5/agent-revision-2/protocol.json','utf8')),artifact=await loadActionModels();
const files=['engine.mjs','operations.mjs','network.mjs','policies.mjs','learning/action-policy.mjs','learning/discovery-policy.mjs','learning/evaluation.mjs','learning/experts.mjs','learning/expert-headroom.mjs'].map(f=>'scripts/commerce-economy-v5/'+f);
const protocol={createdAt:new Date().toISOString(),cases:CASES,settings:SETTINGS,experts:EXPERTS,reference:prior.reference,businessController:prior.incumbent,hashes:Object.fromEntries(await Promise.all(files.map(async f=>[f,hash(await readFile(f,'utf8'))]))),scope:'Development-only capability diagnostic. Freeze9 strategies before evaluation. Evaluate each on the same6 historical development worlds. A hindsight selector then chooses a strategy using observed final per-customer outcomes and reruns that mixture. This selector uses future outcomes and is forbidden for deployment; it is not a rigorous upper bound. Its purpose is to decide whether further public-feature learning has plausible headroom. No new validation or test seeds, model APIs, native payments or simulator modifications.'};protocol.hash=hash(protocol);await writeFile(dir+'/protocol.json',JSON.stringify(protocol,null,2));
for(const f of files){const to=dir+'/source/'+f;await mkdir(to.slice(0,to.lastIndexOf('/')),{recursive:true});await writeFile(to,await readFile(f));}
const results=[];for(const c of CASES){
 const fixed=simulateController(c,prior.reference,artifact,{customerOutcomes:true}),arms={};
 for(const expert of EXPERTS){arms[expert]=simulateController(c,prior.incumbent,artifact,{customerOutcomes:true,policyFactory:w=>compileExpert(w,artifact,prior.incumbent,expert)});}
 const selection={};for(const u of fixed.customerOutcomes){const options=EXPERTS.map(name=>({name,row:arms[name].customerOutcomes.find(r=>r.index===u.index)}));const eligible=options.filter(x=>x.row.retailerCents>=u.retailerCents);selection[u.index]=(eligible.length?eligible:options).sort((a,b)=>b.row.platformCents-a.row.platformCents)[0].name;}
 const oracle=simulateController(c,prior.incumbent,artifact,{customerOutcomes:true,policyFactory:w=>{const policies=Object.fromEntries(EXPERTS.map(e=>[e,compileExpert(w,artifact,prior.incumbent,e)]));return input=>policies[selection[input.customer.index]](input);}});
 const row={...c,fixed,arms,oracle,oracleSelection:selection,oracleRatio:oracle.platformUSD/fixed.platformUSD,oracleViolation:violation(oracle,fixed)};results.push(row);await writeFile(dir+'/results.json',JSON.stringify({protocolHash:protocol.hash,results,completed:results.length===CASES.length,targetAchieved:false,newPaidCalls:0},null,2));console.log(JSON.stringify({scenario:c.scenario,ratios:Object.fromEntries(EXPERTS.map(e=>[e,arms[e].platformUSD/fixed.platformUSD])),oracleRatio:row.oracleRatio,oracleViolation:row.oracleViolation}));
}
const average=rows=>Object.fromEntries([...METRICS,'retainedCents'].map(k=>[k,mean(rows.map(r=>r[k]))]));const fixed=average(results.map(r=>r.fixed)),oracle=average(results.map(r=>r.oracle)),arms=Object.fromEntries(EXPERTS.map(e=>[e,average(results.map(r=>r.arms[e]))]));
await writeFile(dir+'/summary.json',JSON.stringify({protocolHash:protocol.hash,fixed,oracle,arms,oracleRatio:oracle.platformUSD/fixed.platformUSD,oracleViolation:violation(oracle,fixed),targetAchieved:false,noAgentSuccessClaim:true,scope:protocol.scope},null,2));
