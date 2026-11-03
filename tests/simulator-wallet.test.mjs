import test from 'node:test';
import assert from 'node:assert/strict';
import {frozenInputs} from '../scripts/research-lab/data.mjs';
import {createPolicyWorld,advancePolicyDay} from '../scripts/policy-lab/economy.mjs';
import {creditShoppingWallet,createWalletCorrectedWorld,advanceWalletCorrectedDay} from '../scripts/policy-lab/wallet-corrected.mjs';
const {catalog}=await frozenInputs();
const input=scenario=>({runId:'WALLET-AUDIT',comparisonId:'WALLET-AUDIT',branch:'mesh',settings:{seed:810011,customerCount:1,days:100,budgetCents:5000,scenario},catalog,startedAt:'2026-10-26T01:00:00.000Z'});
test('weekly refresh preserves existing over-cap funds in the real transition',()=>{
 const old=createPolicyWorld(input('steady')),fixed=createWalletCorrectedWorld(input('steady'));
 for(const w of [old,fixed]){w.tick=35;w.customers[0].wallet=52000;w.policyLab.plan={strategy:'observe'};}
 const original=advancePolicyDay(old),corrected=advanceWalletCorrectedDay(fixed);
 const gross=b=>b.rows.orders.reduce((n,o)=>n+o.total_cents,0);
 assert.equal(old.customers[0].wallet+gross(original),50000); // Reproduces the defect.
 assert.equal(fixed.customers[0].wallet+gross(corrected),52000);
 assert.equal(creditShoppingWallet(49900,1000).creditedCents,100);
});
test('budget pressure credits whole cents without losing cash',()=>{
 const w=createWalletCorrectedWorld(input('budget_squeeze'));w.tick=35;w.customers[0].wallet=10000;w.privateTraits[0].weeklyIncome=3001;w.policyLab.plan={strategy:'observe'};
 const b=advanceWalletCorrectedDay(w),spent=b.rows.orders.reduce((n,o)=>n+o.total_cents,0);
 assert.equal(w.customers[0].wallet+spent,11951);assert.ok(Number.isSafeInteger(w.customers[0].wallet));
 assert.throws(()=>creditShoppingWallet(10.1,100),/INVALID_WALLET/);
});
test('unaffected days retain exact original transition rows and old states are not silently migrated',()=>{
 const old=createPolicyWorld(input('steady')),fixed=createWalletCorrectedWorld(input('steady'));
 // Initial integer credits are below the cap; exact behavior must agree.
 for(let d=0;d<14;d++)assert.deepEqual(advanceWalletCorrectedDay(fixed),advancePolicyDay(old));
 assert.throws(()=>advanceWalletCorrectedDay(old),/VERSIONED_WORLD_REQUIRED/);
});
