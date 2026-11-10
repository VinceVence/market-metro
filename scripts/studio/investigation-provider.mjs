import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {PROJECT_ID,FLASH_LITE_PROFILE} from '../../benchmark/vertex.mjs';

export const STUDIO_CAP_MICROS=250000,STUDIO_RESERVATION_MICROS=30000,STUDIO_MAX_CALLS=64;
export const chargedMicros=state=>state.entries.reduce((n,e)=>n+(e.status==='complete'&&Number.isFinite(e.costUSD)&&e.costUSD>=0?Math.ceil(e.costUSD*1e6):e.reservedMicros),0);
let auth;
async function token(){
 if(auth?.until>Date.now())return auth.value;
 let value;
 if(process.env.K_SERVICE){
  const headers={'Metadata-Flavor':'Google'},base='http://metadata.google.internal/computeMetadata/v1/';
  const project=await fetch(base+'project/project-id',{headers,signal:AbortSignal.timeout(5000)});
  if((await project.text()).trim()!==PROJECT_ID)throw Error('WRONG_STUDIO_PROJECT');
  const r=await fetch(base+'instance/service-accounts/default/token',{headers,signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('STUDIO_AUTH_UNAVAILABLE');value=(await r.json()).access_token;
 }else{const path=resolve('.local/gcp/config.json'),config=JSON.parse(await readFile(path,'utf8'));if(config.projectId!==PROJECT_ID)throw Error('WRONG_STUDIO_PROJECT');value=(await promisify(execFile)(config.pythonPath,['-B',resolve('scripts/vertex-token.py'),path],{timeout:30000,maxBuffer:16384})).stdout.trim();}
 if(typeof value!=='string'||value.length<20)throw Error('STUDIO_AUTH_UNAVAILABLE');auth={value,until:Date.now()+45*60000};return value;
}
export function reserveBudget(state,id,role){
 if(state?.version!==1||state.capMicros!==STUDIO_CAP_MICROS||!Array.isArray(state.entries)||state.entries.some(x=>x.reservedMicros!==STUDIO_RESERVATION_MICROS))throw Error('INVALID_STUDIO_BUDGET');
 const old=state.entries.find(e=>e.requestId===id);
 if(old)throw Error('STUDIO_REQUEST_ALREADY_RESERVED');
 if(state.entries.length>=STUDIO_MAX_CALLS||chargedMicros(state)+STUDIO_RESERVATION_MICROS>state.capMicros)throw Error('STUDIO_BUDGET_EXHAUSTED');
 return {...state,entries:[...state.entries,{id:randomUUID(),requestId:id,role,at:new Date().toISOString(),reservedMicros:STUDIO_RESERVATION_MICROS,status:'reserved'}]};
}
export function createStudioProvider({enabled=process.env.STUDIO_AGENT_ENABLED==='true',bucket=process.env.STUDIO_AGENT_BUCKET,fetchFn=fetch}={}){
 const objectKey=id=>'runs/'+id+'.json';
 async function cloud(method,url,options={}){return fetchFn(url,{...options,method,headers:{Authorization:'Bearer '+await token(),...(options.headers||{})},signal:AbortSignal.timeout(45000)});}
 async function readObject(name){
  if(!bucket||!bucket.startsWith(PROJECT_ID+'-studio-'))throw Error('STUDIO_STORE_NOT_CONFIGURED');
  const r=await cloud('GET',`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(name)}?alt=media`);
  if(r.status===404)return null;if(!r.ok)throw Error('STUDIO_STORE_HTTP_'+r.status);
  return {value:await r.json(),generation:r.headers.get('x-goog-generation')};
 }
 async function writeObject(name,value,generation){
  const suffix=generation!=null?'&ifGenerationMatch='+generation:'';
  return cloud('POST',`https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(name)}${suffix}`,{headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
 }
 async function updateBudget(change){
  for(let n=0;n<8;n++){
   const old=await readObject('budget.json');if(!old||!/^\d+$/.test(old.generation||''))throw Error('STUDIO_BUDGET_NOT_INITIALIZED');
   const next=change(old.value),r=await writeObject('budget.json',next,old.generation);
   if(r.status===412)continue;if(!r.ok)throw Error('STUDIO_BUDGET_WRITE_FAILED');return next;
  }throw Error('STUDIO_BUDGET_BUSY');
 }
 return {
  async status(){
   if(!enabled)return {enabled:false,capUSD:.25,remainingCalls:0};
   try{const state=(await readObject('budget.json'))?.value;if(state?.capMicros!==STUDIO_CAP_MICROS||!Array.isArray(state.entries))throw Error('INVALID_STUDIO_BUDGET');const remaining=STUDIO_CAP_MICROS-chargedMicros(state);return {enabled:true,capUSD:.25,remainingCalls:remaining>=STUDIO_RESERVATION_MICROS*2?Math.max(0,STUDIO_MAX_CALLS-state.entries.length):0,remainingUSD:Math.max(0,remaining)/1e6,estimatedUSD:state.entries.reduce((n,e)=>n+(e.costUSD||0),0)};}
   catch{return {enabled:false,capUSD:.25,remainingCalls:0,reason:'Agent budget unavailable'};}
  },
  async decide(id,role,system,packet,schema){
   if(!enabled)throw Error('STUDIO_FRESH_PLANNING_DISABLED');
   const request={systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:JSON.stringify(packet)}]}],generationConfig:{temperature:0,maxOutputTokens:2048,candidateCount:1,responseMimeType:'application/json',responseSchema:schema,thinkingConfig:{thinkingLevel:'LOW',includeThoughts:false}}};
   if(Buffer.byteLength(JSON.stringify(request))>32768)throw Error('STUDIO_INPUT_LIMIT');
   await updateBudget(s=>reserveBudget(s,id,role));
   const start=Date.now();let status='uncertain',result;
   try{
    const r=await cloud('POST',`https://aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/global/publishers/google/models/${FLASH_LITE_PROFILE.model}:generateContent`,{headers:{'Content-Type':'application/json','x-goog-user-project':PROJECT_ID},body:JSON.stringify(request)});
    if(!r.ok){status='rejected';throw Error('STUDIO_MODEL_HTTP_'+r.status);}
    const body=await r.json(),u=body.usageMetadata,candidate=body.candidates?.[0];
    if(body.modelVersion&&!body.modelVersion.startsWith(FLASH_LITE_PROFILE.model))throw Error('UNEXPECTED_STUDIO_MODEL');
    if(!u||!Number.isSafeInteger(u.promptTokenCount)||!Number.isSafeInteger(u.candidatesTokenCount)||candidate?.finishReason!=='STOP')throw Error('STUDIO_MODEL_OUTPUT_INVALID');
    const output=JSON.parse(candidate.content.parts.filter(p=>!p.thought).map(p=>p.text||'').join(''));
    const usage={inputTokens:u.promptTokenCount,outputTokens:u.candidatesTokenCount,thinkingTokens:u.thoughtsTokenCount||0,model:body.modelVersion||FLASH_LITE_PROFILE.model,responseId:body.responseId||null,latencyMs:Date.now()-start};
    const costUSD=Math.ceil(usage.inputTokens*.25+(usage.outputTokens+usage.thinkingTokens)*1.5)/1e6;
    if(costUSD>.03)throw Error('STUDIO_RESERVATION_EXCEEDED');
    result={output,usage,costUSD};status='complete';return result;
   }finally{
    // Only a completed, metered response releases unused reservation. Uncertain calls stay fully charged; no retry.
    await updateBudget(s=>({...s,entries:s.entries.map(e=>e.requestId===id?{...e,status,...(result?{usage:result.usage,costUSD:result.costUSD}:{})}:e)}));
   }
  },
  async save(id,value){if(!enabled)return;const r=await writeObject(objectKey(id),value);if(!r.ok)throw Error('STUDIO_CHECKPOINT_SAVE_FAILED');},
  async load(id){if(!enabled)return null;return (await readObject(objectKey(id)))?.value;},
  async loadExample(){try{return JSON.parse(await readFile('demo/data/studio-investigation-demo.json','utf8'));}catch{return null;}}
 };
}
