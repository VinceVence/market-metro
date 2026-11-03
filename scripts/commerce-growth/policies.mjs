// Same candidate/observation tool for every policy. No latent state is accepted.
import {contactBucket,digest} from './environment.mjs';

export const GROWTH_POLICIES=Object.freeze([
 {id:'no_outreach',mode:'none'},
 {id:'fixed_coverage',mode:'coverage'},
 {id:'fixed_intent',mode:'intent'},
 {id:'fixed_rfm',mode:'rfm'},
 {id:'fixed_stock',mode:'stock'},
 {id:'learned_discovery',mode:'bayesian'}
]);
export function outreachCandidates(view){
 const candidates=[];
 for(const person of view.audience){
  if(!person.marketingConsent||person.hasOpenRequest||person.lastContactDay!=null&&view.day-person.lastContactDay<view.outreach.rules.customerContactGapDays)continue;
  const age=person.signal?view.day-person.signal.day:99,signal=age<=7?person.signal:null;
  const category=signal?.category??'*',seen=signal?view.products.filter(p=>p.catalogId===signal.catalogId):[],stock=seen.reduce((s,p)=>s+p.available,0),incoming=seen.flatMap(p=>view.inbound.filter(i=>i.productId===p.id)),soon=incoming.some(i=>(i.confirmedArrivalDay??i.latestArrivalDay)<=view.day+2);
  const expectedGross=signal?(seen[0]?.priceCents||person.lastPaidCents||4000):person.lastPaidCents||4000;
  const common={customerId:person.customerId,category,age,hasSignal:!!signal,search:signal?.kind==='SEARCH',
   recency:person.lastPurchaseDay==null?99:view.day-person.lastPurchaseDay,purchases:person.purchaseCount,
   lastContactDay:person.lastContactDay??-100,stock,soon,expectedGross,
   expectedRetailNetCents:Math.max(0,expectedGross*.0229+29)};
  candidates.push({...common,kind:'ask_need',catalogId:null,bucket:contactBucket(person,'ask_need',category,view.day)});
  if(signal&&seen.length)candidates.push({...common,kind:'recommend',catalogId:signal.catalogId,bucket:contactBucket(person,'recommend',category,view.day)});
 }
 return candidates;
}
export function fitDiscoveryModel(view){
 const history=view.outreach.history.filter(c=>c.day<view.day),buckets={};
 for(const c of history){buckets[c.observedBucket]??={success:0,fail:0};buckets[c.observedBucket][c.authorized?'success':'fail']++;}
 return {id:'BETA-'+digest({cutoff:view.day,buckets}).slice(0,12),type:'Observed contextual Beta-Bernoulli response model',
  cutoffDay:view.day,rows:history.length,prior:{success:1,failure:3},buckets,
  limitation:'Predicts funded responses among previously contacted shoppers. It is not a causal uplift model and contains no hidden need labels.'};
}
export function proposeOutreach(view,policy){
 const model=policy.mode==='bayesian'?fitDiscoveryModel(view):null;
 if(policy.mode==='none'||view.day<30||view.day>=view.marketDays)return {actions:[],model};
 const limit=Math.min(view.outreach.rules.dailyContactLimit-view.outreach.contactsToday,
  Math.floor(Math.min(view.outreach.remainingBudgetCents,view.outreach.availablePlatformCashCents)/view.outreach.rules.outreachCostCents));
 if(limit<=0)return {actions:[],model};
 const history=view.outreach.history,latest=history.slice(-20),zeroResponse=latest.length===20&&latest.every(c=>!c.authorized);
 // A common failure circuit protects every active comparator, with one weekly
 // probe to detect recovery. The zero-response scenario is never named here.
 const probeDay=history.at(-1)?.day??-100;
 if(zeroResponse&&view.day-probeDay<7)return {actions:[],model,reason:'No funded responses in the last20 observed contacts; wait for the bounded weekly probe.'};
 let candidates=outreachCandidates(view);
 if(policy.mode==='coverage')candidates=candidates.filter(c=>c.kind==='ask_need');
 if(policy.mode==='intent')candidates=candidates.filter(c=>c.hasSignal&&c.kind==='recommend');
 if(policy.mode==='stock')candidates=candidates.filter(c=>c.hasSignal&&c.kind==='recommend'&&(c.stock>0||c.soon));
 const score=c=>{
  if(policy.mode==='coverage')return -c.lastContactDay;
  if(policy.mode==='intent')return 20-c.age+Number(c.search)*3;
  if(policy.mode==='rfm')return Number(c.hasSignal)*20+Number(c.search)*4+Math.min(30,c.recency)*.15+Math.min(10,c.purchases)*.2+Number(c.kind==='recommend'&&c.age<=2)*2;
  if(policy.mode==='stock')return (20-c.age+Number(c.search)*3)*Math.log1p(c.expectedRetailNetCents);
  const b=model.buckets[c.bucket]||{success:0,fail:0},a=b.success+model.prior.success,z=b.fail+model.prior.failure;
  const mean=a/(a+z),variance=a*z/((a+z)**2*(a+z+1)),ucb=Math.min(1,mean+.5*Math.sqrt(variance));
  return ucb*c.expectedRetailNetCents*(c.stock>0||c.soon||!c.hasSignal?1:.45)-view.outreach.rules.outreachCostCents;
 };
 candidates=candidates.map(c=>({...c,score:score(c)})).sort((a,b)=>b.score-a.score||a.customerId.localeCompare(b.customerId)||a.kind.localeCompare(b.kind));
 const selected=[],seen=new Set();for(const c of candidates){if(seen.has(c.customerId)||policy.mode==='bayesian'&&c.score<=0)continue;
  selected.push(c);seen.add(c.customerId);if(selected.length>=Math.min(limit,zeroResponse?1:limit))break;
 }
 return {model,actions:selected.map(c=>({customerId:c.customerId,kind:c.kind,category:c.category,catalogId:c.catalogId})),
  ranking:selected.map(c=>({customerId:c.customerId,kind:c.kind,bucket:c.bucket,score:c.score})),
  reason:policy.mode==='bayesian'?'Rank expected funded response using observed posterior estimates and bounded uncertainty.':'Fixed outreach rule applied to current observed interest, history, stock and consent.'};
}
