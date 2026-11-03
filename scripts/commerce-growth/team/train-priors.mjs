// Fit only from observed, matured development contacts. No private need labels.
import {mkdir,writeFile} from 'node:fs/promises';
import {CONTRACT,digest} from '../environment.mjs';
import {GROWTH_POLICIES} from '../policies.mjs';
import {runGrowthCase} from '../evaluate.mjs';
const dir='docs/commerce-growth/team-1/training';await mkdir(dir);const groups={},rows=[];
for(const [regime,seed]of Object.entries(CONTRACT.developmentSeeds))for(const name of ['fixed_coverage','fixed_rfm','fixed_stock']){
 const result=await runGrowthCase({regime,seed},GROWTH_POLICIES.find(p=>p.id===name),{trace:true});
 for(const c of result.trace.contacts){
  const order=result.trace.orders.find(o=>o.requestId===c.requestId),retained=!!order&&!['SETTLED','PENDING_FUNDS'].includes(order.refundStatus),[,category,freshness,relationship]=c.observedBucket.split('|'),key=[c.kind,freshness].join('|');
  const g=groups[key]??={contacts:0,retained:0,grossCents:0,retailNetCents:0};g.contacts++;g.retained+=Number(retained);g.grossCents+=retained?order.grossCents:0;g.retailNetCents+=(order?(retained?order.feeCents:0)-order.processingCents:0)-c.costCents;
  rows.push({episode:seed,regime,sourcePolicy:name,kind:c.kind,category,freshness,relationship,retained,retailNetCents:(order?(retained?order.feeCents:0)-order.processingCents:0)-c.costCents});
 }
 console.log(JSON.stringify({regime,sourcePolicy:name,observedContacts:result.contactCount}));
}
const artifact={version:'pooled-observed-response-1',createdAt:new Date().toISOString(),groups,rows:rows.length,trainingEpisodes:Object.values(CONTRACT.developmentSeeds),
 source:'Observed contacts and matured order outcomes only; no oracle labels. Conditional association, not causal uplift.',rowHash:digest(rows)};
await writeFile(dir+'/observations.json',JSON.stringify(rows)+'\n');await writeFile(dir+'/model.json',JSON.stringify(artifact,null,2)+'\n');console.log(JSON.stringify(artifact));
