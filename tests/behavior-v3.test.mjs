import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld,stepWorld,assertIntegrity,campaignContact,lifecycleVisitProbability,frame} from '../scripts/behavior-v3/engine.mjs';
import {usableCatalog,itemRelevance} from '../scripts/behavior-v3/catalog.mjs';
import {run,createRunner} from '../scripts/behavior-v3/runner.mjs';
import {publicEvidence} from '../scripts/behavior-v3/policies.mjs';
import {draw} from '../scripts/marketing/economy.mjs';
const catalog=JSON.parse(await readFile(new URL('../docs/behavior-v3/catalog.json',import.meta.url))).products;
const input=(extra={})=>({runId:'V3-TEST',seed:120001,catalog,customers:20,days:100,campaignStop:70,scenario:'steady',budgetCents:5000,...extra});
test('catalog categories are meaningful public attributes and matching is not an agent identity bonus',()=>{
 const p=usableCatalog(catalog);assert.ok(new Set(p.map(p=>p.category)).size>=3);assert.ok(p.every(x=>x.category!=='[object Object]'));
 const a={category:'Stationery',brand:'Test',price_cents:3000},t={needTopic:'Stationery',favoriteTopic:'Stationery',favoriteBrand:'Test',comfortPrice:3000};
 assert.ok(itemRelevance(t,a)>itemRelevance(t,{...a,category:'Furniture'}));
});
test('relevant message raises interest; an unrelated one adds more fatigue; zero response changes no state',()=>{
 const t={state:'DORMANT',need:1,fatigue:0,awareness:{}},good=structuredClone(t),bad=structuredClone(t),zero=structuredClone(t);
 campaignContact(good,{read:true,relevance:1,response:1,productKey:'good',day:30});campaignContact(bad,{read:true,relevance:0,response:1,productKey:'bad',day:30});campaignContact(zero,{read:true,relevance:1,response:0,productKey:'ignored',day:30});
 assert.deepEqual(zero,t);assert.ok(bad.fatigue>good.fatigue);assert.ok(good.awareness.good>30);
 assert.ok(lifecycleVisitProbability(good,true,1)>lifecycleVisitProbability(t,false,0));
 assert.ok(lifecycleVisitProbability(bad,true,0)<lifecycleVisitProbability(t,false,0));
});
test('organic purchases can reactivate dormant shoppers and satisfy their need',()=>{
 const seed=Array.from({length:100},(_,i)=>i+1).find(s=>draw(s,'v3-visit',30,0)<.05),w=createWorld(input({seed,customers:1}));w.tick=30;const t=w.behavior.private[0];t.state='DORMANT';t.need=1.5;t.needTopic='Stationery';for(const p of w.products)t.awareness[p.channel3_product_id]=100;
 const before=t.need;const b=stepWorld(w);
 assert.ok(b.rows.orders.length>0);assert.equal(t.state,'ACTIVE');assert.ok(t.need<before);assert.ok(b.rows.behavior_lifecycle.some(r=>r.next_state==='ACTIVE'&&r.previous_state==='DORMANT'));
});
test('paired zero-response control has identical purchases, lifecycle and cash; outreach only adds cost',()=>{
 const a=run(input({response:0,policy:'none'})),b=run(input({response:0,policy:'portfolio',runId:'V3-TREATMENT'}));
 for(const k of ['retainedCents','externalCents','purchases','returned','acquired','reactivated','merchantCents'])assert.equal(b.durable[k],a.durable[k],k);
 assert.ok(b.durable.outreachCents>0);assert.equal(b.durable.platformCents-a.durable.platformCents,-b.durable.outreachCents);
});
test('cash, stock, budget and hidden-trait boundary hold through refunds and budget pressure',()=>{
 const r=createRunner(input({scenario:'budget_squeeze',policy:'portfolio'}));while(r.world.tick<30)r.step();const evidence=publicEvidence(r.world);r.world.behavior.private[0].favoriteBrand='SECRET_MARKER';assert.deepEqual(publicEvidence(r.world),evidence);assert.equal(JSON.stringify(evidence).includes('SECRET_MARKER'),false);
 while(r.world.tick<r.world.totalTicks)r.step();assertIntegrity(r.world);assert.equal(r.world.pending.length,0);assert.ok(r.world.behavior.external.length>0);assert.ok(r.world.behavior.models.length>0);assert.ok(r.world.behavior.models.every(m=>m.cutoff>m.split));assert.ok(frame(r.world).behaviorVersion.includes('v3'));
});

test('an exhausted campaign budget cannot change behavior or create subsidized purchases',()=>{
 const a=run(input({budgetCents:0,policy:'none'})),b=run(input({budgetCents:0,policy:'portfolio',runId:'V3-BUDGET-CONTROL'}));
 assert.deepEqual(b.durable,a.durable);assert.equal(b.durable.outreachCents,0);assert.equal(b.durable.supportCents,0);
});
