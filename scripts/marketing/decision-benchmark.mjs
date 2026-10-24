import {randomBytes} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createMarketStore} from '../market-store.mjs';
import {SAMPLE_PRODUCTS} from '../../demo/market/engine.mjs';
import {createLearningMarket,advanceLearningDay,scoreOffers,draw} from './economy.mjs';
import {createLearningRunner} from './orchestrator.mjs';
import {trainLocal,localTrainerStatus} from './trainer.mjs';
import {predict} from './contract.mjs';
import {ACTIONS,ACTION_CONTRACT,digest,evidenceHash,validateDecision,proposeOffer,makeOfferPolicy} from './decision-actions.mjs';
import {strongRules} from './decision-rules.mjs';

export const PROTOCOL={
  version:'marketing-decision-pilot-v1',caseCount:12,customers:400,merchants:8,horizonDays:7,futureReplicates:16,
  objective:'Maximize the reviewed merchant contribution after modeled operating costs; report effects on other merchants separately.',
  trial:'EXPLORATORY_DEVELOPER_ASSISTED_CHAT_REVIEW_NOT_BLINDED',
  identicalInputs:'Exactly the same frozen packet, forecasts, model candidates, action menu and execution guards.',
  policyChanges:'Only the reviewed merchant changes its coupon policy. No further model fitting during the seven-day replay.',
  economicMistake:'Action loses more than $5 mean merchant contribution versus KEEP_CURRENT and the paired replay 95% interval is entirely below zero. This is an outcome diagnostic, not a ground-truth reasoning label.',
  hindsightRegret:'Difference from the best allowed action averaged over these same future tapes. Optimistic post-hoc diagnostic; never an achievable-agent claim.',
  goGate:{minimumNetImprovementPct:5,pairedCaseBootstrapLowMustExceedZero:true,executedGuardViolations:0,portfolioMeanMustNotDecline:true},
  assumedCosts:{computeUsdPerHour:.10,chatReviewUsdPerCase:.10,humanReviewMinutesPerEscalation:5,humanUsdPerHour:30},
  costCaveat:'No new paid API calls. Current-chat token usage/account charge and electricity are unmetered. Cost totals are explicitly modeled, with a chat-price sensitivity table. Benchmark replay time is evaluation overhead, not deployment cost.',
  accounting:'Sales already reflect redeemed discounts. Deduct refunds, COGS, delivery, modeled fees and outreach once. Final pending refunds for evaluation orders are settled. No 14-day retention benefit is claimed.',
  paypal:'All replay payments and fees are synthetic. Existing native sandbox samples prove integration only. No PayPal or Channel3 requests in this benchmark.',
  exclusions:'No novelty claim, production ROI, live traffic experiment, adaptive tool selection, independent agent team, or blinded generalization proof.'
};
export const SOURCE_FILES=['scripts/marketing/decision-actions.mjs','scripts/marketing/decision-rules.mjs','scripts/marketing/decision-benchmark.mjs','scripts/marketing-decision-benchmark.mjs','scripts/marketing/economy.mjs','scripts/marketing/contract.mjs','scripts/marketing/train.py','scripts/marketing/trainer.mjs','scripts/marketing/orchestrator.mjs','scripts/market-store.mjs','demo/market/engine.mjs'];
export async function sourceHashes(){return Object.fromEntries(await Promise.all(SOURCE_FILES.map(async f=>[f,digest(await readFile(f,'utf8'))])));}
export const mean=a=>a.reduce((s,x)=>s+x,0)/Math.max(1,a.length);
export const interval=a=>{const m=mean(a),se=a.length>1?Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/(a.length-1)/a.length):0;return {mean:m,low:m-1.96*se,high:m+1.96*se};};
const fee=n=>Math.max(0,Math.round(n*.0349)+49);
const sum=(a,k)=>a.reduce((n,r)=>n+(r[k]||0),0);
const money=n=>'$'+(n/100).toFixed(2);
const plain=o=>JSON.parse(JSON.stringify(o));
const decision=(p,action,rationale='Replay diagnostic for an allowed action, not a controller recommendation.')=>({schema:ACTION_CONTRACT.schema,caseId:p.caseId,evidenceHash:p.evidenceHash,merchantId:p.merchantId,action,evidenceIds:['forecasts'],rationale});

