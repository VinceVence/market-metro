import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runBenchmark,attachHumanCostStudy} from '../benchmark/orchestrator.mjs';
import {createFixtureSuite,fixtureManifest} from '../benchmark/fixtures.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const options={},args=process.argv.slice(2);let out=resolve(root,'.local/benchmarks/latest.json'),freeze=false,humanLog=null,hourlyRateCents;
for(let i=0;i<args.length;i++){
  const flag=args[i];
  if(flag==='--freeze'){freeze=true;continue;}
  if(flag==='--help'){
    console.log('node scripts/benchmark.mjs [--split all|development|holdout] [--seed N] [--controllers fixed_workflow,gather_all,cost_aware_script] [--max-calls N] [--max-cost-micros N] [--repeats 1..3] [--out PATH] [--freeze] [--human-log PATH --hourly-rate-cents N]');process.exit(0);
  }
  const value=args[++i];if(value===undefined)throw new Error('Missing value for '+flag);
  if(flag==='--split')options.split=value;
  else if(flag==='--seed')options.seed=Number(value);
  else if(flag==='--controllers')options.controllers=value.split(',');
  else if(flag==='--repeats')options.repeats=Number(value);
  else if(flag==='--max-calls')options.limits={...options.limits,maxCalls:Number(value)};
  else if(flag==='--max-cost-micros')options.limits={...options.limits,maxCostMicros:Number(value)};
  else if(flag==='--out')out=resolve(value);
  else if(flag==='--human-log')humanLog=resolve(value);
  else if(flag==='--hourly-rate-cents')hourlyRateCents=Number(value);
  else throw new Error('Unknown flag '+flag);
}
const manifestPath=resolve(root,'benchmark/manifest.json');
if(freeze){
  const manifest=fixtureManifest(createFixtureSuite(options.seed??773));
  try{await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});}
  catch(error){
    if(error.code!=='EEXIST')throw error;
    const existing=JSON.parse(await readFile(manifestPath,'utf8'));
    if(existing.digest!==manifest.digest)throw new Error('A different fixture is already frozen. Preserve/version the existing manifest before changing the dataset.');
  }
  console.log('Fixture manifest frozen at '+manifestPath);process.exit(0);
}
let report=await runBenchmark(options);
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
if(manifest.seed===report.suite.seed&&manifest.digest!==report.suite.digest)throw new Error('Frozen fixture digest changed. Version and review the dataset before running it.');
report.freezeCheck=manifest.digest===report.suite.digest?'MATCHED_FROZEN_MANIFEST':'ALTERNATE_SEED_NOT_FROZEN';
if(humanLog)report=attachHumanCostStudy(report,JSON.parse(await readFile(humanLog,'utf8')),{hourlyRateCents});
await mkdir(dirname(out),{recursive:true});const temporary=out+'.tmp';
await writeFile(temporary,JSON.stringify(report,null,2)+'\n');await rename(temporary,out);
console.table(report.byController.map(r=>({controller:r.id,cases:r.trials,ready:r.correctReady,unsupported:r.unsupportedReady,escalations:r.correctEscalations,unnecessary:r.unnecessaryEscalations,toolCalls:r.toolCalls,assumedToolUSD:(r.assumedToolCostMicros/1e6).toFixed(2),totalHandling:Number.isSafeInteger(r.estimatedHandlingCostMicros)?(r.estimatedHandlingCostMicros/1e6).toFixed(2)+' estimated':'unknown'})));
console.log('Saved '+out+'\nLLM trials: 0. Tool costs are assumptions; human handling cost is unknown until measured.');
