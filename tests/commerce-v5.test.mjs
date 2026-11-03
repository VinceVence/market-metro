import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,stepWorld,outcome} from '../scripts/commerce-economy-v5/engine.mjs';
import {authoredCatalog} from '../scripts/behavior-v4/catalog.mjs';
import {applyPlan,defaultPlan,validatePlan,assertCommerceIntegrity} from '../scripts/commerce-economy-v5/operations.mjs';
import {compileCommercePolicy,observedCommerce} from '../scripts/commerce-economy-v5/policies.mjs';
import {train} from '../scripts/behavior-v4/policies.mjs';
import {applyNetworkPlan,assertNetworkIntegrity} from '../scripts/commerce-economy-v5/network.mjs';
const world=(seed,response=1)=>createWorld({runId:'V5-CHECK-'+seed,seed,customers:40,days:80,campaignStop:70,catalog:authoredCatalog(),response});
function run(w,subscriptions){while(w.tick<w.totalTicks){if(w.tick===30)applyPlan(w,{...defaultPlan(),pricePct:[-5,0,5]},{evidenceDay:30});if(w.tick>=30&&w.tick<70&&(w.tick-30)%14===0)train(w);stepWorld(w,w.tick>=30&&w.tick<70?compileCommercePolicy(w,{subscriptions}):()=>null);}return outcome(w);}
test('v5 keeps consent, integer cash/inventory and customer wallets valid',()=>{
 const w=world(550101);run(w,true);assert.equal(assertCommerceIntegrity(w),true);
 for(const o of w.behavior.orders.filter(o=>o.subscription)){const m=w.commerce.mandates.find(m=>m.id===o.mandateId);assert.ok(m&&m.consentedDay<o.day);assert.ok(o.gross<=m.maxPaidCents);}
 assert.ok(w.commerce.procurement.length>0);assert.ok(w.commerce.events.some(e=>e.type==='PLAN_PUBLISHED'));
 const evidence=JSON.stringify(observedCommerce(w));for(const hidden of ['favoriteTopic','weeklyIncome','needRefill','privateTraits','priceSensitivity'])assert.equal(evidence.includes(hidden),false);
 assert.throws(()=>applyPlan(w,defaultPlan(),{evidenceDay:w.tick+1}));assert.throws(()=>validatePlan({...defaultPlan(),sql:'select'}));
});
test('disabled campaign response cannot create a new subscription or extra sale',()=>{
 const a=world(550102,0),b=world(550102,0);const x=run(a,false),y=run(b,true);
 assert.equal(y.commerce.subscriptionConsents,0);assert.equal(y.commerce.subscriptionPurchases,0);assert.equal(x.purchases,y.purchases);assert.equal(x.retainedCents,y.retainedCents);
});
test('merchant pricing cannot manipulate an outside retailer price',()=>{
 const a=world(550103),b=world(550103);
 for(const w of [a,b]){w.commerce.cashCents=[0,0,0];w.commerce.cashStartCents=0;w.commerce.initialInventoryValueCents=0;for(const p of w.products)w.inventory[p.product_id]=0;}
 applyPlan(b,{...defaultPlan(),pricePct:[10,10,10]},{evidenceDay:0});
 for(let day=0;day<20;day++){stepWorld(a,()=>null);stepWorld(b,()=>null);}
 assert.ok(a.behavior.external.length>0);assert.deepEqual(a.behavior.external,b.behavior.external);assert.deepEqual(a.customers.map(u=>u.wallet),b.customers.map(u=>u.wallet));
});
test('supplier invoices settle once, conserve funds and preserve line allocations',()=>{
 const w=world(550104);applyNetworkPlan(w,{merchantRail:'paypal',supplierRail:'paypal'});run(w,true);assert.equal(assertNetworkIntegrity(w),true);
 const n=w.commerce.network;assert.ok(n.invoices.length>0);assert.equal(new Set(n.invoices.map(i=>i.id)).size,n.invoices.length);
 for(const invoice of n.invoices){assert.equal(invoice.allocations.reduce((s,a)=>s+a.grossCents,0),invoice.grossCents);assert.equal(invoice.allocations.reduce((s,a)=>s+a.feeCents,0),invoice.feeCents);assert.equal(invoice.allocations.reduce((s,a)=>s+a.processingCents,0),invoice.processingCents);}
 assert.equal(Object.values(n.accounts).reduce((s,x)=>s+x,0),n.cashEnteredCents);assert.ok(n.accounts.platform>0);assert.equal(n.accounts.clearing,0);
});