function forecast(world,rows,candidate,products,armRates){
  const reference=candidate.status==='PROMOTED'?candidate.artifact:world.champion?.artifact;
  const byId=new Map(products.map(p=>[p.product_id,p]));
  const targetable=new Set(world.customers.filter(u=>u.arm==='TARGETABLE').map(u=>u.customer_id));
  // Same observed rows for every action; these are model estimates, NOT causal results or confidence bounds.
  const eligible=rows.filter(r=>targetable.has(r.customer_id)&&r.offers_7d===0&&r.stock_available);
  const options=ACTIONS.filter(a=>a!=='USE_RECENT_MODEL'||candidate.status==='PROMOTED').map(action=>{
    let value=0,contacts=0;
    for(const f of eligible){
      const product=byId.get(f.product_id),score=scoreOffers(world,f,product);
      const current=score?.offer??(f.recency_days>=5&&f.purchases_7d<2?10:f.recency_days>=3?5:0);
      let {offer}=proposeOffer(action,{features:f,product,offer:current,score,modelId:world.champion?.id},candidate,world.goal);
      let net=product.price_cents-Math.round(product.price_cents*offer/100);
      if((net-product.cost_cents-fee(net)-350)/net<world.goal.minMargin){offer=0;net=product.price_cents;}
      const probability=reference?predict(reference,f,offer):armRates[offer];
      value+=probability*(net-product.cost_cents-fee(net)-350-net*.025)-(offer?2:0);contacts+=Number(offer>0);
    }
    return {action,estimatedContributionCents:Math.round(value),proposedContacts:contacts};
  });
  const keep=options.find(o=>o.action==='KEEP_CURRENT').estimatedContributionCents;
  return {basis:'Static replay of eligible observed rows from the latest seven complete label days. Latest validated model, otherwise the champion, otherwise smoothed randomized arm rates. Assumes 2.5% returns. Does not model future depletion, contact changes or shared-budget spillovers. Not a calibrated causal effect.',observedEligibleRows:eligible.length,options:options.map(o=>({...o,estimatedGainVsKeepCents:o.estimatedContributionCents-keep}))};
}

