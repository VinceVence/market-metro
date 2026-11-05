import {esc} from '../garden/ui.mjs';

const usd = new Intl.NumberFormat('en-US', {style:'currency',currency:'USD'});
const signed = n => n === 0 ? usd.format(0) : (n < 0 ? '−' : '+') + usd.format(Math.abs(n));
const marketNames = {discovery:'Product discovery',reactivation:'Reactivation',low_response:'Low response',zero_response:'No response'};
const models = {forest:'Random forest',logistic:'Logistic regression',response_hurdle:'Two-stage response',boosted:'Boosted trees'};
const campaigns = {intent_assistance:'Follow up on recent shopping interest',ranked_discovery:'Recommend products or ask what a shopper needs',
  open_discovery:'Ask shoppers about unmet needs',reactivation:'Reach past shoppers',product_recommendations:'Recommend products'};
const checks = {modelBeatsCoarse:'prediction quality',positivePlatform:'positive PayPal contribution',merchantProtected:'merchant contribution',
  purchasesProtected:'retained purchases',volumeProtected:'payment volume',cashProtected:'partner cash',inventoryBounded:'inventory limit',
  stressCasesProtected:'outcomes in each stress market',beatsIncumbent:'higher PayPal contribution',settled:'settled obligations'};
const modelName = m => models[m.family] || m.family || m.modelId;

export function modelTrialTable(report) {
  if (!report.anchor || !report.alternative) return '';
  const rows = [report.anchor, report.alternative].map((m, i) =>
    `<tr><th scope="row">${esc(modelName(m))}<small>${i ? 'Alternative' : 'First choice'} · ${esc((m.features || '').replaceAll('_',' '))}</small></th>
    <td>${Number.isFinite(m.auc)?m.auc.toFixed(3):'—'}</td><td>${signed(m.paypal)}</td><td>${signed(m.merchants)}</td><td>${m.purchases.toFixed(1)}</td></tr>`).join('');
  return `<div class="performance-table"><table><caption>Same campaign on three development markets. Average change from fixed rules.</caption>
    <thead><tr><th>Ranking model</th><th><abbr title="How often the model ranks an eventual buyer above a nonbuyer">Validation AUC</abbr></th><th>PayPal</th><th>Merchants</th><th>Purchases</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${report.failedChecks?.length ? '<p>Checks the alternative missed include '+esc(report.failedChecks.map(k=>checks[k]||k).join(', '))+'.</p>' : ''}`;
}

export async function showModelCheck(root) {
  const response = await fetch('/data/commerce-model-check.json', {cache:'no-store'});
  if (!response.ok) throw Error('The model comparison result could not be loaded.');
  const {cases, totals, check} = await response.json();
  root.innerHTML = `<div class="channel-heading"><h2>Campaign model check</h2></div><div class="performance-body">
    <p class="performance-note">Would a second ranking model earn more from the same campaign? The team’s saved proposals set the terms. The verifier tested both rankings before opening four new markets.</p>
    <div class="performance-summary"><div><small>Model choices changed</small><b>${check.switches} of ${cases.length}</b></div>
    <div><small>PayPal net vs original choice</small><b>${signed(totals.vsOriginal.paypal)}</b></div>
    <div><small>Merchant contribution vs original</small><b>${signed(totals.vsOriginal.merchants)}</b></div></div>
    <div class="performance-section"><h3>Why the verifier kept or changed the model</h3>
    <select aria-label="Inspect a market" data-market>${cases.map((c,i)=>`<option value="${i}">${esc(marketNames[c.regime])}</option>`).join('')}</select></div>
    <div data-comparison aria-live="polite"></div>
    <div class="performance-section"><h3>After purchases, refunds and settlement</h3></div>
    <div class="performance-table"><table><caption>Totals across all four unseen markets</caption><thead><tr><th>Policy</th><th>PayPal net after AI</th><th>Merchants</th><th>Retained purchases</th></tr></thead><tbody>
    ${[['Fixed rules','fixed'],['Agent’s original model','original'],['With model check','checked']].map(([label,key])=>`<tr><th scope="row">${label}</th><td>${usd.format(totals[key].paypal)}</td><td>${usd.format(totals[key].merchants)}</td><td>${totals[key].purchases.toLocaleString('en-US')}</td></tr>`).join('')}</tbody></table></div>
    <div class="performance-table"><table><caption>Where the gains came from</caption><thead><tr><th>Unseen market</th><th>PayPal vs original</th><th>Merchants vs original</th><th>Purchases vs original</th><th>PayPal vs fixed</th></tr></thead><tbody>
    ${cases.map(c=>`<tr><th scope="row">${esc(marketNames[c.regime])}</th><td>${signed(c.vsOriginal.paypal)}</td><td>${signed(c.vsOriginal.merchants)}</td><td>${c.vsOriginal.purchases}</td><td>${signed(c.vsFixed.paypal)}</td></tr>`).join('')}</tbody></table></div>
    <p class="performance-note">Each campaign stayed in place from displayed day 31 through market close. Both agent policies carry the same recorded first-review AI cost. This comparison ran locally with $0 in new model charges. Financial results are simulated.</p>
    <a href="?view=performance&amp;evaluation=reactivation-fresh">See whether the reactivation result repeated with fresh decisions</a>
    <p><a href="/data/commerce-model-check.json" download>Download all four decisions and results</a></p></div>`;
  const selector = root.querySelector('[data-market]');
  selector.value=String(Math.max(0,cases.findIndex(c=>c.regime==='reactivation')));
  function draw() {
    const c=cases[Number(selector.value)], r=c.development;
    root.querySelector('[data-comparison]').innerHTML = `<p><b>${esc(campaigns[r.campaign.kind]||r.campaign.kind)}.</b> Up to ${r.campaign.contactsPer100} contacts per 100 shoppers per day.</p>
      <p><b>${c.identicalPolicy?'Kept the original model':'Changed the ranking model'}.</b> ${esc(r.reason)}</p>
      ${modelTrialTable(r)}
      <p class="performance-verdict"><b>${esc(marketNames[c.regime])} · unseen seed ${c.seed}</b>
      <span>Adding the check changed PayPal net by ${signed(c.vsOriginal.paypal)}, merchant contribution by ${signed(c.vsOriginal.merchants)} and purchases by ${c.vsOriginal.purchases}. The checked campaign earned ${signed(c.vsFixed.paypal)} for PayPal versus fixed rules.</span></p>
      <a href="?view=performance&amp;evaluation=harness-v2&amp;trace=${encodeURIComponent(c.sourceCase+'-team')}">Read the team's original demand analysis and campaign decisions</a>`;
  }
  selector.onchange=draw;
  draw();
}

