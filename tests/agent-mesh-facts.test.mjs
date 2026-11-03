import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedFacts,unitEconomics,randomizedEffects} from '../scripts/agent-mesh/facts.mjs';

test('checked facts cannot turn an increase into a decline or a global cap into merchant authority',()=>{
  const f=verifiedFacts({asOfDay:55,recentPurchases:134,previousPurchases:119,merchants:[{index:0,name:'Willow',stock:20,maxOfferPct:5}],products:[{product_id:'p',price_cents:8900,source:'CHANNEL3_API'}],events:[{id:'old',day:35,text:'Known event'},{id:'future',day:60,text:'Future event'}],model:{modelId:'m',mse:.325,baselineMse:.304}});
  assert.equal(f.demand.direction,'UP');assert.equal(f.demand.difference,15);assert.equal(f.caps.merchants[0].maxOfferPct,5);assert.equal(f.modelCheck.beatConstant,false);assert.deepEqual(f.announcements.map(x=>x.id),['old']);
  const noOffer=f.economics[0].offers[0],ten=f.economics[0].offers[2];assert.equal(noOffer.retainedSaleMarginCents,233);assert.equal(ten.retainedSaleMarginCents,35);assert.ok(ten.conversionMultiplierBeforeOutreach>6);
});

test('randomized comparisons exclude ineligible controls, adaptive actions and unresolved future outcomes',()=>{
  const make=(id,day,action,reward,extra={})=>({customer_id:id,day,selected_action:action,reward_cents:reward,eligible_json:JSON.stringify(['none','recommend:0']),propensity:.5,order_id:reward>0?'o-'+id:null,matures_day:day+14,source:'RANDOMIZED_SIMULATION',...extra});
  const rows=[make('a',1,'none',10),make('b',1,'recommend:0',20),make('bad',1,'none',10000,{eligible_json:'["none"]'}),make('adaptive',1,'recommend:0',10000,{source:'LOCAL_CONTEXTUAL_BANDIT'}),make('future',25,'recommend:0',10000)];
  const e=randomizedEffects(rows,30).find(r=>r.audience==='all'&&r.action==='recommend:0');assert.equal(e.eligibleDecisions,2);assert.equal(e.control.observations,1);assert.equal(e.treated.observations,1);assert.equal(e.directRewardDifferenceCents,10);
  assert.equal(randomizedEffects(rows,30).find(r=>r.audience==='lapsed').directRewardDifferenceCents,null);
});

test('unit economics preserves stated fees, processing and funding arithmetic',()=>{
  const e=unitEconomics(3199,5);assert.equal(e.paidCents,3039);assert.equal(e.subsidyCents,32);assert.equal(e.retainedSaleMarginCents,e.feeCents-e.processingCents-e.subsidyCents);assert.equal(e.outreachCents,2);assert.throws(()=>unitEconomics(3199,99));
});