function packetFor(world,store,candidate,{caseId,merchantId,labelCutoff,fitMs}){
  const products=world.products.filter(p=>p.merchant_id===merchantId),ids=new Set(products.map(p=>p.product_id));
  const all=store.db.prepare('SELECT * FROM customer_days WHERE run_id=? AND day<? ORDER BY day,customer_id').all(world.runId,labelCutoff).filter(r=>ids.has(r.product_id));
  const recent=all.filter(r=>r.day>=labelCutoff-7),previous=all.filter(r=>r.day>=labelCutoff-14&&r.day<labelCutoff-7);
  const history=all.filter(r=>r.phase==='HISTORY'&&Math.abs(r.assignment_probability-1/3)<1e-9);
  const arms=[0,5,10].map(pct=>{const r=history.filter(r=>r.offered_pct===pct);return {offerPct:pct,observations:r.length,purchases:sum(r,'purchased'),conversion:r.length?sum(r,'purchased')/r.length:null};});
  const armRates=Object.fromEntries(arms.map(a=>[a.offerPct,(a.purchases+1)/(a.observations+2)]));
  const orders=store.db.prepare('SELECT * FROM orders WHERE run_id=? AND merchant_id=?').all(world.runId,merchantId);
  const dayOf=o=>Math.round((Date.parse(o.event_ts)-Date.parse(world.startedAt))/86400000);
  const transactions=store.db.prepare('SELECT * FROM transactions WHERE run_id=? AND merchant_id=?').all(world.runId,merchantId);
  const reconciled=transactions.every(t=>t.gross_cents===t.fee_cents+t.net_cents)&&transactions.length===orders.length;
  const period=(start,end)=>{const r=orders.filter(o=>dayOf(o)>=start&&dayOf(o)<end);return {orders:r.length,discountedSalesCents:sum(r,'total_cents'),discountsCents:sum(r,'discount_cents')};};
  const rates=r=>({observations:r.length,visits:sum(r,'visited'),purchases:sum(r,'purchased'),offers:r.filter(x=>x.offered_pct>0).length,redemptions:sum(r,'redeemed'),stockAvailableRate:r.length?sum(r,'stock_available')/r.length:null,observableRivalPromotionRate:r.length?sum(r,'rival_sale')/r.length:null});
  const p={caseId,runId:world.runId,merchantId,merchantName:world.merchants.find(m=>m.merchant_id===merchantId).name,day:world.tick,horizonDays:PROTOCOL.horizonDays,objective:'profit',
    provenance:'Generated Market Metro observations and real local scikit-learn artifacts. No provider data fetched for this case.',
    constraints:{minMargin:world.goal.minMargin,contactGapDays:world.goal.contactGap,persistentHoldoutPct:25,budgetRemainingCents:world.goal.budgetCents-world.live.discountCents-world.live.spendCents,sharedBudget:true},
    allowedActions:ACTIONS.filter(a=>a!=='USE_RECENT_MODEL'||candidate.status==='PROMOTED'),
    evidence:{
      quality:{latestClosedDay:world.tick-1,completeLabelsThroughDay:labelCutoff-1,labelLagDays:world.tick-labelCutoff,paymentReconciled:reconciled,capturesAwaitingOutcomeLabels:orders.filter(o=>dayOf(o)>=labelCutoff).length,note:labelCutoff<world.tick?'Outcome labels are delayed; missing labels were excluded, never converted to failures. The independent simulated payment ledger is current.':'Payment and outcome records are current through the latest closed day.'},
      payments:{source:'SIMULATED_PAYMENT_LEDGER',recent7:period(world.tick-7,world.tick),previous7:period(world.tick-14,world.tick-7)},
      outcomes:{recent7CompleteDays:rates(recent),previous7CompleteDays:rates(previous),randomizedHistory:arms,caution:'Recent targeted conversion and redemption rates are not randomized estimates of coupon benefit.'},
      economics:{products:products.map(p=>{const margin=pct=>{const n=p.price_cents-Math.round(p.price_cents*pct/100);return (n-p.cost_cents-fee(n)-350)/n;};return {id:p.product_id,title:p.title,source:p.source,priceCents:p.price_cents,costCents:p.cost_cents,stock:world.inventory[p.product_id],margin5:margin(5),margin10:margin(10)};}),feeAssumption:'3.49% + $0.49, not a quoted PayPal rate',deliveryCents:350,returnRateAssumption:.025},
      models:{currentModel:world.champion?.id||'FIXED_RULE_FALLBACK',candidateStatus:candidate.status,candidateType:candidate.model_type||null,candidateLogLoss:candidate.validation_log_loss??null,championLogLoss:candidate.champion_log_loss??null,offerRateLogLoss:candidate.baseline_log_loss??null,trainingRows:candidate.training_rows||0,validationRows:candidate.validation_rows||0,trainingThroughDay:candidate.train_through_day??null,validationThroughDay:candidate.validation_through_day??null,candidateArtifactHash:candidate.artifact?digest(candidate.artifact):null,reason:candidate.reason},
      forecasts:forecast(world,recent,candidate,products,armRates)
    },sharedFitRuntimeMs:fitMs};
  p.evidenceHash=evidenceHash(p);return plain(p);
}

export async function prepareCases({count=PROTOCOL.caseCount,customers=PROTOCOL.customers,onProgress=()=>{}}={}){
  if(!localTrainerStatus().ready)throw new Error('Install the local marketing Python environment first. No cloud fallback exists.');
  const nonce=randomBytes(16).toString('hex'),packets=[],states=[],rules=[];
  const settings=[['steady',42,0,false],['rival_sale',42,0,false],['budget_squeeze',42,0,false],['supply_delay',38,0,false],['steady',42,2,false],['budget_squeeze',42,0,true]];
  for(let i=0;i<count;i++){
    const [scenario,day,lag,costShock]=settings[i%settings.length],caseId='MD-'+String(i+1).padStart(2,'0');
    const seed=parseInt(digest(nonce+caseId).slice(0,8),16),store=createMarketStore(),runner=createLearningRunner({store});
    let w=createLearningMarket({runId:'DECISION-'+caseId,seed,customerCount:customers,merchantCount:8,startedAt:'2026-10-22T01:00:00.000Z',catalog:SAMPLE_PRODUCTS,policy:'adaptive',objective:'profit',budgetCents:60000,scenario});
    const merchantId=w.merchants[(i*3)%8].merchant_id;
    try{
      store.create(w);runner.init(w);w=(await runner.advance(w,28)).world;
      await runner.fit(w,'Shared 28-day history fit before the decision trial.');
      const firstFitMs=w.models.at(-1)?.runtime_ms||0;
      while(w.tick<day){
        if(costShock&&w.tick===35)for(const p of w.products.filter(p=>p.merchant_id===merchantId))p.cost_cents=Math.round(p.price_cents*.79);
        const batch=advanceLearningDay(w);store.transaction(()=>{for(const [table,rows]of Object.entries(batch.rows))store.insert(table,rows);store.saveState(w);});
      }
      const candidate=await trainLocal(store,{...w,tick:day-lag});candidate.modelId=w.runId+'-RECENT';
      const packet=packetFor(w,store,candidate,{caseId,merchantId,labelCutoff:day-lag,fitMs:firstFitMs+(candidate.runtime_ms||0)});
      const before=performance.now(),rule=strongRules(structuredClone(packet)),ruleRuntimeMs=performance.now()-before;
      packets.push(packet);rules.push({...rule,runtimeMs:ruleRuntimeMs});
      states.push({caseId,world:w,candidate,family:costShock?'margin_compression':lag?'delayed_outcomes':scenario,futureSeeds:Array.from({length:PROTOCOL.futureReplicates},(_,j)=>parseInt(digest(nonce+caseId+'future'+j).slice(0,8),16))});
      onProgress({prepared:caseId,of:count});
    }finally{store.close();}
  }
  return {packets,states,rules};
}

