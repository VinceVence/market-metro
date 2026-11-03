// Public merchant/partner observations only. These describe readiness and
// possible confounding; they do not establish the cause of shopper response.
export const OPERATIONS_DOMAINS=Object.freeze(['supplier_quotes','inventory_pipeline','payment_funding','merchant_cash']);
export function operationsEvidence(view,domains=OPERATIONS_DOMAINS){
 if(!Array.isArray(domains)||domains.some(d=>!OPERATIONS_DOMAINS.includes(d)))throw Error('UNKNOWN_OPERATIONS_DOMAIN');const out={asOfDay:view.day};
 if(domains.includes('supplier_quotes')){const normal=view.paymentRules.physicalLeadDays,current=view.paymentRules.physicalLeadMaxDays;out.supplier_quotes={normalLeadDays:normal,currentMaximumLeadDays:current,available:Number.isFinite(normal)&&Number.isFinite(current),extendedQuote:Number.isFinite(normal)&&Number.isFinite(current)?current>normal:null};}
 if(domains.includes('inventory_pipeline'))out.inventory_pipeline={availableShare:view.products.filter(p=>p.available>0).length/view.products.length,inboundLines:view.inbound.length,maximumQuotedDaysUntilArrival:view.inbound.length?Math.max(...view.inbound.map(p=>Math.max(0,(p.confirmedArrivalDay??p.latestArrivalDay)-view.day))):0};
 if(domains.includes('payment_funding')){const authorized=view.requests.filter(r=>r.status==='AUTHORIZED');out.payment_funding={openAuthorizedRequests:authorized.length,authorizedAmountUSD:authorized.reduce((s,r)=>s+(r.authorizedCents||0),0)/100,recentCaptures:view.pastOrders.filter(o=>o.day>=view.day-15&&o.day<view.day).length};}
 if(domains.includes('merchant_cash'))out.merchant_cash={spendableUSD:view.merchants.reduce((s,m)=>s+m.cashCents,0)/100};
 return {...out,scope:'Already-public quote, inventory, authorized demand and merchant cash. No private scenario label, hidden needs, response draws or household wallets.'};
}
