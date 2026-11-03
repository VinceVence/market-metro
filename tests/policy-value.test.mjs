import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {predictPolicyValues,mechanicalValueChoice} from '../scripts/commerce-growth/autonomy/policy-value.mjs';
import {learnPauseRule,pauseRuleChoice,historicalEvidence} from '../scripts/commerce-growth/autonomy/value-review.mjs';
const root='docs/commerce-growth/roc-net-goal-1/policy-value-combined-1',read=async p=>JSON.parse(await readFile(root+'/'+p,'utf8')),rows=(await read('dataset.json')).rows;
test('Ridge and tree value predictions match their Python artifacts on every source context',async()=>{
 for(const name of ['ridge-1','ridge-10','ridge-100','tree-1','tree-2','tree-3']){const model=await read(name+'-model.json'),parity=await read(name+'-parity.json');for(const p of parity){const context=rows.find(r=>r.market===p.market).features,actual=predictPolicyValues(model,context);for(const [action,expected]of Object.entries(p.predictions)){const found=actual.find(p=>p.action===action);assert.ok(Math.abs(found.platformDeltaUSD-expected[0])<1e-7);assert.ok(Math.abs(found.retailerDeltaUSD-expected[1])<1e-7);}}}
});
test('Review evidence exposes historical contrasts, not simulator identities or futures',()=>{
 const context=rows[0].features,examples=historicalEvidence(rows,context,'balanced');assert.equal(examples.length,3);assert.equal(/"(seed|regime|market|privateOrderOutcomes|needs)"/.test(JSON.stringify(examples)),false);
 const rule=learnPauseRule(rows);assert.ok(Number.isFinite(rule.organicRatioCut));assert.ok(['observe','continue_numerical'].includes(pauseRuleChoice(context,rule)));
 assert.equal(mechanicalValueChoice([{action:'expert_discovery',platformDeltaUSD:10,retailerDeltaUSD:-1},{action:'continue_numerical',platformDeltaUSD:0,retailerDeltaUSD:0}]),'continue_numerical');
});
