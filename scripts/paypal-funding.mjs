import {randomUUID, timingSafeEqual, createHash} from 'node:crypto';
import {mkdir, readFile, rename, writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {SandboxError} from './paypal-sandbox.mjs';

const idPattern=/^[a-zA-Z0-9_-]{1,255}$/;
const FIVE_HOURS=5*3600000,THREE_DAYS=3*86400000;
const fail=(status,code,message)=>{throw new SandboxError(status,code,message);};
const sandboxLink=href=>{
  let u;try{u=new URL(href);}catch{fail(502,'INVALID_SETUP_LINK','PayPal did not return a valid sandbox approval link.');}
  if(u.protocol!=='https:'||!['www.sandbox.paypal.com','sandbox.paypal.com'].includes(u.hostname)||u.username||u.password||(u.port&&u.port!=='443'))fail(502,'INVALID_SETUP_LINK','The approval link must stay inside PayPal Sandbox.');
  return u.href;
};

export async function createSandboxFunding({paypal,path}={}){
  let saved=null,inFlight=null;
  if(path)try{saved=JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code!=='ENOENT')fail(500,'FUNDING_STORE_ERROR','The saved sandbox buyer could not be read. Preserve the file before repairing it.');}
  function guard(){if(paypal.status().mode!=='SANDBOX'||!paypal.status().configured)fail(409,'SANDBOX_REQUIRED','A configured sandbox app is required. Live payment mode is not supported.');}
  const own=()=>saved?.profile===paypal.profileKey();
  const ready=()=>own()&&paypal.status().mode==='SANDBOX'&&paypal.status().configured&&idPattern.test(saved.paymentTokenId||'');
  const status=()=>({mode:'SANDBOX',method:'PAYPAL_WALLET_VAULT',ready:ready(),needsApproval:own()&&!ready()&&Boolean(saved.result?.id),approvedAt:ready()?saved.approvedAt:null,description:ready()?'Reusable sandbox buyer saved. Selected test orders need no repeated checkout.':'Approve one sandbox buyer once to enable selected test orders.'});
  async function persist(){if(!path)return;await mkdir(dirname(path),{recursive:true,mode:0o700});const tmp=path+'.tmp';await writeFile(tmp,JSON.stringify(saved,null,2),{mode:0o600});await rename(tmp,path);}
  async function exclusive(action){if(inFlight)return inFlight;inFlight=action();try{return await inFlight;}finally{inFlight=null;}}
  async function start(origin){return exclusive(async()=>{
    guard();if(ready())return status();
    if(!/^http:\/\/(127\.0\.0\.1|localhost):\d{1,5}$/.test(origin))fail(400,'LOCAL_RETURN_REQUIRED','Sandbox setup must return to this local app.');
    if(!own()||Date.now()-Date.parse(saved.createdAt)>THREE_DAYS){saved={profile:paypal.profileKey(),requestId:randomUUID(),state:randomUUID(),createdAt:new Date().toISOString()};await persist();}
    if(!saved.result?.id){
      if(Date.now()-Date.parse(saved.createdAt)>FIVE_HOURS)fail(409,'SETUP_RECONCILE_REQUIRED','The previous setup request is uncertain. Reconcile it before replacing its idempotency key.');
      const result=await paypal.requestSandbox('/v3/vault/setup-tokens',{method:'POST',requestId:saved.requestId,body:{payment_source:{paypal:{
        description:'Market Metro sandbox test buyer. Selected emulator orders only; no real funds.',
        permit_multiple_payment_tokens:false,usage_pattern:'IMMEDIATE',usage_type:'MERCHANT',customer_type:'CONSUMER',
        experience_context:{shipping_preference:'NO_SHIPPING',brand_name:'Market Metro Sandbox',locale:'en-US',return_url:origin+'/sandbox-buyer.html?state='+saved.state,cancel_url:origin+'/sandbox-buyer.html?cancelled=1'}
      }}}});
      if(!idPattern.test(result.id||'')||!['PAYER_ACTION_REQUIRED','APPROVED'].includes(result.status))fail(502,'INVALID_SETUP_TOKEN','PayPal returned an unexpected setup-token response.');
      // Validate the provider-controlled redirect before persisting or exposing it.
      sandboxLink(result.links?.find(l=>l.rel==='approve')?.href);saved.result=result;await persist();
    }
    return {...status(),approvalUrl:sandboxLink(saved.result.links?.find(l=>l.rel==='approve')?.href)};
  });}
  async function complete(state){return exclusive(async()=>{
    guard();
    if(!own()||typeof state!=='string'||typeof saved.state!=='string'||Buffer.byteLength(state)!==Buffer.byteLength(saved.state)||!timingSafeEqual(Buffer.from(state),Buffer.from(saved.state)))fail(400,'SETUP_STATE_MISMATCH','This return does not match the locally started sandbox setup.');
    if(ready())return status();
    if(!idPattern.test(saved.result?.id||''))fail(409,'NO_SETUP_TOKEN','Start the sandbox buyer setup first.');
    if(!saved.exchangeStartedAt){
      const setup=await paypal.requestSandbox('/v3/vault/setup-tokens/'+encodeURIComponent(saved.result.id));
      if(setup.id!==saved.result.id||setup.status!=='APPROVED')fail(409,'BUYER_APPROVAL_REQUIRED','PayPal still requires the one-time sandbox buyer approval.');
      saved.exchangeRequestId=randomUUID();saved.exchangeStartedAt=new Date().toISOString();await persist();
    }else if(Date.now()-Date.parse(saved.exchangeStartedAt)>FIVE_HOURS)fail(409,'TOKEN_RECONCILE_REQUIRED','A previous token exchange has an uncertain result. Reconcile it before creating another.');
    const token=await paypal.requestSandbox('/v3/vault/payment-tokens',{method:'POST',requestId:saved.exchangeRequestId,body:{payment_source:{token:{id:saved.result.id,type:'SETUP_TOKEN'}}}});
    if(!idPattern.test(token.id||'')||!token.payment_source?.paypal)fail(502,'INVALID_PAYMENT_TOKEN','PayPal did not confirm a saved wallet token.');
    if(saved.result.customer?.id&&token.customer?.id!==saved.result.customer.id)fail(502,'TOKEN_CUSTOMER_MISMATCH','The payment token does not match the setup customer.');
    saved.paymentTokenId=token.id;saved.customerId=token.customer?.id||null;saved.approvedAt=new Date().toISOString();await persist();
    return status();
  });}
  function paymentSource(){guard();if(!ready())fail(409,'SANDBOX_BUYER_REQUIRED','Approve the sandbox buyer once before mirroring orders.');return {paypal:{vault_id:saved.paymentTokenId,stored_credential:{payment_initiator:'MERCHANT',usage:'SUBSEQUENT',usage_pattern:'UNSCHEDULED_PREPAID'}}};}
  const fingerprint=()=>ready()?createHash('sha256').update(saved.paymentTokenId).digest('hex'):null;
  return {status,start,complete,paymentSource,fingerprint};
}
