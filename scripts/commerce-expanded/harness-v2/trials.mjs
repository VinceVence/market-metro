import {mkdir,writeFile,rename,readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {digest,read,assertBinding} from './tools.mjs';
export async function verifyEconomy(){const p=await read('docs/commerce-expanded/harness-v2/protocol.json');for(const [path,hash]of Object.entries(p.economyHashes))if(createHash('sha256').update(await readFile(path)).digest('hex')!==hash)throw Error('V2_FROZEN_ECONOMY_CHANGED:'+path);return p;}
export async function createTrialTool({root=resolve('.local/commerce-harness-v2/trials'),fixed,prior}={}){
 const protocol=await verifyEconomy();await mkdir(root,{recursive:true});
 async function evaluate(schedule,models){
  for(const c of schedule)assertBinding(c,models[c.modelHash]);
  const key=digest({cases:protocol.developmentCases,schedule,economyHashes:protocol.economyHashes,implementation:'v2.1'}),path=resolve(root,key+'.json');
  try{const cached=await read(path);if(cached.key!==key)throw Error('V2_TRIAL_CACHE_MISMATCH');return cached;}catch(e){if(e.code!=='ENOENT')throw e;}
  const input={key,cases:protocol.developmentCases,schedule,models,fixed,prior},inputPath=resolve(root,key+'-input.json'),outputPath=path+'.tmp';
  await writeFile(inputPath,JSON.stringify(input));
  await promisify(execFile)(process.execPath,[resolve('scripts/commerce-expanded/harness-v2/trial-worker.mjs'),inputPath,outputPath],{timeout:180000,maxBuffer:1000000});
  const result=await read(outputPath);if(result.key!==key||result.rows.length!==protocol.developmentCases.length)throw Error('V2_TRIAL_RESULT_MISMATCH');
  await verifyEconomy();await rename(outputPath,path);return result;
 }
 const fixedResult=await evaluate([],{});
 return {async evaluate(contract,model,prefix=[],models={}){
  const registry={...models,...(model?{[model.modelHash]:model}:{})},schedule=[...prefix,...(contract?[contract]:[])],result=await evaluate(schedule,registry),baseline=fixedResult.rows;
  for(let i=0;i<baseline.length;i++)for(const field of ['initialHash','opportunityHash','consentHash','incomeCents'])if(result.rows[i][field]!==baseline[i][field])throw Error('V2_UNMATCHED_TRIAL_INPUT');
  const mean=key=>result.rows.reduce((s,r)=>s+r[key],0)/result.rows.length,delta=key=>result.rows.reduce((s,r,i)=>s+r[key]-baseline[i][key],0)/result.rows.length;
  const measurement={platformUSD:mean('platformUSD'),retailerUSD:mean('retailerUSD'),retainedPurchases:mean('retainedPurchases'),platformDeltaUSD:delta('platformUSD'),retailerDeltaUSD:delta('retailerUSD'),purchaseDelta:delta('retainedPurchases'),unpaidLiabilities:result.rows.reduce((s,r)=>s+r.unpaidLiabilities,0)};
  return {contractHash:contract?.hash||prefix.at(-1)?.hash||'FIXED',modelHash:model?.modelHash||prefix.at(-1)?.modelHash||null,trialHash:result.key,measurement,cases:result.rows.map((r,i)=>({regime:r.regime,platformDeltaUSD:r.platformUSD-baseline[i].platformUSD,retailerDeltaUSD:r.retailerUSD-baseline[i].retailerUSD,purchaseDelta:r.retainedPurchases-baseline[i].retainedPurchases})),scope:protocol.developmentMarket,activeMarketFutureUsed:false};
 }};
}

export function publicationGate(candidate,model,trial,incumbentTrial){
 assertBinding(candidate,model);
 if(trial.contractHash!==candidate.hash||trial.modelHash!==model.modelHash||!trial.trialHash)throw Error('V2_UNTESTED_PUBLICATION');
 const m=trial.measurement,i=incumbentTrial.measurement;
 return {passed:!!(Number.isFinite(model.report.metrics.logLoss)&&model.report.metrics.logLoss<=model.report.coarse.logLoss&&m.platformDeltaUSD>0&&m.retailerDeltaUSD>=0&&m.purchaseDelta>=0&&m.platformUSD>i.platformUSD&&m.retailerUSD>=i.retailerUSD&&m.retainedPurchases>=i.retainedPurchases&&!m.unpaidLiabilities),checks:{modelBeatsCoarse:model.report.metrics.logLoss<=model.report.coarse.logLoss,positivePlatform:m.platformDeltaUSD>0,merchantProtected:m.retailerDeltaUSD>=0&&m.retailerUSD>=i.retailerUSD,purchasesProtected:m.purchaseDelta>=0&&m.retainedPurchases>=i.retainedPurchases,beatsIncumbent:m.platformUSD>i.platformUSD,settled:m.unpaidLiabilities===0},scope:'Small frozen development-market gate, not a guarantee for the live market.'};
}
