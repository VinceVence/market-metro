import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceUnits,bindSourceSelection} from '../scripts/trusted-workflow/source-router.mjs';
test('source IDs bind exact original sentences and preserve monetary decimals',()=>{
  const brief='Grow retained sales at Willow Goods. No coupons. Budget $10.50; campaign lasts 3 days.';
  const units=sourceUnits(brief);assert.equal(units.length,3);assert.equal(brief.slice(units[2].start,units[2].end).trim(),units[2].text);
  const raw={status:'ready',goal:'grow_retained_sales',merchantIndices:[0],budgetCents:1050,maxCouponPct:0,durationDays:3,inactiveDays:0,reason:'Use the stated limits.',sourceIds:{goal:'S001',merchants:'S001',budget:'S003',discount:'S002',duration:'S003',inactivity:null}};
  assert.equal(bindSourceSelection(raw,brief,units).budgetCents,1050);
  assert.throws(()=>bindSourceSelection({...raw,budgetCents:10000},brief,units),/BUDGET_NOT_GROUNDED/);
  assert.throws(()=>bindSourceSelection({...raw,sourceIds:{...raw.sourceIds,budget:'S999'}},brief,units),/UNKNOWN_SOURCE_ID/);
});
