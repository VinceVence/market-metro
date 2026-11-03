import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyBaseline,verifyHashes} from '../scripts/commerce-growth/baseline.mjs';

test('approved baseline artifacts, published traces and current economy stay frozen',async()=>{
 const m=await verifyBaseline();assert.equal(m.selectedArm,'revised');assert.equal(m.regressionCases.length,14);assert.equal(Object.keys(m.economyHashes).length,12);assert.equal(m.decision.audience,'consented_positive_value');
});
test('freeze check rejects changed bytes and paths outside its root',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'baseline-check-'));try{
  const original='frozen',hash=createHash('sha256').update(original).digest('hex');await writeFile(join(dir,'economy.json'),original);await verifyHashes(dir,{'economy.json':hash},'CHANGED');
  await writeFile(join(dir,'economy.json'),'different');await assert.rejects(verifyHashes(dir,{'economy.json':hash},'CHANGED'),/CHANGED/);
  await assert.rejects(verifyHashes(dir,{'../outside':hash},'CHANGED'),/INVALID_BASELINE_PATH/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
