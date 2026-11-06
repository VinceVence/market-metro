import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('shared live-market results preserve completed runs, model costs and the mixed smaller result',async()=>{
  const report=JSON.parse(await readFile('demo/data/metropolis-live-results.json','utf8'));
  assert.equal(report.capMerchants,384);assert.deepEqual(report.rows.map(r=>r.merchants),[96,192,384]);
  const responses=[];
  for(const row of report.rows){
    assert.equal(row.shoppers,row.merchants*50);assert.equal(row.profile,'metropolis-'+row.merchants);
    assert.equal(row.status,'COMPLETED');assert.equal(row.day,126);assert.equal(row.unpaidLiabilities,0);
    assert.equal(row.decisions.length,12);assert.deepEqual([...new Set(row.decisions.map(d=>d.day))],[31,61]);
    const events=row.decisions.flatMap(d=>d.provider);
    assert.ok(events.every(e=>e.status==='settled'));responses.push(...events.map(e=>e.responseId));
    assert.equal(events.reduce((n,e)=>n+e.costMicros,0),Math.round(row.modelCostUSD*1e6));
    assert.ok(row.modelCostUSD<=.19);
    for(const metric of ['paypal','merchants','purchases','volume'])assert.ok(Math.abs(row.planner[metric]-row.fixed[metric]-row.delta[metric])<1e-6);
    assert.ok(Math.abs(row.paypalGainPer100-row.delta.paypal*100/row.shoppers)<1e-6);
  }
  assert.equal(new Set(responses).size,36);assert.ok(responses.every(Boolean));
  assert.ok(report.rows[0].delta.merchants<0);
  const largest=report.rows.at(-1),eight=largest.models.find(m=>m.features?.length===8);
  assert.ok(eight);assert.equal(largest.publications[0].modelComparison.anchor.modelHash,eight.hash);
  assert.equal(largest.publications[0].published,true);assert.equal(largest.publications[1].published,false);
  assert.equal(Math.round(report.newModelCostUSD*1e6),report.attempts.reduce((n,r)=>n+Math.round(r.costUSD*1e6),0));
  assert.ok(report.projectModelCostUSD<50);assert.equal(report.nativePayments,0);
});
