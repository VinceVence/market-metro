import {mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {ROOT,frozenInputs,sha,readJSON,saveJSON,runPolicy} from '../research-lab/data.mjs';
import {session,chooseExperiments} from './agent.mjs';
import {interpretWithSources} from './source-router.mjs';
import {openWorkflow} from './tools.mjs';
import {clarify} from './contract.mjs';

const scenarios=['steady','rival_sale','budget_squeeze','supply_delay','returns_wave'];
const NONE={id:'observe',strategy:'observe',audience:'all',merchantIndices:[],maxOfferPct:0,duration:0,penalty:0,epsilon:0,windowDays:42};
// One local campaign at a time. A queue/worker service is unnecessary for this
// POC; the existing model ledger remains the shared external-spend guard.
export function createTrustedWorkflowService({root=ROOT,clientFactory}={}){
  const base=resolve(root,'.local/trusted-workflow/jobs');let running=null;
  const versionHash=async()=>sha(await Promise.all(['contract','tools','agent','source-router','service'].map(async n=>sha(await readFile(resolve(ROOT,'scripts/trusted-workflow/'+n+'.mjs'))))));
  const dir=id=>{if(!/^TW4-LIVE-[a-f0-9]{16}$/.test(id))throw Error('INVALID_TRUSTED_JOB_ID');return resolve(base,id);};
  async function get(id){const path=dir(id),meta=await readJSON(resolve(path,'job.json'));let checkpoint=null,result=null;try{checkpoint=await readJSON(resolve(path,'workflow/checkpoint.json'));}catch(e){if(e.code!=='ENOENT')throw e;}try{result=await readJSON(resolve(path,'result.json'));}catch(e){if(e.code!=='ENOENT')throw e;}return {...meta,checkpoint,result,activeHere:running===id};}
  async function execute(meta){
    const path=dir(meta.id),set=async(status,extra={})=>{Object.assign(meta,{status,...extra,updatedAt:new Date().toISOString()});await saveJSON(resolve(path,'job.json'),meta);};
    const s=await session({id:meta.id,directory:resolve(path,'requests'),...(clientFactory?{clientFactory}:{} )});
    try{
      await set('INTERPRETING');const {catalog}=await frozenInputs();let spec,interpretationError=null;
      try{spec=await interpretWithSources(s,meta.brief);}catch(e){if(!/^(UNGROUNDED|MISSING_|MERCHANT_SCOPE|UNSUPPORTED_|BUDGET_NOT_GROUNDED|DURATION_NOT_GROUNDED|DISCOUNT_NOT_GROUNDED|INACTIVITY_NOT_GROUNDED|SPEC_|DIAGNOSTIC_|CAMPAIGN_LIMITS|SOURCE_IDS|UNKNOWN_SOURCE_ID)/.test(e.message))throw e;interpretationError=e.message;spec=clarify('The request needs clarification: '+e.message);}
      const source=s.calls.find(c=>c.stage==='trusted_semantic_router');
      await set('VALIDATING_AND_TRAINING',{spec,interpretationError,sourceBinding:source?{sourceIds:source.response?.args?.sourceIds,units:source.packet?.sourceUnits}:null});const task={seed:meta.seed,scenario:meta.scenario};
      const w=await openWorkflow({directory:resolve(path,'workflow'),id:meta.id,task,spec,catalog}),packet=await w.prepare();let planReason=null;
      if(packet){await set('TESTING_CANDIDATES');let choices;if(meta.method==='adaptive'){const plan=await chooseExperiments(s,{...packet,brief:meta.brief});choices=plan.choices;planReason=plan.reason;}else choices=w.fixedChoices(packet);await w.finish(choices);}
      await set('EVALUATING');const policy=w.policy(),args={id:'LIVE-'+meta.seed,...task,catalog,budgetCents:spec.status==='ready'?spec.budgetCents:10000,cutoff:45};
      const control=runPolicy({...args,plan:NONE,artifact:null}),score=runPolicy({...args,plan:policy.plan,artifact:policy.artifact,includeTrace:true}),costUSD=s.calls.reduce((n,c)=>n+(c.provider?.modelCostMicros||0),0)/1e6;
      const result={id:meta.id,brief:meta.brief,method:meta.method,spec,interpretationError,planReason,decision:policy.decision,score,costUSD,requests:s.calls.length,deltaPlatformUSD:(score.platformProxyCents-control.platformProxyCents)/100-costUSD,deltaMerchantUSD:(score.merchantContributionCents-control.merchantContributionCents)/100,control:{purchases:control.purchases,platformProxyCents:control.platformProxyCents},disclosure:'Actual Gemini interpretation, tested local models and simulated paired outcomes. No native payment. No production ROI or interpretation accuracy score without an independent expected answer.'};
      await saveJSON(resolve(path,'result.json'),result);await set(spec.status==='clarify'?'NEEDS_CLARIFICATION':'COMPLETED',{costUSD,decision:policy.decision});
    }catch(e){await set('FAILED',{error:e.message});}finally{await s.close();running=null;}
  }
  async function kick(meta){if(running&&running!==meta.id)throw Error('TRUSTED_WORKFLOW_BUSY');if(running===meta.id)return;running=meta.id;void execute(meta).catch(()=>{running=null;});}
  return {get,
    async start(input){
      if(!input||Object.keys(input).some(k=>!['requestId','brief','seed','scenario','method'].includes(k))||typeof input.brief!=='string'||input.brief.trim().length<10||input.brief.length>2500||!Number.isSafeInteger(input.seed)||input.seed<1||input.seed>1000000||!scenarios.includes(input.scenario)||!['reader','adaptive'].includes(input.method))throw Error('INVALID_TRUSTED_MISSION');
      const requestId=input.requestId||randomUUID();if(!/^[a-zA-Z0-9-]{8,80}$/.test(requestId))throw Error('INVALID_REQUEST_ID');
      const id='TW4-LIVE-'+sha({requestId,brief:input.brief,seed:input.seed,scenario:input.scenario,method:input.method}).slice(0,16),path=dir(id);
      try{return await get(id);}catch(e){if(e.code!=='ENOENT')throw e;}
      if(running)throw Error('TRUSTED_WORKFLOW_BUSY');await mkdir(path,{recursive:true});
      const meta={id,requestId,brief:input.brief,seed:input.seed,scenario:input.scenario,method:input.method,executionVersion:await versionHash(),status:'QUEUED',modelBudgetUSD:.25,nativePayments:false,createdAt:new Date().toISOString()};await saveJSON(resolve(path,'job.json'),meta);await kick(meta);return get(id);
    },
    async resume(id){const meta=await readJSON(resolve(dir(id),'job.json'));if(['COMPLETED','NEEDS_CLARIFICATION'].includes(meta.status))return get(id);if(meta.executionVersion!==await versionHash())throw Error('WORKFLOW_VERSION_CHANGED');await kick(meta);return get(id);}
  };
}
