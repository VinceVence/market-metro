import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openAutonomousCommerce,scoreLearnedContacts} from '../scripts/commerce-growth/autonomy/controller.mjs';
import {RESPONSE_FIELDS} from '../scripts/commerce-growth/autonomy/features.mjs';
import {inquiryEstimate} from '../scripts/commerce-growth/autonomy/inquiry-expert.mjs';
import {fitFundingCalibration,adjustForFunding,evaluateFundingPredictions} from '../scripts/commerce-growth/autonomy/funding-calibration.mjs';
import {runCoordinatedCase} from '../scripts/commerce-growth/team/runner.mjs';
import {openAllocator} from '../scripts/commerce-deadlines/solver.mjs';
test('market funding fit uses past observations, responds to local failure and can recover',()=>{
 const prior={version:'TEST',groups:{'recommend|fresh':{contacts:100,funded:20}}},make=(day,authorized)=>({day,authorized,kind:'recommend',observedBucket:'recommend|Stationery|fresh|returning'}),estimate={probability:.2,expectedNetCents:35};
 const empty=fitFundingCalibration({day:60,outreach:{history:[]}},prior);assert.equal(adjustForFunding(estimate,empty,'recommend|fresh',-5).probability,.2);
 const history=[...Array.from({length:40},(_,i)=>make(40+i%10,false)),make(60,true),make(70,true)],view={day:60,outreach:{history}},snapshot=JSON.stringify(view),fit=fitFundingCalibration(view,prior),adjusted=adjustForFunding(estimate,fit,'recommend|fresh',-5);
 assert.equal(fit.rows,40);assert.ok(adjusted.probability<estimate.probability/4);assert.ok(adjusted.expectedNetCents<estimate.expectedNetCents);assert.equal(JSON.stringify(view),snapshot);
 const recovered=fitFundingCalibration({day:100,outreach:{history:[...history,...Array.from({length:12},()=>make(99,true))]}},prior);assert.equal(recovered.rows,12);assert.ok(adjustForFunding(estimate,recovered,'recommend|fresh',-5).probability>estimate.probability);
});
test('prediction audit scores the same issued contacts and treats refunds as failed retention',()=>{
 const decisions=[{day:40,ranking:[{customerId:'A',catalogId:'P',probability:.6,calibration:{baseProbability:.2,contacts:8,funded:3}},{customerId:'B',catalogId:'Q',probability:.1,calibration:{baseProbability:.5,contacts:12,funded:1}}]}],contacts=[{day:40,customerId:'A',catalogId:'P',kind:'recommend',requestId:'R1'},{day:40,customerId:'B',catalogId:'Q',kind:'recommend',requestId:'R2'}],orders=[{requestId:'R1',id:'O1',refundStatus:null},{requestId:'R2',id:'O2',refundStatus:'SETTLED'}];
 const q=evaluateFundingPredictions(decisions,contacts,orders);assert.equal(q.observations,2);assert.ok(Math.abs(q.base.brier-.445)<1e-12);assert.ok(Math.abs(q.adapted.brier-.085)<1e-12);assert.equal(evaluateFundingPredictions([],[],[]).base.brier,null);
});
test('inquiry calibration uses observed shopper intent and only mature local outcomes',()=>{
 const view={day:31,audience:[{customerId:'A',signal:{day:30}}],pastOrders:[{requestId:'old',day:40,feeCents:1000,processingCents:100}],outreach:{rules:{outreachCostCents:5},history:[{kind:'ask_need',day:0,observedBucket:'ask_need|*|fresh|returning',requestId:'old',costCents:5},{kind:'ask_need',day:30,observedBucket:'ask_need|*|fresh|returning',costCents:5}]}},prior={groups:{'ask_need|fresh':{contacts:100,retained:20,retailNetCents:5000},'ask_need|cold':{contacts:100,retained:1,retailNetCents:-100}}};
 const prediction=inquiryEstimate(view,prior,'A');assert.equal(prediction.bucket,'fresh');assert.equal(prediction.matureLocalContacts,1);assert.equal(prediction.expectedNetCents,(8*50-5)/9);assert.throws(()=>inquiryEstimate(view,prior,'UNKNOWN'),/NOT_OBSERVED/);
});
test('recent-interest audience permits inquiries for interested shoppers when both actions are requested',()=>{
 const person=id=>({customerId:id,marketingConsent:true,hasOpenRequest:false,lastContactDay:null,lastPurchaseDay:20,purchaseCount:1}),signal={customerId:'interested',catalogId:'A',category:'Stationery',kind:'SEARCH',day:30},
  view={day:31,marketDays:100,products:[{id:'P',catalogId:'A',category:'Stationery',priceCents:5000,available:5}],audience:[{...person('interested'),signal},person('cold')],signals:[signal],pastOrders:[],inbound:[],outreach:{history:[],contactsToday:0,remainingBudgetCents:5000,availablePlatformCashCents:5000,rules:{dailyContactLimit:10,customerContactGapDays:7,outreachCostCents:5}}},
  artifact={trainingRows:1,models:{logistic:{family:'logistic',featureNames:RESPONSE_FIELDS,mean:RESPONSE_FIELDS.map(()=>0),scale:RESPONSE_FIELDS.map(()=>1),coefficients:RESPONSE_FIELDS.map(()=>0),intercept:1}},valueMeans:{ask_need:{retainedNetCents:200,failedNetCents:-5},recommend:{retainedNetCents:100,failedNetCents:-5}}},model={id:'TEST',family:'logistic',artifact,cutoff:30},campaign={audience:'recent_interest',contactKinds:'both',contactsPerDay:'10',minimumNetCents:'0'};
 const result=scoreLearnedContacts(view,{prior:{groups:{},rows:0},model,campaign,supply:{}});assert.deepEqual(result.actions,[{customerId:'interested',kind:'ask_need',category:'*',catalogId:null}]);
 const recommendations=scoreLearnedContacts(view,{prior:{groups:{},rows:0},model,campaign:{...campaign,contactKinds:'recommend'},supply:{}});assert.equal(recommendations.actions[0].kind,'recommend');assert.equal(recommendations.actions.length,1);
 view.signals.push({...signal,catalogId:'B',day:29});view.products.push({id:'OLD',catalogId:'B',category:'Stationery',priceCents:10000,available:5});
 artifact.models.logistic.coefficients[RESPONSE_FIELDS.indexOf('price_usd')]=.1;
 const rank=(m)=>scoreLearnedContacts(view,{prior:{groups:{},rows:0},model:m,campaign:{...campaign,contactKinds:'recommend'},supply:{}});
 assert.equal(rank(model).actions[0].catalogId,'B','Unrestricted scoring can replace the latest intent with an older expensive product');
 assert.equal(rank({...model,intentScope:'latest'}).actions[0].catalogId,'A','The latest-intent contract must respect the current expressed product');
});
test('three role handoffs train a real local model, publish and settle without a paid provider',async()=>{
 const parent=await mkdtemp(join(tmpdir(),'commerce-autonomy-')),dir=join(parent,'case'),prior=JSON.parse(await readFile('docs/commerce-growth/team-1/training/model.json','utf8')),incumbent=JSON.parse(await readFile('docs/commerce-growth/team-1/development/results.json','utf8')).selectedFixed.config,
  events=[],providerFactory=async()=>({client:{events,async json(_system,packet,{functions}){const name=functions[0].name,args={evidenceId:packet.evidenceId,rationale:'Offline orchestration test double; this is not an application-model performance result.',...(name==='analyse_market'?{focus:'fresh_intent',finding:'Test observed intent.'}:name==='choose_model_work'?{decision:'train',family:'forest',windowDays:'100',recipe:'clarify_ambiguous',valuation:'pooled',adaptation:'adaptive_funding',intentScope:'latest'}:{decision:'publish',audience:'all',contactKinds:'both',contactsPerDay:'10',minimumNetCents:'0',routing:'fast',forecast:'recent14',coverDays:'7'})};events.push({configuredModel:'TEST_DOUBLE',modelCostMicros:0,latencyMs:0});return {name,args};}},async close(){}}),allocator=openAllocator();let team;
 try{
  team=await openAutonomousCommerce({id:'OFFLINE-CHECK',dir,prior,incumbent,providerFactory,recipeSelection:true,fundingPrior:JSON.parse(await readFile('docs/commerce-growth/autonomy-1/funding-training/funding-prior.json','utf8'))});
  const result=await runCoordinatedCase({seed:3130,regime:'discovery',days:36,customers:30},{id:'autonomy_test_double'},{controller:team,allocator,prior}),summary=team.summary();
  assert.equal(summary.failed,false);assert.equal(summary.modelCalls,3);assert.equal(summary.trainingJobs,1);assert.equal(summary.publications,1);assert.equal(summary.modelCostUSD,0);assert.equal(result.unpaidLiabilities,0);
  assert.ok(summary.checkpoints.find(c=>c.actor==='LOCAL_TRAINING_TOOL').output.validationPassed);
  const artifact=JSON.parse(await readFile(join(dir,'model-day-30/models.json'),'utf8'));assert.equal(artifact.inquiryRouting,'ambiguous');assert.equal(artifact.inquiryPrior.version,prior.version);assert.equal(artifact.adaptiveFunding,true);assert.equal(artifact.intentScope,'latest');assert.ok(summary.calibrationUpdates>0);
  assert.ok(summary.checkpoints.find(c=>c.actor==='TRUSTED_PUBLISHER').output.automated);
  assert.equal(summary.checkpoints.some(c=>c.actor==='GEMINI'&&c.day>=36),false);
 }finally{await team?.close();allocator.close();await rm(parent,{recursive:true,force:true});}
});
