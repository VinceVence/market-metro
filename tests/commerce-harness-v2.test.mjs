import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createMarketStore} from '../scripts/market-store.mjs';
import {createAutonomyRoom} from '../scripts/commerce-growth/autonomy/live.mjs';
import {matureOwnRows,compileCampaign,digest,read,inspectCurrent} from '../scripts/commerce-expanded/harness-v2/tools.mjs';
import {publicationGate,selectPublication} from '../scripts/commerce-expanded/harness-v2/trials.mjs';
import {campaignSchema,validate,toolDeclaration,validateToolReply,canonicalHash,sealTrialReceipt} from '../scripts/commerce-expanded/harness-v2/contracts.mjs';
import {openCommerceHarnessV2} from '../scripts/commerce-expanded/harness-v2/controller.mjs';
import {createGrowthWorld,observeGrowthWorld} from '../scripts/commerce-expanded/environment.mjs';

test('v2 maturity keeps late-funded purchases and excludes unresolved labels',()=>{
 const observed=[{day:30,customerId:'a',kind:'ask_need',catalogId:null,x:[],featureVectors:{}}],contact={day:30,customerId:'a',kind:'ask_need',catalogId:null,responded:true,authorized:false,requestId:'q',observedBucket:'ask_need|*|cold|new',costCents:5},order={requestId:'q',day:35,feeCents:100,processingCents:20,refundStatus:null,merchants:[{grossCents:1000,feeCents:100,costCents:400,deliveryCents:50}]};
 assert.equal(matureOwnRows(observed,{day:56,outreach:{history:[contact]},pastOrders:[order]}).length,0);
 const [row]=matureOwnRows(observed,{day:57,outreach:{history:[contact]},pastOrders:[order]});assert.equal(row.authorized,0);assert.equal(row.retained,1);assert.equal(row.retailNetCents,75);assert.equal(row.merchantOrderContributionCents,450);
 const current=inspectCurrent({day:40,outreach:{history:[contact]},pastOrders:[order],audience:[],products:[],signals:[],requests:[]},'payment_funnel',28);
 assert.equal(current.groups.ask_need.matureRetentionRate,null);assert.equal(current.groups.ask_need.pending,1);
});

const context={day:30,marketProfile:'expanded-12x600',snapshotHash:canonicalHash('snapshot')};
const campaign={kind:'intent_assistance',objective:'joint',contactsPer100:'10',forecast:'recent14',coverDays:'7',supplierSettlement:'paypal_fast',productPreference:'lowest_acceptable_price'};
function receipt(contract,model,measurement,ctx=context,prefix=[]){return sealTrialReceipt({contractHash:contract?.hash||'FIXED',modelHash:model?.modelHash||null,trialHash:canonicalHash({contract:contract?.hash,measurement}),evaluationContextHash:canonicalHash('test-evaluator'),reviewContextHash:canonicalHash(ctx),prefixHash:canonicalHash(prefix),measurement,cases:[{regime:'test',platformDeltaUSD:measurement.platformDeltaUSD,retailerDeltaUSD:measurement.retailerDeltaUSD,purchaseDelta:measurement.purchaseDelta}],scope:'Offline fixture; no profit claim.',activeMarketFutureUsed:false,source:'LOCAL_TRUSTED_EVALUATOR'});}
const measurement=g=>({platformUSD:100+g,retailerUSD:1000+g,retainedPurchases:20+Math.sign(g),platformDeltaUSD:g,retailerDeltaUSD:g,purchaseDelta:Math.sign(g),unpaidLiabilities:0});

