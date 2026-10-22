import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createMarket,advanceMarket,marketFrame,eventDate} from '../demo/market/engine.mjs';
import {createMarketStore,TABLES,VIEWS,csv} from '../scripts/market-store.mjs';
import {createMarketCatalog,normalizeChannel3} from '../scripts/market-catalog.mjs';
import {createMarketService} from '../scripts/market-service.mjs';
import {SandboxError} from '../scripts/paypal-sandbox.mjs';
import {createSupplyYardServer} from '../scripts/serve.mjs';

const config={runId:'TEST',seed:773,merchantCount:24,customerCount:100,days:3,sandboxLimit:0,startedAt:'2026-10-21T01:00:00.000Z'};
function fakePayPal({error=null,lostCapture=false}={}){
  const orders=new Map();let creates=0,captures=0;
  return {status:()=>({configured:true,mode:'SANDBOX'}),profileKey:()=> 'TEST_PROFILE',list:()=>[],counts:()=>({creates,captures}),
    async requestSandbox(path,args={}){
      if(error)throw new SandboxError(409,error,'Configured test rejection');
      if(path==='/v2/checkout/orders'&&args.method==='POST'){
        creates++;assert.equal(args.body.payment_source.card.number,'4012888888881881');
        const id=`METROORDER${String(creates).padStart(4,'0')}`,unit=structuredClone(args.body.purchase_units[0]);unit.payee={merchant_id:'TEST_STORE'};
        orders.set(id,{id,status:'APPROVED',purchase_units:[unit]});return {id,status:'APPROVED'};
      }
      const match=path.match(/^\/v2\/checkout\/orders\/([^/]+)(\/capture)?$/);assert(match);
      const row=orders.get(match[1]);assert(row);
      if(match[2]){captures++;const amount=row.purchase_units[0].amount,value=Number(amount.value);row.status='COMPLETED';row.purchase_units[0].payments={captures:[{id:`METROCAPTURE${captures}`,status:'COMPLETED',amount,create_time:'2026-10-21T13:00:00.000Z',seller_receivable_breakdown:{gross_amount:amount,paypal_fee:{currency_code:'USD',value:'1.00'},net_amount:{currency_code:'USD',value:(value-1).toFixed(2)}}}]};if(lostCapture)throw new SandboxError(502,'PAYPAL_UNCONFIRMED','Lost response');}
      return structuredClone(row);
    }};
}

test('a full seeded market produces coherent normalized tables, views, stocks and delivered orders',()=>{
  const a=createMarket(config),b=createMarket(config),store=createMarketStore();store.create(a);
  while(a.status!=='COMPLETED'){const first=advanceMarket(a),second=advanceMarket(b);assert.deepEqual(first,second);store.commit(a,first);}
  assert(a.stats.orders>500);assert.equal(a.pending.length,0);assert.equal(a.stats.deliveries,a.stats.orders);
  assert.deepEqual(store.db.prepare('PRAGMA foreign_key_check').all(),[]);
  assert.equal(TABLES.length,24);assert.equal(VIEWS.length,11);
  const tx=store.db.prepare('SELECT SUM(gross_cents) gross,SUM(net_cents) net,SUM(fee_cents) fee,COUNT(*) n FROM transactions').get();
  assert.equal(tx.gross,a.stats.revenueCents);assert.equal(tx.gross,tx.net+tx.fee);assert.equal(tx.n,a.stats.orders);
  assert.equal(store.db.prepare('SELECT COUNT(*) n FROM v_marketing_transactions').get().n,tx.n);
  assert.equal(store.db.prepare('SELECT SUM(contribution_after_marketing_cents) n FROM v_daily_merchant_sales').get().n,marketFrame(a).stats.contributionCents);
  assert.equal(store.db.prepare('SELECT COUNT(*) n FROM orders WHERE subtotal_cents-discount_cents+shipping_cents!=total_cents').get().n,0);
  assert.equal(store.db.prepare('SELECT COUNT(*) n FROM v_inventory WHERE on_hand<0').get().n,0);
  for(const row of store.db.prepare('SELECT * FROM v_inventory').all())assert.equal(row.on_hand,a.inventory[row.product_id]);
  assert(a.campaigns.every(c=>c.spend_cents<=c.daily_budget_cents*3));
  assert.equal(eventDate('2026-10-20T17:00:00Z'),'2026-10-21');
  assert.throws(()=>store.table('sqlite_master','TEST'),/Unknown/);store.close();
});

