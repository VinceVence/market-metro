// The consent and discovery extension is separate from the frozen deadline world.
// Private needs and response draws never enter an application policy's observation.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {draw} from '../marketing/economy.mjs';
import {createDeadlineWorld,requestFor,beginDeadlineDay,endDeadlineDay,observeDeadlineWorld,
 authorizeRequest,transfer,idempotent,assertDeadlineIntegrity,RULES} from './kernel.mjs';

export const CONTRACT=JSON.parse(readFileSync(new URL('../../docs/commerce-growth/contract.json',import.meta.url),'utf8'));
export const GROWTH_RULES=Object.freeze({...CONTRACT.rules,customers:600,dailyContactLimit:60,campaignBudgetCents:30000});
export const GROWTH_REGIMES=Object.freeze(CONTRACT.regimes);
export const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const topics=w=>[...new Set(w.catalog.map(p=>p.category))];
const permitted=(profile,day)=>profile.optedIn&&(profile.revokedDay==null||day<profile.revokedDay);

export function createGrowthWorld({seed,regime,days=GROWTH_RULES.marketDays,customers=GROWTH_RULES.customers}){
 if(!Object.hasOwn(GROWTH_REGIMES,regime))throw Error('INVALID_GROWTH_REGIME');
 const configuration=GROWTH_REGIMES[regime],w=createDeadlineWorld({seed,scenario:configuration.baseScenario,days,customers});
 w.version='commerce-expanded-1';
 const needs=[],profiles=w.people.map(p=>({id:p.id,index:p.index,
  optedIn:draw(seed,'growth-marketing-consent',p.index)<GROWTH_RULES.marketingConsentProbability,
  revokedDay:draw(seed,'growth-consent-revoke',p.index)<GROWTH_RULES.consentRevocationProbability?GROWTH_RULES.consentRevocationDay:null}));
 for(let day=0;day<days;day++)for(const person of w.people){
  const request=requestFor(w,person,day);if(!request)continue;
  needs.push({request,organic:day<RULES.warmupDays||draw(seed,'growth-organic-route',day,person.index)<configuration.organicProbability,
   responseDraw:draw(seed,'growth-need-response',day,person.index),state:'DORMANT',discoveredDay:null,discovery:null,contactId:null});
 }
 w.growth={regime,needs,profiles,signals:[],contacts:[],outreachCents:0,
  opportunityHash:digest(needs.map(n=>({request:n.request,organic:n.organic,responseDraw:n.responseDraw}))),
  consentHash:digest(profiles),initialNeeds:needs.length};
 return w;
}

function reveal(w,need,discovery,contactId=null,recommendedCatalogId=null){
 if(need.state!=='DORMANT'||need.request.createdDay>w.day||need.request.deadlineDay<w.day+2)throw Error('NEED_NOT_DISCOVERABLE');
 need.state='EXPOSED';need.discoveredDay=w.day;need.discovery=discovery;need.contactId=contactId;
 const request={...structuredClone(need.request),discoveredDay:w.day,discovery,contactId,recommendedCatalogId};
 w.events.push({day:w.day,type:'NEED_DISCOVERED',requestId:request.id,customerId:request.customerId,discovery,contactId});
 return request;
}
function settleHiddenNeeds(w){
 for(const need of w.growth.needs){
  if(need.state!=='DORMANT'||need.request.deadlineDay>=w.day)continue;
  const request=need.request,amount=request.lines.reduce((s,l)=>s+Math.min(...l.acceptableCatalogIds.map(id=>w.catalog.find(p=>p.id===id).priceCents))*l.quantity,0);
  if(w.accounts[request.customerId]>=amount){transfer(w,request.customerId,'outside_shops',amount,{kind:'OUTSIDE_PURCHASE',reference:request.id});need.state='OUTSIDE_PURCHASED';}
  else need.state='EXPIRED_UNFUNDED';
 }
}
export function beginGrowthDay(w){
 const today=new Map(w.growth.needs.filter(n=>n.request.createdDay===w.day).map(n=>[n.request.customerId,n]));
 beginDeadlineDay(w,{beforeRequests:settleHiddenNeeds,requestFactory:(world,person,day)=>{
  const need=today.get(person.id);
  return need?.organic?reveal(world,need,'ORGANIC'):null;
 }});
 if(w.day<w.settings.days){
  const categories=topics(w),regime=GROWTH_REGIMES[w.growth.regime];
  for(const person of w.people){
   const need=today.get(person.id);
   if(need&&draw(w.seed,'growth-need-signal',w.day,person.index)<regime.needSignalProbability){
    const line=need.request.lines[0],kind=draw(w.seed,'growth-signal-kind',w.day,person.index)<.65?'SEARCH':'BROWSE';
    w.growth.signals.push({day:w.day,customerId:person.id,category:line.category,catalogId:line.preferredCatalogId,kind,source:'SIMULATED_OBSERVED_INTEREST'});
   }else if(draw(w.seed,'growth-false-signal',w.day,person.index)<GROWTH_RULES.falseSignalProbability){
    const category=categories[Math.floor(draw(w.seed,'growth-noise-category',w.day,person.index)*categories.length)];
    const products=w.catalog.filter(p=>p.category===category),catalogId=products[Math.floor(draw(w.seed,'growth-noise-product',w.day,person.index)*products.length)].id;
    w.growth.signals.push({day:w.day,customerId:person.id,category,catalogId,kind:'BROWSE',source:'SIMULATED_OBSERVED_INTEREST'});
   }
  }
 }
 assertGrowthIntegrity(w);
}
export function endGrowthDay(w){endDeadlineDay(w);assertGrowthIntegrity(w);}

