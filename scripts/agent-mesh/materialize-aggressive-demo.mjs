// Replays a previously generated agent plan into real local warehouse tables.
// No model calls or native payments are made by this script.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createMarketStore} from '../market-store.mjs';
import {createMarketService} from '../market-service.mjs';
import {createPolicyWorld,advancePolicyDay,maturePolicyRewards} from '../policy-lab/economy.mjs';
import {frozenInputs} from '../research-lab/data.mjs';
import {ROOT,BASE,POLICIES,scheduleModel,matureMerchantRisk,runAggressive,save} from './aggressive-policy.mjs';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const read=async f=>JSON.parse(await readFile(resolve(BASE,f),'utf8'));
const choices=await read('agent-choices.json'),protocol=await read('demo-protocol.json'),approval=choices.results.find(r=>r.status==='COMPLETED');
if(!approval)throw Error('NO_RECORDED_AGENT_APPROVAL');
const policy=POLICIES.find(p=>p.id===approval.policy.id);if(hash(policy)!==approval.policyHash)throw Error('APPROVED_POLICY_CHANGED');
const {catalog}=await frozenInputs(),requestId='aggressive-demo-v1-'+protocol.seed,runId='GARDEN-LAB-'+hash(requestId).slice(0,16),store=createMarketStore(resolve(ROOT,'.local/market-metro.sqlite'));
const market=createMarketService({store,catalog:{products:()=>catalog,status:()=>({mode:'CHANNEL3_CACHED',cachedProducts:catalog.length,source:'LOCKED_PREVIOUS_CHANNEL3_INGESTION'})},paypal:{}});
const settings={seed:protocol.seed,customerCount:100,days:100,budgetCents:5000,dayMs:1500,scenario:protocol.scenario,nativeSample:false,mode:'gemini'};
let frames=[],history=[];
function checkpoint(key,day,role,actor,input,output,cost=0,provider=null){
 if(store.db.prepare('SELECT 1 FROM policy_lab_checkpoints WHERE checkpoint_id=?').get(key))return;
 const at=new Date().toISOString();store.insert('policy_lab_checkpoints',[{checkpoint_id:key,run_id:runId,review_no:1,day,role,actor,status:'COMPLETED',input_hash:hash(input),input_json:JSON.stringify(input),output_json:JSON.stringify(output),provider_json:provider?JSON.stringify(provider):null,cost_micros:cost,created_at:at,finished_at:at}]);
}
try{
 if(store.state(runId)?.tick===114&&existsSync(resolve(BASE,'demo.json'))){
  const prior=await read('demo.json');console.log(JSON.stringify({alreadyMaterialized:true,runId:prior.runId}));
 }else{
  const branches=[['','mesh',policy],['-RULES','rules',POLICIES.find(p=>p.id==='broad-full-price')],['-ORGANIC','organic',POLICIES[0]]].map(([suffix,branch,policy])=>{
   let world=store.state(runId+suffix);
   if(world){if(world.policyLab.configHash!==hash(settings))throw Error('DEMO_CONFIG_CHANGED');const rows=store.db.prepare('SELECT o.*,COALESCE(r.amount_cents,0) refund FROM orders o LEFT JOIN refunds r USING(order_id) WHERE o.run_id=?').all(world.runId);return {world,policy,orders:new Map(rows.map(o=>[o.order_id,o])),model:scheduleModel(policy)};}
   world=createPolicyWorld({runId:runId+suffix,comparisonId:runId,branch,settings,catalog,startedAt:'2026-10-26T01:00:00.000Z'});world.policyLab.configHash=hash(settings);world.policyLab.clock='RUNNING';world.policyLab.teamStatus='RECORDED_PLAN_EXECUTION';world.policyLab.nextReviewDay=100;
   world.policyLab.modelCalls=branch==='mesh'?2:0;world.policyLab.modelCostMicros=branch==='mesh'?approval.costMicros:0;world.policyLab.agentPlanSource={sourceTrial:approval.trial,reused:true,newModelCalls:0,allocatedInferenceCost:true};
   store.create(world);store.insert('policy_lab_runs',[{run_id:world.runId,comparison_id:runId,branch,settings_json:JSON.stringify(settings),config_hash:hash(settings),created_at:new Date().toISOString()}]);return {world,policy,orders:new Map(),model:scheduleModel(policy)};
  });
  checkpoint(runId+'-PLAN',30,'Experiment scientist','RECORDED_GEMINI_PLAN',{source:'aggressive-policy/agents/trial-1.json',developmentEvidenceId:approval.developmentEvidenceId},approval.proposal,approval.provider[0].modelCostMicros,approval.provider[0]);
  checkpoint(runId+'-REVIEW',30,'Outcome reviewer','RECORDED_GEMINI_PLAN',{proposal:approval.policy,sourceTrial:approval.trial},approval.review,approval.provider[1].modelCostMicros,approval.provider[1]);
  const startDay=branches[0].world.tick;if(branches.some(b=>b.world.tick!==startDay))throw Error('PAIRED_DEMO_CLOCK_MISMATCH');
  try{const progress=await read('demo-progress.json');if(progress.runId!==runId)throw Error('WRONG_DEMO_PROGRESS');frames=progress.frames;history=progress.history;}catch(e){if(e.code!=='ENOENT')throw e;}
  if(startDay===30&&!frames.length)frames.push(market.frame(runId));
  let previous=history.length?JSON.stringify({active:history.at(-1).active,indices:history.at(-1).indices}):null;
  for(let day=startDay;day<114;day++){
   store.transaction(()=>{
    for(const b of branches){const w=b.world;
     if(day>=30&&day<100&&b.policy.id!=='organic'){
      const risk=matureMerchantRisk(b),active=!b.policy.weekdays||b.policy.weekdays.includes(day%7),indices=risk.filter(m=>!b.policy.risk||!m.excluded).map(m=>m.index);
      w.policyLab.plan={strategy:active?'recommendations':'observe',audience:'all',merchantIndices:active?indices:[],maxOfferPct:0,windowDays:42,epsilon:0,asOfDay:30,effectiveDay:day};w.policyLab.model=b.model;w.policyLab.modelId=null;w.policyLab.policyVersion='AGENT-APPROVED-'+b.policy.id;
      if(w.runId===runId){const signature=JSON.stringify({active,indices});if(signature!==previous){const event={day,active,indices,risk,reason:!active?'Scheduled quiet days: customers keep shopping.':risk.some(m=>m.excluded)?'Route recommendations away from a merchant with high observed mature return risk.':'Recommend eligible high-value products during the approved weekly window.'};history.push(event);checkpoint(runId+'-SCHEDULE-'+day,day,'Policy executor','LOCAL_SCHEDULE',{approvedPolicyHash:approval.policyHash},{status:'PUBLISHED',policy:w.policyLab.plan,...event});previous=signature;}}
     }
     if(day>=100&&w.policyLab.plan)w.policyLab.plan={...w.policyLab.plan,strategy:'observe',merchantIndices:[]};
     const batch=advancePolicyDay(w);
     for(const [table,rows]of Object.entries(batch.rows))if(rows.length)store.insert(table,rows);
     for(const o of batch.rows.orders)b.orders.set(o.order_id,{...o,refund:0});for(const refund of batch.rows.refunds)b.orders.get(refund.order_id).refund+=refund.amount_cents;
     maturePolicyRewards(store,w);w.policyLab.lastActivities=batch.activities.slice(-50);if(w.tick===114){w.policyLab.clock='COMPLETE';w.policyLab.teamStatus='COMPLETE';}store.saveState(w);
    }
   });
   const firstRiskDay=history.find(e=>e.active&&e.risk.some(m=>m.excluded))?.day;
   if([30,36,56,78,100,114].includes(day+1)||day===firstRiskDay){frames.push(market.frame(runId));await save('demo-progress.json',{runId,frames,history});}
  }
  const summaries=[];
  for(const b of branches){
   const expected=runAggressive({seed:protocol.seed,scenario:protocol.scenario,catalog,policy:b.policy});
   const actual=store.db.prepare('SELECT COUNT(*) n,SUM(reward_cents IS NOT NULL) mature,SUM(reward_cents) proxy,SUM(outreach_cents) outreach FROM policy_lab_actions WHERE run_id=? AND day>=30').get(b.world.runId);
   if(actual.n!==7000||actual.mature!==7000||actual.proxy!==expected.platformProxyCents||actual.outreach!==expected.outreachCents)throw Error('WAREHOUSE_EXECUTION_PARITY_FAILED');
   const {daily,fits,publications,...score}=expected;summaries.push({branch:b.world.policyLab.branch,runId:b.world.runId,...score,allocatedModelCostMicros:b.world.policyLab.modelCostMicros,platformAfterInferenceUSD:score.platformProxyCents/100-b.world.policyLab.modelCostMicros/1e6});
  }
  const control=summaries.find(s=>s.branch==='organic');for(const s of summaries){s.deltaUSD=s.platformAfterInferenceUSD-control.platformAfterInferenceUSD;s.merchantDeltaUSD=(s.merchantContributionCents-control.merchantContributionCents)/100;}
  const referenceReceipt=store.db.prepare("SELECT run_id AS sourceRunId,status,capture_id,gross_cents,fee_cents,net_cents,verified_at FROM paypal_receipts WHERE status='COMPLETED' ORDER BY verified_at DESC LIMIT 1").get()||null;
  const featuredPurchase=store.db.prepare("SELECT o.order_id,o.customer_id,o.merchant_id,o.total_cents,o.event_date,m.name merchant,p.title,p.channel3_product_id,t.transaction_id,t.fee_cents,a.day FROM orders o JOIN merchants m USING(merchant_id) JOIN order_items oi USING(order_id) JOIN products p USING(product_id) JOIN transactions t USING(order_id) JOIN policy_lab_actions a USING(order_id) WHERE o.run_id=? AND o.channel='policy_recommendation' AND a.day>=30 ORDER BY a.day,o.order_id LIMIT 1").get(runId);
  if(!featuredPurchase)throw Error('NO_RECORDED_RECOMMENDATION_PURCHASE');featuredPurchase.customerName=frames.at(-1).customers.find(c=>c.id===featuredPurchase.customer_id)?.name||'Shopper';
  const demo={runId,requestId,seed:protocol.seed,scenario:protocol.scenario,policy,approval,history,frames,summaries,featuredPurchase,referenceReceipt,warehouse:store.catalog(runId,{viewCounts:false}),disclosure:'Recorded agent-selected policy executed by deterministic schedule and constraints. All commerce is simulated. Prior Sandbox receipt is an integration reference, not a purchase in this run. No model or payment calls during replay.'};await save('demo.json',demo);await mkdir(resolve(ROOT,'demo/data'),{recursive:true});await writeFile(resolve(ROOT,'demo/data/aggressive-demo.json'),JSON.stringify(demo)+'\n');
  console.log(JSON.stringify({runId,warehouseOrders:store.table('orders',runId).count,warehouseTransactions:store.table('transactions',runId).count,parity:true,summaries:summaries.map(s=>({branch:s.branch,deltaUSD:s.deltaUSD,merchantDeltaUSD:s.merchantDeltaUSD,purchases:s.purchases,recommendations:s.recommendations}))}));
 }
}finally{store.close();}
