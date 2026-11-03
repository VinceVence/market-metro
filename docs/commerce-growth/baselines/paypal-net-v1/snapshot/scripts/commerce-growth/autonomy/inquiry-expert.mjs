// Inquiry outcomes are sparse and do not have a requested SKU. Use the
// observed shopper's intent age, matching the calibrated historical groups,
// instead of treating every inquiry as a cold, signal-free request.
export function inquiryEstimate(view,prior,customerId){
 const person=view.audience.find(p=>p.customerId===customerId);if(!person)throw Error('INQUIRY_CUSTOMER_NOT_OBSERVED');
 const age=person.signal&&person.signal.day<=view.day?view.day-person.signal.day:99,bucket=age<=2?'fresh':age<=7?'recent':'cold',g=prior.groups['ask_need|'+bucket]||{contacts:0,retained:0,retailNetCents:0},orders=new Map(view.pastOrders.filter(o=>o.day<view.day).map(o=>[o.requestId,o]));
 let n=0,retained=0,net=0;
 for(const c of view.outreach.history)if(c.kind==='ask_need'&&c.day+26<view.day&&c.observedBucket.split('|')[2]===bucket){const o=orders.get(c.requestId),yes=Boolean(o&&!['SETTLED','PENDING_FUNDS'].includes(o.refundStatus));n++;retained+=Number(yes);net+=(o?(yes?o.feeCents:0)-o.processingCents:0)-c.costCents;}
 const strength=8,meanProbability=(g.retained+.5)/(g.contacts+2),meanNet=g.contacts?g.retailNetCents/g.contacts:-view.outreach.rules.outreachCostCents;
 return {probability:(strength*meanProbability+retained)/(strength+n),expectedNetCents:(strength*meanNet+net)/(strength+n),model:'intent-age inquiry reward posterior',bucket,historicalContacts:g.contacts,matureLocalContacts:n};
}
