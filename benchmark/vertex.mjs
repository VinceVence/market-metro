import {open,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';

export const VERTEX_MODEL='gemini-3.1-pro-preview';
export const PROJECT_ID='supply-yard-pilot-261021';
export const MODEL_LIMITS=Object.freeze({lifetimeMicros:8_000_000,runMicros:5_000_000,reservationMicros:150_000,maxInputBytes:32_768,maxOutputTokens:4096,maxCallsPerTrial:14,minRequestGapMs:12000});
export const PRICING=Object.freeze({inputMicrosPerToken:2,outputMicrosPerToken:12,verifiedAt:'2026-10-21',validThrough:'2026-11-12',url:'https://cloud.google.com/vertex-ai/generative-ai/pricing',basis:'Gemini 3.1 Pro global standard text list price below 200k input tokens; includes thinking tokens; ignores cache discounts. Token-based estimate, not a billing invoice.'});

export const FLASH_LITE_PROFILE=Object.freeze({
  model:'gemini-3.1-flash-lite',
  limits:Object.freeze({lifetimeMicros:8_000_000,runMicros:250_000,reservationMicros:30_000,maxInputBytes:32_768,maxOutputTokens:2048,maxCallsPerTrial:32,minRequestGapMs:6000}),
  pricing:Object.freeze({inputMicrosPerToken:.25,outputMicrosPerToken:1.5,verifiedAt:'2026-10-23',validThrough:'2026-11-12',url:'https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing',basis:'Gemini 3.1 Flash-Lite global standard text list price; includes thinking tokens, ignores cache discounts. Metered-token estimate, not a billing invoice.'})
});
function modelProfile(profile){
  if(profile==='flash_lite')return FLASH_LITE_PROFILE;
  if(profile==='pro')return {model:VERTEX_MODEL,limits:MODEL_LIMITS,pricing:PRICING};
  throw new Error('UNAPPROVED_MODEL_PROFILE');
}

export async function openSpendLedger(path,{initialize=false,runId=randomUUID(),profile='pro'}={}){
  const {limits,pricing}=modelProfile(profile);
  // ponytail: one local pilot writer. Distributed execution needs a shared transactional ledger.
  const lock=await open(path+'.lock','wx',0o600);await lock.writeFile(JSON.stringify({pid:process.pid,runId}));
  let state;
  const persist=async()=>{await writeFile(path+'.tmp',JSON.stringify(state,null,2)+'\n',{mode:0o600});await rename(path+'.tmp',path);};
  try{
    try{state=JSON.parse(await readFile(path,'utf8'));}
    catch(error){
      if(error.code!=='ENOENT'||!initialize)throw error;
      state={version:1,projectId:PROJECT_ID,lifetimeCapMicros:MODEL_LIMITS.lifetimeMicros,entries:[],circuit:null};await persist();
    }
    if(state.version!==1||state.projectId!==PROJECT_ID||state.lifetimeCapMicros!==MODEL_LIMITS.lifetimeMicros||!Array.isArray(state.entries))throw new Error('INVALID_SPEND_LEDGER');
    // Preserve historical Flash-Lite receipts and their prices; never reset or reprice prior spend.
    for(const e of state.entries)if(!Number.isSafeInteger(e.reservedMicros)||![30_000,150_000].includes(e.reservedMicros)||!['pending','settled','uncertain'].includes(e.status)||!Number.isSafeInteger(e.chargedMicros)||e.chargedMicros<0)throw new Error('INVALID_SPEND_ENTRY');
    if(state.entries.some(e=>e.status!=='settled')||state.circuit)throw new Error('SPEND_CIRCUIT_OPEN: uncertain previous execution needs review; do not reset the ledger.');
  }catch(error){await lock.close();await unlink(path+'.lock');throw error;}
  const sum=entries=>entries.reduce((n,e)=>n+e.chargedMicros,0);
  return {
    runId,profile,
    async reserve(metadata){
      if(state.circuit||state.entries.some(e=>e.status==='pending'))throw new Error('SPEND_CIRCUIT_OPEN');
      if(profile==='flash_lite'&&state.entries.filter(e=>e.runId===runId&&(e.trialId||e.runId)===(metadata.trialId||runId)).length>=limits.maxCallsPerTrial)throw new Error('MODEL_CALL_LIMIT');
      if(sum(state.entries)+limits.reservationMicros>limits.lifetimeMicros||sum(state.entries.filter(e=>e.runId===runId))+limits.reservationMicros>limits.runMicros)throw new Error('MODEL_SPEND_LIMIT');
      const entry={...metadata,id:randomUUID(),runId,at:new Date().toISOString(),status:'pending',pricing:{...pricing},reservedMicros:limits.reservationMicros,chargedMicros:limits.reservationMicros};
      state.entries.push(entry);await persist();return entry.id;
    },
    async settle(id,usage){
      const e=state.entries.find(e=>e.id===id);if(!e||e.status!=='pending')throw new Error('INVALID_RESERVATION');
      const {inputTokens,outputTokens,thinkingTokens=0}=usage;
      if(![inputTokens,outputTokens,thinkingTokens].every(n=>Number.isSafeInteger(n)&&n>=0))throw new Error('INVALID_USAGE');
      const cost=Math.ceil(inputTokens*e.pricing.inputMicrosPerToken+(outputTokens+thinkingTokens)*e.pricing.outputMicrosPerToken);
      Object.assign(e,{status:'settled',chargedMicros:cost,usage});
      if(cost>e.reservedMicros){state.circuit='USAGE_EXCEEDED_RESERVATION';await persist();throw new Error(state.circuit);}
      await persist();return cost;
    },
    async uncertain(id){
      const e=state.entries.find(e=>e.id===id);if(e?.status==='pending'){e.status='uncertain';state.circuit='UNKNOWN_PROVIDER_OUTCOME';await persist();}
    },
    async rejectHttp(id,status){
      const e=state.entries.find(e=>e.id===id);
      if(!e||e.status!=='pending'||!Number.isInteger(status)||status<400||status>599)throw new Error('INVALID_HTTP_REJECTION');
      Object.assign(e,{status:'settled',chargedMicros:0,httpStatus:status,reconciliation:{at:new Date().toISOString(),observedHttpStatus:status,previousChargedMicros:e.reservedMicros,decision:'Definitive non-200 response: no input/output token charge under verified provider pricing. No retry.',source:PRICING.url}});
      await persist();
    },
    snapshot(){return structuredClone({...state,runId,runChargedMicros:sum(state.entries.filter(e=>e.runId===runId)),lifetimeChargedMicros:sum(state.entries)});},
    async close(){await lock.close();await unlink(path+'.lock');}
  };
}

export async function verifySpendCap(config,token,fetchFn=fetch){
  if(config.projectId!==PROJECT_ID||!/^\d+$/.test(config.projectNumber)||!/^billingAccounts\/[A-Z0-9-]+\/budgets\/[a-z0-9-]+$/.test(config.budgetName))throw new Error('INVALID_CLOUD_CONFIG');
  const response=await fetchFn('https://billingbudgets.googleapis.com/v1/'+config.budgetName,{headers:{Authorization:'Bearer '+token,'x-goog-user-project':PROJECT_ID},signal:AbortSignal.timeout(20_000)});
  if(!response.ok)throw new Error('SPEND_CAP_VERIFICATION_HTTP_'+response.status);
  const cap=await response.json(),money=cap.amount?.specifiedAmount,f=cap.budgetFilter;
  if(money?.currencyCode!=='USD'||Number(money.units)!==10||Number(money.nanos||0)!==0
    ||JSON.stringify(f?.projects)!==JSON.stringify(['projects/'+config.projectNumber])
    ||JSON.stringify(f?.services)!==JSON.stringify(['services/C7E2-9256-1C43'])
    ||f?.calendarPeriod!=='MONTH'||f?.creditTypesTreatment!=='EXCLUDE_ALL_CREDITS'
    ||cap.spendCap?.outputState!=='CONFIGURED')throw new Error('REQUIRED_VERTEX_SPEND_CAP_NOT_CONFIGURED');
  return {verifiedAt:new Date().toISOString(),budgetName:cap.name,amountUSD:10,period:'MONTH',state:cap.spendCap.outputState,scope:PROJECT_ID+' / aiplatform.googleapis.com',limit:'Native enforcement can lag and allow overages. Local ledger additionally caps this pilot; other services are outside this cap.'};
}

export function createVertexClient({token,ledger,fetchFn=fetch,now=()=>new Date(),requestGapMs,requestTimeoutMs=45_000,profile='pro'}){
  const {model,limits,pricing}=modelProfile(profile);
  if(ledger.profile!==profile)throw new Error('MODEL_LEDGER_PROFILE_MISMATCH');
  requestGapMs??=limits.minRequestGapMs;
  const events=[];let lastRequestAt=0;
  return {
    events,
    async json(system,payload,{signal,caseId,trialId,stage,schema,functions,thinkingLevel}={}){
      if(now().toISOString().slice(0,10)>pricing.validThrough)throw new Error('REVERIFY_MODEL_PRICE_BEFORE_SPENDING');
      const text=JSON.stringify(payload),bytes=Buffer.byteLength(system)+Buffer.byteLength(text);
      if(bytes>limits.maxInputBytes)throw new Error('MODEL_INPUT_LIMIT');
      if(events.filter(e=>e.trialId===trialId).length>=limits.maxCallsPerTrial)throw new Error('MODEL_CALL_LIMIT');
      if(signal?.aborted)throw new Error('MODEL_ABORTED');
      if(thinkingLevel!==undefined&&(profile!=='flash_lite'||!['MINIMAL','LOW','MEDIUM','HIGH'].includes(thinkingLevel)))throw new Error('INVALID_THINKING_LEVEL');
      const request={systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text}]}],generationConfig:{temperature:0,candidateCount:1,maxOutputTokens:limits.maxOutputTokens,responseMimeType:'application/json',thinkingConfig:{thinkingLevel:thinkingLevel??(profile==='flash_lite'?'MINIMAL':stage==='planner'?'MEDIUM':'LOW'),includeThoughts:false}}};
      if(schema)request.generationConfig.responseSchema=schema;
      if(functions){
        if(!Array.isArray(functions)||!functions.length)throw new Error('INVALID_MODEL_TOOLS');
        delete request.generationConfig.responseSchema;delete request.generationConfig.responseMimeType;
        request.tools=[{functionDeclarations:functions}];request.toolConfig={functionCallingConfig:{mode:'ANY',allowedFunctionNames:functions.map(f=>f.name)}};
      }
      if(Buffer.byteLength(JSON.stringify(request))>limits.maxInputBytes)throw new Error('MODEL_INPUT_LIMIT');
      const delay=Math.max(0,lastRequestAt+requestGapMs-Date.now());
      if(delay)await new Promise((resolve,reject)=>{const timer=setTimeout(done,delay);function done(){signal?.removeEventListener('abort',abort);resolve();}function abort(){clearTimeout(timer);reject(new Error('MODEL_ABORTED'));}signal?.addEventListener('abort',abort,{once:true});});
      if(signal?.aborted)throw new Error('MODEL_ABORTED');
      const id=await ledger.reserve({caseId,trialId,stage,model,inputBytes:bytes,promptHash:createHash('sha256').update(JSON.stringify(request)).digest('hex')});
      const event={reservationId:id,caseId,trialId,stage,status:'pending',modelCostMicros:null,reservedMicros:limits.reservationMicros};events.push(event);
      try{
        lastRequestAt=Date.now();
        const response=await fetchFn('https://aiplatform.googleapis.com/v1/projects/'+PROJECT_ID+'/locations/global/publishers/google/models/'+model+':generateContent',{
          method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','x-goog-user-project':PROJECT_ID},body:JSON.stringify(request),
          signal:signal?AbortSignal.any([signal,AbortSignal.timeout(requestTimeoutMs)]):AbortSignal.timeout(requestTimeoutMs)
        });
        if(!response.ok){
          await ledger.rejectHttp(id,response.status);Object.assign(event,{status:'rejected',httpStatus:response.status,modelCostMicros:0});
          const errorBody=await response.json().catch(()=>null);event.providerError={status:errorBody?.error?.status,message:errorBody?.error?.message};
          throw new Error('VERTEX_HTTP_'+response.status);
        }
        const body=await response.json(),usage=body.usageMetadata;
        if(!usage||!Number.isSafeInteger(usage.promptTokenCount)||!Number.isSafeInteger(usage.candidatesTokenCount))throw new Error('MISSING_MODEL_USAGE');
        const measured={inputTokens:usage.promptTokenCount,outputTokens:usage.candidatesTokenCount,thinkingTokens:usage.thoughtsTokenCount||0,cachedInputTokens:usage.cachedContentTokenCount||0};
        const cost=await ledger.settle(id,measured);Object.assign(event,{...measured,modelCostMicros:cost,status:'settled',responseId:body.responseId||null,modelVersion:body.modelVersion||null,latencyMs:Date.now()-lastRequestAt});
        if(profile==='flash_lite'&&body.modelVersion&&!body.modelVersion.startsWith(model))throw new Error('UNEXPECTED_MODEL_VERSION');
        const candidate=body.candidates?.[0];
        if(candidate?.finishReason!=='STOP')throw new Error('MODEL_OUTPUT_'+(candidate?.finishReason||'EMPTY'));
        if(functions){const calls=(candidate.content?.parts||[]).filter(p=>p.functionCall).map(p=>p.functionCall);if(calls.length!==1||!functions.some(f=>f.name===calls[0].name))throw new Error('MODEL_TOOL_CALL_COUNT');return calls[0];}
        const output=(candidate.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||'').join('');
        return JSON.parse(output);
      }catch(error){
        if(event.status==='pending'){await ledger.uncertain(id);event.status='uncertain';}
        event.error=error.message;throw error;
      }
    }
  };
}