export async function showFreshReactivation(root) {
  const file='/data/commerce-reactivation-fresh.json';
  const response=await fetch(file,{cache:'no-store'});
  if(!response.ok)throw Error('The fresh reactivation results are not available yet.');
  const {cases,totals,comparisons,completeReviews,studyCostUSD,freshDecisions}=await response.json();
  const comparisonsList=[['Single planner vs fixed','singleVsFixed'],['Team vs fixed','teamVsFixed'],['Team vs single planner','teamVsSingle'],
    ['Verifier added to single planner','singleVerifier'],['Verifier added to team','teamVerifier']];
  root.innerHTML=`<div class="channel-heading"><h2>Fresh reactivation test</h2></div><div class="performance-body">
    <p class="performance-verdict"><b>The single planner beat fixed rules on all three outcomes in ${comparisons.singleVsFixed.strictJointWins} of ${cases.length} markets. The team did so in ${comparisons.teamVsFixed.strictJointWins}.</b>
    <span>The team's extra model check improved PayPal net, merchant contribution and retained purchases together on ${comparisons.teamVerifier.strictJointWins} of ${cases.length} seeds. Its median PayPal gain was ${usd.format(comparisons.teamVerifier.medianPayPal)}.</span></p>
    <p class="performance-note">One planner and a three-role team each received the same 30 days of shopper activity, the same financial verifier and the same call budget. Their campaigns ran through settlement on six new markets.</p>
    <div class="performance-summary"><div><small>Completed reviews</small><b>${completeReviews} / ${2*cases.length}</b></div>
    <div><small>Fresh Gemini decisions</small><b>${freshDecisions}</b></div><div><small>Metered AI cost</small><b>$${studyCostUSD.toFixed(4)}</b></div></div>
    <div class="performance-section"><h3>What each approach added</h3></div>
    <div class="performance-table"><table><caption>Paired totals across six markets</caption><thead><tr><th>Comparison</th><th>PayPal net after AI</th><th>Merchants</th><th>Retained purchases</th><th>Seeds up on all three</th></tr></thead>
    <tbody>${comparisonsList.map(([label,key])=>{const c=comparisons[key];return `<tr><th scope="row">${label}</th><td>${signed(c.total.paypal)}</td><td>${signed(c.total.merchants)}</td><td>${c.total.purchases}</td><td>${c.strictJointWins} / ${cases.length}</td></tr>`;}).join('')}</tbody></table></div>
    <div class="performance-section"><h3>Every seed</h3><select aria-label="Paired comparison" data-pair>${comparisonsList.map(([label,key])=>`<option value="${key}">${label}</option>`).join('')}</select></div>
    <div class="performance-table"><table><thead><tr><th>Seed</th><th>PayPal net change</th><th>Merchant change</th><th>Purchase change</th></tr></thead><tbody data-seeds></tbody></table></div>
    <p class="performance-note">The fixed policy earned ${usd.format(totals.fixed.paypal)} in modeled PayPal net across these markets. Each verifier comparison replays the same fresh proposal with its original ranking model and charges both versions the same AI cost. Four joint wins and positive totals in all three outcomes were required for a repeat. All shoppers and financial outcomes are simulated.</p>
    <a href="${file}" download>Download paired results</a></div>`;
  const pick=root.querySelector('[data-pair]');
  pick.value='teamVerifier';
  function draw(){root.querySelector('[data-seeds]').innerHTML=cases.map(c=>{const r=c.comparisons[pick.value];
    return `<tr><th scope="row">${c.seed}</th><td>${signed(r.paypal)}</td><td>${signed(r.merchants)}</td><td>${r.purchases}</td></tr>`;}).join('');}
  pick.onchange=draw;draw();
}
