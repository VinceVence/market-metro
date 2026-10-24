import {DatabaseSync} from 'node:sqlite';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createPolicyWorld,advancePolicyDay} from './economy.mjs';

// Replay saved policy publication times and fitted coefficients. No model or payment calls.
export function replayPolicyRun(path,id){
  const db=new DatabaseSync(path,{readOnly:true});
  try{
    const run=db.prepare('SELECT * FROM policy_lab_runs WHERE run_id=?').get(id);if(!run)throw Error('UNKNOWN_POLICY_RUN');
    const original=JSON.parse(db.prepare('SELECT state_json FROM run_state WHERE run_id=?').get(id).state_json),settings=JSON.parse(run.settings_json);
    const catalog=db.prepare('SELECT * FROM products WHERE run_id=? ORDER BY rowid LIMIT 3').all(id).map(p=>({currency:p.currency,priceCents:p.price_cents,channel3Id:p.channel3_product_id,title:p.title,brand:p.brand,category:p.category,source:p.source,sourceUrl:p.source_url,imageUrl:p.image_url,retrievedAt:p.retrieved_at}));
    const w=createPolicyWorld({runId:id,comparisonId:run.comparison_id,branch:run.branch,settings,catalog,startedAt:original.startedAt});
    const publications=db.prepare("SELECT checkpoint_id,output_json FROM policy_lab_checkpoints WHERE run_id=? AND role='Policy executor' AND status='COMPLETED' ORDER BY rowid").all(id).map(r=>({...JSON.parse(r.output_json),key:r.checkpoint_id})).filter(r=>r.status==='PUBLISHED');
    let actions=0,orders=0;
    while(w.tick<original.tick){
      for(const p of publications.filter(p=>p.policy.effectiveDay===w.tick)){w.policyLab.plan=p.policy;w.policyLab.policyVersion=p.key;w.policyLab.modelId=p.modelId;w.policyLab.model=p.modelId?JSON.parse(db.prepare('SELECT artifact_json FROM policy_lab_models WHERE model_id=?').get(p.modelId).artifact_json):null;}
      const batch=advancePolicyDay(w);actions+=batch.rows.policy_lab_actions?.length||0;orders+=batch.rows.orders?.length||0;
    }
    const fields=['orders','revenueCents','refundsCents','feesCents','costCents','deliveryCostCents','spendCents'],differences=fields.filter(k=>w.stats[k]!==original.stats[k]).map(k=>({field:k,replayed:w.stats[k],recorded:original.stats[k]}));
    return {runId:id,matched:differences.length===0,days:w.tick,actions,orders,publications:publications.length,differences,modelCalls:0,paymentCalls:0,method:'Saved policy activation times, coefficients and keyed exogenous randomness. The seed alone does not reproduce LLM latency or decisions.'};
  }finally{db.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const id=process.argv[2];if(!id)throw Error('Pass a saved Policy Lab run ID.');console.log(JSON.stringify(replayPolicyRun(resolve(import.meta.dirname,'../../.local/market-metro.sqlite'),id),null,2));}