test('a simulated sale has only one mirrored provider purchase; refresh cannot capture it twice',async()=>{
  const store=createMarketStore(),paypal=fakePayPal(),catalog=await createMarketCatalog(),service=createMarketService({store,paypal,catalog});
  const r=await service.create({merchantCount:12,customerCount:100,days:1,sandboxLimit:1,seed:42});await service.advance(r.runId,2);await service.drain();
  const [receipt]=service.frame(r.runId).receipts;assert.equal(receipt.status,'COMPLETED');assert.equal(receipt.fee_cents,100);assert.equal(receipt.gross_cents,receipt.fee_cents+receipt.net_cents);
  assert.deepEqual(paypal.counts(),{creates:1,captures:1});await service.refreshReceipt(receipt.receipt_id);assert.equal(paypal.counts().captures,1);
  const before=service.frame(r.runId).stats.revenueCents;assert.equal(store.db.prepare('SELECT SUM(gross_cents) n FROM transactions WHERE run_id=?').get(r.runId).n,before);
  assert.equal(store.db.prepare('SELECT COUNT(*) n FROM v_marketing_transactions WHERE run_id=?').get(r.runId).n,service.frame(r.runId).stats.orders);
  assert(!JSON.stringify(service.frame(r.runId)).includes('TEST_PROFILE'));
  assert(!JSON.stringify(store.export(r.runId)).includes('4012888888881881'));store.close();
});

test('lost capture response is reconciled and merchant capability rejection stops the batch',async()=>{
  const catalog=await createMarketCatalog();
  for(const mode of ['lost','blocked']){
    const store=createMarketStore(),paypal=fakePayPal(mode==='lost'?{lostCapture:true}:{error:'PAYEE_NOT_ENABLED_FOR_CARD_PROCESSING'}),s=createMarketService({store,paypal,catalog});
    const r=await s.create({merchantCount:12,customerCount:100,days:1,sandboxLimit:3});await s.advance(r.runId,1);await s.drain();
    const receipts=s.frame(r.runId).receipts;assert.equal(receipts[0].status,'ERROR');assert(receipts.slice(1).every(p=>p.status==='BLOCKED'));
    if(mode==='lost'){await s.refreshReceipt(receipts[0].receipt_id);assert.equal(s.frame(r.runId).receipts[0].status,'COMPLETED');assert.equal(paypal.counts().captures,1);}
    else {assert.equal(s.status().cardProcessingBlocked,true);await assert.rejects(()=>s.create({sandboxLimit:1}),/not enabled/);}
    store.close();
  }
});

test('SQLite export preserves one selected run and real SQL views without internal payment keys',async()=>{
  const store=createMarketStore();const a=createMarket(config);store.create(a);store.commit(a,advanceMarket(a));store.create(createMarket({...config,runId:'OTHER'}));
  store.insert('policy_comparisons',[{comparison_id:'C',run_id:'TEST',policy:'fixed_rules',compared_run_id:'OTHER',seed:773,source:'MATCHED_SEED_SIMULATION'}]);
  const dir=await mkdtemp(join(tmpdir(),'metro-test-'));
  try{const bytes=await store.snapshot('TEST');assert.equal(bytes.subarray(0,15).toString(),'SQLite format 3');const file=join(dir,'data.sqlite');await writeFile(file,bytes);const exported=new DatabaseSync(file);assert.equal(exported.prepare('SELECT COUNT(*) n FROM simulation_runs').get().n,1);assert.equal(exported.prepare('SELECT compared_run_id FROM policy_comparisons').get().compared_run_id,'OTHER');assert.equal(exported.prepare('SELECT COUNT(*) n FROM sqlite_master WHERE type=\'view\'').get().n,11);assert.deepEqual(exported.prepare('PRAGMA foreign_key_check').all(),[]);exported.close();}
  finally{store.close();await rm(dir,{recursive:true,force:true});}
  assert(csv({columns:['label'],rows:[{label:'=HYPERLINK("bad")'}]}).includes("'=HYPERLINK"));
});

