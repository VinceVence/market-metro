// Bounded decision programs over observed fields. No eval, SQL, network access,
// hidden simulator state or money mutation is available to generated programs.
import {buildCandidates} from '../../commerce-deadlines/policies.mjs';
import {procurementLimit,placeProcurement} from '../../commerce-deadlines/suppliers.mjs';
import {observeGrowthWorld,digest} from '../environment.mjs';
import {reserveBasket,captureReservation,assertDeadlineIntegrity,observeDeadlineWorld} from '../kernel.mjs';
import {demandForecast} from '../team/control.mjs';
import {planFundedBaskets} from './baskets.mjs';

const FIELDS={contact:['age','search','signal_count','category_affinity','price_usd','stock','arrival_days','recency','prior_purchases','response_rate','local_response_rate','local_sample_count','expected_net_usd','is_recommendation'],
 basket:['platform_usd','retailer_usd','balanced_retailer_usd','gross_usd','cost_usd','preferred','deadline_days','scarcity'],
 inventory:['funded_units','stock','inbound','rate7','rate14','rate28','recent_interest','response_rate','unit_cost_usd','merchant_cash_usd','days_remaining']};
const ARITY={add:[2,4],mul:[2,4],sub:[2,2],div:[2,2],min:[2,4],max:[2,4],lt:[2,2],lte:[2,2],gt:[2,2],gte:[2,2],and:[2,4],or:[2,4],if:[3,3],log1p:[1,1]};
export function validateExpression(node,phase,budget={nodes:0},depth=0,allowedFields=FIELDS[phase]){
 if(++budget.nodes>160||depth>10)throw Error('PROGRAM_COMPLEXITY_LIMIT');
 if(typeof node==='number'){if(!Number.isFinite(node)||Math.abs(node)>1000)throw Error('INVALID_PROGRAM_CONSTANT');return;}
 if(!node||typeof node!=='object'||Array.isArray(node))throw Error('INVALID_EXPRESSION');
 if(Object.keys(node).join()==='field'){if(!allowedFields?.includes(node.field))throw Error('PRIVATE_OR_UNKNOWN_FEATURE');return;}
 if(Object.keys(node).sort().join()!=='args,op'||!Object.hasOwn(ARITY,node.op)||!Array.isArray(node.args)||node.args.length<ARITY[node.op][0]||node.args.length>ARITY[node.op][1])throw Error('INVALID_PROGRAM_OPERATOR');
 for(const arg of node.args)validateExpression(arg,phase,budget,depth+1,allowedFields);
}
export function calculate(node,features){
 if(typeof node==='number')return node;
 if(node.field){if(!Number.isFinite(features[node.field]))throw Error('MISSING_OBSERVED_FEATURE');return features[node.field];}
 if(node.op==='if')return calculate(node.args[calculate(node.args[0],features)>0?1:2],features);
 const a=node.args.map(x=>calculate(x,features));let value;
 switch(node.op){case'add':value=a.reduce((s,x)=>s+x,0);break;case'mul':value=a.reduce((s,x)=>s*x,1);break;case'sub':value=a[0]-a[1];break;
  case'div':value=Math.abs(a[1])<1e-9?0:a[0]/a[1];break;case'min':value=Math.min(...a);break;case'max':value=Math.max(...a);break;
  case'lt':value=Number(a[0]<a[1]);break;case'lte':value=Number(a[0]<=a[1]);break;case'gt':value=Number(a[0]>a[1]);break;case'gte':value=Number(a[0]>=a[1]);break;
  case'and':value=Number(a.every(x=>x>0));break;case'or':value=Number(a.some(x=>x>0));break;case'log1p':value=Math.log1p(Math.max(0,a[0]));break;default:throw Error('INVALID_PROGRAM_OPERATOR');}
 return Math.max(-1e6,Math.min(1e6,value));
}
export function compileProgram(raw){
 const p=structuredClone(raw),keys=['contactGate','contactScore','basketScore','stockTarget','stockPriority','historyDays','cashFraction','rail'];
 if(p&&Object.hasOwn(p,'fulfillment')){keys.push('fulfillment');if(!['sku_counts','funded_baskets'].includes(p.fulfillment)||p.fulfillment==='funded_baskets'&&p.rail!=='fast')throw Error('INVALID_FULFILLMENT_PROGRAM');}
 if(!p||Object.keys(p).sort().join()!==keys.sort().join()||!Number.isInteger(p.historyDays)||p.historyDays<1||p.historyDays>14||!Number.isFinite(p.cashFraction)||p.cashFraction<=0||p.cashFraction>1||!['fast','deadline'].includes(p.rail))throw Error('INVALID_PROGRAM');
 const budget={nodes:0};for(const key of ['contactGate','contactScore'])validateExpression(p[key],'contact',budget);
 validateExpression(p.basketScore,'basket',budget);for(const key of ['stockTarget','stockPriority'])validateExpression(p[key],'inventory',budget);
 const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
 return Object.freeze({program:freeze(p),hash:digest(p),nodes:budget.nodes});
}
const groupRate=(prior,kind,age)=>{const g=prior.groups[kind+'|'+(age<=2?'fresh':age<=7?'recent':'cold')]||{contacts:0,retained:0};return (g.retained+.5)/(g.contacts+2);};