function customerObservation(w,profile,index=null){
 const orders=index?.orders.get(profile.id)||w.orders.filter(o=>o.customerId===profile.id&&o.day<w.day),contacts=index?.contacts.get(profile.id)||w.growth.contacts.filter(c=>c.customerId===profile.id),signal=index?index.signals.get(profile.id):w.growth.signals.filter(s=>s.customerId===profile.id&&s.day<=w.day).at(-1);
 const latest=orders.at(-1),lastContact=contacts.at(-1);
 return {customerId:profile.id,marketingConsent:permitted(profile,w.day),
  lastContactDay:lastContact?.day??null,contactCount:contacts.length,lastPurchaseDay:latest?.day??null,
  purchaseCount:orders.length,retainedSpendCents:orders.reduce((s,o)=>s+o.grossCents-o.refundCents,0),
  lastPaidCents:latest?.grossCents??null,signal:signal?{...signal}:null,
  hasOpenRequest:index?index.open.has(profile.id):w.requests.some(r=>r.customerId===profile.id&&['REQUESTED','AUTHORIZED','RESERVED'].includes(r.status)),
  observedCategories:[...new Set(orders.flatMap(o=>o.items.map(i=>w.products.find(p=>p.id===i.productId).category)))]};
}
export function contactBucket(customer,kind,category,day){
 const age=customer.signal?day-customer.signal.day:99,freshness=age<=2?'fresh':age<=7?'recent':'cold';
 return [kind,category,freshness,customer.purchaseCount>0?'returning':'new'].join('|');
}
export function observeGrowthWorld(w){
 const index={orders:new Map(),contacts:new Map(),signals:new Map(),open:new Set()},push=(map,row)=>{if(!map.has(row.customerId))map.set(row.customerId,[]);map.get(row.customerId).push(row);};
 for(const p of w.people){index.orders.set(p.id,[]);index.contacts.set(p.id,[]);}
 for(const o of w.orders)if(o.day<w.day)push(index.orders,o);
 for(const c of w.growth.contacts)push(index.contacts,c);
 for(const s of w.growth.signals)if(s.day<=w.day)index.signals.set(s.customerId,s);
 for(const r of w.requests)if(['REQUESTED','AUTHORIZED','RESERVED'].includes(r.status))index.open.add(r.customerId);
 return {...observeDeadlineWorld(w),scale:{version:w.version,shoppers:w.people.length,merchants:w.merchants.length,contactMultiplier:6,contactUnit:'per 100 shoppers',virtualCampaignBudgetCents:GROWTH_RULES.campaignBudgetCents},audience:w.growth.profiles.map(p=>customerObservation(w,p,index)),
  signals:w.growth.signals.filter(s=>s.day<=w.day).slice(-1800),
  outreach:{rules:GROWTH_RULES,spentCents:w.growth.outreachCents,remainingBudgetCents:GROWTH_RULES.campaignBudgetCents-w.growth.outreachCents,
   availablePlatformCashCents:w.accounts.platform,contactsToday:w.growth.contacts.filter(c=>c.day===w.day).length,history:structuredClone(w.growth.contacts)},
  scope:'Observed interest, actual purchases, explicit current marketing consent and funded revealed requests only. No hidden needs, future route/response draws, seed, household wallets, incomes or future consent revocations.'};
}

