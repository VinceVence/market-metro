import {appendDecision,advanceLearningDay,initialLearningRows} from './economy.mjs';
import {FEATURES,predict} from './contract.mjs';
import {trainLocal,localTrainerStatus} from './trainer.mjs';

export function createLearningRunner({store,trainImpl=trainLocal}){
  const insertBatch=(rows)=>{for(const name of ['business_goals','campaign_assignments','orders','order_items','transactions','refunds','deliveries','inventory_movements','campaign_spend','events','coupons','coupon_redemptions','customer_days','model_runs','model_scores','team_decisions','retention_results'])if(rows[name]?.length)store.insert(name,rows[name]);};
  function init(w){store.transaction(()=>{insertBatch(initialLearningRows(w));store.saveState(w);});}
  function decision(w,...args){const row=appendDecision(w,...args);store.insert('team_decisions',[row]);return row;}
  function shouldTrain(w){
    if(!['adaptive','scheduled_ml'].includes(w.policy)||w.tick<28||w.lastTrainingDay===w.tick)return null;
    if(w.tick===28)return 'The 28-day randomized learning period has matured.';
    if(w.policy==='scheduled_ml'&&w.tick%7===0)return 'Conventional weekly retraining schedule.';
    if(w.policy==='adaptive'&&w.tick===42&&w.scenario!=='steady')return 'Seven completed days are now available after the external market change.';
    if(w.policy==='adaptive'&&w.tick===49&&w.scenario!=='steady'&&w.models.some(m=>m.day===42&&m.train_through_day<35))return 'Changed-condition outcomes now exist in both training and later validation windows; complete the follow-up review.';
    if(w.policy==='adaptive'&&w.tick%7===0&&w.champion){
      const rows=store.db.prepare('SELECT * FROM customer_days WHERE run_id=? AND day>=? AND day<?').all(w.runId,w.tick-7,w.tick);
      const loss=rows.reduce((s,r)=>{const p=Math.min(.999999,Math.max(.000001,predict(w.champion.artifact,r,r.offered_pct)));return s-(r.purchased?Math.log(p):Math.log(1-p));},0)/Math.max(1,rows.length);
      if(loss>w.champion.validationLoss*1.20)return 'Recent prediction loss rose more than 20% above the champion validation loss.';
    }
    return null;
  }
  async function fit(w,reason){
    store.transaction(()=>{decision(w,'Data engineer','VALIDATE_DATA','Prepare observed features using only completed days. Reserve the latest seven days for validation.',{cutoffExclusive:w.tick,features:FEATURES});
      decision(w,'Data scientist','TRAIN_CANDIDATES',reason,{candidates:['logistic regression','depth-limited decision tree'],runtime:'Local CPU'},'RUNNING');store.saveState(w);});
    let result;
    try{result=await trainImpl(store,w);}catch(error){result={status:'FAILED',reason:error.message};}
    w.lastTrainingDay=w.tick;w.modelVersion++;
    const id=w.runId+'-MODEL-'+w.modelVersion;
    const model={model_id:id,run_id:w.runId,day:w.tick,version:w.modelVersion,status:result.status,reason:result.reason,model_type:result.model_type||null,
      features_json:JSON.stringify(FEATURES),dataset_hash:result.dataset_hash||null,training_rows:result.training_rows||0,validation_rows:result.validation_rows||0,train_through_day:result.train_through_day??null,validation_from_day:result.validation_from_day??null,validation_through_day:result.validation_through_day??null,
      validation_log_loss:result.validation_log_loss??null,baseline_log_loss:result.baseline_log_loss??null,champion_log_loss:result.champion_log_loss??null,brier_score:result.brier_score??null,candidates_json:JSON.stringify(result.candidates||[]),artifact_json:result.artifact?JSON.stringify(result.artifact):null,runtime_ms:result.runtime_ms||0,source:'REAL_LOCAL_SCIKIT_LEARN'};
    if(result.status==='PROMOTED'&&result.artifact)w.champion={id,version:w.modelVersion,artifact:result.artifact,validationLoss:result.validation_log_loss};
    w.models.push({...model,artifact:result.artifact,artifact_json:undefined});
    store.transaction(()=>{
      store.insert('model_runs',[model]);
      decision(w,'Data scientist','TRAIN_FINISHED','Local candidate fitting finished. '+result.reason,{modelId:id,trainingRows:model.training_rows,validationRows:model.validation_rows},result.status);
      decision(w,'Experiment analyst','VALIDATE_MODEL',result.validation_log_loss!==undefined?'Candidate loss '+result.validation_log_loss.toFixed(4)+' versus offer-rate baseline '+result.baseline_log_loss.toFixed(4)+'. Predictive validation does not prove campaign lift.':result.reason,
        {validationDays:[result.validation_from_day,result.validation_through_day],candidateLoss:result.validation_log_loss,baselineLoss:result.baseline_log_loss,championLoss:result.champion_log_loss},result.status==='PROMOTED'?'EVIDENCE':'REVIEW');
      decision(w,'Coordinator',result.status==='PROMOTED'?'PROMOTE_MODEL':'KEEP_CURRENT_POLICY',result.reason,{candidateModel:id,activeModel:w.champion?.id||null,trainingRows:model.training_rows,runtimeMs:model.runtime_ms},result.status);
      store.saveState(w);
    });
  }
  async function advance(w,count){
    let activities=[];
    for(let i=0;i<count&&w.status!=='COMPLETED';i++){
      const reason=shouldTrain(w);if(reason)await fit(w,reason);
      const next=structuredClone(w),batch=advanceLearningDay(next);
      store.transaction(()=>{insertBatch(batch.rows);store.saveState(next);});
      w=next;activities=batch.activities;
    }
    return {world:w,activities:activities.slice(-60)};
  }
  return {init,advance,fit,status:localTrainerStatus};
}
