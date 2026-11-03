import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {warmGrowthWorld} from '../scripts/commerce-growth/evaluate.mjs';import {beginGrowthDay} from '../scripts/commerce-growth/environment.mjs';
import {economicObservation,inspectEconomy,validateEconomicPatch,patchApplies,evaluateEconomicConditions,economicContactPlan,trainEconomicForecast} from '../scripts/commerce-growth/autonomy/economic-tools.mjs';
import {economicResources} from '../scripts/commerce-growth/autonomy/economic-runtime.mjs';import {openEconomicHarness} from '../scripts/commerce-growth/autonomy/economic-harness.mjs';
const resources=await economicResources();
const fixture=()=>{const w=warmGrowthWorld({seed:301,regime:'low_response',days:36,customers:30});beginGrowthDay(w);return w;};
const policy={campaign:'v1',objective:'joint',inventory:'funded_only',forecast_id:'none',cover_days:0,settlement:'fast',duration_days:7,conditions:[]};
test('economic observations expose prior platform events, not hidden state or future money',()=>{
 const w=fixture();w.ledger.push({day:w.day+1,kind:'FUTURE_SECRET',from:'platform',to:'x',cents:100,reference:'secret'});const view=economicObservation(w),facts=inspectEconomy(view,['payments','supply'],7);
 for(const k of ['seed','scenario','growth','privateOrderOutcomes','accounts','incomeCents'])assert.equal(Object.hasOwn(view,k),false,k);
 assert.ok(view.paymentEvents.every(e=>e.day<view.day));assert.equal(JSON.stringify(view).includes('FUTURE_SECRET'),false);
 const expected=view.paymentEvents.filter(e=>e.day>=view.day-7).reduce((s,e)=>s+(e.to==='platform'?e.cents:-e.cents),0)/100;assert.ok(Math.abs(facts.values.payment_cash_margin_usd-expected)<1e-7);
 assert.equal(facts.historyThroughDay,view.day-1);assert.throws(()=>inspectEconomy(view,['private_wallets'],7),/INVALID_ECONOMIC_QUERY/);
});
test('typed patches expire, reject money changes and cannot consume private indicators',()=>{
 validateEconomicPatch(policy);assert.throws(()=>validateEconomicPatch({...policy,addCash:100}),/INVALID_ECONOMIC_PATCH/);assert.throws(()=>validateEconomicPatch({...policy,duration_days:100}),/INVALID_ECONOMIC_PATCH/);
 assert.throws(()=>validateEconomicPatch({...policy,conditions:[{indicator:'seed',operator:'above',value:0}]}),/INVALID_ECONOMIC_CONDITION/);
 const c={reviewDay:30,policy};assert.equal(patchApplies({day:29},c),false);assert.equal(patchApplies({day:30},c),true);assert.equal(patchApplies({day:36},c),true);assert.equal(patchApplies({day:37},c),false);
});
test('demand growth uses discovery time rather than backdating a newly revealed need',()=>{
 const w=fixture(),before=inspectEconomy(economicObservation(w),['demand'],7).details.demand.requests;
 w.requests.push({...structuredClone(w.requests[0]),id:'TEST-LATE-DISCOVERY',createdDay:w.day-12,discoveredDay:w.day-2,status:'REQUESTED'});
 const after=inspectEconomy(economicObservation(w),['demand'],7);assert.equal(after.details.demand.requests,before+1);
});
test('a condition uses its cited time window instead of silently substituting seven days',()=>{
 const view=economicObservation(fixture());view.day=45;view.observedRequests=[...Array.from({length:20},()=>({observedDay:20,lines:[]})),...Array.from({length:5},()=>({observedDay:34,lines:[]})),...Array.from({length:10},()=>({observedDay:40,lines:[]}))];
 const p={...policy,conditions:[{indicator:'request_growth_ratio',operator:'below',value:1,window_days:14}]};assert.equal(evaluateEconomicConditions(view,p)[0].passes,true);
 assert.equal(evaluateEconomicConditions(view,{...p,conditions:[{...p.conditions[0],window_days:7}]})[0].passes,false);
});
test('grounded tools cache trials and reject a policy changed after preview',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'economic-tools-')),view=economicObservation(fixture());let trials=0;
 try{const h=await openEconomicHarness({view,resources,path:join(dir,'state.json'),historyDescription:{id:'H1'},compareHistorical:async c=>{trials++;return {source:'DIFFERENT_COMPLETED_HISTORICAL_MARKET',candidateId:c.id,economyUnchanged:true,activeDays:7,delta:{platformUSD:1}};}});
  await assert.rejects(h.execute('preview_policy',{policy,evidence_ids:['invented'],reason:'test'}),/UNKNOWN_OR_STALE_EVIDENCE/);
  const e=await h.execute('inspect_indicators',{domains:['inventory','liquidity'],window_days:7,reason:'Check stock and available merchant cash.'}),p=await h.execute('preview_policy',{policy,evidence_ids:[e.evidenceId],reason:'Finance approved demand first.'}),args={candidate_id:p.candidate_id,historical_market:'H1',reason:'Measure the intervention.'};
  const a=await h.execute('run_historical_trial',args),b=await h.execute('run_historical_trial',{reason:'Repeat the same request after recovery.',historical_market:'H1',candidate_id:p.candidate_id});assert.deepEqual(a,b);assert.equal(trials,1);
  await assert.rejects(h.execute('select_economic_policy',{candidate_id:p.candidate_id,measured_delta_usd:999,reason:'Invented gain.'}),/INVALID_TOOL_ARGUMENTS/);
  const recommendation=await h.execute('select_economic_policy',{candidate_id:p.candidate_id,reason:'Queue the exact historical result.'});assert.equal(recommendation.measured_delta_usd,1);assert.equal(recommendation.promoted,false);
  h.state.candidates[p.candidate_id].policy.duration_days=3;await assert.rejects(h.execute('run_historical_trial',args),/CANDIDATE_CHANGED_AFTER_PREVIEW/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('resume completes a saved decision without another model call and rejects a stale snapshot',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'economic-resume-')),view=economicObservation(fixture()),path=join(dir,'state.json'),opts={view,resources,path,historyDescription:{id:'H1'},compareHistorical:async()=>{throw Error('UNEXPECTED_TRIAL');}};
 try{const h=await openEconomicHarness(opts),args={candidate_id:'v1',reason:'Saved decision.'};h.state.checkpoints.push({id:'pending-final',actor:'TRUSTED_TOOL',tool:'select_economic_policy',status:'STARTED',input:args});h.state.pending={checkpointId:'pending-final',name:'select_economic_policy',args};await h.save();
  const resumed=await openEconomicHarness({...opts,resume:true}),result=await resumed.run({client:{events:[],json:async()=>{throw Error('UNEXPECTED_MODEL_CALL');}}});assert.equal(result.status,'COMPLETED');assert.equal(result.providerCalls,0);assert.equal(result.recommendation.promoted,false);
  await assert.rejects(openEconomicHarness({...opts,view:{...view,day:view.day+1},resume:true}),/STALE_WORKFLOW_SNAPSHOT/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('an expiring outreach pause leaves the commerce executor configuration intact',()=>{
 const view=economicObservation(fixture()),p={...policy,campaign:'pause_outreach',inventory:'v1'},before=JSON.stringify(view);validateEconomicPatch(p);
 const plan=economicContactPlan(view,resources,{policy:p});assert.deepEqual(plan.actions,[]);assert.deepEqual(plan.configuration,resources.fixed.config);assert.equal(JSON.stringify(view),before);
});
test('forecast reports separate available history and the rows actually in its selected window',()=>{
 const view=economicObservation(fixture()),m=trainEconomicForecast(view,'recent7');assert.equal(m.fitWindowDays,7);assert.ok(m.availableFundedRows>m.trainingRows);
 const later=trainEconomicForecast({...view,pastRequests:[...view.pastRequests,{funded:true,authorizedDay:999,lines:[]}]},'recent7');assert.equal(later.trainingRows,m.trainingRows);assert.equal(later.availableFundedRows,m.availableFundedRows);assert.deepEqual(later.rates,m.rates);
});
test('historical financial failures cannot be selected even if the LLM requests publication',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'economic-gates-')),view=economicObservation(fixture());
 try{
  const h=await openEconomicHarness({view,resources,path:join(dir,'state.json'),historyDescription:{id:'H1'},compareHistorical:async c=>({source:'DIFFERENT_COMPLETED_HISTORICAL_MARKET',candidateId:c.id,economyUnchanged:true,activeDays:7,eligible:false,delta:{platformUSD:10}})});
  const e=await h.execute('inspect_indicators',{domains:['inventory','liquidity'],window_days:7,reason:'Check cash and stock.'});
  const p=await h.execute('preview_policy',{policy,evidence_ids:[e.evidenceId],reason:'Test funded-only restock.'});
  await h.execute('run_historical_trial',{candidate_id:p.candidate_id,historical_market:'H1',reason:'Compare with baseline.'});
  await assert.rejects(h.execute('select_economic_policy',{candidate_id:p.candidate_id,reason:'Positive platform net alone.'}),/ECONOMIC_GATES_FAILED/);
  const final=await h.execute('select_economic_policy',{candidate_id:'v1',reason:'Protect partner value.'});assert.equal(final.decision,'keep_v1');
 }finally{await rm(dir,{recursive:true,force:true});}
});
