import {WorkflowError} from './workflow.mjs';

// A transparent, deterministic rehearsal of the research architecture.
// The existing workflow owns training, evidence, permissions and payment effects.
export function createCampaignDemo({workflow,market}) {
  const last=(c,action)=>c.checkpoints.filter(x=>x.action===action&&x.status==='COMPLETED').at(-1);
  function snapshot(id) {
    const c=workflow.context(id);
    if(c.planner!=='SCRIPTED_DEMO')throw new WorkflowError(409,'NOT_A_DEMO','Open this campaign in the campaign room.');
    const done=c.checkpoints.filter(x=>x.status==='COMPLETED'),latest=done.at(-1);
    const shoppers=workflow.customers(id),native=c.nativePayments.lineage;
    const featured=native[0]?.customer_id||shoppers.find(u=>u.redemptions>0)?.customerId||shoppers.find(u=>u.coupons>0)?.customerId;
    const frame=market.frame(c.runId,latest?.output?.activities||[]);
    const products=frame.products.filter(p=>!c.activePlan||c.activePlan.plan.merchantIds.includes(p.merchant_id)).slice(0,4);
    const model=last(c,'train')?.output;
    const holdoutCoupons=shoppers.filter(u=>u.arm==='HOLDOUT').reduce((n,u)=>n+u.coupons,0);
    return {context:c,frame,products,shoppers:shoppers.filter(u=>u.redemptions>0||u.nativeReceipts>0).sort((a,b)=>b.nativeReceipts-a.nativeReceipts||b.redemptions-a.redemptions).slice(0,6),
      featured:featured?workflow.trace(id,featured):null,
      checks:{holdoutCoupons,traceRows:shoppers.reduce((n,u)=>n+u.decisionCount,0),budgetSpentCents:frame.live.budgetSpentCents,budgetLimitCents:c.goal.budgetCents,modelFits:c.modelSummaries.length},
      research:{Jev:'Rules occupy the router slot; no Jev inference is called.',MLE_STAR:'Real local logistic/tree fitting; search and generated feature refinement are not implemented.',Harness2:'A saved lesson and checkpoint replay; no automatic harness rewriting is implemented.'},
      model: model?{type:model.model_type,loss:model.validation_log_loss,baseline:model.baseline_log_loss,trainingRows:model.training_rows,validationRows:model.validation_rows,candidates:model.candidates}:null};
  }
  function choose(c) {
    const p=c.phase;
    if(p==='GOAL_SET')return ['prepare_history',{},'Observe 28 days before fitting or offering anything. The cached Channel3 catalog supplies products, not customer behavior.'];
    if(p==='HISTORY_READY')return ['analyze',{windowDays:14,cuts:['merchants','products','market','offers']},'Compare merchant activity, product margins and availability before choosing an audience.'];
    if(p==='ANALYZED')return ['train',{windowDays:28,modelTypes:['logistic','tree']},'Fit logistic regression and a decision tree locally, using later days for validation. No paid model API is involved.'];
    if(p==='MODEL_READY') {
      const model=last(c,'train')?.output;
      if(!model?.qualified)throw new WorkflowError(409,'DEMO_MODEL_NOT_QUALIFIED','The candidate did not pass validation. The demo will not invent a passing model.');
      const a=last(c,'analyze')?.output;
      const ids=a.merchants.filter(m=>m.purchases>0&&a.products.some(p=>p.merchantId===m.value&&p.stock>0&&p.margin5>=.2)).map(m=>m.value);
      if(!ids.length)throw new WorkflowError(409,'NO_ELIGIBLE_MERCHANTS','Observed activity and margins do not support a coupon campaign.');
      return ['draft_campaign',{title:'A little reason to return',message:'Something lovely for your desk. A small welcome-back treat, just for you.',modelId:model.modelId,merchantIds:ids,offerOptions:[5,10],minRecencyDays:3,minExpectedGainCents:25,ranking:'incremental_purchase_probability',durationDays:14},
        'Choose merchants with observed purchases and viable product margins. Offer 5% or 10% only when local model scores and hard guards allow it.'];
    }
    if(p==='PLAN_VALIDATED')return ['launch',{planId:c.draftPlan.plan_id},'Launch the validated 14-day plan. Keep the randomized holdout, seven-day contact gap and $300 virtual budget.'];
    if(p==='RUNNING') {
      if(c.attention) {
        const a=last(c,'analyze');
        if(a?.output?.cutoffExclusive!==c.day)return ['analyze',{windowDays:14,cuts:['market','merchants','offers']},'The rival promotion changed. Inspect both weeks before accepting a bigger coupon or another model fit.'];
        return ['review',{decision:'continue'},'The campaign designer proposes bigger offers; the model engineer proposes retraining. Only one post-change day is observed, so the scripted coordinator keeps the qualified model and existing limits while collecting more outcomes.'];
      }
      return ['advance',{days:Math.min(7,c.endDay-c.day)},'Deliver model-scored coupons, let independent seeded shoppers respond, and save every decision. Stop if a new market signal requires review.'];
    }
    if(p==='OUTCOMES_READY') {
      if(!c.settled)return ['settle',{},'Stop issuing new coupons and allow two follow-up days for delivery and refund outcomes.'];
      if(c.goal.nativeSamples&&c.nativePayments.completed<c.goal.nativeSamples) {
        const ids=c.nativePayments.receipts.map(r=>r.order_id);
        for(const o of c.nativePayments.candidates)if(o.coupon_id&&ids.length<c.goal.nativeSamples)ids.push(o.order_id);
        if(ids.length!==c.goal.nativeSamples)throw new WorkflowError(409,'NO_COUPON_SAMPLE','No eligible redeemed coupon order is available. No substitute payment has been fabricated.');
        return ['capture_samples',{orderIds:ids},'Mirror this existing redeemed coupon order into PayPal Sandbox using saved consent. Verify its amount and capture ID; do not add the payment to simulated revenue again.'];
      }
      return ['evaluate',{},'Measure the actual campaign cohort, cost, coupons and holdout difference. A redeemed offer does not prove that a shopper was saved from churn.'];
    }
    if(p==='EVALUATED')return ['complete',{},'Save the final campaign record and verified receipts. Replaying the story must reuse these results without issuing coupons or capturing again.'];
    if(p==='COMPLETED')return null;
    throw new WorkflowError(409,'DEMO_PAUSED','This workflow requires an explicit review before continuing.');
  }
  return {
    snapshot,
    start(input) {
      if(!input||Object.keys(input).some(k=>!['requestId','seed','nativeSamples'].includes(k))||![0,1].includes(input.nativeSamples))throw new WorkflowError(400,'INVALID_DEMO','Choose zero or one sandbox sample.');
      if(input.nativeSamples&&!market.status().funding.ready)throw new WorkflowError(409,'BUYER_NOT_READY','The saved sandbox buyer is not ready. The existing receipt demo remains available.');
      const c=workflow.create({requestId:input.requestId,seed:input.seed,customerCount:300,budgetCents:30000,objective:'retention',scenario:'rival_sale',nativeSamples:input.nativeSamples,actor:'scripted_demo',mission:'Bring established simulated shoppers back with a bounded fourteen-day campaign; investigate an observed rival sale, train local models and trace a redeemed coupon into PayPal Sandbox.'});
      return snapshot(c.workflowId);
    },
    async next(id,revision) {
      const c=workflow.context(id);
      if(c.planner!=='SCRIPTED_DEMO')throw new WorkflowError(409,'NOT_A_DEMO','This campaign is owned by its original planner.');
      if(!Number.isInteger(revision)||revision<0||revision>c.revision)throw new WorkflowError(409,'STALE_DEMO','Reload the saved demo checkpoint.');
      // A double click or late retry cannot advance the story twice.
      if(revision<c.revision||c.phase==='COMPLETED')return {...snapshot(id),replayed:true};
      const pending=c.pendingRequest||c.checkpoints.find(x=>x.status==='FAILED'&&x.input.expectedRevision===revision)?.input;
      let input=pending;
      if(!input) {
        const [action,parameters,rationale]=choose(c);
        input={requestId:'demo-'+revision+'-'+action,expectedRevision:revision,contextHash:c.contextHash,action,parameters,rationale,
          evidenceIds:c.checkpoints.filter(x=>x.status==='COMPLETED').slice(-3).map(x=>x.checkpoint_id),actor:'scripted_demo'};
      }
      await workflow.step(id,input);
      return snapshot(id);
    }
  };
}

