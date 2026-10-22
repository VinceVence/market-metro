import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {runBenchmark} from './orchestrator.mjs';

export class BenchmarkError extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code;}}
export function createBenchmarkService({storePath,manifestPath=new URL('./manifest.json',import.meta.url),runner=runBenchmark}={}){
  let active=null,activeInput=null,cached=null;
  return {
    status:()=>({mode:'SCRIPTED_BENCHMARK',llmEnabled:false,running:Boolean(active)}),
    async latest(){
      if(cached)return structuredClone(cached);
      if(!storePath)return null;
      try{
        const result=JSON.parse(await readFile(storePath,'utf8'));
        if(result.schema!=='supply-yard-benchmark-run-v1')throw new Error('Invalid schema');
        cached=result;return structuredClone(result);
      }catch(error){if(error.code==='ENOENT')return null;throw new BenchmarkError(500,'BENCHMARK_STORE_ERROR','The saved benchmark report cannot be read. Existing data was preserved.');}
    },
    async run(input={}){
      const key=JSON.stringify(input);
      if(active){if(key!==activeInput)throw new BenchmarkError(409,'BENCHMARK_BUSY','Another benchmark is running. Wait before changing settings.');return structuredClone(await active);}
      activeInput=key;
      active=(async()=>{
        let report;
        try{report=await runner(input);}catch(error){throw new BenchmarkError(400,'BENCHMARK_INPUT',error.message);}
        const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
        if(manifest.seed===report.suite.seed&&manifest.digest!==report.suite.digest)throw new BenchmarkError(409,'FIXTURE_CHANGED','Frozen fixture digest changed. Version and review the suite before running it.');
        report.freezeCheck=manifest.digest===report.suite.digest?'MATCHED_FROZEN_MANIFEST':'ALTERNATE_SEED_NOT_FROZEN';
        if(storePath){await mkdir(dirname(storePath),{recursive:true});await writeFile(storePath+'.tmp',JSON.stringify(report,null,2)+'\n',{mode:0o600});await rename(storePath+'.tmp',storePath);}
        cached=report;return report;
      })();
      try{return structuredClone(await active);}finally{active=null;activeInput=null;}
    }
  };
}
