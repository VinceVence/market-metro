import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {frozenInputs,observedWorld,sha} from '../scripts/research-lab/data.mjs';
import {analyze,openWorkflow,planFromChoice} from '../scripts/trusted-workflow/tools.mjs';
import {validateSpec,semanticSpec,rulesInterpret,groundInterpretation} from '../scripts/trusted-workflow/contract.mjs';
const spec=validateSpec({status:'ready',goal:'grow_retained_sales',merchantIndices:[0,1,2],budgetCents:3000,maxCouponPct:0,durationDays:3,inactiveDays:0,reason:'A bounded test goal.'});
const task={seed:72044,scenario:'steady'};

test('trusted aggregates preserve order grain, mature denominators and the reactivation definition',async()=>{
  const {catalog}=await frozenInputs(),context=observedWorld({id:'TOOLS',...task,catalog,budgetCents:10000});
  const args={merchantIndices:[0,1,2]};
  const sales=analyze(context,'merchant_sales',args),returns=analyze(context,'mature_returns',args),cohort=analyze(context,'reactivation_cohort',args);
  const orderActions=context.actions.filter(a=>a.order_id&&a.day>=17&&a.day<45);
  assert.equal(sales.rows.reduce((n,r)=>n+r.orders,0),orderActions.length);
  assert.equal(returns.rows.reduce((n,r)=>n+r.matureOrders,0),orderActions.filter(a=>a.matures_day<=45&&a.reward_cents!==null).length);
  for(const r of returns.rows)if(r.matureOrders)assert.ok(Math.abs(r.returnRate-r.returnedMatureOrders/r.matureOrders)<.000001);
  const expected=context.world.customers.filter(c=>c.purchases>0&&45-c.lastPurchase>=7).map(c=>c.customer_id).sort();
  assert.deepEqual(cohort.cohortIds,expected);assert.equal(cohort.n,new Set(cohort.cohortIds).size);
  assert.throws(()=>analyze(context,'SELECT * FROM orders',args));
  assert.throws(()=>analyze(context,'reactivation_cohort',{...args,inactiveDays:30}));
  assert.equal(sales.unit,'USD_CENTS');assert.match(returns.warning,/excludes no-purchase/);
});

test('business and experiment contracts reject expanded authority rather than repair it silently',()=>{
  for(const change of [{budgetCents:20000},{maxCouponPct:20},{durationDays:30},{merchantIndices:[3]},{inactiveDays:30},{sql:'SELECT 1'}])assert.throws(()=>validateSpec({...spec,...change}));
  const base={model:'full',style:'recommendations',durationDays:3,merchantIndices:[0],penaltyUSD:.6};
  assert.equal(planFromChoice(base,spec).maxOfferPct,0);
  for(const change of [{style:'coupon'},{durationDays:4},{merchantIndices:[4]},{penaltyUSD:-1},{sql:'SELECT 1'}])assert.throws(()=>planFromChoice({...base,...change},spec));
});

test('source-bound authority rejects invented budgets and substituted inactivity windows',()=>{
  const brief='Reactivate buyers inactive for 30 days at Willow Goods. No coupons, $20 budget; campaign lasts 3 days.';
  const raw={...spec,goal:'reactivate_buyers',merchantIndices:[0],budgetCents:2000,inactiveDays:7,sourceEvidence:{goal:'Reactivate buyers',merchants:'Willow Goods',budget:'$20',discount:'No coupons',duration:'3 days',inactivity:'30 days'}};
  assert.throws(()=>groundInterpretation(raw,brief),/INACTIVITY_NOT_GROUNDED/);
  assert.throws(()=>groundInterpretation({...raw,inactiveDays:30},brief),/UNSUPPORTED_COHORT/);
  assert.throws(()=>groundInterpretation({...raw,sourceEvidence:{...raw.sourceEvidence,budget:null}},brief),/MISSING_CAMPAIGN_AUTHORITY/);
  assert.throws(()=>groundInterpretation({...raw,sourceEvidence:{...raw.sourceEvidence,budget:'$100'}},brief),/UNGROUNDED_SOURCE/);
  const validBrief=brief.replace('30 days','7 days'),valid={...raw,sourceEvidence:{...raw.sourceEvidence,inactivity:'7 days'}};
  assert.equal(groundInterpretation(valid,validBrief).budgetCents,2000);
});

