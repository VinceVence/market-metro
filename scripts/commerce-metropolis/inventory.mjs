import {procurementLimit} from './suppliers.mjs';
export function demandForecast(view,model,cutoff=view.day){
 const window=model==='recent7'?7:model==='recent14'?14:28,prior=model==='legacy28'?7:1,first=Math.max(0,cutoff-window),counts={};
 for(const r of view.pastRequests)if(r.funded&&r.authorizedDay>=first&&r.authorizedDay<cutoff)for(const l of r.lines)counts[l.preferredCatalogId]=(counts[l.preferredCatalogId]||0)+l.quantity;
 return Object.fromEntries([...new Set(view.products.map(p=>p.catalogId))].map(id=>[id,((counts[id]||0)+.25)/(Math.max(1,cutoff-first)+prior)]));
}
export function fitForecast(view,requested){
 const scores={};for(const model of ['legacy28','recent7','recent14']){
  let loss=0,n=0;for(let day=Math.max(14,view.day-7);day<view.day;day++){
   const prediction=demandForecast(view,model,day),actual={};
   for(const r of view.pastRequests)if(r.funded&&r.authorizedDay===day)for(const l of r.lines)actual[l.preferredCatalogId]=(actual[l.preferredCatalogId]||0)+l.quantity;
   for(const [id,p]of Object.entries(prediction)){loss+=(p-(actual[id]||0))**2;n++;}
  }scores[model]=n?loss/n:0;
 }
 const selected=requested==='adaptive'?Object.keys(scores).sort((a,b)=>scores[a]-scores[b])[0]:requested;
 return {type:'Temporal-validation Poisson demand forecast',selected,cutoffDay:view.day,scores,rates:demandForecast(view,selected)};
}

export function restock(view,config,forecast){
 const catalog=new Map();for(const p of view.products)if(!catalog.has(p.catalogId))catalog.set(p.catalogId,p);
 const demand={},deadlines={};for(const r of view.requests.filter(r=>r.status==='AUTHORIZED')){
  if(r.deadlineDay<view.day+view.paymentRules.physicalLeadMaxDays+2)continue;
  const picks=r.lines.map(l=>({l,p:config.target==='preferred'?catalog.get(l.preferredCatalogId):l.acceptableCatalogIds.map(id=>catalog.get(id)).sort((a,b)=>a.priceCents-b.priceCents)[0]}));
  if(picks.reduce((s,x)=>s+x.p.priceCents*x.l.quantity,0)>r.authorizedCents)for(const x of picks)x.p=x.l.acceptableCatalogIds.map(id=>catalog.get(id)).sort((a,b)=>a.priceCents-b.priceCents)[0];
  for(const {l,p}of picks){demand[p.catalogId]=(demand[p.catalogId]||0)+l.quantity;deadlines[p.catalogId]=Math.min(deadlines[p.catalogId]??Infinity,r.deadlineDay);}
 }
 const funds=Object.fromEntries(view.merchants.map(m=>[m.id,m.cashCents])),orders=[];
 for(const id of [...catalog.keys()].sort((a,b)=>(deadlines[a]??Infinity)-(deadlines[b]??Infinity)||(demand[b]||0)-(demand[a]||0))){
  const physical=view.paymentRules.physicalLeadMaxDays;let merchantRail='paypal',supplierRail='paypal';
  if(config.routing==='auto'){merchantRail='bank';supplierRail='bank';if(view.day+physical+6>(deadlines[id]??Infinity)){supplierRail='paypal';if(view.day+physical+4>(deadlines[id]??Infinity))merchantRail='paypal';}}
  const lead=physical+Number(merchantRail==='bank')*2+Number(supplierRail==='bank')*2,products=view.products.filter(p=>p.catalogId===id).sort((a,b)=>a.costCents-b.costCents),incoming=view.inbound.filter(i=>products.some(p=>p.id===i.productId)).reduce((s,p)=>s+p.quantity,0),stock=products.reduce((s,p)=>s+p.available,0),buffer=view.day<view.marketDays?Math.ceil(forecast.rates[id]*Math.min(config.coverDays+lead,view.marketDays-view.day)):0;
  let wanted=Math.max(0,(demand[id]||0)+buffer-stock-incoming);
  for(const p of products){const quantity=Math.min(wanted,20,procurementLimit(view,p,lead),Math.floor(funds[p.merchantId]/p.costCents));if(quantity<=0)continue;orders.push({merchantId:p.merchantId,productId:p.id,quantity,merchantRail,supplierRail});funds[p.merchantId]-=quantity*p.costCents;wanted-=quantity;if(!wanted)break;}
 }
 const grouped=new Map();for(const p of orders){const key=[p.merchantId,p.merchantRail,p.supplierRail].join('|');if(!grouped.has(key))grouped.set(key,{merchantId:p.merchantId,merchantRail:p.merchantRail,supplierRail:p.supplierRail,items:[]});grouped.get(key).items.push({productId:p.productId,quantity:p.quantity});}
 return [...grouped.values()];
}
