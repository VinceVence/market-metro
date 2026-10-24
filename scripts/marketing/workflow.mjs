import {createHash} from 'node:crypto';
import {createLearningMarket,advanceLearningDay,initialLearningRows,appendDecision,observedFeatures} from './economy.mjs';
import {predict,FEATURES} from './contract.mjs';
import {trainLocal} from './trainer.mjs';
import {eventDate} from '../../demo/market/engine.mjs';

const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const now=()=>new Date().toISOString();
const parse=x=>x?JSON.parse(x):null;
const total=(rows,k)=>rows.reduce((n,r)=>n+(r[k]||0),0);
const fee=n=>Math.round(n*.0349)+49;
export class WorkflowError extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code;}}
const fail=(code,message,status=400)=>{throw new WorkflowError(status,code,message);};
const keys=(o,allowed)=>{if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).some(k=>!allowed.includes(k)))fail('INVALID_PARAMETERS','Use only the declared tool parameters.');};
const text=(x,max=1500)=>typeof x==='string'&&x.trim().length>=5&&x.length<=max;
export const WORKFLOW_TOOLS={
  prepare_history:'Generate the 28-day observed learning history; no model or payment API call.',
  analyze:'Inspect completed observations by merchant, segment, market, offer, product, daily outcomes or model_health. Model health uses saved pre-action scores and reports the unchanged seven-day validation split.',
  train:'Fit approved local model families on a chosen completed-day window and record validation.',
  draft_campaign:'Validate and save a campaign specification, model, audience, offer limits and duration.',
  launch:'Activate the validated plan inside the delegated simulation budget.',
  advance:'Execute one to seven campaign days and save every shopper decision atomically.',
  review:'Record a planner decision to continue or pause based on new evidence.',
  settle:'Advance two follow-up days without new coupons so deliveries and returns mature.',
  capture_samples:'Capture explicitly selected coupon orders with the saved sandbox wallet.',
  evaluate:'Calculate sale-cohort economics and randomized cohort outcomes from recorded events.',
  complete:'Close the campaign after evaluation and the requested native receipts are verified.'
};

