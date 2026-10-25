import {sha} from '../research-lab/data.mjs';
import {RECIPES} from './policies.mjs';

// All controllers receive this exact shared observation packet. A separate
// no-outreach monitor generates it; evaluated policy outcomes stay sealed.
export function marketEvidence(monitor,stockHistory){
  const day=monitor.world.tick,actions=monitor.actions.filter(a=>a.day<day),mature=actions.filter(a=>a.matures_day<=day&&Number.isSafeInteger(a.reward_cents));
  const recent=actions.filter(a=>a.day>=day-7),previous=actions.filter(a=>a.day>=day-14&&a.day<day-7);
  const orderActions=new Map(actions.filter(a=>a.order_id).map(a=>[a.order_id,a]));
  if(orderActions.size!==actions.filter(a=>a.order_id).length)throw Error('DUPLICATED_ORDER_GRAIN');
  const merchants=monitor.evidence().merchants.map(m=>{
    const os=[...monitor.orders.values()].filter(o=>o.merchant_id===m.merchantId),window=os.filter(o=>{const a=orderActions.get(o.order_id);return a.matures_day<=day&&a.day>=day-28;}),last=os.filter(o=>orderActions.get(o.order_id).day>=day-7);
    const returns=window.filter(o=>o.refund>0).length,markdownOrders=last.filter(o=>o.channel==='direct'&&o.discount_cents>0);
    return {index:m.index,name:m.name,stock:m.stock,maxOfferPct:m.maxOfferPct,matureOrders:window.length,matureReturns:returns,returnRate:window.length?returns/window.length:null,retainedCents:window.reduce((n,o)=>n+o.total_cents-o.refund,0),recentOrders:last.length,directMarkdownOrders:markdownOrders.length,directMarkdownPct:markdownOrders.length?100*markdownOrders.reduce((n,o)=>n+o.discount_cents/o.subtotal_cents,0)/markdownOrders.length:0,
      minStockLast14:Math.min(m.stock,...stockHistory.filter(s=>s.day>=day-14).map(s=>s.stocks[m.index]))};
  });
  const active=monitor.world.customers.filter(u=>u.purchases>0&&day-u.lastPurchase<7).length,lapsed=monitor.world.customers.filter(u=>u.purchases>0&&day-u.lastPurchase>=7).length;
  const recentOrders=recent.filter(a=>a.order_id).map(a=>monitor.orders.get(a.order_id)),previousOrders=previous.filter(a=>a.order_id).map(a=>monitor.orders.get(a.order_id));
  const packet={asOfDay:day,customers:100,recentPurchases:recentOrders.length,previousPurchases:previousOrders.length,recentPremiumPurchases:recentOrders.filter(o=>o.subtotal_cents>=8000).length,previousPremiumPurchases:previousOrders.filter(o=>o.subtotal_cents>=8000).length,activeBuyers:active,lapsedBuyers:lapsed,matureRows:mature.length,immatureRows:actions.length-mature.length,merchants,
    productBands:[...new Set(monitor.world.products.map(p=>p.price_cents))].sort((a,b)=>a-b).map(priceCents=>({priceCents,currency:'USD',catalogSource:'CACHED_CHANNEL3'})),
    definitions:{returns:'Mature returned orders divided by the SAME mature order population; recent windows exclude unresolved outcomes.',units:'All amounts ending Cents are USD cents. Return rates are fractions. Markdown percentages are percentage points.',feedback:'Shared no-outreach observation stream, identical for all evaluated controllers. No candidate-policy or final comparison outcomes are included.'}};
  return {evidenceId:'E-'+sha(packet).slice(0,20),...packet};
}
export function inferredRegime(e){
  if(e.merchants.some(m=>m.matureOrders>=12&&m.returnRate>=.10))return 'returns_wave';
  if(e.merchants.some(m=>m.minStockLast14<5))return 'supply_delay';
  if(e.merchants.some(m=>m.directMarkdownOrders>=5&&m.directMarkdownPct>=2))return 'rival_sale';
  if(e.previousPurchases>=30&&(e.recentPurchases/e.previousPurchases<.85||e.previousPremiumPurchases>=10&&e.recentPremiumPurchases/e.previousPremiumPurchases<.75))return 'budget_squeeze';
  return 'steady';
}
export function recordStocks(monitor,list){list.push({day:monitor.world.tick,stocks:monitor.world.merchants.map(m=>m.stock)});}
export function policyCards(ranking){
  return ranking.map(p=>({choice:p.choice,developmentMeanUSD:p.mean,developmentLowerUSD:p.low,developmentUpperUSD:p.high,meanRecommendations:p.recommendations,meanMerchantUSD:p.merchant?.mean,recipe:RECIPES.find(r=>r.id===p.choice.recipeId)?.description,modelKind:p.choice.recipeId.startsWith('ridge_')?'FITTED_LOCAL_RIDGE':'AUTHORED_OBSERVABLE_TARGETING_RULE'}));
}
