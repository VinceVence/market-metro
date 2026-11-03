import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
import {BASELINE_DIR,verifyBaseline} from '../baseline.mjs';
import {warmGrowthWorld} from '../evaluate.mjs';
import {beginGrowthDay,endGrowthDay,observeGrowthWorld,contactCustomer,assertGrowthIntegrity,digest} from '../environment.mjs';
import {runCoordinatedCase} from '../team/runner.mjs';
import {frozenResources} from './team-v2.mjs';
import {economicObservation,patchApplies,compileEconomicInventory,economicContactPlan} from './economic-tools.mjs';

export async function economicResources(){
 const r=await frozenResources(),root=resolve(BASELINE_DIR,'snapshot/scripts/commerce-growth'),controller=await import(pathToFileURL(resolve(root,'autonomy/net-revision-study.mjs'))),commerce=await import(pathToFileURL(resolve(root,'experiments/program.mjs')));
 return {...r,baselineController:controller.revisionController(r),executeCommerce:commerce.executeProgramCommerce};
}
export async function makeEconomicSnapshot(settings,resources,allocator,reviewDay=45){
 const world=warmGrowthWorld(settings);if(!Number.isInteger(reviewDay)||reviewDay<30||reviewDay>=100)throw Error('INVALID_REVIEW_DAY');
 while(world.day<reviewDay){beginGrowthDay(world);const proposal=resources.baselineController.plan(observeGrowthWorld(world));for(const [i,a]of proposal.actions.entries())contactCustomer(world,{...a,key:'gemini-net-revision:contact:'+world.day+':'+i});await resources.executeCommerce(world,resources.funded,resources.prior,allocator,'gemini-net-revision');endGrowthDay(world);}
 beginGrowthDay(world);assertGrowthIntegrity(world);return economicObservation(world);
}
export async function runEconomicPatch(settings,candidate,resources,allocator){
 const activeDays=[],decisions=[];let active=false,lastDay=null,program=resources.funded;
 const controller={plan(view){active=patchApplies(view,candidate);lastDay=view.day;if(active){activeDays.push(view.day);program=compileEconomicInventory(resources,candidate,view);}const proposal=active?economicContactPlan(view,resources,candidate):resources.baselineController.plan(view);if(view.day>=candidate.reviewDay&&view.day<=candidate.reviewDay+candidate.policy.duration_days)decisions.push({day:view.day,active,candidateId:candidate.id,snapshotId:digest(view),contacts:proposal.actions.length});return {...proposal,agentCheckpoint:candidate.id};}};
 const result=await runCoordinatedCase(settings,{id:'economic-patch',config:resources.fixed.config},{allocator,prior:resources.prior,controller,observationProjector:economicObservation,commerceExecutor:(w,_c,a,key)=>{if(lastDay!==w.day)throw Error('MISSING_DAILY_PLAN');return resources.executeCommerce(w,active?program:resources.funded,resources.prior,a,key);}});
 return {...result,activeDays,decisions,scope:'Temporary economic overlay; v1 executes before, outside conditions, and after expiry. Same fixed economy.'};
}
export async function compareEconomicHistory({targetSettings,historicalSettings,candidate,resources,allocator}){
 if(targetSettings.seed===historicalSettings.seed)throw Error('CURRENT_MARKET_CANNOT_BE_HISTORICAL_TRIAL');await verifyBaseline();
 const baseline=await resources.runBaseline(historicalSettings,resources,allocator),proposed=await runEconomicPatch(historicalSettings,candidate,resources,allocator);
 for(const k of ['initialHash','opportunityHash','consentHash','incomeCents'])if(proposed[k]!==baseline[k])throw Error('UNPAIRED_ECONOMIC_TRIAL');await verifyBaseline();
 const fields=['platformUSD','retailerUSD','terminalCashUSD','terminalInventoryUSD','retainedPurchases','retainedVolumeUSD','outreachCostUSD','unpaidLiabilities'],pick=r=>Object.fromEntries(fields.map(k=>[k,r[k]]));
 return {source:'DIFFERENT_COMPLETED_HISTORICAL_MARKET',candidateId:candidate.id,historicalMarket:'H1',economyUnchanged:true,activeDays:proposed.activeDays.length,activationDays:proposed.activeDays,baseline:pick(baseline),candidate:pick(proposed),delta:Object.fromEntries(fields.map(k=>[k,proposed[k]-baseline[k]])),scope:'One completed historical-market counterfactual. No current-market future was exposed, and this is not unseen confirmation or production PayPal profit.'};
}
