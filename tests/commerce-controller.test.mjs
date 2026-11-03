import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld,stepWorld,actionInput} from '../scripts/commerce-economy-v5/engine.mjs';
import {authoredCatalog} from '../scripts/behavior-v4/catalog.mjs';
import {incumbent,SETTINGS} from '../scripts/commerce-economy-v5/runner.mjs';
import {compileDiscoveryPolicy} from '../scripts/commerce-economy-v5/learning/discovery-policy.mjs';
import {loadActionModels} from '../scripts/commerce-economy-v5/learning/action-policy.mjs';
import {hash} from '../scripts/commerce-design-v2/evaluate.mjs';
import {compileCoveragePolicy,updateWorkingCapital} from '../scripts/commerce-economy-v5/learning/coverage-policy.mjs';
import {EXPERTS,compileExpert} from '../scripts/commerce-economy-v5/learning/experts.mjs';

test('new controller uses observed data and cannot overwrite a consented mandate',async()=>{
 const w=createWorld({...SETTINGS,seed:117122,runId:'ACCESS-CHECK',catalog:authoredCatalog()});
 while(w.tick<30)stepWorld(w);
 const input=actionInput(w,w.customers[0]),artifact=await loadActionModels();
 const deny=()=>{throw Error('PRIVATE_FEATURE_ACCESS');};
 Object.defineProperty(w,'seed',{get:deny});Object.defineProperty(w.behavior,'private',{get:deny});
 for(const u of w.customers)Object.defineProperty(u,'wallet',{get:deny});
 const config={business:incumbent(),discovery:'observed_value',intervalDays:7,modelName:'ridge',thresholdCents:0};
 const action=compileDiscoveryPolicy(w,artifact,config)(input);
 assert.ok(action===null||input.products.some(p=>p.productId===action.productId&&p.allowedPct.includes(action.pct)));
 for(const expert of EXPERTS){const a=compileExpert(w,artifact,config,expert)(input);assert.ok(a===null||input.products.some(p=>p.productId===a.productId&&p.allowedPct.includes(a.pct)));}
 const coverage=compileCoveragePolicy(w,config)(input);assert.ok(coverage===null||input.products.some(p=>p.productId===coverage.productId&&p.allowedPct.includes(coverage.pct)));
 const stock=JSON.stringify(w.inventory),cash=JSON.stringify(w.commerce.cashCents);w.tick=49;updateWorkingCapital(w,{...config,trimDays:56,riskPricing:true});assert.equal(JSON.stringify(w.inventory),stock);assert.equal(JSON.stringify(w.commerce.cashCents),cash);
 const mandate={id:'EXISTING',customerId:input.customer.customerId,status:'ACTIVE',maxPaidCents:2500};w.commerce.mandates.push(mandate);
 const before=JSON.stringify(mandate);assert.equal(compileDiscoveryPolicy(w,artifact,config)(input),null);assert.equal(JSON.stringify(mandate),before);
});
test('economic rules remain frozen across the joint search and liquidity trial',async()=>{
 for(const run of ['joint-controller-1','liquidity-controller-1']){
  const p=JSON.parse(await readFile(`docs/commerce-economy-v5/${run}/protocol.json`,'utf8'));
  for(const f of ['engine.mjs','operations.mjs','network.mjs']){const path='scripts/commerce-economy-v5/'+f;assert.equal(hash(await readFile(path,'utf8')),p.hashes[path]);}
 }
 const r=JSON.parse(await readFile('demo/data/commerce-economy-v5.json','utf8'));
 assert.ok(r.cases.every(c=>c.pairedInitialState));assert.equal(r.targetAchieved,false);assert.equal(r.nativePaymentCalls,0);assert.equal(r.everyPartnerImproved,false);
 assert.ok(r.differences.wholesalerUSD<0&&r.differences.manufacturerUSD<0);
});
