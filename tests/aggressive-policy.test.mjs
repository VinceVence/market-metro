import test from 'node:test';
import assert from 'node:assert/strict';
import {matureMerchantRisk,scheduleModel,POLICIES} from '../scripts/agent-mesh/aggressive-policy.mjs';
import {chooseBandit} from '../scripts/policy-lab/learner.mjs';

test('catalog targeting is explicit and cannot turn low-value products into eligible high-value actions',()=>{
 const model=scheduleModel(POLICIES.find(p=>p.id==='high-value-loyal'));
 const candidates=price=>[{id:'none',features:[1,0,0,0,price,0,0]},...Array.from({length:3},(_,i)=>({id:'recommend:'+i,features:[1,0,0,0,price,Number(i===2),0]}))];
 assert.equal(chooseBandit(model,candidates(.3199),{epsilon:0,draw:[1,1]}).id,'none');
 assert.equal(chooseBandit(model,candidates(.89),{epsilon:0,draw:[1,1]}).id,'recommend:2');
});
test('return routing only uses matured observed orders and never pending future refund flags',()=>{
 const orders=new Map(Array.from({length:30},(_,i)=>['o'+i,{merchant_id:'M1',event_ts:'2026-10-26T01:00:00.000Z',refund:i<10?100:0}]));
 orders.set('recent',{merchant_id:'M0',event_ts:'2026-11-23T01:00:00.000Z',refund:100});
 const runner={world:{tick:30,startedAt:'2026-10-26T01:00:00.000Z',merchants:[{merchant_id:'M0'},{merchant_id:'M1'}]},orders};
 const risk=matureMerchantRisk(runner);assert.equal(risk[0].matureOrders,0);assert.equal(risk[0].excluded,false);assert.equal(risk[1].matureOrders,30);assert.equal(risk[1].excluded,true);
});
