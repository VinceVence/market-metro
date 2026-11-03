// Extend the incumbent action pool without replacing its general inquiries or
// changing shopper behavior, money, budget, model artifacts or fulfillment.
import {workbenchPlan} from './team-workbench-tools.mjs';
import {recommendationPlan} from './economic-analysis.mjs';
import {runCoordinatedCase} from '../team/runner.mjs';
import {digest} from '../environment.mjs';

export const NET_LIFT_MODES=['preserve_audience','pooled'];
export function netLiftPlan(view,r,mode){
 if(!NET_LIFT_MODES.includes(mode))throw Error('INVALID_NET_LIFT_MODE');
 const base=r.baselineController.plan(view);let plan;
 if(mode==='pooled'){
  plan=workbenchPlan(view,{model:r.incumbent,campaign:{kind:'open_discovery',objective:'joint'},prior:r.prior,fundingPrior:r.fundingPrior,configuration:r.fixed.config,candidateMode:'multiple'});
 }else{
  const people=new Set(base.actions.filter(a=>a.kind==='recommend').map(a=>a.customerId));
  const scoped={...view,audience:view.audience.map(p=>({...p,marketingConsent:p.marketingConsent&&people.has(p.customerId)}))};
  const alternatives=recommendationPlan(scoped,r,{mode:'multiple_interests',segment:'all',category:'all'}),choices=new Map(alternatives.ranking.map((rank,i)=>[rank.customerId,{rank,action:alternatives.actions[i]}]));
  const actions=[],ranking=[];
  for(const [i,a]of base.actions.entries()){
   const b=base.ranking[i],next=choices.get(a.customerId),replace=a.kind==='recommend'&&next&&next.action.catalogId!==a.catalogId&&next.rank.expectedNetCents>b.expectedNetCents&&next.rank.expectedMerchantNetCents>=b.expectedMerchantNetCents;
   actions.push(replace?next.action:a);ranking.push(replace?next.rank:b);
  }
  plan={...base,actions,ranking};
 }
 const byCustomer=new Map(base.actions.map(a=>[a.customerId,a])),changed=plan.actions.filter(a=>{const b=byCustomer.get(a.customerId);return !b||b.kind!==a.kind||b.catalogId!==a.catalogId;});
 return {...plan,agentCheckpoint:digest({policy:'net-lift-1',mode}),reason:mode==='preserve_audience'?'Preserve incumbent audience, timing and every needs inquiry; substitute a previously observed product only when the same local model predicts higher PayPal value without lower retailer value.':'Rank all recent observed product interests alongside the incumbent needs inquiries, using the same learned joint-value model and contact budget.',netLift:{mode,baselineContacts:base.actions.length,changedContacts:changed.length,baselineInquiries:base.actions.filter(a=>a.kind==='ask_need').length,inquiries:plan.actions.filter(a=>a.kind==='ask_need').length}};
}
export async function runNetLift(settings,mode,r,allocator,{trace=false}={}){
 const diagnostics={changedContactDays:0,changedContacts:0,baselinePlannedInquiries:0,selectedInquiries:0},controller={plan(view){const p=netLiftPlan(view,r,mode);diagnostics.changedContacts+=p.netLift.changedContacts;diagnostics.changedContactDays+=Number(p.netLift.changedContacts>0);diagnostics.baselinePlannedInquiries+=p.netLift.baselineInquiries;diagnostics.selectedInquiries+=p.netLift.inquiries;return p;}};
 const result=await runCoordinatedCase(settings,{id:'net-lift-'+mode,config:r.fixed.config},{allocator,prior:r.prior,trace,controller,commerceExecutor:(w,_c,a,key)=>r.executeCommerce(w,r.funded,r.prior,a,key)});
 return {...result,diagnostics,scope:'Same existing trained models and funded-basket fulfillment. Only observed product candidate selection changes; no authored demand or economic-rule changes.'};
}