export function createCampaignWorkflow({store,market,trainImpl=trainLocal}){
  const busy=new Map();
  const get=id=>{const r=store.db.prepare('SELECT * FROM agent_workflows WHERE workflow_id=?').get(id);if(!r)fail('WORKFLOW_NOT_FOUND','Campaign workflow not found.',404);return {...r,state:parse(r.state_json)};};
  const checkpoints=id=>store.db.prepare('SELECT * FROM agent_checkpoints WHERE workflow_id=? ORDER BY rowid').all(id).map(r=>({...r,input:parse(r.input_json),output:parse(r.output_json),error:parse(r.error_json),input_json:undefined,output_json:undefined,error_json:undefined,input_hash:undefined}));
  const plan=id=>{const r=store.db.prepare('SELECT * FROM campaign_plans WHERE plan_id=?').get(id);return r?{...r,plan:parse(r.plan_json),plan_json:undefined}:null;};
  const contextHash=(f,w)=>hash({id:f.workflow_id,revision:f.state.revision,day:w.tick,plan:f.state.activePlanId||null,model:f.state.modelId||null});
  function autonomy(id){
    const session=store.db.prepare('SELECT model,status,spend_cap_micros,state_json FROM planner_sessions WHERE workflow_id=?').get(id);
    if(!session)return null;
    const state=parse(session.state_json),calls=store.db.prepare('SELECT provider_json FROM planner_turns WHERE workflow_id=? AND provider_json IS NOT NULL').all(id).map(r=>parse(r.provider_json));
    return {model:session.model,status:session.status,capMicros:session.spend_cap_micros,callCount:calls.length,modelCostMicros:calls.reduce((n,r)=>n+(r.modelCostMicros||0),0),unmeteredCostCeilingMicros:calls.reduce((n,r)=>n+(r.status==='uncertain'?(r.reservedMicros||30000):0),0),unknownCharges:calls.some(r=>r.status==='uncertain'),error:state.error||null,capVerification:state.capVerification||null};
  }
  function context(id){
    const f=get(id),w=store.state(f.run_id),steps=checkpoints(id),pending=steps.find(c=>c.status==='RUNNING');
    return {workflowId:id,runId:f.run_id,mission:f.state.mission,phase:f.state.phase,revision:f.state.revision,contextHash:contextHash(f,w),planner:(f.state.actor||'assistant_in_current_chat').toUpperCase(),runtime:f.state.actor==='vertex_planner'?'App-owned Gemini 3.1 Flash-Lite planner; local tools':'Local tools; no app-hosted LLM or paid model calls',autonomy:autonomy(id),goal:f.state.goal,day:w.tick,customerCount:w.customers.length,startDay:f.state.startDay??null,endDay:f.state.endDay??null,settled:Boolean(f.state.settled),attention:f.state.attention||null,activePlan:f.state.activePlanId?plan(f.state.activePlanId):null,draftPlan:f.state.draftPlanId?plan(f.state.draftPlanId):null,checkpoints:steps,pendingRequest:pending?.input||null,tools:WORKFLOW_TOOLS,modelSummaries:w.models.map(({artifact,artifact_json,...rest})=>rest),nativePayments:market.paymentSample(f.run_id),evaluation:f.state.evaluation||null,catalogSources:[...new Set(w.products.map(p=>p.source))]};
  }
  function save(f,w){store.db.prepare('UPDATE agent_workflows SET state_json=?,updated_at=? WHERE workflow_id=?').run(JSON.stringify(f.state),now(),f.workflow_id);store.saveState(w);}
  function insertBatch(batch){for(const [table,rows]of Object.entries(batch.rows))if(rows.length)store.insert(table,rows);}
  function requirePhase(f,phases){if(!phases.includes(f.state.phase))fail('WRONG_CHECKPOINT','This tool cannot run from '+f.state.phase+'.',409);}
  function analysis(f,w,p){
    keys(p,['windowDays','cuts']);if(![7,14,21,28].includes(p.windowDays)||!Array.isArray(p.cuts)||!p.cuts.length||p.cuts.some(x=>!['merchants','segments','market','offers','products','daily','model_health'].includes(x)))fail('INVALID_ANALYSIS','Choose a completed-day window and supported analysis cuts.');
    const rows=store.db.prepare('SELECT d.*,u.segment,p.merchant_id FROM customer_days d JOIN customers u USING(customer_id) JOIN products p USING(product_id) WHERE d.run_id=? AND d.day>=? AND d.day<?').all(w.runId,Math.max(0,w.tick-p.windowDays),w.tick);
    const group=field=>{const groups=new Map();for(const r of rows){const k=r[field];if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}return [...groups].map(([value,a])=>({value,observations:a.length,visits:total(a,'visited'),purchases:total(a,'purchased'),offers:a.filter(r=>r.offered_pct>0).length,redemptions:total(a,'redeemed'),salesCents:total(a,'gross_cents')}));};
    const periods=[{label:'latest7',from:w.tick-7,to:w.tick},{label:'previous7',from:w.tick-14,to:w.tick-7}].map(v=>{const a=rows.filter(r=>r.day>=v.from&&r.day<v.to);return {...v,observations:a.length,purchases:total(a,'purchased'),salesCents:total(a,'gross_cents'),stockAvailableRate:a.length?total(a,'stock_available')/a.length:null,observedRivalPromotionRate:a.length?total(a,'rival_sale')/a.length:null};});
    const daily=p.cuts.includes('daily')?[...new Set(rows.map(r=>r.day))].sort((a,b)=>a-b).map(day=>{const a=rows.filter(r=>r.day===day);return {day,observations:a.length,visits:total(a,'visited'),purchases:total(a,'purchased'),offers:a.filter(r=>r.offered_pct>0).length,redemptions:total(a,'redeemed'),salesCents:total(a,'gross_cents'),discountsCents:total(a,'discount_cents'),stockAvailableRate:total(a,'stock_available')/a.length,rivalPromotionRate:total(a,'rival_sale')/a.length,paydayRate:total(a,'payday')/a.length};}):undefined;
    let modelHealth;
    if(p.cuts.includes('model_health')){
      // Use the scores saved before the purchase, never a refit scored on its own outcomes.
      const scored=store.db.prepare('SELECT d.day,d.model_id,d.arm,d.issued_pct,d.p_no_offer,d.p_five,d.p_ten,o.purchased,o.rival_sale FROM campaign_customer_decisions d JOIN customer_days o ON o.run_id=d.run_id AND o.customer_id=d.customer_id AND o.day=d.day WHERE d.workflow_id=? AND d.day>=? AND d.day<?').all(f.workflow_id,Math.max(0,w.tick-p.windowDays),w.tick).map(r=>({...r,prediction:r.issued_pct===10?r.p_ten:r.issued_pct===5?r.p_five:r.p_no_offer}));
      const valid=scored.filter(r=>Number.isFinite(r.prediction)&&r.prediction>=0&&r.prediction<=1);
      const summarize=a=>({observations:a.length,days:new Set(a.map(r=>r.day)).size,purchases:total(a,'purchased'),expectedPurchases:total(a,'prediction'),meanPrediction:total(a,'prediction')/a.length,purchaseRate:total(a,'purchased')/a.length,brier:a.reduce((n,r)=>n+(r.prediction-r.purchased)**2,0)/a.length,logLoss:-a.reduce((n,r)=>{const q=Math.max(1e-9,Math.min(1-1e-9,r.prediction));return n+r.purchased*Math.log(q)+(1-r.purchased)*Math.log(1-q);},0)/a.length});
      const grouped=key=>[...new Set(valid.map(r=>r[key]))].sort().map(value=>({value,...summarize(valid.filter(r=>r[key]===value))}));
      const train=rows.filter(r=>r.day<w.tick-7),validation=rows.filter(r=>r.day>=w.tick-7);
      modelHealth={scoreSource:'Saved pre-action probabilities for the actually issued offer; repeated shoppers, descriptive diagnostics only.',missingOrInvalidScores:scored.length-valid.length,byRivalExposure:grouped('rival_sale'),byDay:grouped('day'),byModel:grouped('model_id'),candidateTrainingSplit:{windowDays:p.windowDays,trainingThroughDay:w.tick-8,validationFromDay:w.tick-7,validationThroughDay:w.tick-1,trainingRows:train.length,validationRows:validation.length,rivalTrainingRows:train.filter(r=>r.rival_sale).length,rivalValidationRows:validation.filter(r=>r.rival_sale).length,caveat:'Existing trainer reserves the final seven days for validation, then refits the selected family on all observed rows. A refit is not independently validated on its own new outcomes.'}};
    }
    return {daily,modelHealth,cutoffExclusive:w.tick,windowDays:p.windowDays,observations:rows.length,customers:w.customers.length,quality:{futureRows:0,invalidFeatures:rows.filter(r=>FEATURES.some(k=>!Number.isFinite(r[k]))).length,foreignKeyErrors:store.db.prepare('PRAGMA foreign_key_check').all().length},features:FEATURES,market:p.cuts.includes('market')?periods:undefined,merchants:p.cuts.includes('merchants')?group('merchant_id').map(r=>({...r,name:w.merchants.find(m=>m.merchant_id===r.value)?.name})):undefined,segments:p.cuts.includes('segments')?group('segment'):undefined,offers:p.cuts.includes('offers')?group('offered_pct'):undefined,products:p.cuts.includes('products')?w.products.map(v=>{const margin=a=>{const n=v.price_cents-Math.round(v.price_cents*a/100);return (n-v.cost_cents-fee(n)-350)/n;};return {productId:v.product_id,merchantId:v.merchant_id,title:v.title,priceCents:v.price_cents,assumedCostCents:v.cost_cents,stock:w.inventory[v.product_id],margin5:margin(5),margin10:margin(10),source:v.source};}):undefined,caveat:'Delivered-offer groups are descriptive, not causal estimates. Market indicators come from observed completed days; private customer traits and future shocks are excluded.'};
  }
  function campaignPolicy(w,s,record){
    const p=record.plan,artifact=w.champion.artifact;
    return input=>{
      if(w.tick>=s.endDay||s.phase==='PAUSED')return {offer:0,reason:'Campaign paused or follow-up window',score:input.score,modelId:w.champion.id};
      if(!p.merchantIds.includes(input.merchantId))return {offer:0,reason:'Merchant outside campaign scope',score:input.score,modelId:w.champion.id};
      if(input.features.recency_days<p.minRecencyDays)return {offer:0,reason:'Audience excluded: purchase too recent',score:input.score,modelId:w.champion.id};
      const probabilities=[0,5,10].map(a=>predict(artifact,input.features,a));
      const product=input.product,base=product.price_cents-product.cost_cents-fee(product.price_cents)-350;
      const ranked=p.offerOptions.map(offer=>{const net=product.price_cents-Math.round(product.price_cents*offer/100),probability=probabilities[offer/5],lift=probability-probabilities[0],gain=probability*(net-product.cost_cents-fee(net)-350)-probabilities[0]*base-2;return {offer,lift,gain,margin:(net-product.cost_cents-fee(net)-350)/net};})
        .filter(a=>a.gain>=p.minExpectedGainCents&&a.lift>.005&&a.margin>=w.goal.minMargin).sort((a,b)=>p.ranking==='incremental_purchase_probability'?b.lift-a.lift||b.gain-a.gain:b.gain-a.gain);
      const chosen=ranked[0];return {offer:chosen?.offer||0,score:{p0:probabilities[0],p5:probabilities[1],p10:probabilities[2],offer:chosen?.offer||0,gain:chosen?.gain||0,lift:chosen?.lift||0},modelId:w.champion.id,reason:chosen?'Planner campaign: model-selected '+chosen.offer+'% offer':'No offer clears the expected-gain and margin constraints'};
    };
  }
  function days(f,w,count,followup=false){
    const selected=plan(f.state.activePlanId),records=[];let lastActivities=[],attention=null;
    let priorRival=store.db.prepare('SELECT AVG(rival_sale) v FROM customer_days WHERE run_id=? AND day=?').get(w.runId,w.tick-1).v||0;
    for(let n=0;n<count;n++){
      const rows=[];
      const batch=advanceLearningDay(w,{offerPolicy:followup?i=>({offer:0,score:i.score,modelId:i.modelId,reason:'Follow-up: no new coupons'}):campaignPolicy(w,f.state,selected),onDecision:d=>rows.push({decision_id:f.workflow_id+'-D'+d.day+'-'+d.customerId,workflow_id:f.workflow_id,run_id:w.runId,plan_id:selected.plan_id,customer_id:d.customerId,product_id:d.productId,merchant_id:d.merchantId,day:d.day,arm:d.arm,model_id:d.modelId,eligibility:followup?'FOLLOWUP':d.arm==='HOLDOUT'?'HOLDOUT':d.issuedPct?'OFFERED':'NOT_OFFERED',reason:d.reason,p_no_offer:d.score?.p0??null,p_five:d.score?.p5??null,p_ten:d.score?.p10??null,proposed_pct:d.proposedPct,issued_pct:d.issuedPct,coupon_id:d.couponId,features_json:JSON.stringify(d.features)})});
      insertBatch(batch);store.insert('campaign_customer_decisions',rows);records.push(batch.daily);lastActivities=batch.activities;
      const currentRival=batch.rows.customer_days.reduce((n,r)=>n+r.rival_sale,0)/Math.max(1,batch.rows.customer_days.length);
      if(!followup&&Math.abs(currentRival-priorRival)>.5){attention={kind:'OBSERVED_MARKET_CHANGE',indicator:'rival_promotion_exposure',previous:priorRival,current:currentRival,observedDay:w.tick-1};f.state.attention=attention;break;}
      priorRival=currentRival;
    }
    return {requestedDays:count,completedDays:records.length,attention,throughDay:w.tick-1,days:records,shopperDecisions:records.length*w.customers.length,activities:lastActivities};
  }
  function evaluate(f,w){
    const start=f.state.startDay,end=f.state.endDay;
    const orders=store.db.prepare('SELECT * FROM orders WHERE run_id=? AND event_ts>=? AND event_ts<?').all(w.runId,new Date(Date.parse(w.startedAt)+start*86400000).toISOString(),new Date(Date.parse(w.startedAt)+end*86400000).toISOString());
    const ids=new Set(orders.map(o=>o.order_id)),refunds=store.db.prepare('SELECT * FROM refunds WHERE run_id=?').all(w.runId).filter(r=>ids.has(r.order_id));
    const customers=store.db.prepare('SELECT * FROM customer_days WHERE run_id=? AND day>=? AND day<?').all(w.runId,start,end);
    const couponCount=store.db.prepare('SELECT COUNT(*) n FROM coupons WHERE run_id=? AND issued_day>=? AND issued_day<?').get(w.runId,start,end).n;
    const cohort=w.customers.filter(u=>u.baselineActive),purchasers=new Set(orders.map(o=>o.customer_id));
    const groups=['TARGETABLE','HOLDOUT'].map(arm=>{const a=cohort.filter(u=>u.arm===arm);return {arm,customers:a.length,purchasers:a.filter(u=>purchasers.has(u.customer_id)).length};});
    const [t,c]=groups,rate=g=>g.customers?g.purchasers/g.customers:null,tr=rate(t),cr=rate(c),difference=tr!==null&&cr!==null?tr-cr:null,se=difference===null?null:Math.sqrt(tr*(1-tr)/t.customers+cr*(1-cr)/c.customers);
    const economics={salesCents:total(orders,'total_cents'),discountsCents:total(orders,'discount_cents'),refundsCents:total(refunds,'amount_cents'),cogsCents:total(orders,'cost_cents'),deliveryCents:total(orders,'delivery_cost_cents'),modeledFeesCents:orders.reduce((n,o)=>n+fee(o.total_cents),0),outreachCents:couponCount*2};
    economics.contributionCents=economics.salesCents-economics.refundsCents-economics.cogsCents-economics.deliveryCents-economics.modeledFeesCents-economics.outreachCents;
    return {window:{startDay:start,endDayExclusive:end,followupThroughDay:w.tick-1},customers:w.customers.length,decisions:store.db.prepare('SELECT COUNT(*) n FROM campaign_customer_decisions WHERE workflow_id=?').get(f.workflow_id).n,orders:orders.length,buyingCustomers:purchasers.size,offeredCustomers:new Set(store.db.prepare('SELECT customer_id FROM coupons WHERE run_id=? AND issued_day>=? AND issued_day<?').all(w.runId,start,end).map(r=>r.customer_id)).size,coupons:couponCount,redemptions:total(customers,'redeemed'),economics,baselineActiveExperiment:{groups,difference,ciLow:se===null?null:difference-1.96*se,ciHigh:se===null?null:difference+1.96*se,status:t.customers>=30&&c.customers>=30?'MATURE':'SMALL_SAMPLE',interpretation:'Randomized eligibility comparison among baseline-active shoppers. A purchase does not prove that a particular shopper was caused to buy by the coupon.'},nativePayments:market.paymentSample(w.runId).lineage,paidModelCalls:autonomy(f.workflow_id)?.callCount||0,modelApiCostMicros:autonomy(f.workflow_id)?.modelCostMicros||0};
  }
  async function perform(id,input){
    keys(input,['requestId','expectedRevision','contextHash','action','parameters','rationale','evidenceIds','actor']);
    if(!/^[a-zA-Z0-9_-]{4,80}$/.test(input.requestId||'')||!text(input.rationale)||!['assistant_in_current_chat','scripted_demo','vertex_planner'].includes(input.actor)||!Object.hasOwn(WORKFLOW_TOOLS,input.action))fail('INVALID_PLANNER_REQUEST','Supply a valid tool request, actor and explanation.');
    const fingerprint=hash(input),f=get(id),w=store.state(f.run_id),prior=store.db.prepare('SELECT * FROM agent_checkpoints WHERE workflow_id=? AND request_id=?').get(id,input.requestId);
    if(input.actor!==(f.state.actor||'assistant_in_current_chat'))fail('PLANNER_MISMATCH','Keep this workflow attributed to its original planner.');
    if(prior&&prior.input_hash!==fingerprint)fail('REQUEST_KEY_REUSED','This request ID already names a different action.',409);
    if(prior?.status==='COMPLETED')return {replayed:true,checkpointId:prior.checkpoint_id,output:parse(prior.output_json),context:context(id)};
    if(input.expectedRevision!==f.state.revision||input.contextHash!==contextHash(f,w))fail('STALE_CONTEXT','Read the latest checkpoint context before planning.',409);
    const unfinished=store.db.prepare("SELECT request_id FROM agent_checkpoints WHERE workflow_id=? AND status='RUNNING'").get(id);
    if(unfinished&&unfinished.request_id!==input.requestId)fail('RESUME_PENDING_STEP','Resume the saved request before starting another step.',409);
    const evidence=checkpoints(id).filter(c=>c.status==='COMPLETED').map(c=>c.checkpoint_id);
    if(!Array.isArray(input.evidenceIds)||!input.evidenceIds.length||input.evidenceIds.some(x=>!evidence.includes(x)))fail('INVALID_EVIDENCE','Cite completed checkpoints from this workflow.');
    const checkpointId=prior?.checkpoint_id||id+'-CP-'+input.requestId;
    if(prior)store.db.prepare("UPDATE agent_checkpoints SET status='RUNNING',attempts=attempts+1,error_json=NULL WHERE checkpoint_id=?").run(checkpointId);
    else store.insert('agent_checkpoints',[{checkpoint_id:checkpointId,workflow_id:id,run_id:w.runId,request_id:input.requestId,input_hash:fingerprint,action:input.action,actor:input.actor,status:'RUNNING',attempts:1,input_json:JSON.stringify(input),started_at:now()}]);
    const p=input.parameters||{};let result,training;
    try{
      if(input.action==='train'){
        requirePhase(f,['ANALYZED','MODEL_READY','RUNNING','PAUSED']);keys(p,['windowDays','modelTypes']);
        if(w.tick<28)fail('HISTORY_REQUIRED','Prepare observed history first.');
        training=await trainImpl(store,w,p);if(['FAILED','UNAVAILABLE','INSUFFICIENT_DATA'].includes(training.status))fail('TRAINING_NOT_READY',training.reason,409);
      }
      if(input.action==='capture_samples'){
        requirePhase(f,['OUTCOMES_READY','EVALUATED']);keys(p,['orderIds']);
        if(!f.state.settled)fail('SETTLE_FIRST','Complete delivery follow-up before selecting native samples.',409);
        if(!Array.isArray(p.orderIds)||p.orderIds.length!==f.state.goal.nativeSamples||!p.orderIds.length||new Set(p.orderIds).size!==p.orderIds.length)fail('INVALID_NATIVE_SAMPLE','Use exactly the delegated number of distinct coupon orders.');
        for(const oid of p.orderIds){const o=store.db.prepare('SELECT o.*,c.issued_day FROM orders o JOIN coupon_redemptions r USING(order_id) JOIN coupons c USING(coupon_id) WHERE o.order_id=? AND o.run_id=?').get(oid,w.runId);if(!o||o.issued_day<f.state.startDay||o.issued_day>=f.state.endDay||store.db.prepare('SELECT 1 FROM refunds WHERE order_id=?').get(oid))fail('INVALID_NATIVE_ORDER','Select a non-refunded coupon order from this campaign.');}
        await market.mirror(w.runId,p.orderIds);
        const sample=market.paymentSample(w.runId);
        for(const receipt of sample.receipts.filter(r=>p.orderIds.includes(r.order_id)&&r.status!=='COMPLETED'))await market.refreshReceipt(receipt.receipt_id);
        result={lineage:market.paymentSample(w.runId).lineage};
        if(result.lineage.filter(r=>p.orderIds.includes(r.order_id)&&r.paypal_status==='COMPLETED'&&r.amount_verified===1).length!==p.orderIds.length)fail('PAYPAL_UNCONFIRMED','A saved native payment still needs reconciliation; retry this same checkpoint.',502);
      }
      store.transaction(()=>{
        if(input.action==='prepare_history'){
          requirePhase(f,['GOAL_SET']);keys(p,[]);
          while(w.tick<28)insertBatch(advanceLearningDay(w));f.state.phase='HISTORY_READY';result={completedDays:28,observations:store.db.prepare('SELECT COUNT(*) n FROM customer_days WHERE run_id=?').get(w.runId).n};
        }else if(input.action==='analyze'){
          requirePhase(f,['HISTORY_READY','ANALYZED','MODEL_READY','RUNNING','PAUSED','OUTCOMES_READY']);result=analysis(f,w,p);if(['HISTORY_READY','ANALYZED'].includes(f.state.phase))f.state.phase='ANALYZED';
        }else if(input.action==='train'){
          const id=checkpointId+'-MODEL',version=w.models.length+1,m={model_id:id,run_id:w.runId,day:w.tick,version,status:training.status,reason:training.reason,model_type:training.model_type,features_json:JSON.stringify(FEATURES),dataset_hash:training.dataset_hash,training_rows:training.training_rows,validation_rows:training.validation_rows,train_through_day:training.train_through_day,validation_from_day:training.validation_from_day,validation_through_day:training.validation_through_day,validation_log_loss:training.validation_log_loss,baseline_log_loss:training.baseline_log_loss,champion_log_loss:training.champion_log_loss??null,brier_score:training.brier_score,candidates_json:JSON.stringify(training.candidates||[]),artifact_json:JSON.stringify(training.artifact),runtime_ms:training.runtime_ms,source:input.actor==='vertex_planner'?'VERTEX_PLANNED_LOCAL_SCIKIT_LEARN':input.actor==='scripted_demo'?'SCRIPTED_DEMO_LOCAL_SCIKIT_LEARN':'CHAT_PLANNED_LOCAL_SCIKIT_LEARN'};
          store.insert('model_runs',[m]);w.models.push({...m,artifact:training.artifact,artifact_json:undefined});w.modelVersion=version;f.state.modelId=id;f.state.phase='MODEL_READY';const {artifact,...safe}=training;result={...safe,modelId:id,qualified:training.status==='PROMOTED',trainingPlan:p,features:FEATURES};
        }else if(input.action==='draft_campaign'){
          requirePhase(f,['MODEL_READY','PLAN_VALIDATED','RUNNING','PAUSED']);keys(p,['title','message','modelId','merchantIds','offerOptions','minRecencyDays','minExpectedGainCents','ranking','durationDays']);
          const m=store.db.prepare("SELECT * FROM model_runs WHERE model_id=? AND run_id=? AND status='PROMOTED'").get(p.modelId,w.runId);
          if(!m)fail('MODEL_NOT_QUALIFIED','Select a model that passed local validation.');
          if(!text(p.title,100)||!text(p.message,250)||!Array.isArray(p.merchantIds)||!p.merchantIds.length||p.merchantIds.some(id=>!w.merchants.some(m=>m.merchant_id===id))||!Array.isArray(p.offerOptions)||!p.offerOptions.length||new Set(p.offerOptions).size!==p.offerOptions.length||p.offerOptions.some(x=>![5,10].includes(x))||!Number.isInteger(p.minRecencyDays)||p.minRecencyDays<0||p.minRecencyDays>28||!Number.isInteger(p.minExpectedGainCents)||p.minExpectedGainCents<0||p.minExpectedGainCents>10000||!['contribution','incremental_purchase_probability'].includes(p.ranking)||!Number.isInteger(p.durationDays)||p.durationDays<1||p.durationDays>14||w.tick+p.durationDays>54||(f.state.endDay&&w.tick+p.durationDays>f.state.endDay))fail('INVALID_CAMPAIGN_PLAN','Use scoped merchants, 5/10% offers, a nonnegative gain floor and up to fourteen campaign days.');
          const version=store.db.prepare('SELECT COUNT(*) n FROM campaign_plans WHERE workflow_id=?').get(f.workflow_id).n+1,planId=f.workflow_id+'-PLAN-'+version;
          store.insert('campaign_plans',[{plan_id:planId,workflow_id:f.workflow_id,run_id:w.runId,version,model_id:p.modelId,status:'VALIDATED',plan_json:JSON.stringify(p),created_at:now()}]);f.state.draftPlanId=planId;f.state.phase='PLAN_VALIDATED';result={planId,version,plan:p,guards:{budgetCents:w.goal.budgetCents,minMargin:w.goal.minMargin,contactGapDays:w.goal.contactGap,holdout:'Persistent randomized assignment',nativeSampleLimit:f.state.goal.nativeSamples}};
        }else if(input.action==='launch'){
          requirePhase(f,['PLAN_VALIDATED']);keys(p,['planId']);if(p.planId!==f.state.draftPlanId)fail('STALE_PLAN','Launch the currently validated plan.');
          const selected=plan(p.planId),m=store.db.prepare('SELECT * FROM model_runs WHERE model_id=?').get(selected.model_id);
          w.champion={id:m.model_id,version:m.version,artifact:parse(m.artifact_json),validationLoss:m.validation_log_loss};f.state.activePlanId=p.planId;f.state.startDay??=w.tick;f.state.endDay??=w.tick+selected.plan.durationDays;f.state.phase='RUNNING';
          store.db.prepare("UPDATE campaign_plans SET status='SUPERSEDED' WHERE workflow_id=? AND status='ACTIVE'").run(f.workflow_id);store.db.prepare("UPDATE campaign_plans SET status='ACTIVE',launched_at=? WHERE plan_id=?").run(now(),p.planId);
          for(const c of w.campaigns.filter(c=>c.phase==='LIVE'||c.campaign_id.includes('-LIVE-'))){c.name=selected.plan.title;c.creative=selected.plan.message;store.db.prepare('UPDATE campaigns SET name=?,creative=? WHERE campaign_id=?').run(c.name,c.creative,c.campaign_id);}
          result={planId:p.planId,startsDay:f.state.startDay,endsDayExclusive:f.state.endDay,modelId:w.champion.id,message:selected.plan.message};
        }else if(input.action==='advance'){
          requirePhase(f,['RUNNING']);if(f.state.attention)fail('PLANNER_REVIEW_REQUIRED','Review the new observed market signal before advancing.',409);keys(p,['days']);if(!Number.isInteger(p.days)||p.days<1||p.days>7||w.tick+p.days>f.state.endDay)fail('INVALID_ADVANCE','Advance one to seven days within the campaign window.');result=days(f,w,p.days);if(w.tick===f.state.endDay)f.state.phase='OUTCOMES_READY';
        }else if(input.action==='review'){
          requirePhase(f,['RUNNING','PAUSED','MODEL_READY']);if(!f.state.activePlanId)fail('CAMPAIGN_NOT_LAUNCHED','Launch a validated campaign before reviewing continuation.');keys(p,['decision']);if(!['continue','pause'].includes(p.decision))fail('INVALID_REVIEW','Choose continue or pause.');f.state.phase=p.decision==='pause'?'PAUSED':'RUNNING';f.state.attention=null;result={decision:p.decision,day:w.tick,activePlanId:f.state.activePlanId};
        }else if(input.action==='settle'){
          requirePhase(f,['OUTCOMES_READY']);keys(p,[]);if(f.state.settled)result={alreadySettled:true,day:w.tick};else{result=days(f,w,2,true);f.state.settled=true;}
        }else if(input.action==='evaluate'){
          requirePhase(f,['OUTCOMES_READY','EVALUATED']);keys(p,[]);if(!f.state.settled)fail('FOLLOWUP_REQUIRED','Complete the delivery and refund follow-up.');result=evaluate(f,w);f.state.evaluation=result;f.state.phase='EVALUATED';
        }else if(input.action==='complete'){
          requirePhase(f,['EVALUATED']);keys(p,[]);const samples=market.paymentSample(w.runId);if(samples.completed!==f.state.goal.nativeSamples)fail('RECEIPTS_REQUIRED','Verify the delegated sandbox samples before completion.',409);f.state.phase='COMPLETED';f.state.evaluation=evaluate(f,w);result={completed:true,evaluation:f.state.evaluation};
        }
        const row=appendDecision(w,({prepare_history:'Data engineer',analyze:'Business lead',train:'Data scientist',draft_campaign:'Campaign manager',launch:'Coordinator',advance:'Campaign manager',review:'Coordinator',settle:'Data engineer',capture_samples:'Coordinator',evaluate:'Experiment analyst',complete:'Coordinator'})[input.action],input.action.toUpperCase(),input.rationale,{checkpointId,evidenceIds:input.evidenceIds,parameters:p},'COMPLETED');row.source=input.actor==='vertex_planner'?'VERTEX_PLANNER_WITH_LOCAL_TOOLS':input.actor==='scripted_demo'?'SCRIPTED_DEMO_WITH_LOCAL_TOOLS':'ASSISTANT_IN_CHAT_WITH_LOCAL_TOOLS';store.insert('team_decisions',[row]);
        f.state.revision++;save(f,w);store.db.prepare("UPDATE agent_checkpoints SET status='COMPLETED',output_json=?,finished_at=?,error_json=NULL WHERE checkpoint_id=?").run(JSON.stringify(result),now(),checkpointId);
      });
      return {replayed:false,checkpointId,output:result,context:context(id)};
    }catch(error){store.db.prepare("UPDATE agent_checkpoints SET status='FAILED',error_json=?,finished_at=? WHERE checkpoint_id=?").run(JSON.stringify({code:error.code||'TOOL_FAILED',message:error.message}),now(),checkpointId);throw error;}
  }
  return {
    context,
    list:()=>store.db.prepare('SELECT workflow_id,run_id,state_json,created_at FROM agent_workflows ORDER BY created_at DESC LIMIT 30').all().map(r=>({workflowId:r.workflow_id,runId:r.run_id,mission:parse(r.state_json).mission,phase:parse(r.state_json).phase,createdAt:r.created_at})),
    create(input){
      keys(input,['requestId','mission','seed','customerCount','budgetCents','objective','scenario','nativeSamples','actor']);
      if(input.actor!==undefined&&!['assistant_in_current_chat','scripted_demo','vertex_planner'].includes(input.actor))fail('INVALID_PLANNER','Choose a supported planner source.');
      if(!/^[a-zA-Z0-9_-]{4,80}$/.test(input.requestId||'')||!text(input.mission)||!Number.isInteger(input.seed)||input.seed<0||input.seed>4294967295||!Number.isInteger(input.customerCount)||input.customerCount<100||input.customerCount>1200||!Number.isInteger(input.budgetCents)||input.budgetCents<0||input.budgetCents>100000||!['profit','retention','conversion'].includes(input.objective)||!['steady','rival_sale','budget_squeeze','supply_delay'].includes(input.scenario)||![0,1,3].includes(input.nativeSamples))fail('INVALID_MISSION','Use a bounded simulation mission with supported settings.');
      const id='WF-'+hash(input.requestId).slice(0,16),existing=store.db.prepare('SELECT workflow_id,goal_hash FROM agent_workflows WHERE request_id=?').get(input.requestId);if(existing){if(existing.goal_hash!==hash(input))fail('REQUEST_KEY_REUSED','This mission request ID already has different inputs.',409);return context(existing.workflow_id);}
      const runId='GARDEN-'+id;let w=store.state(runId);
      if(!w){w=createLearningMarket({runId,seed:input.seed,customerCount:input.customerCount,merchantCount:8,startedAt:eventDate(now())+'T01:00:00.000Z',catalog:market.catalogProducts(),policy:'adaptive',objective:input.objective,budgetCents:input.budgetCents,scenario:input.scenario});w.sandboxSampleLimit=0;store.create(w);}
      store.transaction(()=>{w.workflowId=id;w.workflowActor=input.actor||'assistant_in_current_chat';for(const [t,rows]of Object.entries(initialLearningRows(w)))store.insert(t,rows);store.saveState(w);
        const state={mission:input.mission,actor:w.workflowActor,phase:'GOAL_SET',revision:0,goal:{objective:input.objective,budgetCents:input.budgetCents,nativeSamples:input.nativeSamples,maxCampaignDays:14}};
        store.insert('agent_workflows',[{workflow_id:id,run_id:runId,request_id:input.requestId,goal_hash:hash(input),state_json:JSON.stringify(state),created_at:now(),updated_at:now()}]);
        store.insert('agent_checkpoints',[{checkpoint_id:id+'-GOAL',workflow_id:id,run_id:runId,request_id:'goal',input_hash:hash(input),action:'set_goal',actor:w.workflowActor,status:'COMPLETED',attempts:1,input_json:JSON.stringify({mission:input.mission,goal:state.goal}),output_json:JSON.stringify({mission:input.mission,goal:state.goal}),started_at:now(),finished_at:now()}]);});return context(id);
    },
    async step(id,input){if(busy.has(id))fail('WORKFLOW_BUSY','Wait for the current checkpoint to finish.',409);const promise=perform(id,input);busy.set(id,promise);try{return await promise;}finally{busy.delete(id);}},
    customers(id){
      const f=get(id),w=store.state(f.run_id),start=f.state.startDay??28,end=f.state.endDay??56;
      const decisions=store.db.prepare('SELECT * FROM campaign_customer_decisions WHERE workflow_id=? ORDER BY day').all(id),metrics=store.db.prepare('SELECT customer_id,SUM(visited) visits,SUM(purchased) purchases,SUM(redeemed) redemptions FROM customer_days WHERE run_id=? AND day>=? AND day<? GROUP BY customer_id').all(w.runId,start,end),seen=store.db.prepare("SELECT customer_id,COUNT(*) n FROM events WHERE run_id=? AND event_type='coupon_seen' AND json_extract(detail_json,'$.day')>=? AND json_extract(detail_json,'$.day')<? GROUP BY customer_id").all(w.runId,start,end),native=store.db.prepare("SELECT o.customer_id,COUNT(*) n FROM paypal_receipts p JOIN orders o USING(order_id) WHERE p.run_id=? AND p.status='COMPLETED' GROUP BY o.customer_id").all(w.runId);
      return w.customers.map(u=>{const a=decisions.filter(d=>d.customer_id===u.customer_id),latest=a.at(-1),live=a.filter(d=>d.day<end);return {customerId:u.customer_id,name:u.name,segment:u.segment,arm:u.arm,decisionCount:a.length,coupons:live.filter(d=>d.coupon_id).length,seen:seen.find(r=>r.customer_id===u.customer_id)?.n||0,visits:metrics.find(r=>r.customer_id===u.customer_id)?.visits||0,purchases:metrics.find(r=>r.customer_id===u.customer_id)?.purchases||0,redemptions:metrics.find(r=>r.customer_id===u.customer_id)?.redemptions||0,nativeReceipts:native.find(r=>r.customer_id===u.customer_id)?.n||0,latest:latest?{day:latest.day,eligibility:latest.eligibility,reason:latest.reason,p0:latest.p_no_offer,p5:latest.p_five,p10:latest.p_ten,issuedPct:latest.issued_pct}:null};});
    },
    trace(id,customerId){
      const f=get(id),w=store.state(f.run_id),u=w.customers.find(u=>u.customer_id===customerId);if(!u)fail('CUSTOMER_NOT_FOUND','Shopper is outside this campaign.',404);
      const start=f.state.startDay??28,end=f.state.endDay??56;
      const decisions=store.db.prepare('SELECT d.*,p.title,m.name merchant_name FROM campaign_customer_decisions d JOIN products p USING(product_id) JOIN merchants m USING(merchant_id) WHERE d.workflow_id=? AND d.customer_id=? ORDER BY d.day').all(id,customerId).map(r=>({...r,features:parse(r.features_json),features_json:undefined}));
      const events=store.db.prepare("SELECT event_type,event_ts,order_id,detail_json FROM events WHERE run_id=? AND customer_id=? AND json_extract(detail_json,'$.day')>=? ORDER BY event_ts,rowid").all(w.runId,customerId,start).map(r=>({...r,detail:parse(r.detail_json),detail_json:undefined}));
      const orders=store.db.prepare('SELECT o.order_id,o.event_ts,o.total_cents,o.discount_cents,o.status,p.title,t.fee_cents,COALESCE((SELECT SUM(r.amount_cents) FROM refunds r WHERE r.order_id=o.order_id),0) refund_cents FROM orders o JOIN order_items i USING(order_id) JOIN products p USING(product_id) JOIN transactions t USING(order_id) WHERE o.run_id=? AND o.customer_id=? AND o.event_ts>=? ORDER BY o.event_ts').all(w.runId,customerId,new Date(Date.parse(w.startedAt)+start*86400000).toISOString());
      const receipts=market.paymentSample(w.runId).lineage.filter(r=>r.customer_id===customerId);
      return {workflowId:id,customerId,name:u.name,segment:u.segment,arm:u.arm,campaignWindow:{startDay:start,endDayExclusive:end},decisions,events,orders,receipts,interpretation:'Probabilities are actual fitted-model estimates. Purchases are independent seeded simulator outcomes. Only explicitly linked receipts are native PayPal sandbox payments.'};
    },
    export(id){const f=get(id);return {context:context(id),customers:this.customers(id),warehouse:store.export(f.run_id)};}
  };
}
