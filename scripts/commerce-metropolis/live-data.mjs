import {key,stamp} from '../commerce-growth/autonomy/live-data.mjs';
import {indexWorld} from './indexes.mjs';
import {balances} from './balances.mjs';
import {settledPlatformNet} from '../commerce-deadlines/evaluate.mjs';
const sum=(rows,f)=>rows.reduce((n,r)=>n+f(r),0);

export function projection(w,s,{fullCustomers=false}={}){
  const sold=new Map();for(const o of w.orders)for(const i of o.items)sold.set(i.merchantId,(sold.get(i.merchantId)||0)+i.quantity);
  const index=indexWorld(w),sample=fullCustomers?w.people:w.people.filter((p,i)=>i%Math.max(1,Math.floor(w.people.length/384))===0).slice(0,384);
  const merchants=w.merchants.map((m,i)=>({merchant_id:key(s.runId,m.id),run_id:s.runId,name:m.name,district:'Shared market',category:m.category,
    position:i,starting_cash_cents:m.startingCashCents,source:'SIMULATED_MERCHANT',paypal_account_mapping:'SINGLE_CONNECTED_SANDBOX_STORE',color:'#58a6ff',
    sold:sold.get(m.id)||0,stock:sum(index.productsByMerchant.get(m.id)||[],p=>p.stock)}));
  const products=w.products.map(p=>({product_id:key(s.runId,p.id),run_id:s.runId,merchant_id:key(s.runId,p.merchantId),channel3_product_id:null,catalog_item_id:p.catalogId,
    title:p.title,category:p.category,currency:'USD',price_cents:p.priceCents,cost_cents:p.costCents,source:'AUTHORED_SIMULATION',source_url:'',image_url:'',initial_stock:p.initialStock,stock:p.stock,cost_assumption:w.version}));
  const customers=sample.map(p=>({customer_id:key(s.runId,p.id),run_id:s.runId,segment:'Simulated shopper',budget_cents:null,source:'SYNTHETIC',simulationId:p.id,index:p.index,name:'Shopper '+(p.index+1)}));
  return {runId:s.runId,seed:w.seed,kind:'LEARNING_MARKET_V2',commerceWorkflow:true,workflowId:s.id,workflowActor:'autonomous_commerce',startedAt:'2026-10-01T00:00:00.000Z',
    tick:w.day,totalTicks:w.totalDays,status:s.status,merchants,products,customers,customerCount:w.people.length,
    campaigns:[{campaign_id:key(s.runId,'OUTREACH'),run_id:s.runId,merchant_id:null,name:'Shared-market recommendations',channel:'in_game',objective:'FUNDED_RETAINED_PURCHASES',daily_budget_cents:50*w.settings.scale,spend_cents:0,status:'ACTIVE',policy:'FIXED_UNTIL_AGENT_PUBLICATION',creative:'Observed shopping interest'}],sandboxSampleLimit:s.sandbox?1:0};
}

export function marketFrame(w,s,team){
  const p=projection(w,s),index=indexWorld(w),day=w.day-1,activities=[],latest=new Map();
  const merchantFor=id=>(index.productsByCatalog.get(id)||[]).find(p=>p.stock>0)?.merchantId??w.merchants[0].id;
  const add=a=>{activities.push(a);latest.set(a.customerId,a);};
  const contacts=w.growth.contacts.filter(c=>c.day===day),signals=w.growth.signals.filter(c=>c.day===day);
  for(const c of contacts)add({type:'recommendation',customerId:key(s.runId,c.customerId),merchantId:key(s.runId,merchantFor(c.catalogId)),product:w.catalog.find(p=>p.id===c.catalogId)?.title||'Shopping needs'});
  for(const signal of signals)add({type:'visit',customerId:key(s.runId,signal.customerId),merchantId:key(s.runId,merchantFor(signal.catalogId))});
  for(const o of w.orders.filter(o=>o.day===day))add({type:'purchase',customerId:key(s.runId,o.customerId),merchantId:key(s.runId,o.merchants[0].id),orderId:key(s.runId,o.id),amount:o.grossCents,product:o.items.map(i=>index.products.get(i.productId).title).join(', ')});
  for(const d of w.deliveries.filter(d=>d.day===day)){const o=index.orders.get(d.orderId);add({type:'delivery',customerId:key(s.runId,o.customerId),merchantId:key(s.runId,o.merchants[0].id)});}
  const scored=w.orders.filter(o=>o.day>=30),retained=scored.filter(o=>!['SETTLED','PENDING_FUNDS'].includes(o.refundStatus));
  const agentDays=new Set(w.decisions.filter(d=>d.agentCampaign).map(d=>d.day));
  const requests=index.requests,contactMap=new Map(w.growth.contacts.map(c=>[c.id,c]));
  const recommendationPurchases=retained.filter(o=>{const r=requests.get(o.requestId);return r.recommendedCatalogId&&o.items.some(i=>index.products.get(i.productId).catalogId===r.recommendedCatalogId);}).length;
  const net=s.opening?settledPlatformNet(s.opening,balances(w)):0;
  return {...p,seed:undefined,autonomy:true,merchantCount:w.merchants.length,marketVersion:w.version,visibleCustomerLimit:96,customerCount:w.people.length,
    eventTs:stamp(Math.max(0,day)),stats:{orders:w.orders.length,units:sum(w.orders,o=>sum(o.items,i=>i.quantity)),revenueCents:sum(w.orders,o=>o.grossCents),refundsCents:sum(w.orders,o=>o.refundCents),feesCents:sum(w.orders,o=>o.feeCents),spendCents:w.growth.outreachCents,deliveries:w.deliveries.length,impressions:w.growth.signals.length},activities,
    customers:p.customers.map(u=>{const a=latest.get(u.customer_id),orders=index.ordersByCustomer.get(u.simulationId)||[];return {id:u.customer_id,index:u.index,name:u.name,segment:u.segment,purchases:orders.length,offers:index.contactsByCustomer.get(u.simulationId)?.length||0,lastAction:a?.type==='purchase'?'purchase':a?.type==='visit'||a?.type==='recommendation'?'browse':'home',lastMerchant:a?.merchantId||null,lastDay:day,grossCents:sum(orders,o=>o.grossCents)};}),
    behavior:{day:w.day,outcome:{recommendations:w.growth.contacts.filter(c=>c.kind==='recommend').length,fundedResponses:w.growth.contacts.filter(c=>c.authorized).length,calibrationUpdates:0,
      agentCaptures:scored.filter(o=>agentDays.has(contactMap.get(requests.get(o.requestId).contactId)?.day)).length,coupons:0,redemptions:0,purchases:scored.length,
      retainedPurchases:retained.length,recommendationPurchases,retainedCents:sum(retained,o=>o.grossCents),platformCents:net,modelCostCents:(team?.modelCostUSD||0)*100}},
    disclosure:'One shared market. All shoppers transact; a representative crowd is rendered. Native Sandbox receipts are separate.'};
}

export function changedOrders(w,cursor={}){
  const ids=new Set(w.orders.slice(cursor.orders||0).map(o=>o.id));
  for(const d of w.deliveries.slice(cursor.deliveries||0))ids.add(d.orderId);
  for(const e of w.events.slice(cursor.events||0))if(e.type==='REFUNDED')ids.add(e.captureId);
  const index=indexWorld(w);return [...ids].map(id=>index.orders.get(id));
}
