import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createSupplyYardServer} from '../scripts/serve.mjs';
import {enrolledStores,withFeeds,loadScaleInputs,scaleProtocol} from '../scripts/commerce-expanded/harness-v2/merchant-scale.mjs';
import {canonicalHash} from '../scripts/commerce-expanded/harness-v2/contracts.mjs';
import {read,scoreCampaign} from '../scripts/commerce-expanded/harness-v2/tools.mjs';

test('increasing feed coverage exposes stock and inbound supply with nested, category-balanced merchants',async()=>{
  const {views}=await loadScaleInputs();
  for(const [i,v] of views.entries()){
    const original=canonicalHash(v),base={...v,inbound:v.products.map(p=>({productId:p.id,quantity:1}))};
    let previous=new Set();
    for(const size of scaleProtocol.feeds){
      const ids=enrolledStores(v.merchants,size,i),p=withFeeds(base,ids);
      assert.equal(ids.size,size);for(const id of previous)assert.ok(ids.has(id));previous=ids;
      for(const sellers of Map.groupBy(v.merchants,m=>m.category).values())assert.equal(sellers.filter(m=>ids.has(m.id)).length,size/4);
      assert.equal(p.audience,base.audience);assert.equal(p.pastOrders,base.pastOrders);assert.equal(p.products.length,48);assert.equal(p.inbound.length,size*4);
      for(const [n,item] of p.products.entries()){
        assert.equal(item.priceCents,v.products[n].priceCents);assert.equal(item.catalogId,v.products[n].catalogId);
        assert.equal(item.available,ids.has(item.merchantId)?v.products[n].available:0);
      }
      if(size===12)assert.equal(p,base);
    }
    assert.equal(canonicalHash(v),original);
  }
});

test('live local scoring matches the actual settled policies on day 31 and the paired financial totals reconcile',async()=>{
  const r=await read('demo/data/merchant-scale.json'),{views,model,contract,prior,hash,planMicros}=await loadScaleInputs();
  assert.equal(r.inputHash,hash);assert.equal(r.modelHash,model.modelHash);
  for(const c of r.cases){
    for(const tier of c.tiers){
      const v=withFeeds(views[c.index],new Set(tier.enrolled));
      assert.equal(canonicalHash(scoreCampaign(v,{model,contract,prior}).actions),tier.planner.firstActions);
      for(const arm of ['fixed','planner'])assert.equal(tier[arm].enrolledSellersReached,tier[arm].fulfilledSellerIds.filter(id=>tier.enrolled.includes(id)).length);
    }
  }
  for(const d of r.deployments){
    const rows=r.cases.slice(0,d.districts).map(c=>c.tiers.find(t=>t.feeds===d.feeds));
    const sum=key=>rows.reduce((s,t)=>s+t.planner[key]-t.fixed[key],0);
    assert.equal(d.shoppers,600*d.districts);assert.equal(d.stores,d.districts*d.feeds);
    assert.equal(d.delta.retained,sum('retained'));assert.ok(Math.abs(d.delta.paypal-(sum('paypalBeforeAI')-planMicros/1e6))<1e-6);
    assert.ok(d.planner.enrolledSellersReached<=d.stores);assert.ok(d.day31.p95Ms>=d.day31.medianMs);
  }
});

test('judge ranking route runs without credentials, accepts only registered sizes and returns reproducible recommendations',async()=>{
  const server=createSupplyYardServer({},null,null);server.listen(0,'127.0.0.1');await once(server,'listening');
  try{
    const base='http://127.0.0.1:'+server.address().port+'/api/market/merchant-scale/rank';
    for(const q of ['','?districts=2000&feeds=12','?districts=1&feeds=0'])assert.equal((await fetch(base+q)).status,400);
    const measured=await read('demo/data/merchant-scale.json');
    for(const districts of scaleProtocol.districts){
      const response=await fetch(base+'?districts='+districts+'&feeds=12');assert.equal(response.status,200);
      const r=await response.json(),published=measured.deployments.find(d=>d.districts===districts&&d.feeds===12);
      assert.equal(r.actionHash,published.day31.actionHash);assert.equal(r.modelHash,measured.modelHash);
      assert.equal(r.shoppers,600*districts);assert.equal(r.recommendations,published.day31.recommendations);
      assert.equal(r.inquiries,published.day31.inquiries);assert.equal(r.newModelCalls,0);
    }
  }finally{await new Promise(done=>server.close(done));}
});