export function canFollowUnfundedIntent(view,person){
 const signal=person.signal,requests=view.requests.filter(r=>r.customerId===person.customerId),catalog=new Map(view.products.map(p=>[p.catalogId,p]));
 if(!person.hasOpenRequest||!signal||signal.day>view.day||view.day-signal.day>2||!requests.length||requests.some(r=>r.status!=='REQUESTED'||r.authorizedCents>0))return false;
 if(signal.day<=Math.max(...requests.map(r=>r.createdDay))||requests.some(r=>r.lines.some(l=>l.acceptableCatalogIds.includes(signal.catalogId))))return false;
 const product=catalog.get(signal.catalogId),minimum=Math.min(...requests.map(r=>r.lines.reduce((s,l)=>s+Math.min(...l.acceptableCatalogIds.map(id=>catalog.get(id)?.priceCents??Infinity))*l.quantity,0)));
 return !!product&&Number.isFinite(minimum)&&product.priceCents<minimum;
}
export function contactFeatures(view,prior,historyDays,{allowUnfundedIntent=false}={}){
 const result=[],catalog=new Map(),local={},ordersByRequest=new Map(view.pastOrders.map(o=>[o.requestId,o]));for(const p of view.products)if(!catalog.has(p.catalogId))catalog.set(p.catalogId,p);
 for(const c of view.outreach.history)if(c.day+26<view.day){const k=c.kind+'|'+c.observedBucket.split('|')[2],r=local[k]??={n:0,k:0},order=ordersByRequest.get(c.requestId);r.n++;r.k+=Number(!!order&&!['SETTLED','PENDING_FUNDS'].includes(order.refundStatus));}
 for(const person of view.audience){
  if(!person.marketingConsent||person.hasOpenRequest&&!(allowUnfundedIntent&&canFollowUnfundedIntent(view,person))||person.lastContactDay!=null&&view.day-person.lastContactDay<view.outreach.rules.customerContactGapDays)continue;
  const signals=view.signals.filter(s=>s.customerId===person.customerId&&view.day-s.day<=historyDays),bySku=new Map();
  if(person.signal&&view.day-person.signal.day<=historyDays&&!signals.some(s=>s.catalogId===person.signal.catalogId&&s.day===person.signal.day))signals.push(person.signal);
  for(const s of signals){const rows=bySku.get(s.catalogId)||[];rows.push(s);bySku.set(s.catalogId,rows);}
  const purchased=view.pastOrders.filter(o=>o.customerId===person.customerId),totalItems=purchased.flatMap(o=>o.items).length;
  const offers=[...bySku.entries()].map(([id,signals])=>({kind:'recommend',catalogId:id,category:catalog.get(id)?.category,signals}));
  offers.push({kind:'ask_need',catalogId:null,category:'*',signals:[]});
  for(const offer of offers){
   if(!offer.category)continue;
   const signal=offer.signals.sort((a,b)=>b.day-a.day)[0],age=signal?view.day-signal.day:99,products=offer.catalogId?view.products.filter(p=>p.catalogId===offer.catalogId):[],stock=products.reduce((s,p)=>s+p.available,0),incoming=view.inbound.filter(i=>products.some(p=>p.id===i.productId)),arrival=stock>0?0:incoming.length?Math.max(0,Math.min(...incoming.map(i=>(i.confirmedArrivalDay??i.latestArrivalDay)-view.day))):99,
    group=offer.kind+'|'+(age<=2?'fresh':age<=7?'recent':'cold'),observed=local[group]??{n:0,k:0},rate=(groupRate(prior,offer.kind,age)*8+observed.k)/(8+observed.n),g=prior.groups[group],gross=offer.catalogId?catalog.get(offer.catalogId).priceCents/100:g?.retained?g.grossCents/g.retained/100:40,
    categoryBought=purchased.flatMap(o=>o.items).filter(i=>view.products.find(p=>p.id===i.productId)?.category===offer.category).length;
   result.push({action:{customerId:person.customerId,kind:offer.kind,category:offer.category,catalogId:offer.catalogId},features:{age,search:Number(signal?.kind==='SEARCH'),signal_count:offer.signals.length,category_affinity:categoryBought/Math.max(1,totalItems),price_usd:gross,stock,arrival_days:arrival,recency:person.lastPurchaseDay==null?99:view.day-person.lastPurchaseDay,prior_purchases:person.purchaseCount,response_rate:rate,local_response_rate:observed.n?observed.k/observed.n:0,local_sample_count:observed.n,expected_net_usd:rate*(gross*.0229+.29)-view.outreach.rules.outreachCostCents/100,is_recommendation:Number(offer.kind==='recommend')}});
  }
 }
 return result;
}
export function programContacts(view,compiled,prior){
 const p=compiled.program;if(view.day<30||view.day>=view.marketDays)return {actions:[],ranking:[]};
 const limit=Math.min(view.outreach.rules.dailyContactLimit-view.outreach.contactsToday,Math.floor(Math.min(view.outreach.remainingBudgetCents,view.outreach.availablePlatformCashCents)/view.outreach.rules.outreachCostCents));
 if(limit<=0)return {actions:[],ranking:[]};
 const rows=contactFeatures(view,prior,p.historyDays).filter(r=>calculate(p.contactGate,r.features)>0).map(r=>({...r,score:calculate(p.contactScore,r.features)})).filter(r=>r.score>0).sort((a,b)=>b.score-a.score||a.action.customerId.localeCompare(b.action.customerId)||String(a.action.catalogId).localeCompare(String(b.action.catalogId)));
 const selected=[],seen=new Set();for(const row of rows){if(seen.has(row.action.customerId))continue;seen.add(row.action.customerId);selected.push(row);if(selected.length>=limit)break;}
 return {actions:selected.map(r=>r.action),ranking:selected.map(r=>({customerId:r.action.customerId,catalogId:r.action.catalogId,score:r.score,features:r.features})),reason:'Execute the tested observed-feature program; product choices may use more than the latest signal.',model:{id:prior.version,type:'Pooled matured response prior with observed online updates',rows:prior.rows+view.outreach.history.filter(c=>c.day+26<view.day).length,cutoffDay:view.day}};
}