test('command comparator supports ordinary goals, negation, exclusions, units and correction',()=>{
  const a=rulesInterpret('Grow retained sales for all shops except Willow Goods. No coupons. $20 budget, campaign lasts 3 days.');
  assert.deepEqual(a.merchantIndices,[1,2]);assert.equal(a.budgetCents,2000);
  const b=rulesInterpret("We aren't trying to reactivate customers. Grow retained sales for all shops. No coupons, thirty dollars, campaign lasts 7 days.");
  assert.equal(b.goal,'grow_retained_sales');assert.equal(b.durationDays,7);
  const c=rulesInterpret('Old proposal $90. Final request: audit refund exposure at Corner Supply. Report only.');
  assert.deepEqual(semanticSpec(c),{status:'ready',goal:'reduce_return_exposure',merchantIndices:[2],budgetCents:0,maxCouponPct:0,durationDays:0,inactiveDays:0});
  assert.equal(rulesInterpret('Grow retained sales for all shops. No coupons, campaign lasts 3 days.').status,'clarify');
});

test('workflow checkpoints resume after each expensive boundary without repeating completed effects',async()=>{
  const {catalog}=await frozenInputs(),directory=await mkdtemp(join(tmpdir(),'trusted-recovery-'));
  try{
    for(const point of ['models_compared','development_pilots','decision_committed']){
      const dir=join(directory,point),args={directory:dir,id:'RECOVERY-'+point,task,spec,catalog};
      const first=await openWorkflow({...args,failAfterNode:point});
      await assert.rejects(async()=>{const p=await first.prepare();await first.finish(first.fixedChoices(p));},/INJECTED_AFTER_DURABLE_CHECKPOINT/);
      const persisted=JSON.parse(await readFile(join(dir,'checkpoint.json'))),resume=await openWorkflow(args),p=await resume.prepare();await resume.finish(resume.fixedChoices(p));
      assert.equal(resume.state.completed,true);assert.equal(resume.state.effects.training,4);assert.equal(resume.state.effects.pilots,2);assert.ok(resume.state.effects.publish<=1);
      for(const old of persisted.nodes.filter(n=>n.status==='COMPLETED'))assert.equal(sha(resume.state.nodes.find(n=>n.name===old.name).output),sha(old.output));
      const before=sha(resume.state);const again=await resume.prepare();await resume.finish(resume.fixedChoices(again));assert.equal(sha(resume.state),before);
      await assert.rejects(()=>openWorkflow({...args,spec:{...spec,budgetCents:4000}}),/BINDING_CHANGED/);
    }
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('diagnostic workflow completes without fitting, experiments, publication or payment capability',async()=>{
  const {catalog}=await frozenInputs(),directory=await mkdtemp(join(tmpdir(),'trusted-report-'));
  try{const w=await openWorkflow({directory,id:'REPORT',task,catalog,spec:{...spec,goal:'reduce_return_exposure',budgetCents:0,durationDays:0}});assert.equal(await w.prepare(),null);assert.equal(w.policy().decision,'report');assert.deepEqual(w.state.effects,{training:0,pilots:0,publish:0});assert.equal(w.state.completed,true);}finally{await rm(directory,{recursive:true,force:true});}
});

test('history evidence is identical across supported funding caps and isolated from future outcomes',async()=>{
  const {catalog}=await frozenInputs();for(const scenario of ['steady','rival_sale','returns_wave']){
    const observations=[1000,3000,10000].map(budgetCents=>{const w=observedWorld({id:'SAME',seed:72040,scenario,catalog,budgetCents});assert.ok(w.actions.every(a=>a.day<45));assert.ok(w.actions.filter(a=>a.matures_day>45).every(a=>a.reward_cents===null));return sha({actions:w.actions,orders:[...w.orders]});});assert.equal(new Set(observations).size,1);
  }
});
