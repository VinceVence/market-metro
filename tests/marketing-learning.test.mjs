import test from 'node:test';
import assert from 'node:assert/strict';
import {createLearningMarket,advanceLearningDay,learningFrame} from '../scripts/marketing/economy.mjs';
import {FEATURES} from '../scripts/marketing/contract.mjs';
import {createMarketStore} from '../scripts/market-store.mjs';
import {createMarketService} from '../scripts/market-service.mjs';
import {SAMPLE_PRODUCTS} from '../demo/market/engine.mjs';
import {localTrainerStatus} from '../scripts/marketing/trainer.mjs';

const base={runId:'REPLAY',seed:42,customerCount:100,merchantCount:8,catalog:SAMPLE_PRODUCTS,startedAt:'2026-10-22T01:00:00.000Z'};
const offlinePayPal={status:()=>({configured:true}),profileKey:()=> 'NO_NETWORK',requestSandbox(){throw new Error('Provider calls forbidden in learning seasons');}};
const catalog={status:()=>({mode:'SAMPLE'}),products:()=>structuredClone(SAMPLE_PRODUCTS),sync(){throw new Error('Catalog calls forbidden');}};

test('keyed world randomness replays shared history across policies and changes with a new seed',()=>{
  const a=createLearningMarket({...base,policy:'adaptive'}),b=createLearningMarket({...base,policy:'fixed_rules'}),other=createLearningMarket({...base,seed:993});
  let different=false;
  for(let i=0;i<28;i++){
    const x=advanceLearningDay(a),y=advanceLearningDay(b),z=advanceLearningDay(other);
    assert.deepEqual(x.rows,y.rows);if(x.rows.orders.length!==z.rows.orders.length)different=true;
    for(const row of x.rows.customer_days){assert.equal(row.day,i);assert(FEATURES.every(k=>Number.isFinite(row[k])));}
  }
  assert(different);assert(!JSON.stringify(learningFrame(a)).includes('couponEffect'));assert(!JSON.stringify(learningFrame(a)).includes('privateTraits'));
});

test('a real local learning season fits models, honors coupon controls and reconciles its warehouse', {timeout:120000,skip:!localTrainerStatus().ready},async()=>{
  const store=createMarketStore(),service=createMarketService({store,catalog,paypal:offlinePayPal});
  let f=await service.create({kind:'learning',customerCount:100,budgetCents:25000,seed:42});
  const id=f.runId;
  while(f.status!=='COMPLETED')f=await service.advance(id,7);
  assert(f.models.length>=2);assert(f.models.every(m=>!['FAILED','UNAVAILABLE'].includes(m.status)));
  for(const m of f.models){
    assert(m.training_rows>=300&&m.validation_rows>=100);
    assert(m.train_through_day<m.validation_from_day&&m.validation_through_day<m.day);
    if(m.status==='PROMOTED')assert(m.validation_log_loss<Math.min(m.baseline_log_loss,m.champion_log_loss??Infinity)-.001);
    assert.match(m.dataset_hash,/^[a-f0-9]{64}$/);
  }
  assert(f.live.offers>0&&f.live.redemptions>0);assert(f.live.budgetSpentCents<=25000);
  assert.equal(f.stats.deliveries,f.stats.orders);
  assert.deepEqual(store.db.prepare('PRAGMA foreign_key_check').all(),[]);
  assert.equal(store.db.prepare("SELECT COUNT(*) n FROM coupons c JOIN campaign_assignments a USING(assignment_id) WHERE a.arm='HOLDOUT'").get().n,0);
  assert.equal(store.db.prepare('SELECT COUNT(*) n FROM (SELECT issued_day-LAG(issued_day) OVER (PARTITION BY customer_id ORDER BY issued_day) gap FROM coupons WHERE issued_day>=28) WHERE gap<7').get().n,0);
  assert.equal(store.db.prepare('SELECT COUNT(*) n FROM v_inventory WHERE on_hand<0').get().n,0);
  assert.equal(store.db.prepare('SELECT COUNT(*) n FROM transactions WHERE gross_cents!=fee_cents+net_cents').get().n,0);
  assert.equal(store.db.prepare('SELECT COUNT(*) n FROM coupon_redemptions r JOIN orders o USING(order_id) JOIN coupons c USING(coupon_id) WHERE r.customer_id!=o.customer_id OR r.discount_cents!=o.discount_cents OR r.discount_cents>c.max_discount_cents').get().n,0);
  const accounted=store.db.prepare('SELECT SUM(contribution_after_marketing_cents) n FROM v_daily_merchant_sales').get().n;
  assert.equal(accounted,f.stats.contributionCents);
  assert.equal(store.db.prepare('SELECT COUNT(*) n FROM paypal_receipts').get().n,0);
  assert.equal(f.retention.length,2);assert(f.retention.every(r=>r.window_end-r.window_start===14));
  const exported=JSON.stringify(store.export(id));
  for(const hidden of ['privateTraits','couponEffect','weeklyIncome','NO_NETWORK'])assert(!exported.includes(hidden));
  const firstHash=f.models[0].dataset_hash;
  let g=await service.create({kind:'learning',customerCount:100,seed:777,budgetCents:25000});
  for(let i=0;i<4;i++)g=await service.advance(g.runId,7);
  g=await service.advance(g.runId,1);assert.notEqual(g.models[0].dataset_hash,firstHash);
  store.close();
});

test('zero budget and a failed local training job produce a visible fallback without external calls',async()=>{
  const store=createMarketStore(),service=createMarketService({store,catalog,paypal:offlinePayPal,trainImpl:async()=>{throw new Error('Deliberate local failure');}});
  let f=await service.create({kind:'learning',customerCount:100,budgetCents:0});
  while(f.tick<35)f=await service.advance(f.runId,7);
  assert.equal(f.models[0].status,'FAILED');assert.equal(f.champion,null);assert.equal(f.live.offers,0);assert.equal(f.live.budgetSpentCents,0);
  assert(f.team.some(d=>d.action==='KEEP_CURRENT_POLICY'));
  await assert.rejects(()=>service.create({kind:'learning',sandboxLimit:1}),/provider payments/);
  store.close();
});
