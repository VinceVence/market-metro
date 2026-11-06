import {loadScaleInputs} from '../commerce-expanded/harness-v2/merchant-scale.mjs';
import {compileCampaign,scoreCampaign} from '../commerce-expanded/harness-v2/tools.mjs';
import {canonicalHash,marketProfileFor} from '../commerce-expanded/harness-v2/contracts.mjs';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';

export async function savedPlanningEvidence(){
  const {contract,model}=await loadScaleInputs();
  const review=JSON.parse(gunzipSync(await readFile('docs/commerce-expanded/model-check/reactivation-fresh/judge-review.json.gz')));
  if(review.schedule.at(-1)?.hash!==contract.hash)throw Error('REFERENCE_PLAN_MISMATCH');
  return {source:'RECORDED_REFERENCE_REVIEW',seed:92111706,contractHash:contract.hash,
    modelId:model.id,checkpoints:review.checkpoints,costUSD:review.modelCostUSD};
}

// Apply an existing trained policy to a new world. No provider or fit is invoked.
export async function openSavedPolicy(){
  const {contract:source,model,prior}=await loadScaleInputs();
  const checkpoints=[];
  let contract=null,closed=false;
  const reference={seed:92111706,contractHash:source.hash,modelId:model.id,modelHash:model.modelHash,
    family:model.artifact.selected,fields:model.artifact.featureNames,rows:model.artifact.trainingRows};
  return {
    async plan(view){
      if(closed)throw Error('SAVED_POLICY_CLOSED');
      if(!contract){
        const terms={...source.campaign,contactsPer100:String(source.campaign.contactsPer100),coverDays:String(source.campaign.coverDays)};
        contract=compileCampaign(terms,model,source.configuration,{day:view.day,marketProfile:marketProfileFor(view),snapshotHash:canonicalHash(view)});
        checkpoints.push({role:'Policy executor',actor:'SAVED_POLICY',day:view.day,completedDay:view.day,status:'COMPLETED',
          input:{sourceSeed:reference.seed,sourceContractHash:source.hash,currentSnapshotHash:contract.context.snapshotHash},
          output:{title:'Recorded policy applied to this market',body:'The saved model now ranks these shoppers. Planning and training belong to the reference run.',
            modelId:model.id,featureNames:reference.fields,reference,effectiveDay:view.day,
            campaign:{audience:source.campaign.kind,contactsPerDay:source.campaign.contactsPer100}}});
      }
      return scoreCampaign(view,{contract,model,prior});
    },
    summary(){return {version:'saved-policy-1',recordedReplay:'Saved policy · new simulated market',reference,checkpoints,
      modelCostUSD:0,modelCalls:0,modelCapUSD:0,trainingJobs:0,pending:false,failed:false,calibrationUpdates:0,activeContract:contract};},
    async close(){closed=true;}
  };
}
