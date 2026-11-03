import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CONTRACT} from '../environment.mjs';
import {DEFAULT,OPTIONS,NUMERICAL_CONTROL} from './control.mjs';
import {runCoordinatedCase} from './runner.mjs';
import {openAllocator} from '../../commerce-deadlines/solver.mjs';
import {openAgentTeam,experimentSpend} from './agents.mjs';
const ROOT='docs/commerce-growth/team-1',hash=x=>createHash('sha256').update(x).digest('hex'),read=p=>readFile(p,'utf8').then(JSON.parse),save=(n,v)=>writeFile(ROOT+'/'+n,JSON.stringify(v,null,2)+'\n');
const mode=process.argv[2];if(!['freeze','pilot','test'].includes(mode))throw Error('USE_freeze_pilot_OR_test');
const development=await read(ROOT+'/development/results.json'),prior=await read(ROOT+'/training/model.json');
const core=await read('docs/commerce-growth/development-1/protocol.json');
const files=[...Object.keys(core.sourceHashes),'scripts/commerce-growth/team/control.mjs','scripts/commerce-growth/team/runner.mjs','scripts/commerce-growth/team/agents.mjs','scripts/commerce-growth/team/benchmark.mjs',ROOT+'/training/model.json','scripts/commerce-deadlines/solver.mjs','scripts/commerce-deadlines/allocator.py','scripts/agent-mesh/model-client.mjs','benchmark/vertex.mjs'];
if(mode==='freeze'){
 if(await access(ROOT+'/protocol.json').then(()=>true,()=>false))throw Error('TEAM_PROTOCOL_ALREADY_EXISTS');
 const headroom=await read(ROOT+'/headroom/results.json'),verified=await read(ROOT+'/headroom/verification.json');
 if(!verified.certificates.every(c=>c.certificateVerified))throw Error('UNVERIFIED_HEADROOM');
 const protocol={createdAt:new Date().toISOString(),economy:CONTRACT.version,developmentCases:Object.entries(CONTRACT.developmentSeeds).map(([regime,seed])=>({regime,seed})),
  testCases:Object.keys(CONTRACT.regimes).map((regime,i)=>({id:'T'+String(i).padStart(2,'0'),regime,seed:986300+i})),
  selectedFixed:development.selectedFixed,numerical:NUMERICAL_CONTROL,noOutreach:{id:'no_outreach',config:{...development.selectedFixed.config,outreach:'none'}},
  hashes:Object.fromEntries(await Promise.all(files.map(async f=>[f,hash(await readFile(f))]))),options:OPTIONS,
  agents:{model:'gemini-3.1-flash-lite',thinking:'MEDIUM',decisionDays:[30,60],initialCalls:3,revisionCalls:1,matchedSingleAgent:true},
  spend:{additionalCapUSD:.25,maximumCalls:60,lifetimeApplicationCapUSD:8,existingLifetimeUSD:(await experimentSpend()).lifetimeMicros/1e6,nativePaymentCalls:0},
  scope:'Latest user explicitly requests an unseen2x evaluation. Freeze all controls before opening seven new market seeds. Three application-agent roles plus a coordinator revision; matched single planner gets the same model, four calls, observations, tools and typed action space. No development subagents, no APAC changes, no native payments. Holding a descriptive test does not waive promotion or financial gates.',
  opportunityCheck:{developmentOptimisticCeilingRatio:headroom.rows[0].ratio,meaning:'Necessary opportunity envelope only, not a feasible policy or expected lift. Bounded exploratory pilot is authorized by the latest request; no promise of2x.'},
  comparison:'No outreach, strongest development-selected fixed workflow, local calibrated workflow, matched single LLM planner, multi-role LLM team. Each seed is paired across all five. Test results cannot select or revise cross-market policies. Online day60 revisions may use only that market observations through the checkpoint. Failure falls back to the locked fixed contract and is counted.',
  measurement:'Settled modeled platform net after measured inference cost and allocated pilot cost; retain merchant/supplier contribution, recommendation purchases, contact costs, cash, inventory, reliability and latency. Report all seeds and uncertainty; no post-test tuning.'};
 await save('protocol.json',protocol);for(const f of files){const target=ROOT+'/frozen/'+f;await mkdir(target.slice(0,target.lastIndexOf('/')),{recursive:true});await writeFile(target,await readFile(f));}
 console.log(JSON.stringify({frozen:true,testCases:protocol.testCases.length,maxCalls:60,additionalCapUSD:.25}));process.exit(0);
}
const protocol=await read(ROOT+'/protocol.json');
async function verify(){for(const [f,h]of Object.entries(protocol.hashes))if(hash(await readFile(f))!==h)throw Error('FROZEN_TEAM_SOURCE_CHANGED:'+f);for(const [f,h]of Object.entries(core.sourceHashes))if(hash(await readFile(f))!==h)throw Error('FROZEN_ECONOMY_CHANGED:'+f);}
await verify();const allocator=openAllocator(),developmentSummary=development.summary.map(s=>({policy:s.policy,means:s.mean}));
async function agentRun(settings,id,agentMode,dir){
 const team=await openAgentTeam({id,dir,prior,incumbent:protocol.selectedFixed.config,developmentSummary,mode:agentMode});
 try{const r=await runCoordinatedCase(settings,{id:agentMode==='multi'?'agent_team':'single_agent'},{controller:team,allocator,prior,trace:true});return {...r,agent:team.summary()};}finally{await team.close();}
}
try{
 if(mode==='pilot'){
  await mkdir(ROOT+'/pilot');const settings=protocol.developmentCases[0];
  const result=await agentRun(settings,'D00','multi',ROOT+'/pilot/checkpoints');await save('pilot/result.json',result);
  console.log(JSON.stringify({pilot:settings.regime,platform:result.platformUSD,calls:result.agent.calls,costUSD:result.agent.costUSD,failed:result.agent.failed}));
 }else{
  const pilot=await read(ROOT+'/pilot/result.json');if(pilot.agent.failed||pilot.agent.calls!==4)throw Error('PILOT_NOT_OPERATIONALLY_READY');
  await mkdir(ROOT+'/test');await save('test/opened.json',{at:new Date().toISOString(),protocolHash:hash(JSON.stringify(protocol)),testCases:protocol.testCases});
  const rows=[];
  for(const c of protocol.testCases){
   await verify();const settings={seed:c.seed,regime:c.regime};
   for(const p of [protocol.noOutreach,protocol.selectedFixed,protocol.numerical]){
    const r=await runCoordinatedCase(settings,p,{allocator,prior});rows.push(r);await save('test/rows.json',{rows});
   }
   for(const arm of ['single','multi']){
    const r=await agentRun(settings,c.id+'-'+arm,arm,ROOT+'/test/'+c.id+'-'+arm),{trace,...row}=r;
    await save('test/'+c.id+'-'+arm+'/trajectory.json',trace);rows.push(row);await save('test/rows.json',{rows});
    console.log(JSON.stringify({case:c.id,regime:c.regime,arm,platform:row.platformUSD,calls:row.agent.calls,costUSD:row.agent.costUSD,failed:row.agent.failed}));
   }
   const group=rows.filter(r=>r.seed===c.seed);for(const k of ['initialHash','opportunityHash','consentHash','incomeCents'])if(new Set(group.map(r=>r[k])).size!==1)throw Error('UNPAIRED_TEST_'+k);
  }
  const spend=await experimentSpend();await verify();if(spend.chargedMicros>250000)throw Error('EXPERIMENT_SPEND_EXCEEDED');
  const arms=[protocol.noOutreach.id,protocol.selectedFixed.id,protocol.numerical.id,'single_agent','agent_team'],keys=['platformUSD','retailerUSD','wholesalerUSD','manufacturerUSD','allPartnerUSD','terminalCashUSD','terminalInventoryUSD','recommendationPurchases','retainedPurchases','retainedVolumeUSD','outreachCostUSD','unpaidLiabilities'];
  const summary=arms.map(arm=>{const group=rows.filter(r=>r.policy===arm),modelCost=group.reduce((s,r)=>s+(r.agent?.costUSD||0),0),pilotCost=['single_agent','agent_team'].includes(arm)?pilot.agent.costUSD:0;return {arm,mean:Object.fromEntries(keys.map(k=>[k,group.reduce((s,r)=>s+r[k],0)/group.length])),modelCostUSD:modelCost,allocatedPilotCostUSD:pilotCost,platformAfterModelUSD:(group.reduce((s,r)=>s+r.platformUSD,0)-modelCost-pilotCost)/group.length,failures:group.filter(r=>r.agent?.failed).length,modelCalls:group.reduce((s,r)=>s+(r.agent?.calls||0),0),meanDecisionMs:group.reduce((s,r)=>s+r.reliability.p95DecisionMs,0)/group.length};});
  const fixed=summary.find(s=>s.arm===protocol.selectedFixed.id),team=summary.find(s=>s.arm==='agent_team');
  const gates={platform2x:team.platformAfterModelUSD>=2*fixed.platformAfterModelUSD,retailer:team.mean.retailerUSD>=fixed.mean.retailerUSD,wholesaler:team.mean.wholesalerUSD>=fixed.mean.wholesalerUSD,manufacturer:team.mean.manufacturerUSD>=fixed.mean.manufacturerUSD,terminalCash:team.mean.terminalCashUSD>=fixed.mean.terminalCashUSD,inventory:team.mean.terminalInventoryUSD<=fixed.mean.terminalInventoryUSD*1.1,noUnpaidLiabilities:team.mean.unpaidLiabilities===0,allFreshDecisions:team.failures===0&&team.modelCalls===28};
  await save('test/results.json',{status:'COMPLETED',summary,ratio:team.platformAfterModelUSD/fixed.platformAfterModelUSD,gates,allGatesPassed:Object.values(gates).every(Boolean),goalAchieved:false,spend,pilotCostUSD:pilot.agent.costUSD,nativePaymentCalls:0});
  console.log(JSON.stringify({status:'COMPLETED',ratio:team.platformAfterModelUSD/fixed.platformAfterModelUSD,gates,spend}));
 }
}catch(error){await save(mode+'/failure.json',{at:new Date().toISOString(),error:error.message,spend:await experimentSpend()}).catch(()=>{});throw error;}finally{allocator.close();}
