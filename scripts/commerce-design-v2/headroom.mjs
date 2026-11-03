// EVALUATOR ONLY: private state and future keyed draws are permitted here solely
// to diagnose headroom. These policies are forbidden as deployable benchmarks.
// A greedy clairvoyant policy is NOT a mathematical upper bound.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createWorld,stepWorld,outcome,fee,processing,shelfPrice,allowedOffer,lifecycleVisitProbability,campaignContact} from '../behavior-v4/engine.mjs';
import {authoredCatalog,itemRelevance} from '../behavior-v4/catalog.mjs';
import {draw} from '../marketing/economy.mjs';
import {compilePolicy,train} from '../behavior-v4/policies.mjs';
import {SETTINGS,hash} from './evaluate.mjs';
const cases=[{seed:420100,scenario:'steady'},{seed:420110,scenario:'rival_sale'},{seed:420120,scenario:'preference_shift'}];
const sum=(xs,fn)=>xs.reduce((s,x)=>s+fn(x),0);
function predict(w,u,action){
 const t=structuredClone(w.behavior.private[u.index]),day=w.tick,p=action?w.products.find(p=>p.product_id===action.productId):null,pct=action?.pct||0;
 const read=!!p&&draw(w.seed,'read-campaign',day,u.index)<.7/(1+t.fatigue*.15),rel=p?itemRelevance(t,p):0;
 if(p)campaignContact(t,{read,relevance:rel,response:1,productKey:p.catalog_item_id,day});
 if(draw(w.seed,'v3-visit',day,u.index)>=lifecycleVisitProbability(t,read,rel,1))return {platform:p?-2:0,product:null,gross:0};
 const choices=w.products.filter(p=>p.category===t.needTopic),pool=choices.length?choices:w.products,viewed=pool[Math.floor(draw(w.seed,'organic-discovery-item',day,u.index)*pool.length)];
 if(draw(w.seed,'organic-discovery',day,u.index)<.35)t.awareness[viewed.catalog_item_id]=day+45;
 const g=key=>-Math.log(-Math.log(Math.max(1e-8,draw(w.seed,'v3-choice',day,u.index,key)))),options=[{type:'none',utility:.7+g('none')}];
 const refs=w.products.filter(p=>p.merchant_id===w.merchants[0].merchant_id&&p.category===t.needTopic),external=refs[Math.floor(draw(w.seed,'external-item',day,u.index)*Math.max(1,refs.length))];
 if(external&&external.price_cents<=u.wallet&&t.need>.25)options.push({type:'external',utility:.55+1.6*itemRelevance(t,external)+t.need-external.price_cents/Math.max(1000,u.wallet)*t.priceSensitivity+g('external')});
 for(const item of w.products){if((t.awareness[item.catalog_item_id]??-1)<day||w.inventory[item.product_id]<=0||t.need<.25)continue;
  const isOffer=read&&p?.product_id===item.product_id,off=isOffer?pct:0,shelf=shelfPrice(w,item),price=shelf-Math.round(shelf*off/100);if(price>u.wallet)continue;
  const relationship=t.state==='ACTIVE'?.25+t.quality*.3:0;
  options.push({type:'partner',item,price,off,utility:1.6*itemRelevance(t,item)+t.need+relationship-price/Math.max(1000,u.wallet)*t.priceSensitivity+(isOffer?off/100*1.8:0)-t.fatigue*.03+g(item.product_id.slice(w.runId.length))});
 }
 const choice=options.sort((a,b)=>b.utility-a.utility)[0];if(choice.type!=='partner')return {platform:p?-2:0,product:null,gross:0};
 const merchant=w.merchants.findIndex(m=>m.merchant_id===choice.item.merchant_id),returned=draw(w.seed,'v3-refund',day,u.index)<.035+(w.scenario==='returns_wave'&&day>=35&&merchant===1?.18:0),support=Math.round(Math.round(shelfPrice(w,choice.item)*choice.off/100)*.2);
 return {platform:(returned?0:fee(choice.price))-processing(choice.price)-(p?2:0)-support,product:choice.item.product_id,gross:choice.price};
}
function cashBound(w){
 // Relax every marketing, inventory and purchase-preference constraint. Net
 // retained expenditure cannot exceed current wallet cash + future net income
 // + outstanding warmup refunds. Post-warmup refunds do not create net cash.
 const days=70,refunds=sum(w.pending.filter(p=>p.history&&p.refund&&!p.refunded),p=>w.behavior.orders[p.orderIndex].gross);
 const outsideRefunds=sum(w.behavior.external.filter(o=>o.day<30&&!o.refunded&&o.refundDay!==null),o=>o.gross);
 let resources=sum(w.customers,u=>u.wallet)+refunds+outsideRefunds;
 for(let day=30;day<100;day++)if(day%7===0)for(const t of w.behavior.private){const u=w.customers[w.behavior.private.indexOf(t)],income=Math.round(t.weeklyIncome*(w.scenario==='budget_squeeze'&&day>=35?.65:1)),expense=Math.round(t.weeklyIncome*(.25+.25*draw(w.seed,'household-needs',day,u.index)));resources+=income-expense;}
 // Every retained order is at least the cheapest10%-discounted shelf price.
 // Rate-rounding residual is at most1 cent/order. Fee minus processing <=
 // 2.29% of retained spend +30 cents/order. Refunded orders only subtract cost.
 const minPaid=Math.min(...w.products.map(p=>Math.floor(p.price_cents*(w.scenario==='rival_sale'?.95:1)*.9))),maxOrders=Math.min(w.customers.length*days,Math.floor(resources/minPaid));
 return {cashResourceCents:resources,warmupMerchantRefundsCents:refunds,warmupOutsideRefundsCents:outsideRefunds,minPaidCents:minPaid,maxRetainedOrders:maxOrders,netUpperCents:Math.ceil(.0229*resources+30*maxOrders),scope:'Relaxed resource upper bound, not an attainable policy. Excludes outreach/subsidy/LLM costs and assumes all spend stays on platform.'};
}
function run(c,kind){
 const w=createWorld({...SETTINGS,...c,runId:'HEADROOM-'+c.seed,catalog:authoredCatalog()});while(w.tick<30)stepWorld(w);const bound=cashBound(w);let expected=new Map(),checks=0;
 while(w.tick<w.totalTicks){let choose=()=>null;if(w.tick<90){
  if(kind==='fixed'){if((w.tick-30)%14===0)train(w);choose=compilePolicy(w,'weekly_featured');}
  else if(kind==='truth_relevance')choose=input=>{const u=w.customers[input.customer.index],t=w.behavior.private[u.index],candidates=w.products.filter(p=>allowedOffer(w,p,0));candidates.sort((a,b)=>itemRelevance(t,b)-itemRelevance(t,a)||b.price_cents-a.price_cents);return candidates[0]?{productId:candidates[0].product_id,pct:0,reason:'EVALUATOR_ONLY_PRIVATE_TASTE'}:null;};
  else if(kind==='clairvoyant_greedy')choose=input=>{const u=w.customers[input.customer.index];let best=null,result=predict(w,u,null);
   for(const p of input.products)for(const pct of p.allowedPct.filter(n=>n<=5)){if(Math.round(p.priceCents*pct/100)+2>input.remainingCents)continue;const a={productId:p.productId,pct,reason:'EVALUATOR_ONLY_PRIVATE_STATE_AND_FUTURE_DRAWS'},r=predict(w,u,a);if(r.platform>result.platform){best=a;result=r;}}
   expected.set(u.customer_id,result);return best;};
 }
 const batch=stepWorld(w,choose);
 for(const [id,e] of expected){const o=batch.rows.orders.find(o=>o.customer_id===id),item=o?batch.rows.order_items.find(i=>i.order_id===o.order_id):null;if((item?.product_id||null)!==e.product||(o?.total_cents||0)!==e.gross)throw Error('ORACLE_PREDICTOR_MISMATCH');checks++;}expected.clear();
 }
 const result=outcome(w);return {...result,kind,platformUSD:result.platformCents/100,merchantUSD:result.merchantCents/100,bound,oraclePredictionChecks:checks,scope:kind==='fixed'?'Fixed deployed baseline':'EVALUATOR_ONLY_NOT_A_VALID_AGENT_RESULT'};
}
await mkdir('docs/commerce-headroom',{recursive:true});
const result={createdAt:new Date().toISOString(),cases:[],sources:Object.fromEntries(await Promise.all(['scripts/behavior-v4/engine.mjs','scripts/behavior-v4/catalog.mjs','scripts/commerce-design-v2/headroom.mjs'].map(async f=>[f,hash(await readFile(f,'utf8'))]))),warning:'All seeds are development seeds from the previous experiment. No new held-out seeds or model calls. Truth-informed diagnostic policies are not attainable-information bounds or deployable agent results.'};
for(const c of cases){const rows=['fixed','truth_relevance','clairvoyant_greedy'].map(k=>run(c,k));result.cases.push({...c,rows});console.log(JSON.stringify({case:c,results:rows.map(r=>({kind:r.kind,net:r.platformUSD,ratio:r.platformUSD/rows[0].platformUSD,cashUpper:r.bound.netUpperCents/100,predictionChecks:r.oraclePredictionChecks}))}));await writeFile('docs/commerce-headroom/headroom.json',JSON.stringify(result,null,2)+'\n');}
