import {SHIFTS,createNetwork,beginShift,beginDebate,advanceDebate,buildFixedPlan,applyPlan,tickNetwork,fixtureDraw,total,exportNetwork} from './network.mjs';

export const COMPARISON_DEFAULTS=Object.freeze({count:36,seed:773,feeBps:300,processingCostBps:100,refundFeeReturnBps:0,reviewCostPerMerchant:25,churnScaleBps:10000});
const profile=w=>w.merchants.map(m=>[m.id,m.group,m.baseDemand,m.overheadBps]);
const commonInputKey=w=>JSON.stringify({profile:profile(w),count:w.count,seed:w.seed,economics:w.economics,releaseCap:w.releaseCap,extraLossCap:w.extraLossCap});
export function createComparison(input={},strategies=['fixed','balanced']){
  if(Object.keys(input).some(k=>!(k in COMPARISON_DEFAULTS)))throw new Error('Unknown comparison assumption.');
  const settings={...COMPARISON_DEFAULTS,...input};
  if(!Number.isInteger(settings.churnScaleBps)||settings.churnScaleBps<0||settings.churnScaleBps>20000)throw new Error('Invalid churn sensitivity.');
  if(strategies.length!==2||strategies.some(s=>!['fixed','balanced'].includes(s)))throw new Error('Unknown comparison strategy.');
  const scale=n=>Math.round(n*settings.churnScaleBps/10000);
  const economics={feeBps:settings.feeBps,processingCostBps:settings.processingCostBps,refundFeeReturnBps:settings.refundFeeReturnBps,reviewCostPerMerchant:settings.reviewCostPerMerchant,churnBaseBps:scale(200),churnServiceBps:scale(2000),churnPauseBps:scale(1500),churnReserveBps:scale(1000)};
  const worlds=[0,1].map(()=>createNetwork(settings.count,{seed:settings.seed,economics}));
  return {schema:'supply-yard-paired-v1',settings,strategies:[...strategies],worlds,commonInputKey:commonInputKey(worlds[0]),parameterKey:JSON.stringify({settings,strategies,shocks:SHIFTS}),phase:'ready',paused:false,speed:2,auto:false,betweenTime:0,rounds:[],audit:[]};
}
function checkParameters(p){if(p.parameterKey!==JSON.stringify({settings:p.settings,strategies:p.strategies,shocks:SHIFTS}))throw new Error('Assumptions or policies changed. Reset both worlds before comparing.');}
export function assertMatchedShock(p){
  const [a,b]=p.worlds;
  if(a.shift!==b.shift||a.seed!==b.seed||JSON.stringify(a.economics)!==JSON.stringify(b.economics)||JSON.stringify(profile(a))!==JSON.stringify(profile(b)))throw new Error('The two worlds do not share matched inputs.');
  const shock=w=>({warehouses:w.warehouses.map(s=>[s.id,s.opening,s.successBps]),potentialDemand:w.merchants.map(m=>[m.id,m.requested])});
  if(JSON.stringify(shock(a))!==JSON.stringify(shock(b)))throw new Error('Exogenous shock data differ.');
  for(const m of a.merchants)for(const channel of ['delivery','churn'])if(fixtureDraw(a,m.id,channel)!==fixtureDraw(b,m.id,channel))throw new Error('Paired outcome draws differ.');
  return true;
}
export function startComparisonShift(p){
  if(!['ready','between'].includes(p.phase)||p.rounds.length>=SHIFTS.length)throw new Error('Wait for both worlds to finish this shock.');
  checkParameters(p);
  const [a,b]=p.worlds;if(p.worlds.some(w=>commonInputKey(w)!==p.commonInputKey))throw new Error('Starting inputs differ. Reset both worlds.');
  p.worlds.forEach(beginShift);assertMatchedShock(p);p.phase='running';p.betweenTime=0;p.paused=false;
  p.audit.push({shift:a.shift+1,seed:a.seed,matched:true,potentialUnits:total(a.merchants,'requested'),stock:total(a.warehouses,'opening'),price:SHIFTS[a.shift].price,drawKeys:'seed + merchant id + shift + channel',policies:[...p.strategies]});
}
function prepareAndApply(w,strategy){
  if(strategy==='fixed'){w.plans=[buildFixedPlan(w)];w.phase='review';}
  else{beginDebate(w);while(w.phase==='debate')advanceDebate(w);}
  w.selectedPlan=strategy;
  // The user precommits both scripted policies when starting this local replay.
  applyPlan(w,strategy,'human-reviewer');
}
export function contribution(w){
  const l=w.ledger;return l.feesCollected-l.feesReturned-l.processingCost-l.paypalCoverage-l.agentCost;
}
export function comparisonMetrics(w){
  const openRound=w.shift>=w.history.length;
  const lostUnits=total(w.history,'lostToChurn')+(openRound?(w.lostToChurn||0):0),blockedUnits=total(w.history,'declined')+(openRound?(w.declined||0):0);
  return {captured:w.ledger.captured,feesCollected:w.ledger.feesCollected,feesReturned:w.ledger.feesReturned,netFees:w.ledger.feesCollected-w.ledger.feesReturned,processingCost:w.ledger.processingCost,coverage:w.ledger.paypalCoverage,agentCost:w.ledger.agentCost,net:contribution(w),active:w.merchants.filter(m=>m.active).length,churned:w.merchants.filter(m=>!m.active).length,paused:w.merchants.filter(m=>m.active&&!m.acceptNew).length,delivered:total(w.offices,'received'),lostChurnGMV:lostUnits*5000,blockedGMV:blockedUnits*5000,released:total(w.history,'released')+(openRound&&w.approval?w.applied.released:0)};
}
export function benefitBreakdown(p){
  const [f,a]=p.worlds.map(comparisonMetrics);
  const parts={fees:a.netFees-f.netFees,processing:f.processingCost-a.processingCost,coverage:f.coverage-a.coverage,agentCost:f.agentCost-a.agentCost};
  return {...parts,total:a.net-f.net};
}
export function tickComparison(p,delta){
  if(p.paused)return;
  if(p.phase==='between'&&p.auto){p.betweenTime+=Math.min(.1,Math.max(0,delta))*p.speed;if(p.betweenTime>=2)startComparisonShift(p);return;}
  if(p.phase!=='running')return;
  for(const [i,w] of p.worlds.entries()){
    w.speed=p.speed;tickNetwork(w,delta);
    if(w.phase==='observe')prepareAndApply(w,p.strategies[i]);
  }
  if(p.worlds.every(w=>w.phase==='settled')){
    const metrics=p.worlds.map(comparisonMetrics);
    p.rounds.push({shift:p.worlds[0].shift+1,shock:SHIFTS[p.worlds[0].shift].name,results:p.worlds.map(w=>structuredClone(w.history.at(-1))),cumulative:metrics,benefit:metrics[1].net-metrics[0].net});
    p.phase=p.rounds.length===SHIFTS.length?'complete':'between';p.betweenTime=0;
  }
}
export function exportComparison(p){return {schema:p.schema,settings:{...p.settings},strategies:[...p.strategies],phase:p.phase,shocks:structuredClone(SHIFTS),audit:structuredClone(p.audit),rounds:structuredClone(p.rounds),metrics:p.worlds.map(comparisonMetrics),benefit:benefitBreakdown(p),worlds:p.worlds.map(exportNetwork),scope:'Three-shift paired synthetic replay, not real PayPal policy or measured ROI. Net contribution = collected fees - returned fees - processing costs - eligible refund coverage - assumed agent review costs. Churn removes later volume and fees; no additional lifetime-value penalty or terminal bonus is included. The two worlds share potential demand, supply shocks and keyed random draws; policies change realized volume, fulfillment and departure probabilities. The original scripted coordinator heuristic is evaluated without optimizing or forcing this net-benefit result.'};}
