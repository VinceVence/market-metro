import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {compileProgram,calculate,field,op,SEED_PROGRAMS,programContacts,merchantContributionWeights} from '../scripts/commerce-growth/experiments/program.mjs';
import {runProgramCase} from '../scripts/commerce-growth/experiments/runner.mjs';
import {openAllocator} from '../scripts/commerce-deadlines/solver.mjs';
import {warmGrowthWorld} from '../scripts/commerce-growth/evaluate.mjs';
import {beginGrowthDay,observeGrowthWorld} from '../scripts/commerce-growth/environment.mjs';
import {planFundedBaskets} from '../scripts/commerce-growth/experiments/baskets.mjs';
import {bindExperimentResult,publishTestedArtifact,runExperimentWorkflow} from '../scripts/commerce-growth/experiments/workflow.mjs';
const prior=JSON.parse(await readFile('docs/commerce-growth/team-1/training/model.json','utf8'));
test('program grammar excludes private fields and executable code and bounds arithmetic',()=>{
 assert.throws(()=>compileProgram({...SEED_PROGRAMS[0].program,contactScore:field('seed')}),/PRIVATE/);
 assert.throws(()=>compileProgram({...SEED_PROGRAMS[0].program,contactScore:{op:'eval',args:['process.env']}}),/INVALID/);
 assert.equal(calculate(op('div',1,0),{}),0);
 const p=compileProgram(SEED_PROGRAMS[0].program);assert.throws(()=>{p.program.historyDays=90;},TypeError);
});
test('an earlier visible product signal can survive a later irrelevant signal',()=>{
 const w=warmGrowthWorld({seed:301,regime:'discovery',days:36,customers:30});beginGrowthDay(w);const view=observeGrowthWorld(w),p=view.products[0],other=view.products.find(x=>x.catalogId!==p.catalogId),customer=view.audience.find(x=>x.marketingConsent&&!x.hasOpenRequest);
 assert.ok(customer);view.audience=[{...customer,lastContactDay:null,signal:{day:view.day,customerId:customer.customerId,category:other.category,catalogId:other.catalogId,kind:'BROWSE'}}];
 view.products=view.products.map(x=>({...x,available:x.catalogId===p.catalogId?5:0}));view.inbound=[];view.signals=[{day:view.day-1,customerId:customer.customerId,category:p.category,catalogId:p.catalogId,kind:'SEARCH'},view.audience[0].signal];
 const program=compileProgram({...SEED_PROGRAMS[0].program,contactGate:op('and',field('is_recommendation'),op('gt',field('stock'),0))}),plan=programContacts(view,program,prior);
 assert.equal(plan.actions[0].catalogId,p.catalogId);assert.equal(plan.actions.length,1);
});
test('a full compiled-policy case preserves funding, consent and money invariants',async()=>{
 const allocator=openAllocator();try{const result=await runProgramCase({seed:301,regime:'discovery',days:36,customers:30},SEED_PROGRAMS[0],{allocator,prior});assert.equal(result.reliability.invariantsPassed,true);assert.equal(result.unpaidLiabilities,0);assert.equal(result.modelCostUSD,0);}finally{allocator.close();}
});
test('funded basket planning uses stocked alternatives and shares cash and stock across requests',()=>{
 const products=[{id:'A',catalogId:'a',priceCents:5000,costCents:2000,stock:1},{id:'ALT',catalogId:'alt',priceCents:4000,costCents:1000,stock:0},{id:'B',catalogId:'b',priceCents:5000,costCents:2000,stock:0}].map(p=>({...p,merchantId:'M',reserved:0,available:p.stock}));
 const request=id=>({id,status:'AUTHORIZED',createdDay:30,deadlineDay:35,budgetCents:10000,authorizedCents:10000,lines:[{id:'one',quantity:1,preferredCatalogId:'alt',acceptableCatalogIds:['a','alt']},{id:'two',quantity:1,preferredCatalogId:'b',acceptableCatalogIds:['b']}]});
 const view={day:30,marketDays:100,products,merchants:[{id:'M',cashCents:5000}],requests:[request('R1'),request('R2'),request('R3')],pastRequests:[],inbound:[],paymentRules:{physicalLeadMaxDays:3}};
 const plan=planFundedBaskets(view,{cashFraction:1});
 assert.equal(plan.decisions[0].newCashCents,2000);assert.equal(plan.picks.find(p=>p.requestId==='R1'&&p.productId==='A').quantity,1);
 assert.deepEqual(plan.orders[0].items,[{productId:'B',quantity:2},{productId:'ALT',quantity:1}]);
 assert.equal(plan.spentCents.M,5000);assert.equal(plan.decisions[2].status,'NO_COMPLETE_FUNDED_PLAN');
 const tooLate=planFundedBaskets({...view,requests:[{...request('LATE'),deadlineDay:34}]},{cashFraction:1});assert.equal(tooLate.orders.length,0);
});
test('merchant balancing uses only observed contribution and cannot read a later order',()=>{
 const order=(day,id,profit)=>({day,refundStatus:null,merchants:[{id,grossCents:profit+200,feeCents:50,costCents:100,deliveryCents:50}]}),view={day:50,merchants:[{id:'A'},{id:'B'}],pastOrders:[order(10,'A',10000),order(10,'B',10000),order(35,'A',20000)]};
 const weights=merchantContributionWeights(view);assert.equal(weights.A.weight,2/3);assert.equal(weights.B.weight,2);
 assert.deepEqual(merchantContributionWeights({...view,pastOrders:[...view.pastOrders,order(70,'B',1000000)]}),weights);
 assert.ok(compileProgram({...SEED_PROGRAMS[0].program,basketScore:op('add',field('platform_usd'),op('mul',.001,field('balanced_retailer_usd')))}));
});
test('publication rejects changed measurements, changed programs and failed financial guards',()=>{
 const proposal=SEED_PROGRAMS[0],modelHash='observed-model',measurement={status:'COMPLETED',economyUnchanged:true,modelHash,programHash:compileProgram(proposal.program).hash,platformDeltaUSD:5,cashAndContributionPassed:true,originalInventoryPassed:true},artifact=bindExperimentResult(proposal,measurement,modelHash);
 measurement.platformDeltaUSD=500;assert.equal(artifact.measurement.platformDeltaUSD,5);assert.ok(publishTestedArtifact(artifact,{modelHash}));
 const changed=structuredClone(artifact);changed.measurement.platformDeltaUSD=100;assert.throws(()=>publishTestedArtifact(changed,{modelHash}),/TESTED_ARTIFACT_CHANGED/);
 const program=structuredClone(artifact);program.program.cashFraction=.9;assert.throws(()=>publishTestedArtifact(program,{modelHash}),/TESTED_ARTIFACT_CHANGED/);
 assert.equal(publishTestedArtifact(bindExperimentResult(proposal,{...measurement,cashAndContributionPassed:false},modelHash),{modelHash}),null);
});
test('an experiment closer cannot claim an unmeasured profit increase',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'commerce-workflow-')),first=SEED_PROGRAMS[0],second=SEED_PROGRAMS[1],modelHash='observed-model';
 try{await assert.rejects(runExperimentWorkflow({output:join(dir,'workflow.json'),evidence:{},modelHash,proposer:async()=>first,reviewer:async()=>({decision:'revise',program:second.program,hypothesis:'Test a different response score'}),closer:async()=>({selected:'B',measuredDeltaUSD:100}),probe:async p=>({status:'COMPLETED',economyUnchanged:true,modelHash,programHash:compileProgram(p.program).hash,platformDeltaUSD:5,cashAndContributionPassed:true,originalInventoryPassed:true})}),/UNCITED_OR_INVENTED_EXPERIMENT_VALUE/);
  const checkpoint=JSON.parse(await readFile(join(dir,'workflow.json'),'utf8'));assert.equal(checkpoint.status,'FAILED');assert.equal(checkpoint.published,false);
  await assert.rejects(runExperimentWorkflow({output:join(dir,'workflow.json'),evidence:{},modelHash,proposer:async()=>{throw Error('MUST_NOT_RUN');}}),/EEXIST/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
