import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,validateConfig,inverse,fitFeatures,compileCandidate} from '../scripts/commerce-design-v2/policy.mjs';
import {createWorld,stepWorld} from '../scripts/behavior-v4/engine.mjs';
import {authoredCatalog} from '../scripts/behavior-v4/catalog.mjs';
import {simulate,rankingMetrics} from '../scripts/commerce-design-v2/evaluate.mjs';

test('typed boundary rejects invalid/extra actions and future observations do not enter EASE',()=>{
 assert.throws(()=>validateConfig({...defaults(),sql:'DELETE'}));assert.throws(()=>validateConfig({...defaults(),gapDays:1}));
 const m=inverse([[2,0],[0,4]]);assert.deepEqual(m,[[.5,0],[0,.25]]);
 const w=createWorld({runId:'CHECK',seed:441,days:40,campaignStop:35,catalog:authoredCatalog()});while(w.tick<30)stepWorld(w);
 const a=fitFeatures(w.behavior.observations,w.products,30),b=fitFeatures([...w.behavior.observations,{day:31,customer_id:w.customers[0].customer_id,product_id:w.products[0].product_id,visited:1,purchased:1}],w.products,30);
 assert.deepEqual(a.profiles,b.profiles);assert.equal(a.coefficients.every((r,i)=>r[i]===0),true);
 const chooser=compileCandidate(w,a,defaults());assert.equal(typeof chooser,'function');
});
test('paired frozen economy preserves accounting, zero-response and exact recommendation attribution',()=>{
 const c={seed:442,scenario:'steady',response:0},a=simulate(c,'none'),b=simulate(c,defaults());
 assert.equal(a.purchases,b.purchases);assert.equal(a.retainedCents,b.retainedCents);assert.equal(b.recommendationPurchases,0);assert.equal(b.couponPurchases,0);assert.equal(a.initialHash,b.initialHash);assert.ok(b.outreachCents>0);
 const r=rankingMetrics({seed:443,scenario:'steady'},defaults());for(const x of Object.values(r)){assert.ok(x.skuRecall3>=0&&x.skuRecall3<=1);assert.ok(x.offerRecall3<=x.skuRecall3);}
});