test('strict nested proposals reject extra fields, coercions, unknown tools and stale evidence',()=>{
 assert.equal(validate(campaign,campaignSchema),campaign);
 for(const bad of [{...campaign,contactsPer100:10},{...campaign,coverDays:['7']},{...campaign,productPreference:'preferred_shoppers'},{...campaign,sql:'DROP TABLE orders'},{...campaign,supplierSettlement:null}])assert.throws(()=>validate(bad,campaignSchema),/CONTRACT_INVALID/);
 const tools=[toolDeclaration('propose_campaign_trial',{campaign:campaignSchema},'known')],good={name:'propose_campaign_trial',args:{campaign,rationale:'Test the proposal.',evidenceId:'known'}};
 assert.equal(validateToolReply(good,tools).name,good.name);
 for(const bad of [{...good,name:'publish_campaign'},{...good,args:{...good.args,evidenceId:'old'}},{...good,args:{...good.args,approved:true}},{...good,args:{...good.args,campaign:{...campaign,amount:999}}}])assert.throws(()=>validateToolReply(bad,tools),/CONTRACT_/);
});

test('controller keeps the best tested candidate, independent of order or a worse revision',async()=>{
 const fixed=(await read('docs/commerce-growth/team-1/development/results.json')).selectedFixed.config,artifact={example:1},model={modelHash:digest(artifact),artifact,report:{metrics:{logLoss:.1},coarse:{logLoss:.2}}};
 const a=compileCampaign(campaign,model,fixed,context),b=compileCampaign({...campaign,kind:'ranked_discovery'},model,fixed,context),base=receipt(null,null,measurement(0)),first={contract:a,model,trial:receipt(a,model,measurement(20))},worse={contract:b,model,trial:receipt(b,model,measurement(10))};
 assert.equal(publicationGate(a,model,first.trial,base).passed,true);
 assert.deepEqual(selectPublication([first,worse],base,context).decision.selectedContractHash,selectPublication([worse,first],base,context).decision.selectedContractHash);
 assert.equal(selectPublication([first,worse],base,context).selected.contract.hash,a.hash);
 assert.equal(selectPublication([{...first,trial:receipt(a,model,measurement(-1))}],base,context).decision.decision,'keep');
 assert.equal(compileCampaign(Object.fromEntries(Object.entries(campaign).reverse()),model,fixed,context).hash,a.hash);
 assert.throws(()=>{a.campaign.kind='hold';},TypeError);
 assert.throws(()=>publicationGate(a,model,{...first.trial,measurement:measurement(999)},base),/RECEIPT_CHANGED/);
 assert.throws(()=>publicationGate(a,model,receipt(b,model,measurement(20)),base),/UNTESTED/);
 const other=sealTrialReceipt({...Object.fromEntries(Object.entries(first.trial).filter(([k])=>k!=='receiptHash')),evaluationContextHash:canonicalHash('other-market')});
 assert.throws(()=>publicationGate(a,model,other,base),/CONTEXT_MISMATCH/);
 assert.throws(()=>selectPublication([first],base,{...context,day:31}),/STALE/);
 assert.throws(()=>receipt(a,model,{...measurement(20),platformUSD:Infinity}),/CONTRACT_INVALID/);
 assert.throws(()=>receipt(a,model,{...measurement(20),unpaidLiabilities:undefined}),/CONTRACT_INVALID/);
 const tie={...worse,trial:receipt(b,model,measurement(20))};assert.equal(selectPublication([tie,first],base,context).selected.contract.hash,[a.hash,b.hash].sort()[0]);
 const finish=toolDeclaration('finish_review',{},'snapshot');assert.equal(validateToolReply({name:'finish_review',args:{rationale:'No further experiment.',evidenceId:'snapshot'}},[finish]).name,'finish_review');
 assert.equal(selectPublication([first],base,context).decision.decision,'publish','Finishing the search is not an LLM veto');
});

