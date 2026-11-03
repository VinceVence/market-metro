// One post-hoc, local counterfactual. No provider clients or payment APIs are imported.
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createWorld,stepWorld,outcome,assertIntegrity,ASSUMPTIONS} from '../behavior-v4/engine.mjs';
import {authoredCatalog} from '../behavior-v4/catalog.mjs';
import {train,compilePolicy} from '../behavior-v4/policies.mjs';
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const root=new URL('../../',import.meta.url),source=JSON.parse(await readFile(new URL('docs/commerce-room/live-run.json',root))),db=new DatabaseSync(fileURLToPath(new URL('.local/market-metro.sqlite',root)),{readOnly:true});
const saved=JSON.parse(db.prepare('SELECT state_json FROM run_state WHERE run_id=?').get(source.runId).state_json);db.close();
const input={runId:source.runId,seed:source.seed,catalog:authoredCatalog(),customers:saved.customers.length,days:saved.behavior.days,campaignStop:saved.behavior.campaignStop,scenario:saved.scenario,budgetCents:saved.behavior.budgetCents};
const extraFits=source.steps.filter(s=>s.role==='Scientist'&&s.input.reason?.startsWith('Strategist')).map(s=>s.input.cutoff),schedule=source.campaigns.map(c=>({tick:c.day-1,policy:c.policy}));
function execute(mode){
 const w=createWorld(input);
 while(w.tick<w.totalTicks){
  if(w.tick>=30&&w.tick<input.campaignStop&&((w.tick-30)%14===0||(mode==='recorded_agent'&&extraFits.includes(w.tick))))train(w);
  const policy=mode==='no_campaign'?'none':schedule.filter(c=>c.tick<=w.tick).at(-1)?.policy||'none';
  stepWorld(w,w.tick>=30&&w.tick<input.campaignStop?compilePolicy(w,policy):()=>null);
 }
 assertIntegrity(w);const o=outcome(w),cost=mode==='recorded_agent'?source.modelCostUSD:0;
 return {world:w,result:{mode,totalOrders:w.stats.orders,warmupOrders:w.behavior.orders.filter(o=>o.day<30).length,...o,modelFits:w.behavior.models.length,aiCostUSD:cost,platformAfterAIUSD:o.platformCents/100-cost,merchantContributionUSD:o.merchantCents/100,retainedSalesUSD:o.retainedCents/100,outreachUSD:o.outreachCents/100,couponDiscountUSD:w.behavior.discountCents/100,platformDiscountSupportUSD:o.supportCents/100,ordersHash:hash(w.behavior.orders),warmupHash:hash(w.behavior.orders.filter(o=>o.day<30))}};
}
const replay=execute('recorded_agent');
if(hash(replay.world.behavior.orders)!==hash(saved.behavior.orders)||hash(replay.world.behavior.actions)!==hash(saved.behavior.actions))throw Error('REPLAY_DID_NOT_MATCH_SAVED_LIVE_RUN');
const control=execute('no_campaign'),fixed=execute('same_program_without_extra_retrain');
if([control,fixed].some(x=>x.result.warmupHash!==replay.result.warmupHash))throw Error('INITIAL_HISTORY_MISMATCH');
const results=[control.result,replay.result,fixed.result];
for(const r of results)r.deltaVsNoCampaign={orders:r.purchases-control.result.purchases,retainedSalesUSD:Math.round((r.retainedSalesUSD-control.result.retainedSalesUSD)*100)/100,merchantContributionUSD:Math.round((r.merchantContributionUSD-control.result.merchantContributionUSD)*100)/100,platformAfterAIUSD:r.platformAfterAIUSD-control.result.platformAfterAIUSD};
const files={};for(const path of ['scripts/behavior-v4/engine.mjs','scripts/behavior-v4/catalog.mjs','scripts/behavior-v4/policies.mjs','scripts/marketing/recommender.mjs'])files[path]=hash(await readFile(new URL(path,root),'utf8'));
const report={measuredAt:new Date().toISOString(),sourceSession:source.id,scope:'ONE_SEED_POST_HOC_COUNTERFACTUAL_WITH_RECORDED_DECISIONS',inputs:{seed:input.seed,customers:input.customers,days:input.days,returnTailDays:14,campaignStop:input.campaignStop,scenario:input.scenario,budgetCents:input.budgetCents},recordedPolicySchedule:schedule,requestedRetrainTicks:extraFits,exactLiveReplay:true,comparison:'Identical initial history, catalog, random draws and shocks. No campaign means no post-warmup outreach. The fixed-program ablation reuses the chosen program and publication timing but omits only the extra agent-requested retrain and LLM cost; it is not an independently selected strong baseline.',results,assumptions:ASSUMPTIONS,sourceHashes:files,newModelCalls:0,newPayments:0,limitations:['One seed and scenario; no uncertainty estimate or generalization claim.','Decisions were recorded, not freshly reconsidered in counterfactual branches.','Simulator response parameters are authored assumptions, not calibrated PayPal behavior.','Modeled contribution is not actual PayPal profit. The sandbox receipt is excluded from incremental revenue.']};
await writeFile(new URL('docs/commerce-room/paired-control.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({exactLiveReplay:report.exactLiveReplay,inputs:report.inputs,results},null,2));
