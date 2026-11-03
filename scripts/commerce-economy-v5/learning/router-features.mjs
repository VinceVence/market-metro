import {publicInterest} from './experts.mjs';
const CATEGORIES=['Stationery','Electronics','Furniture','Office bundles'];
export const ROUTER_FEATURES=['purchases','recency','returns','visits28','contacts28','paidMean','paidMax','paidMin','paidStd','intentAge',...CATEGORIES.map(c=>'organicInterest:'+c),...CATEGORIES.map(c=>'purchaseShare:'+c),...CATEGORIES.map(c=>'recentIntent:'+c),...['0','1','2'].map(c=>'merchantShare:'+c),'uniqueSeen','uniqueContacted'];
export function routerDataset(w){
 const interest=publicInterest(w),byId=new Map(w.products.map(p=>[p.product_id,p]));
 return w.customers.map(u=>{
  const orders=w.behavior.orders.filter(o=>o.customerId===u.customer_id&&o.day<w.tick),paid=orders.map(o=>o.gross),mean=paid.reduce((s,x)=>s+x,0)/Math.max(1,paid.length),counts=CATEGORIES.map(c=>orders.filter(o=>byId.get(o.productId).category===c).length),h=u.history.filter(r=>r.day<w.tick),cats=interest.get(u.customer_id)?.categories||{},total=Object.values(cats).reduce((s,x)=>s+x,0),contacted=new Set(w.behavior.actions.filter(a=>a.customer_id===u.customer_id&&a.day<w.tick&&a.product_id).map(a=>byId.get(a.product_id).catalog_item_id)),age=u.observedIntent?Math.min(30,w.tick-u.observedIntent.day):30;
  const x=[orders.length/10,Math.min(60,w.tick-u.lastPurchase)/60,u.returnCount/Math.max(1,orders.length),h.reduce((s,r)=>s+r.visited,0)/28,h.reduce((s,r)=>s+r.offered,0)/28,mean/20000,(paid.length?Math.max(...paid):0)/20000,(paid.length?Math.min(...paid):0)/20000,Math.sqrt(paid.reduce((s,v)=>s+(v-mean)**2,0)/Math.max(1,paid.length))/20000,age/30,...CATEGORIES.map(c=>(cats[c]||0)/Math.max(1,total)),...counts.map(n=>n/Math.max(1,orders.length)),...CATEGORIES.map(c=>Number(age<=14&&u.observedIntent?.topic===c)),...[0,1,2].map(m=>orders.filter(o=>o.merchantIndex===m).length/Math.max(1,orders.length)),Object.keys(interest.get(u.customer_id)?.seen||{}).length/16,contacted.size/16];
  if(x.length!==ROUTER_FEATURES.length||x.some(v=>!Number.isFinite(v)))throw Error('INVALID_ROUTER_FEATURE');return {index:u.index,x};
 });
}
