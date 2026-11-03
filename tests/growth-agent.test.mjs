import test from 'node:test';
import assert from 'node:assert/strict';
import {selectTestedCandidate,GROWTH_FUNCTIONS} from '../scripts/agent-mesh/growth-agent.mjs';
import {sha} from '../scripts/agent-mesh/growth-lab.mjs';
function candidate(){
 const model={modelId:'M',arms:{none:{coef:[0]}}},spec={family:'incremental'};
 const body={spec,modelId:'M',modelHash:sha(model),estimate:{mean:1,worst:0},merchant:{mean:2},scenario:'steady',rows:[]};
 return {model,spec,probe:{...body,id:'PROBE-'+sha(body).slice(0,16),launchable:true}};
}
test('release binds the exact tested model, policy and numerical probe',()=>{
 assert.ok(selectTestedCandidate(candidate(),{costUSD:.1}));
 const m=candidate();m.model.arms.none.coef[0]=1;assert.throws(()=>selectTestedCandidate(m),/ARTIFACT_CHANGED/);
 const p=candidate();p.spec.family='reward';assert.throws(()=>selectTestedCandidate(p),/PROBE_CHANGED|ARTIFACT_CHANGED/);
 const e=candidate();e.probe.estimate.mean=100;assert.throws(()=>selectTestedCandidate(e),/PROBE_CHANGED/);
});
test('unsupported probes and inference cost cannot authorize an active campaign',()=>{
 const p=candidate();p.probe.launchable=false;assert.equal(selectTestedCandidate(p),null);
 assert.equal(selectTestedCandidate(candidate(),{costUSD:1.01}),null);
 assert.equal(selectTestedCandidate(undefined),null);
});
test('Vertex tool enums contain only strings; numeric authority remains in code validation',()=>{
 function visit(x){if(!x||typeof x!=='object')return;if(x.enum)assert.ok(x.enum.every(v=>typeof v==='string'));Object.values(x).forEach(visit);}
 GROWTH_FUNCTIONS.forEach(visit);
});
