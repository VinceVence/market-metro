import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {economicResources} from '../scripts/commerce-growth/autonomy/economic-runtime.mjs';import {netLiftPlan,runNetLift} from '../scripts/commerce-growth/autonomy/net-lift.mjs';import {openAllocator} from '../scripts/commerce-deadlines/solver.mjs';
const r=await economicResources(),view=JSON.parse(await readFile('docs/commerce-growth/economic-workflows/EDA-TRENDS-2/public-observation.json','utf8'));
test('same-audience product improvement retains every baseline inquiry and customer',()=>{
 const b=r.baselineController.plan(view),p=netLiftPlan(view,r,'preserve_audience');assert.deepEqual(p.actions.map(a=>a.customerId),b.actions.map(a=>a.customerId));assert.deepEqual(p.actions.filter(a=>a.kind==='ask_need'),b.actions.filter(a=>a.kind==='ask_need'));
 for(const [i,a]of p.actions.entries())if(a.catalogId!==b.actions[i].catalogId){assert.ok(p.ranking[i].expectedNetCents>b.ranking[i].expectedNetCents);assert.ok(p.ranking[i].expectedMerchantNetCents>=b.ranking[i].expectedMerchantNetCents);}
});
test('joint product pool retains inquiries and obeys shared contact constraints',()=>{
 const p=netLiftPlan(view,r,'pooled');assert.ok(p.actions.some(a=>a.kind==='ask_need'));assert.ok(p.actions.length<=view.outreach.rules.dailyContactLimit);assert.equal(new Set(p.actions.map(a=>a.customerId)).size,p.actions.length);for(const a of p.actions){const person=view.audience.find(p=>p.customerId===a.customerId);assert.ok(person.marketingConsent&&!person.hasOpenRequest);assert.ok(person.lastContactDay===null||view.day-person.lastContactDay>=view.outreach.rules.customerContactGapDays);}
});
test('both net-lift policies conserve the frozen economy and fully settle',async()=>{
 const allocator=openAllocator(),settings={seed:301,regime:'discovery',days:36,customers:30};try{const b=await r.runBaseline(settings,r,allocator);for(const mode of ['preserve_audience','pooled']){const a=await runNetLift(settings,mode,r,allocator);for(const k of ['initialHash','opportunityHash','consentHash','incomeCents'])assert.equal(a[k],b[k]);assert.equal(a.unpaidLiabilities,0);assert.ok(Number.isFinite(a.platformUSD));}}finally{allocator.close();}
});
