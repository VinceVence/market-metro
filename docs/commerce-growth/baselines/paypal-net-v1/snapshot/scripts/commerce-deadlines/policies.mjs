// All planners consume the same public observation and shared basket generator.
// No seed, future refund outcomes or household balances are available here.
import {quoteBasket,RULES} from './environment.mjs';
import {procurementLimit} from './suppliers.mjs';

function uniqueUnion(groups,limit=48){const result=new Map();for(const group of groups)for(const row of group){const key=row.items.map(i=>i.lineId+':'+i.productId+':'+i.quantity).join('|');if(!result.has(key))result.set(key,row);}return [...result.values()].slice(0,limit);}
export function enumerateBaskets(view,request,{limit=24}={}){
 if(request.status!=='AUTHORIZED'||request.deadlineDay-view.day<2)return [];
 const budget=Math.min(request.budgetCents,request.authorizedCents),byId=new Map(view.products.map(p=>[p.id,p]));let beam=[{items:[],gross:0,cost:0,preferred:0,scarcity:0}];
 for(const line of request.lines){const pool=view.products.filter(p=>line.acceptableCatalogIds.includes(p.catalogId)&&p.available>=line.quantity);const next=[];
  for(const prior of beam)for(const p of pool){const used=prior.items.filter(i=>i.productId===p.id).reduce((s,i)=>s+i.quantity,0);if(used+line.quantity>p.available||prior.gross+p.priceCents*line.quantity>budget)continue;
   next.push({items:[...prior.items,{lineId:line.id,productId:p.id,quantity:line.quantity}],gross:prior.gross+p.priceCents*line.quantity,cost:prior.cost+p.costCents*line.quantity,preferred:prior.preferred+Number(p.catalogId===line.preferredCatalogId),scarcity:prior.scarcity+line.quantity/Math.max(1,p.available)});
  }
  beam=uniqueUnion([
   [...next].sort((a,b)=>a.gross-b.gross||a.cost-b.cost).slice(0,10),
   [...next].sort((a,b)=>(b.gross-b.cost)-(a.gross-a.cost)).slice(0,10),
   [...next].sort((a,b)=>b.preferred-a.preferred||a.gross-b.gross).slice(0,10),
   [...next].sort((a,b)=>a.scarcity-b.scarcity||b.gross-a.gross).slice(0,10)
  ]);if(!beam.length)return [];
 }
 const options=[];for(const proposal of beam){try{const quote=quoteBasket(view,request.id,proposal.items),quantities={};for(const item of quote.items)quantities[item.productId]=(quantities[item.productId]||0)+item.quantity;
  options.push({...proposal,quote,requestId:request.id,deadlineDay:request.deadlineDay,quantities,expectedPlatformCents:quote.feeCents*.965-quote.processingCents,retailerCents:quote.merchants.reduce((s,m)=>s+m.grossCents-m.feeCents-m.costCents-m.deliveryCents,0)});
 }catch(e){if(!['MERCHANT_MARGIN_FLOOR','CUSTOMER_BUDGET_EXCEEDED','CUSTOMER_FUNDED_LIMIT_EXCEEDED','INSUFFICIENT_STOCK'].includes(e.message))throw e;}}
 return uniqueUnion([
  [...options].sort((a,b)=>a.gross-b.gross||b.retailerCents-a.retailerCents).slice(0,6),
  [...options].sort((a,b)=>b.expectedPlatformCents-a.expectedPlatformCents).slice(0,6),
  [...options].sort((a,b)=>b.retailerCents-a.retailerCents).slice(0,6),
  [...options].sort((a,b)=>b.preferred-a.preferred||a.scarcity-b.scarcity).slice(0,6)
 ],limit);
}
export function buildCandidates(view){return view.requests.filter(r=>r.status==='AUTHORIZED'&&r.deadlineDay-view.day>=2).sort((a,b)=>a.deadlineDay-b.deadlineDay||a.createdDay-b.createdDay).slice(0,40).flatMap(r=>enumerateBaskets(view,r));}
export function greedyAllocate(view,quotes,mode='deadline'){
 const stock=Object.fromEntries(view.products.map(p=>[p.id,p.available])),demand={};for(const q of quotes)for(const id of Object.keys(q.quantities))demand[id]=(demand[id]||0)+1;
 const score=q=>q.expectedPlatformCents/Math.max(1,Object.entries(q.quantities).reduce((s,[id,qty])=>s+qty*Math.sqrt(demand[id]||1)/Math.max(1,stock[id]),0));
 const sorted=[...quotes].sort((a,b)=>mode==='deadline'?a.deadlineDay-b.deadlineDay||a.gross-b.gross||b.retailerCents-a.retailerCents:mode==='margin'?b.retailerCents-a.retailerCents:mode==='preference'?b.preferred-a.preferred||a.deadlineDay-b.deadlineDay||a.gross-b.gross:score(b)-score(a));
 const chosen=[],requests=new Set();for(const q of sorted){if(requests.has(q.requestId)||Object.entries(q.quantities).some(([id,n])=>stock[id]<n))continue;chosen.push(q);requests.add(q.requestId);for(const[id,n]of Object.entries(q.quantities))stock[id]-=n;}return chosen;
}
export function fitDemand(view){
 const first=Math.max(0,view.day-28),exposure=Math.max(1,view.day-first),counts={};
 for(const r of view.pastRequests)if(r.funded&&r.authorizedDay>=first&&r.authorizedDay<view.day)for(const l of r.lines)counts[l.preferredCatalogId]=(counts[l.preferredCatalogId]||0)+l.quantity;
 return {type:'Gamma-Poisson rolling28-day demand',cutoffDay:view.day,exposureDays:exposure,shapePrior:.25,ratePrior:7,byCatalog:Object.fromEntries([...new Set(view.products.map(p=>p.catalogId))].map(id=>[id,{count:counts[id]||0,meanPerDay:((counts[id]||0)+.25)/(exposure+7)}])),scope:'Fits observed funded request lines; no future demand, personal income or latent preferences.'};
}
export function restockPlan(view,{coverDays=7,routing='auto',target='preferred'}={}){
 const model=fitDemand(view),needs={},deadlines={},catalog=new Map();for(const p of view.products)if(!catalog.has(p.catalogId))catalog.set(p.catalogId,p);
 for(const r of view.requests.filter(r=>r.status==='AUTHORIZED')){
  const selected=r.lines.map(l=>{const preferred=catalog.get(l.preferredCatalogId),cheapest=l.acceptableCatalogIds.map(id=>catalog.get(id)).sort((a,b)=>a.priceCents-b.priceCents)[0];return {line:l,p:target==='cheap'?cheapest:preferred};});
  if(selected.reduce((s,x)=>s+x.p.priceCents*x.line.quantity,0)>r.authorizedCents)for(const x of selected)x.p=x.line.acceptableCatalogIds.map(id=>catalog.get(id)).sort((a,b)=>a.priceCents-b.priceCents)[0];
  if(r.deadlineDay<view.day+view.paymentRules.physicalLeadDays+2)continue;
  for(const {line,p}of selected){needs[p.catalogId]=(needs[p.catalogId]||0)+line.quantity;deadlines[p.catalogId]=Math.min(deadlines[p.catalogId]??Infinity,r.deadlineDay);}
 }
 const funds=Object.fromEntries(view.merchants.map(m=>[m.id,m.cashCents])),orders=[];
 const ids=[...catalog.keys()].sort((a,b)=>(deadlines[a]??Infinity)-(deadlines[b]??Infinity)||(needs[b]||0)-(needs[a]||0));
 for(const id of ids){const pendingDeadline=deadlines[id]??Infinity,physical=view.paymentRules.physicalLeadMaxDays;
  let merchantRail='bank',supplierRail='bank';if(routing==='fast'){merchantRail='paypal';supplierRail='paypal';}else if(view.day+physical+4+2>pendingDeadline){supplierRail='paypal';if(view.day+physical+2+2>pendingDeadline)merchantRail='paypal';}
  const lead=physical+(merchantRail==='bank'?2:0)+(supplierRail==='bank'?2:0),buffer=view.day<view.marketDays?Math.ceil(model.byCatalog[id].meanPerDay*Math.min(coverDays+lead,view.marketDays-view.day)):0,products=view.products.filter(p=>p.catalogId===id).sort((a,b)=>a.costCents-b.costCents),inbound=view.inbound.filter(p=>products.some(x=>x.id===p.productId)).reduce((s,p)=>s+p.quantity,0),stock=products.reduce((s,p)=>s+p.available,0);
  let wanted=Math.max(0,(needs[id]||0)+buffer-stock-inbound);
  for(const p of products){if(!wanted)break;const n=Math.min(wanted,20,procurementLimit(view,p,lead),Math.floor(funds[p.merchantId]/p.costCents));if(n<=0)continue;orders.push({merchantId:p.merchantId,productId:p.id,quantity:n,merchantRail,supplierRail});funds[p.merchantId]-=n*p.costCents;wanted-=n;}
 }
 const groups=new Map();for(const o of orders){const id=[o.merchantId,o.merchantRail,o.supplierRail].join('|');if(!groups.has(id))groups.set(id,{merchantId:o.merchantId,merchantRail:o.merchantRail,supplierRail:o.supplierRail,items:[]});groups.get(id).items.push({productId:o.productId,quantity:o.quantity});}
 return {orders:[...groups.values()],model};
}