export function replayCase(state,packet,action,futureSeed){
  const w=structuredClone(state.world),policy=makeOfferPolicy(packet,decision(packet,action),{world:w,candidate:state.candidate});
  // Past state, fitted models and holdout assignments are unchanged. Future innovations use a paired independent tape.
  w.seed=futureSeed;
  const orders=[],refunds=[],spend=[],coupons=[],traces=[];
  let violations=0;
  const lastOffer=new Map(w.customers.map(u=>[u.customer_id,u.lastOffer]));
  const holds=new Set(w.customers.filter(u=>u.arm==='HOLDOUT').map(u=>u.customer_id));
  for(let d=0;d<packet.horizonDays;d++){
    const batch=advanceLearningDay(w,{offerPolicy:policy});
    orders.push(...batch.rows.orders);refunds.push(...batch.rows.refunds);spend.push(...batch.rows.campaign_spend);coupons.push(...batch.rows.coupons);
    for(const c of batch.rows.coupons){
      const p=w.products.find(p=>p.product_id===c.product_id),net=p.price_cents-c.max_discount_cents;
      if(holds.has(c.customer_id)||c.issued_day-lastOffer.get(c.customer_id)<w.goal.contactGap||(net-p.cost_cents-fee(net)-350)/net<w.goal.minMargin-1e-9)violations++;
      lastOffer.set(c.customer_id,c.issued_day);
      if(c.merchant_id===packet.merchantId&&traces.length<3)traces.push({couponId:c.coupon_id,customerId:c.customer_id,merchantId:c.merchant_id,day:c.issued_day,discountPct:c.discount_pct,modelId:c.model_id,reason:c.reason});
    }
    if(w.live.discountCents+w.live.spendCents>w.goal.budgetCents||Object.values(w.inventory).some(n=>n<0))violations++;
  }
  function ledger(merchantId){
    const sales=orders.filter(o=>!merchantId||o.merchant_id===merchantId),ids=new Set(sales.map(o=>o.order_id));
    const refundCents=sum(refunds.filter(r=>ids.has(r.order_id)),'amount_cents')+w.pending.filter(p=>ids.has(p.orderId)&&p.refund).reduce((n,p)=>n+p.gross,0);
    const gross=sum(sales,'total_cents'),cost=sum(sales,'cost_cents'),delivery=sum(sales,'delivery_cost_cents'),fees=sales.reduce((n,o)=>n+fee(o.total_cents),0),outreach=sum(spend.filter(s=>!merchantId||s.merchant_id===merchantId),'amount_cents');
    return {orders:sales.length,discountedSalesCents:gross,discountCents:sum(sales,'discount_cents'),refundCents,cogsCents:cost,deliveryCents:delivery,feeCents:fees,outreachCents:outreach,contributionCents:gross-refundCents-cost-delivery-fees-outreach,coupons:coupons.filter(c=>!merchantId||c.merchant_id===merchantId).length};
  }
  return {merchant:ledger(packet.merchantId),portfolio:ledger(null),guardViolations:violations,trace:traces};
}

