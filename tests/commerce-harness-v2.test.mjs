import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createMarketStore} from '../scripts/market-store.mjs';
import {createAutonomyRoom} from '../scripts/commerce-growth/autonomy/live.mjs';
import {matureOwnRows,compileCampaign,digest,read} from '../scripts/commerce-expanded/harness-v2/tools.mjs';
import {publicationGate} from '../scripts/commerce-expanded/harness-v2/trials.mjs';

test('v2 maturity keeps late-funded purchases and excludes unresolved labels',()=>{
 const observed=[{day:30,customerId:'a',kind:'ask_need',catalogId:null,x:[],featureVectors:{}}],contact={day:30,customerId:'a',kind:'ask_need',catalogId:null,responded:true,authorized:false,requestId:'q',observedBucket:'ask_need|*|cold|new',costCents:5},order={requestId:'q',day:35,feeCents:100,processingCents:20,refundStatus:null,merchants:[{grossCents:1000,feeCents:100,costCents:400,deliveryCents:50}]};
 assert.equal(matureOwnRows(observed,{day:56,outreach:{history:[contact]},pastOrders:[order]}).length,0);
 const [row]=matureOwnRows(observed,{day:57,outreach:{history:[contact]},pastOrders:[order]});assert.equal(row.authorized,0);assert.equal(row.retained,1);assert.equal(row.retailNetCents,75);assert.equal(row.merchantOrderContributionCents,450);
});

test('publication binds exact tested contract and protects the current merchant outcome',async()=>{
 const fixed=(await read('docs/commerce-growth/team-1/development/results.json')).selectedFixed.config,artifact={example:1},model={modelHash:digest(artifact),artifact,report:{metrics:{logLoss:.1},coarse:{logLoss:.2}}},raw={kind:'intent_assistance',objective:'joint',contactsPer100:'10',forecast:'recent14',coverDays:'7',routing:'fast',target:'cheap'},c=compileCampaign(raw,model,fixed,30),m={platformUSD:101,retailerUSD:101,retainedPurchases:11,platformDeltaUSD:1,retailerDeltaUSD:1,purchaseDelta:1,unpaidLiabilities:0},t={contractHash:c.hash,modelHash:model.modelHash,trialHash:'trial',measurement:m},i={measurement:{platformUSD:100,retailerUSD:100,retainedPurchases:10}};
 assert.equal(publicationGate(c,model,t,i).passed,true);assert.equal(publicationGate(c,model,{...t,measurement:{...m,retailerUSD:99}},i).passed,false);
 assert.throws(()=>publicationGate(c,model,{...t,contractHash:'untested'},i),/UNTESTED/);
 assert.equal(compileCampaign(Object.fromEntries(Object.entries(raw).reverse()),model,fixed,30).hash,c.hash);
});

test('v2 pauses dates, trains real models, tests a proposal and revises before publication',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'commerce-v2-')),store=createMarketStore();let release,entered=false,trials=0,native=0;
 const gate=new Promise(r=>{release=r;}),events=[],campaign={kind:'intent_assistance',objective:'joint',contactsPer100:'10',forecast:'recent14',coverDays:'7',routing:'fast',target:'cheap'};
 const providerFactory=async()=>({client:{events,async json(system,packet,{functions}){
  const name=functions[0].name;if(!entered){entered=true;await gate;}
  events.push({configuredModel:'TEST_DOUBLE',modelCostMicros:0,latencyMs:0});const common={evidenceId:packet.evidenceId,rationale:'Offline integration fixture; not an AI performance result.'};
  const args=name==='choose_investigation'?{lens:'payment_funnel',windowDays:'100'}:name==='define_dataset'?{featureView:'intent_context',windowDays:'100',opportunity:'Keep late-funded outcomes.'}:name==='choose_training_experiments'?{first:'forest',second:'logistic',secondFeatureView:'existing'}:name==='select_trained_artifact'?{modelId:packet.experiments.sort((a,b)=>a.report.metrics.logLoss-b.report.metrics.logLoss)[0].modelId,finding:'Use measured error.'}:name==='propose_campaign_trial'?{campaign}:{decision:'revise',modelId:packet.availableModels[0].modelId,campaign:{...campaign,kind:'ranked_discovery'}};
  return {name,args:{...common,...args}};
 }},async close(){}});
 const v2TrialFactory=async()=>({async evaluate(contract,model){if(contract)trials++;const gain=trials>=2?10:-10;return {contractHash:contract?.hash||'FIXED',modelHash:model?.modelHash||null,trialHash:'fixture-'+trials,measurement:{platformUSD:100+(contract?gain:0),retailerUSD:1000+(contract?gain:0),retainedPurchases:20+(contract?Math.sign(gain):0),platformDeltaUSD:contract?gain:0,retailerDeltaUSD:contract?gain:0,purchaseDelta:contract?Math.sign(gain):0,unpaidLiabilities:0},scope:'TEST_DOUBLE'};}});
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
  if(publication.output.decision==='publish')assert.equal(publication.output.contractHash,publication.output.testedContractHash);
 }finally{release();await pending;await service.close();store.close();await rm(dir,{recursive:true,force:true});}
});
