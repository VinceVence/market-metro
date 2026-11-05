import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {verifyMerchantFeed} from '../../demo/commerce/feed-verifier.mjs';

export const judgeFeeds=['warehouse','renamed','flat','ambiguous','units'];
let saved;
async function ledger(){
  if(saved)return saved;
  const [bytes,judge]=await Promise.all([readFile('docs/ontology/judge-ledger.json.gz'),
    readFile('demo/data/judge-reactivation.json','utf8').then(JSON.parse)]);
  const record=JSON.parse(gunzipSync(bytes));
  assert.equal(createHash('sha256').update(JSON.stringify(record.ledger)).digest('hex'),record.hash);
  assert.equal(record.judgeLock,judge.lockHash);assert.equal(record.ledger.runId,judge.runId);
  saved={source:record.ledger,receipt:judge.receipt};return saved;
}

// Alternate headers and flat rows are demonstration exports of the exact same recorded amounts.
// The fixed and semantic verifiers get only the resulting schema and records.
export async function judgeFeed(example){
  if(!judgeFeeds.includes(example))throw RangeError('Unknown merchant feed');
  const {source}=await ledger();
  return merchantFeedFromLedger(source,example);
}

export function merchantFeedFromLedger(source,example){
  if(!judgeFeeds.includes(example))throw RangeError('Unknown merchant feed');
  const renamed=example==='renamed'||example==='flat',flat=example==='flat';
  const [parents,children,basketId,orderId,link,merchant,gross,portion]=renamed?
    ['register_sales','seller_postings','till_ticket','posting_ticket','register_ref','outlet_ref','charged_value','posting_value']:
    ['autonomy_baskets','orders','basket_id','order_id','basket_id','merchant_id','gross_cents','total_cents'];
  const basketAmount={name:gross,description:'checkout gross',unit:flat?'USD':'USD cents'};
  const head={name:parents,grain:'shopper checkout',primaryKey:basketId,foreignKeys:[],
    columns:[{name:basketId,description:'shopper checkout identifier'},basketAmount],rows:[]};
  const leg={name:children,grain:'merchant order',primaryKey:orderId,
    foreignKeys:flat?[]:[{column:link,toTable:parents,toColumn:basketId}],
    columns:[{name:orderId,description:'merchant order identifier'},{name:link,description:'parent basket identifier'},
      {name:merchant,description:'seller identifier'},{name:portion,description:'merchant order gross',unit:'USD cents'}],rows:[]};
  if(flat)leg.columns.push(basketAmount);
  if(example==='units')delete leg.columns[3].unit;
  if(example==='ambiguous'){
    leg.columns.push({name:'second_ticket',description:'parent basket identifier'});
    leg.foreignKeys.push({column:'second_ticket',toTable:parents,toColumn:basketId});
  }
  for(const [key,total,legs] of source.checkouts){
    if(!flat)head.rows.push([key,total]);
    for(const [id,seller,amount] of legs){
      const row=[id,key,seller,amount];
      if(flat)row.push((total/100).toFixed(2));
      if(example==='ambiguous')row.push(key);
      leg.rows.push(row);
    }
  }
  return {version:1,runId:source.runId,measure:'gross at capture',currency:'USD',complete:true,tables:flat?[leg]:[head,leg]};
}

export async function verifyJudgeFeed(example){
  const feed=await judgeFeed(example),{receipt}=await ledger();
  return {fixed:verifyMerchantFeed(feed,{mode:'fixed',receipt}),ontology:verifyMerchantFeed(feed,{receipt})};
}
