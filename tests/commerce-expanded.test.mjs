import test from 'node:test';
import assert from 'node:assert/strict';
import {createGrowthWorld,beginGrowthDay,endGrowthDay,observeGrowthWorld,contactCustomer,assertGrowthIntegrity} from '../scripts/commerce-expanded/environment.mjs';
import {commerceTurn} from '../scripts/commerce-expanded/commerce.mjs';
import {createGrowthWorld as createOriginal} from '../scripts/commerce-growth/environment.mjs';
import {outreachPlan,DEFAULT} from '../scripts/commerce-growth/team/control.mjs';
import {projection,marketFrame,warehouseBatch} from '../scripts/commerce-growth/autonomy/live-data.mjs';

test('12/600 scales population and supply without changing existing shopper needs or prices',()=>{
 const small=createOriginal({seed:987777,regime:'discovery'}),w=createGrowthWorld({seed:987777,regime:'discovery'});
 assert.equal(w.merchants.length,12);assert.equal(w.people.length,600);assert.equal(w.products.length,48);
 assert.deepEqual(w.catalog,small.catalog);assert.deepEqual(w.people.slice(0,100),small.people);
 assert.deepEqual(w.growth.needs.filter(n=>small.people.some(p=>p.id===n.request.customerId)),small.growth.needs);
 for(const p of small.catalog){assert.equal(w.products.filter(x=>x.catalogId===p.id).reduce((s,x)=>s+x.stock,0),6*small.products.filter(x=>x.catalogId===p.id).reduce((s,x)=>s+x.stock,0));}
 assert.equal(w.merchants.reduce((s,m)=>s+w.accounts[m.id],0),6*small.merchants.reduce((s,m)=>s+small.accounts[m.id],0));
 assert.ok(w.growth.needs.length>small.growth.needs.length*5);assertGrowthIntegrity(w);
});

test('expanded contact capacity, finite needs and warehouse money reconcile',()=>{
 const w=createGrowthWorld({seed:987777,regime:'discovery'});
 while(w.day<30){beginGrowthDay(w);commerceTurn(w,'warm');endGrowthDay(w);}
 beginGrowthDay(w);const view=observeGrowthWorld(w);
 assert.equal(view.audience.length,600);assert.equal(view.scale.contactMultiplier,6);
 assert.equal(view.outreach.remainingBudgetCents,30000);assert.equal(view.outreach.rules.dailyContactLimit,60);
 assert.equal(JSON.stringify(view).includes('responseDraw'),false);assert.equal('seed' in view,false);
 const plan=outreachPlan(view,{...DEFAULT,outreach:'calibrated',coldContacts:1},null);
 assert.ok(plan.actions.length>10);assert.ok(plan.actions.length<=60);
 for(const [i,a]of plan.actions.entries())contactCustomer(w,{...a,key:'check:'+i});
 assert.throws(()=>contactCustomer(w,{...plan.actions[0],key:'too-soon'}),/CONTACT_FREQUENCY_LIMIT/);
 commerceTurn(w,'expanded');endGrowthDay(w);assertGrowthIntegrity(w);
 const s={id:'TEST',runId:'GARDEN-EXPANDED-TEST',status:'RUNNING',sandbox:false},p=projection(w,s),f=marketFrame(w,s,null),b=warehouseBatch(w,s,null,null);
 assert.equal(f.merchantCount,12);assert.equal(f.customers.length,600);assert.equal(p.merchants.reduce((s,m)=>s+m.starting_cash_cents,0),2700000);
 assert.equal(b.rows.autonomy_baskets.reduce((s,r)=>s+r.gross_cents,0),b.rows.orders.reduce((s,r)=>s+r.total_cents,0));
 assert.equal(b.rows.transactions.reduce((s,r)=>s+r.fee_cents,0),w.orders.reduce((s,r)=>s+r.feeCents,0));
 const changed=structuredClone(w);changed.growth.needs[0].responseDraw=.9999;assert.throws(()=>assertGrowthIntegrity(changed),/EXOGENOUS_GROWTH_INPUT_CHANGED/);
 const oversold=structuredClone(w);oversold.products[0].stock++;assert.throws(()=>assertGrowthIntegrity(oversold),/ITEM_CONSERVATION_FAILED/);
});
