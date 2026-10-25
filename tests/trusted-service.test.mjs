import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createTrustedWorkflowService} from '../scripts/trusted-workflow/service.mjs';

test('live mission is idempotent, finishes with a fake model and creates no payment capability',async()=>{
  const root=await mkdtemp(join(tmpdir(),'trusted-service-'));let calls=0;
  const clientFactory=async()=>({client:{events:[],async json(){calls++;return {name:'interpret_mission',args:{status:'ready',goal:'understand_market',merchantIndices:[0,1,2],budgetCents:0,maxCouponPct:0,durationDays:0,inactiveDays:0,reason:'Diagnostic report only.',sourceIds:{goal:'S001',merchants:'S001',budget:null,discount:null,duration:null,inactivity:null}}};}},async close(){}});
  try{
    const service=createTrustedWorkflowService({root,clientFactory}),input={requestId:'same-request-id',brief:'Understand market trends for all shops. Analysis only.',seed:77001,scenario:'steady',method:'reader'};
    const first=await service.start(input),second=await service.start(input);assert.equal(first.id,second.id);
    let result;for(let i=0;i<100;i++){result=await service.get(first.id);if(['COMPLETED','FAILED'].includes(result.status))break;await new Promise(r=>setTimeout(r,20));}
    assert.equal(result.status,'COMPLETED');assert.equal(result.nativePayments,false);assert.equal(result.result.decision,'report');assert.equal(result.result.costUSD,0);assert.equal(calls,1);
    await service.resume(first.id);assert.equal(calls,1);assert.deepEqual(result.checkpoint.effects,{training:0,pilots:0,publish:0});
    await assert.rejects(()=>service.start({...input,method:'raw_sql'}),/INVALID_TRUSTED_MISSION/);
    await assert.rejects(()=>service.get('../../.env'),/INVALID_TRUSTED_JOB_ID/);
  }finally{await rm(root,{recursive:true,force:true});}
});