export function merchantContributionWeights(view){
 const history=Object.fromEntries(view.merchants.map(m=>[m.id,{warmup:0,sinceWarmup:0}]));
 for(const order of view.pastOrders){
  if(order.day>=view.day)continue;
  for(const m of order.merchants){const contribution=['SETTLED','PENDING_FUNDS'].includes(order.refundStatus)?-m.costCents-m.deliveryCents:m.grossCents-m.feeCents-m.costCents-m.deliveryCents;
   history[m.id][order.day<30?'warmup':'sinceWarmup']+=contribution;}
 }
 // Smoothed proportional weights: keep an observed merchant's warmup share
 // from disappearing merely because another store has cheaper procurement.
 // This is a ranking feature, not a guarantee of counterfactual profit floors.
 const anchors=Object.fromEntries(Object.entries(history).map(([id,h])=>[id,Math.max(100,h.warmup)])),totalAnchor=Object.values(anchors).reduce((s,n)=>s+n,0),totalCurrent=Object.entries(history).reduce((s,[id,h])=>s+Math.max(100,anchors[id]+h.sinceWarmup),0);
 return Object.fromEntries(Object.entries(history).map(([id,h])=>[id,{...h,weight:Math.max(.25,Math.min(4,(anchors[id]/totalAnchor)*totalCurrent/Math.max(100,anchors[id]+h.sinceWarmup)))}]));
}

