import {createCity} from './city.mjs';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const usd=c=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((c||0)/100),num=n=>new Intl.NumberFormat('en-US').format(n||0);
let frame=null,status=null,playing=false,inFlight=false,speed=1,view='city',tableName='v_marketing_transactions',offset=0,tableData=null,selectedMerchant=null,feed=[],timer=null,toastTimer=null,legacy=[];
const city=createCity($('city'),id=>selectMerchant(id));
async function api(path,input){const res=await fetch(path,{...(input===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Supply-Yard':'sandbox'},body:JSON.stringify(input)})});const data=await res.json();if(!res.ok)throw new Error(data.error?.message||`Request failed (${res.status})`);return data;}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,6500);}
function setPlaying(value){playing=value;city.setPaused(!value);$('play').textContent=value?'Ⅱ Pause market':frame?.status==='COMPLETED'?'↻ Start a new market':frame?'▶ Resume market':'▶ Open market';$('live-dot').style.opacity=value?'1':'.35';clearInterval(timer);if(value)timer=setInterval(tick,Math.max(120,950/speed));}
function cardBlocked(){return status?.cardProcessingBlocked||frame?.receipts?.some(p=>p.error_code==='PAYEE_NOT_ENABLED_FOR_CARD_PROCESSING');}
function renderConnection(){
 const c=status?.catalog||frame?.catalog;
 if(c){$('catalog-mode').textContent=c.mode==='SAMPLE'?'Sample products':'Channel3 catalog · cached';$('catalog-note').textContent=c.message;$('catalog-sync').disabled=!c.configured||!c.freeCreditCallsEnabled;}
 const blocked=cardBlocked();
 $('sandbox-capability').textContent=blocked?'API key connected. Automatic card captures need a sandbox merchant with card processing enabled.':'Fictitious funds only. Bounded test-card purchases.';
 $('sandbox-limit').disabled=!!blocked;if(blocked)$('sandbox-limit').value='0';
 $('payment-status').textContent=blocked?'Connected · automatic card capture unavailable':status?.paypal?.configured?'Sandbox connected · test funds only':'Sandbox keys not configured';
}
function render(next){frame=next;city.setFrame(next);
 const s=next.stats;
 $('metric-revenue').textContent=usd(s.revenueCents);$('metric-units').textContent=`${num(s.units)} units · ${num(s.refundsCents/100)} USD returned`;
 $('metric-orders').textContent=num(s.orders);$('metric-conversion').textContent=`${s.clicks?(100*s.orders/s.clicks).toFixed(1):'0'}% of product views`;
 $('metric-spend').textContent=usd(s.spendCents);$('metric-views').textContent=`${num(s.impressions)} impressions · ${num(s.clicks)} views`;
 $('metric-margin').textContent=usd(s.contributionCents);$('metric-margin').style.color=s.contributionCents<0?'var(--danger)':'var(--text)';
 const captured=next.receipts.filter(p=>p.status==='COMPLETED').length;
 $('metric-native').innerHTML=`${captured} <sub>/ ${next.sandboxLimit}</sub>`;
 $('metric-native-note').textContent=cardBlocked()?'Card capability required · see receipts':'Fictitious funds · provider receipts';
 $('row-badge').textContent=num(next.tables.filter(t=>t.kind==='table').reduce((n,t)=>n+t.count,0));
 $('world-status').textContent=next.status==='COMPLETED'?'Market closed':playing?'The market is open':'Market paused';
 $('clock').textContent=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Manila',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(next.eventTs))+' · Manila';
 $('population-note').textContent=`${next.merchantCount} storefronts · ${num(next.customerCount)} shoppers`;
 $('progress').style.width=100*next.tick/next.totalTicks+'%';$('progress-label').textContent=`${next.tick} / ${next.totalTicks} market hours`;
 $('promotion').setAttribute('aria-pressed',String(next.promotion));$('shock').value=next.shock||'';
 $('completion').hidden=next.status!=='COMPLETED';$('completion-text').textContent=`${num(s.orders)} purchases. ${num(next.tables.find(t=>t.name==='events')?.count)} events. 14 base tables and 6 joined views, saved locally.`;
 if(next.status==='COMPLETED')setPlaying(false);
 if(!playing)$('play').textContent=next.status==='COMPLETED'?'↻ Start a new market':'▶ Resume market';
 const m=$('inspect-merchant');if(m.options.length!==next.merchants.length+1){m.innerHTML='<option value="">Select a merchant in the city</option>'+next.merchants.map(x=>`<option value="${esc(x.merchant_id)}">${esc(x.name)}</option>`).join('');}
 if(selectedMerchant&&!next.merchants.some(m=>m.merchant_id===selectedMerchant))selectedMerchant=null;
 if(selectedMerchant)selectMerchant(selectedMerchant);
 if(next.activities?.length){feed=[...next.activities.filter(x=>x.type!=='visit').reverse(),...feed].slice(0,4);renderFeed();}
 else if(!feed.length&&next.recentActivity?.length){feed=[...next.recentActivity].reverse();renderFeed();}
 renderConnection();if($('receipts-dialog').open)renderReceipts();
}
function renderFeed(){const icons={purchase:'↗',delivery:'▰',refund:'↙',restock:'▥'};
 $('activity').innerHTML=feed.map(a=>`<li><span>${icons[a.type]||'·'}</span><div><b>${esc(a.merchant)}</b><small>${a.type==='purchase'?esc(a.product):a.type==='delivery'?'Order delivered':a.type==='refund'?'Buyer return recorded':'Warehouse restock'}</small></div><em>${a.amount?usd(a.amount):'+'+a.units+' units'}</em></li>`).join('');
 $('feed-count').textContent=`${num(frame?.stats.orders)} PURCHASES`;
}
async function refreshStatus(){status=await api('/api/market/status');renderConnection();return status;}
async function start(){
 if(inFlight)return;setPlaying(false);inFlight=true;$('play').disabled=true;
 try{await refreshStatus();const next=await api('/api/market/runs',{merchantCount:Number($('merchant-count').value),customerCount:Number($('customer-count').value),days:Number($('days').value),seed:Number($('seed').value),sandboxLimit:Number($('sandbox-limit').value)});feed=[];selectedMerchant=null;render(next);setPlaying(true);toast('Market opened. Every event is saved to the local warehouse.');}
 catch(e){toast(e.message);}finally{inFlight=false;$('play').disabled=false;}
}
async function tick(steps=1){
 if(inFlight||!frame||frame.status==='COMPLETED')return;inFlight=true;const id=frame.runId;
 try{const next=await api(`/api/market/runs/${encodeURIComponent(id)}/advance`,{steps:typeof steps==='number'?steps:1});if(frame?.runId===id)render(next);return true;}
 catch(e){setPlaying(false);toast(e.message);return false;}finally{inFlight=false;}
}
async function control(input){if(!frame)return toast('Open a market first.');try{render(await api(`/api/market/runs/${encodeURIComponent(frame.runId)}/control`,input));toast(input.promotion===undefined?'Market conditions updated.':'Offer '+(input.promotion?'launched.':'ended.'));}catch(e){toast(e.message);}}
function selectMerchant(id){selectedMerchant=id;city.select(id);$('inspect-merchant').value=id;
 const m=frame?.merchants.find(x=>x.merchant_id===id);if(!m)return;
 const products=frame.products.filter(p=>p.merchant_id===id);
 $('merchant-info').innerHTML=`<p>${esc(m.district)} · ${esc(m.category)}</p><div class="merchant-numbers"><div><strong>${usd(m.revenue)}</strong><small>SIMULATED SALES</small></div><div><strong>${m.stock}</strong><small>UNITS ON HAND</small></div></div>`+products.map(p=>`<div class="product-mini">${p.image_url?`<img src="${esc(p.image_url)}" alt="" referrerpolicy="no-referrer">`:`<span class="product-symbol">${esc(p.symbol)}</span>`}<div><b>${esc(p.title)}</b><small>${usd(p.price_cents)} · ${p.stock} in stock</small></div></div>`).join('');
}
async function openData(){if(!frame)return toast('Open a market to create its base tables.');setPlaying(false);view='data';$('city-view').hidden=true;$('data-view').hidden=false;$('nav-city').classList.remove('active');$('nav-data').classList.add('active');await refreshStatus();
 $('run-history').innerHTML=status.runs.filter(r=>r.run_id.startsWith('MM-')).map(r=>`<option value="${esc(r.run_id)}">${esc(r.run_id)} · ${r.current_tick}/${r.total_ticks}h</option>`).join('');$('run-history').value=frame.runId;await loadTable();}
function openCity(){view='city';$('city-view').hidden=false;$('data-view').hidden=true;$('nav-city').classList.add('active');$('nav-data').classList.remove('active');}
function renderTableNav(){const tables=frame.tables;
 $('table-nav').innerHTML=['table','view'].map(kind=>`<h3>${kind==='table'?'BASE TABLES · 14':'JOINED VIEWS · 6'}</h3>`+tables.filter(t=>t.kind===kind).map(t=>`<button class="${t.name===tableName?'active':''}" data-table="${esc(t.name)}">${esc(t.name)}<span>${num(t.count)}</span></button>`).join('')).join('');
 $('table-nav').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{tableName=b.dataset.table;offset=0;$('find-row').value='';loadTable().catch(e=>toast(e.message));}));
 $('warehouse-summary').textContent=`${frame.tables.filter(t=>t.kind==='table').reduce((n,t)=>n+t.count,0).toLocaleString()} base rows · ${frame.status.toLowerCase()} · persisted in SQLite`;
}
async function loadTable(){if(!frame)return;const id=frame.runId;tableData=await api(`/api/market/table?run=${encodeURIComponent(id)}&name=${encodeURIComponent(tableName)}&limit=50&offset=${offset}`);renderTableNav();
 $('table-name').textContent=tableName;$('table-kind').textContent=tableData.kind==='view'?'JOINED VIEW':'BASE TABLE';$('table-description').textContent=tableData.description;$('page-prev').disabled=offset===0;$('page-next').disabled=offset+50>=tableData.count;
 $('table-count').textContent=tableData.count?`${offset+1}–${Math.min(offset+50,tableData.count)} of ${num(tableData.count)} rows`:'0 rows · this table has no matching records';renderTableRows();}
function renderTableRows(){if(!tableData)return;const search=$('find-row').value.toLowerCase();const rows=tableData.rows.filter(r=>!search||Object.values(r).some(v=>String(v??'').toLowerCase().includes(search)));
 $('data-table').querySelector('thead').innerHTML='<tr>'+tableData.columns.map(c=>`<th scope="col">${esc(c)}</th>`).join('')+'</tr>';
 const display=(column,value)=>{if(typeof value==='string'&&column.endsWith('_id')&&value.startsWith(frame.runId))return value===frame.runId?value.split('-').at(-1):value.slice(frame.runId.length+1);return value;};
 $('data-table').querySelector('tbody').innerHTML=rows.length?rows.map(r=>'<tr>'+tableData.columns.map(c=>`<td class="${typeof r[c]==='number'?'number':''}" title="${esc(r[c])}">${r[c]===null?'<span style="opacity:.4">NULL</span>':esc(display(c,r[c]))}</td>`).join('')+'</tr>').join(''):`<tr><td class="table-empty" colspan="${tableData.columns.length}">${search?'No matches on this page.':'No records yet. Run the market or inspect another table.'}</td></tr>`;
}
function download(format){if(!frame)return toast('Open a market first.');const a=document.createElement('a');a.href=`/api/market/export?run=${encodeURIComponent(frame.runId)}&format=${format}&name=${encodeURIComponent(tableName)}`;a.download='';document.body.append(a);a.click();a.remove();}
function renderReceipts(){
 const receipts=frame?.receipts||[];
 const blocked=cardBlocked();$('receipt-alert').innerHTML=blocked?'<div class="receipt-alert"><b>Your API keys work.</b> PayPal returned <code>PAYEE_NOT_ENABLED_FOR_CARD_PROCESSING</code> for this sandbox merchant. New automatic test-card purchases are blocked by that account capability. The city and all data exports remain usable without login. Existing receipts below are preserved; no failed attempt is counted as paid.</div>':'';
 $('receipt-list').innerHTML=receipts.length?receipts.map(p=>`<article class="receipt-row"><div><h3>${esc(p.merchant_id?.split('-').at(-1)||'Test store')} · mirrored test purchase</h3><p>${esc(p.order_id)}</p></div><strong>${usd(p.gross_cents)}</strong><span class="receipt-status ${p.status==='COMPLETED'?'ok':'error'}">${esc(p.status)}${p.error_code?' · '+esc(p.error_code):''}</span><div class="native-details"><div>PayPal order ID<code>${esc(p.paypal_order_id||'Not created')}</code></div><div>Capture ID<code>${esc(p.capture_id||'No capture')}</code></div><div>Provider fee / net<code>${p.fee_cents===null?'Not available':usd(p.fee_cents)+' / '+usd(p.net_cents)}</code></div><div>Captured at (UTC)<code>${esc(p.captured_at||'Not captured')}</code></div></div></article>`).join(''):'<p class="micro">No native sandbox receipts for this run. Generated orders remain labeled SIMULATED.</p>';
 const prior=legacy.find(r=>r.receipt?.status==='COMPLETED');
 $('previous-receipt').innerHTML=prior?`<span class="eyebrow">PREVIOUS WALLET CHECKOUT · SEPARATE FROM THIS RUN</span><p>Existing saved sandbox receipt: <b>${usd(prior.receipt.grossCents)}</b>. It is not counted in this simulation's revenue or new capture total.</p><p>Capture <code>${esc(prior.receipt.captureId)}</code><br>Provider timestamp: ${esc(prior.receipt.capturedAt)}<br>Last verified: ${esc(prior.verifiedAt||'Recorded previously')}</p>`:'';
}
async function openReceipts(){renderReceipts();$('receipts-dialog').showModal();try{legacy=(await api('/api/paypal/orders')).orders||[];await refreshStatus();if(frame)render(await api('/api/market/run?id='+encodeURIComponent(frame.runId)));else renderReceipts();}catch(e){toast(e.message);}}
$('play').addEventListener('click',()=>{if(!frame||frame.status==='COMPLETED')start();else setPlaying(!playing);});
$('new-run').addEventListener('click',start);$('step').addEventListener('click',async()=>{setPlaying(false);if(!frame){await start();setPlaying(false);}await tick(1);});
$('finish').addEventListener('click',async()=>{setPlaying(false);if(!frame){await start();setPlaying(false);}if(!frame||inFlight)return;$('finish').disabled=true;try{while(frame.status!=='COMPLETED'){if(!await tick(24))break;}if(frame.status==='COMPLETED')toast('Market closed. All base tables and views are ready.');}finally{$('finish').disabled=false;}});
$('promotion').addEventListener('click',()=>control({promotion:!frame?.promotion}));$('shock').addEventListener('change',()=>control({shock:$('shock').value||null}));
$('inspect-merchant').addEventListener('change',e=>selectMerchant(e.target.value));$('zoom-in').onclick=()=>city.zoomIn();$('zoom-out').onclick=()=>city.zoomOut();$('home').onclick=()=>city.home();
for(const b of document.querySelectorAll('[data-speed]'))b.addEventListener('click',()=>{speed=Number(b.dataset.speed);document.querySelectorAll('[data-speed]').forEach(x=>x.classList.toggle('selected',x===b));if(playing)setPlaying(true);});
$('nav-city').onclick=openCity;$('nav-data').onclick=()=>openData().catch(e=>toast(e.message));$('completion-data').onclick=()=>openData().catch(e=>toast(e.message));$('nav-paypal').onclick=openReceipts;$('view-receipts').onclick=openReceipts;
$('close-receipts').onclick=()=>$('receipts-dialog').close();$('receipt-refresh').onclick=async()=>{try{await refreshStatus();if(frame)render(await api('/api/market/run?id='+encodeURIComponent(frame.runId)));legacy=(await api('/api/paypal/orders')).orders||[];renderReceipts();}catch(e){toast(e.message);}};
$('download-json').onclick=()=>download('json');$('download-db').onclick=()=>download('sqlite');$('download-sql').onclick=()=>download('sql');$('download-csv').onclick=()=>download('csv');
$('page-prev').onclick=()=>{offset=Math.max(0,offset-50);loadTable().catch(e=>toast(e.message));};$('page-next').onclick=()=>{offset+=50;loadTable().catch(e=>toast(e.message));};$('find-row').oninput=renderTableRows;
$('refresh-data').onclick=async()=>{try{render(await api('/api/market/run?id='+encodeURIComponent(frame.runId)));await loadTable();}catch(e){toast(e.message);}};
$('run-history').onchange=async()=>{try{setPlaying(false);offset=0;render(await api('/api/market/run?id='+encodeURIComponent($('run-history').value)));await loadTable();}catch(e){toast(e.message);}};
$('catalog-sync').onclick=async()=>{try{$('catalog-sync').disabled=true;await api('/api/market/catalog/sync',{});await refreshStatus();toast('Catalog imported and cached. Start a new run to use it.');}catch(e){toast(e.message);}finally{renderConnection();}};
setInterval(async()=>{if(inFlight||!frame||!frame.receipts.some(r=>['QUEUED','CREATING','CREATED','APPROVED'].includes(r.status)))return;try{const id=frame.runId,next=await api('/api/market/run?id='+encodeURIComponent(id));if(frame?.runId===id)render(next);}catch{}},3500);
try{await refreshStatus();legacy=(await api('/api/paypal/orders')).orders||[];const oldRun=status.runs.find(r=>r.run_id.startsWith('MM-'));if(oldRun)render(await api('/api/market/run?id='+encodeURIComponent(oldRun.run_id)));}catch(e){toast(e.message);}
