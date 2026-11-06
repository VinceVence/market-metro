import {createTrialTool as openProxy} from '../../commerce-expanded/harness-v2/trials.mjs';
import {compileCampaign as compileProxy} from '../../commerce-expanded/harness-v2/tools.mjs';
import {canonicalHash,contextSchema,validate,validateTrialReceipt,sealTrialReceipt,freeze,VERSION} from './contracts.mjs';
import {assertBinding} from './tools.mjs';

export async function createTrialTool({fixed,prior,marketProfile}){
 const proxy=await openProxy({fixed,prior,marketProfile:'expanded-12x600'});
 const proxyContext=context=>({...context,marketProfile:'expanded-12x600',snapshotHash:canonicalHash({purpose:'metropolis-policy-proxy',day:context.day})});
 const translate=(contract,model)=>compileProxy({...contract.campaign,contactsPer100:String(contract.campaign.contactsPer100),coverDays:String(contract.campaign.coverDays)},model,contract.configuration,proxyContext(contract.context));
 return {get recoveryEvents(){return proxy.recoveryEvents;},async evaluate(contract,model,prefix=[],models={},context){
  if(context.marketProfile!==marketProfile)throw Error('METROPOLIS_TRIAL_CONTEXT_MISMATCH');
  const translated=prefix.map(c=>translate(c,models[c.modelHash]));
  const result=await proxy.evaluate(contract?translate(contract,model):null,model,translated,models,proxyContext(context));
  const {receiptHash,...body}=result;
  return sealTrialReceipt({...body,contractHash:contract?.hash||prefix.at(-1)?.hash||'FIXED',
   evaluationContextHash:canonicalHash({proxy:body.evaluationContextHash,target:marketProfile}),
   reviewContextHash:canonicalHash(context),prefixHash:canonicalHash(prefix),
   scope:'Three 12-merchant/600-shopper proxy trials for '+marketProfile+'. Full-size net is measured after actual settlement; these trial amounts are not scaled up.'});
 }};
}

export function publicationGate(candidate,model,trial,incumbentTrial){
 assertBinding(candidate,model);validateTrialReceipt(trial);validateTrialReceipt(incumbentTrial);
 if(trial.evaluationContextHash!==incumbentTrial.evaluationContextHash||trial.reviewContextHash!==incumbentTrial.reviewContextHash||trial.prefixHash!==incumbentTrial.prefixHash||trial.reviewContextHash!==canonicalHash(candidate.context))throw Error('V2_PUBLICATION_CONTEXT_MISMATCH');
 if(trial.contractHash!==candidate.hash||trial.modelHash!==model.modelHash||!trial.trialHash)throw Error('V2_UNTESTED_PUBLICATION');
 const m=trial.measurement,i=incumbentTrial.measurement;
 for(const value of [model.report.metrics.logLoss,model.report.coarse.logLoss])validate(value,{type:'NUMBER',minimum:0});
 const checks={modelBeatsCoarse:model.report.metrics.logLoss<=model.report.coarse.logLoss,positivePlatform:m.platformDeltaUSD>0,merchantProtected:m.retailerDeltaUSD>=0&&m.retailerUSD>=i.retailerUSD,purchasesProtected:m.purchaseDelta>=0&&m.retainedPurchases>=i.retainedPurchases,volumeProtected:m.volumeDeltaUSD>=0&&m.retainedVolumeUSD>=i.retainedVolumeUSD,cashProtected:m.partnerCashDeltaUSD>=0&&m.partnerCashDeltaUSD>=i.partnerCashDeltaUSD,inventoryBounded:m.inventoryRatio!==null&&m.inventoryRatio<=1.1,stressCasesProtected:trial.cases.every(c=>c.platformDeltaUSD>=0&&c.retailerDeltaUSD>=0&&c.purchaseDelta>=0),beatsIncumbent:m.platformUSD>i.platformUSD,settled:m.unpaidLiabilities===0};
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