test('Channel3 stays offline without a free-credit key, and catalog normalization rejects bad prices/URLs',async()=>{
  let calls=0;const catalog=await createMarketCatalog({env:{},fetchImpl:async()=>{calls++;throw new Error('Must not run');}});
  assert.equal(catalog.status().mode,'SAMPLE');await assert.rejects(()=>catalog.sync(),/CHANNEL3_API_KEY/);assert.equal(calls,0);
  const normalized=normalizeChannel3({products:[{id:'x',title:'Test item',price:{price:12.50,currency:'USD'},images:[{url:'https://example.com/p.png'}],url:'javascript:alert(1)'},{id:'y',title:'Bad',price:-1}]});assert.equal(normalized.length,1);assert.equal(normalized[0].priceCents,1250);assert.equal(normalized[0].sourceUrl,'');
  assert.equal(normalizeChannel3([{id:'structured',title:'Structured category',price:10,category:{path:['Office','Supplies']}}])[0].category,'Unspecified');
});

test('Channel3 reloads only its settings from the existing env file without exposing the key',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'metro-config-')),envFile=join(dir,'.env');let calls=0;
  try{
    await writeFile(envFile,'PAYPAL_CLIENT_SECRET=unrelated-test-secret\n');
    const catalog=await createMarketCatalog({env:{},envFile,fetchImpl:async()=>{calls++;throw new Error('Must not run');}});
    assert.equal(catalog.status().configured,false);
    await writeFile(envFile,'PAYPAL_CLIENT_SECRET=unrelated-test-secret\nCHANNEL3_API_KEY=local-test-key\nCHANNEL3_FREE_CREDITS_CONFIRMED=true\n');
    assert.equal(catalog.status().configured,true);assert.equal(catalog.status().freeCreditCallsEnabled,true);
    assert(!JSON.stringify(catalog.status()).includes('local-test-key'));assert.equal(calls,0);
    await writeFile(envFile,'CHANNEL3_API_KEY=local-test-key\nCHANNEL3_FREE_CREDITS_CONFIRMED=false\n');
    await assert.rejects(()=>catalog.sync(),/free\/sponsor key/);assert.equal(calls,0);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('market API serves data and exports but rejects foreign-origin mutations',async()=>{
  const store=createMarketStore(),paypal=fakePayPal(),catalog=await createMarketCatalog(),market=createMarketService({store,paypal,catalog}),server=createSupplyYardServer(paypal,undefined,market);
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
  try{let response=await fetch(origin+'/api/market/runs',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(response.status,403);
    response=await fetch(origin+'/api/market/runs',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,'X-Supply-Yard':'sandbox'},body:JSON.stringify({sandboxLimit:0})});assert.equal(response.status,200);const run=await response.json();
    response=await fetch(origin+`/api/market/table?run=${run.runId}&name=merchants`);assert.equal((await response.json()).count,24);
    response=await fetch(origin+`/api/market/export?run=${run.runId}&format=sqlite`);assert.equal(response.status,200);assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0,15).toString(),'SQLite format 3');
    assert.equal((await fetch(origin+'/.env')).status,404);
  }finally{await new Promise(r=>server.close(r));store.close();}
});
