import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDeadlineWorld,beginDeadlineDay,endDeadlineDay,observeDeadlineWorld,assertDeadlineIntegrity,transfer,releaseAuthorization,reserveBasket,captureReservation,quoteBasket} from '../scripts/commerce-deadlines/environment.mjs';
import {placeProcurement} from '../scripts/commerce-deadlines/suppliers.mjs';
import {settledPlatformNet} from '../scripts/commerce-deadlines/evaluate.mjs';
import {openAllocator} from '../scripts/commerce-deadlines/solver.mjs';

test('deadline requests and funding reproduce across policy-independent worlds',()=>{
 const a=createDeadlineWorld({seed:901001,scenario:'mixed_deadlines'}),b=createDeadlineWorld({seed:901001,scenario:'mixed_deadlines'});
 for(let day=0;day<45;day++){beginDeadlineDay(a);beginDeadlineDay(b);assert.deepEqual(a.requests,b.requests);assert.deepEqual(a.accounts,b.accounts);endDeadlineDay(a);endDeadlineDay(b);}
 assert.ok(a.requests.length>0);assert.ok(a.incomeCents>0);assertDeadlineIntegrity(a);assertDeadlineIntegrity(b);
 const publicState=observeDeadlineWorld(a);assert.ok(!Object.hasOwn(publicState,'seed'));assert.ok(!Object.hasOwn(publicState,'people'));assert.ok(!Object.hasOwn(publicState,'accounts'));assert.ok(publicState.requests.every(r=>r.createdDay<=publicState.day));
});
test('authorizations hold existing money and cannot fund another shopper',()=>{
 const w=createDeadlineWorld({seed:901002,scenario:'scarce_stock'});beginDeadlineDay(w);const r=w.requests.find(r=>r.status==='AUTHORIZED');assert.ok(r);
 const total=Object.values(w.accounts).reduce((s,c)=>s+c,0),before=w.accounts[r.customerId];assert.equal(w.accounts[r.authorizationId],r.budgetCents);
 releaseAuthorization(w,r,'Test cancellation');r.status='CANCELLED';assert.equal(w.accounts[r.customerId],before+r.budgetCents);assert.equal(Object.values(w.accounts).reduce((s,c)=>s+c,0),total);
 assert.throws(()=>transfer(w,r.customerId,'merchant-fake',w.accounts[r.customerId]+1,{kind:'UNFUNDED_PAYMENT'}),/INSUFFICIENT_FUNDS/);
 assert.throws(()=>transfer(w,r.customerId,'platform',-1,{kind:'INVALID'}),/INVALID_LEDGER_TRANSFER/);assertDeadlineIntegrity(w);
});

test('a funded basket settles once, conserves stock, and hides future refunds',()=>{
 const w=createDeadlineWorld({seed:901004,scenario:'ordinary'});beginDeadlineDay(w);const request=w.requests.find(r=>r.status==='AUTHORIZED');assert.ok(request);
 const items=request.lines.map(l=>({lineId:l.id,productId:w.products.find(p=>p.merchantId==='MERCHANT-1'&&p.catalogId===l.acceptableCatalogIds[0]).id,quantity:l.quantity}));
 const quote=quoteBasket(w,request.id,items),cash=Object.values(w.accounts).reduce((s,n)=>s+n,0),reservation=reserveBasket(w,{requestId:request.id,items,key:'reserve-first'});assert.equal(reservation.grossCents,quote.grossCents);
 const receipt=captureReservation(w,{requestId:request.id,key:'capture-first'}),entries=w.ledger.length;assert.equal(receipt.source,'SIMULATED_NOT_PAYPAL_RECEIPT');assert.equal(w.accounts.platform,quote.feeCents-quote.processingCents);
 assert.deepEqual(captureReservation(w,{requestId:request.id,key:'capture-first'}),receipt);assert.equal(w.ledger.length,entries);assert.equal(Object.values(w.accounts).reduce((s,n)=>s+n,0),cash);
 assert.throws(()=>captureReservation(w,{requestId:'different-request',key:'capture-first'}),/IDEMPOTENCY_KEY_REUSE/);
 endDeadlineDay(w);beginDeadlineDay(w);const observed=observeDeadlineWorld(w);assert.ok(observed.pastOrders.length);assert.ok(!JSON.stringify(observed).includes('willRefund'));assert.ok(!JSON.stringify(observed).includes('refundDueDay'));assert.ok(!Object.hasOwn(observed,'privateOrderOutcomes'));assertDeadlineIntegrity(w);
});

