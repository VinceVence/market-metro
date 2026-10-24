import {createHash} from 'node:crypto';
import {scoreOffers} from './economy.mjs';

export const ACTIONS=['KEEP_CURRENT','PAUSE_OFFERS','USE_RECENT_MODEL','OFFER_5','OFFER_10','ESCALATE'];
export const ACTION_CONTRACT={
  schema:'MARKETING_DECISION_V1',
  scope:'One named merchant, seven simulated days, profit objective. All other merchants keep their existing policy.',
  actions:{
    KEEP_CURRENT:'Continue the existing model or fixed-rule fallback.',
    PAUSE_OFFERS:'Issue no coupons; organic purchases remain possible.',
    USE_RECENT_MODEL:'Use the shared, locally fitted recent model only if it passed the common validation gate.',
    OFFER_5:'Propose 5% coupons to eligible customers, subject to all execution guards.',
    OFFER_10:'Propose 10% coupons to eligible customers, subject to all execution guards.',
    ESCALATE:'Keep the current policy and request human review; modeled handling cost is charged.'
  },
  guards:['frozen evidence hash','merchant and time scope','persistent holdout','seven-day contact gap','20% margin floor','stock availability','remaining shared campaign budget'],
  providerCalls:0,
  limits:'A decision review, not adaptive evidence gathering or an autonomous multi-agent system.'
};
export const digest=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
export function evidenceHash(packet){const {evidenceHash:_,...rest}=packet;return digest(rest);}

export function validateDecision(packet,d){
  const fields=['schema','caseId','evidenceHash','merchantId','action','evidenceIds','rationale'];
  if(!d||typeof d!=='object'||Array.isArray(d)||Object.keys(d).some(k=>!fields.includes(k)))throw new Error('INVALID_DECISION_FIELDS');
  if(d.schema!==ACTION_CONTRACT.schema||d.caseId!==packet.caseId||d.merchantId!==packet.merchantId)throw new Error('WRONG_DECISION_SCOPE');
  if(d.evidenceHash!==packet.evidenceHash||packet.evidenceHash!==evidenceHash(packet))throw new Error('STALE_OR_CHANGED_EVIDENCE');
  if(!ACTIONS.includes(d.action)||!packet.allowedActions.includes(d.action))throw new Error('ACTION_NOT_ALLOWED');
  if(!Array.isArray(d.evidenceIds)||!d.evidenceIds.length||d.evidenceIds.some(id=>!Object.hasOwn(packet.evidence,id)))throw new Error('INVALID_EVIDENCE_REFERENCE');
  if(typeof d.rationale!=='string'||d.rationale.trim().length<15||d.rationale.length>1500)throw new Error('RATIONALE_REQUIRED');
  return structuredClone(d);
}

// Shared by the forecast and the real executor. It only sees observed inputs.
export function proposeOffer(action,{features,product,offer,score,modelId},candidate,goal){
  if(action==='KEEP_CURRENT'||action==='ESCALATE')return {offer,score,modelId};
  if(action==='PAUSE_OFFERS')return {offer:0,score,modelId};
  if(action==='OFFER_5'||action==='OFFER_10')return {offer:action==='OFFER_5'?5:10,score,modelId};
  if(action==='USE_RECENT_MODEL'){
    if(candidate?.status!=='PROMOTED'||!candidate.artifact)throw new Error('UNVALIDATED_MODEL');
    const next=scoreOffers({champion:{artifact:candidate.artifact},goal},features,product);
    return {offer:next.offer,score:next,modelId:candidate.modelId};
  }
  throw new Error('ACTION_NOT_ALLOWED');
}

export function makeOfferPolicy(packet,decision,{world,candidate}){
  const d=validateDecision(packet,decision);
  if(world.runId!==packet.runId||world.tick!==packet.day||world.goal.objective!=='profit')throw new Error('STALE_WORLD');
  if(d.action==='USE_RECENT_MODEL'&&digest(candidate?.artifact)!==packet.evidence.models.candidateArtifactHash)throw new Error('WRONG_MODEL_ARTIFACT');
  return input=>{
    if(input.merchantId!==d.merchantId||input.day<packet.day||input.day>=packet.day+packet.horizonDays)return null;
    if(d.action==='KEEP_CURRENT'||d.action==='ESCALATE')return null;
    return {...proposeOffer(d.action,input,candidate,world.goal),reason:`Decision ${d.caseId}: ${d.action}`};
  };
}
