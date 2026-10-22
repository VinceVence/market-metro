import {createLearningMarket,learningFrame,POLICIES} from './marketing/economy.mjs';
import {createLearningRunner} from './marketing/orchestrator.mjs';
import { randomUUID } from 'node:crypto';
import { createMarket, advanceMarket, marketFrame, eventDate } from '../demo/market/engine.mjs';
import { SandboxError, moneyCents } from './paypal-sandbox.mjs';

export const NATIVE_SAMPLE_LIMIT=3,NATIVE_SAMPLE_MAX_CENTS=100000;
const VAULT_METHOD='PAYPAL_WALLET_VAULT';
export function createMarketService({store,catalog,paypal,trainImpl,funding=null}) {
  const learning=createLearningRunner({store,trainImpl});let comparisonRunning=false;
  const running=new Map(),settlements=new Map();let draining=false,drainPromise=Promise.resolve();
  const reject=(code,message)=>{throw new SandboxError(400,code,message);};
  const lookup=id=>{const w=store.state(id);if(!w)throw new SandboxError(404,'RUN_NOT_FOUND','Market run not found.');return w;};
  function receiptRows(id){return store.table('paypal_receipts',id,{limit:100}).rows;}
  function frame(id,activities=[]){const w=lookup(id);const recentActivity=store.db.prepare("SELECT o.order_id AS orderId,o.merchant_id AS merchantId,m.name AS merchant,o.total_cents AS amount,p.title AS product,'purchase' AS type FROM orders o JOIN merchants m USING(merchant_id) JOIN order_items i USING(order_id) JOIN products p USING(product_id) WHERE o.run_id=? ORDER BY o.event_ts DESC,o.rowid DESC LIMIT 4").all(id).reverse();return {...(w.kind==='LEARNING_MARKET_V2'?learningFrame(w):marketFrame(w)),activities,recentActivity,catalog:catalog.status(),receipts:receiptRows(id),sandboxSampleLimit:w.sandboxSampleLimit||0,tables:store.catalog(id)};}
  function updateReceipt(id,values){const keys=Object.keys(values);store.db.prepare(`UPDATE paypal_receipts SET ${keys.map(k=>k+'=?').join(',')} WHERE receipt_id=?`).run(...keys.map(k=>values[k]),id);}
  function inspect(order,row){
    const units=order.purchase_units,unit=units?.[0];
    if(order.id!==row.paypal_order_id||units?.length!==1||unit.reference_id!==row.receipt_id||unit.custom_id!==row.order_id||unit.invoice_id!==`MM-${row.receipt_id}`||moneyCents(unit.amount)!==row.gross_cents)throw new SandboxError(502,'SANDBOX_ORDER_MISMATCH','Provider order failed its amount and reference checks.');
    const captures=unit.payments?.captures||[];
    if(captures.length>1)throw new SandboxError(502,'MULTIPLE_CAPTURES','Expected exactly one sandbox capture.');
    const c=captures[0];if(!c){if(order.status==='COMPLETED')throw new SandboxError(502,'MISSING_NATIVE_CAPTURE','PayPal marked the order complete without a verifiable capture.');return null;}
    if(!/^[A-Z0-9]{8,32}$/.test(c.id)||moneyCents(c.amount)!==row.gross_cents)throw new SandboxError(502,'SANDBOX_CAPTURE_MISMATCH','Provider capture did not match the generated order.');
    let fee=null,net=null;const b=c.seller_receivable_breakdown;
    if(b?.paypal_fee&&b.net_amount&&b.gross_amount){fee=moneyCents(b.paypal_fee);net=moneyCents(b.net_amount);if(fee+net!==row.gross_cents||moneyCents(b.gross_amount)!==row.gross_cents)throw new SandboxError(502,'SANDBOX_FEE_MISMATCH','Provider amounts do not reconcile.');}
    return {status:c.status,capture_id:c.id,fee_cents:fee,net_cents:net,captured_at:c.create_time||null,verified_at:new Date().toISOString(),payee_merchant_id:unit.payee?.merchant_id||null,error_code:null,event_date:eventDate(c.create_time||new Date().toISOString())};
  }
  async function settle(row){
    if(settlements.has(row.receipt_id))return settlements.get(row.receipt_id);
    const task=settleOne(store.db.prepare('SELECT * FROM paypal_receipts WHERE receipt_id=?').get(row.receipt_id));settlements.set(row.receipt_id,task);try{return await task;}finally{settlements.delete(row.receipt_id);}
  }
  function sourceFor(row){
    if(row.funding_method===VAULT_METHOD){
      if(!funding?.status().ready)throw new SandboxError(409,'SANDBOX_BUYER_REQUIRED','Connect the sandbox buyer once before continuing this sample.');
      if(row.funding_key!==funding.fingerprint())throw new SandboxError(409,'FUNDING_CHANGED','This sample belongs to a different saved sandbox buyer. Reconcile it without replacing its request keys.');
      return funding.paymentSource();
    }
    return {card:{name:'Market Metro Sandbox Buyer',number:'4012888888881881',expiry:'2030-12',security_code:'123',billing_address:{address_line_1:'123 Test Street',admin_area_2:'San Jose',admin_area_1:'CA',postal_code:'95131',country_code:'US'}}};
  }
  async function settleOne(row){
    if(row.profile_key!==paypal.profileKey())throw new SandboxError(409,'ACCOUNT_CHANGED','Use the sandbox app that created this receipt.');
    if(!row.paypal_order_id){
      if(Date.now()-Date.parse(row.created_at)>5*3600000)throw new SandboxError(409,'RECONCILE_REQUIRED','An older uncertain request needs reconciliation before any new attempt.');
      const paymentSource=sourceFor(row);
      updateReceipt(row.receipt_id,{status:'CREATING',error_code:null});
      const order=store.db.prepare('SELECT * FROM orders WHERE order_id=?').get(row.order_id);
      if(!order||order.run_id!==row.run_id||order.merchant_id!==row.merchant_id||order.currency!==row.currency||order.total_cents!==row.gross_cents)throw new SandboxError(409,'EMULATOR_ORDER_CHANGED','The emulator order changed after this sample was reserved. Reconcile it before any payment retry.');
      const item=store.db.prepare('SELECT p.title FROM order_items i JOIN products p USING(product_id) WHERE i.order_id=? LIMIT 1').get(row.order_id);
      const data=await paypal.requestSandbox('/v2/checkout/orders',{method:'POST',requestId:row.create_request_id,body:{
        intent:'CAPTURE',
        purchase_units:[{reference_id:row.receipt_id,custom_id:row.order_id,invoice_id:`MM-${row.receipt_id}`,description:`Market Metro simulation · ${(item?.title||'Market purchase').slice(0,90)}`,amount:{currency_code:'USD',value:(order.total_cents/100).toFixed(2)}}],
        payment_source:paymentSource,
      }});
      if(!/^[A-Z0-9]{8,32}$/.test(data.id||''))throw new SandboxError(502,'INVALID_PROVIDER_ID','PayPal returned no usable order ID.');
      updateReceipt(row.receipt_id,{paypal_order_id:data.id,status:data.status});row={...row,paypal_order_id:data.id};
    }
    let data=await paypal.requestSandbox(`/v2/checkout/orders/${row.paypal_order_id}`);
    const captured=inspect(data,row);
    if(captured){updateReceipt(row.receipt_id,captured);return;}
    if(data.status==='APPROVED') {
      const captureBody=row.funding_method===VAULT_METHOD?{payment_source:sourceFor(row)}:{};
      try{await paypal.requestSandbox(`/v2/checkout/orders/${row.paypal_order_id}/capture`,{method:'POST',body:captureBody,requestId:row.capture_request_id});}
      catch(e){if(e.code!=='ORDER_ALREADY_CAPTURED')throw e;}
      data=await paypal.requestSandbox(`/v2/checkout/orders/${row.paypal_order_id}`);
      const confirmed=inspect(data,row);if(confirmed){updateReceipt(row.receipt_id,confirmed);return;}
    }
    updateReceipt(row.receipt_id,{status:data.status||'PAYER_ACTION_REQUIRED',error_code:'BUYER_ACTION_REQUIRED',verified_at:new Date().toISOString()});
  }
  function drain(){
    if(draining)return drainPromise;
    if(!paypal.status().configured)return Promise.resolve();
    draining=true;
    drainPromise=(async()=>{try {
      while(true){
        const row=store.db.prepare("SELECT * FROM paypal_receipts WHERE status='QUEUED' AND profile_key=? ORDER BY created_at LIMIT 1").get(paypal.profileKey());
        if(!row)break;
        try{await settle(row);}catch(e){
          updateReceipt(row.receipt_id,{status:'ERROR',error_code:e.code||'SANDBOX_UNCONFIRMED'});
          // Stop this batch on a capability or transport error. No loop of speculative replacement payments.
          store.db.prepare("UPDATE paypal_receipts SET status='BLOCKED',error_code=? WHERE run_id=? AND status='QUEUED'").run(e.code||'SANDBOX_UNCONFIRMED',row.run_id);break;
        }
      }
    } finally {draining=false;}})();
    return drainPromise;
  }
  function queue(world,orders){
    for(const o of orders.filter(o=>o.sandbox_requested)){
      const at=new Date().toISOString();
      store.insert('paypal_receipts',[{receipt_id:randomUUID(),run_id:world.runId,order_id:o.order_id,merchant_id:o.merchant_id,profile_key:paypal.profileKey(),status:paypal.status().configured?'QUEUED':'NOT_CONFIGURED',currency:'USD',gross_cents:o.total_cents,created_at:at,event_date:eventDate(at),create_request_id:randomUUID(),capture_request_id:randomUUID(),funding_method:'LEGACY_SANDBOX_CARD',source:'PAYPAL_SANDBOX'}]);
    }
  }
  function candidates(id){
    const w=lookup(id),from=new Date(Date.parse(w.startedAt)+(w.kind==='LEARNING_MARKET_V2'?28:0)*86400000).toISOString();
    return store.db.prepare(`SELECT o.order_id,o.event_ts,o.event_date,o.total_cents,o.discount_cents,o.merchant_id,m.name AS merchant_name,c.coupon_id,c.discount_pct,
      (SELECT p.title FROM order_items i JOIN products p USING(product_id) WHERE i.order_id=o.order_id LIMIT 1) AS product_title
      FROM orders o JOIN merchants m USING(merchant_id) LEFT JOIN coupon_redemptions cr ON cr.order_id=o.order_id LEFT JOIN coupons c ON c.coupon_id=cr.coupon_id
      WHERE o.run_id=? AND o.source='SIMULATED' AND o.status='PAID' AND o.currency='USD' AND o.total_cents BETWEEN 1 AND ? AND o.event_ts>=?
      AND NOT EXISTS(SELECT 1 FROM paypal_receipts p WHERE p.order_id=o.order_id) AND NOT EXISTS(SELECT 1 FROM refunds r WHERE r.order_id=o.order_id)
      ORDER BY CASE WHEN c.coupon_id IS NOT NULL THEN 0 ELSE 1 END,o.event_ts DESC,o.order_id LIMIT 30`).all(id,NATIVE_SAMPLE_MAX_CENTS,from);
  }
  function enqueueSelected(id,ids){
    const w=lookup(id);
    if(w.kind!=='LEARNING_MARKET_V2')reject('LEARNING_REQUIRED','Choose a learning-market season for saved-wallet samples.');
    if(!funding?.status().ready)throw new SandboxError(409,'SANDBOX_BUYER_REQUIRED','Approve the sandbox buyer once; later runs reuse that consent.');
    if(!Array.isArray(ids)||ids.length<1||ids.length>NATIVE_SAMPLE_LIMIT||new Set(ids).size!==ids.length||ids.some(x=>typeof x!=='string'||x.length>160))reject('INVALID_ORDER_SELECTION','Select one to three distinct emulator orders.');
    return store.transaction(()=>{
      const prior=store.db.prepare('SELECT * FROM paypal_receipts WHERE run_id=?').all(id),fresh=[];
      for(const orderId of ids){
        const order=store.db.prepare('SELECT * FROM orders WHERE run_id=? AND order_id=?').get(id,orderId);
        if(!order||order.source!=='SIMULATED'||order.status!=='PAID'||order.currency!=='USD'||!Number.isInteger(order.total_cents)||order.total_cents<1||order.total_cents>NATIVE_SAMPLE_MAX_CENTS)reject('INELIGIBLE_ORDER','Use a paid USD order from this emulator season.');
        const existing=prior.find(r=>r.order_id===orderId);
        if(existing){if(existing.profile_key!==paypal.profileKey())reject('ACCOUNT_CHANGED','An existing sample belongs to a different sandbox app.');continue;}
        fresh.push(order);
      }
      if(prior.length+fresh.length>NATIVE_SAMPLE_LIMIT||[...prior.map(p=>p.gross_cents),...fresh.map(o=>o.total_cents)].reduce((a,b)=>a+b,0)>NATIVE_SAMPLE_MAX_CENTS)reject('SAMPLE_CAP','Each season is limited to three selected orders and $1,000 in sandbox test funds.');
      for(const order of fresh){
        const at=new Date().toISOString();
        store.insert('paypal_receipts',[{receipt_id:randomUUID(),run_id:id,order_id:order.order_id,merchant_id:order.merchant_id,profile_key:paypal.profileKey(),status:'QUEUED',currency:'USD',gross_cents:order.total_cents,created_at:at,event_date:eventDate(at),create_request_id:randomUUID(),capture_request_id:randomUUID(),funding_method:VAULT_METHOD,funding_key:funding.fingerprint(),source:'PAYPAL_SANDBOX'}]);
        store.db.prepare('UPDATE orders SET sandbox_requested=1 WHERE order_id=?').run(order.order_id);
      }
      return fresh.length;
    });
  }
  function autoSample(w){
    if(!w.sandboxSampleLimit||w.tick<=28||!funding?.status().ready)return;
    const existing=receiptRows(w.runId),remaining=w.sandboxSampleLimit-existing.length;
    let budget=NATIVE_SAMPLE_MAX_CENTS-existing.reduce((a,r)=>a+r.gross_cents,0);const chosen=[];
    for(const o of candidates(w.runId)){if(chosen.length>=remaining)break;if(o.total_cents<=budget){chosen.push(o.order_id);budget-=o.total_cents;}}
    if(chosen.length)enqueueSelected(w.runId,chosen);
  }
  return {
    paymentSample(id){const w=lookup(id),receipts=receiptRows(id);return {runId:id,funding:funding?.status()||{ready:false,mode:'SANDBOX'},automaticLimit:w.sandboxSampleLimit||0,maxOrders:NATIVE_SAMPLE_LIMIT,maxCents:NATIVE_SAMPLE_MAX_CENTS,remaining:Math.max(0,NATIVE_SAMPLE_LIMIT-receipts.length),reservedCents:receipts.reduce((a,r)=>a+r.gross_cents,0),completed:receipts.filter(r=>r.status==='COMPLETED').length,running:draining,candidates:candidates(id),receipts,lineage:store.table('v_paypal_order_lineage',id,{limit:10}).rows};},
    async mirror(id,ids){enqueueSelected(id,ids);await drain();return frame(id);},
    status(){const blocked=store.db.prepare("SELECT 1 FROM paypal_receipts WHERE profile_key=? AND error_code='PAYEE_NOT_ENABLED_FOR_CARD_PROCESSING' LIMIT 1").get(paypal.profileKey());return {trainer:learning.status(),comparisonRunning,catalog:catalog.status(),paypal:paypal.status(),funding:funding?.status()||{ready:false,mode:'SANDBOX'},cardProcessingBlocked:Boolean(blocked),sandboxBatchRunning:draining,latest:store.latest(),runs:store.runs()};},
    frame,store,
    async create(input={}){
      if(input.kind==='learning'){
        const seed=Number(input.seed??42),customerCount=Number(input.customerCount??600),merchantCount=Number(input.merchantCount??8),budgetCents=Number(input.budgetCents??120000);
        const policy=input.policy||'adaptive',objective=input.objective||'retention',scenario=input.scenario||'rival_sale',sandboxSampleLimit=Number(input.sandboxSampleLimit||0);
        if(![0,1,3].includes(sandboxSampleLimit))reject('INVALID_SAMPLE_LIMIT','Choose zero, one or three native sandbox samples.');
        if(sandboxSampleLimit&&!funding?.status().ready)throw new SandboxError(409,'SANDBOX_BUYER_REQUIRED','Connect a sandbox buyer once before enabling automatic samples.');
        if(!Number.isInteger(seed)||seed<0||seed>4294967295||!Number.isInteger(customerCount)||customerCount<100||customerCount>1200||![8,12].includes(merchantCount)||!Number.isInteger(budgetCents)||budgetCents<0||budgetCents>1000000||!POLICIES.includes(policy)||!['retention','profit','conversion'].includes(objective)||!['rival_sale','budget_squeeze','supply_delay','steady'].includes(scenario)||Number(input.sandboxLimit||0)!==0)reject('INVALID_LEARNING_SETTINGS','Use supported local season settings; this mode does not initiate provider payments.');
        const runId='GARDEN-'+Date.now().toString(36)+'-'+randomUUID().slice(0,8),date=eventDate(new Date().toISOString());
        const world=createLearningMarket({runId,seed,customerCount,merchantCount,budgetCents,policy,objective,scenario,startedAt:date+'T01:00:00.000Z',catalog:catalog.products()});
        world.sandboxSampleLimit=sandboxSampleLimit;store.create(world);learning.init(world);return frame(runId);
      }
      const merchantCount=Number(input.merchantCount??24),customerCount=Number(input.customerCount??600),days=Number(input.days??3),sandboxLimit=Number(input.sandboxLimit??3),seed=Number(input.seed??42);
      if(![12,24,36].includes(merchantCount)||!Number.isInteger(customerCount)||customerCount<50||customerCount>2000||![1,3,7].includes(days)||![0,1,3,5,10].includes(sandboxLimit)||!Number.isInteger(seed)||seed<0||seed>4294967295)reject('INVALID_MARKET_SETTINGS','Choose supported population, duration and sandbox sample limits.');
      if(sandboxLimit>0&&this.status().cardProcessingBlocked)throw new SandboxError(409,'SANDBOX_CARD_CAPABILITY','This merchant is not enabled for sandbox card processing. Choose simulation only; no repeated checkout is needed for the city.');
      const runId=`MM-${Date.now().toString(36)}-${randomUUID().slice(0,8)}`;
      // A local 09:00 business day keeps simulation dates explicit; provider receipt timestamps stay untouched.
      const now=new Date(),date=eventDate(now.toISOString());
      const world=createMarket({runId,seed,merchantCount,customerCount,days,sandboxLimit,startedAt:`${date}T01:00:00.000Z`,catalog:catalog.products()});
      store.create(world);return frame(runId);
    },
    async advance(id,count=1){
      if(running.has(id))return running.get(id);
      const work=(async()=>{let w=lookup(id),activities=[];
        const steps=Math.min(24,Math.max(1,Math.trunc(Number(count)||1)));
        if(w.kind==='LEARNING_MARKET_V2'){const result=await learning.advance(w,steps);autoSample(result.world);if(result.world.sandboxSampleLimit)void drain();return frame(id,result.activities);}
        for(let i=0;i<steps&&w.status!=='COMPLETED';i++){
          const next=structuredClone(w),batch=advanceMarket(next);
          store.transaction(()=>{for(const t of ['orders','order_items','transactions','refunds','deliveries','inventory_movements','campaign_spend','events'])store.insert(t,batch.rows[t]||[]);queue(next,batch.rows.orders||[]);store.saveState(next);});
          w=next;activities.push(...batch.activities);
        }
        void drain();return frame(id,activities.slice(-100));
      })();running.set(id,work);try{return await work;}finally{running.delete(id);}
    },
    control(id,input){const w=lookup(id);if(w.kind==='LEARNING_MARKET_V2')reject('SEASON_LOCKED','Seed, scenario and objective are fixed per season for reproducible comparisons. Start a new season to change them.');if(w.status==='COMPLETED')reject('MARKET_CLOSED','Start a new run to change market conditions.');
      if('promotion' in input)w.promotion=Boolean(input.promotion);
      if('shock' in input){if(![null,'payday','supply','competition'].includes(input.shock))reject('INVALID_SHOCK','Unknown market event.');w.shock=input.shock;}
      const stamp=new Date(Date.parse(w.startedAt)+w.tick*3600000).toISOString();
      store.transaction(()=>{store.insert('events',[{event_id:`${id}-CTRL-${randomUUID()}`,run_id:id,event_ts:stamp,event_date:eventDate(stamp),channel:'system',event_type:'market_control',detail_json:JSON.stringify({promotion:w.promotion,shock:w.shock}),source:'USER_SIMULATION_CONTROL'}]);store.saveState(w);});return frame(id);
    },
    async refreshReceipt(receiptId){const row=store.db.prepare('SELECT * FROM paypal_receipts WHERE receipt_id=?').get(receiptId);if(!row)throw new SandboxError(404,'RECEIPT_NOT_FOUND','Sandbox receipt not found.');
      if(draining)throw new SandboxError(409,'BATCH_RUNNING','Wait for the current sandbox batch.');
      if(!row.paypal_order_id&&row.funding_method!==VAULT_METHOD)throw new SandboxError(409,'NO_PROVIDER_ORDER','No confirmed PayPal order ID exists. Check the displayed error before trying another run.');
      try{await settle(row);}catch(e){updateReceipt(row.receipt_id,{status:'ERROR',error_code:e.code||'SANDBOX_UNCONFIRMED'});throw e;}return frame(row.run_id);
    },
    async compare(id){
      const parent=lookup(id);if(parent.kind!=='LEARNING_MARKET_V2')reject('LEARNING_REQUIRED','Choose a learning-market season.');
      if(comparisonRunning)throw new SandboxError(409,'COMPARISON_RUNNING','A local policy comparison is already running.');
      if(running.has(id))throw new SandboxError(409,'RUN_BUSY','Pause the season and wait for its current step.');
      comparisonRunning=true;
      const sourceCatalog=[...new Map(parent.products.map(p=>[p.channel3_product_id||p.title,{id:p.channel3_product_id||p.product_id,channel3Id:p.channel3_product_id,title:p.title,brand:p.brand,category:p.category,priceCents:p.price_cents,currency:'USD',source:p.source,sourceUrl:p.source_url,imageUrl:p.image_url,retrievedAt:p.retrieved_at}])).values()];
      const results=[];
      try{for(const policy of ['no_offers','fixed_rules','scheduled_ml','adaptive']){
        const runId='COMPARE-'+Date.now().toString(36)+'-'+randomUUID().slice(0,8);
        let w=createLearningMarket({runId,seed:parent.seed,customerCount:parent.customers.length,merchantCount:parent.merchants.length,budgetCents:parent.goal.budgetCents,policy,objective:parent.goal.objective,scenario:parent.scenario,startedAt:parent.startedAt,catalog:sourceCatalog});
        store.create(w);learning.init(w);
        while(w.status!=='COMPLETED')w=(await learning.advance(w,7)).world;
        const f=learningFrame(w),row={comparison_id:id+'-'+policy+'-'+randomUUID(),run_id:id,policy,compared_run_id:runId,seed:w.seed,purchases:w.live.orders,gross_cents:w.live.revenueCents,contribution_cents:f.live.contributionCents,coupon_cost_cents:w.live.discountCents,outreach_cents:w.live.spendCents,redemptions:w.live.redemptions,model_trains:w.models.length,source:'MATCHED_SEED_SIMULATION'};
        store.insert('policy_comparisons',[row]);results.push(row);
      }return {results,seed:parent.seed,scope:'Same observed history, catalog, external random draws, objective and budget. One-seed simulation, not real-world causal ROI.'};}
      finally{comparisonRunning=false;}
    },
    syncCatalog:()=>catalog.sync(),drain,
  };
}