test('competing reservations cannot sell the same unit or alter quoted prices',()=>{
 const w=createDeadlineWorld({seed:901005,scenario:'scarce_stock'});beginDeadlineDay(w);const p=w.products.find(p=>p.merchantId==='MERCHANT-1'&&p.catalogId==='MM-PAPER-01');
 const make=(id,customerId)=>({id,customerId,createdDay:0,deadlineDay:8,budgetCents:1900,lines:[{id:'LINE-0',acceptableCatalogIds:[p.catalogId],quantity:1}],status:'REQUESTED',authorizationId:null,allocatedItems:[]});
 // Distinct funded buyers with no generated request in this fixture.
 const buyers=w.people.filter(u=>!w.requests.some(r=>r.customerId===u.id)).slice(0,2);w.requests.push(make('TEST-A',buyers[0].id),make('TEST-B',buyers[1].id));const items=[{lineId:'LINE-0',productId:p.id,quantity:1}];
 reserveBasket(w,{requestId:'TEST-A',items,key:'reserve-a'});const before=w.accounts[buyers[1].id];assert.throws(()=>reserveBasket(w,{requestId:'TEST-B',items,key:'reserve-b'}),/INSUFFICIENT_STOCK/);assert.equal(w.accounts[buyers[1].id],before);assert.equal(p.stock,1);assert.equal(p.reserved,1);
 assert.throws(()=>quoteBasket(w,'TEST-B',[{...items[0],priceCents:1}]),/INVALID_BASKET_FIELDS/);
 while(w.day<3){endDeadlineDay(w);beginDeadlineDay(w);}assert.equal(p.reserved,0);assert.throws(()=>captureReservation(w,{requestId:'TEST-A',key:'late-capture'}),/NO_VALID_RESERVATION/);assertDeadlineIntegrity(w);
});

test('a refund returns buyer funds and records an unfunded fee rebate as a liability',()=>{
 const w=createDeadlineWorld({seed:901004,scenario:'ordinary'});beginDeadlineDay(w);const r=w.requests.find(r=>r.status==='AUTHORIZED');const items=r.lines.map(l=>({lineId:l.id,productId:w.products.find(p=>p.merchantId==='MERCHANT-1'&&p.catalogId===l.acceptableCatalogIds[0]).id,quantity:l.quantity}));
 reserveBasket(w,{requestId:r.id,items,key:'refund-reserve'});const receipt=captureReservation(w,{requestId:r.id,key:'refund-capture'}),order=w.orders[0];w.privateOrderOutcomes[receipt.captureId]={willRefund:true,refundDueDay:5};
 while(w.day<5){endDeadlineDay(w);beginDeadlineDay(w);}
 assert.equal(order.refundStatus,'SETTLED');assert.equal(order.refundCents,order.grossCents);assert.equal(r.status,'REFUNDED');assert.equal(w.ledger.filter(e=>e.kind==='MERCHANT_REFUND'&&e.reference===order.id).reduce((s,e)=>s+e.cents,0),order.grossCents);
 const due=w.liabilities.filter(l=>l.status==='FEE_REBATE_DUE').reduce((s,l)=>s+l.amountCents,0);assert.equal(due,order.feeCents);assert.equal(w.accounts.platform-due,-order.processingCents);assertDeadlineIntegrity(w);
 const restored=JSON.parse(JSON.stringify(w)),entries=restored.ledger.length;assert.deepEqual(captureReservation(restored,{requestId:r.id,key:'refund-capture'}),receipt);assert.equal(restored.ledger.length,entries);assertDeadlineIntegrity(restored);
});

test('followup settles existing obligations without adding wages or new requests',()=>{
 const w=createDeadlineWorld({seed:901006,scenario:'ordinary',days:31,customers:10});
 while(w.day<31){beginDeadlineDay(w);endDeadlineDay(w);}const income=w.incomeCents,count=w.requests.length;
 while(w.day<w.totalDays){beginDeadlineDay(w);endDeadlineDay(w);}assert.equal(w.incomeCents,income);assert.equal(w.requests.length,count);assertDeadlineIntegrity(w);
});

