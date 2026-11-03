import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {responseBudgetEvidence,responseBudgetPlan,responseBudgetModel,runResponseBudget} from '../scripts/commerce-growth/autonomy/response-budget.mjs';import {economicResources} from '../scripts/commerce-growth/autonomy/economic-runtime.mjs';import {openAllocator} from '../scripts/commerce-deadlines/solver.mjs';
const r=await economicResources(),model=await responseBudgetModel(),source=JSON.parse(await readFile('docs/commerce-growth/economic-workflows/EDA-TRENDS-2/public-observation.json','utf8'));
test('no-reply review is past-only, uncertainty-aware and immediately reopens after a response',()=>{
 const v=structuredClone(source);v.outreach.history=[];assert.equal(responseBudgetEvidence(v,model).pauseGeneralInquiries,false);
 v.outreach.history=Array.from({length:200},(_,i)=>({day:30+Math.floor(i/10),kind:'ask_need',responded:false}));let e=responseBudgetEvidence(v,model);assert.equal(e.pauseGeneralInquiries,true);assert.ok(e.optimisticInquiryNetCents<=0);assert.equal(e.probeDue,true);
 v.outreach.history.push({day:999,kind:'ask_need',responded:true});assert.deepEqual(responseBudgetEvidence(v,model),e);
 v.outreach.history.push({day:59,kind:'recommend',responded:true});assert.equal(responseBudgetEvidence(v,model).pauseGeneralInquiries,false);
});
test('budget review retains all product recommendations and at most one due recovery inquiry',()=>{
 const v=structuredClone(source);v.outreach.history=Array.from({length:200},(_,i)=>({day:30+Math.floor(i/10),kind:'ask_need',responded:false,observedBucket:'ask_need|*|cold|returning',costCents:5}));const b=r.baselineController.plan(v),p=responseBudgetPlan(v,r,model);
 assert.deepEqual(p.actions.filter(a=>a.kind==='recommend'),b.actions.filter(a=>a.kind==='recommend'));assert.ok(p.actions.filter(a=>a.kind==='ask_need').length<=1);assert.equal(p.actions.length,p.ranking.length);
});
test('response budgeting keeps the same economy and clears liabilities',async()=>{
 const a=openAllocator(),settings={seed:301,regime:'zero_response',days:42,customers:30};try{const b=await r.runBaseline(settings,r,a),p=await runResponseBudget(settings,r,a,{model});for(const k of ['initialHash','opportunityHash','consentHash','incomeCents'])assert.equal(p[k],b[k]);assert.equal(p.unpaidLiabilities,0);assert.ok(p.platformUSD>=b.platformUSD);assert.equal(p.retainedPurchases,b.retainedPurchases);}finally{a.close();}
});
