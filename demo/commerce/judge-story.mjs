import {esc,money} from '../garden/ui.mjs';
const dollars=n=>money(n*100),gain=n=>(n>0?'+':'')+dollars(n);
const facts=rows=>'<dl>'+rows.map(([label,value])=>`<dt>${esc(label)}</dt><dd>${esc(value)}</dd>`).join('')+'</dl>';
const models={response_hurdle:'Two-stage response model',boosted:'Boosted trees',logistic:'Logistic regression',forest:'Random forest'};
const results=d=>`<div class="judge-gains">${[['PayPal net',gain(d.vsFixed.paypal)],['Merchant contribution',gain(d.vsFixed.merchants)],['Retained purchases','+'+d.vsFixed.purchases]].map(([label,value])=>`<div><small>${label}</small><strong>${value}</strong></div>`).join('')}</div>`;

// Every chapter uses one immutable campaign artifact, including its native receipt.
export function judgeStory(d){
 const e=d.evidence,p=d.decision,s=d.shopper,r=d.receipt,shopper='Shopper '+String(s.name).padStart(3,'0');
 return [
  {phase:'market',hash:'market',label:'Day 1 · Shopping begins',day:1,source:'Saved market · simulated shoppers',title:'The market starts before the agent acts.',body:
   `<p><b>600 shoppers. 12 merchants.</b> Customers browse and buy office supplies. The agent observes the first 30 days before choosing a campaign.</p>
    <div class="judge-flow"><span>Shop</span><i>→</i><span>Observe</span><i>→</i><span>Decide</span><i>→</i><span>Measure</span></div>
    <p>We follow one shopper from a recommendation to a purchase, then compare the whole campaign with the same market under fixed rules.</p>
    <small>Saved playback. No new model calls, training jobs or payments.</small>`},
  {phase:'workflow',hash:'evidence',label:'Day 31 · What the agent saw',day:31,source:'Recorded LLM investigation · observed evidence',title:'Interest was high. Funded demand was uneven.',body:
   `<p>The agent saw <b>${e.openFundedRequests} open funded requests</b>. It investigated which interests might become completed purchases.</p>
    <table><thead><tr><th>Category</th><th>7-day interest</th><th>Funded units</th></tr></thead><tbody>${['Electronics','Furniture'].map(k=>`<tr><th>${k}</th><td>${e.categories[k].interest7}</td><td>${e.categories[k].fundedUnits}</td></tr>`).join('')}</tbody></table>
    <div class="judge-choice"><small>Agent decision</small><p>Use recent interest and past responses to rank shoppers for a recommendation or a shopping-needs inquiry.</p></div>
    <small>Training used ${e.historicalRows.toLocaleString()} historical simulation outcomes. ${e.retainedAfterDelay} of ${e.retained} retained purchases funded later; immediate replies alone miss them.</small>`},
  {phase:'workflow',hash:'campaign',label:'Day 31 · What changed',day:31,source:'Recorded LLM proposal → local training → financial verification',title:'Train two models. Publish the better campaign.',body:
   `<div class="judge-change"><div><small>The LLM proposed</small><b>${esc(models[p.original.family])}</b><span>${p.window}-day features · up to ${p.per100*6} contacts/day</span></div><i>→</i><div><small>The verifier selected</small><b>${esc(models[p.chosen.family])}</b><span>Same campaign, revised shopper ranking</span></div></div>
    <table><caption>Average gain vs fixed in three development markets</caption><thead><tr><th>Model</th><th>PayPal</th><th>Merchants</th></tr></thead><tbody>${[p.original,p.chosen].map(m=>`<tr><th>${esc(models[m.family])}</th><td>${gain(m.paypal)}</td><td>${gain(m.merchants)}</td></tr>`).join('')}</tbody></table>
    <p>The LLM chose the investigation, training and campaign. The deterministic verifier changed the model after measuring financial outcomes, then allowed publication.</p>
    <details><summary>Read the actual LLM proposal</summary><p>${esc(p.rationale)}</p></details>
    <a href="/analytics.html?run=judge-demo&view=decisions">Open this campaign’s decisions in AG Grid →</a>`},
  {phase:'performance',hash:'purchase',label:'Day 35–36 · Shopper response',day:s.deliveryDay,source:'Recorded shopper outcome · simulated purchase',title:shopper+' came back and bought.',body:
   `<p>${s.daysSincePurchase} days after their previous purchase, the shopper received a recommendation for a <b>${esc(s.product)}</b> from ${esc(s.merchant)}.</p>
    <div class="judge-flow"><span>Day ${s.contactDay}<b>Recommended</b></span><i>→</i><span>Day ${s.purchaseDay}<b>${money(s.grossCents)} paid</b></span><i>→</i><span>Day ${s.deliveryDay}<b>Delivered</b></span></div>
    <div class="judge-choice"><small>Matched comparison</small><p>${s.fixedBought?'Fixed rules also fulfilled this request.':'The same request went unfilled under fixed rules.'} ${s.originalBought?'The original model also fulfilled it.':'The planner’s original model also missed it.'}</p></div>
    <small>This is a saved simulated shopper trace. The final step shows the matching native PayPal Sandbox receipt.</small>`},
  {phase:'performance',hash:'result',label:'Day 126 · Gains vs fixed',day:d.settledDay,source:'Settled simulation · same seed and starting conditions',title:'Did the campaign improve the result?',body:
   results(d)+`<table><thead><tr><th>Campaign outcome</th><th>Fixed</th><th>Planner + verifier</th></tr></thead><tbody>${[['PayPal net','paypal'],['Merchant contribution','merchants'],['Retained purchases','purchases']].map(([label,key])=>`<tr><th>${label}</th><td>${key==='purchases'?d.fixed[key]:dollars(d.fixed[key])}</td><td>${key==='purchases'?d.planner[key]:dollars(d.planner[key])}</td></tr>`).join('')}</tbody></table>
    <p>Measured after refunds and settlement, excluding shared warmup. PayPal net includes the recorded <b>$${p.reviewCostUSD.toFixed(6)}</b> model cost.</p>
    <small>One paired simulated run, not real PayPal profit. Merchant contribution includes inventory value.</small>
    <p><a href="/analytics.html?run=judge-demo&view=profits">Inspect these same totals in AG Grid →</a></p>`},
  {phase:'performance',hash:'receipt',label:'Final proof · PayPal receipt',day:d.settledDay,source:'Verified PayPal Sandbox capture · fictitious funds',title:'One purchase. One matching PayPal receipt.',body:
   `<p>The ${esc(s.product)} from the shopper’s trace was mirrored once to the connected PayPal Sandbox store.</p>
    <p class="receipt-total"><img class="receipt-mark" src="/figures/planner-v23/assets/paypal.svg" alt="PayPal">${money(r.gross_cents)}</p>
    ${facts([['Status',r.status],['PayPal fee',money(r.fee_cents)],['Test merchant receives',money(r.net_cents)]])}
    <p class="capture-id">Capture <code>${esc(r.capture_id)}</code></p>
    <details><summary>Trace the receipt to its warehouse order</summary><p>${esc(shopper)} → ${esc(s.merchant)} → ${esc(s.product)}</p><p>Warehouse order / PayPal custom ID<br><code>${esc(r.order_id)}</code></p><p>PayPal order<br><code>${esc(r.paypal_order_id)}</code></p><p>Verified ${esc(r.verified_at)}</p></details>
    <div class="judge-final-gains"><small>Whole campaign gain vs fixed · simulated</small>${results(d)}</div>
    <div class="judge-handoff"><a class="primary" href="/analytics.html?run=judge-demo&view=payments">Inspect the saved PayPal proof →</a><a href="/studio.html?view=market&judge=1&setup=1&execution=saved">Try your own free simulation →</a></div>
    <small>This archived capture confirms the existing order. It is not additional revenue, and replay never sends a payment.</small>`}
 ];
}
