// Observed-only model interface. No seed, customer identifier, latent taste,
// true need, wallet, future refund or future choice draw enters a feature.
import {shelfPrice} from '../engine.mjs';
export const FEATURES=['recency','purchases7','purchases28','visits7','spend7','spend28','meanPaid','upperPaid','price','priceVsUpper','categoryShare','skuSeen','intentMatch','freshIntent','intentAge','familiarMerchant','observedReturns','contacts7','stock','unitMargin','unitPaymentContribution','payday','categoryStationery','categoryElectronics','categoryFurniture','categoryBundles'];
const sum=(xs,f)=>xs.reduce((s,x)=>s+f(x),0);
export function observedFeatures(w,input,p){
 const u=input.customer,h=u.history.filter(r=>r.day<input.day),h7=h.filter(r=>r.day>=input.day-7),paid=h.filter(r=>r.purchased).map(r=>r.gross_cents).sort((a,b)=>a-b),mean=paid.length?sum(paid,n=>n)/paid.length:0,upper=paid.length?paid[Math.floor((paid.length-1)*.75)]:0;
 const product=w.products.find(x=>x.product_id===p.productId),price=shelfPrice(w,product),totalViews=sum(Object.values(u.seenCategories),x=>x),age=u.observedIntent?Math.min(30,input.day-u.observedIntent.day):30,match=u.observedIntent?.topic===p.category&&age<=14;
 const fee=Math.round(price*.0349)+49,processing=Math.round(price*.012)+20;
 return [Math.min(60,input.day-u.lastPurchase)/60,sum(h7,r=>r.purchased)/10,sum(h,r=>r.purchased)/20,sum(h7,r=>r.visited)/7,sum(h7,r=>r.gross_cents)/20000,sum(h,r=>r.gross_cents)/60000,mean/20000,upper/20000,price/20000,upper?Math.min(4,price/upper)/4:1,(u.seenCategories[p.category]||0)/Math.max(1,totalViews),Number((u.seenItems[p.productId]||0)>0),Number(match),Number(match&&age<=2),age/30,Number(u.lastMerchantIndex===p.merchantIndex),u.returnCount/Math.max(5,u.purchases),sum(h7,r=>r.offered)/7,Math.min(20,p.stock)/20,(price-fee-product.cost_cents-350)/Math.max(1,price),(fee-processing)/1000,Number(input.day%7===0),...['Stationery','Electronics','Furniture','Office bundles'].map(c=>Number(p.category===c))];
}
