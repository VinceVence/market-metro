import {createGarden} from '../garden/world.mjs';
import {esc,money} from '../garden/ui.mjs';
import {bindMerchantScale} from './merchant-scale.mjs';
import {bindFeedProof} from './feed-proof.mjs';
import {bindPlannerReview} from './planner-review.mjs';
import {bindTrainingReview} from './training-review.mjs';

const $=id=>document.getElementById(id);
const usd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const signed=n=>(n>0?'+':'')+usd.format(n);
const models={response_hurdle:'Two-stage response',boosted:'Boosted trees',logistic:'Logistic regression',forest:'Random forest'};
const labels=['Market','Evidence','Campaign','Verifier','Shopper purchase','PayPal receipt','Result'];
const hashes=['market','evidence','campaign','verifier','purchase','receipt','result'];
const dl=rows=>'<dl>'+rows.map(([label,value])=>`<dt>${esc(label)}</dt><dd>${esc(value)}</dd>`).join('')+'</dl>';

function chapters(d){
  const e=d.evidence,p=d.decision,s=d.shopper,r=d.receipt;
  const customer='Shopper '+String(s.name).padStart(3,'0'),merch=esc(s.merchant),product=esc(s.product);
  return [
    {day:1,source:'Simulated economy',title:'Who should the merchants contact?',body:
      `<p>Shoppers buy office supplies across 12 stores. After 30 days of shopping, the planner gets one chance to design a campaign.</p>
      ${dl([['Shoppers',600],['Planning day',31],['Market closes','Day '+d.marketDays],['Refunds and settlement','Through day '+d.settledDay]])}
      <p>The comparison follows the same shoppers under strong fixed rules. After the walkthrough, run your own seed and inspect its ontology, workflow and payment evidence.</p>`},
    {day:31,source:'Observed simulation data · recorded LLM investigation',title:'Interest and funding told different stories.',body:
      `<p>The planner inspected category demand. It saw ${e.openFundedRequests} open funded requests and ${e.observedContacts} mature campaign outcomes in this market.</p>
      <table><thead><tr><th>Category</th><th>7-day interest signals</th><th>Funded units¹</th></tr></thead><tbody>
      ${['Electronics','Furniture'].map(k=>`<tr><th scope="row">${k}</th><td>${e.categories[k].interest7}</td><td>${e.categories[k].fundedUnits}</td></tr>`).join('')}</tbody></table>
      <p>Of ${e.retained} retained purchases in the historical training data, ${e.retainedAfterDelay} funded later. The planner chose to predict purchases that survived settlement.</p>
      <small>¹ Units in open funded requests at review time.</small>`},
    {day:31,source:'Recorded Gemini proposal · local training',title:'Recommend a product or ask what the shopper needs.',body:
      `<p>Rank consenting shoppers by the expected value for both PayPal and the merchant. Use recent interest and prior market responses to choose whom to contact.</p>
      ${dl([['Daily ceiling',p.per100*6+' contacts across 600 shoppers'],['Feature window',p.window+' days'],['Local model fits','2'],['Planner’s first choice',models[p.original.family]]])}
      <p><button type="button" data-open-training>Try ontology-guided model training</button></p>
      <p><button type="button" data-open-training="live">Compare the fresh Gemini campaigns</button></p>
      <details><summary>Read the recorded proposal</summary><p>${esc(p.rationale)}</p></details>`},
    {day:31,source:'Deterministic verifier · simulated financial trials',title:'The verifier switched the ranking model.',body:
      `<p>Both models ranked shoppers for the same campaign in three separate trial markets. The verifier chose ${esc(models[p.chosen.family].toLowerCase())} after checking PayPal earnings, merchant outcomes and retained purchases.</p>
      <table><caption>Average gain over fixed rules in development</caption><thead><tr><th>Ranking model</th><th>PayPal</th><th>Merchants</th></tr></thead><tbody>
      ${[p.original,p.chosen].map(m=>`<tr><th scope="row">${esc(models[m.family])}</th><td>${signed(m.paypal)}</td><td>${signed(m.merchants)}</td></tr>`).join('')}</tbody></table>
      <p>The campaign was locked before these shoppers’ later purchases were measured.</p><p><button type="button" data-open-planner-review>Try a feed that holds this campaign</button></p><a href="#ontology" data-open-ontology>Verify what counts as a purchase ↗</a>`},
    {day:s.purchaseDay,source:'Simulated shopper · observed purchase and delivery',title:customer+' bought a '+s.product+'.',body:
      `<p>${s.daysSincePurchase!=null?`Their previous purchase was ${s.daysSincePurchase} days earlier. `:''}${merch} fulfilled the order after the planner’s recommendation.</p>
      ${dl([['Recommendation','Day '+s.contactDay],['Funded and purchased',s.fundedDay===s.purchaseDay?'Day '+s.purchaseDay:'Days '+s.fundedDay+' and '+s.purchaseDay],
        ['Simulated checkout',money(s.grossCents)],['Delivery','Day '+s.deliveryDay+(s.onTime?' · on time':'')]])}
      <p>${s.fixedBought?'Fixed rules also filled this request.':'The same request went unfilled under fixed rules.'} ${s.originalBought?'The original ranking also filled it.':'It also went unfilled under the planner’s original ranking.'}</p>`},
    {day:s.deliveryDay,source:'PayPal Sandbox · verified capture · test funds',title:'Follow that checkout to PayPal.',body:
      `<p>We mirrored ${esc(customer)}’s ${product} purchase once to the connected Sandbox test store.</p>
      <p class="receipt-total"><img class="receipt-mark" src="/figures/planner-v23/assets/paypal.svg" alt="">${money(r.gross_cents)}</p>
      ${dl([['Capture status',r.status],['Sandbox fee',money(r.fee_cents)],['Test merchant received',money(r.net_cents)]])}
      <p>PayPal capture <code>${esc(r.capture_id)}</code></p><details><summary>Match the provider receipt to the warehouse</summary>
      <p>PayPal order<br><code>${esc(r.paypal_order_id)}</code></p><p>Warehouse order / PayPal custom ID<br><code>${esc(r.order_id)}</code></p><p>Verified <time>${esc(r.verified_at)}</time></p></details>
      <small>Playback reads this saved receipt. The benchmark counts the simulated sale once.</small>
      <p><button type="button" data-open-ontology>Why is this one purchase?</button></p>`},
    {day:d.settledDay,source:'Simulated results after refunds, settlement and AI cost',title:d.vsFixed.purchases+' more retained purchases.',body:
      `<table><thead><tr><th>Outcome</th><th>Fixed rules</th><th>Planner + verifier</th><th>Gain</th></tr></thead><tbody>
      ${[['PayPal net','paypal'],['Merchants¹','merchants'],['Purchases','purchases']].map(([l,k])=>`<tr><th scope="row">${l}</th><td>${k==='purchases'?d.fixed[k]:usd.format(d.fixed[k])}</td><td>${k==='purchases'?d.planner[k]:usd.format(d.planner[k])}</td><td class="gain">${k==='purchases'?'+'+d.vsFixed[k]:signed(d.vsFixed[k])}</td></tr>`).join('')}</tbody></table>
      <p>Changing only the ranking model added ${signed(d.vsOriginal.paypal)} in PayPal net, ${signed(d.vsOriginal.merchants)} for merchants and ${d.vsOriginal.purchases} retained purchases over the planner’s original choice.</p>
      <small>¹ Merchant contribution includes inventory value. PayPal net includes the original $${p.reviewCostUSD.toFixed(6)} in model usage.</small>
      <div class="judge-handoff"><h3>Now try your own market</h3><p>Choose a seed and scenario. Follow the resulting purchases in Ontology graph, inspect Agent workflow, then check the payment records in PayPal Sandbox.</p><a class="primary" href="/studio.html?view=market&amp;judge=1&amp;setup=1">Run your own simulation →</a><small>Fresh Gemini planning or a free run with the recorded policy. Sandbox receipts use test funds.</small></div>
      <p><a href="/studio.html?view=performance&amp;evaluation=reactivation-fresh">Compare all six fresh markets ↗</a> · <a href="#scale" data-open-scale>Test merchant scale ↗</a></p>`}
  ];
}

