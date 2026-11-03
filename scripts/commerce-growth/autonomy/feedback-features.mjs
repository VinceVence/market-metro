// Reconstruct only events observable before today's contact. Source trajectory
// IDs group rows for reconstruction; no identifier is passed to a predictor.
export const MARKET_FEEDBACK_FIELDS=Object.freeze(['market_contacts_log','market_response_rate','market_authorization_rate','market_mature_retention_rate']);
export const SHOPPER_FEEDBACK_FIELDS=Object.freeze(['shopper_contacts_log','shopper_response_rate','shopper_authorization_rate','days_since_shopper_response']);
export function feedbackFeatures(history,day,customerId,kind){
 const past=history.filter(r=>r.day<day),recent=past.filter(r=>r.day>=day-28&&r.kind===kind),person=past.filter(r=>r.customerId===customerId),mature=past.filter(r=>r.day>=day-54&&(r.labelCompleteDay??r.day+26)<day&&r.kind===kind),responses=person.filter(r=>r.responded),
  rate=(rows,key,positive=1,negative=3)=>(rows.reduce((s,r)=>s+Number(Boolean(r[key])),0)+positive)/(rows.length+positive+negative);
 return {market_contacts_log:Math.log1p(recent.length),market_response_rate:rate(recent,'responded'),market_authorization_rate:rate(recent,'authorized'),market_mature_retention_rate:rate(mature,'retained',1,9),
  shopper_contacts_log:Math.log1p(person.length),shopper_response_rate:rate(person,'responded'),shopper_authorization_rate:rate(person,'authorized'),days_since_shopper_response:responses.length?Math.min(99,day-Math.max(...responses.map(r=>r.day))):99};
}
export function feedbackByRow(rows){
 const trajectories=new Map();for(const row of rows){const key=String(row.episode)+'|'+row.sourcePolicy;(trajectories.get(key)||trajectories.set(key,[]).get(key)).push(row);}
 return rows.map(r=>feedbackFeatures(trajectories.get(String(r.episode)+'|'+r.sourcePolicy),r.day,r.customerId,r.kind));
}
export function observedFeedbackHistory(view){
 const orders=new Map(view.pastOrders.filter(o=>o.day<view.day).map(o=>[o.requestId,o]));
 return view.outreach.history.map(c=>{const o=orders.get(c.requestId);return {...c,labelCompleteDay:c.day+26,retained:Number(Boolean(o&&!['SETTLED','PENDING_FUNDS'].includes(o.refundStatus)))};});
}
