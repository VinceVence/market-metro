// Isolated local trial process; never receives an active confirmation world.
import {readFile,writeFile} from 'node:fs/promises';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {runCoordinatedCase as runOriginal} from '../../commerce-growth/team/runner.mjs';
import {runCoordinatedCase as runExpanded} from '../runner.mjs';
import {outreachPlan} from '../../commerce-growth/team/control.mjs';
import {openAllocator} from '../../commerce-deadlines/solver.mjs';
import {scoreCampaign,assertBinding} from './tools.mjs';
const input=isMainThread?JSON.parse(await readFile(process.argv[2],'utf8')):workerData;
 if(!['frozen-3x100','expanded-12x600'].includes(input.marketProfile))throw Error('V2_INVALID_TRIAL_MARKET');
 const runCoordinatedCase=input.marketProfile==='expanded-12x600'?runExpanded:runOriginal;
 for(const contract of input.schedule)assertBinding(contract,input.models[contract.modelHash]);
if(!isMainThread){
 const allocator=openAllocator();let result;
 try{
  const controller={async plan(view){const contract=input.schedule.filter(c=>c.activationDay<=view.day).at(-1);return contract?scoreCampaign(view,{contract,model:input.models[contract.modelHash],prior:input.prior}):{...outreachPlan(view,input.fixed.config,input.prior),configuration:input.fixed.config};}};
  result=await runCoordinatedCase(input.settings,{id:'v2-development',config:input.fixed.config},{allocator,prior:input.prior,controller});
 }finally{allocator.close();}
 parentPort.postMessage(result);
}else{
 const rows=[],workers=new Set();
 // Two local CPU workers, never model agents. Preserve case order and inputs.
 try{
  for(let i=0;i<input.cases.length;i+=2)rows.push(...await Promise.all(input.cases.slice(i,i+2).map(settings=>new Promise((resolve,reject)=>{
   const worker=new Worker(new URL(import.meta.url),{workerData:{...input,settings}});workers.add(worker);let result;
   worker.once('message',value=>{result=value;});worker.once('error',reject);worker.once('exit',code=>{workers.delete(worker);if(code||!result)reject(Error('V2_TRIAL_WORKER_FAILED:'+code));else resolve(result);});
  }))));
  await writeFile(process.argv[3],JSON.stringify({key:input.key,rows}));
 }finally{await Promise.allSettled([...workers].map(w=>w.terminate()));}
}
