import {esc,money,num} from '../garden/ui.mjs';
import {verifyMerchantFeed} from './feed-verifier.mjs';

const label=result=>result.decision==='CERTIFY'?'Certified':'Held';
const nextSteps={
  'ambiguous-link':'Ask the merchant which key connects an order to the shopper checkout. Matching sample values cannot resolve two declared links.',
  'unit-unknown':'Ask the merchant to declare dollars or cents for this column.',
  'gross-disagreement':'Reconcile the missing or excess merchant amount against the checkout control total.',
  'table-binding':'Request the row grain and a declared primary key for the checkout and merchant-order records.'
};
function explain({ontology:r,fixed}){
  const comparison=`<p class="feed-comparison">Fixed mapping <b>${label(fixed)}</b> · Ontology verifier <b>${label(r)}</b></p>`;
  if(r.decision==='HOLD')return comparison+`<section class="feed-decision held"><h3>Hold this feed</h3><p>${esc(r.reason)}</p>
    <p>${esc(nextSteps[r.code]||'Clarify the source contract or correct the records before publishing a campaign measurement.')}</p></section>
    <p><a href="/judge.html#planner">See a campaign pause and resume on day 31 ↗</a></p>`;
  const m=r.metrics,s=r.splitExample,p=r.payment,g=r.mapping;
  return comparison+`<section class="feed-decision"><h3>Admit the checkout count</h3>
    <p><b>${num(m.purchases)} captured shopper checkouts</b> reconcile to ${num(m.merchantOrders)} merchant orders. ${num(m.splitBaskets)} checkouts involved multiple stores.</p>
    ${s?`<p>One split checkout totaled <b>${money(s.grossCents)}</b>. Its merchant portions were ${s.legs.map(l=>money(l.gross)).join(' + ')}. Together they count as one purchase.</p>`:''}
    <small>Gross at capture ${money(m.grossCents)}. ${p?'The full judge run includes warm-up and purchases later refunded.':'The count includes purchases later refunded.'}</small></section>
    ${p?`<h3>One purchase, two records</h3><p>The simulated merchant order was ${money(p.grossCents)}. The saved PayPal Sandbox capture confirms the same order in test funds. It adds <b>${p.extraPurchases} purchases and ${money(p.extraGrossCents)}</b> to campaign totals.</p>
    <p>Sandbox fee <b>${money(p.feeCents)}</b> · Test merchant proceeds <b>${money(p.netCents)}</b></p>`:''}
    <details><summary>Show the verified relationships</summary>
      <p>${g.layout==='flat'?'Group the repeated seller rows by':'Count the primary keys in'} <code>${esc(g.checkoutTable)}.${esc(g.checkoutKey)}</code>. Each distinct order in <code>${esc(g.orderTable)}.${esc(g.orderKey)}</code> belongs to one checkout through <code>${esc(g.orderToCheckout)}</code>.</p>
      <p>Sum <code>${esc(g.orderGross)}</code> (${esc(g.orderUnit)}) within each checkout and compare to <code>${esc(g.checkoutGross)}</code> (${esc(g.checkoutUnit)}).</p>
      ${p?`<p>Checkout <code>${esc(p.basket)}</code><br>Merchant order / PayPal custom ID <code>${esc(p.merchantOrder)}</code><br>PayPal capture <code>${esc(p.capture)}</code></p>`:''}
      ${fixed.reason?`<p>Fixed mapping held the feed. ${esc(fixed.reason)}</p>`:''}</details>`;
}

export function bindFeedProof(pause){
  const $=id=>document.getElementById(id),dialog=$('feed-proof'),example=$('feed-example'),run=$('verify-feed');
  const output=$('feed-proof-result'),file=$('feed-file');
  let serial=0,from='',benchLoaded=false;
  async function check(){
    const n=++serial;run.disabled=true;output.textContent='Checking keys, units and totals…';
    try{
      let result;
      if(example.value==='local'){
        const selected=file.files[0];if(!selected||selected.size>2_000_000)throw Error('Choose a JSON file of at most 2 MB.');
        const input=JSON.parse(await selected.text());
        result={fixed:verifyMerchantFeed(input,{mode:'fixed'}),ontology:verifyMerchantFeed(input)};
      }else{
        const response=await fetch('/api/market/ontology/verify?example='+encodeURIComponent(example.value),{cache:'no-store'});
        if(!response.ok)throw Error('The local feed could not be checked.');result=await response.json();
      }
      if(n===serial)output.innerHTML=explain(result);
    }catch(error){if(n===serial)output.textContent='Hold this feed. '+error.message;}
    finally{if(n===serial)run.disabled=false;}
  }
  async function benchmark(){
    if(benchLoaded)return;
    try{
      const response=await fetch('/data/ontology-study.json');if(!response.ok)throw Error();
      const b=await response.json(),t=b.total;
      $('feed-benchmark').innerHTML=`<p>Both methods saw the same ${b.answerable+b.unsafe} synthetic exports. Their physical schemas and records were generated after the methods were frozen.</p>
      <div class="performance-table"><table><thead><tr><th>Method</th><th>Answerable certified exactly</th><th>Unsafe held</th><th>False certifications</th></tr></thead><tbody>
      ${[['Fixed mapping',t.fixed],['Ontology verifier',t.ontology]].map(([name,r])=>`<tr><th scope="row">${name}</th><td>${r.exactCertifications}/${b.answerable}</td><td>${r.unsafeHeld}/${b.unsafe}</td><td>${r.falseCertifications}</td></tr>`).join('')}</tbody></table></div>
      <p>Both use the same accounting checks. Business descriptions, declared keys and units let the ontology verifier bind unfamiliar headers. <a href="/data/ontology-study.json" download>All cases and seed</a></p>`;
      benchLoaded=true;
    }catch{$('feed-benchmark').textContent='The saved benchmark is unavailable.';}
  }
  function open(previous=location.hash){
    if(dialog.open)return;pause();from=previous==='#ontology'?'':previous;
    dialog.showModal();history.replaceState(null,'',location.pathname+location.search+'#ontology');
    example.value='warehouse';void check();void benchmark();
  }
  document.addEventListener('click',e=>{if(e.target.closest('[data-open-ontology]')){e.preventDefault();open();}});
  example.onchange=check;run.onclick=check;$('close-feed').onclick=()=>dialog.close();
  file.onchange=()=>{
    if(!file.files.length)return;
    let local=example.querySelector('[value="local"]');if(!local){local=new Option('Local file','local');example.add(local);}
    local.textContent='Local · '+file.files[0].name;example.value='local';void check();
  };
  dialog.addEventListener('close',()=>{serial++;if(location.hash==='#ontology')history.replaceState(null,'',location.pathname+location.search+from);});
  window.addEventListener('hashchange',e=>{
    if(location.hash==='#ontology')open(new URL(e.oldURL).hash);
    else if(dialog.open)dialog.close();
  });
  if(location.hash==='#ontology')open();
}
