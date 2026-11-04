import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
import {openSpendLedger,createVertexClient,verifySpendCap,PROJECT_ID,VERTEX_MODEL,FLASH_LITE_PROFILE} from '../../benchmark/vertex.mjs';

const ROOT=resolve(import.meta.dirname,'../..');
export const TEAM_MODEL_ROUTES=Object.freeze({lite:'Flash-Lite for all roles',hybrid:'Flash-Lite investigator; Gemini3.1 Pro campaign scientist and reviewer',research:'Gemini3.1 Pro for dataset contracts, model selection and economic review; Flash-Lite for evidence queries and campaign proposals'});
export function profileFor(route,tool){
  if(!Object.hasOwn(TEAM_MODEL_ROUTES,route))throw Error('INVALID_TEAM_MODEL_ROUTE');
  return route==='hybrid'&&['propose_policy','review_policy','close_experiment','propose_campaign_revision'].includes(tool)||route==='research'&&['prepare_training_data','select_model','select_economic_policy'].includes(tool)?'pro':'flash_lite';
}
export function capTeamLedger(ledger,{capMicros=250000,maxCalls=18,model}={}){
  return {...ledger,async reserve(metadata){
    const s=ledger.snapshot(),rows=s.entries.filter(e=>e.runId===s.runId),reservation=ledger.profile==='pro'?150000:30000;
    if(s.runChargedMicros+reservation>capMicros||rows.length>=maxCalls)throw Error('TEAM_MODEL_BUDGET_EXHAUSTED');
    return ledger.reserve(model?{...metadata,model}:metadata);
  }};
}

export async function initializeTeamVertex(config,path,{run=promisify(execFile),verify=verifySpendCap}={}){
  if(config.projectId!==PROJECT_ID)throw Error('INVALID_CLOUD_PROJECT');
  for(let attempt=0;attempt<2;attempt++)try{
    const auth=await run(config.pythonPath,['-B',resolve(ROOT,'scripts/vertex-token.py'),path],{timeout:30000,maxBuffer:16384});
    const token=auth.stdout.trim();if(token.length<20)throw Error('VERTEX_AUTH_UNAVAILABLE');
    return {token,cap:await verify(config,token),initializationRetries:attempt};
  }catch(error){
    // Only read-only initialization retries. Never print captured token stdout.
    const cancelled=error.name==='AbortError'||error.code==='ABORT_ERR'||error.signal==='SIGINT'||error.code==='ERR_CHILD_PROCESS_STDIO_MAXBUFFER';
    const network=!cancelled&&(['ECONNRESET','ECONNREFUSED','ETIMEDOUT','EAI_AGAIN','ENETUNREACH','ENOTFOUND'].includes(error.code||error.cause?.code)||error.name==='TimeoutError'||error.killed===true&&error.signal==='SIGTERM'&&error.code==null||/(_new_conn|NewConnectionError|NameResolutionError|ConnectTimeout|ReadTimeout)/.test(error.stderr||'')||/^SPEND_CAP_VERIFICATION_HTTP_(429|500|502|503|504)$/.test(error.message));
    if(attempt||!network){error.initializationAttempts=attempt+1;throw error;}
  }
}

// Per-call sessions share one run ID and the existing durable spend ledger.
// No cloud settings are changed. Profile-specific reservations retain their
// original prices; the same250000-microdollar envelope covers both models.
export async function openTeamVertex(id,{route='lite',capMicros=250000,proEndpoint='standard'}={}){
  if(!Object.hasOwn(TEAM_MODEL_ROUTES,route)||![250000,300000].includes(capMicros)||!['standard','custom_tools'].includes(proEndpoint))throw Error('INVALID_TEAM_MODEL_CONFIG');
  const path=resolve(ROOT,'.local/gcp/config.json'),config=JSON.parse(await readFile(path,'utf8'));
  if(config.projectId!==PROJECT_ID)throw Error('INVALID_CLOUD_PROJECT');
  const {token,cap,initializationRetries}=await initializeTeamVertex(config,path),events=[];let lastAt=0,inFlight=false;
  return {cap,initializationRetries,client:{events,async json(system,packet,options){
    if(inFlight)throw Error('TEAM_PROVIDER_BUSY');inFlight=true;
    const profile=profileFor(route,options.functions?.[0]?.name),model=profile==='pro'?(proEndpoint==='custom_tools'?VERTEX_MODEL+'-customtools':VERTEX_MODEL):FLASH_LITE_PROFILE.model;let ledger,client;
    try{
      const delay=Math.max(0,lastAt+(profile==='pro'?12000:6000)-Date.now());if(delay)await new Promise(r=>setTimeout(r,delay));
      ledger=await openSpendLedger(resolve(ROOT,'.local/gcp/model-spend.json'),{runId:'market-'+id,profile});
      const fetchFn=proEndpoint==='custom_tools'&&profile==='pro'?(url,init)=>{
        const expected='https://aiplatform.googleapis.com/v1/projects/'+PROJECT_ID+'/locations/global/publishers/google/models/'+VERTEX_MODEL+':generateContent';
        if(url!==expected)throw Error('UNEXPECTED_MODEL_ENDPOINT');
        return fetch(expected.replace(VERTEX_MODEL+':',model+':'),init);
      }:fetch;
      client=createVertexClient({token,ledger:capTeamLedger(ledger,{capMicros,model}),profile,fetchFn,requestTimeoutMs:90000});
      lastAt=Date.now();
      // Match MEDIUM reasoning across both profiles. The frozen provider's Pro
      // planner stage selects MEDIUM; Flash-Lite exposes the same setting.
      const result=await client.json(system,packet,{...options,stage:'planner',...(profile==='flash_lite'?{thinkingLevel:'MEDIUM'}:{})});
      const actual=client.events.at(-1)?.modelVersion,expected=profile==='pro'?VERTEX_MODEL:FLASH_LITE_PROFILE.model;
      if(actual&&!actual.startsWith(expected))throw Error('UNEXPECTED_TEAM_MODEL_VERSION');
      return result;
    }finally{
      if(client)events.push(...client.events.map(e=>({...e,profile,configuredModel:model,proEndpoint:profile==='pro'?proEndpoint:null})));
      await ledger?.close();inFlight=false;
    }
  }},close:async()=>{if(inFlight)throw Error('TEAM_PROVIDER_STILL_RUNNING');}};
}
