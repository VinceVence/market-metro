import {api,esc,money,num} from '../garden/ui.mjs';
const sizes=[96,192,384],versions=new WeakMap();
const signed=n=>(n>0?'+':'')+money(n*100);

function chart(runs){
  const rows=runs.filter(r=>r.comparison).sort((a,b)=>a.merchants-b.merchants);
  if(!rows.length)return '<p>Settled comparisons will populate the profit curve.</p>';
  const values=rows.map(r=>(r.comparison.planner.paypal-r.comparison.fixed.paypal)*100/r.shoppers);
  const low=Math.min(0,...values),high=Math.max(1,...values),range=high-low||1;
  const x=n=>60+(n-96)/(384-96)*660,y=n=>190-(n-low)/range*150;
  const points=rows.map((r,i)=>[x(r.merchants),y(values[i])]);
  return `<svg class="live-profit-chart" viewBox="0 0 800 245" role="img" aria-label="Settled PayPal net gain versus fixed rules per 100 shoppers"><line x1="60" y1="${y(0)}" x2="750" y2="${y(0)}" stroke="#567392"/>
    <polyline fill="none" stroke="#5dc7ff" stroke-width="3" points="${points.map(p=>p.join(',')).join(' ')}"/>
    ${rows.map((r,i)=>`<circle cx="${points[i][0]}" cy="${points[i][1]}" r="5" fill="${values[i]>=0?'#67ddb9':'#ff9d9d'}"/><text x="${points[i][0]}" y="${points[i][1]-13}" text-anchor="middle">${esc(signed(values[i]))}</text>`).join('')}
    ${sizes.map(n=>`<text x="${x(n)}" y="218" text-anchor="middle">${n}</text>`).join('')}<text x="400" y="242" text-anchor="middle">Merchants in one shared market</text></svg>`;
}

export async function showLiveScale(root,session){
  const version=(versions.get(root)||0)+1;versions.set(root,version);
  const {runs}=await api('/api/market/autonomy/scale-results');if(versions.get(root)!==version)return;
  const relevant=runs.filter(r=>r.seed===session.settings.seed&&(r.regime??'reactivation')===session.settings.regime);
  const selected=sizes.map(n=>relevant.find(r=>r.merchants===n)).filter(Boolean);
  const current=selected.find(r=>r.id===session.id)??relevant.find(r=>r.id===session.id);
  root.innerHTML=`<div class="performance-body"><div class="channel-heading"><h2>Live market scale</h2><span>One shared market at each size · seed ${session.settings.seed}</span></div>
    <p>Compare the actual planner + ontology run with fixed rules at the same size. Each row uses the latest run for this seed and scenario.</p>
    ${current?`<div class="performance-summary"><div><small>Current market</small><b>${num(current.merchants)} merchants</b><span>${num(current.shoppers)} shoppers</span></div><div><small>Progress</small><b>Day ${current.day}</b><span>${esc(current.status)}</span></div><div><small>Model usage</small><b>$${current.costUSD.toFixed(5)}</b><span>${current.modelCalls} responses</span></div></div>`:''}
    <h3>PayPal net gain per 100 shoppers</h3>${chart(selected)}
    <div class="performance-table"><table><thead><tr><th>Merchants / shoppers</th><th>Status</th><th>Fixed PayPal net</th><th>Planner + ontology net</th><th>PayPal gain</th><th>Merchant gain</th><th>Extra retained purchases</th></tr></thead><tbody>
    ${sizes.map(n=>{const r=selected.find(r=>r.merchants===n),c=r?.comparison;return `<tr><th>${num(n)} / ${num(n*50)}</th><td>${r?'<a href="/studio.html?session='+esc(r.id)+'&view=performance&judge=1">'+esc(r.status)+' · day '+r.day+'</a>':'Ready to run'}</td><td>${c?money(c.fixed.paypal*100):'—'}</td><td>${c?money(c.planner.paypal*100):'—'}</td><td>${c?signed(c.planner.paypal-c.fixed.paypal):'—'}</td><td>${c?signed(c.planner.merchants-c.fixed.merchants):'—'}</td><td>${c?c.planner.purchases-c.fixed.purchases:'—'}</td></tr>`;}).join('')}
    </tbody></table></div><p class="data-note">The curve uses settled simulated outcomes, including model cost. Financial proposal checks use separate 600-shopper proxy trials. Every reported profit comparison executes the complete shared market at its selected size.</p>
    ${current?.runtime?`<details><summary>Runtime measurements</summary><p>Last day computation ${Math.round(current.runtime.stepMs??0)} ms · checkpoint ${Math.round(current.runtime.checkpointMs??0)} ms · compressed checkpoint ${((current.runtime.checkpointBytes??0)/1048576).toFixed(1)} MB · measured heap ${current.runtime.heapMB??'—'} MB.</p></details>`:''}
    <details><summary>Run history</summary>${relevant.map(r=>'<p><a href="/studio.html?session='+esc(r.id)+'&view=performance&judge=1">'+esc(r.id)+'</a> · '+r.merchants+' merchants · '+esc(r.status)+' · day '+r.day+'</p>').join('')}</details>
    <button id="scale-new-run" class="primary">Choose the next live size</button></div>`;
  root.querySelector('#scale-new-run').onclick=()=>document.getElementById('run').click();
}
