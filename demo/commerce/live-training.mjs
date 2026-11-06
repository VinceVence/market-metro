import {esc,num} from '../garden/ui.mjs';

const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const labels={fixed:'Fixed rules',planner:'Planner',ontology:'Planner + ontology'};
const tools={choose_investigation:'Investigate demand',define_dataset:'Choose training data',
  choose_training_experiments:'Choose model experiments',train_ontology_model:'Choose ontology features',
  select_trained_artifact:'Select a trained model',propose_campaign_trial:'Propose the campaign',
  propose_campaign_revision:'Revise after the trial',finish_review:'Finish the review'};
const families={forest:'Forest',response_hurdle:'Two-stage response',boosted:'Boosted trees',logistic:'Logistic regression'};
const signed=n=>(n>0?'+':'')+money.format(n);

function review(r){
  const dataset=r.decisions.find(d=>d.tool==='define_dataset')?.choice;
  const request=r.decisions.find(d=>d.tool==='train_ontology_model')?.choice;
  const selected=r.models.find(m=>m.modelHash===r.contract?.modelHash);
  return `<section><h3>${labels[r.arm]}</h3>
    <p>${r.complete?'All six Gemini decisions completed.':'The review ended with an incomplete step.'} ${r.contract?'The verifier approved '+esc(r.contract.campaign.kind.replaceAll('_',' '))+'.':'The verifier kept fixed rules.'}</p>
    ${dataset?`<p>Gemini chose a <b>${esc(dataset.windowDays)}-day window</b> and ${esc(dataset.featureView.replaceAll('_',' '))} inputs.</p>`:''}
    ${request?`<p><b>Features Gemini requested</b><br>${esc(request.features.join(', '))}</p>`:''}
    ${selected?`<p>The published ${esc(families[selected.spec.family]??selected.spec.family)} model used ${num(selected.report.rows)} training rows. ${selected.report.featureTriage?'The ontology training cohort contains product recommendations.':''}</p>`:''}
    <div class="performance-table"><table><thead><tr><th>Model experiment</th><th>Training rows</th><th>Features</th><th>Product ROC AUC</th><th>Result</th></tr></thead><tbody>
    ${r.models.map(m=>`<tr><th>${m.spec.selection==='llm_selected'?'LLM-selected features':esc(families[m.spec.family]??m.spec.family)}</th><td>${num(m.report.rows)}</td><td>${m.fields.length}</td><td>${m.report.byContactType?.recommend?.auc?.toFixed(3)??'—'}</td><td>${m.modelHash===selected?.modelHash?'Published':'Unused'}</td></tr>`).join('')}</tbody></table></div>
    ${r.decisions.map(d=>`<details><summary>${esc(tools[d.tool]??d.tool??'Interrupted decision')}</summary><p>${esc(d.choice?.rationale??d.error??'No recorded choice')}</p>
      <p>${esc(d.choice?.finding??d.choice?.opportunity??'')}</p><details><summary>Evidence sent to Gemini</summary><pre>${esc(JSON.stringify(d.input,null,2))}</pre></details></details>`).join('')}
    <details><summary>Verifier's final decision</summary><pre>${esc(JSON.stringify(r.toolResults.find(t=>t.actor==='TRUSTED_PUBLISHER')?.output??{},null,2))}</pre></details>
  </section>`;
}

export function liveTraining(r){
  const o=r.comparisons.ontologyVsPlanner;
  return `<section class="feed-decision"><h3>A complete campaign chosen by Gemini</h3>
    <p>Day 31 review → customer outreach → purchases and deliveries → day ${r.protocol.settlementDay} settlement. All three policies started with the same 600 shoppers and 12 merchants on seed ${r.protocol.settings.seed}.</p>
    <p><b>${num(r.calls)} fresh model responses</b> · ${money.format(r.cost.studyUSD)} estimated model cost · ${money.format(r.cost.capUSD)} run cap</p></section>
    <h3>Results after settlement</h3><div class="performance-table"><table><thead><tr><th>Policy</th><th>PayPal net</th><th>Merchant contribution</th><th>Retained purchases</th><th>Model cost</th></tr></thead><tbody>
    ${Object.entries(r.rows).map(([k,v])=>`<tr><th>${labels[k]}</th><td>${money.format(v.paypal)}</td><td>${money.format(v.merchants)}</td><td>${num(v.purchases)}</td><td>$${v.aiCost.toFixed(5)}</td></tr>`).join('')}
    </tbody></table></div>
    <p>Adding the ontology changed PayPal net by <b>${signed(o.paypal)}</b>, merchant contribution by <b>${signed(o.merchants)}</b> and purchases by <b>${o.purchases>0?'+':''}${o.purchases}</b> relative to the fresh planner.</p>
    <small>Financial results are simulated. PayPal net includes processing, outreach and each planner's logged inference cost. This one-market comparison includes independently chosen campaigns as well as model changes.</small>
    ${review(r.reviews.planner)}${review(r.reviews.ontology)}
    <h3>Shopper transactions from this run</h3><div class="performance-table"><table><thead><tr><th>Policy</th><th>Shopper</th><th>Contact day</th><th>Paid day</th><th>Basket</th><th>Retained</th></tr></thead><tbody>
    ${['planner','ontology'].flatMap(arm=>r.examples[arm].slice(0,3).map(s=>`<tr><th>${labels[arm]}</th><td>${esc(s.customerId)}</td><td>${s.contactDay}</td><td>${s.captureDay}</td><td>${money.format(s.grossUSD)}</td><td>${s.retained?'Yes':'Refunded'}</td></tr>`)).join('')}
    </tbody></table></div><small>These captures belong to the simulator. The archived $96 Sandbox receipt belongs to the original judge campaign. <a href="/data/ontology-live-campaign.json" download>Decisions, daily activity and results</a></small>`;
}
