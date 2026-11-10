import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {investigationData,selectCohort,verifyStudioRows,verifyInsightPlan,createInvestigationService} from '../scripts/studio/investigation.mjs';
import {reserveBudget} from '../scripts/studio/investigation-provider.mjs';
import {cohortQuery} from '../demo/studio/investigation-harness.mjs';

test('cohort ontology counts checkout parents once and rejects tampered native query rows',async()=>{
 const data=await investigationData(),cohort=selectCohort(data,data.merchants.map(m=>m.id));
 assert.equal(cohort.checkouts,1384);assert.equal(cohort.merchantOrders,1922);assert.ok(cohort.splitCheckouts>0);
 assert.equal(cohort.grossUSD,164451);assert.ok(verifyStudioRows(cohort,cohort.rows));
 const altered=structuredClone(cohort.rows);altered[0].grossUSD+=96;assert.throws(()=>verifyStudioRows(cohort,altered),/certified warehouse/);
 assert.throws(()=>verifyStudioRows(cohort,[...cohort.rows,cohort.rows[0]]),/incomplete cohort/);
 assert.throws(()=>selectCohort(data,['not-a-merchant']),/current recorded market/);
});

test('planner handoff holds ambiguous inputs, verifies Studio rows and publishes only grounded widget plans',async()=>{
 const data=await investigationData(),ids=data.merchants.slice(0,3).map(m=>m.id),saved=new Map();let calls=0;
 const provider={status:async()=>({enabled:true,remainingCalls:8}),save:async(id,v)=>saved.set(id,structuredClone(v)),load:async id=>saved.get(id),loadExample:async()=>null,
  decide:async(id,role)=>{calls++;return {output:role==='cohort_planner'?{merchantIds:ids,focus:'refund_review',rationale:'Compare the selected merchant refund burden.'}:{title:'Merchant refund review',rationale:'Show refund pressure and reconcile the checkout grain.',factIds:['grain','refund-review'],widgets:['cohort_refunds','cohort_sales']},usage:{inputTokens:100,outputTokens:60},costUSD:.0001};}};
 const service=createInvestigationService({provider}),input={requestId:'test-investigation-1',question:'Which merchants need a refund review?',merchantIds:data.merchants.map(m=>m.id),mapping:'ambiguous'};
 const held=await service.plan(input);assert.equal(held.status,'HELD');assert.equal(calls,0);assert.equal(held.modelCalls,0);
 const plan=await service.plan({...input,mapping:'confirmed'});assert.equal(calls,1);assert.equal(plan.status,'QUERY_READY');
 assert.equal((await service.plan({...input,mapping:'confirmed'})).id,plan.id);assert.equal(calls,1);
 await assert.rejects(()=>service.verify({id:plan.id,rows:[]}),/incomplete cohort/);assert.equal(calls,1);
 const result=await service.verify({id:plan.id,rows:plan.cohort.rows});assert.equal(result.status,'VERIFIED');assert.equal(calls,2);assert.equal(result.modelCalls,2);
 assert.ok(result.proposal.widgets.includes('checkout_grain'));assert.ok(result.proposal.widgets.includes('cohort_ledger'));
 assert.deepEqual(result.insights.map(f=>f.id),['grain','refund-review']);
 assert.equal((await service.verify({id:plan.id,rows:plan.cohort.rows})).id,result.id);assert.equal(calls,2);
 const restored=createInvestigationService({provider});assert.equal((await restored.verify({id:plan.id,rows:plan.cohort.rows})).id,result.id);assert.equal(calls,2);
});

test('unsupported insight claims or widget types fail the publication gate',()=>{
 const valid={title:'Cohort review',rationale:'Inspect the observed records.',factIds:['grain','retained'],widgets:['cohort_sales','cohort_ledger']};
 assert.throws(()=>verifyInsightPlan({...valid,factIds:['grain','profit-doubled']},[{id:'grain'},{id:'retained'}]),/verified fact/);
 assert.throws(()=>verifyInsightPlan({...valid,widgets:['cohort_sales','execute_payment']},[{id:'grain'},{id:'retained'}]),/verified dashboard views/);
});

test('durable reservations cap concurrent exposure, settle metered cost and never spend an idempotency key twice',()=>{
 let ledger={version:1,capMicros:250000,entries:[]};
 for(let n=0;n<8;n++)ledger=reserveBudget(ledger,'run-'+n,'test');
 assert.equal(ledger.entries.reduce((n,e)=>n+e.reservedMicros,0),240000);
 assert.throws(()=>reserveBudget(ledger,'run-8','test'),/EXHAUSTED/);
 assert.throws(()=>reserveBudget(ledger,'run-0','test'),/ALREADY_RESERVED/);
 const metered={...ledger,entries:ledger.entries.map(e=>({...e,status:'complete',costUSD:.001}))};
 assert.equal(reserveBudget(metered,'run-8','test').entries.length,9);
 const calls={...ledger,entries:Array.from({length:64},(_,n)=>({requestId:'done-'+n,reservedMicros:30000,status:'complete',costUSD:.001}))};
 assert.throws(()=>reserveBudget(calls,'next','test'),/EXHAUSTED/);
 assert.throws(()=>reserveBudget({...ledger,capMicros:500000},'run-9','test'),/INVALID_STUDIO_BUDGET/);
});

test('native query is scoped and the economy source fingerprint remains frozen',async()=>{
 const query=cohortQuery(['merchant-1']).query;assert.equal(query.variant,'projection');assert.equal(query.filter.operator,'isIn');assert.deepEqual(query.filter.value,['merchant-1']);
 const protocol=JSON.parse(await readFile('docs/commerce-growth/development-1/protocol.json','utf8'));
 for(const [path,digest] of Object.entries(protocol.sourceHashes))assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'),digest,path);
});
