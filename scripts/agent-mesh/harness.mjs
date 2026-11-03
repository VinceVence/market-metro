import {createHash} from 'node:crypto';

export const HARNESS_LIMITS=Object.freeze({pilotDays:7,jointPilotBudgetCents:500,maxEvidenceAgeDays:14,maxProposalRevisions:1});
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');

// Evidence is supplied by the trusted paired evaluator, never by an LLM response.
// A profitable short pilot is insufficient: the old100-day win reversed at200.
export function durableReleaseGate(evidence,expectedPolicyHash){
  const issues=[];
  if(!evidence)return {status:'BLOCKED',issues:['No independent long-horizon confirmation for this exact policy.'],scope:'SCALE_UP_ONLY',pilotAllowed:true};
  if(!expectedPolicyHash||evidence.policyHash!==expectedPolicyHash)issues.push('The evaluated policy does not match the executable policy.');
  if(evidence.source!=='INDEPENDENT_PAIRED_SIMULATION'||evidence.selectedBeforeTest!==true)issues.push('Policy selection must precede independent paired test outcomes.');
  if(!Number.isInteger(evidence.seeds)||evidence.seeds<8||!Number.isInteger(evidence.scenarios)||evidence.scenarios<3)issues.push('Need at least8 independent seed clusters and3 scenarios.');
  if(!Number.isFinite(evidence.shoppingDays)||!Number.isFinite(evidence.lastCampaignDay)||evidence.shoppingDays-evidence.lastCampaignDay<100)issues.push('Need at least100 shopping days after outreach stops.');
  if(evidence.mature!==true||evidence.integrityPassed!==true)issues.push('All financial outcomes and integrity checks must be complete.');
  if(!Number.isFinite(evidence.platformAfterCost?.low)||evidence.platformAfterCost.low<=0)issues.push('The platform lower95% bound after all costs must be above zero.');
  if(!Number.isFinite(evidence.merchant?.low)||evidence.merchant.low<0)issues.push('The merchant lower95% bound must be nonnegative.');
  return {status:issues.length?'BLOCKED':'PASS',issues,scope:'SIMULATION_SCALE_UP_ONLY',pilotAllowed:true,
    disclosure:'Conditional simulation evidence. This gate cannot establish real PayPal profit or authorize native payments.'};
}
export function policyIdentity(plan){
  return hash(['strategy','audience','merchantIndices','maxOfferPct','windowDays','epsilon','asOfDay'].map(k=>[k,plan[k]]));
}

// A diagnostic screen, not a causal forecast. The frozen model still decides
// individual actions. Positive historical action means do not establish lift.
export function campaignPreflight(plan,facts){
  const issues=[],warnings=[],checks=[];
  if(plan.strategy==='observe')return {status:'OBSERVE',issues,warnings,checks,policyHash:policyIdentity(plan)};
  if(facts.modelCheck&&!facts.modelCheck.beatConstant)warnings.push('The fitted predictor did not beat its constant baseline. Do not claim model superiority.');
  if(plan.strategy==='mixed'&&plan.maxOfferPct>0){
    for(const index of plan.merchantIndices){
      const merchant=facts.caps.merchants.find(m=>m.index===index),cap=Math.min(plan.maxOfferPct,merchant?.maxOfferPct??0);
      for(const pct of [5,10].filter(p=>p<=cap)){
        const action=`coupon${pct}:${index}`,row=facts.randomizedEffects.find(r=>r.audience===plan.audience&&r.action===action);
        const supported=Boolean(row&&row.treated.observations>=20&&row.control.observations>=20&&row.directRewardDifferenceCents>0);
        checks.push({action,effectiveCap:cap,treated:row?.treated.observations??0,control:row?.control.observations??0,directDifferenceCents:row?.directRewardDifferenceCents??null,supported});
        if(!supported)issues.push({code:'COUPON_VALUE_UNSUPPORTED',action,message:`${action} lacks positive mature randomized-history evidence with at least20 observations in each arm. Revise to recommendations/observe or remove this merchant; permission to discount is not evidence of value.`});
      }
    }
  }
  warnings.push('Historical evidence is a screening diagnostic, not full-policy incrementality. Any active release is a limited experiment, never a proven profitable rollout.');
  return {status:issues.length?'REVISE':'PILOT_ONLY',issues,warnings,checks,policyHash:policyIdentity(plan),limits:HARNESS_LIMITS};
}

