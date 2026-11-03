import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {materialize} from './materialize.mjs';
import {lock,read} from './benchmark.mjs';
import {VERSION} from './engine.mjs';
import {SandboxError} from '../paypal-sandbox.mjs';
const ROOT=resolve(import.meta.dirname,'../..');
export function createBehaviorService({store}){
 const busy=new Map();let resources;
 const ready=()=>resources??=(async()=>{const {p,catalog}=await lock(),approval=await read('agent.json'),source=await read('agent-protocol.json');if(approval.status!=='COMPLETED'||source.simulationHash!==p.hash||approval.protocolHash!==source.hash)throw Error('V3_AGENT_APPROVAL_UNAVAILABLE');return {protocol:p,catalog,approval};})();
 const check=id=>{if(!/^GARDEN-BEHAVIOR-[a-f0-9]{16}$/.test(id))throw new SandboxError(400,'INVALID_BEHAVIOR_RUN','Use a corrected-market run ID.');};
 return {async status(){const r=await ready();return {version:VERSION,defaults:{seed:r.protocol.demo.seed,scenario:r.protocol.demo.scenario,customers:100},scenarios:r.protocol.evaluationScenarios,mode:'RECORDED_AGENT_PROGRAM_WITH_FRESH_LOCAL_SIMULATION',newModelCallsPerReplay:0,newNativePaymentsPerReplay:0};},
  async start(input){const key=JSON.stringify(input);if(busy.has(key))return busy.get(key);const task=(async()=>{try{return await materialize({store,input,...await ready()});}catch(e){if(e instanceof SandboxError)throw e;throw new SandboxError(400,'BEHAVIOR_RUN_REJECTED',e.message);}})().finally(()=>busy.delete(key));busy.set(key,task);return task;},
  async get(id){check(id);try{return JSON.parse(await readFile(resolve(ROOT,'.local/behavior-v3',id+'.json'),'utf8'));}catch(e){if(e.code==='ENOENT')throw new SandboxError(404,'BEHAVIOR_RUN_NOT_FOUND','Generate this simulation first.');throw e;}},
  trace(id,customer){check(id);if(typeof customer!=='string'||!store.db.prepare('SELECT1 FROM customers WHERE run_id=? AND customer_id=?'.replace('SELECT1','SELECT 1')).get(id,customer))throw new SandboxError(404,'CUSTOMER_NOT_FOUND','Choose a shopper from this corrected market.');return {runId:id,customerId:customer,actions:store.db.prepare('SELECT day,kind,offered_pct,product_id,order_id,reason FROM behavior_actions WHERE run_id=? AND customer_id=? AND kind<>? ORDER BY day').all(id,customer,'none'),events:store.db.prepare("SELECT event_date,event_type,product_id,order_id,detail_json FROM events WHERE run_id=? AND customer_id=? AND event_type IN ('search_intent','product_view','purchase','refunded','customer_acquired','customer_reactivated','customer_dormant') ORDER BY event_ts,rowid").all(id,customer),orders:store.db.prepare('SELECT o.order_id,o.event_date,o.total_cents,o.channel,p.title,p.channel3_product_id,t.transaction_id,r.capture_id,r.status paypal_status FROM orders o JOIN order_items i USING(order_id) JOIN products p USING(product_id) JOIN transactions t USING(order_id) LEFT JOIN paypal_receipts r USING(order_id) WHERE o.run_id=? AND o.customer_id=? ORDER BY o.event_ts').all(id,customer),lifecycle:store.db.prepare('SELECT day,previous_state,next_state,reason FROM behavior_lifecycle WHERE run_id=? AND customer_id=? ORDER BY day').all(id,customer),lifecycleDisclosure:'Evaluator/visualization truth, not planner input.'};}
 };
}