export async function executeProgramCommerce(w,compiled,prior,allocator,key){
 const p=compiled.program,copy=structuredClone(w),view=observeGrowthWorld(copy),merchantWeights=merchantContributionWeights(view),quotes=buildCandidates(view),scored=quotes.map(q=>({...q,expectedPlatformCents:100*calculate(p.basketScore,{platform_usd:q.expectedPlatformCents/100,retailer_usd:q.retailerCents/100,balanced_retailer_usd:q.quote.merchants.reduce((s,m)=>s+(m.grossCents-m.feeCents-m.costCents-m.deliveryCents)*merchantWeights[m.id].weight,0)/100,gross_usd:q.gross/100,cost_usd:q.cost/100,preferred:q.preferred,deadline_days:q.deadlineDay-view.day,scarcity:q.scarcity})})),solution=await allocator.solve(view,scored);
 for(const index of solution.selected){const q=quotes[index];reserveBasket(copy,{requestId:q.requestId,items:q.items,key:key+':reserve:'+q.requestId});captureReservation(copy,{requestId:q.requestId,key:key+':capture:'+q.requestId});}
 const funded=p.fulfillment==='funded_baskets'?planFundedBaskets(observeGrowthWorld(copy),{cashFraction:p.cashFraction}):null;
 if(funded)for(const [i,order]of funded.orders.entries())placeProcurement(copy,{...order,key:key+':funded-stock:'+copy.day+':'+i});
 const after=observeGrowthWorld(copy),forecasts={rate7:demandForecast(after,'recent7'),rate14:demandForecast(after,'recent14'),rate28:demandForecast(after,'legacy28')},catalogIds=[...new Set(after.products.map(x=>x.catalogId))],plans=[],assigned={};
 // One concrete approved alternative per line. Accepted alternatives must not
 // be counted as several independent funded needs for inventory purchases.
 if(funded)for(const item of funded.picks){const product=after.products.find(p=>p.id===item.productId);(assigned[product.catalogId]??=[]).push({quantity:item.quantity,deadline:item.deadline});}
 else for(const r of after.requests.filter(r=>r.status==='AUTHORIZED'&&r.deadlineDay>=after.day+after.paymentRules.physicalLeadMaxDays+2))for(const line of r.lines){
  const chosen=after.products.filter(p=>line.acceptableCatalogIds.includes(p.catalogId)).sort((a,b)=>a.priceCents-b.priceCents)[0];
  (assigned[chosen.catalogId]??=[]).push({quantity:line.quantity,deadline:r.deadlineDay});
 }
 for(const id of catalogIds){
  const products=after.products.filter(x=>x.catalogId===id),lines=assigned[id]||[],deadline=Math.min(Infinity,...lines.map(l=>l.deadline)),funded=lines.reduce((s,l)=>s+l.quantity,0),stock=products.reduce((s,x)=>s+x.available,0),inbound=after.inbound.filter(i=>products.some(x=>x.id===i.productId)).reduce((s,x)=>s+x.quantity,0),interested=new Set(after.signals.filter(s=>s.catalogId===id&&after.day-s.day<=p.historyDays&&!after.audience.find(a=>a.customerId===s.customerId)?.hasOpenRequest).map(s=>s.customerId)).size;
  for(const product of products){
   const merchant=after.merchants.find(m=>m.id===product.merchantId),f={funded_units:funded,stock,inbound,rate7:forecasts.rate7[id],rate14:forecasts.rate14[id],rate28:forecasts.rate28[id],recent_interest:interested,response_rate:groupRate(prior,'recommend',0),unit_cost_usd:product.costCents/100,merchant_cash_usd:merchant.cashCents/100,days_remaining:Math.max(0,after.marketDays-after.day)},target=Math.max(0,Math.ceil(calculate(p.stockTarget,f))),priority=calculate(p.stockPriority,f);
   plans.push({product,catalogId:id,wanted:Math.max(0,target-stock-inbound),priority,deadline});
  }
 }
 plans.sort((a,b)=>b.priority-a.priority||a.product.costCents-b.product.costCents||a.product.id.localeCompare(b.product.id));
 const budgets=funded?{...funded.remainingBudgets}:Object.fromEntries(after.merchants.map(m=>[m.id,Math.floor(m.cashCents*p.cashFraction)])),filled={};let units=funded?funded.orders.flatMap(o=>o.items).reduce((s,i)=>s+i.quantity,0):0;
 for(const [index,plan]of plans.entries()){
  if(plan.priority<=0||plan.wanted<=(filled[plan.catalogId]||0))continue;
  // The procurement guard needs the base economic view. Rebuilding every
  // shopper's marketing history here adds work without changing these fields.
  const product=plan.product,current=observeDeadlineWorld(copy);let merchantRail='paypal',supplierRail='paypal';
  if(p.rail==='deadline'){merchantRail='bank';supplierRail='bank';if(current.day+current.paymentRules.physicalLeadMaxDays+6>plan.deadline){supplierRail='paypal';if(current.day+current.paymentRules.physicalLeadMaxDays+4>plan.deadline)merchantRail='paypal';}}
  const lead=current.paymentRules.physicalLeadMaxDays+Number(merchantRail==='bank')*2+Number(supplierRail==='bank')*2,actual=current.products.find(x=>x.id===product.id),available=current.merchants.find(m=>m.id===product.merchantId).cashCents,
   quantity=Math.min(20,Math.max(0,plan.wanted-(filled[plan.catalogId]||0)),procurementLimit(current,actual,lead),Math.floor(Math.min(available,budgets[product.merchantId])/product.costCents));
  if(quantity<=0)continue;
  placeProcurement(copy,{merchantId:product.merchantId,items:[{productId:product.id,quantity}],merchantRail,supplierRail,key:key+':stock:'+copy.day+':'+index});
  budgets[product.merchantId]-=quantity*product.costCents;filled[plan.catalogId]=(filled[plan.catalogId]||0)+quantity;units+=quantity;
 }
 assertDeadlineIntegrity(copy);Object.assign(w,copy);return {captured:solution.selected.length,stockUnits:units,solver:solution,replenishment:funded?.decisions,model:{type:'Observed-feature inventory program',cutoffDay:view.day,programHash:compiled.hash,merchantWeights}};
}

