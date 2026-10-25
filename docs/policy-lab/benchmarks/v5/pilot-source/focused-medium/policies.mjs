import {createFreshWorld,POLICY_OPTIONS} from '../policy-lab/fresh-world.mjs';
import {ACTIONS} from '../policy-lab/economy.mjs';
import {FIELDS} from '../research-lab/data.mjs';

// Policy-only targeting over the original seven OBSERVED features. These are
// explicit authored rules, not fitted models or changed shopper mechanics.
// The LLM may select a recipe; it cannot write coefficients or change rewards.
export const RECIPES=Object.freeze([
  {id:'observe',description:'No marketing outreach.',coef:null},
  {id:'premium',description:'Recommend products priced above $80.',coef:[-.8,0,0,0,1,0,0]},
  {id:'premium_known_store',description:'Prioritize high-value products at a previously purchased store.',coef:[-.9,0,0,0,1,.2,0]},
  {id:'premium_alternative',description:'High-value discovery at a different store from the last purchase.',coef:[-.8,0,0,0,1,-.2,0]},
  {id:'active_premium',description:'High-value discovery weighted by recent buying frequency.',coef:[-1.05,0,1,0,1,0,0]},
  {id:'active_return_guard',description:'Recent buyers and higher-value products, penalizing observed returns.',coef:[-1.05,0,1,0,1,0,-1]},
  {id:'recent_value',description:'Higher-value discovery with a recent-purchase preference.',coef:[-.8,-.5,.5,0,1,0,0]},
  {id:'engaged',description:'Recommend to customers with recent purchasing activity.',coef:[-.25,0,1,0,0,0,0]},
  {id:'ridge_28',description:'Original ridge learner, mature 28-day window and conservative scoring.',windowDays:28,penalty:.6},
  {id:'ridge_42',description:'Original ridge learner, mature 42-day window and conservative scoring.',windowDays:42,penalty:.6},
  {id:'ridge_56',description:'Original ridge learner, mature 56-day window and conservative scoring.',windowDays:56,penalty:.6}
]);
export const MERCHANT_SETS=Object.freeze([[0,1,2],[0,2],[1,2],[0],[1],[2]]);
export function artifactForRecipe(recipe){
  if(!recipe.coef)return null;
  if(recipe.coef.length!==7||recipe.coef.some(x=>!Number.isFinite(x)))throw Error('INVALID_RULE_COEFFICIENTS');
  return {type:'authored_observable_targeting_rule',features:FIELDS,recipeId:recipe.id,arms:Object.fromEntries(ACTIONS.map(action=>[action,{count:0,coef:action==='none'?[0,0,0,0,0,0,0]:action.startsWith('recommend:')?[...recipe.coef]:[-100,0,0,0,0,0,0],inverse:Array.from({length:7},()=>Array(7).fill(0))}])),disclosure:'Authored score over the original observed features. It is not a trained or calibrated probability model.'};
}
export function compileCampaign(choice,runner){
  const keys=['recipeId','merchantIndices','durationDays'];
  if(!choice||keys.some(k=>!Object.hasOwn(choice,k))||Object.keys(choice).some(k=>!keys.includes(k)))throw Error('CAMPAIGN_FIELDS');
  const recipe=RECIPES.find(r=>r.id===choice.recipeId);if(!recipe||!Array.isArray(choice.merchantIndices)||new Set(choice.merchantIndices).size!==choice.merchantIndices.length||choice.merchantIndices.some(i=>![0,1,2].includes(i))||![3,7,14].includes(choice.durationDays)||recipe.id!=='observe'&&!choice.merchantIndices.length)throw Error('CAMPAIGN_CONSTRAINTS');
  const plan={id:recipe.id,strategy:recipe.id==='observe'?'observe':'recommendations',audience:'all',merchantIndices:recipe.id==='observe'?[]:choice.merchantIndices,maxOfferPct:0,duration:choice.durationDays,penalty:recipe.penalty||0,epsilon:0,windowDays:recipe.windowDays||42};
  const model=recipe.windowDays?runner.fit(runner.world.tick,recipe.windowDays):artifactForRecipe(recipe);
  return {plan,model,modelKind:recipe.windowDays?'FITTED_LOCAL_RIDGE':recipe.coef?'AUTHORED_TARGETING_RULE':'NONE'};
}
export function runCandidate({id,seed,scenario,catalog,choice,chooseAtReview,publicationDelay=1}){
  const runner=createFreshWorld({id,seed,scenario,catalog,settings:{customerCount:100,days:100,budgetCents:30000},startedAt:'2026-10-25T00:00:00.000Z'});const reviews=[];let pending=null;
  while(runner.world.tick<114){
    if([30,55,80].includes(runner.world.tick)){
      const selected=chooseAtReview?chooseAtReview(runner.evidence(),reviews):choice,compiled=compileCampaign(selected,runner);pending={compiled,publishAt:runner.world.tick+publicationDelay,cutoff:runner.world.tick};reviews.push({cutoff:runner.world.tick,choice:selected,modelKind:compiled.modelKind});
    }
    if(pending&&runner.world.tick===pending.publishAt){runner.publish(pending.compiled.plan,pending.compiled.model,pending.cutoff);pending=null;}
    runner.step();
  }
  return {...runner.result(choice?.recipeId||'adaptive'),reviews};
}
