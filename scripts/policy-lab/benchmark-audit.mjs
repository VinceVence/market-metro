import {validatePolicyDecision} from './service.mjs';
import {mean,quantile} from './benchmark-stats.mjs';

export function contractChecks(){
  const packet={asOfDay:30,evidenceIds:['snapshot-30'],proposal:{merchantIndices:[1],maxOfferPct:5,epsilon:.1}};
  const science={asOfDay:30,rationale:'Test the supplied mature evidence.',evidenceIds:['snapshot-30'],strategy:'mixed',audience:'lapsed',merchantIndices:[1],maxOfferPct:5,windowDays:42,epsilon:.1,retrain:true};
  const review={asOfDay:30,rationale:'Narrow the supplied proposal.',evidenceIds:['snapshot-30'],decision:'narrow',merchantIndices:[1],maxOfferPct:5,epsilon:.1};
  const cases=[
    ['valid mixed plan','Experiment scientist',science,true],
    ['valid no-coupon recommendation','Experiment scientist',{...science,strategy:'recommendations',maxOfferPct:0},true],
    ['valid observation','Experiment scientist',{...science,strategy:'observe',merchantIndices:[],maxOfferPct:0},true],
    ['valid review','Outcome reviewer',review,true],
    ['future snapshot','Experiment scientist',{...science,asOfDay:55},false],
    ['unseen evidence ID','Experiment scientist',{...science,evidenceIds:['future']},false],
    ['missing evidence','Experiment scientist',{...science,evidenceIds:[]},false],
    ['unsupported window','Experiment scientist',{...science,windowDays:30},false],
    ['coupon on recommendations','Experiment scientist',{...science,strategy:'recommendations'},false],
    ['unbounded discount','Experiment scientist',{...science,maxOfferPct:100},false],
    ['invalid exploration','Experiment scientist',{...science,epsilon:.9},false],
    ['unknown merchant','Experiment scientist',{...science,merchantIndices:[3]},false],
    ['duplicate merchant','Experiment scientist',{...science,merchantIndices:[1,1]},false],
    ['payment authority injection','Experiment scientist',{...science,capturePayment:true},false],
    ['review widens merchants','Outcome reviewer',{...review,merchantIndices:[0,1]},false],
    ['review widens discount','Outcome reviewer',{...review,maxOfferPct:10},false],
    ['review widens exploration','Outcome reviewer',{...review,epsilon:.2},false]
  ];
  return cases.map(([name,role,decision,expectedAccepted])=>{
    let accepted=true;try{validatePolicyDecision(role,decision,packet);}catch{accepted=false;}
    return {name,expectedAccepted,accepted,passed:accepted===expectedAccepted};
  });
}

export function agentAudit(report){
  const calls=report.checkpoints.filter(c=>c.actor==='GEMINI_3_1_FLASH_LITE');
  const latency=calls.map(c=>(Date.parse(c.finished_at)-Date.parse(c.created_at))/1000).filter(Number.isFinite);
  const publications=report.checkpoints.filter(c=>c.output?.status==='PUBLISHED');
  const guards=contractChecks();
  // Explicit reviewer annotations of this recorded trace, not an automated judge
  // or an estimate of semantic accuracy on a population of agent decisions.
  const annotations=[
    {suffix:'REVIEW-3-GROWTH',finding:'Trend described as a decline despite 119 recent purchases versus 111 previous purchases.',verdict:'NUMERICAL_CONTRADICTION'},
    {suffix:'REVIEW-3-REVIEW',finding:'Reward-prediction MSE used as support for a policy; prediction error does not establish incremental campaign value.',verdict:'UNSUPPORTED_INFERENCE'},
    {suffix:'FINAL-REVIEW',finding:'Claimed organic had the highest merchant contribution; the rules branch was higher.',verdict:'WRONG_METRIC_RANKING'},
    {suffix:'FINAL-REVIEW-CORRECTION',finding:'Claimed strategy changes prevented stabilization without a causal ablation.',verdict:'UNTESTED_EXPLANATION'}
  ].map(a=>({...a,checkpoint:report.checkpoints.find(c=>c.checkpoint_id.endsWith('-'+a.suffix))?.checkpoint_id||null}));
  return {sourceRunId:report.runId,attempts:calls.length,rejectedAttempts:calls.filter(c=>c.status==='FAILED').length,
    correctionCalls:calls.filter(c=>c.checkpoint_id.endsWith('-CORRECTION')).length,
    costUSD:calls.reduce((s,c)=>s+c.cost_micros,0)/1e6,costBasis:'Provider token estimate, not a billing invoice',
    callLatencySeconds:{mean:mean(latency),p95:quantile(latency,.95)},
    publicationDelays:publications.map(c=>({evidenceDay:c.output.policy.asOfDay,publishedDay:c.output.policy.effectiveDay,delayDays:c.output.policy.effectiveDay-c.output.policy.asOfDay})),
    roleCounts:['Growth investigator','Experiment scientist','Outcome reviewer'].map(role=>({role,accepted:calls.filter(c=>c.role===role&&c.status==='COMPLETED').length,rejected:calls.filter(c=>c.role===role&&c.status==='FAILED').length})),
    guardTests:guards,guardSummary:{cases:guards.length,falseAccepts:guards.filter(g=>g.accepted&&!g.expectedAccepted).length,falseRejects:guards.filter(g=>!g.accepted&&g.expectedAccepted).length},
    semanticReview:{method:'Manual, non-exhaustive source-trace annotations. Structural validity is not factual correctness.',findings:annotations,accuracy:null},
    localFits:report.models,scope:'One recorded live run. No new agent calls during the benchmark.'};
}
