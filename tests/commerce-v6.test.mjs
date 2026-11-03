import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorld as v5,stepWorld as step5,outcome as outcome5} from '../scripts/commerce-economy-v5/engine.mjs';
import {createWorld as v6,stepWorld as step6,outcome as outcome6} from '../scripts/commerce-economy-v6/engine.mjs';
import {buildPriceBook,publishPriceBook,quoteRange} from '../scripts/commerce-economy-v6/quotes.mjs';
import {authoredCatalog} from '../scripts/behavior-v4/catalog.mjs';

const config={seed:880400,runId:'QUOTE-PARITY',catalog:authoredCatalog(),customers:30,days:70,campaignStop:60,scenario:'rival_sale',budgetCents:5000};
test('without a price book v6 reproduces the frozen v5 economy',()=>{
 const a=v5(config),b=v6(config);while(a.tick<a.totalTicks){step5(a);step6(b);}
 assert.deepEqual(a.behavior.orders,b.behavior.orders);assert.deepEqual(a.behavior.external,b.behavior.external);assert.deepEqual(a.commerce.cashCents,b.commerce.cashCents);assert.deepEqual(a.inventory,b.inventory);
 const x=outcome5(a),y=outcome6(b);for(const k of ['platformCents','merchantCents','retainedCents','purchases','returned','outreachCents','supportCents'])assert.equal(x[k],y[k]);
});
test('quotes preserve outside prices, refuse unauthorized changes and honor consent caps',()=>{
 const w=v6(config);while(w.tick<30)step6(w);const bases={...w.commerce.basePrices},inventory={...w.inventory},cash=[...w.commerce.cashCents];
 const byCategory=Object.fromEntries([...new Set(w.products.map(p=>p.category))].map(c=>[c,1.25])),book=buildPriceBook(w,{byCategory});
 assert.throws(()=>publishPriceBook(w,{...book,[w.products[0].product_id]:-1},{evidenceDay:30}),/UNAUTHORIZED_QUOTE/);
 assert.throws(()=>publishPriceBook(w,book,{evidenceDay:31}),/INVALID_PRICE_BOOK/);
 publishPriceBook(w,book,{evidenceDay:30});assert.deepEqual(w.commerce.cashCents,cash);assert.deepEqual(w.inventory,inventory);assert.deepEqual(w.commerce.basePrices,bases);
 const p=w.products.find(p=>p.category==='Stationery'),customer=w.customers[0];w.commerce.mandates.push({id:'CAP-CHECK',customerId:customer.customer_id,productId:p.product_id,intervalDays:7,pct:0,maxPaidCents:bases[p.product_id],nextDay:30,consentedDay:29,status:'ACTIVE',paidCount:0});
 while(w.tick<w.totalTicks)step6(w);
 assert.ok(w.commerce.events.some(e=>e.type==='SUBSCRIPTION_SKIPPED'&&e.mandateId==='CAP-CHECK'&&e.reason==='PRICE_EXCEEDS_CONSENT'));assert.equal(w.commerce.mandates[0].maxPaidCents,bases[p.product_id]);
 const allowed=new Set(Object.values(bases));assert.ok(w.behavior.external.every(o=>allowed.has(o.gross)));assert.deepEqual(w.commerce.basePrices,bases);
 for(const product of w.products){const range=quoteRange(w,product);assert.ok(product.price_cents>=range.min&&product.price_cents<=range.max);}
});
