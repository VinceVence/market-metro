import {total,usd} from './network.mjs';
import {createNetworkView,NW,NH} from './network-view.mjs';
import {REVIEW_SHIFTS,savedReceipt,createEvidenceEconomy,startEvidenceShift,tickEvidenceEconomy,advanceInvestigation,applyEvidenceReview,evidenceTotals,exportEvidenceEconomy,dollars} from './evidence-economy.mjs';

const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={hold:'Keep the full hold',checklist:'Use the initial feed',balanced:'Use investigated evidence'};
let receipt=null,loading=true,receiptError='',w=createEvidenceEconomy(),selected='M001',stamp='',previous=0,pauseBefore=false;
const view=createNetworkView($('economy'),group=>{selected=w.merchants.find(m=>m.group===group).id;render(true);});
const fact=(k,v)=>`<div class="fact-pair"><span>${k}</span><b>${v}</b></div>`;
const quote=d=>`<article class="agent-quote ${d.tone}"><span>${escape(d.role.toUpperCase())}</span><h3>${escape(d.title)}</h3><p>${escape(d.text)}</p></article>`;

async function loadReceipt(){
  loading=true;render(true);
  try {
    // Local persisted evidence only. No OAuth, upstream verification, create or capture request.
    const response=await fetch('/api/paypal/orders',{signal:AbortSignal.timeout(5000)});
    if(!response.ok)throw new Error('The local receipt store is unavailable.');
    const data=await response.json();
    if(!Array.isArray(data.orders))throw new Error('The receipt list is invalid.');
    receipt=savedReceipt(data.orders);receiptError=receipt?'':'No completed receipt with reconciled fee and net is saved here.';
  }catch(e){receipt=null;receiptError='Saved receipt unavailable. You can still run a clearly labeled synthetic economy.';}
  loading=false;reset(w.count);
}
function act(fn){try{$('error').textContent='';fn();render(true);}catch(e){$('error').textContent=e.message;}}
function reset(count){w=createEvidenceEconomy(count,receipt);selected='M001';stamp='';$('population').value=String(count);$('error').textContent='';render(true);}
function button(label,fn,disabled=false,cls='primary'){
  const b=document.createElement('button');b.textContent=label;b.disabled=disabled;b.className=cls;b.addEventListener('click',()=>act(fn));$('actions').append(b);
}
$('population').addEventListener('change',()=>reset(Number($('population').value)));
$('reset').addEventListener('click',()=>reset(w.count));
$('pause').addEventListener('click',()=>{w.paused=!w.paused;render(true);});
$('speed').addEventListener('click',()=>{w.speed=w.speed===1?2:1;render(true);});
$('merchant-select').addEventListener('change',()=>{selected=$('merchant-select').value;render(true);});
for(const [trigger,dialog] of [['debate-open','debate-dialog'],['compare-open','compare-dialog'],['rules-open','rules-dialog'],['receipt-open','receipt-dialog'],['evidence-open','evidence-dialog']]){
  $(trigger).addEventListener('click',()=>openDialog(dialog));
}
$('export').addEventListener('click',()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(exportEvidenceEconomy(w),null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='supply-yard-evidence-replay.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
document.querySelectorAll('dialog').forEach(d=>{
  d.querySelector('.close-dialog').addEventListener('click',()=>d.close());
  d.addEventListener('close',()=>{w.paused=pauseBefore;render(true);});
});
function openDialog(id){pauseBefore=w.paused;w.paused=true;renderDialog(id);$(id).showModal();render(true);}
function resize(){
  const f=$('world-frame'),c=$('economy'),width=innerWidth<=800?Math.max(f.clientWidth,780):Math.min(f.clientWidth,f.clientHeight*NW/NH);
  c.style.width=width+'px';c.style.height=width*NH/NW+'px';
}
new ResizeObserver(resize).observe($('world-frame'));

function receiptStrip(){
  const r=w.paymentReference;
  $('receipt-status').textContent=loading?'Loading saved payment evidence…':r?`Saved sandbox receipt · ${dollars(r.grossCents)} gross → ${dollars(r.netCents)} net`:'Synthetic-only run';
  $('receipt-note').textContent=loading?'Reading this project’s local store.':r?'Linked to Mara Paper · reused every run · no new checkout':receiptError;
  $('receipt-open').disabled=loading;
}
function merchantDetail(){
  const m=w.merchants.find(m=>m.id===selected),e=evidenceTotals(w,selected),r=w.plans.find(p=>p.kind===w.selectedPlan)?.rows.find(r=>r.id===selected);
  $('merchant-select').innerHTML=w.merchants.map(m=>`<option value="${m.id}"${m.id===selected?' selected':''}>${escape(m.name)}</option>`).join('');
  $('merchant-detail').innerHTML=fact('Available cash',dollars(m.cash))+fact('Total reserve',dollars(m.reserve))
    +fact('Paid / physically delivered',`${m.due} / ${m.delivered} kits`)
    +(e.units?fact('Initial → investigated proof',`${e.initial} → ${e.confirmed} kits`):'')
    +(r?fact('Proposed / approved release',dollars(r.release)):'')
    +'<p class="micro-note">Physical counts belong to the environment. Agents receive only source records.</p>';
}
function focusReview(){
  const m=w.merchants.find(m=>m.id===selected),p=w.plans.find(p=>p.kind===w.selectedPlan),r=p.rows.find(r=>r.id===selected);
  const baseline=w.plans[1].rows.find(r=>r.id===selected),after=w.plans[2].rows.find(r=>r.id===selected);
  return `<div class="focus-review"><span class="kicker">${escape(m.name)} · THIS SHIFT’S RECEIPTS</span><div class="hold-change"><span>${dollars(r.before)}<small>held before review</small></span><b>→</b><span>${dollars(r.held)}<small>${w.approval?'approved hold':'proposed hold'}</small></span></div>
    <p>${after.initial} initial proofs → <b>${after.verified} confirmed</b>. ${after.unresolved} remain unverified.</p>
    ${fact('Initial-feed hold',dollars(baseline.held))}${fact('Cash released by selected policy',dollars(r.release))}
    <small>Rule: $10 per unverified kit + $2 per verified kit, capped at this order’s net. Prior-shift holds stay separate.</small></div>`;
}
function render(force=false){
  const key=[w.phase,w.shift,w.events.length,w.debateIndex,w.queries.length,w.selectedPlan,w.paused,w.speed,selected,loading,receiptError].join('|');
  if(!force&&key===stamp)return;stamp=key;receiptStrip();
  const e=evidenceTotals(w),due=total(w.merchants,'due'),delivered=total(w.merchants,'delivered');
  $('population-label').textContent=`${w.count} merchants · ${w.count*4} offices`;
  $('captured').textContent=usd(w.ledger.captured);
  $('reserves').textContent=usd(total(w.merchants,'reserve'));
  $('released').textContent=usd(w.ledger.released);
  $('captured-note').textContent=`${w.orders.length} simulated batches · ${w.paymentReference&&w.shift>=0?'one references the saved receipt':'generated payments'}`;
  $('release-note').textContent=w.shift<0?'Cash freed for merchants, not PayPal profit':`${usd(w.ledger.refunds)} simulated refunds · ${usd(w.ledger.paypalCoverage)} provider shortfall`;
  $('pause').textContent=w.paused?'Resume':'Pause';$('pause').setAttribute('aria-label',w.paused?'Resume economy':'Pause economy');$('speed').textContent=w.speed+'×';
  $('debate-open').disabled=!w.debate.length;$('compare-open').disabled=!w.plans.length;$('evidence-open').disabled=!w.cases.length;
  $('world-status').textContent=w.shift<0?'ONE PAYMENT RECEIPT → A SIMULATED ECONOMY':`SHIFT ${w.shift+1} · ${REVIEW_SHIFTS[w.shift].name.toUpperCase()}`;
  const stage=w.phase==='ready'?-1:w.phase==='orders'?0:w.phase==='delivery'?1:w.phase==='debate'?2:3;
  $('shift-strip').innerHTML=['Offices order','Merchants & vans','Agents investigate','PayPal reviews'].map((s,i)=>`<span class="${i===stage?'active':i<stage?'done':''}"><b>${i+1}</b>${s}</span>`).join('');
  $('world-detail').textContent=stage<0?'Start once. The economy generates the rest.':stage===0?`${due} kits requested · synthetic payment records created`:stage===1?`${delivered}/${due} kits delivered · source evidence appearing`:`${e.initial} initial proofs → ${e.confirmed} confirmed · ${e.unresolved} unverified`;
  $('live-flow').textContent=$('world-status').textContent+'. '+$('world-detail').textContent;
  $('economy').setAttribute('aria-label',`${w.count} merchants. ${due} paid kits, ${delivered} physical deliveries. ${e.confirmed} delivery proofs available to agents. ${dollars(total(w.merchants,'reserve'))} held in simulated reserves. Use merchant inspector and Evidence trail for details.`);
  $('actions').replaceChildren();let content='',objective='';
  if(w.phase==='ready'){
    content=`<span class="eyebrow">PAYPAL RESERVE REVIEW · SCRIPTED DEMO</span><h2>Paid doesn’t mean<br>delivered.</h2><p>Offices order stock. Merchants restock. Vans deliver—but some delivery evidence goes missing.</p>
      <div class="authority"><b>The agents’ job</b><span>Find missing carrier records.</span><span>Reject proof for the wrong order.</span><span>Recommend which funds PayPal can release.</span></div>
      <p>You approve the <b>simulated reserve change</b>. Released cash helps merchants afford the next shift.</p><p class="micro-note">${w.paymentReference?'Your saved PayPal receipt anchors Mara Paper’s first order.':'All payment records are synthetic.'} Deliveries and reserves are generated. No LLM or checkout during a run.</p>`;
    objective='Start → automatic orders, vans and investigation → one local review approval.';
    button(loading?'Loading receipt…':'Run the economy →',()=>startEvidenceShift(w),loading);
  }else if(w.phase==='orders'){
    content=`<span class="eyebrow">1 · GENERATED OFFICE ORDERS</span><h2>The orders arrive.</h2><p>${due} kits are requested. This demo holds each new order’s net proceeds for review. Merchants restock using their own available cash.</p>
      ${fact('This shift’s retail price','$10 / kit')}${fact('Procurement cost',dollars(REVIEW_SHIFTS[w.shift].price)+' / kit')}
      <div class="callout blue">The saved PayPal receipt is evidence. These replay entries do not charge its buyer again.</div>`;
    objective='Orders and restock requests generate automatically.';button('Orders arriving…',()=>{},true);
  }else if(w.phase==='delivery'){
    content=`<span class="eyebrow">2 · MERCHANTS RESTOCK · VANS DELIVER</span><h2>Deliveries leave a trail.</h2><p>Stock and cash limit each merchant’s purchase. The environment generates deliveries, missing scans and source records as vans arrive.</p>
      ${fact('Kits purchased',total(w.merchants,'purchased')+' / '+due)}${fact('Physically delivered',delivered+' kits')}${fact('Proof in the initial feed',e.initial+' kits')}
      <p class="micro-note">The investigators cannot read the environment’s delivery counts or hidden outcomes. They must retrieve matching evidence.</p>`;
    objective='Watch the vans. Investigation starts automatically when routes finish.';button('Delivering & generating evidence…',()=>{},true);
  }else if(w.phase==='debate'){
    const d=w.debate.at(-1);
    content=`<span class="eyebrow">3 · SCRIPTED INVESTIGATION · ${w.debateIndex} / 5</span><h2>Check the evidence.<br>Challenge the release.</h2>${quote(d)}
      <div class="evidence-counts"><span><b>${e.initial}</b>initial proofs</span><span><b>${e.confirmed}</b>confirmed now</span><span><b>${e.rejected}</b>wrong-order proofs</span></div>
      <p class="micro-note">${w.queries.length} scripted source lookups. Generated carrier and office data; no LLM.</p>`;
    objective='The team retrieves evidence and disagrees about releasing the funds.';
    button(w.debateIndex===5?'Review reserve changes →':'Next investigation step →',()=>advanceInvestigation(w));
  }else if(w.phase==='review'){
    const p=w.plans.find(p=>p.kind===w.selectedPlan);
    content=`<span class="eyebrow">4 · SIMULATED PAYPAL REVIEWER</span><h2>What can we release?</h2>
      <div class="policy-choices">${w.plans.map(p=>`<button class="policy-choice ${p.kind===w.selectedPlan?'selected':''}" data-policy="${p.kind}" aria-pressed="${p.kind===w.selectedPlan}"><span><b>${names[p.kind]}</b><small>${p.kind==='balanced'?'Same rule + retrieved source records':p.kind==='checklist'?'Same rule + starting evidence only':'No discretionary release'}</small></span><span><b>${dollars(p.released)}</b><small>network release</small></span></button>`).join('')}</div>
      ${focusReview()}<p class="micro-note">${p.releaseCount} merchants receive cash. Reserves change only after your local approval.</p>`;
    objective='PayPal’s simulated decision: release supported funds; retain the unverified portion.';
    button('Approve simulated reserve change →',()=>applyEvidenceReview(w,w.selectedPlan));
  }else if(w.phase==='settling'){
    content=`<span class="eyebrow">APPROVED · LOCAL MONEY MOVEMENT</span><h2>${dollars(w.applied.released)} released.</h2><p>Each release moves that merchant’s money from reserve into available cash. No PayPal API is called.</p>
      ${focusReview()}<p class="micro-note">Next, the authored refund window closes. Actual undelivered units are refunded from merchant funds first.</p>`;
    objective='Reserve releases are applied. The generated refund window is closing.';button('Closing refund window…',()=>{},true);
  }else{
    const h=w.history.at(-1),m=w.merchants.find(m=>m.id===selected),r=w.applied.rows.find(r=>r.id===selected);
    const price=REVIEW_SHIFTS[w.shift+1]?.price;
    content=`<span class="eyebrow">SHIFT ${w.shift+1} COMPLETE · CONSEQUENCES CARRY FORWARD</span><h2>${w.shift<2?'The next restock changes.':'Three shifts. One audit trail.'}</h2>
      <p>${h.evidence.confirmed-h.evidence.initial} extra delivery proofs recovered. ${dollars(h.released)} released across the network.</p>
      <div class="focus-review"><span class="kicker">${escape(m.name)}</span>${fact('Release approved',dollars(r.release))}${fact('Refunds for undelivered kits',dollars(m.refunded))}${fact('Cash / remaining reserve',dollars(m.cash)+' / '+dollars(m.reserve))}
      ${price?fact('Cash can fund next shift',`${Math.floor(m.cash/price)} kits at ${dollars(price)}`):''}</div>
      <p class="micro-note">Reserve after refunds differs from the review hold. ${dollars(h.coverage)} modeled PayPal shortfall this shift. Freed cash is merchant liquidity; it is not a measured PayPal saving.</p>`;
    objective=w.shift<2?`Next: ${REVIEW_SHIFTS[w.shift+1].name}. Same wallets, new orders and evidence. No checkout.`:'Restart reuses the saved receipt; export preserves all three investigations.';
    button(w.shift<2?'Open next shift →':'Replay the economy →',()=>w.shift<2?startEvidenceShift(w):reset(w.count));
  }
  $('mission').innerHTML=content;$('objective-text').textContent=objective;
  document.querySelectorAll('[data-policy]').forEach(b=>b.addEventListener('click',()=>{w.selectedPlan=b.dataset.policy;render(true);}));
  $('agent-roster').innerHTML=w.roles.map((name,i)=>`<button data-role="${name}" class="role-${i}" ${w.debate.length?'':'disabled'}><i>${name[0]}</i><span>${name}<small>${['Protect funds','Retrieve proof','Free cash','Recommend'][i]}</small></span></button>`).join('');
  document.querySelectorAll('[data-role]').forEach(b=>b.addEventListener('click',()=>openDialog('debate-dialog')));
  merchantDetail();
}
function renderDialog(id){
  if(id==='debate-dialog')$('debate-transcript').innerHTML=w.debate.map(quote).join('');
  if(id==='receipt-dialog'){
    const r=w.paymentReference;
    $('receipt-detail').innerHTML=r?`<p><b>One saved sandbox capture, reused as a payment reference.</b> It anchors Mara Paper’s first simulated order. Restarting does not create or capture another payment.</p>
      ${fact('Capture ID',escape(r.captureId))}${fact('Order ID',escape(r.orderId))}${fact('Gross / provider fee / net',`${dollars(r.grossCents)} / ${dollars(r.feeCents)} / ${dollars(r.netCents)}`)}
      ${fact('Last provider verification',escape(new Date(r.verifiedAt).toLocaleString()))}<p>Loaded from the local receipt store. This page does not recheck PayPal on every run. Only the original payment fields came from PayPal; its delivery and reserve histories are generated here.</p>`
      :`<p>${escape(receiptError)}</p><p>All payment records in this run are synthetic. To attach a new receipt, use the optional <a href="/sandbox.html">sandbox setup page</a>.</p>`;
  }
  if(id==='compare-dialog'){
    $('policy-comparison').innerHTML=`<table><thead><tr><th>Same current orders</th>${w.plans.map(p=>`<th>${names[p.kind]}</th>`).join('')}</tr></thead><tbody>
      ${[['Proofs accepted','verified'],['Unverified kits','unresolved'],['Merchant releases','releaseCount'],['Funds released','released'],['Current receipts still held','held']].map(([label,key])=>`<tr><th>${label}</th>${w.plans.map(p=>`<td>${['released','held'].includes(key)?dollars(p[key]):p[key]}</td>`).join('')}</tr>`).join('')}</tbody></table>
      <p class="micro-note">The initial-feed and investigated options use exactly the same reserve formula. The difference is retrieved evidence. All balances, releases and later outcomes are simulated. No claim that scripted agents outperform ordinary software.</p>`;
  }
  if(id==='evidence-dialog'){
    const cases=w.cases.filter(u=>u.merchant===selected),m=w.merchants.find(m=>m.id===selected);
    $('evidence-title').textContent=m.name+' · evidence trail';
    $('evidence-trail').innerHTML=`<p>Generated records for the selected merchant. Change the merchant in the inspector to inspect another case.</p><div class="evidence-table"><table><thead><tr><th>Kit</th><th>Initial feed</th><th>Carrier lookup</th><th>Office lookup</th><th>Decision</th></tr></thead><tbody>
      ${cases.map((u,i)=>`<tr><th>${i+1}</th><td>${u.feed?'Matched proof':'No scan'}</td><td>${u.rejected?'Rejected: wrong order':u.carrier?.status==='DELIVERED'?'Matched order + kit':u.carrier?'No proof':'Not queried'}</td><td>${u.buyer?escape(u.buyer.status.replaceAll('_',' ')):'Not queried'}</td><td class="${u.confirmed?'proof-ok':'proof-gap'}">${u.confirmed?'Verified · 20% buffer':'Unverified · hold gross'}</td></tr>`).join('')}</tbody></table></div>
      <details><summary>Source references and responses</summary><pre>${escape(JSON.stringify({order:w.currentOrders.find(o=>o.merchant===selected),queries:w.queries.filter(q=>cases.some(c=>c.id===q.unitId))},null,2))}</pre></details>`;
  }
}
document.addEventListener('visibilitychange',()=>{previous=0;});
document.addEventListener('keydown',e=>{if(e.code==='Space'&&e.target===document.body&&!document.querySelector('dialog[open]')){e.preventDefault();w.paused=!w.paused;render(true);}});
function frame(t){
  const dt=previous?Math.min(.1,(t-previous)/1000):0;previous=t;
  if(!document.hidden){tickEvidenceEconomy(w,dt);view.draw(w,w.merchants.find(m=>m.id===selected).group);render();}
  requestAnimationFrame(frame);
}
render(true);resize();requestAnimationFrame(frame);loadReceipt();
