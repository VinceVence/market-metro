import test from 'node:test';
import assert from 'node:assert/strict';
import {createMarketStore} from '../scripts/market-store.mjs';
import {intelligenceSnapshot} from '../scripts/studio/intelligence.mjs';
test('intelligence counts split baskets once, uses matching model cohorts and reads without writes',()=>{
 const store=createMarketStore(),run='GARDEN-AUTO-1111111111111111',at='2026-01-01T00:00:00Z';
 try{
 store.insert('simulation_runs',[{run_id:run,started_at:at,current_tick:31,merchant_count:2,customer_count:1,status:'COMPLETED'}]);
 store.insert('merchants',[{merchant_id:'m1',run_id:run,name:'Paper'},{merchant_id:'m2',run_id:run,name:'Chairs'}]);
 store.insert('customers',[{customer_id:'u1',run_id:run}]);
 store.insert('orders',[{order_id:'o1',run_id:run,merchant_id:'m1',customer_id:'u1',event_ts:at,total_cents:4000,status:'COMPLETED'},{order_id:'o2',run_id:run,merchant_id:'m2',customer_id:'u1',event_ts:at,total_cents:6000,status:'COMPLETED'}]);
 store.insert('autonomy_baskets',[{basket_id:'basket',run_id:run,capture_day:0,gross_cents:10000,fee_cents:400,legs_json:'[]'}]);
 store.insert('products',[{product_id:'p1',run_id:run,merchant_id:'m1',category:'Paper'},{product_id:'p2',run_id:run,merchant_id:'m2',category:'Chairs'}]);
 store.insert('order_items',[{order_item_id:'i1',run_id:run,order_id:'o1',product_id:'p1',quantity:1,line_total_cents:2000},{order_item_id:'i2',run_id:run,order_id:'o1',product_id:'p1',quantity:1,line_total_cents:2000},{order_item_id:'i3',run_id:run,order_id:'o2',product_id:'p2',quantity:1,line_total_cents:6000}]);
 store.insert('refunds',[{refund_id:'refund',run_id:run,merchant_id:'m1',order_id:'o1',event_ts:at,amount_cents:500}]);
 const session={id:'AUTONOMY-1111111111111111',steps:[{id:'fit',actor:'LOCAL_MODEL',role:'Scientist',day:31,input:{rows:20},output:{modelId:'M',metrics:{auc:.51},featureNames:['prior'],validationPassed:true,runtimeSeconds:1}},{id:'llm',actor:'GEMINI',role:'Planner',toolName:'select_trained_artifact',day:31,status:'COMPLETED',costMicros:2000,input:{experiments:[{modelId:'M',report:{byContactType:{recommend:{auc:.83,logLoss:.2}}}}]},output:{rationale:'Observed recommendation validation improved.'},provider:[{inputTokens:200,outputTokens:20,thinkingTokens:40,latencyMs:120,configuredModel:'TEST_ONLY'}]}]};
 const before=store.db.prepare('SELECT total_changes() n').get().n,d=intelligenceSnapshot(store.db,run,session);
 assert.equal(d.summary.checkouts,1);assert.equal(d.summary.grossUSD,100);assert.equal(d.merchants.reduce((n,m)=>n+m.merchantOrders,0),2);assert.equal(d.merchants.reduce((n,m)=>n+m.grossUSD,0),100);assert.equal(d.summary.refundUSD,5);
 assert.equal(d.models[0].auc,.83);assert.equal(d.models[0].pooledAUC,.51);assert.equal(d.calls[0].inputTokens,200);assert.equal(d.summary.costUSD,.002);assert.equal(d.calls.length,1);assert.equal(d.gates.length,0);assert.equal(d.comparison.length,0);assert.equal(store.db.prepare('SELECT total_changes() n').get().n,before);
 assert.throws(()=>intelligenceSnapshot(store.db,"x' OR 1=1"),/Choose an existing/);
 }finally{store.close();}
});

 test('portable judge evidence reconciles payment economics and preserves the frozen comparison',async()=>{
 const {readFile}=await import('node:fs/promises'),d=JSON.parse(await readFile('demo/data/intelligence-demo.json','utf8')),frozen=JSON.parse(await readFile('demo/data/metropolis-live-results.json','utf8')).rows.find(r=>r.merchants===384);
 assert.equal(d.recordedDemo,true);assert.equal(d.run.id,frozen.runId);assert.equal(d.summary.llmCalls,12);assert.equal(d.summary.modelFits,4);assert.equal(d.summary.nativeCaptures,0);
 const fees=new Set(['PAYMENT_FEE','SUPPLIER_PAYMENT_FEE']),net=d.paymentCosts.reduce((n,x)=>n+x.amountUSD*(fees.has(x.kind)?1:-1),0)-d.summary.costUSD;
 assert.ok(Math.abs(net-frozen.planner.paypal)<1e-8);assert.equal(d.comparison.find(r=>r.policy==='Fixed rules').paypalUSD,frozen.fixed.paypal);assert.equal(d.gates.filter(g=>g.verdict==='Hold').length>0,true);
 });
