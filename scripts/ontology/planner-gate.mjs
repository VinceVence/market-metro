import {verifyMerchantFeed} from '../../demo/commerce/feed-verifier.mjs';
import {canonicalHash} from '../commerce-expanded/harness-v2/contracts.mjs';
import {merchantFeedFromLedger} from './judge-feed.mjs';

export const plannerMappings=Object.freeze(['warehouse','renamed','flat','two-links']);
// The planner receives captured history through the last completed day.
// The later Sandbox mirror and the end-of-run ledger never enter this feed.
export function observedReviewFeed(view,runId,example='warehouse'){
  const checkouts=view.pastOrders.map(o=>{
    if(!Number.isInteger(o.day)||o.day<0||o.day>=view.day)throw Error('PLANNER_FEED_FUTURE_ORDER');
    const basket=runId+'-'+o.id;
    return [basket,o.grossCents,o.merchants.map(m=>[basket+'-'+m.id,runId+'-'+m.id,m.grossCents])];
  });
  return merchantFeedFromLedger({runId,checkouts},example);
}

function admittedOrders(feed,certificate,view){
  const m=certificate.mapping,table=feed.tables.find(t=>t.name===m.checkoutTable);
  const key=table.columns.findIndex(c=>c.name===m.checkoutKey),gross=table.columns.findIndex(c=>c.name===m.checkoutGross);
  const amounts=new Map(table.rows.map(row=>[row[key],row[gross]]));
  // Preserve the observation order even when merchant rows are flat or reordered.
  const orders=view.pastOrders.filter(o=>amounts.get(feed.runId+'-'+o.id)===(m.checkoutUnit==='USD'?(o.grossCents/100).toFixed(2):o.grossCents));
  if(orders.length!==amounts.size||orders.length!==view.pastOrders.length||orders.length!==certificate.metrics.purchases ||
    orders.reduce((n,o)=>n+o.grossCents,0)!==certificate.metrics.grossCents)throw Error('PLANNER_FEED_HISTORY_MISMATCH');
  return orders;
}

// Wrap the review entry point, before any provider, trial, publication or contact.
// An unresolved review stays on the same economic day until its own mapping is corrected.
export function withPlannerFeed(planner,{runId,mapping='warehouse'}){
  if(!plannerMappings.includes(mapping))throw Error('PLANNER_UNKNOWN_MAPPING');
  const checks=[];let waiting=null,correction=null,last=null,closed=false;
  function checkpoint(day,output){
    const at=new Date().toISOString();
    checks.push({role:'Single commerce planner',actor:'MERCHANT_FEED_GATE',day,completedDay:day,status:'COMPLETED',
      startedAt:at,finishedAt:at,input:{throughDay:day},output});
  }
  async function review(view,snapshotHash){
    const feed=observedReviewFeed(view,runId,mapping==='two-links'?'ambiguous':mapping);
    const legs=feed.tables.find(t=>t.grain==='merchant order');
    const rowsHash=canonicalHash(feed.tables.map(t=>({name:t.name,columns:t.columns,rows:t.rows})));
    if(waiting && (waiting.snapshotHash!==snapshotHash||waiting.rowsHash!==rowsHash))throw Error('PLANNER_HELD_INPUT_CHANGED');
    const schema=()=>canonicalHash(feed.tables.map(({rows,...metadata})=>metadata));
    const suppliedSchema=schema();
    if(correction?.sourceSchema===suppliedSchema){
      // The merchant's corrected dictionary names this one FK. Keep both columns and all values.
      legs.foreignKeys=legs.foreignKeys.filter(fk=>fk.column===correction.column);
    }
    const schemaHash=correction?.sourceSchema===suppliedSchema?schema():suppliedSchema;
    const holdId=canonicalHash({runId,day:view.day,snapshotHash,rowsHash,schemaHash});
    const cert=verifyMerchantFeed(feed);
    const evidence={day:view.day,throughDay:view.day,snapshotHash,rowsHash,schemaHash,
      declaredLinks:legs.foreignKeys.map(fk=>fk.column),source:'OBSERVED_SIMULATED_CAPTURES'};
    if(cert.decision==='HOLD'){
      waiting={...evidence,holdId,code:cert.code,reason:cert.reason};
      checkpoint(view.day,{...waiting,decision:'HOLD',metrics:null,title:'Campaign decision held',
        body:cert.reason+' The planner is waiting for the merchant’s checkout-key declaration.'});
      return {held:true,holdId,decision:'HOLD',actions:[],agentCampaign:false,reason:cert.reason};
    }
    const history=admittedOrders(feed,cert,view);
    const fixedHold=waiting?.holdId??null;
    waiting=null;
    checkpoint(view.day,{...evidence,decision:'CERTIFY',metrics:cert.metrics,checkoutKey:cert.mapping.orderToCheckout,
      correctedHoldId:fixedHold,title:'Purchase history admitted to planning',
      body:`Released ${history.length} captured checkouts from ${cert.metrics.merchantOrders} merchant orders through day ${view.day}.`});
    return planner.plan({...view,pastOrders:history});
  }
  return {
    async plan(view){
      if(closed)throw Error('PLANNER_GATE_CLOSED');
      if(waiting&&view.day!==waiting.day)throw Error('PLANNER_MAPPING_REQUIRED');
      if(![30,60].includes(view.day))return planner.plan(view);
      const snapshotHash=canonicalHash(view),revision=correction?.holdId??null;
      if(last?.day===view.day){
        if(last.snapshotHash!==snapshotHash)throw Error('PLANNER_HELD_INPUT_CHANGED');
        if(last.revision===revision)return structuredClone(await last.promise);
      }
      last={day:view.day,snapshotHash,revision,promise:review(view,snapshotHash)};
      return structuredClone(await last.promise);
    },
    correctMapping(holdId,column){
      if(closed)throw Error('PLANNER_GATE_CLOSED');
      if(column!=='basket_id')throw Error('PLANNER_UNCONFIRMED_MAPPING');
      if(correction && correction.holdId===holdId)return;
      if(!waiting||waiting.holdId!==holdId||waiting.code!=='ambiguous-link')throw Error('PLANNER_STALE_MAPPING');
      correction={holdId,column,sourceSchema:waiting.schemaHash};
    },
    summary(){
      const s=planner.summary();
      const admissions=new Map(checks.filter(c=>c.output.decision==='CERTIFY').map(c=>[c.day,c.output]));
      const records=s.checkpoints.map(c=>{
        const a=admissions.get(c.day);
        if(c.actor!=='TRUSTED_PUBLISHER'||!a)return c;
        return {...c,input:{...c.input,merchantFeed:{rowsHash:a.rowsHash,schemaHash:a.schemaHash,throughDay:a.throughDay}}};
      });
      return {...s,status:waiting?'AWAITING_MAPPING':s.status,feedGate:structuredClone({waiting,correction}),
        checkpoints:[...structuredClone(checks),...records].sort((a,b)=>a.day-b.day)};
    },
    async close(){closed=true;await last?.promise?.catch(()=>{});await planner.close();}
  };
}
