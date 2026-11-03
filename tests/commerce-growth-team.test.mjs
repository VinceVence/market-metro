import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {warmGrowthWorld,runGrowthCase} from '../scripts/commerce-growth/evaluate.mjs';
import {beginGrowthDay,observeGrowthWorld} from '../scripts/commerce-growth/environment.mjs';
import {validateConfig,DEFAULT,FIXED_CONTROLS,outreachPlan,fitForecast} from '../scripts/commerce-growth/team/control.mjs';
import {runCoordinatedCase} from '../scripts/commerce-growth/team/runner.mjs';
import {openAllocator} from '../scripts/commerce-deadlines/solver.mjs';
import {openAgentTeam} from '../scripts/commerce-growth/team/agents.mjs';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const prior=JSON.parse(await readFile('docs/commerce-growth/team-1/training/model.json','utf8'));
test('typed control rejects money creation and out-of-contract actions',()=>{
 assert.throws(()=>validateConfig({...DEFAULT,addBuyerCash:1000}),/INVALID_TEAM_CONTRACT/);
 assert.throws(()=>validateConfig({...DEFAULT,contactsPerDay:1000}),/INVALID_TEAM_CONTRACT/);
 assert.throws(()=>validateConfig({...DEFAULT,allocation:'eval'}),/INVALID_TEAM_CONTRACT/);
});

test('three-role handoff publishes validated contracts and revises at the observation checkpoint',async()=>{
 const w=warmGrowthWorld({seed:301,regime:'discovery',days:100,customers:30});beginGrowthDay(w);const view=observeGrowthWorld(w),calls=[];
 const fake={client:{events:[],async json(system,packet,options){
  assert.equal(Object.hasOwn(packet.evidence,'seed'),false);assert.equal(Object.hasOwn(packet.evidence,'privateOrderOutcomes'),false);
  calls.push(packet.role);const fn=options.functions[0],fields=fn.parameters.properties.configuration.required;
  this.events.push({modelCostMicros:0,latencyMs:1,status:'TEST_DOUBLE'});
  return {name:fn.name,args:{configuration:Object.fromEntries(fields.map(k=>[k,DEFAULT[k]])),rationale:'Test-only bounded decision.'}};
 }},async close(){}};
 const dir=await mkdtemp(join(tmpdir(),'growth-team-check-')),
  team=await openAgentTeam({id:'TEST',dir:dir+'/team',prior,incumbent:FIXED_CONTROLS[0].config,developmentSummary:[],providerFactory:async()=>fake,spendStatus:async()=>({unsettled:0,calls:0,chargedMicros:0})});
 try{const first=await team.plan(view);assert.deepEqual(first.configuration,DEFAULT);await team.plan({...view,day:60});assert.deepEqual(calls,['outreach_scientist','fulfillment_engineer','coordinator','coordinator']);assert.equal(team.summary().failed,false);assert.equal(team.summary().calls,4);}
 finally{await team.close();}
});
test('calibration uses settled past outcomes and excludes future evidence',()=>{
 const w=warmGrowthWorld({seed:301,regime:'discovery',days:36,customers:30});beginGrowthDay(w);const view=observeGrowthWorld(w);
 const a=outreachPlan(view,DEFAULT,prior),b=outreachPlan({...view,outreach:{...view.outreach,history:[...view.outreach.history,{day:999,kind:'recommend',observedBucket:'recommend|Stationery|fresh|new',requestId:'future'}]}},DEFAULT,prior);
 assert.deepEqual(a,b);
 const forecast=fitForecast(view,'adaptive');assert.equal(forecast.cutoffDay,view.day);assert.ok(['legacy28','recent7','recent14'].includes(forecast.selected));
 assert.ok(a.actions.every(x=>view.audience.find(p=>p.customerId===x.customerId).marketingConsent));
});
test('legacy control reproduces the frozen reference and new joint tools conserve the economy',async()=>{
 const settings={seed:301,regime:'discovery',days:36,customers:30},allocator=openAllocator();try{
  const before=await runGrowthCase(settings,{id:'fixed_stock',mode:'stock'}),after=await runCoordinatedCase(settings,FIXED_CONTROLS[0],{allocator,prior});
  for(const k of ['initialHash','opportunityHash','incomeCents','platformUSD','retailerUSD','wholesalerUSD','manufacturerUSD','retainedPurchases'])assert.equal(after[k],before[k],k);
  const joint=await runCoordinatedCase(settings,{id:'local_calibrated',config:DEFAULT},{allocator,prior});assert.equal(joint.reliability.invariantsPassed,true);assert.equal(joint.unpaidLiabilities,0);assert.equal(joint.opportunityHash,before.opportunityHash);
 }finally{allocator.close();}
});
