import {mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {observedWorld,fitCandidate,runPolicy,FIELDS,sha,saveJSON,readJSON} from '../research-lab/data.mjs';
import {pairedEstimate} from '../policy-lab/benchmark-stats.mjs';
import {validateSpec,REQUIRED,ANALYSES} from './contract.mjs';

const NONE={id:'observe',strategy:'observe',audience:'all',merchantIndices:[],maxOfferPct:0,duration:0,penalty:0,epsilon:0,windowDays:42};
export const RECIPES=Object.freeze({
  full:{family:'ridge',features:FIELDS.slice(1),windowDays:42},
  recent:{family:'ridge',features:['recency_30d','purchases_7d','price_scale','observed_merchant_affinity'],windowDays:28},
  affinity:{family:'ridge',features:['observed_merchant_affinity','price_scale','recent_refunds'],windowDays:42},
  mean:{family:'mean',features:[],windowDays:42}
});
const round=n=>Math.round(n*1e6)/1e6;

// These aggregations operate at a declared grain. Agents cannot supply joins,
// SQL, row predicates, field names, denominators or money conversions.
export function analyze(context,kind,{merchantIndices,inactiveDays=7,windowDays=28}={}){
  if(!ANALYSES.includes(kind)||![7,14,28].includes(windowDays)||inactiveDays!==7||!Array.isArray(merchantIndices)||merchantIndices.some(i=>![0,1,2].includes(i)))throw Error('INVALID_ANALYSIS_CONTRACT');
  const cutoff=context.world.tick,merchantIds=new Set(merchantIndices.map(i=>context.world.merchants[i].merchant_id));
  const actions=context.actions.filter(a=>a.day<cutoff),mature=actions.filter(a=>a.matures_day<=cutoff&&a.reward_cents!==null);
  const provenance={snapshotCutoffExclusive:cutoff,windowStartInclusive:Math.max(0,cutoff-windowDays),source:'FROZEN_SIMULATED_OBSERVATIONS',catalog:'CACHED_CHANNEL3',analysisVersion:'trusted-v4.1',causal:false};
  const actionByOrder=new Map(actions.filter(a=>a.order_id).map(a=>[a.order_id,a]));
  if(actionByOrder.size!==actions.filter(a=>a.order_id).length)throw Error('ORDER_ACTION_GRAIN_VIOLATION');
  if(kind==='reactivation_cohort'){
    const purchaseByCustomer=new Map();for(const a of actions)if(a.order_id){const old=purchaseByCustomer.get(a.customer_id);if(!old||old.day<a.day)purchaseByCustomer.set(a.customer_id,a);}
    const ids=context.world.customers.filter(c=>purchaseByCustomer.has(c.customer_id)&&cutoff-purchaseByCustomer.get(c.customer_id).day>=7).map(c=>c.customer_id).sort();
    return {kind,provenance,grain:'one customer at snapshot',unit:'customers',n:ids.length,denominator:context.world.customers.length,inactiveDays:7,hasPreviousPurchase:true,cohortIds:ids,definition:'At least one observed purchase; snapshot cutoff minus latest observed purchase day is at least 7. Cohort uses purchase history across the district; merchant scope constrains later outreach.'};
  }
  if(kind==='model_readiness')return {kind,provenance,grain:'one customer-day action',unit:'rows',observedRows:actions.length,matureRows:mature.length,immatureRows:actions.length-mature.length,trainingAllowed:mature.length>=500,checks:{uniqueActionIds:new Set(actions.map(a=>a.action_id)).size===actions.length,noFutureRows:actions.every(a=>a.day<cutoff)},featureIds:FIELDS.slice(1)};
  const rows=merchantIndices.map(i=>{
    const id=context.world.merchants[i].merchant_id;
    const source=[...context.orders.values()].filter(o=>o.merchant_id===id&&actionByOrder.get(o.order_id)?.day>=cutoff-windowDays);
    if(kind==='merchant_sales')return {merchantIndex:i,orders:source.length,retainedObservedCents:source.reduce((n,o)=>n+o.total_cents-o.refund,0),observedRefundCents:source.reduce((n,o)=>n+o.refund,0)};
    const ms=source.filter(o=>{const a=actionByOrder.get(o.order_id);return a.matures_day<=cutoff&&a.reward_cents!==null;});
    return {merchantIndex:i,matureOrders:ms.length,immatureOrders:source.length-ms.length,returnedMatureOrders:ms.filter(o=>o.refund>0).length,returnRate:ms.length?round(ms.filter(o=>o.refund>0).length/ms.length):null,maturePlatformContributionCents:ms.reduce((n,o)=>n+actionByOrder.get(o.order_id).reward_cents,0)};
  });
  return {kind,provenance,grain:'one order aggregated by merchant',unit:kind==='merchant_sales'?'USD_CENTS':'USD_CENTS_AND_ORDER_RATE',rows,warning:kind==='merchant_sales'?'Recent refunds are incomplete. Retained volume is not platform profit.':'Numerator and denominator both contain mature orders only. Order-linked contribution excludes no-purchase outreach costs; it is not the full platform total.',includedMerchants:[...merchantIds].length};
}

export function planFromChoice(choice,spec){
  const keys=['model','style','durationDays','merchantIndices','penaltyUSD'];
  if(!choice||keys.some(k=>!Object.hasOwn(choice,k))||Object.keys(choice).some(k=>!keys.includes(k))||!RECIPES[choice.model]||!['recommendations','coupon'].includes(choice.style)||!Array.isArray(choice.merchantIndices)||!choice.merchantIndices.length||new Set(choice.merchantIndices).size!==choice.merchantIndices.length||choice.merchantIndices.some(i=>!spec.merchantIndices.includes(i))||!Number.isInteger(choice.durationDays)||choice.durationDays<1||choice.durationDays>spec.durationDays||![.12,.3,.6].includes(choice.penaltyUSD)||choice.style==='coupon'&&spec.maxCouponPct<5)throw Error('INVALID_EXPERIMENT_CHOICE');
  return {id:'PLAN-'+sha(choice).slice(0,12),strategy:choice.style==='coupon'?'mixed':'recommendations',audience:spec.goal==='reactivate_buyers'?'lapsed':'all',merchantIndices:choice.merchantIndices,maxOfferPct:choice.style==='coupon'?5:0,duration:choice.durationDays,penalty:choice.penaltyUSD,epsilon:0,windowDays:RECIPES[choice.model].windowDays};
}

export async function openWorkflow({directory,id,task,spec,catalog,failAfterNode=null}){
  spec=validateSpec(spec);await mkdir(directory,{recursive:true});const file=resolve(directory,'checkpoint.json'),binding=sha({id,seed:task.seed,scenario:task.scenario,spec,catalog});
  let state;try{state=await readJSON(file);if(state.binding!==binding)throw Error('CHECKPOINT_BINDING_CHANGED');}catch(e){if(e.code!=='ENOENT')throw e;state={id,version:1,binding,spec,nodes:[],completed:false,effects:{training:0,pilots:0,publish:0}};}
  const context=observedWorld({id:'WORLD-'+task.seed,seed:task.seed,scenario:task.scenario,catalog,budgetCents:10000,cutoff:45});
  const snapshotHash=sha({actions:context.actions,orders:[...context.orders],cutoff:45});
  if(state.snapshotHash&&state.snapshotHash!==snapshotHash)throw Error('SNAPSHOT_CHANGED');state.snapshotHash=snapshotHash;
  async function node(name,input,work){
    const inputHash=sha(input),old=state.nodes.find(n=>n.name===name);
    if(old){if(old.inputHash!==inputHash)throw Error('NODE_INPUT_CHANGED');if(old.status==='COMPLETED')return structuredClone(old.output);}
    const entry=old||{name,inputHash,input,status:'RUNNING',startedAt:new Date().toISOString()};if(!old)state.nodes.push(entry);await saveJSON(file,state);
    try{entry.output=await work();entry.status='COMPLETED';entry.finishedAt=new Date().toISOString();await saveJSON(file,state);}catch(e){entry.status='FAILED';entry.error=e.message;await saveJSON(file,state);throw e;}
    if(failAfterNode===name)throw Error('INJECTED_AFTER_DURABLE_CHECKPOINT');return structuredClone(entry.output);
  }
  async function prepare(){
    await node('interpretation_bound',{spec},async()=>({spec,validation:'TYPED_AUTHORITY_PASSED',note:'Semantic correctness is graded independently, not compared with hidden expected answers here.'}));
    if(spec.status==='clarify'){await node('clarification_committed',{reason:spec.reason},async()=>({decision:'clarify',reason:spec.reason,plan:NONE}));state.completed=true;await saveJSON(file,state);return null;}
    await node('snapshot_bound',{snapshotHash,cutoff:45},async()=>({snapshotHash,cutoff:45,customers:100,merchants:3}));
    const evidence=await node('evidence_validated',{analyses:REQUIRED[spec.goal],scope:spec.merchantIndices},async()=>{
      const reports=REQUIRED[spec.goal].map(kind=>analyze(context,kind,{merchantIndices:spec.merchantIndices}));
      return {reports,validation:{uniqueGrains:true,explicitUnits:true,matureDenominators:true},note:'Static tested operations; no LLM-generated SQL.'};
    });
    if(['reduce_return_exposure','understand_market'].includes(spec.goal)){
      await node('diagnostic_committed',{goal:spec.goal},async()=>({decision:'report',plan:NONE,evidenceIds:REQUIRED[spec.goal],reason:'Diagnostic goal completed without outreach.'}));state.completed=true;await saveJSON(file,state);return null;
    }
    const models=await node('models_compared',{recipes:RECIPES,snapshotHash},async()=>{
      state.effects.training+=Object.keys(RECIPES).length;
      return Object.fromEntries(Object.entries(RECIPES).map(([key,recipe])=>[key,fitCandidate(context.actions,{...recipe,cutoffDay:45})]));
    });
    return {spec,evidence,models:Object.fromEntries(Object.entries(models).map(([key,m])=>[key,m.summary])),choices:{models:Object.keys(RECIPES),styles:spec.maxCouponPct>=5?['recommendations','coupon']:['recommendations'],penalties:[.12,.3,.6],maxDurationDays:spec.durationDays},snapshotHash};
  }
  function fixedChoices(packet){
    const best=Object.entries(packet.models).sort((a,b)=>a[1].mse-b[1].mse||a[0].localeCompare(b[0])).slice(0,2);
    return best.map(([model])=>({model,style:'recommendations',durationDays:Math.min(3,spec.durationDays),merchantIndices:spec.merchantIndices,penaltyUSD:.6}));
  }
  async function finish(choices){
    if(state.completed)return state;
    if(!Array.isArray(choices)||choices.length!==2)throw Error('TWO_BOUNDED_EXPERIMENTS_REQUIRED');
    const plans=choices.map(c=>planFromChoice(c,spec));
    await node('experiment_spec_validated',{choices},async()=>({choices,plans,validation:'MATCHED_TWO_PILOT_LIMIT'}));
    const models=state.nodes.find(n=>n.name==='models_compared').output;
    const pilots=await node('development_pilots',{choices,plans},async()=>{
      state.effects.pilots+=2;
      return plans.map((plan,i)=>{
        const seeds=i===0?[81001,81002,81003]:[81011,81012,81013],replicas=seeds.map(seed=>{
          const args={id:'DEV-'+seed,seed,scenario:task.scenario,catalog,budgetCents:spec.budgetCents,cutoff:45};
          const no=runPolicy({...args,plan:NONE,artifact:null}),yes=runPolicy({...args,plan,artifact:models[choices[i].model].artifact});
          return {seed,deltaUSD:(yes.platformProxyCents-no.platformProxyCents)/100,merchantDeltaUSD:(yes.merchantContributionCents-no.merchantContributionCents)/100,spendCents:yes.jointBudgetSpentCents,valid:Object.values(yes.checks).every(n=>n===0)&&yes.jointBudgetSpentCents<=spec.budgetCents};
        });
        return {id:'PILOT-'+i,choice:choices[i],plan,estimate:{...pairedEstimate(replicas,'deltaUSD'),unit:'USD_PER_100_SHOPPER_MARKET'},replicas,valid:replicas.every(r=>r.valid)};
      });
    });
    const commit=await node('decision_committed',{pilotIds:pilots.map(p=>p.id)},async()=>{
      const best=pilots.filter(p=>p.valid&&p.estimate.mean>0&&p.replicas.reduce((n,r)=>n+r.merchantDeltaUSD,0)>=0).sort((a,b)=>b.estimate.mean-a.estimate.mean)[0];
      if(best)state.effects.publish++;
      return {decision:best?'bounded_probe':'observe',pilotId:best?.id||null,plan:best?.plan||NONE,model:best?.choice.model||null,reason:best?'Positive mean development value with budget and merchant checks; still an uncertain simulated probe.':'No tested candidate met the positive development-value and merchant checks.',authority:'SIMULATED_ONLY',effectId:best?'EFFECT-'+sha({id,binding,plan:best.plan}).slice(0,20):null};
    });
    state.completed=true;await saveJSON(file,state);return {state,commit};
  }
  function policy(){const n=state.nodes.find(n=>['decision_committed','diagnostic_committed','clarification_committed'].includes(n.name));const c=n?.output||{decision:'incomplete',plan:NONE};const models=state.nodes.find(n=>n.name==='models_compared')?.output;return {decision:c.decision,plan:c.plan,artifact:c.model?models[c.model].artifact:null,completed:state.completed};}
  return {state,prepare,finish,fixedChoices,policy,node,snapshotHash};
}
