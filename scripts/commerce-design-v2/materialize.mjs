// Replay the predeclared FIRST held-out market, never a handpicked winner.
// Decisions were made in the recorded design session; this adds no paid calls.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createWorld,stepWorld,frame,outcome,assertIntegrity} from '../behavior-v4/engine.mjs';
import {authoredCatalog} from '../behavior-v4/catalog.mjs';
import {train,compilePolicy} from '../behavior-v4/policies.mjs';
import {createMarketStore} from '../market-store.mjs';
import {createCommerceRoom} from '../commerce-room/service.mjs';
import {fitFeatures,compileCandidate} from './policy.mjs';
import {hash,SETTINGS} from './evaluate.mjs';
import {DIR} from './benchmark.mjs';
const results=JSON.parse(await readFile(resolve(DIR,'results.json'),'utf8')),c=results.cases[0],design=results.designs[c.block+'-multi'],config=design.selection.config;
const key=hash({version:'construct-v1',protocol:results.protocolHash,seed:c.seed}).slice(0,16),id='COMMERCE-'+key,runId='GARDEN-OWN-'+key,store=createMarketStore(resolve('.local/market-metro.sqlite'));
const url='/studio.html?session='+id;
try{
 createCommerceRoom({store,market:{mirror(){throw Error('RESEARCH_REPLAY_HAS_NO_PAYMENTS');}}});
 if(!store.db.prepare('SELECT id FROM commerce_room_runs WHERE id=?').get(id)){
  const w=createWorld({...SETTINGS,seed:c.seed,scenario:c.scenario,runId,catalog:authoredCatalog()});w.commerceWorkflow=true;
  const s={id,runId,seed:c.seed,sandbox:false,status:'COMPLETED',goal:'Execute a saved research-time specialist design on the first unseen test market. This replay makes no new LLM or PayPal calls.',rounds:1,pending:false,policy:'constructed_policy',campaignName:design.selection.name,campaigns:[],costMicros:Math.round(design.costUSD*1e6),calls:3,designVersion:'construct-v1'};
  const created=new Date().toISOString();store.create(w);
  const step=(role,actor,day,input,output,events=[],at=created)=>{const stepId=id+'-'+role.replaceAll(' ','-')+'-'+day;store.db.prepare('INSERT INTO commerce_room_steps VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(stepId,id,role,actor,'COMPLETED',day,day,JSON.stringify(input),JSON.stringify(output),events.reduce((n,e)=>n+(e.modelCostMicros||0),0),JSON.stringify(events),at,at);return stepId;};
  const saveFrame=()=>{const f=frame(w);f.models=[];f.team=[];f.retention=[];f.daily=[];delete f.products;f.customers=f.customers.map(x=>({...x,history:undefined,scores:undefined}));store.db.prepare('INSERT INTO commerce_room_frames VALUES(?,?,?)').run(runId,w.tick,JSON.stringify(f));};
  store.transaction(()=>{
   store.db.prepare('INSERT INTO commerce_room_runs VALUES(?,?,?,?,?,?)').run(id,'research-replay-'+key,runId,s.status,JSON.stringify(s),created);
   step('Coordinator','LOCAL_TOOL',1,{}, {title:'Research replay',body:s.goal});saveFrame();let model;
   while(w.tick<w.totalTicks){
    if(w.tick===30){for(const cp of design.checkpoints)step(cp.role,'GEMINI',31,{...cp.input,provenance:'Saved research-time decision on separate development markets, reused here. No new model call.'},{title:cp.role+' proposals',body:cp.output.proposals.map(p=>p.name+': '+p.rationale).join(' '),proposals:cp.output.proposals},[cp.provider],cp.finishedAt);
     const reviewId=step('Verifier','LOCAL_TOOL',31,{validation:design.validationCandidates},{title:'Validation checkpoint',body:'Selected '+design.selection.name+' using separate validation markets and the merchant contribution guard. No test results were used.',config});
     s.campaigns.push({day:31,policy:'constructed_policy',name:design.selection.name,reviewId,proposalId:id+'-Coordinator-31'});step('Publisher','LOCAL_TOOL',31,{config},{title:'Campaign active',body:'Saved policy now runs locally against this market’s observed customer data. Coupons are optional; this trial does not force purchases.'});
    }
    if(w.tick>=30&&w.tick<90&&(w.tick-30)%14===0){train(w);model=fitFeatures(w.behavior.observations,w.products,w.tick);
     store.insert('recommendation_models',[{model_id:runId+'-EASE-'+w.tick,run_id:runId,day:w.tick,model_type:model.version,training_rows:model.rows,validation_purchases:null,validation_from_day:null,candidate_recall:null,baseline_recall:null,dataset_hash:hash(w.behavior.observations),runtime_ms:model.runtimeMs,reason:'Scheduled local EASE fit using completed observations; not a new agent decision.',artifact_json:JSON.stringify(model),source:'LOCAL_EASE_MODEL'}]);
     step('Scientist','LOCAL_MODEL',w.tick+1,{cutoff:w.tick},{title:'Local recommender fitted',body:model.rows+' observed rows; '+model.ids.length+' canonical products. Learned scores feed the saved campaign policy.'});
    }
    const active=w.tick>=30&&w.tick<90,choose=active?(typeof config==='string'?compilePolicy(w,config):compileCandidate(w,model,config)):()=>null,batch=stepWorld(w,choose);
    for(const [table,rows] of Object.entries(batch.rows))if(rows.length)store.insert(table,rows);saveFrame();
   }
   assertIntegrity(w);const actual=outcome(w),expected=c.arms.multi;if(actual.platformCents!==expected.platformCents||actual.merchantCents!==expected.merchantCents||actual.purchases!==expected.purchases)throw Error('REPLAY_RESULT_MISMATCH');
   step('PayPal','LOCAL_TOOL',114,{}, {title:'Modeled payment ledger',body:'Benchmark replay uses simulated transactions only. Existing PayPal Sandbox integrations and prior verified receipts remain separate.'});
   step('Coordinator','LOCAL_TOOL',114,{result:actual},{title:'Held-out replay complete',body:`${actual.purchases} post-warmup purchases; ${expected.recommendationPurchases} bought the exact recommended product. Modeled platform contribution $${(actual.platformCents/100).toFixed(2)} before design cost.`});
   store.saveState(w);store.db.prepare('UPDATE commerce_room_runs SET state_json=? WHERE id=?').run(JSON.stringify(s),id);
  });
 }
 await writeFile('demo/data/commerce-design-replay.json',JSON.stringify({id,runId,url,seed:c.seed,scenario:c.scenario,policy:design.selection.name,scope:'First held-out seed, saved research-time agent decisions, no new paid calls or receipts.'}));
 console.log(JSON.stringify({id,runId,url,orders:store.table('orders',runId).count,models:store.table('recommendation_models',runId).count}));
}finally{store.close();}
