// Evaluator-only: an optimistic reachability mask, never an actor input.
import {readFile,writeFile} from 'node:fs/promises';
import {warmGrowthWorld} from './evaluate.mjs';
import {GROWTH_REGIMES} from './environment.mjs';
const root='docs/commerce-growth/headroom-bound-1',inputs=JSON.parse(await readFile(root+'/inputs.json','utf8')),rows=[];
for(const c of inputs.cases){
 const w=warmGrowthWorld({seed:c.seed,regime:c.scenario}),regime=GROWTH_REGIMES[c.scenario];
 for(const request of c.requests){
  const need=w.growth.needs.find(n=>n.request.id===request.id),profile=w.growth.profiles.find(p=>p.id===request.customerId);
  if(!need||!profile)throw Error('UNKNOWN_NEED_IN_BOUND');
  const earliest=Math.max(30,request.createdDay),latest=Math.min(w.settings.days-1,request.latestCaptureDay,(profile.revokedDay??Infinity)-1);
  const reachable=need.organic||need.state==='EXPOSED'||profile.optedIn&&earliest<=latest&&need.responseDraw<regime.responseProbability;
  rows.push({key:c.seed+':gross:'+request.id,reachable,needsContact:!need.organic&&need.state!=='EXPOSED',reason:reachable?'Optimistically accessible':'No consent, response, or contact window'});
 }
}
await writeFile(root+'/reachability.json',JSON.stringify({source:'EVALUATOR_ONLY_NOT_AGENT_INPUT',rows},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({requests:rows.length,optimisticallyReachable:rows.filter(r=>r.reachable).length}));