test('funded supplier invoices settle once and produce stock after their quoted lead time',()=>{
 const worlds=['paypal','bank'].map(rail=>{const w=createDeadlineWorld({seed:902001,scenario:'scarce_stock'});beginDeadlineDay(w);const p=w.products.find(p=>p.merchantId==='MERCHANT-1'&&p.catalogId==='MM-PAPER-01'),args={merchantId:p.merchantId,items:[{productId:p.id,quantity:1}],merchantRail:rail,supplierRail:rail,key:'supplier-first'};
  const before=w.accounts[p.merchantId],receipt=placeProcurement(w,args),entries=w.ledger.length;assert.deepEqual(placeProcurement(w,args),receipt);assert.equal(w.ledger.length,entries);assert.equal(w.accounts[p.merchantId],before-p.costCents);assert.equal(p.stock,1);assert.throws(()=>placeProcurement(w,{...args,key:'too-large',items:[{productId:p.id,quantity:20}]}),/PROCUREMENT_EXCEEDS_OBSERVED_DEMAND/);
  endDeadlineDay(w);while(w.day<=7){beginDeadlineDay(w);if(w.day===3)assert.equal(p.stock,rail==='paypal'?2:1);endDeadlineDay(w);}assert.equal(p.stock,2);assert.equal(w.supplierInvoices.length,2);assert.ok(w.supplierInvoices.every(i=>i.status==='PAID'));assert.equal(w.accounts.procurement_clearing,0);assertDeadlineIntegrity(w);return w;
 });
 assert.equal(worlds[0].accounts['MERCHANT-1'],worlds[1].accounts['MERCHANT-1']);assert.ok(worlds[0].accounts.platform>worlds[1].accounts.platform);assert.ok(worlds[0].accounts.wholesaler<worlds[1].accounts.wholesaler);
});

test('splitting same-rail procurement calls cannot multiply fixed payment fees',()=>{
 const run=split=>{const w=createDeadlineWorld({seed:902002,scenario:'scarce_stock'});beginDeadlineDay(w);const items=['MM-PAPER-01','MM-PAPER-02'].map(id=>({productId:w.products.find(p=>p.merchantId==='MERCHANT-1'&&p.catalogId===id).id,quantity:1}));
  for(const [i,group]of (split?items.map(x=>[x]):[items]).entries())placeProcurement(w,{merchantId:'MERCHANT-1',items:group,merchantRail:'paypal',supplierRail:'paypal',key:'batch-'+i});endDeadlineDay(w);assertDeadlineIntegrity(w);return w;
 };
 const a=run(false),b=run(true);assert.deepEqual(a.accounts,b.accounts);assert.equal(a.supplierInvoices.length,2);assert.equal(b.supplierInvoices.length,2);
});

test('provision release alone cannot be reported as newly earned platform contribution',()=>{
 const opening={platformCash:10000,platformNet:5000,feeDue:0,exposure:5000};
 assert.equal(settledPlatformNet(opening,{platformCash:10000,feeDue:0,exposure:0}),0);
 assert.equal(settledPlatformNet(opening,{platformCash:9000,feeDue:0,exposure:0}),-1000);
 assert.equal(settledPlatformNet(opening,{platformCash:11000,feeDue:200,exposure:300}),500);
});

test('bounded allocation uses alternatives without spending scarce stock twice',async()=>{
 const allocator=openAllocator();try{
  const view={products:[{id:'scarce',available:1},{id:'alternative',available:1}]},quotes=[{requestId:'flexible',quantities:{scarce:1},expectedPlatformCents:100,preferred:0},{requestId:'flexible',quantities:{alternative:1},expectedPlatformCents:100,preferred:0},{requestId:'strict',quantities:{scarce:1},expectedPlatformCents:100,preferred:0}];
  const r=await allocator.solve(view,quotes);assert.equal(r.status,0);assert.deepEqual([...r.selected].sort(),[1,2]);
 }finally{allocator.close();}
});
