import {esc} from '../garden/ui.mjs';

const usd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const signedUSD=n=>(n>0?'+':'')+usd.format(n);
const signed=n=>(n>0?'+':'')+n;
const time=n=>n.toFixed(1)+' ms';

export function bindMerchantScale(pause){
  const byId=id=>document.getElementById(id);
  const dialog=byId('merchant-scale'),districts=byId('scale-districts'),feeds=byId('scale-feeds');
  const run=byId('rank-scale'),live=byId('scale-live');
  let pending,report,serial=0,returnHash='';
  const selected=()=>report.deployments.find(d=>d.districts===Number(districts.value)&&d.feeds===Number(feeds.value));
  function draw(){
    serial++;if(!report)return;
    const d=selected();
    byId('scale-workload').innerHTML=`<h3>${d.stores} participating stores</h3><p>${d.shoppers.toLocaleString()} shoppers · ${d.listings} stock listings · 16 distinct products per district</p>`;
    live.textContent='Run the trained model on the saved day-31 observations to preview its outreach choices.';
    const tiers=report.deployments.filter(x=>x.districts===d.districts);
    byId('scale-settlement').innerHTML=`<h3>After purchases, returns and settlement</h3>
      <p>Recorded simulation outcomes for the same ${d.shoppers.toLocaleString()} shoppers. Across rows, only the number of stores sharing stock with outreach changes. All stores can fulfill purchases.</p>
      <div class="performance-table"><table><thead><tr><th>Stores sharing stock</th><th>Reached¹</th><th>Kept recommendations²</th><th>All kept purchases</th><th>PayPal net after AI</th></tr></thead><tbody>
      ${tiers.map(x=>`<tr class="${x.feeds===d.feeds?'team-result':''}"><th scope="row">${x.stores}</th><td>${x.planner.enrolledSellersReached} / ${x.stores}</td><td>${x.planner.matchedBaskets}</td><td>${x.planner.retained.toLocaleString()}</td><td>${usd.format(x.planner.paypal)}</td></tr>`).join('')}
      </tbody></table></div>
      <p><b>Against fixed rules at the selected size</b><br>PayPal net ${signedUSD(d.delta.paypal)} · merchant contribution ${signedUSD(d.delta.merchants)} · retained purchases ${signed(d.delta.retained)}. ${d.merchantWins} of ${d.stores} participating merchants earned more.</p>
      <p>Shoppers kept the recommended product after ${(100*d.planner.matchedBaskets/d.planner.recommendations).toFixed(1)}% of the planner’s product messages (${d.planner.matchedBaskets}/${d.planner.recommendations.toLocaleString()}) and ${(100*d.fixed.matchedBaskets/d.fixed.recommendations).toFixed(1)}% under fixed rules (${d.fixed.matchedBaskets}/${d.fixed.recommendations.toLocaleString()}).</p>
      <small>¹ Participating sellers that fulfilled a retained recommended item. ² Retained baskets containing the exact product recommended.</small>
      <details><summary>Measurement and costs</summary><p>Net change per 100 shoppers was ${signedUSD(d.paypalLiftPer100)}. Each deployment carries the original $${report.planCostUSD.toFixed(6)} planning cost once. Storefronts and financial results are simulated. The walkthrough shows the separate $96 PayPal Sandbox capture. <a href="/data/merchant-scale.json" download>All seeds and controls</a></p></details>`;
    run.disabled=false;
  }
  async function open(){
    if(dialog.open)return;
    pause();returnHash=location.hash==='#scale'?'':location.hash;dialog.showModal();
    history.replaceState(null,'',location.pathname+location.search+'#scale');
    if(report){draw();return;}
    live.textContent='Loading measured outcomes…';
    try{
      pending??=fetch('/data/merchant-scale.json').then(r=>{if(!r.ok)throw Error('The scale experiment could not be loaded.');return r.json();});
      report=await pending;if(dialog.open)draw();
    }catch(error){pending=undefined;live.textContent=error.message;}
  }
  document.addEventListener('click',e=>{if(e.target.closest('[data-open-scale]')){e.preventDefault();void open();}});
  byId('close-scale').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{serial++;history.replaceState(null,'',location.pathname+location.search+returnHash);});
  districts.onchange=feeds.onchange=draw;
  run.onclick=async()=>{
    const n=++serial,d=selected();run.disabled=true;live.textContent='Ranking observed shoppers locally…';
    try{
      const response=await fetch(`/api/market/merchant-scale/rank?districts=${d.districts}&feeds=${d.feeds}`,{cache:'no-store'});
      if(!response.ok)throw Error('The local ranking service could not complete this batch.');
      const r=await response.json();if(n!==serial)return;
      if(r.actionHash!==d.day31.actionHash||r.modelHash!==report.modelHash)throw Error('The live rankings differ from the recorded deployment.');
      const item=r.examples[0];
      live.innerHTML=`<b>${r.recommendations} product recommendations · ${r.inquiries} needs inquiries</b>
        <p>Ranked locally in ${time(r.rankingMs)}. Zero new LLM calls. Reference median ${time(d.day31.medianMs)}, p95 ${time(d.day31.p95Ms)} over ${d.day31.samples} batches. Timing covers scoring after inputs are ready.</p>
        ${item?`<p>Example · District ${item.district}, ${esc(item.shopper)} → ${esc(item.product)}</p>`:''}`;
    }catch(error){if(n===serial)live.textContent=error.message;}finally{if(n===serial)run.disabled=false;}
  };
  if(location.hash==='#scale')void open();
}
