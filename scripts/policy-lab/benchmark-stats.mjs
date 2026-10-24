// Paired, seed-clustered uncertainty. Shopper rows are not independent experiments.
import {draw} from '../marketing/economy.mjs';

export const mean = xs => xs.reduce((a,b)=>a+b,0)/xs.length;
export function quantile(xs,p){
  if(!xs.length)return null;
  const sorted=[...xs].sort((a,b)=>a-b),i=(sorted.length-1)*p,k=Math.floor(i);
  return sorted[k]+(sorted[Math.ceil(i)]-sorted[k])*(i-k);
}
export function pairedEstimate(rows,field,{resamples=2000,seed=719}={}){
  if(!rows.length)throw Error('EMPTY_BENCHMARK_SAMPLE');
  const groups=new Map();
  for(const r of rows){if(!Number.isFinite(r[field]))throw Error('NONFINITE_BENCHMARK_METRIC');const g=groups.get(r.seed)||[];g.push(r[field]);groups.set(r.seed,g);}
  // Equal scenario weights within each seed, then equal weights across seeds.
  const values=[...groups.values()].map(mean),center=mean(values);
  const boot=values.length<2?[]:Array.from({length:resamples},(_,b)=>mean(values.map((_,i)=>values[Math.floor(draw(seed,'bootstrap',b,i)*values.length)])));
  return {mean:center,low:quantile(boot,.025),high:quantile(boot,.975),seeds:values.length,cases:rows.length,
    winRate:rows.filter(r=>r[field]>0).length/rows.length,worst:Math.min(...rows.map(r=>r[field])),
    worstDecileMean:mean(rows.map(r=>r[field]).sort((a,b)=>a-b).slice(0,Math.max(1,Math.ceil(rows.length*.1)))),
    interval:'95% percentile bootstrap over seed clusters; scenarios equally weighted; conditional on these five scenarios'};
}

export function compareBranches(branches){
  const organic=branches.find(b=>b.policy==='organic'),rules=branches.find(b=>b.policy==='rules_matched');
  if(!organic||!rules)throw Error('MISSING_PAIRED_BASELINE');
  return branches.map(b=>({...b,
    deltaPlatformUSD:(b.platformProxyCents-organic.platformProxyCents)/100-b.allocatedModelUSD,
    deltaVsRulesUSD:(b.platformProxyCents-rules.platformProxyCents)/100-b.allocatedModelUSD+rules.allocatedModelUSD,
    deltaMerchantUSD:(b.merchantContributionCents-organic.merchantContributionCents)/100,
    deltaVolumeUSD:(b.retainedCents-organic.retainedCents)/100,
    deltaReactivated:b.reactivatedCustomers-organic.reactivatedCustomers,
    daily:b.daily.map((d,i)=>({...d,deltaPlatformUSD:(d.platformProxyCents-organic.daily[i].platformProxyCents)/100-d.allocatedModelUSD,
      deltaVsRulesUSD:(d.platformProxyCents-rules.daily[i].platformProxyCents)/100-d.allocatedModelUSD+rules.daily[i].allocatedModelUSD}))
  }));
}

export function recoveryMetric(daily,{shockDay=36,window=7,sustain=14}={}){
  const increments=daily.map((d,i)=>d.deltaPlatformUSD-(i?daily[i-1].deltaPlatformUSD:0));
  let onset=null,streak=0;
  for(let i=window-1;i<daily.length;i++){
    if(daily[i].day<shockDay)continue;
    const average=mean(increments.slice(i-window+1,i+1));
    if(onset===null){if(average<0)onset=daily[i].day;continue;}
    streak=average>=0?streak+1:0;
    if(streak>=sustain)return {status:'RECOVERED',lossOnsetDay:onset,confirmedRecoveryDay:daily[i].day,daysToConfirmation:daily[i].day-onset};
  }
  return {status:onset===null?'NO_OBSERVED_SHORTFALL':'CENSORED',lossOnsetDay:onset,confirmedRecoveryDay:null,daysToConfirmation:null};
}

export function benchmarkGates(estimate,{minimumGainUSD,maxMerchantLossUSD,maxWorstCaseLossUSD},integrityPassed){
  return [
    {id:'economic',label:'Additional modeled PayPal value',status:estimate.deltaPlatformUSD.low===null?'INSUFFICIENT_DATA':estimate.deltaPlatformUSD.low>minimumGainUSD?'PASS':'NOT_DEMONSTRATED',rule:`95% lower bound above $${minimumGainUSD} per 100 shoppers over 70 campaign days`},
    {id:'rules',label:'Value beyond matched rules',status:estimate.deltaVsRulesUSD.low===null?'INSUFFICIENT_DATA':estimate.deltaVsRulesUSD.low>minimumGainUSD?'PASS':'NOT_DEMONSTRATED',rule:`95% lower bound above $${minimumGainUSD} versus rules with the same local learner`},
    {id:'merchant',label:'Merchant economics',status:estimate.deltaMerchantUSD.low===null?'INSUFFICIENT_DATA':estimate.deltaMerchantUSD.low>=-maxMerchantLossUSD?'PASS':'NOT_DEMONSTRATED',rule:`95% lower bound no worse than −$${maxMerchantLossUSD} aggregate merchant contribution`},
    {id:'tail',label:'Worst-case loss',status:estimate.deltaPlatformUSD.worst>=-maxWorstCaseLossUSD?'PASS':'FAIL',rule:`Worst observed case no worse than −$${maxWorstCaseLossUSD}; not a guarantee about unseen cases`},
    {id:'integrity',label:'Accounting, maturity and authority',status:integrityPassed?'PASS':'FAIL',rule:'Zero accounting, eligibility, inventory, maturity or virtual budget violations'},
    {id:'mesh',label:'Autonomous multi-agent advantage',status:'NOT_TESTED',rule:'Needs fresh agent and single-planner trials on unseen evidence with matched tools and budgets'},
    {id:'calibration',label:'Real-world validity',status:'NOT_VALIDATED',rule:'Needs observed behavioral calibration; catalog and sandbox receipts alone are insufficient'}
  ];
}