async function start(){
  const response=await fetch('/data/judge-reactivation.json');if(!response.ok)throw Error('Recorded campaign unavailable.');
  const d=await response.json(),r=d.receipt,s=d.shopper;
  if(r?.status!=='COMPLETED'||r.source!=='PAYPAL_SANDBOX'||r.currency!=='USD'||!r.capture_id||
    r.run_id!==d.runId||r.order_id!==s.orderId||r.merchant_id!==s.merchantId||r.gross_cents!==s.grossCents||
    r.fee_cents+r.net_cents!==r.gross_cents)throw Error('The saved receipt does not match this campaign order.');
  const steps=chapters(d);let i=Math.max(0,hashes.indexOf(location.hash.slice(1))),timer=null;
  const garden=createGarden($('world'),{night:true,autoFit:true,paymentLabel:'PayPal Sandbox',onCustomer:id=>{if(id===s.id)go(4);},
    onTeam:()=>go(2),onPayments:()=>go(5)});
  $('market-meta').textContent='One LLM planner + local verifier · Seed '+d.seed;
  $('chapters').innerHTML=labels.map((label,n)=>`<button type="button" data-chapter="${n}">${label}</button>`).join('');
  const buttons=[...$('chapters').querySelectorAll('button')];
  function render(){
    const step=steps[i],frame=d.frames[step.day];
    $('source').textContent=step.source;$('heading').textContent=step.title;$('content').innerHTML=step.body;
    $('market-day').textContent='Market day '+step.day;
    $('frame-note').textContent=i===4?s.merchant+' · '+money(s.grossCents)+' simulated checkout':
      i===5?'Delivery recorded on day '+s.deliveryDay:frame.orders.toLocaleString()+' checkouts since day 1';
    buttons.forEach((b,n)=>{if(n===i)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
    $('back').disabled=i===0;$('next').disabled=false;$('next').textContent=i===steps.length-1?'Start again':'Next';
    $('position').textContent='Step '+(i+1)+' of '+steps.length+' · '+labels[i];
    if($('world').dataset.renderState==='unavailable'){
      $('world').hidden=true;$('flat-market').hidden=false;
      $('flat-market').innerHTML=frame.merchants.map(m=>`<span>${esc(m.name)}<small>${m.sold} units sold</small></span>`).join('');
      $('names').disabled=true;$('reset-camera').disabled=true;
    }else{
      garden.setFrame(frame);garden.setNamesVisible($('names').checked);garden.setPaused(false);
      garden.home();if(i===4)garden.focusStation(s.merchantId);
    }
    if(i===steps.length-1)pause();
  }
  function pause(){clearInterval(timer);timer=null;$('auto').textContent='Play walkthrough';$('auto').setAttribute('aria-pressed','false');}
  function go(n,manual=true){
    if(manual)pause();i=n;history.replaceState(null,'',location.pathname+location.search+(i?'#'+hashes[i]:''));
    render();
  }
  buttons.forEach((b,n)=>b.onclick=()=>go(n));
  $('back').onclick=()=>go(Math.max(0,i-1));$('next').onclick=()=>go((i+1)%steps.length);
  $('auto').disabled=false;$('auto').onclick=()=>{if(timer)return pause();if(i===steps.length-1)go(0);
    $('auto').textContent='Pause';$('auto').setAttribute('aria-pressed','true');
    timer=setInterval(()=>go(i+1,false),9000);};
  $('names').onchange=()=>garden.setNamesVisible($('names').checked);$('reset-camera').onclick=()=>garden.home();
  $('chapters').onkeydown=e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();go(Math.max(0,Math.min(steps.length-1,i+(e.key==='ArrowRight'?1:-1))));buttons[i].focus();}};
  window.addEventListener('pagehide',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  render();
  bindMerchantScale(pause);
  bindFeedProof(pause);
  bindPlannerReview(()=>go(3));
  bindTrainingReview(()=>go(2));
}
start().catch(error=>{$('judge-error').textContent=error.message;$('judge-error').hidden=false;});