export function operatingCostCents(packet,action,{kind,runtimeMs=0,chatUsd=PROTOCOL.assumedCosts.chatReviewUsdPerCase}={}){
  const c=PROTOCOL.assumedCosts;
  return (packet.sharedFitRuntimeMs+runtimeMs)/3600000*c.computeUsdPerHour*100+(kind==='chat'?chatUsd*100:0)+(action==='ESCALATE'?c.humanReviewMinutesPerEscalation/60*c.humanUsdPerHour*100:0);
}
export function bootstrapPaired(values){
  const samples=Array.from({length:2000},(_,b)=>mean(values.map((_,j)=>values[Math.floor(draw(987654,'bootstrap',b,j)*values.length)]))).sort((a,b)=>a-b);
  return {mean:mean(values),low:samples[50],high:samples[1949],unit:'independent authored case means; future tapes are not additional cases',caveat:'Descriptive pilot interval; known simulator and authored cases do not establish real-world generalization.'};
}

export async function evaluateCases({packets,states,rules,submission,onProgress=()=>{}}){
  const records=[];
  for(const packet of packets){
    const state=states.find(s=>s.caseId===packet.caseId),chat=validateDecision(packet,submission.decisions.find(d=>d.caseId===packet.caseId)),rawRule=rules.find(d=>d.caseId===packet.caseId),{runtimeMs,...rule}=rawRule;
    validateDecision(packet,rule);
    const replays={};
    for(const action of packet.allowedActions){
      if(action==='ESCALATE'){replays[action]=replays.KEEP_CURRENT;continue;}
      replays[action]=state.futureSeeds.map(seed=>replayCase(state,packet,action,seed));
    }
    const keep=replays.KEEP_CURRENT;
    const summary=(d,kind)=>{
      const runs=replays[d.action],cost=operatingCostCents(packet,d.action,{kind,runtimeMs:kind==='rules'?runtimeMs:0});
      const delta=interval(runs.map((r,i)=>r.merchant.contributionCents-keep[i].merchant.contributionCents));
      const aggregate=scope=>Object.fromEntries(Object.keys(runs[0][scope]).map(k=>[k,mean(runs.map(r=>r[scope][k]))]));
      return {action:d.action,rationale:d.rationale,evidenceIds:d.evidenceIds,merchant:aggregate('merchant'),portfolio:aggregate('portfolio'),operatingCostCents:cost,netMerchantCents:mean(runs.map(r=>r.merchant.contributionCents))-cost,deltaVsKeep:delta,harmfulVsKeep:delta.mean< -500&&delta.high<0,guardViolations:runs.reduce((n,r)=>n+r.guardViolations,0),escalations:Number(d.action==='ESCALATE'),trace:runs[0].trace};
    };
    const a=summary(chat,'chat'),b=summary(rule,'rules');
    const alternatives=Object.entries(replays).map(([action,runs])=>({action,meanMerchantCents:mean(runs.map(r=>r.merchant.contributionCents))}));
    const hindsightBest=alternatives.sort((a,b)=>b.meanMerchantCents-a.meanMerchantCents)[0];
    a.hindsightGapCents=hindsightBest.meanMerchantCents-a.merchant.contributionCents;b.hindsightGapCents=hindsightBest.meanMerchantCents-b.merchant.contributionCents;
    records.push({caseId:packet.caseId,merchantName:packet.merchantName,family:state.family,evidenceHash:packet.evidenceHash,chat:a,rules:b,merchantNetDifferenceCents:a.netMerchantCents-b.netMerchantCents,portfolioDifferenceCents:a.portfolio.contributionCents-b.portfolio.contributionCents,hindsightBest,alternatives,keep:keep.map(r=>r.merchant.contributionCents),pairedMerchantDifferences:replays[chat.action].map((r,i)=>r.merchant.contributionCents-replays[rule.action][i].merchant.contributionCents)});
    onProgress({evaluated:packet.caseId,of:packets.length});
    await new Promise(r=>setTimeout(r,0));
  }
  const aggregate=kind=>({cases:records.length,mistakesVsKeep:records.filter(r=>r[kind].harmfulVsKeep).length,guardViolations:sum(records.map(r=>r[kind]),'guardViolations'),escalations:sum(records.map(r=>r[kind]),'escalations'),merchantContributionCents:sum(records.map(r=>r[kind].merchant),'contributionCents'),operatingCostCents:sum(records.map(r=>r[kind]),'operatingCostCents'),netMerchantCents:sum(records.map(r=>r[kind]),'netMerchantCents'),portfolioContributionCents:sum(records.map(r=>r[kind].portfolio),'contributionCents'),modeledFeeCents:sum(records.map(r=>r[kind].merchant),'feeCents'),couponDiscountCents:sum(records.map(r=>r[kind].merchant),'discountCents'),outreachCents:sum(records.map(r=>r[kind].merchant),'outreachCents'),totalEconomicCostCents:sum(records.map(r=>r[kind].merchant),'discountedSalesCents')-sum(records.map(r=>r[kind]),'netMerchantCents'),discountedSalesCents:sum(records.map(r=>r[kind].merchant),'discountedSalesCents'),hindsightGapCents:sum(records.map(r=>r[kind]),'hindsightGapCents')});
  const chat=aggregate('chat'),rulesTotal=aggregate('rules'),netDifference=chat.netMerchantCents-rulesTotal.netMerchantCents,ci=bootstrapPaired(records.map(r=>r.merchantNetDifferenceCents));
  const improvementPct=rulesTotal.netMerchantCents>0?100*netDifference/rulesTotal.netMerchantCents:null;
  const gate=improvementPct!==null&&improvementPct>=5&&ci.low>0&&chat.guardViolations===0&&chat.portfolioContributionCents>=rulesTotal.portfolioContributionCents;
  const sensitivity=[0,.01,.10,1,5].map(price=>({assumedChatUsdPerCase:price,chatNetCents:chat.netMerchantCents+records.length*(PROTOCOL.assumedCosts.chatReviewUsdPerCase-price)*100,netDifferenceVsRulesCents:netDifference+records.length*(PROTOCOL.assumedCosts.chatReviewUsdPerCase-price)*100}));
  return {protocol:PROTOCOL,generatedAt:new Date().toISOString(),status:'FIRST_CHAT_TRIAL_COMPLETED',newPaidApiCalls:0,newPaidApiSpendUsd:0,chatAccountCost:'UNKNOWN_UNMETERED',totalCaseFuturePairs:records.length*PROTOCOL.futureReplicates,totals:{chat,rules:rulesTotal,netDifferenceCents:netDifference,improvementPct,pairedCaseMeanIntervalCents:ci,goGatePassed:gate},sensitivity,records};
}