export function publicationCheck(plan,facts,{currentDay,announcements=[]}){
  const result=campaignPreflight(plan,facts),issues=[...result.issues];
  if(plan.strategy!=='observe'){
    if(currentDay-plan.asOfDay>HARNESS_LIMITS.maxEvidenceAgeDays)issues.push({code:'STALE_ANALYSIS',message:'Analysis is older than the14-day release window.'});
    for(const event of announcements){
      // Parse only an explicit date in an already observed announcement. Never
      // read the simulator's hidden future or interpret text as instructions.
      const end=String(event.text??event.change??'').match(/through\s*day\s*(\d+)/i);
      if(event.day>=plan.asOfDay&&event.day<currentDay||end&&Number(end[1])>plan.asOfDay&&Number(end[1])<=currentDay)
        issues.push({code:'MARKET_CHANGED',message:'A market announcement began or ended after this analytical snapshot. Collect a new snapshot before release.'});
    }
  }
  return {...result,status:issues.length?'BLOCKED':result.status,issues,checkedAtDay:currentDay};
}

export function saveHarnessCheckpoint(store,id,key,input,output){
  const prior=store.db.prepare('SELECT input_hash,output_json FROM policy_lab_checkpoints WHERE checkpoint_id=?').get(key),inputHash=hash(input);
  if(prior){if(prior.input_hash!==inputHash||hash(JSON.parse(prior.output_json))!==hash(output))throw Error('HARNESS_CHECKPOINT_CONFLICT');return;}
  const w=store.state(id),stamp=new Date().toISOString();
  store.insert('policy_lab_checkpoints',[{checkpoint_id:key,run_id:id,review_no:w.policyLab.reviewNo,day:w.tick,role:'Campaign harness',actor:'LOCAL_POLICY_GATE',status:'COMPLETED',input_hash:inputHash,input_json:JSON.stringify(input),output_json:JSON.stringify(output),provider_json:null,cost_micros:0,created_at:stamp,finished_at:stamp}]);
}

export function authorizePilot(store,id,reviewKey,plan,gate){
  if(gate.status==='BLOCKED'||gate.status==='REVISE')throw Error('BLOCKED_PILOT');
  const w=store.state(id),spent=w.live.discountCents+w.live.spendCents;
  const authorization={status:plan.strategy==='observe'?'OBSERVE':'PILOT_AUTHORIZED',policyHash:policyIdentity(plan),
    publicationKey:reviewKey.replace(/-REVIEW(?:-CORRECTION)?$/,'-PUBLISH'),issuedDay:w.tick,expiresDay:w.tick+HARNESS_LIMITS.pilotDays,
    budgetBeforeCents:w.goal.budgetCents,budgetCeilingCents:Math.min(w.goal.budgetCents,spent+HARNESS_LIMITS.jointPilotBudgetCents),
    scope:'SIMULATED_EXPERIMENT_ONLY',profitProven:false,paypalAuthority:false};
  saveHarnessCheckpoint(store,id,reviewKey+'-AUTHORIZATION',{plan,gate},authorization);return authorization;
}

// Runs before every market tick, including the automatic clock. The frozen
// engine enforces its existing per-action budget and merchant constraints.
export function enforcePilot(store,id){
  const w=store.state(id);if(!w?.policyLab?.plan)return;
  const row=store.db.prepare("SELECT checkpoint_id,output_json FROM policy_lab_checkpoints WHERE run_id=? AND role='Campaign harness' AND checkpoint_id LIKE '%-AUTHORIZATION' AND json_extract(output_json,'$.publicationKey')=? ORDER BY rowid DESC LIMIT 1").get(id,w.policyLab.policyVersion);
  if(!row)return;
  const a=JSON.parse(row.output_json),lab=w.policyLab;
  if(a.publicationKey!==lab.policyVersion||a.status==='OBSERVE'||lab.plan.strategy==='observe')return;
  const expired=w.tick>=a.expiresDay,changed=policyIdentity(lab.plan)!==a.policyHash;
  if(expired||changed){
    const reason=changed?'POLICY_IDENTITY_CHANGED':'PILOT_EXPIRED';
    lab.plan={...lab.plan,strategy:'observe',maxOfferPct:0,merchantIndices:[],epsilon:0};
    w.goal.budgetCents=a.budgetBeforeCents;
    saveHarnessCheckpoint(store,id,row.checkpoint_id+'-STOP',{authorization:row.checkpoint_id},{status:reason,day:w.tick,shoppingContinues:true});
  }else w.goal.budgetCents=Math.min(w.goal.budgetCents,a.budgetCeilingCents);
  store.saveState(w);
}
