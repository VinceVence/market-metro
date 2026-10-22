import {open,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';

export const VERTEX_MODEL='gemini-3.1-pro-preview';
export const PROJECT_ID='supply-yard-pilot-261021';
export const MODEL_LIMITS=Object.freeze({lifetimeMicros:8_000_000,runMicros:5_000_000,reservationMicros:150_000,maxInputBytes:32_768,maxOutputTokens:4096,maxCallsPerTrial:14,minRequestGapMs:12000});
export const PRICING=Object.freeze({inputMicrosPerToken:2,outputMicrosPerToken:12,verifiedAt:'2026-10-21',validThrough:'2026-11-12',url:'https://cloud.google.com/vertex-ai/generative-ai/pricing',basis:'Gemini 3.1 Pro global standard text list price below 200k input tokens; includes thinking tokens; ignores cache discounts. Token-based estimate, not a billing invoice.'});

export async function openSpendLedger(path,{initialize=false,runId=randomUUID()}={}){
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
    runId,
    async reserve(metadata){
      if(state.circuit||state.entries.some(e=>e.status==='pending'))throw new Error('SPEND_CIRCUIT_OPEN');
      if(sum(state.entries)+MODEL_LIMITS.reservationMicros>MODEL_LIMITS.lifetimeMicros||sum(state.entries.filter(e=>e.runId===runId))+MODEL_LIMITS.reservationMicros>MODEL_LIMITS.runMicros)throw new Error('MODEL_SPEND_LIMIT');
      const entry={...metadata,id:randomUUID(),runId,at:new Date().toISOString(),status:'pending',pricing:{...PRICING},reservedMicros:MODEL_LIMITS.reservationMicros,chargedMicros:MODEL_LIMITS.reservationMicros};
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

export function createVertexClient({token,ledger,fetchFn=fetch,now=()=>new Date(),requestGapMs=MODEL_LIMITS.minRequestGapMs}){
  const events=[];let lastRequestAt=0;
  return {
    events,
    async json(system,payload,{signal,caseId,trialId,stage,schema}={}){
      if(now().toISOString().slice(0,10)>PRICING.validThrough)throw new Error('REVERIFY_MODEL_PRICE_BEFORE_SPENDING');
      const text=JSON.stringify(payload),bytes=Buffer.byteLength(system)+Buffer.byteLength(text);
      if(bytes>MODEL_LIMITS.maxInputBytes)throw new Error('MODEL_INPUT_LIMIT');
      if(events.filter(e=>e.trialId===trialId).length>=MODEL_LIMITS.maxCallsPerTrial)throw new Error('MODEL_CALL_LIMIT');
      if(signal?.aborted)throw new Error('MODEL_ABORTED');
      const request={systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text}]}],generationConfig:{temperature:0,candidateCount:1,maxOutputTokens:MODEL_LIMITS.maxOutputTokens,responseMimeType:'application/json',thinkingConfig:{thinkingLevel:stage==='planner'?'MEDIUM':'LOW',includeThoughts:false}}};
      if(schema)request.generationConfig.responseSchema=schema;
      if(Buffer.byteLength(JSON.stringify(request))>MODEL_LIMITS.maxInputBytes)throw new Error('MODEL_INPUT_LIMIT');
      const delay=Math.max(0,lastRequestAt+requestGapMs-Date.now());
      if(delay)await new Promise((resolve,reject)=>{const timer=setTimeout(done,delay);function done(){signal?.removeEventListener('abort',abort);resolve();}function abort(){clearTimeout(timer);reject(new Error('MODEL_ABORTED'));}signal?.addEventListener('abort',abort,{once:true});});
      if(signal?.aborted)throw new Error('MODEL_ABORTED');
      const id=await ledger.reserve({caseId,trialId,stage,model:VERTEX_MODEL,inputBytes:bytes,promptHash:createHash('sha256').update(JSON.stringify(request)).digest('hex')});
      const event={reservationId:id,caseId,trialId,stage,status:'pending',modelCostMicros:null};events.push(event);
      try{
        lastRequestAt=Date.now();
        const response=await fetchFn('https://aiplatform.googleapis.com/v1/projects/'+PROJECT_ID+'/locations/global/publishers/google/models/'+VERTEX_MODEL+':generateContent',{
          method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','x-goog-user-project':PROJECT_ID},body:JSON.stringify(request),
          signal:signal?AbortSignal.any([signal,AbortSignal.timeout(45_000)]):AbortSignal.timeout(45_000)
        });
        if(!response.ok){
          await ledger.rejectHttp(id,response.status);Object.assign(event,{status:'rejected',httpStatus:response.status,modelCostMicros:0});
          const errorBody=await response.json().catch(()=>null);event.providerError={status:errorBody?.error?.status,message:errorBody?.error?.message};
          throw new Error('VERTEX_HTTP_'+response.status);
        }
        const body=await response.json(),usage=body.usageMetadata;
        if(!usage||!Number.isSafeInteger(usage.promptTokenCount)||!Number.isSafeInteger(usage.candidatesTokenCount))throw new Error('MISSING_MODEL_USAGE');
        const measured={inputTokens:usage.promptTokenCount,outputTokens:usage.candidatesTokenCount,thinkingTokens:usage.thoughtsTokenCount||0,cachedInputTokens:usage.cachedContentTokenCount||0};
        const cost=await ledger.settle(id,measured);Object.assign(event,{...measured,modelCostMicros:cost,status:'settled',responseId:body.responseId||null,modelVersion:body.modelVersion||null});
        const candidate=body.candidates?.[0];
        if(candidate?.finishReason!=='STOP')throw new Error('MODEL_OUTPUT_'+(candidate?.finishReason||'EMPTY'));
        const output=(candidate.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||'').join('');
        return JSON.parse(output);
      }catch(error){
        if(event.status==='pending'){await ledger.uncertain(id);event.status='uncertain';}
        event.error=error.message;throw error;
      }
    }
  };
}
