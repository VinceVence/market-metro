// Import a recorded campaign through the existing day loop and warehouse.
// No fresh model call or native payment; recorded choices must reproduce money.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createMarketStore} from '../../market-store.mjs';
import {createAutonomyRoom} from '../../commerce-growth/autonomy/live.mjs';
import {canonicalHash} from './contracts.mjs';
import {verifyEconomy} from './trials.mjs';

const root=resolve(process.argv[2]||'docs/commerce-expanded/harness-v2/v23-20261104'),caseId=process.argv[3]||'case-1';
if(!/^case-[1-4]$/.test(caseId))throw Error('INVALID_REPLAY_CASE');
await verifyEconomy();
const read=async path=>JSON.parse(await readFile(path,'utf8')),run=resolve(root,basename(root)+'-'+caseId+'-team'),result=await read(run+'/result.json'),recorded=await read(run+'/checkpoints.json'),trace=JSON.parse(gunzipSync(await readFile(run+'/trace.json.gz')));
if(result.failed||recorded.failed||result.arm!=='team')throw Error('REPLAY_REQUIRES_COMPLETED_HEALTHY_TEAM');
const sourceHash=canonicalHash({result,recorded,trace}),choices=new Map(trace.decisions.map(d=>[d.day,d])),store=createMarketStore(resolve('.local/market-metro.sqlite'));
let day=-1;
const room=createAutonomyRoom({store,autoPump:false,market:{mirror(){throw Error('REPLAY_NATIVE_PAYMENT_FORBIDDEN');}},v2ControllerFactory:async()=>({
 async plan(view){day=view.day;const d=choices.get(day);if(!d)throw Error('REPLAY_DAY_MISSING');return {actions:structuredClone(d.contacts),configuration:structuredClone(d.configuration),ranking:structuredClone(d.ranking),model:structuredClone(d.model),reason:d.reason,agentCampaign:!!d.agentCheckpoint,agentCheckpoint:d.agentCheckpoint};},
 summary(){const checkpoints=recorded.checkpoints.filter(c=>c.day<=day),schedule=recorded.schedule.filter(c=>c.activationDay<=day);return {...recorded,checkpoints,schedule,pending:false,lastDay:day,activeContract:schedule.at(-1)||null,publications:recorded.publications.filter(p=>p.day<=day),modelCalls:checkpoints.reduce((s,c)=>s+(c.provider?.length||0),0),modelCostUSD:checkpoints.reduce((s,c)=>s+(c.provider||[]).reduce((n,e)=>n+(e.modelCostMicros??e.reservedMicros??0),0),0)/1e6,trainingJobs:checkpoints.filter(c=>c.actor==='LOCAL_TRAINING_TOOL').length,recordedReplay:{sourceHash,study:basename(root),caseId,originalModelCostUSD:result.modelCostUSD,newModelCostUSD:0}};},
 async close(){}
})});
try{
 let session=await room.start({requestId:'recorded-'+sourceHash,seed:result.seed,regime:result.regime,marketProfile:'expanded-12x600',harnessVersion:'v2',plannerMode:'team',sandbox:false});
 while(session.status==='RUNNING'){await room.step(session.id);session=room.snapshot(session.id);}
 if(session.status!=='COMPLETED')throw Error('REPLAY_FAILED:'+session.warning);
 const actual=session.comparison.team;
 for(const key of ['platformUSD','retailerUSD','retainedPurchases','retainedVolumeUSD','modelCostUSD','modelCalls','unpaidLiabilities'])if(Math.abs(actual[key]-result[key])>1e-7)throw Error('REPLAY_METRIC_MISMATCH:'+key);
 const proof={status:'VERIFIED',sessionId:session.id,runId:session.runId,sourceHash,newModelCalls:0,newModelCostUSD:0,nativePayments:0,originalModelCostUSD:result.modelCostUSD,days:session.liveDay,demoUrl:'/studio.html?session='+session.id,verifiedMetrics:actual,scope:'Recorded Gemini campaign re-executed through the unchanged economy and warehouse. Playback is not new AI inference.'};
 await writeFile(root+'/replay.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}finally{await room.close();store.close();}
