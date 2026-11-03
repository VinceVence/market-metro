import test from 'node:test';
import assert from 'node:assert/strict';
import {warmGrowthWorld} from '../scripts/commerce-growth/evaluate.mjs';
import {beginGrowthDay,observeGrowthWorld,digest} from '../scripts/commerce-growth/environment.mjs';
import {revisionResources,revisionController} from '../scripts/commerce-growth/autonomy/net-revision-study.mjs';

test('broader inquiry campaign uses model value, consent and limits without invented product interest',async()=>{
 const r=await revisionResources(),world=warmGrowthWorld({seed:301,regime:'discovery',days:36,customers:30});beginGrowthDay(world);
 const view=observeGrowthWorld(world);view.signals=[];view.audience=view.audience.map(p=>({...p,signal:null,hasOpenRequest:false,lastContactDay:null}));
 const before=digest(view),old=revisionController(r,{audience:'recent_interest'}).plan(view),expanded=revisionController(r,{audience:'consented_positive_value'}).plan(view);
 assert.equal(old.actions.length,0);assert.ok(expanded.actions.length>0&&expanded.actions.length<=view.outreach.rules.dailyContactLimit);
 for(const a of expanded.actions){assert.equal(a.kind,'ask_need');assert.equal(a.catalogId,null);assert.ok(view.audience.find(p=>p.customerId===a.customerId).marketingConsent);const scored=expanded.ranking.find(p=>p.customerId===a.customerId);assert.ok(scored.expectedNetCents>0&&scored.expectedMerchantNetCents>0);}
 assert.equal(digest(view),before);assert.equal(expanded.agentCheckpoint,r.decision.decisionHash);
 const revoked={...view,audience:view.audience.map(p=>({...p,marketingConsent:false}))};assert.equal(revisionController(r).plan(revoked).actions.length,0);
 const emptyBudget={...view,outreach:{...view.outreach,remainingBudgetCents:0}};assert.equal(revisionController(r).plan(emptyBudget).actions.length,0);
});
