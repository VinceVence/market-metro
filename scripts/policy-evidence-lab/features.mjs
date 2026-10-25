// Public observations only. IDs, scenario labels and future scores are excluded.
export const FEATURE_NAMES=['purchase_rate','previous_purchase_rate','premium_purchase_rate','previous_premium_rate','active_fraction','lapsed_fraction',
  ...[0,1,2].flatMap(i=>['stock','recent_stock_low','mature_return_rate','return_sample','recent_orders','markdown'].map(x=>'store_'+i+'_'+x))];
export function features(e){
  const n=e.customers,x=[e.recentPurchases/(7*n),e.previousPurchases/(7*n),e.recentPremiumPurchases/(7*n),e.previousPremiumPurchases/(7*n),e.activeBuyers/n,e.lapsedBuyers/n];
  for(const m of e.merchants){if(m.matureOrders<1)throw Error('INSUFFICIENT_RETURN_SUPPORT');x.push(m.stock/90,m.minStockLast14/90,m.matureReturns/m.matureOrders,m.matureOrders/100,m.recentOrders/(7*n),m.directMarkdownPct/100);}
  if(x.length!==FEATURE_NAMES.length||!x.every(Number.isFinite))throw Error('INVALID_OBSERVED_FEATURES');return x;
}
export function predict(model,x){
  if(model.kind==='constant')return [...model.mean];
  if(model.kind==='ridge')return model.coef.map((row,i)=>model.intercept[i]+row.reduce((n,w,j)=>n+w*x[j],0));
  if(model.kind==='extra_trees'){
    const y=Array(model.outputs).fill(0);
    for(const tree of model.trees){let i=0;while(tree.left[i]!==-1)i=x[tree.feature[i]]<=tree.threshold[i]?tree.left[i]:tree.right[i];tree.value[i].forEach((v,j)=>y[j]+=v/model.trees.length);}return y;
  }
  throw Error('UNSUPPORTED_VALUE_MODEL');
}
export function choosePolicy(model,packet,x){
  const predictions=predict(model,x);if(predictions.length!==2*packet.candidateIds.length||!predictions.every(Number.isFinite))throw Error('INVALID_POLICY_PREDICTIONS');
  const ranked=packet.candidateIds.map((id,i)=>({id,predictedPlatformDeltaUSD:id==='observe'?0:predictions[i],predictedMerchantDeltaUSD:id==='observe'?0:predictions[i+packet.candidateIds.length]}));
  // Zero is the economic break-even point, not a tuned promotion threshold.
  const permitted=ranked.filter(c=>c.predictedMerchantDeltaUSD>=0&&c.predictedPlatformDeltaUSD>=0).sort((a,b)=>b.predictedPlatformDeltaUSD-a.predictedPlatformDeltaUSD||a.id.localeCompare(b.id));
  return {candidateId:permitted[0]?.id||'observe',ranked};
}