export function renderReport(report){
  const {chat,rules,netDifferenceCents,improvementPct,goGatePassed,pairedCaseMeanIntervalCents:ci}=report.totals;
  const lines=['# Market Metro: first marketing decision trial','',`**${goGatePassed?'PILOT GATE PASSED; independent validation is still required.':'DO NOT ADD PAID LLM CALLS: the pilot did not clear the predefined gate.'}**`,'',
    'The assistant reviewed the same frozen evidence packets as a rules-and-ML optimizer. Decisions were sealed before future replays. This is a developer-assisted, open-simulator trial, not a blinded or held-out agent benchmark. The author knew the simulator and baseline code. No adaptive evidence collection or multi-agent orchestration was tested.','',
    `Each of ${report.records.length} independent checkpoints changes one merchant campaign for seven days. Each action uses ${PROTOCOL.futureReplicates} paired future tapes. Table amounts sum case means, not all Monte Carlo repeats. All payments and fees below are simulated.`,
    '', '| Metric | Strong rules + ML | Assistant in this chat |','| --- | ---: | ---: |',
    `| Reviewed merchant contribution, before operating cost | ${money(rules.merchantContributionCents)} | ${money(chat.merchantContributionCents)} |`,
    `| Assumed operating cost | $${(rules.operatingCostCents/100).toFixed(4)} | $${(chat.operatingCostCents/100).toFixed(4)} |`,
    `| Total economic costs after discounted sales (COGS, fulfillment, refunds, fees, outreach, operation) | ${money(rules.totalEconomicCostCents)} | ${money(chat.totalEconomicCostCents)} |`,
    `| Redeemed discounts, already reflected in sales | ${money(rules.couponDiscountCents)} | ${money(chat.couponDiscountCents)} |`,
    `| Reviewed merchant net after assumed operating cost | ${money(rules.netMerchantCents)} | ${money(chat.netMerchantCents)} |`,
    `| Material harmful decisions versus keeping the campaign | ${rules.mistakesVsKeep} | ${chat.mistakesVsKeep} |`,
    `| Executed guard violations | ${rules.guardViolations} | ${chat.guardViolations} |`,
    `| Human review escalations | ${rules.escalations} | ${chat.escalations} |`,
    `| All-merchant contribution, including spillovers | ${money(rules.portfolioContributionCents)} | ${money(chat.portfolioContributionCents)} |`,
    `| Reviewed merchant completed payment volume | ${money(rules.discountedSalesCents)} | ${money(chat.discountedSalesCents)} |`,
    `| Modeled payment fees, not PayPal profit | ${money(rules.modeledFeeCents)} | ${money(chat.modeledFeeCents)} |`,
    '',`Assistant minus rules: **${money(netDifferenceCents)}** (${improvementPct===null?'undefined percentage':improvementPct.toFixed(2)+'%'}). The descriptive paired case-mean 95% bootstrap interval is ${money(ci.low)} to ${money(ci.high)} per reviewed case.`,
    '', '## Cost and accounting assumptions','',
    'New paid API spend was $0. Current-chat account costs/token usage and electricity are not metered; the assistant is not claimed to be free. The headline modeled total uses $0.10 per chat-reviewed case, $0.10/hour for measured shared fitting/decision runtime, and five human minutes at $30/hour for each escalation. Shared model fitting is charged equally. Replay/evaluation time is reported separately and excluded from deployment cost. Cost sensitivity follows.','',
    '| Assumed chat cost per case | Assistant net advantage over rules |','| --- | ---: |',...report.sensitivity.map(r=>`| $${r.assumedChatUsdPerCase.toFixed(2)} | ${money(r.netDifferenceVsRulesCents)} |`),
    '', 'Merchant contribution = discounted sales − refunds − product costs − fulfillment − modeled payment fees − outreach. Redeemed discounts are already reflected in sales and are not deducted twice. All seven-day sale-cohort refunds, including pending returns, are settled in evaluation. This is not a retention study or production ROI.','',
    '## Decisions and mistakes','',
    'A material harmful decision loses more than $5 mean merchant contribution versus KEEP_CURRENT, with a paired-replay interval entirely below zero. This is an outcome diagnostic, not a claim that a stochastic loss proves bad reasoning. Hindsight gaps compare all allowed actions on the same future tapes and are optimistic diagnostics, never evidence available to a controller.','',
    '| Case | Rules | Chat | Chat minus rules, net | Harmful: rules / chat | Hindsight gap: rules / chat |','| --- | --- | --- | ---: | --- | ---: |',
    ...report.records.map(r=>`| ${r.caseId} | ${r.rules.action} | ${r.chat.action} | ${money(r.merchantNetDifferenceCents)} | ${r.rules.harmfulVsKeep?'yes':'no'} / ${r.chat.harmfulVsKeep?'yes':'no'} | ${money(r.rules.hindsightGapCents)} / ${money(r.chat.hindsightGapCents)} |`),
    '', '## Case explanations','',
    ...report.records.flatMap(r=>[`### ${r.caseId} — ${r.merchantName}`, '',`Observed family (revealed after submission): ${r.family}.`,'',`Rules: ${r.rules.rationale}`,'',`Assistant: ${r.chat.rationale}`,'',`Seven-day merchant contribution: rules ${money(r.rules.merchant.contributionCents)}, assistant ${money(r.chat.merchant.contributionCents)}. Best action in hindsight: ${r.hindsightBest.action}.`,'']),
    '## Interpretation','',
    'The scripts and reviewer shared all observations, forecasts, permitted actions, real locally fitted models and guards. The baseline optimizes predicted contribution with reconciliation, margin, data-freshness and model-validation checks. It is not a weak coupon rule. A failed gate means this trial provides no reason to purchase LLM calls or expand into an agent team. A passed pilot gate still requires independently authored cases and actual model execution to establish an agent advantage.','',
    'PayPal relevance is offer-to-completed-payment measurement and merchant sustainability. Sandbox receipts elsewhere in the project validate the connector, not the causal value of these decisions. Channel3 is a catalog integration; this benchmark deliberately uses portable sample products and zero fresh provider calls.',''];
  return lines.join('\n');
}

export async function writeJson(path,value){await mkdir(resolve(path,'..'),{recursive:true});await writeFile(path,JSON.stringify(value,null,2)+'\n',{flag:'wx'});}
export const readJson=async path=>JSON.parse(await readFile(path,'utf8'));