export function contactCustomer(w,action){
 const allowed=['key','customerId','kind','category','catalogId'];
 if(!action||Object.keys(action).some(k=>!allowed.includes(k)))throw Error('INVALID_CONTACT_FIELDS');
 const {key,customerId,kind,category,catalogId=null}=action;
 return idempotent(w,key,{type:'GROWTH_CONTACT',customerId,kind,category,catalogId},()=>{
  if(!w.dayStarted||w.day<RULES.warmupDays||w.day>=w.settings.days)throw Error('CONTACT_OUTSIDE_CAMPAIGN');
  const profile=w.growth.profiles.find(p=>p.id===customerId);
  if(!profile||!permitted(profile,w.day))throw Error('NO_MARKETING_CONSENT');
  if(!['ask_need','recommend'].includes(kind)||![...topics(w),'*'].includes(category))throw Error('INVALID_CONTACT_KIND_OR_CATEGORY');
  const product=kind==='recommend'?w.catalog.find(p=>p.id===catalogId):null;
  if(kind==='recommend'&&(!product||product.category!==category)||kind==='ask_need'&&catalogId!==null)throw Error('INVALID_RECOMMENDATION');
  const prior=w.growth.contacts.filter(c=>c.customerId===customerId).at(-1);
  if(prior&&w.day-prior.day<GROWTH_RULES.customerContactGapDays)throw Error('CONTACT_FREQUENCY_LIMIT');
  if(w.growth.contacts.filter(c=>c.day===w.day).length>=GROWTH_RULES.dailyContactLimit)throw Error('DAILY_CONTACT_LIMIT');
  if(w.growth.outreachCents+GROWTH_RULES.outreachCostCents>GROWTH_RULES.campaignBudgetCents||w.accounts.platform<GROWTH_RULES.outreachCostCents)throw Error('CONTACT_NOT_FUNDED');
  const observed=customerObservation(w,profile),id='CONTACT-'+w.growth.contacts.length;
  transfer(w,'platform','marketing_services',GROWTH_RULES.outreachCostCents,{kind:'OUTREACH_EXPENSE',reference:id});
  const need=w.growth.needs.filter(n=>n.state==='DORMANT'&&n.request.customerId===customerId&&n.request.createdDay<=w.day&&n.request.deadlineDay>=w.day+2)
   .filter(n=>n.request.lines.some(l=>(category==='*'||l.category===category)&&(kind==='ask_need'||l.acceptableCatalogIds.includes(catalogId))))
   .sort((a,b)=>a.request.deadlineDay-b.request.deadlineDay)[0];
  const factor=kind==='ask_need'?GROWTH_RULES.askResponseFactor:GROWTH_RULES.recommendationResponseFactor;
  const responded=!!need&&need.responseDraw<GROWTH_REGIMES[w.growth.regime].responseProbability*factor;
  let request=null;
  if(responded){request=reveal(w,need,'CONSENTED_OUTREACH',id,catalogId);w.requests.push(request);authorizeRequest(w,request);}
  const record={id,day:w.day,customerId,kind,category,catalogId,costCents:GROWTH_RULES.outreachCostCents,
   consentChecked:true,responded,requestId:request?.id??null,authorized:request?.status==='AUTHORIZED',
   observedBucket:contactBucket(observed,kind,category,w.day),source:'SIMULATED_CONSENTED_OUTREACH'};
  w.growth.contacts.push(record);w.growth.outreachCents+=record.costCents;
  w.events.push({day:w.day,type:'MARKETING_CONTACT',...record});assertDeadlineIntegrity(w);return structuredClone(record);
 });
}

export function assertGrowthIntegrity(w){
 assertDeadlineIntegrity(w);
 if(w.growth.needs.length!==w.growth.initialNeeds||new Set(w.growth.needs.map(n=>n.request.id)).size!==w.growth.needs.length)throw Error('FINITE_NEED_POOL_CHANGED');
 if(digest(w.growth.needs.map(n=>({request:n.request,organic:n.organic,responseDraw:n.responseDraw})))!==w.growth.opportunityHash||digest(w.growth.profiles)!==w.growth.consentHash)throw Error('EXOGENOUS_GROWTH_INPUT_CHANGED');
 if(new Set(w.requests.map(r=>r.id)).size!==w.requests.length)throw Error('DUPLICATE_DISCOVERED_REQUEST');
 const byId=new Map(w.growth.needs.map(n=>[n.request.id,n]));
 for(const r of w.requests){const n=byId.get(r.id);if(!n||n.state!=='EXPOSED'||r.customerId!==n.request.customerId||r.budgetCents!==n.request.budgetCents||JSON.stringify(r.lines)!==JSON.stringify(n.request.lines))throw Error('UNCONSENTED_OR_INVENTED_NEED');}
 for(const order of w.orders)if(!byId.has(order.requestId)||byId.get(order.requestId).state!=='EXPOSED')throw Error('CAPTURE_WITHOUT_DISCOVERED_NEED');
 const costs=w.ledger.filter(l=>l.kind==='OUTREACH_EXPENSE').reduce((s,l)=>s+l.cents,0);
 if(costs!==w.growth.outreachCents||costs!==w.growth.contacts.length*GROWTH_RULES.outreachCostCents||costs>GROWTH_RULES.campaignBudgetCents)throw Error('OUTREACH_ACCOUNTING_MISMATCH');
 const contactsByCustomer=new Map();for(const c of w.growth.contacts){if(!contactsByCustomer.has(c.customerId))contactsByCustomer.set(c.customerId,[]);contactsByCustomer.get(c.customerId).push(c);}
 for(const p of w.growth.profiles){const rows=contactsByCustomer.get(p.id)||[];for(let i=0;i<rows.length;i++)if(!permitted(p,rows[i].day)||(i&&rows[i].day-rows[i-1].day<GROWTH_RULES.customerContactGapDays))throw Error('OUTREACH_CONSENT_OR_FREQUENCY_VIOLATION');}
 const outside=new Set(w.ledger.filter(l=>l.kind==='OUTSIDE_PURCHASE').map(l=>l.reference));
 if(w.orders.some(o=>outside.has(o.requestId)))throw Error('NEED_PURCHASED_TWICE');
 return true;
}
