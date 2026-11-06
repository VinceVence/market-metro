import {esc,num} from '../garden/ui.mjs';
const usd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const dollars=n=>(n>0?'+':'')+usd.format(n);
const sign=n=>(n>0?'+':'')+n;
const labels={incumbent:'Current pooled model',sku_all:'Product rows, all fields',statistical:'Statistical selection',ontology:'Ontology-guided selection'};

function financial(e){
  const base=e.totals.incumbent,o=e.totals.ontology;
  return `<h3>Four unseen simulated markets</h3>
    <p>Compared with the current model, modeled PayPal net changed by <b>${dollars(o.paypal-base.paypal)}</b>, merchant contribution by <b>${dollars(o.merchants-base.merchants)}</b> and retained purchases by <b>${sign(o.purchases-base.purchases)}</b>.</p>
    <div class="performance-table"><table><thead><tr><th>Market</th><th>PayPal change</th><th>Merchant change</th><th>Purchase change</th></tr></thead><tbody>
    ${e.cases.map(c=>{const a=c.outcomes.ontology,b=c.outcomes.incumbent;return `<tr><th>${esc(c.regime.replaceAll('_',' '))}</th><td>${dollars(a.paypal-b.paypal)}</td><td>${dollars(a.merchants-b.merchants)}</td><td>${sign(a.purchases-b.purchases)}</td></tr>`;}).join('')}</tbody></table></div>`;
}
function explain(r){
  const route=r.route;
  if(route.decision==='HOLD_MISSING_LABEL')return `<section class="feed-decision held"><h3>Hold training until item-level labels are available</h3><p>The training export records whether a basket was retained. It does not say which items the shopper kept. The needed join is recommendation → request → retained basket → fulfilled item.</p></section>`;
  if(route.decision==='USE_INQUIRY_HEAD')return `<section class="feed-decision"><h3>Use the existing inquiry reply and value model</h3>
    <p>These ${num(r.rows)} historical questions had no product attached. The inquiry model uses prior shopper intent and settled reply outcomes. Product price and stock have no defined value on these rows.</p></section>
    <div class="performance-table"><table><thead><tr><th>Prior intent</th><th>Inquiries</th><th>Replies</th><th>Retained baskets</th></tr></thead><tbody>${Object.entries(r.cohorts).map(([k,v])=>`<tr><th>${esc(k)}</th><td>${num(v.contacts)}</td><td>${num(v.replies)}</td><td>${num(v.retained)}</td></tr>`).join('')}</tbody></table></div>`;
  if(route.decision==='RUN_PAIRED_SETTLEMENT')return `<section class="feed-decision"><h3>Compare policies on identical shoppers</h3><p>Prediction accuracy alone cannot price the alternative campaign. Each policy ran through purchases, refunds and settlement on the same seeds.</p></section>`+financial(r.evidence);
  const a=r.checkpoint,chosen=a.selected.ontology,e=r.evidence,stat=e.totals.statistical,o=e.totals.ontology;
  const example=r.changes.added.find(x=>x.product)||r.changes.added[0],removed=r.changes.removed.find(x=>x.product);
  return `<section class="feed-decision"><h3>Train on product recommendations</h3>
    <p>The current fit pooled ${num(a.windowRows)} contacts. The ontology routed ${num(a.routedToInquiries)} productless inquiries to their own model. The challenger fitted ${num(chosen.rows)} product contacts with ${chosen.positive} retained purchases.</p>
    <p>Historical validation selected <b>${chosen.fields.length} of ${a.inputFields.length} inputs</b> for purchase probability. Earlier market funding rates were eligible. This shopper’s eventual funding and refund were excluded.</p></section>
    <details><summary>Inspect feature choices and rejected inputs</summary><p>${esc(chosen.fields.join(', '))}</p>
    ${a.plan.excluded.map(x=>`<p><b>${esc(x.fields.join(', '))}</b> · ${esc(x.reason)}</p>`).join('')}
    <p>Price and stock still inform economic value and fulfillment. The probability model selected a different subset.</p></details>
    <h3>Same ${num(e.quality.ontology.n)} held-out product contacts</h3>
    <div class="performance-table"><table><thead><tr><th>Training choice</th><th>ROC AUC ↑</th><th>Average precision ↑</th><th>Log loss ↓</th></tr></thead><tbody>
    ${Object.entries(labels).map(([k,v])=>{const q=e.quality[k];return `<tr><th>${v}</th><td>${q.auc.toFixed(3)}</td><td>${q.averagePrecision.toFixed(3)}</td><td>${q.logLoss.toFixed(3)}</td></tr>`;}).join('')}</tbody></table></div>
    <p>At the same contact limit on day ${r.day}, ${r.changes.added.length} outreach choices change.${removed?' The '+esc(removed.product)+' recommendation for '+esc(removed.customerId)+' drops out.':''}${example?' '+esc(example.customerId)+' instead receives '+esc(example.product?'a '+example.product+' recommendation':'a shopping-needs inquiry')+'.':''}</p>
    ${financial(e)}<p>Against the statistical selector with ${a.selected.statistical.fields.length} fields, the differences were ${dollars(o.paypal-stat.paypal)} for PayPal, ${dollars(o.merchants-stat.merchants)} for merchants and ${sign(o.purchases-stat.purchases)} purchases.</p>
    <h3>What the launch verifier decided</h3><p>On day ${e.launch.day}, the local replay trained both models and tested their rankings in three development markets. Average PayPal gain over fixed rules was ${usd.format(e.launch.incumbentTrial.paypal)} with the current model and ${usd.format(e.launch.challengerTrial.paypal)} with the challenger. ${esc(e.launch.reason)} <b>Decision · ${esc(e.launch.decision)}.</b></p>
    <small>Tool choices in this replay were scripted. The four unseen markets above are a separate test. The $96 Sandbox receipt belongs to the original campaign. <a href="/data/ontology-training.json" download>All comparisons</a> · <a href="/data/ontology-training-review.json" download>Launch decision</a></small>`;
}
export function bindTrainingReview(showCampaign){
  const $=id=>document.getElementById(id),dialog=$('training-proof'),task=$('training-task'),output=$('training-proof-result');
  let serial=0;
  async function run(){
    const id=++serial;output.textContent='Resolving the training question…';
    try{
      const response=await fetch('/api/market/ontology/training?task='+encodeURIComponent(task.value),{cache:'no-store'});
      if(!response.ok)throw Error('The local training analysis could not be loaded.');
      const r=await response.json();if(id===serial)output.innerHTML=explain(r);
    }catch(error){if(id===serial)output.textContent=error.message;}
  }
  function open(){if(dialog.open)return;showCampaign();dialog.showModal();history.replaceState(null,'',location.pathname+location.search+'#training');task.value='retained_recommendation';void run();}
  task.onchange=run;$('close-training-proof').onclick=()=>dialog.close();
  document.addEventListener('click',e=>{if(e.target.closest('[data-open-training]')){e.preventDefault();open();}});
  dialog.addEventListener('close',()=>{serial++;if(location.hash==='#training')history.replaceState(null,'',location.pathname+location.search+'#campaign');});
  window.addEventListener('hashchange',()=>{if(location.hash==='#training')open();else if(dialog.open)dialog.close();});
  if(location.hash==='#training')open();
}
