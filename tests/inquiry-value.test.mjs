import test from 'node:test';
import assert from 'node:assert/strict';
import {fitInquiryValue,inquiryValueEstimates,inquiryBucket} from '../scripts/commerce-expanded/harness-v2/inquiry-value.mjs';
import {canonicalHash} from '../scripts/commerce-expanded/harness-v2/contracts.mjs';
import {profileFor,capTeamLedger} from '../scripts/agent-mesh/model-client.mjs';
const rows=['fresh','recent','cold'].flatMap(bucket=>Array.from({length:20},(_,i)=>({kind:'ask_need',observedBucket:'ask_need|*|'+bucket+'|new',responded:Number(i<10),retained:Number(i<5),retailNetCents:i<5?50:i<10?-10:-5,merchantOrderContributionCents:i<5?100:i<10?-20:0})));
const view=(day,history=[],orders=[])=>({day,outreach:{history,rules:{outreachCostCents:5}},pastOrders:orders});

test('inquiry models fit their own targets and reject inconsistent historical labels',()=>{
 const m=fitInquiryValue(rows);assert.equal(m.rows,60);assert.equal(m.groups.fresh.responded,10);assert.equal(m.groups.cold.paymentReply,200);
 assert.throws(()=>fitInquiryValue([{...rows[0],responded:0,retained:1}]),/INVALID_INQUIRY_TRAINING_ROW/);
 assert.throws(()=>fitInquiryValue(rows.filter(r=>r.observedBucket.includes('fresh'))),/INQUIRY_HISTORY_INCOMPLETE/);
 assert.equal(inquiryBucket({day:40},{signal:{day:39}}),'fresh');assert.equal(inquiryBucket({day:40},{signal:null}),'cold');
});

test('reply calibration excludes same-day observations and never treats lack of immediate funding as failure',()=>{
 const model=fitInquiryValue(rows),before=canonicalHash(model),contact={day:39,kind:'ask_need',observedBucket:'ask_need|*|recent|new',responded:true,authorized:false,costCents:5,requestId:'r'};
 assert.deepEqual(inquiryValueEstimates(view(40,[{...contact,day:40}]),model),inquiryValueEstimates(view(40),model));
 assert.deepEqual(inquiryValueEstimates(view(40,[contact]),model),inquiryValueEstimates(view(40,[{...contact,authorized:true}]),model));
 assert.ok(inquiryValueEstimates(view(40,[contact]),model).get('recent').probability>0);assert.equal(canonicalHash(model),before);
 const silent=Array.from({length:300},(_,i)=>({...contact,day:39-i%20,responded:false,requestId:null})),estimate=inquiryValueEstimates(view(40,silent),model).get('recent');
 assert.ok(estimate.responseShift<0);assert.ok(estimate.expectedNetCents<0);
});

test('late-funded order value is learned only after the complete outcome window',()=>{
 const model=fitInquiryValue(rows),contact={day:30,kind:'ask_need',observedBucket:'ask_need|*|cold|new',responded:true,authorized:false,costCents:5,requestId:'r'},order={day:35,requestId:'r',feeCents:500,processingCents:20,refundStatus:null,merchants:[{grossCents:1000,feeCents:500,costCents:100,deliveryCents:10}]};
 assert.deepEqual(inquiryValueEstimates(view(40,[contact],[order]),model),inquiryValueEstimates(view(40,[contact]),model));
 const positive=inquiryValueEstimates(view(57,[contact],[order]),model).get('cold'),missing=inquiryValueEstimates(view(57,[contact]),model).get('cold');
 assert.equal(positive.matureReplies,1);assert.ok(positive.expectedNetCents>missing.expectedNetCents);assert.ok(positive.expectedSharedNetCents>positive.expectedNetCents);
});

test('both architectures have one strong review slot and a tighter shared spending ceiling',async()=>{
 assert.equal(profileFor('first_review_pro','propose_campaign_revision',30),'pro');
 assert.equal(profileFor('first_review_pro','propose_campaign_revision',60),'flash_lite');
 assert.equal(profileFor('first_review_pro','select_trained_artifact',30),'flash_lite');
 let reservations=0;const ledger={profile:'pro',snapshot:()=>({runId:'test',runChargedMicros:60000,entries:[]}),reserve:async()=>{reservations++;}};
 await assert.rejects(()=>capTeamLedger(ledger,{capMicros:190000}).reserve({}),/BUDGET/);assert.equal(reservations,0);
});
