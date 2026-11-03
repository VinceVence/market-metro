// Plumbing smoke only: no agent performance claim or native PayPal operation.
import {writeFile,mkdir} from 'node:fs/promises';
import {createDeadlineWorld,beginDeadlineDay,endDeadlineDay,quoteBasket,reserveBasket,captureReservation,observeDeadlineWorld,assertDeadlineIntegrity} from './environment.mjs';
const w=createDeadlineWorld({seed:901004,scenario:'ordinary'});beginDeadlineDay(w);
const request=w.requests.find(r=>r.status==='AUTHORIZED');if(!request)throw Error('SMOKE_REQUEST_MISSING');
const items=request.lines.map(l=>({lineId:l.id,productId:w.products.find(p=>p.merchantId==='MERCHANT-1'&&p.catalogId===l.acceptableCatalogIds[0]).id,quantity:l.quantity})),quote=quoteBasket(w,request.id,items),reservation=reserveBasket(w,{requestId:request.id,items,key:'smoke-reserve'}),receipt=captureReservation(w,{requestId:request.id,key:'smoke-capture'});
while(w.day<16){endDeadlineDay(w);beginDeadlineDay(w);}assertDeadlineIntegrity(w);
const order=w.orders.find(o=>o.id===receipt.captureId),trace={scope:'Scripted accounting smoke only. Supplier procurement and the decision benchmark are not yet implemented. This is not an agent result or a PayPal Sandbox receipt.',request,quote,reservation,receipt,order,delivery:w.deliveries.find(d=>d.orderId===order.id),ledger:w.ledger.filter(e=>e.reference===request.id||e.reference===order.id),liabilities:w.liabilities.filter(l=>l.orderId===order.id),source:'SIMULATED_NOT_PAYPAL_RECEIPT',newPaidCalls:0,integrity:true,privateFutureOutcomesExposed:false};
await mkdir('docs/commerce-deadlines/smoke-1',{recursive:true});await writeFile('docs/commerce-deadlines/smoke-1/trace.json',JSON.stringify(trace,null,2)+'\n');await writeFile('docs/commerce-deadlines/smoke-1/observation.json',JSON.stringify(observeDeadlineWorld(w),null,2)+'\n');
console.log(JSON.stringify({requestId:request.id,grossCents:receipt.grossCents,delivery:trace.delivery,refundStatus:order.refundStatus,source:receipt.source,integrity:true,newPaidCalls:0}));
