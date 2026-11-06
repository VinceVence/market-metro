import {observedReviewFeed} from './planner-gate.mjs';
import {verifyLargeFeed} from '../commerce-metropolis/feed-verifier.mjs';
import {verifyMerchantFeed} from '../../demo/commerce/feed-verifier.mjs';
import {mapTrainingTask} from './training.mjs';

// Inspector facts contain observed records through the selected day, never latent demand.
export function runOntology({world,run,day,steps,receipts,reference,hold}){
  const orders=world.orders.filter(o=>o.day<day);
  const contacts=world.growth.contacts.filter(c=>c.day<day);
  const refunds=new Set(world.events.filter(e=>e.type==='REFUNDED'&&e.day<day).map(e=>e.captureId));
  const mature=contacts.filter(c=>c.day+26<day);
  const models=steps.filter(s=>s.actor==='LOCAL_MODEL'&&s.status==='COMPLETED');
  const publications=steps.filter(s=>['TRUSTED_PUBLISHER','SAVED_POLICY'].includes(s.actor)&&s.status==='COMPLETED');
  const lastGate=steps.filter(s=>s.actor==='MERCHANT_FEED_GATE'&&s.status==='COMPLETED').at(-1)?.output;
  const confirmed=lastGate?.decision==='CERTIFY';
  const mapping=run.merchantMapping==='two-links'?(confirmed?'warehouse':'ambiguous'):(run.merchantMapping??'warehouse');
  const feed=observedReviewFeed({day,pastOrders:orders},run.runId,mapping);
  const certificate=orders.length?(world.version==='commerce-metropolis-1'?verifyLargeFeed:verifyMerchantFeed)(feed):null;
  const split=orders.find(o=>o.merchants.length>1)??orders[0];
  const record=split?{checkout:run.runId+'-'+split.id,shopper:run.runId+'-'+split.customerId,grossCents:split.grossCents,
    orders:split.merchants.map(m=>({id:run.runId+'-'+split.id+'-'+m.id,merchant:world.merchants.find(x=>x.id===m.id)?.name??m.id,grossCents:m.grossCents})),
    products:split.items.map(i=>world.products.find(p=>p.id===i.productId)?.title??i.productId)}:null;
  return {runId:run.runId,day,source:'OBSERVED_SIMULATION',execution:run.execution??'fresh',
    counts:{shoppers:world.people.length,products:new Set(world.products.map(p=>p.catalogId)).size,merchants:world.merchants.length,
      contacts:contacts.length,recommendations:contacts.filter(c=>c.kind==='recommend').length,inquiries:contacts.filter(c=>c.kind==='ask_need').length,
      checkouts:orders.length,merchantOrders:orders.reduce((n,o)=>n+o.merchants.length,0),splitCheckouts:orders.filter(o=>o.merchants.length>1).length,
      capturedCents:orders.reduce((n,o)=>n+o.grossCents,0),refunds:refunds.size,matureContacts:mature.length,
      matureRecommendations:mature.filter(c=>c.kind==='recommend').length,matureInquiries:mature.filter(c=>c.kind==='ask_need').length,
      trainedModels:models.length,campaigns:publications.filter(s=>s.actor==='SAVED_POLICY'||s.output?.decision==='publish').length,
      sandboxReceipts:receipts.filter(r=>r.status==='COMPLETED').length},
    mapping:{selection:run.merchantMapping??'warehouse',decision:certificate?.decision??'WAITING',code:certificate?.code??null,
      reason:certificate?.decision==='CERTIFY'?'The declared checkout link and money units reconcile every merchant portion.':certificate?.reason??'Captures will appear as shoppers transact.',definition:certificate?.mapping??null,
      metrics:certificate?.metrics??null,pages:certificate?(certificate.pages??1):0,checkpoint:lastGate??null,held:Boolean(hold)},
    training:mapTrainingTask('retained_recommendation'),models:models.map(s=>({id:s.output?.modelId,day:s.day,
      fields:s.output?.featureNames??[],rows:s.output?.trainingRows??s.input.rows,ownRows:s.output?.ownMatureRows??s.input.ownMatureRows??null,metrics:s.output?.metrics})),
    reference:reference??null,example:record,
    receipts:receipts.map(r=>({orderId:r.order_id,captureId:r.capture_id,status:r.status,grossCents:r.gross_cents,feeCents:r.fee_cents,netCents:r.net_cents}))};
}
