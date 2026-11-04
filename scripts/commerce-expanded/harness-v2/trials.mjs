import {mkdir,writeFile,rename,readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {read,assertBinding} from './tools.mjs';
import {VERSION,validate,contextSchema,canonicalHash,sealTrialReceipt,validateTrialReceipt,freeze} from './contracts.mjs';
export async function verifyEconomy(){const p=await read('docs/commerce-expanded/harness-v2/protocol.json');for(const [path,hash]of Object.entries(p.economyHashes))if(createHash('sha256').update(await readFile(path)).digest('hex')!==hash)throw Error('V2_FROZEN_ECONOMY_CHANGED:'+path);return p;}
export const DEVELOPMENT_CASES=Object.freeze([{seed:2026111101,regime:'discovery'},{seed:2026111102,regime:'low_response'},{seed:2026111103,regime:'zero_response'}].map(Object.freeze));
export async function createTrialTool({root=resolve('.local/commerce-harness-v2/trials'),fixed,prior,marketProfile}={}){
 if(!['expanded-12x600','frozen-3x100'].includes(marketProfile))throw Error('V2_TRIAL_MARKET_REQUIRED');
 const protocol=await verifyEconomy();protocol.developmentCases=DEVELOPMENT_CASES;await mkdir(root,{recursive:true});
 const sourcePaths=[...new Set([...Object.keys(protocol.economyHashes),...Object.keys(protocol.implementationHashes),'scripts/commerce-expanded/harness-v2/contracts.mjs'])];
 const sourceHashes=Object.fromEntries(await Promise.all(sourcePaths.map(async path=>[path,createHash('sha256').update(await readFile(path)).digest('hex')])));
 const evaluationContextHash=canonicalHash({version:VERSION,marketProfile,cases:protocol.developmentCases,sourceHashes,fixed,priorHash:canonicalHash(prior)});
 async function evaluate(schedule,models){
  for(const c of schedule){assertBinding(c,models[c.modelHash]);if(c.context.marketProfile!==marketProfile)throw Error('V2_TRIAL_MARKET_MISMATCH');}
  const key=canonicalHash({evaluationContextHash,schedule}),path=resolve(root,key+'.json');
  try{const cached=await read(path);if(cached.key!==key||cached.resultHash!==canonicalHash({key:cached.key,rows:cached.rows}))throw Error('V2_TRIAL_CACHE_MISMATCH');return cached;}catch(e){if(e.code!=='ENOENT')throw e;}
  const input={key,marketProfile,cases:protocol.developmentCases,schedule,models,fixed,prior},inputPath=resolve(root,key+'-input.json'),outputPath=path+'.tmp';
  await writeFile(inputPath,JSON.stringify(input));
  await promisify(execFile)(process.execPath,[resolve('scripts/commerce-expanded/harness-v2/trial-worker.mjs'),inputPath,outputPath],{timeout:240000,maxBuffer:1000000});
  const result=await read(outputPath);if(result.key!==key||result.rows.length!==protocol.developmentCases.length)throw Error('V2_TRIAL_RESULT_MISMATCH');
  result.resultHash=canonicalHash({key:result.key,rows:result.rows});await writeFile(outputPath,JSON.stringify(result));
  await verifyEconomy();await rename(outputPath,path);return result;
 }
 const fixedResult=await evaluate([],{});
 return {async evaluate(contract,model,prefix=[],models={},context){
  validate(context,contextSchema);if(context.marketProfile!==marketProfile||contract&&canonicalHash(contract.context)!==canonicalHash(context))throw Error('V2_TRIAL_CONTEXT_MISMATCH');
  const registry={...models,...(model?{[model.modelHash]:model}:{})},schedule=[...prefix,...(contract?[contract]:[])],result=await evaluate(schedule,registry),baseline=fixedResult.rows;
  for(let i=0;i<baseline.length;i++)for(const field of ['initialHash','opportunityHash','consentHash','incomeCents'])if(result.rows[i][field]!==baseline[i][field])throw Error('V2_UNMATCHED_TRIAL_INPUT');
  const mean=key=>result.rows.reduce((s,r)=>s+r[key],0)/result.rows.length,delta=key=>result.rows.reduce((s,r,i)=>s+r[key]-baseline[i][key],0)/result.rows.length;
  const baselineInventory=baseline.reduce((s,r)=>s+r.terminalInventoryUSD,0)/baseline.length;
  const measurement={platformUSD:mean('platformUSD'),retailerUSD:mean('retailerUSD'),retainedPurchases:mean('retainedPurchases'),platformDeltaUSD:delta('platformUSD'),retailerDeltaUSD:delta('retailerUSD'),purchaseDelta:delta('retainedPurchases'),unpaidLiabilities:result.rows.reduce((s,r)=>s+r.unpaidLiabilities,0),retainedVolumeUSD:mean('retainedVolumeUSD'),volumeDeltaUSD:delta('retainedVolumeUSD'),partnerCashDeltaUSD:delta('terminalCashUSD'),inventoryRatio:baselineInventory>0?mean('terminalInventoryUSD')/baselineInventory:mean('terminalInventoryUSD')===0?1:null,contactCount:mean('contactCount'),contactDelta:delta('contactCount'),outreachCostUSD:mean('outreachCostUSD'),outreachCostDeltaUSD:delta('outreachCostUSD')};
  return sealTrialReceipt({contractHash:contract?.hash||prefix.at(-1)?.hash||'FIXED',modelHash:model?.modelHash||prefix.at(-1)?.modelHash||null,trialHash:canonicalHash({key:result.key,resultHash:result.resultHash}),evaluationContextHash,reviewContextHash:canonicalHash(context),prefixHash:canonicalHash(prefix),measurement,cases:result.rows.map((r,i)=>({regime:r.regime,platformDeltaUSD:r.platformUSD-baseline[i].platformUSD,retailerDeltaUSD:r.retailerUSD-baseline[i].retailerUSD,purchaseDelta:r.retainedPurchases-baseline[i].retainedPurchases})),scope:'Frozen '+marketProfile+' development markets; matches the execution market size. No active-market future.',activeMarketFutureUsed:false,source:'LOCAL_TRUSTED_EVALUATOR'});
 }};
}

export function publicationGate(candidate,model,trial,incumbentTrial){
 assertBinding(candidate,model);validateTrialReceipt(trial);validateTrialReceipt(incumbentTrial);
 if(trial.evaluationContextHash!==incumbentTrial.evaluationContextHash||trial.reviewContextHash!==incumbentTrial.reviewContextHash||trial.prefixHash!==incumbentTrial.prefixHash||trial.reviewContextHash!==canonicalHash(candidate.context))throw Error('V2_PUBLICATION_CONTEXT_MISMATCH');
 if(trial.contractHash!==candidate.hash||trial.modelHash!==model.modelHash||!trial.trialHash)throw Error('V2_UNTESTED_PUBLICATION');
 const m=trial.measurement,i=incumbentTrial.measurement;
 for(const value of [model.report.metrics.logLoss,model.report.coarse.logLoss])validate(value,{type:'NUMBER',minimum:0});
 const checks={modelBeatsCoarse:model.report.metrics.logLoss<=model.report.coarse.logLoss,positivePlatform:m.platformDeltaUSD>0,merchantProtected:m.retailerDeltaUSD>=0&&m.retailerUSD>=i.retailerUSD,purchasesProtected:m.purchaseDelta>=0&&m.retainedPurchases>=i.retainedPurchases,volumeProtected:m.volumeDeltaUSD>=0&&m.retainedVolumeUSD>=i.retainedVolumeUSD,cashProtected:m.partnerCashDeltaUSD>=0&&m.partnerCashDeltaUSD>=i.partnerCashDeltaUSD,inventoryBounded:m.inventoryRatio!==null&&m.inventoryRatio<=1.1,beatsIncumbent:m.platformUSD>i.platformUSD,settled:m.unpaidLiabilities===0};
 return {passed:Object.values(checks).every(Boolean),checks,scope:'Matched-size development gate including a no-response stress case; not a guarantee of live profit.'};
}

// No LLM publish/retain command enters this function. Only measured candidates.
export function selectPublication(candidates,incumbentTrial,context){
 validate(context,contextSchema);validateTrialReceipt(incumbentTrial);
 if(incumbentTrial.reviewContextHash!==canonicalHash(context))throw Error('V2_STALE_REVIEW_CONTEXT');
 const reviewed=candidates.map(c=>{if(canonicalHash(c.contract.context)!==canonicalHash(context))throw Error('V2_STALE_CANDIDATE');return {...c,gate:publicationGate(c.contract,c.model,c.trial,incumbentTrial)};});
 const eligible=reviewed.filter(c=>c.gate.passed).sort((a,b)=>b.trial.measurement.platformUSD-a.trial.measurement.platformUSD||b.trial.measurement.retailerUSD-a.trial.measurement.retailerUSD||b.trial.measurement.retainedPurchases-a.trial.measurement.retainedPurchases||(a.contract.hash<b.contract.hash?-1:a.contract.hash>b.contract.hash?1:0));
 const selected=eligible[0]||null;return {selected,decision:freeze({authority:'DETERMINISTIC_CONTROLLER',version:VERSION,decision:selected?'publish':'keep',selectedContractHash:selected?.contract.hash||incumbentTrial.contractHash,reviewContextHash:canonicalHash(context),reason:selected?'Highest measured PayPal net among all eligible tested candidates; merchant and purchase guards passed.':'No tested candidate passed all guards; retain the incumbent.',candidates:reviewed.map(c=>({contractHash:c.contract.hash,trialHash:c.trial.trialHash,receiptHash:c.trial.receiptHash,gate:c.gate}))})};
}
