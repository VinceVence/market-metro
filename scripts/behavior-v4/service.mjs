import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {materialize} from './materialize.mjs';
import {environment,read,ROOT} from './config.mjs';
import {VERSION} from './engine.mjs';
import {createBehaviorService} from '../behavior-v3/service.mjs';
import {SandboxError} from '../paypal-sandbox.mjs';
export function createOwnMarketService({store}){
 const legacy=createBehaviorService({store}),busy=new Map();let resources;
 const ready=()=>resources??=(async()=>{const env=await environment(),approval=await read('approval.json');if(approval.status!=='COMPLETED'||approval.simulationHash!==env.protocol.hash)throw Error('OWNED_PLAN_NOT_READY');return {...env,approval};})();
 const check=id=>{if(!/^GARDEN-OWN-[a-f0-9]{16}$/.test(id))throw new SandboxError(400,'INVALID_OWN_RUN','Choose a run generated from the authored catalog.');};
 return {async status(){const r=await ready();return {version:VERSION,catalog:'AUTHORED_SIMULATION',defaults:{...r.protocol.demo,customers:100},scenarios:r.protocol.evaluationScenarios,mode:'RECORDED_FRESH_GEMINI_PROGRAM',newModelCallsPerReplay:0,newNativePaymentsPerReplay:0};},
 async start(input){const key=JSON.stringify(input);if(busy.has(key))return busy.get(key);const promise=(async()=>{try{return await materialize({store,input,...await ready()});}catch(e){throw new SandboxError(400,'OWNED_RUN_REJECTED',e.message);}})().finally(()=>busy.delete(key));busy.set(key,promise);return promise;},
 async get(id){if(id.startsWith('GARDEN-BEHAVIOR-'))return legacy.get(id);check(id);try{return JSON.parse(await readFile(resolve(ROOT,'.local/behavior-v4',id+'.json')));}catch(e){if(e.code==='ENOENT')throw new SandboxError(404,'OWNED_RUN_NOT_FOUND','Generate this authored market first.');throw e;}},
 trace(id,customer){if(id.startsWith('GARDEN-BEHAVIOR-'))return legacy.trace(id,customer);check(id);if(!store.db.prepare('SELECT 1 FROM customers WHERE run_id=? AND customer_id=?').get(id,customer))throw new SandboxError(404,'CUSTOMER_NOT_FOUND','Choose a shopper in this market.');return {runId:id,customerId:customer,actions:store.db.prepare('SELECT day,kind,offered_pct,product_id,order_id,reason FROM behavior_actions WHERE run_id=? AND customer_id=? AND kind<>? ORDER BY day').all(id,customer,'none'),orders:store.db.prepare('SELECT o.order_id,o.event_date,o.total_cents,o.channel,p.title,p.catalog_item_id,t.transaction_id,r.capture_id,r.status paypal_status FROM orders o JOIN order_items i USING(order_id) JOIN products p USING(product_id) JOIN transactions t USING(order_id) LEFT JOIN paypal_receipts r USING(order_id) WHERE o.run_id=? AND o.customer_id=? ORDER BY o.event_ts').all(id,customer),lifecycle:store.db.prepare('SELECT day,previous_state,next_state,reason FROM behavior_lifecycle WHERE run_id=? AND customer_id=? ORDER BY day').all(id,customer),lifecycleDisclosure:'Evaluator truth; excluded from agent input.'};}}
}
