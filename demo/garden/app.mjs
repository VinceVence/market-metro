import {createGarden} from './world.mjs';
import {AGENT_ROLES} from './agent-roles.mjs';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format((n||0)/100),num=n=>Number(n||0).toLocaleString(),pct=n=>Number.isFinite(n)?(100*n).toFixed(1)+'%':'—';
let frame=null,status=null,playing=false,busy=false,speed=1,timer=null,toastTimer=null,panel='town',selected='',feed=[],tableName='customer_days',offset=0,tableData=null,populatedRun=null,mapMode='city',paymentViewRequest=0;
const garden=createGarden($('garden'),{onCustomer:id=>inspect('customer:'+id),onMerchant:id=>inspect('merchant:'+id),onTeam:station=>showTeamStation(station),onPayments:()=>payments()});
async function api(path,input){
  const r=await fetch(path,input===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Supply-Yard':'sandbox'},body:JSON.stringify(input)});
  const body=await r.json();if(!r.ok)throw new Error(body.error?.message||'Local request failed.');return body;
}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,8000);}
function setPlaying(value){
  playing=value;clearInterval(timer);
  $('play').textContent=value?'Ⅱ Pause season':frame?.status==='COMPLETED'?'↻ New season':frame?.tick===28?'▶ Train & launch':frame?'▶ Resume season':'▶ Begin a season';
  if(value)timer=setInterval(()=>tick(1),Math.max(150,1050/speed));
}
function sourceStatus(){
  $('catalog-status').textContent=status?.catalog?.mode==='SAMPLE'?'Authored sample catalog':(status?.catalog?.productCount||22)+' Channel3 products · cached';
  $('trainer-status').textContent=status?.trainer?.ready?'Local CPU trainer ready':'Local Python setup required';
  $('native-sample-limit').disabled=!status?.funding?.ready;
  $('native-sample-limit').value=status?.funding?.ready?'3':'0';
  $('native-sample-help').textContent=status?.funding?.ready?'Saved sandbox buyer ready. Selected field-test orders will capture automatically.':'Connect a sandbox buyer once in PayPal records to enable automatic samples.';
}
async function refreshStatus(){status=await api('/api/market/status');sourceStatus();}
function render(next){
  if(next.kind!=='LEARNING_MARKET_V2')return;
  const priorModels=frame?.models.length||0,sameRun=frame?.runId===next.runId,receiptsChanged=JSON.stringify(frame?.receipts)!==JSON.stringify(next.receipts);frame=next;garden.setFrame(next);
  const live=next.tick>28,s=live?next.live:next.history;
  $('metric-phase').textContent=live?'FIELD TEST PURCHASES':'HISTORY PURCHASES';
  $('purchases').textContent=num(s.orders);$('volume').textContent=money(s.revenueCents);
  $('fee-detail').textContent='Modeled fees: '+money(s.feesCents);
  $('redemptions').innerHTML=num(s.redemptions)+' <em>/ '+num(s.offers)+'</em>';
  $('coupon-detail').textContent=num(s.seen)+' seen · '+num(s.offers)+' issued';
  $('budget').textContent=money(next.live.budgetSpentCents);
  $('budget-detail').textContent='of '+money(next.goal.budgetCents)+' · virtual budget';
  $('contribution').textContent=money(s.contributionCents);
  $('row-count').textContent=num(next.tables.filter(t=>t.kind==='table').reduce((n,t)=>n+t.count,0));
  const nativeCount=next.receipts.filter(r=>r.status==='COMPLETED').length;
  $('payments').textContent=nativeCount?'PayPal · '+nativeCount+' sandbox capture'+(nativeCount===1?'':'s')+' ↗':'PayPal records ↗';
  $('phase-title').textContent=next.status==='COMPLETED'?'Season complete':next.tick<=28?'Learning from the neighborhood':'The coupon field test';
  $('day').textContent='Day '+next.tick+' / '+next.totalTicks;
  $('season-tag').textContent=next.tick<=28?'CHAPTER I · LEARNING HISTORY':next.tick<35?'CHAPTER II · THE FIELD TEST':next.tick<42?'CHAPTER III · A CHANGING MARKET':'CHAPTER IV · WHAT DID WE LEARN?';
  $('season-note').textContent=next.tick<=28?'Observe first. Learn what an offer changes.':next.tick<35?'Small offers. A protected holdout.':next.tick<42&&next.scenario!=='steady'?'The market changed. Does our model still fit?':next.status==='COMPLETED'?'Every outcome is ready to inspect.':'Measure, retrain, and keep what works.';
  $('population').textContent=next.merchantCount+' shops · '+num(next.customerCount)+' neighbors · daily activity replay';
  $('clock-label').textContent=(busy?'Working locally… · ':'')+'Seed '+next.seed+' · '+next.policy.replaceAll('_',' ')+' · one step = one day';
  $('progress').style.width=(100*next.tick/next.totalTicks)+'%';
  $('question').textContent=next.goal.question;
  if(populatedRun!==next.runId){
    populatedRun=next.runId;sessionStorage.setItem('marketRun',next.runId);const runUrl=new URL(location.href);runUrl.searchParams.set('run',next.runId);history.replaceState(null,'',runUrl);selected='';feed=[];$('inspector').innerHTML='<p class="muted">Select a neighbor or shop to trace their recorded activity.</p>';
    $('inspect').innerHTML='<option value="">Choose a customer or shop…</option><optgroup label="Merchants">'+next.merchants.map(m=>'<option value="merchant:'+esc(m.merchant_id)+'">'+esc(m.name)+'</option>').join('')+'</optgroup><optgroup label="Neighbors">'+next.customers.map(u=>'<option value="customer:'+esc(u.id)+'">'+esc(u.name)+'</option>').join('')+'</optgroup>';
  }
  if(next.activities?.length){feed=[...next.activities.filter(a=>a.type==='redemption'),...next.activities.filter(a=>a.type==='coupon'),...next.activities.filter(a=>a.type==='purchase'),...next.activities.filter(a=>a.type==='delivery'),...feed].slice(0,8);}
  else if(!feed.length&&next.recentActivity?.length)feed=next.recentActivity;
  renderJournal();if(selected)renderInspector();renderTeam();renderModels();renderLayerCaption();
  if($('payment-dialog').open&&(!sameRun||receiptsChanged))void renderPayments();
  if(sameRun&&next.models.length>priorModels)toast('Local training finished: '+next.models.at(-1).status.toLowerCase()+'. Open Model bench to inspect the evidence.');
  for(const id of ['step','week','finish'])$(id).disabled=next.status==='COMPLETED';
  if(next.status==='COMPLETED')setPlaying(false);
  else if(!playing)setPlaying(false);
}
function renderJournal(){
  const label={coupon:'Offer delivered',redemption:'Coupon redeemed',purchase:'Purchase completed',delivery:'Order delivered',refund:'Buyer return'};
  $('street-journal').innerHTML=feed.length?feed.map(a=>'<li><span class="event-mark">'+(a.type==='redemption'?'✓':a.type==='coupon'?'◇':a.type==='delivery'?'▰':'↗')+'</span><div><b>'+esc(a.customer||a.merchant||'Market activity')+'</b><small>'+esc(label[a.type]||a.type)+(a.pct?' · '+a.pct+'%':'')+(a.amount?' · '+money(a.amount):'')+'</small></div></li>').join(''):'<li>Every visit, offer and purchase will leave a record here.</li>';
}
function inspect(value){selected=value;$('inspect').value=value;showPanel('town');renderInspector();if(matchMedia('(max-width:760px)').matches)document.querySelector('.notebook').scrollIntoView({block:'start'});}
function renderInspector(){
  if(!frame||!selected)return;const split=selected.indexOf(':'),type=selected.slice(0,split),id=selected.slice(split+1);
  if(type==='customer'){
    const u=frame.customers.find(u=>u.id===id);if(!u)return;
    const score=u.scores,coupon=u.coupon;
    $('inspector').innerHTML='<article class="inspector-card"><h3>'+esc(u.name)+'</h3><span class="tag">'+esc(u.segment)+' · '+(u.arm==='HOLDOUT'?'RANDOMIZED HOLDOUT':'TREATMENT-ELIGIBLE')+'</span><div class="tiny-stats"><div><strong>'+u.purchases+'</strong><small>PURCHASES</small></div><div><strong>'+u.offers+'</strong><small>OFFERS</small></div><div><strong>'+u.redemptions+'</strong><small>REDEEMED</small></div></div>'+(coupon?'<div class="coupon-stamp">'+coupon.pct+'% coupon · day '+(coupon.day+1)+' · '+esc(coupon.status==='REDEEMED'?'redeemed':coupon.day<frame.tick-1?'expired unused':'delivered')+'</div>':'')+(score?'<p class="micro">Predicted purchase probability for today’s candidate product:</p><div class="probabilities"><div><b>'+pct(score.p0)+'</b><small>NO OFFER</small></div><div><b>'+pct(score.p5)+'</b><small>5% OFFER</small></div><div><b>'+pct(score.p10)+'</b><small>10% OFFER</small></div></div><p class="micro">'+esc(score.reason)+'. Model '+esc(score.modelId.split('-MODEL-').at(-1))+'.</p>':'<p class="micro">Predictions appear after a model is trained and promoted.</p>')+'<p class="micro">These are model estimates for a simulated customer, not Channel3 customer scores or an individual claim of prevented churn.</p></article>';
  }else{
    const m=frame.merchants.find(m=>m.merchant_id===id);if(!m)return;
    $('inspector').innerHTML='<article class="inspector-card"><h3>'+esc(m.name)+'</h3><span class="tag">FICTIONAL MERCHANT · '+esc(m.district)+'</span><div class="tiny-stats"><div><strong>'+m.sold+'</strong><small>UNITS SOLD</small></div><div><strong>'+m.stock+'</strong><small>ON HAND</small></div></div>'+frame.products.filter(p=>p.merchant_id===id).map(p=>'<div class="product">'+esc(p.title)+'<small>'+money(p.price_cents)+' · '+p.stock+' available · '+esc(p.source)+'</small></div>').join('')+'</article>';
  }
}
function renderTeam(){
  $('team-roles').innerHTML=AGENT_ROLES.map(r=>{
    const item=frame.team.find(d=>d.role===r.role);
    return '<button class="agent-role" data-station="'+r.station+'" style="--role-color:'+r.color+'"><span class="role-order">'+r.number+'</span><span class="role-copy"><b>'+r.role+'</b><small>'+r.place+'</small><span class="role-job">'+r.job+'</span><span class="role-output">'+r.output+'</span><span class="role-record">'+(item?'Recorded day '+(item.day+1)+' · '+esc(item.action.replaceAll('_',' ').toLowerCase()):'Awaiting first recorded decision')+'</span></span><span class="locate-role" aria-hidden="true">↗</span></button>';
  }).join('');
  for(const b of $('team-roles').querySelectorAll('[data-station]'))b.onclick=()=>{setMapMode('agents');garden.focusStation(b.dataset.station);markStation(b.dataset.station);if(matchMedia('(max-width:760px)').matches)$('garden').scrollIntoView({block:'center',behavior:'smooth'});};
  $('team-log').innerHTML=frame.team.map(d=>'<li><span class="stamp">DAY '+(d.day+1)+' · '+esc(d.role.toUpperCase())+' · '+esc(d.status)+'</span><p>'+esc(d.message)+'</p><details><summary>Evidence and action</summary><pre>'+esc(JSON.stringify({action:d.action,...JSON.parse(d.evidence_json)},null,2))+'</pre></details></li>').join('');
}
function markStation(station){for(const b of $('team-roles').querySelectorAll('[data-station]'))b.classList.toggle('selected',b.dataset.station===station);}
function showTeamStation(station){showPanel('team');markStation(station);const role=$('team-roles').querySelector('[data-station="'+station+'"]');role?.scrollIntoView({block:'nearest',behavior:'smooth'});}
function renderLayerCaption(){
  $('layer-key').textContent=mapMode==='agents'?'WORKFLOW MAP':'CITY VIEW';
  if(mapMode==='agents'){
    const last=frame?.team?.[0];$('season-note').textContent=last?'Latest record · day '+(last.day+1)+' · '+last.role+': '+last.action.replaceAll('_',' ').toLowerCase():'City → data → models → reviewed offers → payments → data';
    $('population').textContent='Static dependencies · scripted roles';
  }else if(frame){
    $('season-note').textContent=frame.status==='COMPLETED'?'Season complete. Inspect a shop, customer or model.':frame.tick<=28?'Observe first. Learn what an offer changes.':frame.tick<35?'Small offers. A protected holdout.':frame.tick<42&&frame.scenario!=='steady'?'The market changed. Does our model still fit?':'Measure, retrain, and keep what works.';
    $('population').textContent=frame.merchantCount+' shops · '+num(frame.customerCount)+' customers · daily replay';
  }
}
function setMapMode(value){
  mapMode=value;garden.setMode(value);for(const [id,name]of [['map-city','city'],['map-network','agents']]){$(id).classList.toggle('selected',name===value);$(id).setAttribute('aria-pressed',String(name===value));}renderLayerCaption();
}
function renderModels(){
  const c=frame.champion;
  $('champion').innerHTML='<span>ACTIVE MODEL · LOCAL CPU</span><b>'+(c?'Version '+c.version+' · '+(c.type==='tree'?'decision tree':'logistic regression'):'Collecting history')+'</b><small>'+(c?'Fitted parameters are saved in the warehouse. The same model scores 0%, 5% and 10% offers.':'28 completed days precede the first fit. No model result is pre-written.')+'</small>';
  const points=frame.daily.map(d=>((d.day/55)*260).toFixed(1)+','+(76-d.conversion*65).toFixed(1)).join(' ');
  $('learning-chart').innerHTML='OBSERVED DAILY CONVERSION<svg viewBox="0 0 260 88" role="img" aria-label="Observed daily purchase conversion; vertical line marks the configured market change."><line x1="165.5" x2="165.5" y1="6" y2="82" stroke="#b78a65" stroke-dasharray="3 3"/><polyline points="'+points+'" fill="none" stroke="#6b8c58" stroke-width="2"/>'+frame.models.map(m=>'<circle cx="'+(m.day/55*260).toFixed(1)+'" cy="8" r="3" fill="'+(m.status==='PROMOTED'?'#6d8855':'#b58b62')+'"/>').join('')+'</svg><small>Line: purchases / visits. Dots: actual training reviews. Dashed line: scenario change. Only observed days are shown.</small>';
  $('training-runs').innerHTML=frame.models.slice().reverse().map(m=>'<article class="model"><h3>Candidate '+m.version+' · day '+(m.day+1)+'<span class="status '+(m.status!=='PROMOTED'?'rejected':'')+'">'+esc(m.status)+'</span></h3><dl><dt>Training / validation rows</dt><dd>'+num(m.training_rows)+' / '+num(m.validation_rows)+'</dd><dt>Candidate log loss ↓</dt><dd>'+(m.validation_log_loss?.toFixed(4)||'—')+'</dd><dt>Offer-rate baseline</dt><dd>'+(m.baseline_log_loss?.toFixed(4)||'—')+'</dd><dt>Existing model</dt><dd>'+(m.champion_log_loss?.toFixed(4)||'—')+'</dd><dt>Local training time</dt><dd>'+(m.runtime_ms/1000).toFixed(2)+'s</dd></dl><p>'+esc(m.reason)+'</p><details><summary>Both fitted candidates</summary><pre class="micro">'+esc(JSON.stringify(JSON.parse(m.candidates_json),null,2))+'</pre></details></article>').join('');
  const names=['recency','recent purchases','organic purchases','recent visits','spending','offer history','redemptions','price','stock','rival sale','payday'];
  $('feature-list').innerHTML=names.map(x=>'<span>'+x+'</span>').join('');
  const r=frame.retention.at(-1);
  $('retention').innerHTML=r?'<h3>Did more customers stay?</h3><span class="tag">LATEST 14-DAY WINDOW · '+r.status+'</span><div class="effect">'+(r.lift>=0?'+':'')+(100*r.lift).toFixed(1)+' pp</div><p>Reduction in inactivity: '+pct(r.control_rate)+' holdout versus '+pct(r.treatment_rate)+' treatment.<br>Approximate 95% interval: '+(100*r.ci_low).toFixed(1)+' to '+(100*r.ci_high).toFixed(1)+' pp.</p><p>'+Math.abs(r.estimated_prevented).toFixed(1)+(r.estimated_prevented>=0?' estimated fewer':' estimated more')+' inactive customers in the treatment group. '+(r.ci_low>0?'Positive evidence within this simulated experiment.':'The result does not establish a positive effect.')+'</p><p>Baseline-active cohort: '+r.treatment_n+' treatment / '+r.control_n+' holdout. Other windows reuse these people; do not sum them as distinct saved customers.</p>':'<h3>Retention needs time.</h3><p>The first 14-day result appears after day 42. A coupon redemption by itself is not prevented churn.</p>';
}
function closeInspector(){
  $('inspector-dock').hidden=true;$('market-view').classList.remove('panel-open');
  for(const el of document.querySelectorAll('[data-view]'))el.classList.toggle('active',el.dataset.view==='town');
}
function showPanel(name){
  if(name==='team')setMapMode('agents');
  $('inspector-dock').hidden=false;$('market-view').classList.add('panel-open');
  panel=name;$('warehouse-view').hidden=true;$('market-view').hidden=false;
  for(const el of document.querySelectorAll('[data-panel]')){el.classList.toggle('active',el.dataset.panel===name);el.setAttribute('aria-selected',String(el.dataset.panel===name));}
  for(const key of ['town','team','models'])$('panel-'+key).hidden=key!==name;
  $('notebook-title').textContent={town:'Inspector',team:'Agent workplaces',models:'Model bench'}[name];
  for(const el of document.querySelectorAll('[data-view]'))el.classList.toggle('active',el.dataset.view===name);
  if(name!=='town'&&matchMedia('(max-width:760px)').matches)document.querySelector('.notebook').scrollIntoView({block:'start'});
}
async function tick(steps=1){
  if(busy||!frame||frame.status==='COMPLETED')return;busy=true;
  const id=frame.runId;$('clock-label').textContent='Working locally · saving events and evaluating training steps…';
  try{const next=await api('/api/market/runs/'+encodeURIComponent(id)+'/advance',{steps});if(frame?.runId===id)render(next);return true;}
  catch(e){setPlaying(false);toast(e.message);return false;}finally{busy=false;if(frame)$('clock-label').textContent='Seed '+frame.seed+' · '+frame.policy.replaceAll('_',' ')+' · one step = one day';}
}
async function createSeason(e){
  e.preventDefault();if(busy)return;busy=true;setPlaying(false);$('create-season').disabled=true;
  try{const f=await api('/api/market/runs',{kind:'learning',seed:Number($('seed').value),customerCount:Number($('population-size').value),merchantCount:8,objective:$('objective').value,budgetCents:Math.round(Number($('campaign-budget').value)*100),scenario:$('scenario').value,policy:$('policy').value,sandboxLimit:0,sandboxSampleLimit:Number($('native-sample-limit').value)});render(f);$('brief').close();showPanel('town');closeInspector();setPlaying(true);toast('Season started. Local training and simulated commerce'+(f.sandboxSampleLimit?' · up to '+f.sandboxSampleLimit+' real sandbox captures after day 28.':'.'));}
  catch(e){toast(e.message);}finally{busy=false;$('create-season').disabled=false;}
}
function tableNav(){
  $('table-nav').innerHTML=['table','view'].map(kind=>'<h3>'+kind.toUpperCase()+'S · '+frame.tables.filter(t=>t.kind===kind).length+'</h3>'+frame.tables.filter(t=>t.kind===kind).map(t=>'<button data-table="'+esc(t.name)+'" class="'+(t.name===tableName?'active':'')+'">'+esc(t.name)+'<span>'+num(t.count)+'</span></button>').join('')).join('');
  for(const b of $('table-nav').querySelectorAll('button'))b.onclick=()=>{tableName=b.dataset.table;offset=0;$('find-row').value='';loadTable().catch(e=>toast(e.message));};
  $('warehouse-summary').textContent=num(frame.tables.filter(t=>t.kind==='table').reduce((n,t)=>n+t.count,0))+' base rows · '+frame.status.toLowerCase()+' · local SQLite';
}
async function openData(){
  if(!frame)return toast('Create a season first.');setPlaying(false);$('market-view').hidden=true;$('warehouse-view').hidden=false;
  for(const b of document.querySelectorAll('[data-view]'))b.classList.toggle('active',b.dataset.view==='data');
  await refreshStatus();$('run-history').innerHTML=status.runs.filter(r=>r.run_id.startsWith('GARDEN-')||r.run_id.startsWith('COMPARE-')).map(r=>'<option value="'+esc(r.run_id)+'">'+esc(r.run_id)+' · '+r.current_tick+'/56 days</option>').join('');$('run-history').value=frame.runId;
  await loadTable();
}
async function loadTable(){
  if(!frame)return;tableData=await api('/api/market/table?run='+encodeURIComponent(frame.runId)+'&name='+encodeURIComponent(tableName)+'&limit=50&offset='+offset);tableNav();
  if(tableName==='v_paypal_order_lineage'){const first=['order_id','merchant_name','paypal_status','paypal_order_id','capture_id','simulated_gross_cents','paypal_gross_cents','paypal_fee_cents','paypal_net_cents','amount_verified'];tableData.columns=[...first.filter(k=>tableData.columns.includes(k)),...tableData.columns.filter(k=>!first.includes(k))];}
  $('table-name').textContent=tableName;$('table-kind').textContent=tableData.kind==='view'?'JOINED VIEW':'BASE TABLE';$('table-description').textContent=tableData.description;
  $('table-count').textContent=tableData.count?(offset+1)+'–'+Math.min(offset+50,tableData.count)+' of '+num(tableData.count)+' rows':'No records yet';
  $('page-prev').disabled=offset===0;$('page-next').disabled=offset+50>=tableData.count;renderRows();
}
function renderRows(){
  if(!tableData)return;const query=$('find-row').value.toLowerCase(),rows=tableData.rows.filter(r=>!query||Object.values(r).some(x=>String(x??'').toLowerCase().includes(query)));
  $('data-table').querySelector('thead').innerHTML='<tr>'+tableData.columns.map(k=>'<th>'+esc(k)+'</th>').join('')+'</tr>';
  const display=(key,value)=>key.endsWith('_id')&&typeof value==='string'&&value.startsWith(frame.runId)?value===frame.runId?value.split('-').at(-1):value.slice(frame.runId.length+1):value;
  $('data-table').querySelector('tbody').innerHTML=rows.length?rows.map(r=>'<tr>'+tableData.columns.map(k=>'<td title="'+esc(r[k])+'">'+(r[k]===null?'—':esc(display(k,r[k])))+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+tableData.columns.length+'">No matching rows.</td></tr>';
}
function download(format){if(!frame)return;const a=document.createElement('a');a.href='/api/market/export?run='+encodeURIComponent(frame.runId)+'&format='+format+'&name='+encodeURIComponent(tableName);a.download='';a.click();}
async function compare(){
  if(!frame||busy)return;setPlaying(false);busy=true;$('compare').disabled=true;$('comparison-dialog').showModal();
  const started=Date.now();let pulse;
  const waiting=()=>{$('comparison-result').innerHTML='<div class="wait-indicator">Running four matched seasons on this computer.<b>'+Math.floor((Date.now()-started)/1000)+' seconds elapsed</b>No offers → fixed rules → scheduled ML → adaptive team.<br>No provider payments, LLMs or cloud calls.</div>';};waiting();pulse=setInterval(waiting,1000);
  try{
    const report=await api('/api/market/compare',{runId:frame.runId});clearInterval(pulse);
    const base=report.results.find(x=>x.policy==='no_offers');
    $('comparison-result').innerHTML='<p>'+esc(report.scope)+'</p><div class="comparison-scroll"><table><thead><tr><th>Policy</th><th>Purchases</th><th>Payment volume</th><th>Contribution</th><th>Δ vs no offers</th><th>Discounts + outreach</th><th>Redeemed</th><th>Model fits</th></tr></thead><tbody>'+report.results.map(r=>'<tr><td>'+esc(r.policy.replaceAll('_',' '))+'</td><td>'+num(r.purchases)+'</td><td>'+money(r.gross_cents)+'</td><td>'+money(r.contribution_cents)+'</td><td>'+money(r.contribution_cents-base.contribution_cents)+'</td><td>'+money(r.coupon_cost_cents+r.outreach_cents)+'</td><td>'+r.redemptions+'</td><td>'+r.model_trains+'</td></tr>').join('')+'</tbody></table></div><p>All financial figures are simulated. Discounts already reduce revenue. This single seed does not establish production ROI or an agent advantage. Compared runs and model artifacts remain available in the warehouse.</p>';
    render(await api('/api/market/run?id='+encodeURIComponent(frame.runId)));
  }catch(e){clearInterval(pulse);$('comparison-result').textContent=e.message;}finally{busy=false;$('compare').disabled=false;}
}
async function payments(){
  if(!frame)return toast('Open a saved season first.');
  $('payment-dialog').showModal();await renderPayments();
}
async function renderPayments(){
  const runId=frame.runId,request=++paymentViewRequest;
  $('payment-detail').dataset.loading='true';
  if($('payment-detail').dataset.runId!==runId)$('payment-detail').textContent='Loading saved receipts for this season…';
  try{
    const sample=await api('/api/market/payment-sample?run='+encodeURIComponent(runId));
    if(runId!==frame.runId||request!==paymentViewRequest||!$('payment-dialog').open)return;
    const receiptContext=r=>{const l=sample.lineage?.find(x=>x.receipt_id===r.receipt_id);return l?'<div class="native-order-context"><b>'+esc(l.merchant_name)+'</b><small>'+esc(l.product_titles)+'</small><span>'+(l.discount_pct?l.discount_pct+'% coupon redeemed':'No coupon')+' · sim date '+esc(l.simulation_event_date)+'</span></div>':'';};
    const complete=sample.receipts.filter(r=>r.status==='COMPLETED'),gross=complete.reduce((a,r)=>a+r.gross_cents,0),fees=complete.every(r=>r.fee_cents!==null)?complete.reduce((a,r)=>a+r.fee_cents,0):null;
    $('payment-detail').innerHTML='<div class="native-connection"><div><b>'+ (sample.funding.ready?'Reusable sandbox buyer connected':'One-time sandbox buyer setup')+'</b><small>'+(sample.funding.ready?'Saved PayPal consent · no checkout each simulation run':'Approve a generated sandbox buyer once. Never enter a real card here.')+'</small></div><a href="/sandbox-buyer.html" target="_blank" rel="noopener">'+(sample.funding.ready?'Setup details':'Connect test buyer')+' ↗</a></div>'+
      '<div class="native-stats"><div><b>'+complete.length+' / '+sample.maxOrders+'</b><span>VERIFIED NATIVE SAMPLES</span></div><div><b>'+money(gross)+'</b><span>CAPTURED TEST FUNDS</span></div><div><b>'+(fees===null?'—':money(fees))+'</b><span>PROVIDER-REPORTED FEES</span></div></div>'+
      '<p class="native-boundary">These are actual PayPal Sandbox records using fictitious funds. Each mirrors one emulator order; amounts are not added again to simulated revenue. One test buyer and one test store represent the fictional customers and merchants.</p>'+
      '<div class="native-heading"><h3>Order → native receipt</h3><button id="open-native-lineage">Open warehouse lineage ↗</button></div>'+
      (sample.receipts.length?'<div class="native-receipts">'+sample.receipts.map(r=>'<article>'+receiptContext(r)+'<div class="native-receipt-head"><b>'+money(r.gross_cents)+'</b><span class="native-status '+(r.status==='COMPLETED'?'complete':'')+'">'+esc(r.status)+'</span><button data-reconcile="'+esc(r.receipt_id)+'">'+(r.paypal_order_id?'Verify receipt':'Retry same request')+'</button></div><div class="native-ids"><span>Emulator order</span><code>'+esc(r.order_id)+'</code><span>PayPal order</span><code>'+esc(r.paypal_order_id||'Awaiting provider confirmation')+'</code><span>Capture ID</span><code>'+esc(r.capture_id||'—')+'</code></div><p>Native fee '+(r.fee_cents===null?'unknown':money(r.fee_cents))+' · Native net '+(r.net_cents===null?'unknown':money(r.net_cents))+(r.verified_at?' · Verified '+esc(new Date(r.verified_at).toLocaleString()):'')+'</p>'+(r.error_code?'<p class="native-error">'+esc(r.error_code)+' · Reconciliation preserves the same request identity.</p>':'')+'</article>').join('')+'</div>':'<p>No selected order has a provider receipt yet.</p>')+
      (sample.remaining>0?'<h3>Choose up to '+sample.remaining+' more order'+(sample.remaining===1?'':'s')+'</h3><p class="micro">Native capture uses the recorded order total after its coupon. The limit is three orders and $1,000 in test funds per season.</p><div class="native-candidates">'+(sample.candidates.length?sample.candidates.slice(0,15).map(c=>'<label><input type="checkbox" data-native-order="'+esc(c.order_id)+'" data-cents="'+c.total_cents+'" '+(!sample.funding.ready?'disabled':'')+'><span><b>'+esc(c.merchant_name)+'</b><small>'+esc(c.product_title)+'</small><small>'+esc(c.order_id.split('-').at(-1))+' · '+(c.discount_pct?c.discount_pct+'% coupon redeemed':'No coupon')+' · simulation date '+esc(c.event_date)+'</small></span><strong>'+money(c.total_cents)+'</strong></label>').join(''):'<p>Eligible field-test orders appear after the 28-day learning history. Native refunds are not automated.</p>')+'</div><div class="native-actions"><span id="native-selection">No orders selected</span><button id="mirror-selected" class="primary" disabled>Capture selected test orders</button></div>':'<p class="native-cap">This season’s sample cap is reached. Future seasons can reuse the saved buyer automatically.</p>')+
      '<p class="micro">Simulated refunds stay in the local ledger. The older standalone $100 receipt belongs to a separate checkout and is not included here.</p>';
    $('payment-detail').dataset.runId=runId;$('payment-detail').dataset.loading='false';
    $('open-native-lineage').onclick=async()=>{tableName='v_paypal_order_lineage';offset=0;$('payment-dialog').close();await openData();};
    for(const b of $('payment-detail').querySelectorAll('[data-reconcile]'))b.onclick=async()=>{b.disabled=true;try{const next=await api('/api/market/receipts/'+encodeURIComponent(b.dataset.reconcile)+'/refresh',{});if(frame.runId===runId)render(next);await renderPayments();}catch(e){toast(e.message);await renderPayments();}};
    const boxes=[...$('payment-detail').querySelectorAll('[data-native-order]')];
    const updateSelection=()=>{const selected=boxes.filter(b=>b.checked),cents=selected.reduce((n,b)=>n+Number(b.dataset.cents),0);$('native-selection').textContent=selected.length+' selected · '+money(cents)+' test funds';$('mirror-selected').disabled=!sample.funding.ready||sample.running||selected.length<1||selected.length>sample.remaining||cents+sample.reservedCents>sample.maxCents;};
    for(const b of boxes)b.onchange=updateSelection;
    if($('mirror-selected'))$('mirror-selected').onclick=async()=>{
      const ids=boxes.filter(b=>b.checked).map(b=>b.dataset.nativeOrder);$('mirror-selected').disabled=true;$('mirror-selected').textContent='Capturing in sandbox…';
      try{const next=await api('/api/market/runs/'+encodeURIComponent(runId)+'/mirror',{orderIds:ids});if(frame.runId===runId)render(next);await renderPayments();}
      catch(e){toast(e.message);await renderPayments();}
    };
  }catch(e){if(request===paymentViewRequest){$('payment-detail').textContent=e.message;$('payment-detail').dataset.loading='false';}}
}
$('brief-form').onsubmit=createSeason;$('new-season').onclick=async()=>{setPlaying(false);await refreshStatus();$('brief').showModal();};
$('play').onclick=()=>{if(!frame||frame.status==='COMPLETED')$('new-season').click();else setPlaying(!playing);};
$('step').onclick=()=>{setPlaying(false);tick(1);};$('week').onclick=()=>{setPlaying(false);tick(7);};
$('finish').onclick=async()=>{setPlaying(false);if(!frame||busy)return;$('finish').disabled=true;try{while(frame.status!=='COMPLETED')if(!await tick(7))break;}finally{$('finish').disabled=frame?.status==='COMPLETED';}};
$('inspect').onchange=e=>inspect(e.target.value);$('zoom-in').onclick=()=>garden.zoomIn();$('zoom-out').onclick=()=>garden.zoomOut();$('home').onclick=()=>garden.home();$('rotate').onclick=()=>garden.rotate();$('close-inspector').onclick=closeInspector;$('open-inspector').onclick=()=>showPanel('town');
for(const b of document.querySelectorAll('[data-speed]'))b.onclick=()=>{speed=Number(b.dataset.speed);for(const x of document.querySelectorAll('[data-speed]'))x.classList.toggle('selected',x===b);if(playing)setPlaying(true);};
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>b.dataset.view==='data'?openData().catch(e=>toast(e.message)):b.dataset.view==='town'?(setMapMode('city'),showPanel('town'),closeInspector()):showPanel(b.dataset.view);
for(const b of document.querySelectorAll('[data-panel]'))b.onclick=()=>showPanel(b.dataset.panel);
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>$(b.dataset.close).close();
$('compare').onclick=compare;$('payments').onclick=payments;$('team-payments').onclick=payments;
$('map-city').onclick=()=>setMapMode('city');$('map-network').onclick=()=>setMapMode('agents');
$('page-prev').onclick=()=>{offset=Math.max(0,offset-50);loadTable().catch(e=>toast(e.message));};$('page-next').onclick=()=>{offset+=50;loadTable().catch(e=>toast(e.message));};
$('find-row').oninput=renderRows;$('refresh-data').onclick=async()=>{render(await api('/api/market/run?id='+encodeURIComponent(frame.runId)));await loadTable();};
$('run-history').onchange=async()=>{offset=0;render(await api('/api/market/run?id='+encodeURIComponent($('run-history').value)));await loadTable();};
for(const [id,format]of [['download-db','sqlite'],['download-json','json'],['download-sql','sql'],['download-csv','csv']])$(id).onclick=()=>download(format);
setInterval(async()=>{if(!frame||status?.comparisonRunning||(!busy&&!frame.receipts.some(r=>['QUEUED','CREATING','APPROVED','PENDING'].includes(r.status))))return;try{const next=await api('/api/market/run?id='+encodeURIComponent(frame.runId));if(next.runId===frame.runId)render(next);}catch{}},1500);
try{await refreshStatus();const preferred=new URLSearchParams(location.search).get('run')||sessionStorage.getItem('marketRun');const latest=status.runs.find(r=>r.run_id===preferred)||status.runs.find(r=>r.run_id.startsWith('GARDEN-')||r.run_id.startsWith('COMPARE-'));if(latest)render(await api('/api/market/run?id='+encodeURIComponent(latest.run_id)));else{$('phase-title').textContent='A new season awaits';$('brief').showModal();}}catch(e){$('phase-title').textContent='Saved season unavailable';toast(e.message);}finally{document.body.dataset.loading='false';}
