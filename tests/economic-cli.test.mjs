import test from 'node:test';import assert from 'node:assert/strict';import {mkdir,writeFile,readFile,rm} from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {randomUUID} from 'node:crypto';
const exec=promisify(execFile);
test('completed CLI replay makes no model call and rejects paths outside its run namespace',async()=>{
 const id='test-'+randomUUID(),root='docs/commerce-growth/economic-workflows/'+id,before=await readFile('.local/gcp/model-spend.json','utf8');await mkdir(root,{recursive:true});
 try{await writeFile(root+'/summary.json',JSON.stringify({status:'COMPLETED',modelCalls:1,modelCostUSD:0,testOnly:true}));const result=await exec(process.execPath,['scripts/commerce-growth/autonomy/run-economic-workflow.mjs','--run-llm','--run-id',id]);const summary=JSON.parse(result.stdout);assert.equal(summary.cachedReplay,true);assert.equal(summary.newModelCalls,0);assert.equal(await readFile('.local/gcp/model-spend.json','utf8'),before);
  await assert.rejects(exec(process.execPath,['scripts/commerce-growth/autonomy/run-economic-workflow.mjs','--run-llm','--run-id','../escape']),/INVALID_WORKFLOW_RUN_ID/);
 }finally{await rm(root,{recursive:true,force:true});}
});
