import {contactFeatures} from '../experiments/program.mjs';
import {RESPONSE_FIELDS,responseFeatures,predictResponse} from './features.mjs';
import {feedbackFeatures,observedFeedbackHistory} from './feedback-features.mjs';
export function retentionObserver(resources,observations){return (view,plan)=>{
 if(!plan.actions.length)return;const candidates=contactFeatures(view,resources.prior,7),history=observedFeedbackHistory(view);
 for(const a of plan.actions){const c=candidates.find(x=>x.action.customerId===a.customerId&&x.action.kind===a.kind&&x.action.catalogId===a.catalogId),old=plan.ranking.find(x=>x.customerId===a.customerId&&x.kind===a.kind&&x.catalogId===a.catalogId);if(!c||!old)throw Error('MISSING_REFERENCE_PREDICTION');
  const base=responseFeatures(view,c),values={...Object.fromEntries(RESPONSE_FIELDS.map((k,i)=>[k,base[i]])),...feedbackFeatures(history,view.day,a.customerId,a.kind),incumbent_probability:old.probability},artifact=resources.expert.artifact;
  observations.push({day:view.day,customerId:a.customerId,kind:a.kind,catalogId:a.catalogId,old:old.probability,expert:predictResponse(artifact.models[artifact.selected],artifact.featureNames.map(k=>values[k]),artifact.featureNames)});
 }
};}
export function labelReference(observations,trace,market){
 const contacts=new Map(trace.contacts.map(c=>[[c.day,c.customerId,c.kind,c.catalogId].join('|'),c])),orders=new Map(trace.orders.map(o=>[o.requestId,o]));
 return observations.map(o=>{const c=contacts.get([o.day,o.customerId,o.kind,o.catalogId].join('|'));if(!c)throw Error('MISSING_FINAL_REFERENCE_CONTACT');const order=orders.get(c.requestId);return {...o,market,y:Number(Boolean(order&&!['SETTLED','PENDING_FUNDS'].includes(order.refundStatus)))};});
}
