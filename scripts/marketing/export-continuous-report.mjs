import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {csv} from '../market-store.mjs';

const id=process.argv[2];
if(!/^GARDEN-LIVE-[a-f0-9]{16}$/.test(id||''))throw Error('Supply a recorded continuous run ID.');
const response=await fetch('http://127.0.0.1:4173/api/market/live/'+id+'/report');
const r=await response.json();if(!response.ok)throw Error(r.error?.message||'Report unavailable.');
if(r.status!=='COMPLETE'||r.planner.pending)throw Error('Wait for the market and its in-flight decisions to finish.');
const dir=resolve('docs/continuous-market/reports',id);await mkdir(dir,{recursive:true});
const dollars=cents=>'$'+(cents/100).toFixed(2),apiMoney=micros=>'$'+(micros/1e6).toFixed(6);
const p=r.planner,h=r.phases.history,l=r.phases.live,m=r.models;
m.activatedModelIds=[...new Set(r.workerLog.filter(row=>row.action==='PUBLISH_PRODUCT_CAMPAIGN').map(row=>row.evidence.modelId).filter(Boolean))];
const table=[
  ['Completed purchases',h.purchases,l.purchases,r.totals.purchases],
  ['Product visits',h.visits,l.visits,r.totals.visits],
  ['Coupons issued',h.couponsIssued,l.couponsIssued,r.totals.couponsIssued],
  ['Coupons seen',h.couponsSeen,l.couponsSeen,r.totals.couponsSeen],
  ['Coupons redeemed',h.couponsRedeemed,l.couponsRedeemed,r.totals.couponsRedeemed],
  ['Recommendation exposures',h.recommendations,l.recommendations,r.totals.recommendations],
  ['Recommendation clicks',h.recommendationClicks,l.recommendationClicks,r.totals.recommendationClicks],
  ['Recommendation-associated purchases',h.recommendationPurchases,l.recommendationPurchases,r.totals.recommendationPurchases],
  ['Simulated payment volume',dollars(h.paymentVolumeCents),dollars(l.paymentVolumeCents),dollars(r.totals.paymentVolumeCents)],
  ['Modeled transaction fees',dollars(h.modeledFeeCents),dollars(l.modeledFeeCents),dollars(r.totals.modeledFeeCents)],
  ['Modeled merchant contribution',dollars(h.modeledContributionCents),dollars(l.modeledContributionCents),dollars(r.totals.modeledContributionCents)]
];
const rows=r.decisions.map(d=>({decision_day:d.decidedDay,decision_hour:d.decidedHour,evidence_through_day:d.evidenceThroughDay,stage:d.stage,status:d.status,campaign:d.choice?.campaignType||'',action:d.choice?.decision||'',retrain:d.choice?.retrain??'',response_model_families:d.choice?.campaignType==='recommendation'?'not applicable':d.choice?.modelTypes?.join(', ')||'',discount_pct:d.choice?.offerPct??'',target_products:d.choice?.productIds?.length||0,justification:d.rationale||d.error?.message||'',model:d.model,cost_usd:(d.provider?.modelCostMicros||0)/1e6,response_id:d.provider?.responseId||'',error:d.error?.code||''}));
const lines=[
  '# '+r.completedDays+'-day Gemini marketing demo',
  '',
  'Run: `'+id+'`. Seed '+r.settings.seed+'; '+r.settings.customerCount+' simulated shoppers; '+r.settings.merchantCount+' merchants; '+r.settings.scenario.replaceAll('_',' ')+'; '+dollars(r.settings.budgetCents)+' virtual marketing budget. Planner: `'+p.model+'`.',
  '',
  '**'+p.validatedDecisions+' validated LLM choices, '+p.campaignsPublished+' executed campaign publications, and '+m.trainingJobs+' local training jobs.** '+p.rejectedOrFailed+' failed or rejected LLM attempts are retained in the log.',
  '',
  'LLM cost for this run: **'+apiMoney(p.meteredCostMicros)+'**. Total accounted across the shared budget: **'+apiMoney(p.budgetAccountedMicros)+' / $0.25**'+(p.reservedUnknownMicros?' (including an unmetered reservation of '+apiMoney(p.reservedUnknownMicros)+')':'')+'. These are estimates from provider-reported tokens and saved pricing, not a billing invoice.',
  '',
  'The data collection phase is days 1–28. The first automatic LLM review uses observations through day 30. Days 29–'+r.completedDays+' below include ordinary shopping before and between campaigns; those purchases are not all attributable to the agent.',
  '',
  '| Statistic | Learning days 1–28 | Live days 29–'+r.completedDays+' | Total |',
  '| --- | ---: | ---: | ---: |',
  ...table.map(row=>'| '+row.join(' | ')+' |'),
  '',
  'Live campaign spend: '+dollars(l.discountCents)+' redeemed discounts + '+dollars(l.outreachCents)+' assumed outreach. Discounts already reduce revenue; they are not subtracted again in contribution.',
  '',
  'Distinct model versions activated in published campaigns: '+m.activatedModelIds.length+'. Training jobs: '+m.recommenderFits+' recommender fits and '+m.offerResponseJobs+' offer-response jobs ('+m.offerCandidateFits+' fitted offer-model candidates). A rejected candidate is a completed fit, not a deployed model. Model artifacts and validation results are in [report.json](report.json).',
  '',
  'Actual provider attempts: '+p.providerAttempts+'. Research decisions: '+p.researchDecisions+'. Publication decisions: '+p.publicationDecisions+'. Provider tokens: '+p.inputTokens+' input, '+p.outputTokens+' output, '+p.thinkingTokens+' thinking.',
  '',
  'Native PayPal sandbox receipts in this run: '+r.nativePayments.length+'. Ordinary payment volume and fees above are simulated. No live-money transactions were performed. Cached Channel3 listings supply products; the app generates shopper behavior and marketing outcomes.',
  '',
  'This is workflow verification in a seeded economy, not proof of incremental marketing benefit or production ROI. The LLM chooses the campaign strategy and training request; local workers fit, validate, execute and log it. The code never substitutes a scripted planner for a failed Gemini response.',
  '',
  '## Decision log from day 30',
  '',
  '“Evidence through” is the completed-data cutoff. “Decided at” is when the provider response arrived in simulated time. Research rows are proposals; a campaign starts only after publication executes. Justifications below are the model’s saved public rationales, not reconstructed explanations.',
  ''
];
for(const d of r.decisions){
  const outcome=r.workerLog.filter(w=>w.evidence?.reviewId===d.reviewId&&['PUBLISH_PRODUCT_CAMPAIGN','WAIT_FOR_EVIDENCE','STALE_SNAPSHOT','RUN_ENDED_BEFORE_PUBLICATION','ANALYST_ERROR'].includes(w.action)).at(-1);
  lines.push('### Day '+d.decidedDay+' '+String(d.decidedHour||0).padStart(2,'0')+':00 — '+d.stage+' — '+d.status,'',
    '- Evidence through day '+d.evidenceThroughDay+': '+d.evidence.recentPurchases+' purchases in the latest seven days vs '+d.evidence.previousPurchases+' before; '+d.evidence.lapsedCustomers+' previously purchasing shoppers inactive for 7+ days.',
    '- Choice: '+(d.choice?d.choice.decision+' / '+d.choice.campaignType+'; '+d.choice.offerPct+'% discount; '+d.choice.productIds.length+' products; retrain '+d.choice.retrain+'.':'No valid action returned.'),
    '- Execution for this review: '+(outcome?outcome.action+' ('+outcome.status+') at day '+(outcome.evidence.marketTime?.day||outcome.day+1):'No publication recorded.'),
    '- Metered call cost: '+apiMoney(d.provider?.modelCostMicros||0)+'.','',...(d.targetProducts?.length?['Targets observed at the cutoff:','',...d.targetProducts.map(p=>'- '+p.title+': '+p.recentPurchases+' recent purchases, '+p.recentViews+' views (previously '+p.previousPurchases+' purchases / '+p.previousViews+' views).'),'']:[]),d.rationale||d.error?.message||'No rationale returned.','');
}
lines.push('## Days without a model decision','','No decision was recorded on days '+r.dailyDecisionCounts.filter(d=>!d.decisions).map(d=>d.day).join(', ')+'. The market continues independently; there is no invented daily rationale.','','## Artifacts','','- [Complete report and worker log](report.json)','- [LLM decision CSV](decisions.csv)','- [Daily decision counts](daily-decisions.csv)','');
if(r.settings.retryOf){lines.push('## Diagnostic run retained','','This clean validation is linked to diagnostic run `'+r.settings.retryOf+'` and uses the same $0.25 budget. The diagnostic had a provider-schema rejection and subsequent proposals blocked because response models failed validation. The fixes make available publication actions depend on model readiness and feed actual execution outcomes back to the LLM. Its records are preserved in [diagnostic-report.json](diagnostic-report.json).','');const d=await(await fetch('http://127.0.0.1:4173/api/market/live/'+r.settings.retryOf+'/report')).json();await writeFile(resolve(dir,'diagnostic-report.json'),JSON.stringify(d,null,2)+'\n');}
await writeFile(resolve(dir,'summary.md'),lines.join('\n'));
await writeFile(resolve(dir,'report.json'),JSON.stringify(r,null,2)+'\n');
await writeFile(resolve(dir,'decisions.csv'),csv({columns:Object.keys(rows[0]||{decision_day:0}),rows}));
await writeFile(resolve(dir,'daily-decisions.csv'),csv({columns:['day','decisions'],rows:r.dailyDecisionCounts}));
console.log(JSON.stringify({directory:dir,days:r.completedDays,decisions:p.validatedDecisions,campaigns:p.campaignsPublished,models:m.trainingJobs,coupons:l.couponsIssued,redemptions:l.couponsRedeemed,costUSD:p.meteredCostMicros/1e6,totalBudgetAccountedUSD:p.budgetAccountedMicros/1e6}));
