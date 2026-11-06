import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {once} from 'node:events';
import {canonicalHash} from '../scripts/commerce-expanded/harness-v2/contracts.mjs';
import {rankCapacity} from '../scripts/commerce-expanded/harness-v2/capacity.mjs';
import {createSupplyYardServer} from '../scripts/serve.mjs';
const read=async p=>JSON.parse(await readFile(p,'utf8'));

test('all eight districts reconcile against frozen sources and matched fixed rules',async()=>{
  const report=await read('demo/data/merchant-capacity.json'),lock=await read('docs/merchant-capacity/registration.json');
  assert.equal(report.registrationHash,canonicalHash(lock));
  for(const [file,hash] of Object.entries(lock.sources))assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'),hash,file);
  assert.deepEqual(report.cases.map(c=>c.seed),lock.protocol.seeds);
  assert.equal(report.cases.length,8);assert.equal(report.newModelCalls,0);assert.equal(report.newPayments,0);
  for(const c of report.cases){
    assert.equal(c.registrationHash,report.registrationHash);assert.equal(c.fixed.unpaidLiabilities,0);assert.equal(c.planner.unpaidLiabilities,0);
  }
  for(const d of report.deployments){
    const cases=report.cases.slice(0,d.districts);
    assert.equal(d.shoppers,d.districts*600);assert.equal(d.merchants,d.districts*12);
    for(const metric of ['paypalBeforeAI','merchants','purchases','volume'])for(const arm of ['fixed','planner']){
      assert.ok(Math.abs(d[arm][metric]-cases.reduce((n,c)=>n+c[arm][metric],0))<1e-6);
    }
    assert.ok(Math.abs(d.delta.paypal-(d.planner.paypal-d.fixed.paypal))<1e-6);
    assert.ok(Math.abs(d.paypalGainPer100-d.delta.paypal/(d.shoppers/100))<1e-6);
    assert.equal(d.day31.samples,15);assert.ok(d.day31.p95Ms>=d.day31.medianMs);
  }
});

test('the larger local ranking entry point reproduces settled day-31 decisions',async()=>{
  const report=await read('demo/data/merchant-capacity.json');
  for(const d of report.deployments){
    const scored=await rankCapacity(d.districts);
    assert.equal(scored.actionHash,d.day31.actionHash);assert.equal(scored.modelHash,report.modelHash);
    assert.equal(scored.shoppers,d.shoppers);assert.equal(scored.merchants,d.merchants);
    assert.equal(scored.recommendations,d.day31.recommendations);assert.equal(scored.inquiries,d.day31.inquiries);
  }
  const server=createSupplyYardServer({},null,null);
  try{
    server.listen(0,'127.0.0.1');await once(server,'listening');
    const url='http://127.0.0.1:'+server.address().port+'/api/market/merchant-scale/rank';
    assert.equal((await fetch(url+'?districts=8&feeds=4')).status,400);
    const response=await fetch(url+'?districts=8&feeds=12');assert.equal(response.status,200);
    const r=await response.json();assert.equal(r.shoppers,4800);assert.equal(r.newModelCalls,0);
    assert.equal(r.actionHash,report.deployments.at(-1).day31.actionHash);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
