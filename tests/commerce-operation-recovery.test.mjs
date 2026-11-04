import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {initializeTeamVertex} from '../scripts/agent-mesh/model-client.mjs';
import {PROJECT_ID} from '../benchmark/vertex.mjs';
import {createTrialTool} from '../scripts/commerce-expanded/harness-v2/trials.mjs';
import {canonicalHash} from '../scripts/commerce-expanded/harness-v2/contracts.mjs';

test('a transient auth read recovers once without bypassing spend-cap verification',async()=>{
 let calls=0,verifications=0;const token='synthetic-test-token-not-a-credential';
 const r=await initializeTeamVertex({projectId:PROJECT_ID,pythonPath:'fixture'},'fixture-config',{
  run:async()=>{calls++;if(calls===1)throw Object.assign(Error('authentication transport failed'),{stderr:'urllib3/connection.py in _new_conn',code:1});return {stdout:token};},
  verify:async(config,value)=>{verifications++;assert.equal(config.projectId,PROJECT_ID);assert.equal(value,token);return {verified:true};}
 });assert.equal(calls,2);assert.equal(verifications,1);assert.equal(r.initializationRetries,1);assert.equal(r.cap.verified,true);
});

test('a timed-out local trial is repeated with identical input, then its result is cached',async()=>{
 const root=await mkdtemp(join(tmpdir(),'commerce-trial-retry-'));let calls=0,firstInput;
 try{
  const tool=await createTrialTool({root,fixed:{id:'test-fixed',config:{}},prior:{},marketProfile:'expanded-12x600',execute:async(inputPath,outputPath)=>{
   const text=await readFile(inputPath,'utf8');calls++;if(calls===1){firstInput=text;throw Object.assign(Error('process time limit'),{killed:true,signal:'SIGTERM',code:null});}
   assert.equal(text,firstInput);const input=JSON.parse(text),rows=input.cases.map(c=>({...c,initialHash:'fixture',opportunityHash:'fixture',consentHash:'fixture',incomeCents:100,platformUSD:10,retailerUSD:20,retainedPurchases:2,retainedVolumeUSD:100,terminalCashUSD:40,terminalInventoryUSD:10,contactCount:3,outreachCostUSD:.15,unpaidLiabilities:0}));
   await writeFile(outputPath,JSON.stringify({key:input.key,rows}));
  }});
  const context={day:30,marketProfile:'expanded-12x600',snapshotHash:canonicalHash('fixture')};
  const result=await tool.evaluate(null,null,[],{},context);assert.equal(result.measurement.platformDeltaUSD,0);assert.equal(calls,2);assert.equal(tool.recoveryEvents.length,1);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('initialization retry is bounded and permission, project, cancellation and malformed-token failures remain closed',async()=>{
 const config={projectId:PROJECT_ID,pythonPath:'fixture'},token='synthetic-test-token-not-a-credential';
 for(const error of [Object.assign(Error('invalid_grant'),{code:1}),Object.assign(Error('cancelled'),{killed:true,signal:'SIGINT',code:null}),Object.assign(Error('too much output'),{killed:true,signal:'SIGTERM',code:'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'})]){
  let calls=0;await assert.rejects(()=>initializeTeamVertex(config,'fixture',{run:async()=>{calls++;throw error;},verify:async()=>{throw Error('MUST_NOT_VERIFY');}}));assert.equal(calls,1);
 }
 let calls=0;await assert.rejects(()=>initializeTeamVertex(config,'fixture',{run:async()=>{calls++;throw Object.assign(Error('connection reset'),{code:'ECONNRESET'});}}),/connection reset/);assert.equal(calls,2);
 calls=0;await assert.rejects(()=>initializeTeamVertex({...config,projectId:'not-the-pilot'},'fixture',{run:async()=>{calls++;}}),/INVALID_CLOUD_PROJECT/);assert.equal(calls,0);
 calls=0;await assert.rejects(()=>initializeTeamVertex(config,'fixture',{run:async()=>{calls++;return {stdout:token};},verify:async()=>{throw Error('SPEND_CAP_VERIFICATION_HTTP_403');}}),/403/);assert.equal(calls,1);
 calls=0;await assert.rejects(()=>initializeTeamVertex(config,'fixture',{run:async()=>{calls++;return {stdout:''};}}),/VERTEX_AUTH_UNAVAILABLE/);assert.equal(calls,1);
 let verifications=0;const r=await initializeTeamVertex(config,'fixture',{run:async()=>({stdout:token}),verify:async()=>{if(++verifications===1)throw Error('SPEND_CAP_VERIFICATION_HTTP_503');return {verified:true};}});assert.equal(verifications,2);assert.equal(r.initializationRetries,1);
});

test('local trial retries stop after one retry and never retry deterministic failures or invalid results',async()=>{
 for(const kind of ['timeout','invalid-model','invalid-result']){
  const root=await mkdtemp(join(tmpdir(),'commerce-trial-bound-'));let calls=0;
  try{
   await assert.rejects(()=>createTrialTool({root,fixed:{id:'test',config:{}},prior:{},marketProfile:'expanded-12x600',execute:async(inputPath,outputPath)=>{
    calls++;if(kind==='timeout')throw Object.assign(Error('deadline'),{killed:true,signal:'SIGTERM',code:null});
    if(kind==='invalid-model')throw Object.assign(Error('invalid model'),{code:1});
    await writeFile(outputPath,JSON.stringify({key:'wrong',rows:[]}));
   }}));assert.equal(calls,kind==='timeout'?2:1);
  }finally{await rm(root,{recursive:true,force:true});}
 }
});
