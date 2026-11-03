import {outreachCandidates,proposeOutreach} from '../policies.mjs';
import {buildCandidates,greedyAllocate} from '../../commerce-deadlines/policies.mjs';
import {procurementLimit,placeProcurement} from '../../commerce-deadlines/suppliers.mjs';
import {observeGrowthWorld} from '../environment.mjs';
import {reserveBasket,captureReservation,assertDeadlineIntegrity} from '../kernel.mjs';
import {commerceTurn} from '../evaluate.mjs';

export const OPTIONS=Object.freeze({outreach:['legacy_stock','fresh_signal','calibrated','none'],maxAge:[2,4,7],contactsPerDay:[3,6,10],arrivalDays:[0,2,5],coldContacts:[0,1],forecast:['legacy28','recent7','recent14','adaptive'],coverDays:[0,3,7],allocation:['scarcity','joint'],target:['preferred','cheap'],routing:['fast','auto']});
export const DEFAULT=Object.freeze({outreach:'calibrated',maxAge:4,contactsPerDay:10,arrivalDays:5,coldContacts:0,forecast:'adaptive',coverDays:3,allocation:'joint',target:'cheap',routing:'fast'});
export function validateConfig(value){
 if(!value||Object.keys(value).sort().join()!==Object.keys(OPTIONS).sort().join()||Object.entries(OPTIONS).some(([k,choices])=>!choices.includes(value[k])))throw Error('INVALID_TEAM_CONTRACT');
 return {...value};
}
export const FIXED_CONTROLS=Object.freeze([
 {id:'fixed_original',config:{...DEFAULT,outreach:'legacy_stock',maxAge:7,arrivalDays:2,forecast:'legacy28',coverDays:3,allocation:'scarcity',target:'preferred'}},
 {id:'fixed_fresh_joint',config:{...DEFAULT,outreach:'fresh_signal',maxAge:2,arrivalDays:2,forecast:'recent7',coverDays:3}},
 {id:'fixed_cover_joint',config:{...DEFAULT,outreach:'fresh_signal',maxAge:7,arrivalDays:5,forecast:'recent14',coverDays:7}}
]);
export const NUMERICAL_CONTROL={id:'local_calibrated',config:{...DEFAULT}};

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

export function outreachPlan(view,raw,prior){
 const config=validateConfig(raw);
 if(config.outreach==='legacy_stock')return proposeOutreach(view,{mode:'stock'});
 if(config.outreach==='none'||view.day<30||view.day>=view.marketDays)return {actions:[],ranking:[]};
 const limit=Math.min(config.contactsPerDay*(view.scale?.contactMultiplier||1),view.outreach.rules.dailyContactLimit-view.outreach.contactsToday,Math.floor(Math.min(view.outreach.availablePlatformCashCents,view.outreach.remainingBudgetCents)/view.outreach.rules.outreachCostCents));
 if(limit<=0)return {actions:[],ranking:[]};
 const local={};for(const c of view.outreach.history)if(c.day+26<view.day){
  const order=view.pastOrders.find(o=>o.requestId===c.requestId),yes=!!order&&!['SETTLED','PENDING_FUNDS'].includes(order.refundStatus),parts=c.observedBucket.split('|'),key=c.kind+'|'+parts[2];
  local[key]??={n:0,k:0};local[key].n++;local[key].k+=Number(yes);
 }
 const candidates=outreachCandidates(view).filter(c=>c.hasSignal?c.age<=config.maxAge:c.kind==='ask_need'&&config.coldContacts>0).map(c=>{
  const person=view.audience.find(p=>p.customerId===c.customerId),inbound=person.signal?view.inbound.filter(i=>view.products.find(p=>p.id===i.productId)?.catalogId===person.signal.catalogId):[],soon=inbound.some(p=>(p.confirmedArrivalDay??p.latestArrivalDay)<=view.day+config.arrivalDays);
  const available=c.stock>0||soon;
  const group=c.kind+'|'+(c.age<=2?'fresh':c.age<=7?'recent':'cold'),global=prior?.groups[group]??{contacts:0,retained:0,grossCents:0},base=(global.retained+.5)/(global.contacts+2),online=local[group]??{n:0,k:0},probability=(base*8+online.k)/(8+online.n);
  // An old expensive purchase is not evidence of a new expensive need.
  const gross=c.hasSignal?c.expectedGross:(global.retained?global.grossCents/global.retained:4000);
  const expected=probability*(gross*.0229+29)*(available||!c.hasSignal?1:.45)-view.outreach.rules.outreachCostCents;
  return {...c,available,probability,score:config.outreach==='fresh_signal'?(c.expectedRetailNetCents*Math.exp(-c.age/3)+Number(c.search)*5):expected};
 }).filter(c=>config.outreach!=='fresh_signal'||c.kind==='recommend'&&c.available).filter(c=>config.outreach!=='calibrated'||c.score>0)
  .sort((a,b)=>b.score-a.score||a.customerId.localeCompare(b.customerId));
 const selected=[],seen=new Set();let cold=0;for(const c of candidates){if(seen.has(c.customerId)||!c.hasSignal&&cold>=config.coldContacts)continue;seen.add(c.customerId);cold+=Number(!c.hasSignal);selected.push(c);if(selected.length>=limit)break;}
 return {actions:selected.map(c=>({customerId:c.customerId,kind:c.kind,category:c.category,catalogId:c.catalogId})),ranking:selected.map(c=>({customerId:c.customerId,kind:c.kind,probability:c.probability,expectedScoreCents:c.score,signalAge:c.age})),
  model:{id:'POOLED-OBSERVED-RESPONSE',type:'Development-fitted prior with matured online updates',rows:prior?.rows??0,cutoffDay:view.day},
  reason:config.outreach==='calibrated'?'Use calibrated observed response rates; evaluate cold inquiries without assuming another expensive purchase.':'Prioritize recent specific shopping interest with available or incoming stock.'};
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

export async function fulfill(w,config,allocator,key){
 validateConfig(config);const copy=structuredClone(w);
 if(config.forecast==='legacy28'&&config.coverDays===3&&config.allocation==='scarcity'&&config.target==='preferred'&&config.routing==='fast'){
  const result=commerceTurn(copy,key);assertDeadlineIntegrity(copy);Object.assign(w,copy);return {...result,solver:null};
 }
 const view=observeGrowthWorld(copy),quotes=buildCandidates(view);let selected,solver=null;
 if(config.allocation==='joint'){solver=await allocator.solve(view,quotes);selected=solver.selected.map(i=>quotes[i]);}else selected=greedyAllocate(view,quotes,'scarcity');
 for(const q of selected){reserveBasket(copy,{requestId:q.requestId,items:q.items,key:key+':reserve:'+q.requestId});captureReservation(copy,{requestId:q.requestId,key:key+':capture:'+q.requestId});}
 const after=observeGrowthWorld(copy),forecast=fitForecast(after,config.forecast),orders=restock(after,config,forecast);
 for(const [i,order]of orders.entries())placeProcurement(copy,{...order,key:key+':stock:'+copy.day+':'+i});
 assertDeadlineIntegrity(copy);Object.assign(w,copy);
 return {captured:selected.length,candidates:quotes.length,stockUnits:orders.flatMap(o=>o.items).reduce((s,p)=>s+p.quantity,0),model:forecast,solver};
}
