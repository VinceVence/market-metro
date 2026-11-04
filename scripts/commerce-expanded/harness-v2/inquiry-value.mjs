// General inquiries have no SKU. Fit reply/value models to their own data,
// rather than interpreting placeholder product features as actual products.
import {canonicalHash,freeze} from './contracts.mjs';
const BUCKETS=['fresh','recent','cold'];
export const inquiryBucket=(view,person)=>{const age=person.signal&&person.signal.day<=view.day?view.day-person.signal.day:99;return age<=2?'fresh':age<=7?'recent':'cold';};

export function fitInquiryValue(rows){
 const selected=rows.filter(r=>r.kind==='ask_need'),groups={};
 for(const r of selected){
  const bucket=r.observedBucket.split('|')[2];
  if(!BUCKETS.includes(bucket)||![0,1].includes(r.responded)||![0,1].includes(r.retained)||r.retained>r.responded||![r.retailNetCents,r.merchantOrderContributionCents].every(Number.isFinite))throw Error('INVALID_INQUIRY_TRAINING_ROW');
  const g=groups[bucket]??={n:0,responded:0,retained:0,paymentReply:0,sharedReply:0,paymentSilent:0,sharedSilent:0};
  g.n++;g.responded+=r.responded;g.retained+=r.retained;const suffix=r.responded?'Reply':'Silent';
  g['payment'+suffix]+=r.retailNetCents;g['shared'+suffix]+=r.retailNetCents+r.merchantOrderContributionCents;
 }
 if(BUCKETS.some(k=>!groups[k]?.n))throw Error('INQUIRY_HISTORY_INCOMPLETE');
 return freeze({version:'inquiry-response-value-1',rows:selected.length,groups,precision:8,windowDays:28,sourceHash:canonicalHash(selected.map(r=>[r.observedBucket,r.responded,r.retained,r.retailNetCents,r.merchantOrderContributionCents]))});
}

export function inquiryValueEstimates(view,model){
 if(model.version!=='inquiry-response-value-1'||model.precision!==8||model.windowDays!==28)throw Error('INVALID_INQUIRY_VALUE_MODEL');
 const {groups,precision,windowDays}=model,history=view.outreach.history.filter(c=>c.kind==='ask_need'&&c.day<view.day),recent=history.filter(c=>c.day>=view.day-windowDays),sigmoid=z=>1/(1+Math.exp(-Math.max(-30,Math.min(30,z)))),base=k=>(groups[k].responded+.5)/(groups[k].n+1),logit=p=>Math.log(p/(1-p));let shift=0;
 for(const c of history)if(!BUCKETS.includes(c.observedBucket?.split('|')[2]))throw Error('UNKNOWN_INQUIRY_BUCKET');
 // Regularized logistic intercept, fitted from replies already observed.
 for(let step=0;step<8;step++){let gradient=-precision*shift,curvature=precision;
  for(const c of recent){const q=sigmoid(logit(base(c.observedBucket.split('|')[2]))+shift);gradient+=Number(c.responded)-q;curvature+=q*(1-q);}
  shift+=gradient/curvature;
 }
 const orders=new Map(view.pastOrders.filter(o=>o.day<view.day).map(o=>[o.requestId,o]));
 return new Map(Object.entries(groups).map(([bucket,g])=>{
  let replied=0,retained=0,payment=0,shared=0;
  for(const c of history)if(c.responded&&c.day+26<view.day&&c.observedBucket.split('|')[2]===bucket){
   const o=orders.get(c.requestId),yes=!!o&&!['SETTLED','PENDING_FUNDS'].includes(o.refundStatus),net=(o?(yes?o.feeCents:0)-o.processingCents:0)-c.costCents,merchant=o?o.merchants.reduce((s,m)=>s+(yes?m.grossCents-m.feeCents:0)-m.costCents-m.deliveryCents,0):0;
   replied++;retained+=Number(yes);payment+=net;shared+=net+merchant;
  }
  const q=sigmoid(logit(base(bucket))+shift),conditional=(precision*(g.retained+.5)/(g.responded+1)+retained)/(precision+replied),expected=(kind,observed)=>q*(precision*g[kind+'Reply']/Math.max(1,g.responded)+observed)/(precision+replied)+(1-q)*(g.n>g.responded?g[kind+'Silent']/(g.n-g.responded):-view.outreach.rules.outreachCostCents);
  const result={probability:q*conditional,expectedNetCents:expected('payment',payment),expectedSharedNetCents:expected('shared',shared),responseProbability:q,responseShift:shift,matureReplies:replied,estimator:'INQUIRY_RESPONSE_VALUE'};
  if(!Object.entries(result).filter(([k])=>k!=='estimator').every(([,v])=>Number.isFinite(v))||result.probability<0||result.probability>1)throw Error('INVALID_INQUIRY_VALUE_PREDICTION');
  return [bucket,result];
 }));
}