test('v2 pauses dates, trains real models, tests a proposal and revises before publication',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'commerce-v2-')),store=createMarketStore();let release,entered=false,trials=0,native=0;
 const gate=new Promise(r=>{release=r;}),events=[];
 const providerFactory=async()=>({client:{events,async json(system,packet,{functions}){
  const name=functions[0].name;if(!entered){entered=true;await gate;}
  events.push({configuredModel:'TEST_DOUBLE',modelCostMicros:0,latencyMs:0});const common={evidenceId:packet.evidenceId,rationale:'Offline integration fixture; not an AI performance result.'};
  const args=name==='choose_investigation'?{lens:'payment_funnel',windowDays:'100'}:name==='define_dataset'?{featureView:'intent_context',windowDays:'100',opportunity:'Keep late-funded outcomes.'}:name==='choose_training_experiments'?{first:'forest',second:'logistic',secondFeatureView:'existing'}:name==='select_trained_artifact'?{modelId:packet.experiments.sort((a,b)=>a.report.metrics.logLoss-b.report.metrics.logLoss)[0].modelId,finding:'Use measured error.'}:name==='propose_campaign_trial'?{campaign}:{modelId:packet.availableModels[0].modelId,campaign:{...campaign,kind:'ranked_discovery'}};
  return {name,args:{...common,...args}};
 }},async close(){}});
 let firstContractHash=null;
 const v2TrialFactory=async({marketProfile})=>{assert.equal(marketProfile,'expanded-12x600');return {async evaluate(contract,model,prefix,models,ctx){if(contract){trials++;firstContractHash??=contract.hash;}return receipt(contract,model,measurement(contract?(trials>=2?10:20):0),ctx,prefix);}};};
 const service=createAutonomyRoom({store,market:{mirror:async()=>{native++;}},providerFactory,v2TrialFactory,rootDir:dir,autoPump:false});let pending;
 try{
  const s=await service.start({requestId:'v2-offline-integration',seed:987777,regime:'discovery',marketProfile:'expanded-12x600',harnessVersion:'v2',sandbox:false});
  for(let i=0;i<30;i++)await service.step(s.id);pending=service.step(s.id);
  for(let i=0;i<100&&!entered;i++)await new Promise(r=>setTimeout(r,10));assert.equal(entered,true);
  const before=service.snapshot(s.id);assert.equal(before.day,30);assert.equal(before.clockPaused,true);assert.equal(before.reviewDay,31);assert.ok(before.steps.some(c=>c.actor==='GEMINI'&&c.status==='RUNNING'));
  await service.step(s.id);const still=service.snapshot(s.id);assert.equal(still.day,30);assert.equal(still.frame.stats.orders,before.frame.stats.orders);
  release();await pending;const after=service.snapshot(s.id);assert.equal(after.day,31);assert.equal(after.clockPaused,false);assert.equal(after.warning,null);assert.equal(events.length,6);assert.equal(trials,2);
  assert.equal(after.steps.filter(c=>c.actor==='LOCAL_MODEL').length,2);assert.equal(after.steps.filter(c=>c.actor==='LOCAL_CAMPAIGN_TRIAL').length,3);assert.equal(native,0);
  const publication=after.steps.find(c=>c.actor==='TRUSTED_PUBLISHER');assert.ok(publication);assert.equal(publication.output.effectiveDay,30);
  assert.equal(publication.output.decision,'publish');assert.equal(publication.output.contractHash,firstContractHash);assert.equal(publication.output.contractHash,publication.output.testedContractHash);assert.equal(publication.output.authority,'DETERMINISTIC_CONTROLLER');
 }finally{release();await pending;await service.close();store.close();await rm(dir,{recursive:true,force:true});}
});

test('repeated same-day planning is single-flight and cannot change evidence or return mutable state',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'commerce-idempotent-')),prior=await read('docs/commerce-growth/team-1/training/model.json'),incumbent=(await read('docs/commerce-growth/team-1/development/results.json')).selectedFixed.config;
 const c=await openCommerceHarnessV2({id:'offline',dir,prior,incumbent,providerFactory:async()=>{throw Error('NO_PROVIDER_CALL_ALLOWED');}});
 try{const view=observeGrowthWorld(createGrowthWorld({seed:5,regime:'discovery'})),a=c.plan(view),b=c.plan(structuredClone(view));await assert.rejects(c.plan({...view,day:1}),/INVALID_DAY_ORDER/);const [x,y]=await Promise.all([a,b]);assert.deepEqual(x,y);x.actions.push({corrupt:true});assert.deepEqual((await c.plan(view)).actions,y.actions);await assert.rejects(c.plan({...view,extraEvidence:true}),/INPUT_CHANGED/);assert.equal(c.summary().modelCalls,0);}finally{await c.close();await rm(dir,{recursive:true,force:true});}
});
