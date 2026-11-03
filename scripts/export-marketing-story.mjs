// Export a presentation of an existing run. Read-only data access; no inference.
import {DatabaseSync} from 'node:sqlite';
import {mkdir,writeFile} from 'node:fs/promises';
const runId=process.argv[2]||'GARDEN-LAB-81396892c0cc6928';
if(!/^GARDEN-LAB-[a-f0-9]{16}$/.test(runId))throw Error('Invalid recorded run');
const db=new DatabaseSync('.local/market-metro.sqlite',{readOnly:true});
const state=await(await fetch('http://127.0.0.1:4173/api/market/policy-lab/'+runId)).json();
const base=await(await fetch('http://127.0.0.1:4173/api/market/run?id='+runId)).json();
const rows=state.checkpoints.filter(c=>c.review_no===1&&c.status==='COMPLETED');
const role=name=>rows.find(c=>c.role===name),growth=role('Growth investigator'),science=role('Experiment scientist'),review=role('Outcome reviewer'),publish=role('Policy executor'),model=state.models.find(m=>m.cutoff_day===30);
const purchase=db.prepare(`SELECT c.coupon_id,c.customer_id,c.discount_pct,c.issued_day,o.order_id,o.total_cents,o.event_date,o.merchant_id,m.name AS merchant_name,p.title,p.channel3_product_id,p.source AS catalog_source,t.transaction_id,t.fee_cents FROM coupon_redemptions cr JOIN coupons c USING(coupon_id) JOIN orders o USING(order_id) JOIN merchants m ON m.merchant_id=o.merchant_id JOIN order_items oi USING(order_id) JOIN products p USING(product_id) JOIN transactions t USING(order_id) WHERE cr.run_id=? AND c.issued_day>=? AND c.issued_day<? ORDER BY c.issued_day,cr.redemption_id LIMIT 1`).get(runId,publish.output.policy.effectiveDay,64);
if(!purchase)throw Error('No recorded redemption in the first campaign');
purchase.customerName=base.customers.find(c=>c.id===purchase.customer_id)?.name;
const days=[29,growth.day,model.day,publish.output.policy.effectiveDay,purchase.issued_day,purchase.issued_day];
const frames=days.map(day=>{
 const f=structuredClone(base),actions=db.prepare('SELECT * FROM policy_lab_actions WHERE run_id=? AND day<=? ORDER BY day,action_id').all(runId,day);
 const orders=db.prepare('SELECT o.*,a.day FROM orders o JOIN policy_lab_actions a USING(order_id) WHERE o.run_id=? AND a.day<=?').all(runId,day),byOrder=new Map(orders.map(o=>[o.order_id,o]));
 f.tick=day;f.simTime=null;f.activities=[];f.recentActivity=[];f.featuredIds=[purchase.customer_id];f.stats.orders=orders.length;f.stats.revenueCents=orders.reduce((n,o)=>n+o.total_cents,0);
 f.customers=f.customers.map(c=>{const a=actions.filter(a=>a.customer_id===c.id),last=a.at(-1),sales=a.filter(a=>a.order_id),latest=sales.at(-1);return {...c,purchases:sales.length,offers:a.filter(a=>a.selected_action!=='none').length,grossCents:sales.reduce((n,a)=>n+byOrder.get(a.order_id).total_cents,0),lastAction:last?.order_id?'purchase':last?.selected_action!=='none'?'coupon':'home',lastDay:day,lastMerchant:last?.target_merchant_id||latest?.actual_merchant_id||null,coupon:null,history:[]};});
 for(const m of f.merchants){const os=orders.filter(o=>o.merchant_id===m.merchant_id);m.sold=os.length;m.revenue=os.reduce((n,o)=>n+o.total_cents,0);m.stock=db.prepare('SELECT SUM(p.initial_stock+COALESCE((SELECT SUM(i.quantity) FROM inventory_movements i WHERE i.product_id=p.product_id AND i.event_ts<?),0)) n FROM products p WHERE p.run_id=? AND p.merchant_id=?').get(new Date(Date.parse(base.startedAt)+(day+1)*86400000).toISOString(),runId,m.merchant_id).n;}
 return f;
});
const story={runId,recorded:true,exportedAt:new Date().toISOString(),growth,science,review,publish,model,purchase,frames,referenceReceipt:state.referenceReceipt,
 summary:{reviews:state.mesh.handoffs.length,modelFits:state.models.length,modelCalls:state.modelCalls,coupons:state.branches[0].offers,redemptions:state.branches[0].redemptions,marketPurchases:state.branches[0].purchases,modelUSD:state.modelCostMicros/1e6},
 disclosure:'Recorded Gemini decisions and stored simulated shopper events. Playback makes no model or payment calls. The PayPal reference is an earlier verified sandbox transaction, not this shopper purchase.'};
db.close();await mkdir('demo/data',{recursive:true});await writeFile('demo/data/marketing-story.json',JSON.stringify(story)+'\n');console.log(JSON.stringify({runId,steps:frames.length,shopper:purchase.customerName,day:purchase.issued_day,amountCents:purchase.total_cents}));
