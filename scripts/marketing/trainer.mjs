import {execFile} from 'node:child_process';
import {existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {FEATURES,predict} from './contract.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
export function localTrainerStatus(){
  const path=resolve(root,'.local/marketing-venv/bin/python');
  return {ready:existsSync(path),runtime:'Local Python / scikit-learn CPU',llmCalls:0,cloudCalls:0};
}
export async function trainLocal(store,world){
  const python=resolve(root,'.local/marketing-venv/bin/python');
  if(!existsSync(python))return {status:'UNAVAILABLE',reason:'Install the local marketing Python environment using the README setup commands.'};
  const columns=['day',...FEATURES,'offered_pct','purchased'];
  const rows=store.db.prepare('SELECT '+columns.join(',')+' FROM customer_days WHERE run_id=? AND day<? AND day>=? ORDER BY day,customer_id').all(world.runId,world.tick,Math.max(0,world.tick-28));
  if(rows.length>120000)throw new Error('Local training dataset exceeds its row limit.');
  const input={features:FEATURES,rows,cutoff:world.tick,seed:world.seed,champion:world.champion?.artifact||null};
  const started=performance.now();
  const result=await new Promise((accept,reject)=>{
    const process=execFile(python,[resolve(root,'scripts/marketing/train.py')],{
      cwd:root,timeout:60000,maxBuffer:4*1024*1024,
      env:{PATH:'/usr/bin:/bin',OPENBLAS_NUM_THREADS:'1',OMP_NUM_THREADS:'1',MKL_NUM_THREADS:'1',PYTHONNOUSERSITE:'1',PYTHONDONTWRITEBYTECODE:'1'}
    },(error,stdout,stderr)=>{if(error)return reject(new Error('Local training failed: '+stderr.slice(-1500)));try{accept(JSON.parse(stdout));}catch{reject(new Error('Local trainer returned invalid JSON.'));}});
    process.stdin.on('error',()=>{});process.stdin.end(JSON.stringify(input));
  });
  result.fit_runtime_ms=result.runtime_ms;result.runtime_ms=Math.round(performance.now()-started);
  for(const row of result.parity||[])if(Math.abs(predict(result.artifact,row.features,row.offer)-row.p)>1e-9)throw new Error('Portable model prediction failed Python/JavaScript parity.');
  delete result.parity;
  return result;
}
