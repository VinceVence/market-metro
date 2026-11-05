import {esc,money,num} from '../garden/ui.mjs';

export function bindPlannerReview(showReview){
  const $=id=>document.getElementById(id),dialog=$('planner-feed'),held=$('planner-feed-held'),after=$('planner-feed-resumed');
  const fix=$('repair-planner-feed');let holdId=null,serial=0;
  async function run(corrected){
    const token=++serial;fix.disabled=true;
    if(!corrected){holdId=null;held.textContent='Reading the day-31 merchant export…';after.replaceChildren();}
    else after.textContent='Rechecking the same rows and the recorded financial trials…';
    try{
      const query=corrected?'?phase=corrected&holdId='+encodeURIComponent(holdId):'?phase=hold';
      const response=await fetch('/api/market/ontology/planner'+query,{cache:'no-store'}),r=await response.json();
      if(token!==serial)return;if(!response.ok)throw Error(r.error?.message||'The local planner review could not run.');
      const b=r.before;holdId=b.holdId;
      held.innerHTML=`<section class="feed-decision held"><h3>Held · request the checkout key</h3>
        <p>The merchant declared both <code>${esc(b.declaredLinks[0])}</code> and <code>${esc(b.declaredLinks[1])}</code> as links to a shopper checkout. Their values agree in this sample.</p>
        <p><b>${b.plannerEntries} planning runs · ${b.contacts} campaign contacts</b>. The economic clock waits at this review.</p></section>`;
      if(!corrected){fix.disabled=false;return;}
      const a=r.after,m=a.admission.metrics;
      after.innerHTML=`<section class="feed-decision"><h3>Published in the replay · ${esc(a.campaign.replaceAll('_',' '))}</h3>
        <p>The merchant confirmed <code>${esc(a.admission.checkoutKey)}</code>. The same rows now reconcile to <b>${num(m.purchases)} captured checkouts</b> across ${num(m.merchantOrders)} merchant orders through day ${r.throughDay}. ${num(m.splitBaskets)} checkouts split across stores.</p>
        <p>The planner resumed once. It replayed its saved campaign proposal, checked ${a.candidatesChecked} candidates against recorded development trials, and selected ${esc(a.model==='boosted'?'boosted trees':a.model)} to rank eligible shoppers.</p>
        <p><b>${a.recommendations} product recommendations · ${a.inquiries} shopping-needs inquiries</b> for day ${r.reviewDay}.</p>
        <p>Example · ${esc(a.example.shopper)} → ${esc(a.example.product)}</p></section>
        <details><summary>Evidence and checkpoints</summary><p>Both decisions used snapshot <code>${esc(b.snapshotHash.slice(0,16))}</code> and row fingerprint <code>${esc(b.rowsHash.slice(0,16))}</code>. Captured gross through day ${r.throughDay} was ${money(m.grossCents)}. Only the mapping fingerprint changed.</p>
        <p>Campaign <code>${esc(a.contractHash.slice(0,16))}</code> · verified trial <code>${esc(a.receiptHash.slice(0,16))}</code></p><p>Recorded planner rationale · ${esc(a.proposal)}</p></details>
        <small>Local replay of ${a.recordedDecisions} recorded Gemini decisions. Actions are previews. New model calls and payments were both zero.</small>`;
    }catch(e){if(token===serial){after.textContent=e.message;fix.disabled=!holdId;}}
  }
  function open(){
    if(dialog.open)return;showReview();
    dialog.showModal();history.replaceState(null,'',location.pathname+location.search+'#planner');void run(false);
  }
  document.addEventListener('click',e=>{if(e.target.closest('[data-open-planner-review]')){e.preventDefault();open();}});
  fix.onclick=()=>{if(holdId)void run(true);};$('reset-planner-feed').onclick=()=>run(false);
  $('close-planner-feed').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{serial++;if(location.hash==='#planner')history.replaceState(null,'',location.pathname+location.search+'#verifier');});
  window.addEventListener('hashchange',()=>{if(location.hash==='#planner')open();else if(dialog.open)dialog.close();});
  if(location.hash==='#planner')open();
}