export const field=name=>({field:name});
export const op=(name,...args)=>({op:name,args});
const f=field,o=op;
const common={historyDays:7,cashFraction:.5,rail:'fast',contactGate:o('and',f('is_recommendation'),o('lte',f('age'),7),o('lte',f('arrival_days'),5)),
 contactScore:o('div',o('add',o('mul',f('price_usd'),.0229),.29),o('add',1,f('age'))),basketScore:o('add',f('platform_usd'),o('mul',.001,f('retailer_usd'))),
 stockTarget:o('add',f('funded_units'),o('mul',f('rate14'),o('min',10,f('days_remaining')))),stockPriority:o('div',o('add',f('funded_units'),f('rate14')),f('unit_cost_usd'))};
export const SEED_PROGRAMS=Object.freeze([
 {id:'multi_signal_fixed',hypothesis:'Keep multiple observed interests and prioritize funded demand per unit of procurement cash.',program:common},
 {id:'response_value',hypothesis:'Rank complete economic response estimates; admit a general inquiry only when its observed expected value is positive.',program:{...common,contactGate:o('gt',f('expected_net_usd'),0),contactScore:o('div',f('expected_net_usd'),o('add',1,o('mul',.15,f('age'))))}},
 {id:'intent_replenishment',hypothesis:'Reserve some inventory capacity for qualified recent interest before a request becomes funded.',program:{...common,stockTarget:o('add',f('funded_units'),o('max',o('mul',f('rate7'),o('min',10,f('days_remaining'))),o('mul',f('recent_interest'),f('response_rate'))))}},
 {id:'capital_budgeted',hypothesis:'Use a longer observed-demand horizon only where available cash supports it; keep all execution funding checks.',program:{...common,cashFraction:.75,stockTarget:o('add',f('funded_units'),o('mul',o('max',f('rate7'),f('rate14')),o('min',17,f('days_remaining'))))}}
]);
