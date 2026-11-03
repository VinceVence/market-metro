import test from 'node:test';
import assert from 'node:assert/strict';
import {createGrowthWorld,beginGrowthDay,endGrowthDay,observeGrowthWorld,contactCustomer,assertGrowthIntegrity} from '../scripts/commerce-growth/environment.mjs';
import {warmGrowthWorld,runGrowthCase} from '../scripts/commerce-growth/evaluate.mjs';
import {GROWTH_POLICIES} from '../scripts/commerce-growth/policies.mjs';
const settings={seed:301,regime:'discovery',days:36,customers:30};
const totalBuyerFunds=w=>Object.entries(w.accounts).filter(([id])=>id.startsWith('BUYER-')||id.startsWith('AUTH-')).reduce((s,[,n])=>s+n,0);

test('finite opportunities and funding are policy-independent; no private truth reaches the observation',()=>{
 const a=createGrowthWorld(settings),b=createGrowthWorld(settings);
 assert.equal(a.growth.opportunityHash,b.growth.opportunityHash);assert.equal(a.growth.consentHash,b.growth.consentHash);
 const w=warmGrowthWorld(settings);beginGrowthDay(w);const view=observeGrowthWorld(w);
 assert.equal(Object.hasOwn(view,'seed'),false);assert.equal(Object.hasOwn(view,'growth'),false);assert.equal(Object.hasOwn(view,'privateOrderOutcomes'),false);
 assert.ok(!/responseDraw|weeklyIncomeCents|revokedDay/.test(JSON.stringify(view)));
 assert.equal(w.growth.needs.length,w.growth.initialNeeds);assertGrowthIntegrity(w);
});

test('consented contact can reveal only an existing need and cannot add shopper funds or charge twice',()=>{
 const w=warmGrowthWorld(settings);beginGrowthDay(w);
 const need=w.growth.needs.find(n=>n.state==='DORMANT'&&n.request.createdDay<=w.day&&n.request.deadlineDay>=w.day+2&&n.responseDraw<.75*.85&&w.growth.profiles.find(p=>p.id===n.request.customerId).optedIn);
 assert.ok(need,'Fixture has a consented latent need');
 const action={key:'test-contact-1',customerId:need.request.customerId,kind:'ask_need',category:'*'},cash=totalBuyerFunds(w),platform=w.accounts.platform,count=w.requests.length;
 const result=contactCustomer(w,action);assert.equal(result.responded,true);assert.equal(w.requests.length,count+1);
 assert.equal(totalBuyerFunds(w),cash);assert.equal(w.accounts.platform,platform-5);assert.equal(w.growth.outreachCents,5);
 assert.deepEqual(contactCustomer(w,action),result);assert.equal(w.growth.contacts.length,1);assert.equal(w.growth.outreachCents,5);
 assert.throws(()=>contactCustomer(w,{...action,key:'same-customer-new-contact'}),/FREQUENCY/);
 assert.ok(w.growth.needs.some(n=>n.request.id===result.requestId));assertGrowthIntegrity(w);
});

test('nonconsent, revoked consent and followup contacts are rejected without cost',()=>{
 const w=warmGrowthWorld({...settings,customers:100});beginGrowthDay(w);
 const no=w.growth.profiles.find(p=>!p.optedIn),revoke=w.growth.profiles.find(p=>p.optedIn&&p.revokedDay===60);assert.ok(no);assert.ok(revoke);
 const action={key:'blocked-contact',kind:'ask_need',category:'*'};
 assert.throws(()=>contactCustomer(w,{...action,customerId:no.id}),/NO_MARKETING_CONSENT/);
 const future={...w,day:60,settings:{...w.settings,days:100}};
 assert.throws(()=>contactCustomer(future,{...action,customerId:revoke.id}),/NO_MARKETING_CONSENT/);
 assert.throws(()=>contactCustomer({...w,day:w.settings.days},{...action,customerId:revoke.id}),/OUTSIDE_CAMPAIGN/);
 assert.equal(w.growth.outreachCents,0);
});

test('zero-response control creates no outreach purchases; paired runs retain the same opportunities and income',async()=>{
 const s={...settings,regime:'zero_response'},none=await runGrowthCase(s,GROWTH_POLICIES[0]),fixed=await runGrowthCase(s,GROWTH_POLICIES[1]);
 assert.equal(none.initialHash,fixed.initialHash);assert.equal(none.opportunityHash,fixed.opportunityHash);assert.equal(none.incomeCents,fixed.incomeCents);
 assert.equal(fixed.fundedResponses,0);assert.equal(fixed.attributedPurchases,0);assert.equal(fixed.recommendationPurchases,0);
 assert.equal(fixed.unpaidLiabilities,0);assert.ok(fixed.outreachCostUSD>0);assert.equal(none.purchases,fixed.purchases);
 assert.ok(Math.abs(none.platformUSD-fixed.platformUSD-fixed.outreachCostUSD)<1e-8);
});
