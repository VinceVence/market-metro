import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CONTRACT} from '../environment.mjs';
import {FIXED_CONTROLS,NUMERICAL_CONTROL} from './control.mjs';
import {runCoordinatedCase} from './runner.mjs';
import {openAllocator} from '../../commerce-deadlines/solver.mjs';
const root='docs/commerce-growth/team-1',dir=root+'/development';await mkdir(dir);
const prior=JSON.parse(await readFile(root+'/training/model.json','utf8')),old=JSON.parse(await readFile('docs/commerce-growth/development-1/protocol.json','utf8'));
for(const [file,expected]of Object.entries(old.sourceHashes))if(createHash('sha256').update(await readFile(file)).digest('hex')!==expected)throw Error('FROZEN_ECONOMY_CHANGED');
const cases=Object.entries(CONTRACT.developmentSeeds).map(([regime,seed])=>({regime,seed})),policies=[...FIXED_CONTROLS,NUMERICAL_CONTROL],rows=[],allocator=openAllocator();
await writeFile(dir+'/protocol.json',JSON.stringify({createdAt:new Date().toISOString(),cases,policies,priorHash:createHash('sha256').update(JSON.stringify(prior)).digest('hex'),scope:'Controller and tool changes only. Original growth economy and all historical results retained. Stronger fixed workflows get the same joint fulfillment tools. No model calls or unseen seeds in this development selection.'},null,2)+'\n');
try{
 for(const settings of cases)for(const policy of policies){const result=await runCoordinatedCase(settings,policy,{allocator,prior});rows.push(result);await writeFile(dir+'/rows.json',JSON.stringify({rows},null,2)+'\n');console.log(JSON.stringify({regime:settings.regime,policy:policy.id,platform:result.platformUSD,retailer:result.retailerUSD,purchases:result.retainedPurchases}));}
 const keys=['platformUSD','retailerUSD','wholesalerUSD','manufacturerUSD','allPartnerUSD','terminalCashUSD','terminalInventoryUSD','recommendationPurchases','retainedPurchases','unpaidLiabilities'];
 const summary=policies.map(policy=>{const group=rows.filter(r=>r.policy===policy.id);return {policy,mean:Object.fromEntries(keys.map(k=>[k,group.reduce((s,r)=>s+r[k],0)/group.length]))};});
 const fixed=summary.filter(s=>s.policy.id!=='local_calibrated'&&s.mean.unpaidLiabilities===0).sort((a,b)=>b.mean.platformUSD-a.mean.platformUSD)[0];
 if(!fixed)throw Error('NO_SOLVENT_FIXED_CONTROL');
 const output={status:'COMPLETED',summary,selectedFixed:fixed.policy,numerical:NUMERICAL_CONTROL,newModelCalls:0};await writeFile(dir+'/results.json',JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output));
}finally{allocator.close();}
