import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createRunner} from './runner.mjs';
import {VERSION,frame} from './engine.mjs';
import {POLICIES} from './policies.mjs';
import {enrichDemo} from './presentation.mjs';
const ROOT=resolve(import.meta.dirname,'../..'),sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const compactFrame=w=>{const f=frame(w);return {...f,models:[],team:[],retention:[],daily:[],products:undefined,behavior:{...f.behavior,decisions:f.behavior.decisions.slice(-3)},customers:f.customers.map(c=>({...c,history:undefined,scores:undefined})),catalog:{mode:'AUTHORED',productCount:w.products.length/3}};};
export async function materialize({store,input={},approval,catalog,protocol,cacheRoot=resolve(ROOT,'.local/behavior-v4')}){
 if(!approval||approval.status!=='COMPLETED'||!POLICIES.some(p=>p.id===approval.review.policyId))throw Error('RECORDED_AGENT_APPROVAL_REQUIRED');
 if(approval.policyHash!==sha({simulation:protocol.hash,policy:approval.review.policyId}))throw Error('APPROVAL_SIMULATOR_VERSION_MISMATCH');
 const {seed=protocol.demo.seed,scenario=protocol.demo.scenario,customers=100,requestId='owned-studio-judges-1'}=input;
 if(Object.keys(input).some(k=>!['seed','scenario','customers','requestId'].includes(k))||!Number.isSafeInteger(seed)||seed<0||seed>4294967295||!protocol.evaluationScenarios.includes(scenario)||![50,100,200].includes(customers)||typeof requestId!=='string'||requestId.length>100)throw Error('INVALID_V4_DEMO_SETTINGS');
 const settings={seed,scenario,customers,days:protocol.shoppingDays,campaignStop:protocol.campaignStop,version:VERSION,protocolHash:protocol.hash,selectedPolicy:approval.review.policyId};
 const runId='GARDEN-OWN-'+sha({requestId,settings}).slice(0,16),path=resolve(cacheRoot,runId+'.json');
 try{const existing=JSON.parse(await readFile(path,'utf8'));if(!existing.presentationVersion){enrichDemo(store,existing);await writeFile(path+'.tmp',JSON.stringify(existing));await rename(path+'.tmp',path);}return existing;}catch(e){if(e.code!=='ENOENT')throw e;}
 const specs=[['',approval.review.policyId,'agent'],['-RULES','strong_rules','rules'],['-NONE','none','none']];
 const branches=[],frames=[],daily=[],transitions=[],checkpoints=[];let featured=null;
 for(const [suffix,policy,label]of specs){const r=createRunner({runId:runId+suffix,seed,scenario,customers,catalog,policy,days:settings.days,campaignStop:settings.campaignStop});
  r.world.behavior.planSource={kind:label==='agent'?'RECORDED_GEMINI_POLICY':'DETERMINISTIC_CONTROL',sourceEvidenceId:approval.evidence.id,newModelCalls:0};
  const old=store.state(r.world.runId);if(old&&(old.tick!==0||store.table('orders',r.world.runId).count!==0))throw Error('PARTIAL_V4_MATERIALIZATION_REQUIRES_INSPECTION');
  if(!old)store.create(r.world);
  const rows={},savedModels=[];if(label==='agent')frames.push(compactFrame(r.world));
  while(r.world.tick<r.world.totalTicks){const beforeModels=r.world.behavior.models.length,batch=r.step();
   for(const [table,data]of Object.entries(batch.rows))(rows[table]??=[]).push(...data);
   if(r.world.behavior.models.length>beforeModels){const m=r.world.behavior.models.at(-1);savedModels.push({model_id:m.id,run_id:r.world.runId,day:m.cutoff,model_type:m.type,training_rows:m.trainingRows,validation_purchases:m.validationPurchases,validation_from_day:m.split,candidate_recall:m.candidateRecall,baseline_recall:m.baselineRecall,refit_rows:r.world.behavior.observations.filter(x=>x.day<m.cutoff&&x.day>=m.cutoff-35).length,dataset_hash:m.datasetHash,runtime_ms:m.runtimeMs,reason:m.reason,artifact_json:JSON.stringify(m.artifact),source:'LOCAL_COUNT_MODEL'});}
   if(label==='agent'){
    frames.push(compactFrame(r.world));daily.push(r.world.behavior.daily.at(-1));transitions.push(...batch.rows.behavior_lifecycle);
    if(!featured&&r.world.tick>30){const a=batch.rows.behavior_actions.find(a=>a.kind!=='none'&&a.order_id);if(a){const o=batch.rows.orders.find(o=>o.order_id===a.order_id),item=batch.rows.order_items.find(x=>x.order_id===a.order_id),p=r.world.products.find(p=>p.product_id===item.product_id),t=batch.rows.transactions.find(t=>t.order_id===a.order_id);featured={day:a.day,customerId:a.customer_id,customerName:r.world.customers.find(u=>u.customer_id===a.customer_id).name,order:o,transaction:t,product:p,action:a,transition:batch.rows.behavior_lifecycle.find(x=>x.customer_id===a.customer_id)||null};}}
   }
  }
  rows.recommendation_models=savedModels;
  const result=r.result();branches.push({label,runId:r.world.runId,...result,world:r.world,rows});
  if(label==='agent')for(const d of r.world.behavior.decisions)checkpoints.push({day:d.day,actor:d.actor,role:d.role,decision:d.decision,known:d.known,reason:d.reason,modelId:d.modelId});
 }
 for(const [i,role]of ['Campaign scientist','Independent reviewer'].entries())checkpoints.push({day:30,actor:'RECORDED_GEMINI_PLAN',role,decision:i?approval.review:approval.proposal,known:{evidenceId:approval.evidence.id,source:'OWNED_DAY30_SNAPSHOT',observedMarket:approval.evidence.currentMarket},sourceUsage:approval.provider[i],newModelCalls:0});
 checkpoints.sort((a,b)=>a.day-b.day);
 const at=new Date().toISOString();store.transaction(()=>{
  for(const b of branches){
   // Dependencies first; then derived event/decision tables. One atomic commit.
   for(const t of ['orders','order_items','transactions','refunds','deliveries','inventory_movements','campaign_spend','events','coupons','coupon_redemptions','customer_days','recommendation_models','behavior_actions','behavior_lifecycle','behavior_outside','behavior_daily'])if(b.rows[t]?.length)store.insert(t,b.rows[t]);
   store.saveState(b.world);
  }
  store.insert('policy_lab_checkpoints',checkpoints.map((c,i)=>({checkpoint_id:runId+'-CP'+i,run_id:runId,review_no:i,day:c.day,role:c.role,actor:c.actor,status:'COMPLETED',input_hash:sha(c.known||{}),input_json:JSON.stringify(c.known||{}),output_json:JSON.stringify(c),provider_json:c.sourceUsage?JSON.stringify(c.sourceUsage):null,cost_micros:0,created_at:at,finished_at:at})));
 });
 const summaries=branches.map(({world,rows,...b})=>b),control=summaries.find(b=>b.label==='none');
 for(const b of summaries){const cost=b.label==='agent'?approval.costMicros/1e6:0;b.allocatedModelUSD=cost;b.ongoingDeltaUSD=(b.ongoing.platformCents-control.ongoing.platformCents)/100-cost;b.durableDeltaUSD=(b.durable.platformCents-control.durable.platformCents)/100-cost;b.merchantDeltaUSD=(b.durable.merchantCents-control.durable.merchantCents)/100;}
 const primary=branches[0];const dbCount=store.table('orders',runId).count;if(dbCount!==primary.world.behavior.orders.length)throw Error('V4_WAREHOUSE_COUNT_MISMATCH');
 const net=store.db.prepare('SELECT SUM(platform_proxy_cents) n FROM v_behavior_financials WHERE run_id=? AND event_date>=?').get(runId,new Date(Date.parse(primary.world.startedAt)+30*86400000+8*3600000).toISOString().slice(0,10)).n;
 if(net!==primary.durable.platformCents)throw Error('V4_WAREHOUSE_FINANCIAL_MISMATCH:'+net+':'+primary.durable.platformCents);
 const referenceReceipt=store.db.prepare("SELECT run_id sourceRunId,capture_id,gross_cents,status,verified_at FROM paypal_receipts WHERE status='COMPLETED' ORDER BY verified_at DESC LIMIT1".replace('LIMIT1','LIMIT 1')).get()||null;
 const demo={runId,settings,frames,daily,transitions,checkpoints,featured,summaries,warehouse:store.catalog(runId,{viewCounts:false}),referenceReceipt,providerApproval:{proposal:approval.proposal,review:approval.review,provider:approval.provider,costMicros:approval.costMicros},newModelCalls:0,newPayments:0,disclosure:'Generated from the corrected simulation. The Gemini program is a recorded approval; local model fitting and shopper choices execute for this seed. Playback is a replay of those actual generated events. Native Sandbox reference belongs to its labeled prior run.'};
 enrichDemo(store,demo);await mkdir(resolve(path,'..'),{recursive:true});await writeFile(path+'.tmp',JSON.stringify(demo));await rename(path+'.tmp',path);return demo;
}
