import {createFreshWorld} from '../policy-lab/fresh-world.mjs';
import {compileCampaign} from './policies.mjs';
import {marketEvidence,recordStocks,inferredRegime} from './evidence.mjs';
import {sha} from '../research-lab/data.mjs';
import {rulesPlan} from '../policy-lab/service.mjs';

export const METHODS=['organic','static','riskStatic','contextual','riskContextual','original','llm','firstChoice'];
export function candidateCompilation(candidate,observer,pooled){
  const c=candidate.choice;
  if(c.recipeId!=='pooled_support')return compileCampaign(c,observer);
  if(![0,.02,.05].includes(c.penalty)||c.durationDays!==7||!c.merchantIndices.every(i=>[0,1,2].includes(i)))throw Error('INVALID_POOLED_CAMPAIGN');
  return {plan:{id:candidate.id,strategy:'recommendations',audience:'all',merchantIndices:c.merchantIndices,maxOfferPct:0,duration:c.durationDays,penalty:c.penalty,epsilon:0,windowDays:42},model:pooled.artifact,modelKind:'FITTED_LOCAL_MODEL'};
}
export function packetFor(market,priors,pooled,history){
  return {market,candidates:priors.candidates,developmentDisclosure:priors.disclosure,modelCard:{kind:pooled.artifact.type,trainingRows:pooled.rows,developmentMarkets:pooled.trainingSeeds.length,validationMSE:pooled.artifact.mse,constantMSE:pooled.artifact.baselineMse,limitation:'Better prediction error did not establish profitable intervention in the development precision audit.'},previousChoices:history.map(h=>({cutoff:h.cutoff,selected:h.decision?.candidateId||'observe',reason:h.decision?.reason||h.error})),authority:{currency:'USD',virtualCampaignBudgetCents:30000,nativePayments:false,maxReviewCount:3,publicationDelayDays:1},instruction:'Choose or revise a campaign from the observed market, not from user-language parsing. Candidate branches and future outcomes remain sealed.'};
}
export async function runControllers({id,seed,scenario,catalog,priors,pooled,choose,record,restore,includeLLM=true}){
  const args={seed,scenario,settings:{customerCount:100,days:100,budgetCents:30000},catalog,startedAt:'2026-10-25T00:00:00.000Z'};
  const observer=createFreshWorld({...args,id:'OBS-'+sha({seed,scenario}).slice(0,12)}),stocks=[];
  const methods=includeLLM?METHODS:METHODS.filter(m=>!['llm','firstChoice'].includes(m));
  const runners=Object.fromEntries(methods.map(m=>[m,createFreshWorld({...args,id:id+'-'+m})]));const reviews=[];let pending=null,firstChoice=null;
  while(observer.world.tick<114){
    const day=observer.world.tick;
    if([30,55,80].includes(day)){
      const market=marketEvidence(observer,stocks),packet=packetFor(market,priors,pooled,reviews),packetHash=sha(packet);
      let saved=restore?await restore(day):null,decision=null,error=null;
      if(saved){if(saved.packetHash!==packetHash)throw Error('REVIEW_INPUT_CHANGED');decision=saved.decision;error=saved.error;}
      else if(includeLLM){try{decision=await choose(packet,day);}catch(e){if(/SPEND|BUDGET|AUTH|UNKNOWN_PAID/.test(e.message))throw e;error=e.message;}}
      const selected=decision?.candidateId||'observe';firstChoice??=selected;
      const regime=inferredRegime(market),selections={organic:'observe',static:priors.rules.static,riskStatic:priors.rules.riskStatic,contextual:priors.rules.contextual[regime],riskContextual:priors.rules.riskContextual[regime],llm:selected,firstChoice};
      const compiled=Object.fromEntries(methods.filter(m=>m!=='original').map(m=>{const c=priors.candidates.find(c=>c.id===selections[m]);if(!c)throw Error('UNKNOWN_CANDIDATE');return [m,candidateCompilation(c,observer,pooled)];}));
      compiled.original={plan:{...rulesPlan(observer.evidence()),id:'unchanged_original_rules',duration:25,penalty:0},model:observer.fit(day,42)};
      const review={cutoff:day,publishedDay:day+1,packetHash,evidence:market,decision,error,selections,codeInferredRegime:regime};reviews.push(review);if(!saved&&record)await record(day,review);
      pending={day:day+1,cutoff:day,compiled};
    }
    if(pending&&day===pending.day){for(const m of methods){const x=pending.compiled[m];runners[m].publish(x.plan,x.model,pending.cutoff);}pending=null;}
    observer.step();recordStocks(observer,stocks);for(const r of Object.values(runners))r.step();
  }
  return {reviews,branches:methods.map(m=>({method:m,...runners[m].result(m)})),runners};
}
