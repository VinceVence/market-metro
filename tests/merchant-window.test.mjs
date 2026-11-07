import test from 'node:test';
import assert from 'node:assert/strict';
import {merchantWindow} from '../demo/commerce/merchant-window.mjs';
import {createLayout} from '../demo/garden/tycoon-motion.mjs';
test('every merchant district resolves to finite renderer positions and retains global identity',()=>{
 const frame={runId:'market',merchantCount:384,merchants:Array.from({length:384},(_,i)=>({merchant_id:'m'+i,position:i,name:'Store '+(i+1)})),activities:[{type:'delivery',merchantId:'m352'},{type:'delivery',merchantId:'m0'},{type:'analysis'}],stats:{orders:123}};
 const before=structuredClone(frame),seen=[];
 for(let page=0;page<12;page++){
  const w=merchantWindow(frame,page),layout=createLayout(w.frame.merchantCount);
  assert.equal(w.frame.merchants.length,32);
  for(const m of w.frame.merchants){assert.ok(Number.isFinite(layout.merchants[m.position]?.x));assert.ok(Number.isFinite(layout.merchants[m.position]?.z));seen.push(m.merchant_id);}
  assert.equal(w.frame.merchants[0].displayNumber,page*32+1);assert.equal(w.frame.stats.orders,123);
 }
 assert.equal(new Set(seen).size,384);assert.deepEqual(frame,before);
 const last=merchantWindow(frame,999);assert.equal(last.page,11);assert.equal(last.first,353);assert.equal(last.last,384);assert.deepEqual(last.frame.activities.map(x=>x.merchantId),['m352',undefined]);
});
