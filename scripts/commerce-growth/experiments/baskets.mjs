// Controller-side planning only: choose a complete approved basket before
// committing cash to its missing items. No changes to demand or payment rules.
import {enumerateBaskets} from '../../commerce-deadlines/policies.mjs';
import {procurementLimit} from '../../commerce-deadlines/suppliers.mjs';

export function planFundedBaskets(view,{cashFraction=.5}={}){
 const lead=view.paymentRules.physicalLeadMaxDays,planned={},committed={},
  cash=Object.fromEntries(view.merchants.map(m=>[m.id,Math.floor(m.cashCents*cashFraction)])),
  initialCash={...cash},picks=[],decisions=[];
 const requests=view.requests.filter(r=>r.status==='AUTHORIZED'&&r.deadlineDay>=view.day+2)
  .sort((a,b)=>a.deadlineDay-b.deadlineDay||a.createdDay-b.createdDay||a.id.localeCompare(b.id));
 for(const request of requests){
  const latest=request.deadlineDay-2,available={},limits={},inbound=[...view.inbound,
   ...Object.entries(planned).map(([productId,quantity])=>({productId,quantity,latestArrivalDay:view.day+lead}))];
  const augmented={...view,inbound};
  const products=view.products.map(p=>{
   available[p.id]=Math.max(0,p.available+inbound.filter(i=>i.productId===p.id&&(i.confirmedArrivalDay??i.latestArrivalDay)<=latest).reduce((s,i)=>s+i.quantity,0)-(committed[p.id]||0));
   limits[p.id]=latest<view.day+lead?0:Math.max(0,Math.min(20-(planned[p.id]||0),procurementLimit(augmented,p,lead),Math.floor(cash[p.merchantId]/p.costCents)));
   const stock=available[p.id]+limits[p.id];return {...p,stock,reserved:0,available:stock};
  });
  const virtual={...view,products},options=enumerateBaskets(virtual,request,{limit:48}).map(q=>{
   const needed={},costs={};for(const [id,n]of Object.entries(q.quantities)){
    const product=products.find(p=>p.id===id),quantity=Math.max(0,n-available[id]);
    needed[id]=quantity;costs[product.merchantId]=(costs[product.merchantId]||0)+quantity*product.costCents;
   }
   return {q,needed,costs,newCash:Object.values(costs).reduce((s,n)=>s+n,0)};
  }).filter(o=>Object.entries(o.needed).every(([id,n])=>n<=limits[id])&&Object.entries(o.costs).every(([id,n])=>n<=cash[id]));
  // First avoid new cash commitments for usable stock. Then prefer retained
  // retail value among the complete, funded alternatives. This is a local
  // numerical heuristic, not a claim that an LLM chose these orders.
  options.sort((a,b)=>a.newCash-b.newCash||b.q.expectedPlatformCents-a.q.expectedPlatformCents||b.q.preferred-a.q.preferred);
  const chosen=options[0];if(!chosen){decisions.push({requestId:request.id,status:'NO_COMPLETE_FUNDED_PLAN'});continue;}
  for(const [id,n]of Object.entries(chosen.q.quantities)){committed[id]=(committed[id]||0)+n;planned[id]=(planned[id]||0)+chosen.needed[id];}
  for(const [id,cost]of Object.entries(chosen.costs))cash[id]-=cost;
  for(const item of chosen.q.items)picks.push({requestId:request.id,productId:item.productId,quantity:item.quantity,deadline:request.deadlineDay});
  decisions.push({requestId:request.id,status:'COMPLETE_FUNDED_PLAN',deadline:request.deadlineDay,newCashCents:chosen.newCash,grossCents:chosen.q.gross,items:chosen.q.items});
 }
 const orders=[];for(const merchant of view.merchants){const items=Object.entries(planned).filter(([id,n])=>n>0&&view.products.find(p=>p.id===id).merchantId===merchant.id).map(([productId,quantity])=>({productId,quantity}));
  if(items.length)orders.push({merchantId:merchant.id,merchantRail:'paypal',supplierRail:'paypal',items});}
 return {orders,picks,decisions,remainingBudgets:cash,spentCents:Object.fromEntries(Object.keys(cash).map(id=>[id,initialCash[id]-cash[id]]))};
}
