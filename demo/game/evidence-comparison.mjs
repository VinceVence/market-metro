import {total,fixtureDraw} from './network.mjs';
import {REVIEW_SHIFTS,createEvidenceEconomy,startEvidenceShift,tickEvidenceEconomy,prepareBaselineReview,applyEvidenceReview,exportEvidenceEconomy} from './evidence-economy.mjs';

export const EVIDENCE_COMPARISON_DEFAULTS=Object.freeze({count:36,seed:773,processingCostBps:100,reviewCostPerMerchant:25,referencePolicy:'hold'});
const profile=w=>w.merchants.map(m=>[m.id,m.group,m.baseDemand]);
const configuration=w=>JSON.stringify({count:w.count,seed:w.seed,receipt:w.paymentReference,profile:profile(w)});
const parameters=p=>JSON.stringify({settings:p.settings,strategies:p.strategies,shocks:REVIEW_SHIFTS});
export function createEvidenceComparison(input={},receipt=null) {
  if(Object.keys(input).some(k=>!(k in EVIDENCE_COMPARISON_DEFAULTS)))throw new Error('Unknown comparison setting.');
  const settings={...EVIDENCE_COMPARISON_DEFAULTS,...input};
  if(!Number.isInteger(settings.processingCostBps)||settings.processingCostBps<0||settings.processingCostBps>10000
    ||!Number.isInteger(settings.reviewCostPerMerchant)||settings.reviewCostPerMerchant<0||settings.reviewCostPerMerchant>100000
    ||!['hold','checklist','balanced'].includes(settings.referencePolicy))throw new Error('Invalid comparison assumption.');
  const worlds=[0,1].map(()=>createEvidenceEconomy(settings.count,receipt,settings.seed));
  const p={schema:'supply-yard-evidence-pair-v1',settings,strategies:[settings.referencePolicy,'balanced'],
    worlds,phase:'ready',paused:false,speed:2,auto:false,betweenTime:0,rounds:[],audit:[],worldKey:configuration(worlds[0])};
  p.parameterKey=parameters(p);return p;
}
function checkConfiguration(p){
  if(p.parameterKey!==parameters(p)||p.worlds.some(w=>configuration(w)!==p.worldKey))throw new Error('Comparison inputs changed. Reset both worlds.');
}
export function assertEvidencePair(p){
  checkConfiguration(p);
  const [a,b]=p.worlds;
  if(a.shift!==b.shift)throw new Error('Both worlds must use the same shift.');
  const inputs=w=>({
    orders:w.currentOrders.map(o=>[o.id,o.merchant,o.units,o.amount,o.fee,o.net,o.paymentSource,o.captureReference]),
    supply:w.warehouses.map(s=>[s.id,s.opening,s.successBps])
  });
  if(JSON.stringify(inputs(a))!==JSON.stringify(inputs(b)))throw new Error('Orders or supplier shocks are not matched.');
  for(const m of a.merchants)if(fixtureDraw(a,m.id)!==fixtureDraw(b,m.id))throw new Error('Delivery draws are not matched.');
  for(const o of a.currentOrders)for(let i=0;i<o.units;i++)for(const channel of ['scan','carrier']){
    const id=`${o.id}-U${i+1}`;
    if(fixtureDraw(a,id,channel)!==fixtureDraw(b,id,channel))throw new Error('Evidence-availability draws are not matched.');
  }
  return true;
}
export function startEvidencePairShift(p){
  if(!['ready','between'].includes(p.phase)||p.rounds.length>=3)throw new Error('Wait for both worlds to close this shift.');
  if(p.phase==='ready'){
    const balances=w=>JSON.stringify({ledger:w.ledger,wallets:w.merchants.map(m=>[m.cash,m.reserve])});
    if(balances(p.worlds[0])!==balances(p.worlds[1]))throw new Error('Starting wallets differ. Reset both worlds.');
  }
  checkConfiguration(p);p.worlds.forEach(startEvidenceShift);assertEvidencePair(p);
  p.phase='running';p.paused=false;p.betweenTime=0;
  const w=p.worlds[0];
  p.audit.push({shift:w.shift+1,matched:true,seed:w.seed,orders:w.currentOrders.length,paidUnits:total(w.currentOrders,'units'),
    gross:total(w.currentOrders,'amount'),fees:total(w.currentOrders,'fee'),supply:w.warehouses.map(s=>({id:s.id,opening:s.opening,successBps:s.successBps})),
    procurementPrice:REVIEW_SHIFTS[w.shift].price,drawKeys:'seed + merchant or unit ID + shift + channel',strategies:[...p.strategies]});
}
export function evidencePairMetrics(w,settings){
  const ledger=w.ledger;
  // Provider expenses are separate from merchant wallets. No cost is deducted twice.
  const processing=total(w.orders,o=>Math.round(o.amount*settings.processingCostBps/10000));
  const approvedReviews=total(w.history,h=>h.policy==='balanced'?w.count:0)
    +(w.approval?.kind==='balanced'&&w.history.length===w.shift?w.count:0);
  const reviewCost=approvedReviews*settings.reviewCostPerMerchant;
  return {gross:ledger.captured,fees:ledger.feesCollected,processing,coverage:ledger.paypalCoverage,reviewCost,
    net:ledger.feesCollected-processing-ledger.paypalCoverage-reviewCost,
    delivered:total(w.offices,'received'),paid:total(w.orders,'units'),refunds:ledger.refunds,released:ledger.released,
    held:total(w.merchants,'reserve'),cash:total(w.merchants,'cash'),
    queries:total(w.reviewHistory,h=>h.queries.length)+(w.history.length===w.shift?w.queries.length:0),approvedReviews};
}
export function evidenceBenefit(p){
  const [a,b]=p.worlds.map(w=>evidencePairMetrics(w,p.settings));
  const parts={fees:b.fees-a.fees,processing:a.processing-b.processing,coverage:a.coverage-b.coverage,review:a.reviewCost-b.reviewCost};
  return {...parts,total:b.net-a.net,extraDeliveries:b.delivered-a.delivered};
}
export function tickEvidencePair(p,delta){
  if(p.paused)return;
  if(p.phase==='between'&&p.auto){
    p.betweenTime+=Math.min(.1,Math.max(0,delta))*p.speed;
    if(p.betweenTime>=2)startEvidencePairShift(p);
    return;
  }
  if(p.phase!=='running')return;
  checkConfiguration(p);
  for(const [i,w] of p.worlds.entries()){
    w.speed=p.speed;tickEvidenceEconomy(w,delta);
    if(w.phase==='debate'&&p.strategies[i]!=='balanced')prepareBaselineReview(w,p.strategies[i]);
    if(w.phase==='review'){
      w.selectedPlan=p.strategies[i];
      // Start commits these two local replay policies; there is no provider transaction.
      applyEvidenceReview(w,p.strategies[i],'human-reviewer');
    }
  }
  if(p.worlds.every(w=>w.phase==='settled')){
    assertEvidencePair(p);
    const metrics=p.worlds.map(w=>evidencePairMetrics(w,p.settings));
    const prior=p.rounds.at(-1)?.cumulative;
    const financialKeys=['gross','fees','processing','coverage','reviewCost','net','delivered','paid','refunds','released','queries','approvedReviews'];
    const perShift=metrics.map((m,i)=>Object.fromEntries(financialKeys.map(k=>[k,m[k]-(prior?.[i][k]??0)])));
    p.rounds.push({shift:p.worlds[0].shift+1,shock:REVIEW_SHIFTS[p.worlds[0].shift].name,
      results:p.worlds.map(w=>structuredClone(w.history.at(-1))),perShift,cumulative:metrics,
      benefit:metrics[1].net-metrics[0].net,shiftBenefit:perShift[1].net-perShift[0].net});
    p.phase=p.rounds.length===3?'complete':'between';p.betweenTime=0;
  }
}
export function exportEvidencePair(p){
  return {schema:p.schema,settings:{...p.settings},strategies:[...p.strategies],phase:p.phase,
    receiptReference:structuredClone(p.worlds[0].paymentReference),shocks:structuredClone(REVIEW_SHIFTS),
    audit:structuredClone(p.audit),rounds:structuredClone(p.rounds),
    metrics:p.worlds.map(w=>evidencePairMetrics(w,p.settings)),benefit:evidenceBenefit(p),worlds:p.worlds.map(exportEvidenceEconomy),
    disclosure:'Matched three-shift simulated replay using one saved sandbox receipt as a shared reference; no new payment. Exact orders, fees, initial merchant cash, supply shocks and keyed random draws match. Policies may change procurement, deliveries and resulting evidence. Full hold makes no evidence queries. Net contribution = fees retained - assumed processing costs - modeled provider refund shortfall - assumed scripted-review cost. Released reserves and merchant-funded refunds are not provider profits or expenses. Gross demand remains fixed: no churn, retention uplift or future revenue bonus. Current evidence collection is a deterministic workflow; a conventional implementation with the same queries and rule should match it. This does not establish an advantage for LLM agents, production ROI, or PayPal policy validity.'};
}
