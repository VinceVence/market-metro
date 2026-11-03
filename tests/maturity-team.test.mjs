import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {predictMaturity,inquiryHistory,trainMaturity} from '../scripts/commerce-growth/autonomy/maturity-model.mjs';
import {auditInquiry,candidateHash,BASE_CANDIDATE} from '../scripts/commerce-growth/autonomy/team-v2.mjs';
const g={n:100,responseRate:.3,conditionalRetention:.5,retentionRate:.15,retainedNetCents:300,failedResponseNetCents:-5,meanNetCents:40.75};
test('response evidence updates promptly without treating pending responders as purchase failures',()=>{
 const model={spec:{grouping:'intent',recipe:'response_hurdle'},strength:8,groups:{cold:g},all:g},bucket='ask_need|*|cold|new';
 const events=Array.from({length:10},(_,i)=>({day:31,kind:'ask_need',observedBucket:bucket,responded:i<2?1:0,labelCompleteDay:57}));
 const a=predictMaturity(model,bucket,events,32),b=predictMaturity(model,bucket,events.map(e=>({...e,retained:1,retailNetCents:999999})),32);
 assert.deepEqual(a,b);assert.equal(a.matureContacts,0);assert.equal(a.pendingResponders,2);assert.equal(a.responseProbability,(8*.3+2)/18);assert.equal(a.probability,a.responseProbability*.5);
 assert.deepEqual(predictMaturity(model,bucket,[...events,{...events[0],day:33,responded:1}],32),a);
});
test('public maturity history redacts financial labels until settlement window closes',()=>{
 const view={day:40,outreach:{history:[{day:39,kind:'ask_need',observedBucket:'ask_need|*|cold|new',responded:true,costCents:5,requestId:'r'}]},pastOrders:[{day:39,requestId:'r',feeCents:1000,processingCents:100,refundStatus:null}]};
 const history=inquiryHistory(view);assert.equal(Object.hasOwn(history[0],'retained'),false);assert.equal(Object.hasOwn(history[0],'retailNetCents'),false);
 const mature=inquiryHistory({...view,day:66});assert.equal(mature[0].retained,1);assert.equal(mature[0].retailNetCents,895);
});
test('model fitting selects shrinkage on independent whole-market folds',async()=>{
 const data=JSON.parse(await readFile('docs/commerce-growth/autonomy-1/funding-training/dataset.json','utf8')),model=trainMaturity(data.rows,{grouping:'intent',recipe:'response_hurdle'});
 assert.equal(model.report.markets,7);assert.ok([8,32,128].includes(model.artifact.strength));assert.ok(model.report.metrics.auc>0&&model.report.metrics.auc<1);assert.ok(model.artifact.trainingRows>200);
 assert.equal(Object.hasOwn(model.artifact.groups.cold,'customerId'),false);assert.equal(Object.hasOwn(model.artifact.groups.cold,'regime'),false);
});
test('audit preserves v1 ranking and pending responders; JSON ordering is not a new policy',()=>{
 const view={day:40,audience:[{customerId:'a',signal:null,purchaseCount:0}],pastOrders:[],outreach:{history:[],rules:{outreachCostCents:5}}},prior={groups:{'ask_need|cold':{contacts:100,retained:5,retailNetCents:500}}},advice={observedContacts:50,matureContacts:20,pendingResponders:1,cautiousNetCents:-1};
 const keep=auditInquiry(view,prior,'a',()=>advice),veto=auditInquiry(view,prior,'a',()=>({...advice,pendingResponders:0}));assert.equal(keep.veto,false);assert.equal(veto.veto,true);assert.equal(veto.probability,keep.probability);assert.equal(veto.expectedNetCents,-5);assert.equal(veto.probeNetCents,keep.expectedNetCents);
 assert.equal(candidateHash(BASE_CANDIDATE,{baseline:null}),candidateHash(Object.fromEntries(Object.entries(BASE_CANDIDATE).reverse()),{baseline:null}));
});
