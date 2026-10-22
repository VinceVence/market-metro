import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createSandboxFunding} from '../scripts/paypal-funding.mjs';

async function fixture(t){
  const dir=await mkdtemp(join(tmpdir(),'metro-funding-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const file=join(dir,'private.json'),state={approved:false,creates:0,exchanges:0,keys:[],profile:'A',mode:'SANDBOX'};
  const paypal={status:()=>({configured:true,mode:state.mode}),profileKey:()=>state.profile,async requestSandbox(path,args={}){
    if(path==='/v3/vault/setup-tokens'){state.creates++;return {id:'SETUP123',status:'PAYER_ACTION_REQUIRED',customer:{id:'CUSTOMER123'},links:[{rel:'approve',href:'https://sandbox.paypal.com/agreements/approve?approval_session_id=SETUP123'}]};}
    if(path==='/v3/vault/setup-tokens/SETUP123')return {id:'SETUP123',status:state.approved?'APPROVED':'PAYER_ACTION_REQUIRED'};
    if(path==='/v3/vault/payment-tokens'){state.exchanges++;state.keys.push(args.requestId);assert.deepEqual(args.body,{payment_source:{token:{id:'SETUP123',type:'SETUP_TOKEN'}}});if(state.loseExchange){state.loseExchange=false;throw new Error('Lost exchange response');}return {id:'SECRET_VAULT_ID',customer:{id:'CUSTOMER123'},payment_source:{paypal:{email_address:'private@example.test'}}};}
    throw new Error('Unexpected route');
  }};
  return {state,paypal,file,funding:await createSandboxFunding({paypal,path:file}),saved:async()=>JSON.parse(await readFile(file,'utf8'))};
}
test('one approved sandbox wallet survives restart and never exposes the vault token',async t=>{
  const f=await fixture(t);const a=await f.funding.start('http://127.0.0.1:4173'),b=await f.funding.start('http://127.0.0.1:4173');assert.equal(a.approvalUrl,b.approvalUrl);assert.equal(f.state.creates,1);
  f.state.approved=true;await f.funding.complete((await f.saved()).state);const restored=await createSandboxFunding({paypal:f.paypal,path:f.file});
  assert.equal(restored.status().ready,true);assert.equal((await restored.start('http://127.0.0.1:4173')).ready,true);assert.equal(f.state.exchanges,1);
  assert.deepEqual(restored.paymentSource(),{paypal:{vault_id:'SECRET_VAULT_ID',stored_credential:{payment_initiator:'MERCHANT',usage:'SUBSEQUENT',usage_pattern:'UNSCHEDULED_PREPAID'}}});
  assert(!JSON.stringify(restored.status()).includes('SECRET_VAULT_ID'));assert(!JSON.stringify(restored.status()).includes('private@'));
});
test('a browser return cannot manufacture consent; unknown state and unapproved tokens cannot be used',async t=>{
  const f=await fixture(t);await f.funding.start('http://127.0.0.1:4173');await assert.rejects(()=>f.funding.complete('forged'),{code:'SETUP_STATE_MISMATCH'});
  await assert.rejects(async()=>f.funding.complete((await f.saved()).state),{code:'BUYER_APPROVAL_REQUIRED'});assert.equal(f.state.exchanges,0);assert.throws(()=>f.funding.paymentSource(),{code:'SANDBOX_BUYER_REQUIRED'});
});
test('lost exchange response is retried using the persisted token-exchange key',async t=>{
  const f=await fixture(t);await f.funding.start('http://127.0.0.1:4173');f.state.approved=true;f.state.loseExchange=true;const nonce=(await f.saved()).state;
  await assert.rejects(()=>f.funding.complete(nonce),/Lost/);const restored=await createSandboxFunding({paypal:f.paypal,path:f.file});await restored.complete(nonce);
  assert.equal(f.state.keys[0],f.state.keys[1]);assert.equal(restored.status().ready,true);
});
test('live mode, foreign returns and a changed merchant profile cannot use saved funding',async t=>{
  const f=await fixture(t);await assert.rejects(()=>f.funding.start('https://example.com'),{code:'LOCAL_RETURN_REQUIRED'});assert.equal(f.state.creates,0);
  await f.funding.start('http://127.0.0.1:4173');f.state.approved=true;await f.funding.complete((await f.saved()).state);f.state.profile='B';assert.equal(f.funding.status().ready,false);assert.throws(()=>f.funding.paymentSource(),{code:'SANDBOX_BUYER_REQUIRED'});
  f.state.mode='LIVE';await assert.rejects(()=>f.funding.start('http://127.0.0.1:4173'),{code:'SANDBOX_REQUIRED'});
});
