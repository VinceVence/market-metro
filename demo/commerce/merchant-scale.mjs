import {esc} from '../garden/ui.mjs';

const usd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const signedUSD=n=>(n>0?'+':'')+usd.format(n);
const signed=n=>(n>0?'+':'')+n;
const time=n=>n.toFixed(1)+' ms';

export function bindMerchantScale(pause){
  const byId=id=>document.getElementById(id);
  const dialog=byId('merchant-scale'),districts=byId('scale-districts'),feeds=byId('scale-feeds');
  const run=byId('rank-scale'),live=byId('scale-live');
  let pending,report,capacity,serial=0,returnHash='';
  const selected=()=>districts.value==='8'?{...capacity.deployments.find(d=>d.districts===8),feeds:12,stores:96,listings:384}:
    report.deployments.find(d=>d.districts===Number(districts.value)&&d.feeds===Number(feeds.value));
  function capacityTable(){
    if(!capacity)return '';
    return `<h3>Full-inventory size comparison</h3><p>The same saved policy runs in independent 12-store districts. Each district has separate shoppers, stock and fulfillment.</p>
      <div class="performance-table"><table><thead><tr><th>Merchants</th><th>Shoppers</th><th>Median scoring</th><th>p95</th><th>PayPal gain vs fixed</th><th>Gain per 100 shoppers</th></tr></thead><tbody>
      ${capacity.deployments.map(d=>`<tr class="${d.districts===Number(districts.value)&&feeds.value==='12'?'team-result':''}"><th>${d.merchants}</th><td>${d.shoppers.toLocaleString()}</td><td>${time(d.day31.medianMs)}</td><td>${time(d.day31.p95Ms)}</td><td>${signedUSD(d.delta.paypal)}</td><td>${signedUSD(d.paypalGainPer100)}</td></tr>`).join('')}
      </tbody></table></div><small>15 warm local scoring passes per size. Times cover scoring prepared observations. All 16 full campaigns settled through day 126. This benchmark invocation took ${(capacity.settlementWallSeconds/60).toFixed(1)} minutes; repeat executions can reuse completed district results. Zero new LLM calls or native payments.</small>
      <details><summary>Every district, including losses</summary><div class="performance-table"><table><thead><tr><th>District / seed</th><th>PayPal change before plan cost</th><th>Merchant change</th><th>Purchase change</th></tr></thead><tbody>
      ${capacity.cases.map(c=>`<tr><th>${c.index+1} / ${c.seed}</th><td>${signedUSD(c.planner.paypalBeforeAI-c.fixed.paypalBeforeAI)}</td><td>${signedUSD(c.planner.merchants-c.fixed.merchants)}</td><td>${signed(c.planner.purchases-c.fixed.purchases)}</td></tr>`).join('')}</tbody></table></div>
      <p>Each reported deployment carries the original planning cost once. These synthetic markets reuse the same product assortment. <a href="/data/merchant-capacity.json" download>Measured results</a></p></details>`;
  }
  function draw(){
    serial++;if(!report)return;
    feeds.disabled=districts.value==='8';if(feeds.disabled)feeds.value='12';
    byId('scale-capacity').innerHTML=capacityTable();
    const d=selected();
    byId('scale-workload').innerHTML=`<h3>${d.stores} participating stores</h3><p>${d.shoppers.toLocaleString()} shoppers · ${d.listings} stock listings · 16 distinct products per district</p>`;
    live.textContent='Run the trained model on the saved day-31 observations to preview its outreach choices.';
    if(districts.value==='8'){
      byId('scale-settlement').innerHTML=`<h3>After day 126 settlement</h3><div class="performance-table"><table><thead><tr><th>Policy</th><th>Modeled PayPal net</th><th>Merchant contribution</th><th>Retained purchases</th></tr></thead><tbody>
        ${[['Fixed rules',d.fixed],['Saved planner',d.planner]].map(([label,r])=>`<tr><th>${label}</th><td>${usd.format(r.paypal)}</td><td>${usd.format(r.merchants)}</td><td>${r.purchases.toLocaleString()}</td></tr>`).join('')}</tbody></table></div>
        <p>PayPal net ${signedUSD(d.delta.paypal)} · merchants ${signedUSD(d.delta.merchants)} · retained purchases ${signed(d.delta.purchases)}. ${d.merchantWins} of 96 merchants earned more.</p>
        <small>Aggregate results across eight independently simulated districts. The same model ranks shoppers in each district.</small>`;
      run.disabled=false;return;
    }
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
    if(report&&capacity){draw();return;}
    live.textContent='Loading measured outcomes…';
    try{
      pending??=Promise.all([fetch('/data/merchant-scale.json').then(r=>{if(!r.ok)throw Error('The scale experiment could not be loaded.');return r.json();}),
        fetch('/data/merchant-capacity.json',{cache:'no-store'}).then(r=>r.ok?r.json():null)]);
      [report,capacity]=await pending;pending=undefined;
      districts.querySelector('option[value="8"]').disabled=!capacity;
      if(!capacity&&districts.value==='8')districts.value='4';
      if(dialog.open)draw();
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
      const timing=d.feeds===12?capacity?.deployments.find(x=>x.districts===d.districts)?.day31??d.day31:d.day31;
      const item=r.examples[0];
      live.innerHTML=`<b>${r.recommendations} product recommendations · ${r.inquiries} needs inquiries</b>
        <p>Ranked locally in ${time(r.rankingMs)}. Zero new LLM calls. Reference median ${time(timing.medianMs)}, p95 ${time(timing.p95Ms)} over ${timing.samples} batches. Timing covers scoring after inputs are ready.</p>
        ${item?`<p>Example · District ${item.district}, ${esc(item.shopper)} → ${esc(item.product)}</p>`:''}`;
    }catch(error){if(n===serial)live.textContent=error.message;}finally{if(n===serial)run.disabled=false;}
  };
  if(location.hash==='#scale')void open();
}
