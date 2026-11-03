import {readFile,writeFile} from 'node:fs/promises';
const read=p=>readFile(p,'utf8').then(JSON.parse),dir='docs/commerce-deadlines/horizon-trial-2';
const result=await read(dir+'/results.json'),rows=(await read(dir+'/rows.json')).rows,example=await read(dir+'/example.json'),audit=await read('docs/commerce-deadlines/constraint-audit-1/results.json');
if(result.status!=='COMPLETED'||!result.baselineReproducedExactly)throw Error('INCOMPLETE_HORIZON_COMPARISON');
const fixed=result.summary[0],joint=result.summary[1];
const report={...result,createdAt:new Date().toISOString(),fixed,joint,markets:6,days:100,followupDays:26,
 completedRuns:rows.length,source:'LOCAL_NUMERICAL_PLANNER_NOT_LLM',example,
 stage:'Development comparison; no held-out agent performance claim',
 delta:Object.fromEntries(Object.keys(fixed.mean).map(k=>[k,joint.mean[k]-fixed.mean[k]])),
 cases:rows.filter(r=>r.policy===fixed.policy).map(f=>{const j=rows.find(r=>r.seed===f.seed&&r.policy===joint.policy);return {scenario:f.scenario,seed:f.seed,fixedUSD:f.platformUSD,jointUSD:j.platformUSD,retailerDeltaUSD:j.retailerUSD-f.retailerUSD,manufacturerDeltaUSD:j.manufacturerUSD-f.manufacturerUSD,solverCalls:j.reliability.solverCalls,replans:j.reliability.solverCalls-96,wallMs:j.reliability.totalWallMs,sameState:f.initialHash===j.initialHash,sameRequests:f.requestStreamHash===j.requestStreamHash};}),
 sensitivity:audit.rows.map(({id,scope,ratio})=>({id,scope,ratio})),
 research:[{title:'Model predictive control',url:'https://web.stanford.edu/class/ee364b/lectures/mpc_slides.pdf'},
 {title:'LLMPC',url:'https://arxiv.org/pdf/2501.02486'},
 {title:'Planning with formal verification tools',url:'https://arxiv.org/pdf/2404.11891'}]};
await writeFile('demo/data/commerce-horizon.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ratio:report.ratio,markets:report.markets,paidCalls:report.newModelCalls}));
