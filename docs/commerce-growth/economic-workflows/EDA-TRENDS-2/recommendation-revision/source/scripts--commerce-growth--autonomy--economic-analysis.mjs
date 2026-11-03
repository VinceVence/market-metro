// Past-only analyst tools. Statistics and candidate scores are computed here;
// the planner chooses questions, comparisons and executable campaign recipes.
import {digest} from '../environment.mjs';
import {RULES} from '../kernel.mjs';
import {workbenchPlan} from './team-workbench-tools.mjs';

export const SEGMENTS=['all','new','active','lapsed'];
export const RECOMMENDATION_MODES=['latest_interest','multiple_interests','trend_aware'];
export function shopperSegment(p,day){return !p.purchaseCount?'new':p.lastPurchaseDay!=null&&day-p.lastPurchaseDay>=14?'lapsed':'active';}
const windows=[7,14,28],safeRows=(rows,day,key='day')=>(rows||[]).filter(r=>Number.isInteger(r[key])&&r[key]>=0&&r[key]<day);
const refunded=o=>['SETTLED','PENDING_FUNDS'].includes(o.refundStatus);
function context(view,days){
 if(!windows.includes(days))throw Error('INVALID_ANALYSIS_WINDOW');
 const day=view.day,start=Math.max(0,day-days),signals=safeRows(view.observedSignals??view.signals,day),orders=safeRows(view.pastOrders,day),contacts=safeRows(view.outreach.history,day),products=new Map(view.products.map(p=>[p.id,p])),people=new Map(view.audience.map(p=>[p.customerId,p]));
 const sourceCapped=!view.observedSignals&&(view.signals?.length??0)>=300,firstSignal=signals.length?Math.min(...signals.map(s=>s.day)):null;
 return {day,start,signals,orders,contacts,products,people,coverage:{signalHistorySource:view.observedSignals?'Full observed signal history':'Public observation sample',signalHistoryCapped:sourceCapped,earliestSignalDay:firstSignal,signalWindowMayBeIncomplete:sourceCapped&&(firstSignal===null||firstSignal>start),historyThroughDay:day-1}};
}
const artifact=(prefix,body)=>({...body,evidenceId:prefix+'-'+digest(body).slice(0,20)});
export function exploreMarket(view,{dimension,windowDays}){
 if(!['category','merchant','customer_segment'].includes(dimension))throw Error('INVALID_EDA_DIMENSION');
 const c=context(view,windowDays),recent=c.orders.filter(o=>o.day>=c.start),groups=new Map(),byRequest=new Map(c.orders.map(o=>[o.requestId,o]));
 const ensure=key=>{if(!groups.has(key))groups.set(key,{key,orders:new Set(),buyers:new Set(),signalPeople:new Set(),signals:0,searches:0,units:0,grossCents:0,contacts:0,replies:0,matureContacts:0,matureContactPurchases:0,matureOrders:0,refundedMatureOrders:0,availableUnits:0,spendableCents:0});return groups.get(key);};
 if(dimension==='category')for(const p of view.products)ensure(p.category).availableUnits+=p.available;
 if(dimension==='merchant')for(const m of view.merchants){const g=ensure(m.id);g.availableUnits=view.products.filter(p=>p.merchantId===m.id).reduce((s,p)=>s+p.available,0);g.spendableCents=m.cashCents;}
 if(dimension==='customer_segment')for(const s of SEGMENTS.filter(s=>s!=='all'))ensure(s);
 const segment=id=>shopperSegment(c.people.get(id)||{},c.day);
 for(const o of recent){
  const bins=new Map();for(const i of o.items){const p=c.products.get(i.productId),key=dimension==='merchant'?i.merchantId:dimension==='category'?p?.category:segment(o.customerId);if(!key)continue;const a=bins.get(key)||{units:0,gross:0};a.units+=i.quantity;a.gross+=i.quantity*i.unitPriceCents;bins.set(key,a);}
  for(const [key,v]of bins){const g=ensure(key);g.orders.add(o.id);g.buyers.add(o.customerId);g.units+=v.units;g.grossCents+=v.gross;if(o.day+RULES.returnWindowDays<c.day){g.matureOrders++;g.refundedMatureOrders+=Number(refunded(o));}}
 }
 if(dimension!=='merchant'){
  for(const s of c.signals.filter(s=>s.day>=c.start)){const key=dimension==='category'?s.category:segment(s.customerId);if(!key)continue;const g=ensure(key);g.signals++;g.searches+=Number(s.kind==='SEARCH');g.signalPeople.add(s.customerId);}
  for(const ct of c.contacts.filter(ct=>ct.day>=c.start)){const key=dimension==='category'?ct.category:segment(ct.customerId),g=ensure(key);g.contacts++;g.replies+=Number(ct.responded);if(ct.day+RULES.followupDays<c.day){g.matureContacts++;const o=byRequest.get(ct.requestId);g.matureContactPurchases+=Number(!!o&&!refunded(o));}}
 }
 const rows=[...groups.values()].map(g=>({group:g.key,orders:g.orders.size,buyers:g.buyers.size,units:g.units,grossUSD:g.grossCents/100,signals:dimension==='merchant'?null:g.signals,searches:dimension==='merchant'?null:g.searches,interestedShoppers:dimension==='merchant'?null:g.signalPeople.size,contacts:dimension==='merchant'?null:g.contacts,replies:dimension==='merchant'?null:g.replies,responseRate:g.contacts?g.replies/g.contacts:null,matureContacts:g.matureContacts,matureContactPurchases:g.matureContactPurchases,matureRetainedRate:g.matureContacts?g.matureContactPurchases/g.matureContacts:null,matureOrders:g.matureOrders,matureRefundRate:g.matureOrders?g.refundedMatureOrders/g.matureOrders:null,currentAvailableUnits:dimension==='customer_segment'?null:g.availableUnits,currentSpendableUSD:dimension==='merchant'?g.spendableCents/100:null}));
 const sources={signals:view.observedSignals??view.signals,orders:view.pastOrders,contacts:view.outreach.history},quality=Object.fromEntries(Object.entries(sources).map(([name,rows])=>[name,{availableRows:rows.length,futureOrCurrentExcluded:rows.filter(r=>r.day>=view.day).length,missingDay:rows.filter(r=>!Number.isInteger(r.day)).length,duplicateIds:rows.filter(r=>r.id).length-new Set(rows.filter(r=>r.id).map(r=>r.id)).size}]));
 return artifact('EDA',{tool:'explore_market',asOfDay:c.day,windowDays,dimension,domains:['demand','outreach','inventory','liquidity','payments'],coverage:c.coverage,quality,totals:{captures:recent.length,capturedUSD:recent.reduce((s,o)=>s+o.grossCents,0)/100,currentConsentedShoppers:view.audience.filter(p=>p.marketingConsent).length},rows,
  caveats:['Captured revenue is not settled PayPal profit; recent refunds may be unresolved.','Mixed-category orders count once per represented category; category order counts are not additive.','Merchant-level browsing and contact attribution are unavailable; null is not zero.','Customer segments use current observed purchase history, not a historical randomized cohort.','Browse, contact and purchase counts have different populations; they are not a causal conversion funnel.','A contact outcome is labeled mature only after the full26-day deadline/return horizon. Recent windows therefore have unresolved outcomes.']});
}
export function analyzeTrends(view,{windowDays}){
 const c=context(view,windowDays),previous=Math.max(0,c.start-windowDays),samePhase=view.day<=RULES.warmupDays||previous>=RULES.warmupDays,categories=[...new Set(view.products.map(p=>p.category))],days=Array.from({length:view.day-previous},(_,i)=>previous+i),series=[];
 for(const category of categories){
  for(const day of days){const signals=c.signals.filter(s=>s.day===day&&s.category===category),requests=(view.observedRequests||[]).filter(r=>r.observedDay===day),orders=c.orders.filter(o=>o.day===day);series.push({day,category,interestedShoppers:new Set(signals.map(s=>s.customerId)).size,searches:signals.filter(s=>s.kind==='SEARCH').length,discoveredUnits:requests.flatMap(r=>r.lines).filter(l=>l.category===category).reduce((s,l)=>s+l.quantity,0),capturedUnits:orders.flatMap(o=>o.items).filter(i=>c.products.get(i.productId)?.category===category).reduce((s,i)=>s+i.quantity,0)});}
 }
 const measures=['interestedShoppers','searches','discoveredUnits','capturedUnits'],rows=categories.map(category=>{const xs=series.filter(s=>s.category===category),totals=where=>Object.fromEntries(measures.map(k=>[k,xs.filter(where).reduce((s,x)=>s+x[k],0)])),current=totals(x=>x.day>=c.start),prior=totals(x=>x.day<c.start),duration={current:view.day-c.start,previous:c.start-previous},signalComplete=!c.coverage.signalHistoryCapped||(c.coverage.earliestSignalDay!==null&&c.coverage.earliestSignalDay<=previous),reliable=samePhase&&duration.current===duration.previous&&current.interestedShoppers>=5&&prior.interestedShoppers>=5&&signalComplete;
  const rateRatio=Object.fromEntries(measures.map(k=>[k,prior[k]&&duration.previous?current[k]/duration.current/(prior[k]/duration.previous):null]));
  return {category,current,previous:prior,rateRatio,interpretableInterestTrend:reliable,signalCoverageComplete:signalComplete,label:!reliable?'insufficient comparable evidence':rateRatio.interestedShoppers>1.25?'rising observed interest':rateRatio.interestedShoppers<.8?'falling observed interest':'roughly stable interest',currentStock:view.products.filter(p=>p.category===category).reduce((s,p)=>s+p.available,0)};});
 return artifact('TREND',{tool:'analyze_market_trends',asOfDay:view.day,windowDays,domains:['demand'],coverage:c.coverage,phaseComparable:samePhase,periods:{previous:[previous,c.start-1],current:[c.start,view.day-1]},rows,series,
  caveats:['Observed interest is not latent demand or a future sales guarantee.','Unique interested shoppers are counted per day; sums are shopper-days.','Low counts, truncated history and windows crossing warmup are flagged; descriptive labels are not significance tests.','A category can gain browsing while losing captures because of funding, stock or timing. These comparisons do not identify a causal driver.']});
}
export function validateRecommendationRecipe(recipe,view){
 if(!recipe||Object.keys(recipe).sort().join()!=='category,mode,segment'||!RECOMMENDATION_MODES.includes(recipe.mode)||!SEGMENTS.includes(recipe.segment)||!['all',...new Set(view.products.map(p=>p.category))].includes(recipe.category))throw Error('INVALID_RECOMMENDATION_RECIPE');return structuredClone(recipe);
}
export function recommendationPlan(view,resources,recipe){
 validateRecommendationRecipe(recipe,view);const trends=recipe.mode==='trend_aware'?analyzeTrends(view,{windowDays:7}):null,weights=Object.fromEntries((trends?.rows||[]).map(r=>[r.category,r.interpretableInterestTrend?Math.max(.5,Math.min(1.5,r.rateRatio.interestedShoppers)):1]));
 return workbenchPlan(view,{model:resources.incumbent,campaign:{kind:'product_recommendations',objective:'joint'},prior:resources.prior,fundingPrior:resources.fundingPrior,configuration:resources.fixed.config,recommendationJob:{...recipe,trendWeights:weights}});
}
export function recommendationOpportunities(view,resources){
 const catalog=new Map(view.products.map(p=>[p.catalogId,p]));
 return {asOfDay:view.day,method:'multiple_interests',scope:'Current reachable positive-value recommendations, subject to the same consent, cooldown, model, inventory and10-contact limit. Segment rows overlap with all and are not additive. These are model predictions, not new sales.',segments:SEGMENTS.map(segment=>{const p=recommendationPlan(view,resources,{mode:'multiple_interests',segment,category:'all'});return {segment,scoredProducts:p.candidateDiagnostics?.scoredProducts??0,selectedShoppers:p.actions.length,categories:[...new Set(p.ranking.map(x=>catalog.get(x.catalogId).category))],expectedPayPalUSD:p.ranking.reduce((s,x)=>s+x.expectedNetCents,0)/100};})};
}
export function buildRecommendations(view,resources,recipe){
 validateRecommendationRecipe(recipe,view);const plan=recommendationPlan(view,resources,recipe),baseline=resources.baselineController.plan(view),catalog=new Map(view.products.map(p=>[p.catalogId,p])),people=new Map(view.audience.map(p=>[p.customerId,p]));
 const rows=plan.ranking.map(r=>{const p=catalog.get(r.catalogId),person=people.get(r.customerId);return {...r,product:p.title,category:p.category,segment:shopperSegment(person,view.day),availableUnits:view.products.filter(p=>p.catalogId===r.catalogId).reduce((s,p)=>s+p.available,0),expectedPayPalUSD:r.expectedNetCents/100,expectedMerchantUSD:r.expectedMerchantNetCents/100};});
 const body={snapshotId:digest(view),asOfDay:view.day,recipe,modelHash:resources.incumbent.modelHash,modelId:resources.incumbent.id,domains:['recommendations','outreach','demand','inventory','payments'],rows,actions:plan.actions,diagnostics:plan.candidateDiagnostics,...(!rows.length?{repairEvidence:recommendationOpportunities(view,resources)}:{}),baselineContacts:baseline.actions.length,selectedContacts:rows.length,expectedPayPalUSD:rows.reduce((s,r)=>s+r.expectedPayPalUSD,0),expectedMerchantUSD:rows.reduce((s,r)=>s+r.expectedMerchantUSD,0),scope:'Existing locally trained purchase/value model scores observed candidate products. Scores are observational predictions, not incremental sales or guaranteed profit. Campaign execution recalculates from each market current observations, not these saved customer IDs. Consent, positive joint value, funding, stock/inbound checks and existing contact budgets remain enforced.'};
 return {...body,id:'REC-'+digest(body).slice(0,20)};
}
export function inspectBaseline(resources){
 return artifact('BASE',{domains:['baseline'],baseline:'paypal-net-v1',decision:resources.decision.output,inventoryProgram:resources.funded.program,model:{id:resources.incumbent.id,family:resources.incumbent.artifact.selected,hash:resources.incumbent.modelHash},description:'The locked stock target uses funded units plus rate14 multiplied by up to10 remaining days. Funded complete baskets are planned first. Broad positive-value inquiries and latest-interest recommendations use the existing model. A new forecast is not automatically an improvement.',scope:'Read from the actual locked artifacts; this is not an LLM reconstruction.'});
}
