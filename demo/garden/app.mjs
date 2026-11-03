import {mountPayPalTeam} from './paypal-team.mjs';
import {mountPolicyLab} from './policy-lab.mjs';
import {mountSimulationSettings} from './simulation-settings.mjs';
import {api,esc,money,num,pct,simulationTime} from './ui.mjs';
import {campaignBoard} from './team-view.mjs';
import {officeMarkup,updateOffice} from './office-scene.mjs';
import {mountLiveMarket} from './live-market.mjs';
import {mountJudgeDemo} from './judge-demo.mjs';
import {createGarden} from './world.mjs';
const $ = id => document.getElementById(id);
let liveMarketOpen=false;
let frame=null,status=null,playing=false,busy=false,speed=1,timer=null,toastTimer=null,panel='town',selected='',feed=[],tableName='customer_days',offset=0,tableData=null,populatedRun=null,mapMode='city',paymentViewRequest=0;
const garden=createGarden($('garden'),{onCustomer:id=>inspect('customer:'+id),onMerchant:id=>inspect('merchant:'+id),onTeam:station=>showTeamStation(station),onPayments:()=>paypalTeam.open(frame?.runId)});
let storeNames=localStorage.getItem('marketMetroStoreNames')==='true';garden.setNamesVisible(storeNames);$('store-names').checked=storeNames;
function setStoreNames(value){storeNames=Boolean(value);localStorage.setItem('marketMetroStoreNames',String(storeNames));garden.setNamesVisible(storeNames);$('store-names').checked=storeNames;judgeDemo.setStoreNames(storeNames);liveMarket.setStoreNames(storeNames);}
$('store-names').onchange=()=>setStoreNames($('store-names').checked);
const judgeDemo=mountJudgeDemo({getStoreNames:()=>storeNames,onStoreNames:setStoreNames,getFrame:()=>frame,onVisibility:open=>{if(open)setPlaying(false);garden.setPaused(open);},onRun:async id=>render(await api('/api/market/run?id='+encodeURIComponent(id))),onWarehouse:async id=>{render(await api('/api/market/run?id='+encodeURIComponent(id)));tableName='v_paypal_order_lineage';offset=0;await openData();}});
const paypalTeam=mountPayPalTeam({onVisibility:open=>garden.setPaused(open||liveMarketOpen),onRecords:()=>payments(),onWarehouse:async id=>{liveMarket.close();render(await api('/api/market/run?id='+encodeURIComponent(id)));tableName='v_paypal_agent_actions';offset=0;await openData();}});
const liveMarket=mountLiveMarket({onPayPal:id=>paypalTeam.open(id),onError:toast,onConfigure:()=>simulationSettings.open(frame),getStoreNames:()=>storeNames,onStoreNames:setStoreNames,onVisibility:open=>{liveMarketOpen=open;if(open)setPlaying(false);garden.setPaused(open);},onRun:async id=>render(await api('/api/market/run?id='+encodeURIComponent(id))),onWarehouse:async id=>{render(await api('/api/market/run?id='+encodeURIComponent(id)));tableName=frame.continuous?.plan?.campaignType==='recommendation'?'v_recommendation_journey':'v_coupon_journey';offset=0;await openData();}});
const policyLab=mountPolicyLab({onError:toast,onVisibility:open=>{liveMarketOpen=open;if(open)setPlaying(false);garden.setPaused(open);},onRun:async id=>render(await api('/api/market/run?id='+encodeURIComponent(id))),onWarehouse:async id=>{render(await api('/api/market/run?id='+encodeURIComponent(id)));tableName='v_policy_customer_journey';offset=0;await openData();}});
const simulationSettings=mountSimulationSettings({
  onStart:async(id,{demo})=>{render(await api('/api/market/run?id='+encodeURIComponent(id)));if(demo)await liveMarket.open({runId:id});else showPanel('team');await api('/api/market/live/'+id+'/control',{action:'resume'});render(await api('/api/market/run?id='+encodeURIComponent(id)));},
  onLegacy:async()=>{setPlaying(false);await refreshStatus();plannerChoice();$('brief').showModal();},
  onVisibility:open=>garden.setPaused(open||liveMarketOpen)
});
$('run-demo').onclick=()=>{location.href='/behavior-lab.html';};
$('recorded-demo').onclick=()=>{simulationSettings.close();liveMarket.close();judgeDemo.open();};
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,8000);}
function setPlaying(value){
  if(frame?.policyLab){playing=false;clearInterval(timer);$('play').textContent=frame.policyLab.clock==='RUNNING'?'Ⅱ Pause market':frame.policyLab.clock==='COMPLETE'?'Experiment complete':'▶ Resume experiment';return;}
  playing=value;clearInterval(timer);
  $('play').textContent=frame?.continuous?(frame.continuous.clock==='RUNNING'?'Ⅱ Pause market':frame.continuous.clock==='COMPLETE'?'Season complete':'▶ Resume market'):frame?.workflowId?'Campaign controlled by checkpoints':value?'Ⅱ Pause season':frame?.status==='COMPLETED'?'↻ New season':frame?.tick===28?'▶ Train & launch':frame?'▶ Resume season':'▶ Begin a season';
  if(value)timer=setInterval(()=>tick(1),Math.max(150,1050/speed));
}
function sourceStatus(){
  $('catalog-status').textContent=status?.catalog?.mode==='AUTHORED'?(status.catalog.productCount+' fictional products · authored'):status?.catalog?.mode==='SAMPLE'?'Authored sample catalog':(status?.catalog?.productCount||22)+' archived catalog products';
  $('trainer-status').textContent=status?.trainer?.ready?'Local CPU trainer ready':'Local Python setup required';
  $('native-sample-limit').disabled=!status?.funding?.ready;
  $('native-sample-limit').value=status?.funding?.ready?'3':'0';
  $('native-sample-help').textContent=status?.funding?.ready?'Saved sandbox buyer ready. Selected field-test orders will capture automatically.':'Connect a sandbox buyer once in PayPal records to enable automatic samples.';
}
async function refreshStatus(){status=await api('/api/market/status');sourceStatus();}
function render(next){
  if(next.kind!=='LEARNING_MARKET_V2')return;
  const priorModels=frame?.models.length||0,sameRun=frame?.runId===next.runId,newActivity=!sameRun||(frame?.simTime?.elapsedHours??frame?.tick)!==(next.simTime?.elapsedHours??next.tick),receiptsChanged=JSON.stringify(frame?.receipts)!==JSON.stringify(next.receipts);frame=next;garden.setFrame(next);
  const live=next.phase==='FIELD_TEST',s=live?next.live:next.history;
  $('planner-source').textContent=next.continuous?(next.continuous.mode==='gemini'?'Gemini planner':'Scripted planner')+' · local models':next.workflowActor==='vertex_planner'?'Gemini 3.1 Flash-Lite · '+(next.autonomy?.status||'starting')+' · $'+((next.autonomy?.modelCostMicros||0)/1e6).toFixed(4)+(next.autonomy?.unmeteredCostCeilingMicros?' + $'+(next.autonomy.unmeteredCostCeilingMicros/1e6).toFixed(2)+' reserved':'')+' / $0.25':next.workflowActor==='scripted_demo'?'Scripted campaign · real local models':next.workflowId?'Chat-planned campaign · checkpointed local tools':'Scripted team · real local models';
  $('play').disabled=Boolean(next.workflowId||next.continuous?.clock==='COMPLETE'||next.policyLab?.clock==='COMPLETE');$('compare').disabled=Boolean(next.workflowId||next.continuous);
  $('metric-phase').textContent=live?'FIELD TEST PURCHASES':'HISTORY PURCHASES';
  $('purchases').textContent=num(s.orders);$('volume').textContent=money(s.revenueCents);
  $('fee-detail').textContent='Modeled fees: '+money(s.feesCents);
  $('marketing-metric-label').textContent=next.continuous?'RECOMMENDATIONS / PURCHASES':'COUPONS REDEEMED';
  $('redemptions').innerHTML=next.continuous?num(s.recommendations||0)+' <em>/ '+num(s.recommendationPurchases||0)+'</em>':num(s.redemptions)+' <em>/ '+num(s.offers)+'</em>';
  $('coupon-detail').textContent=next.continuous?num(s.recommendationClicks||0)+' clicks · '+num(s.redemptions)+' coupons redeemed':num(s.seen)+' seen · '+num(s.offers)+' issued';
  $('budget').textContent=money(next.live.budgetSpentCents);
  $('budget-detail').textContent='of '+money(next.goal.budgetCents)+' · virtual budget';
  $('contribution').textContent=money(s.contributionCents);
  $('row-count').textContent=num(next.tables.filter(t=>t.kind==='table').reduce((n,t)=>n+t.count,0));
  const nativeCount=next.receipts.filter(r=>r.status==='COMPLETED').length;
  $('payments').textContent='PayPal team ↗';
  $('phase-title').textContent=next.status==='COMPLETED'?'Season complete':next.tick<=28?'Learning from the neighborhood':next.continuous?'Marketing in a living market':'The coupon field test';
  $('day').textContent=simulationTime(next);$('day').title='Simulation time · '+next.totalTicks+' days total';
  $('population').textContent=next.merchantCount+' shops · '+num(next.customerCount)+' neighbors · daily activity replay';
  $('clock-label').textContent=(busy?'Working locally… · ':'')+(next.simTime?'1 hour / '+next.continuous.settings.hourMs/1000+'s · Review every '+next.continuous.settings.reviewEveryDays+' days':next.continuous?.settings?'Daily run · Review every '+next.continuous.settings.reviewEveryDays+' days':'Seed '+next.seed+' · one step = one day');
  $('progress').style.width=(100*(next.simTime?next.simTime.elapsedHours/24:next.tick)/next.totalTicks)+'%';
  $('question').textContent=next.goal.question;
  if(populatedRun!==next.runId){
    populatedRun=next.runId;sessionStorage.setItem('marketRun',next.runId);const runUrl=new URL(location.href);runUrl.searchParams.set('run',next.runId);history.replaceState(null,'',runUrl);selected='';feed=[];$('inspector').innerHTML='<p class="muted">Select a neighbor or shop to trace their recorded activity.</p>';
    $('inspect').innerHTML='<option value="">Choose a customer or shop…</option><optgroup label="Merchants">'+next.merchants.map(m=>'<option value="merchant:'+esc(m.merchant_id)+'">'+esc(m.name)+'</option>').join('')+'</optgroup><optgroup label="Neighbors">'+next.customers.map(u=>'<option value="customer:'+esc(u.id)+'">'+esc(u.name)+'</option>').join('')+'</optgroup>';
  }
  if(newActivity&&next.activities?.length){feed=[...next.activities.filter(a=>a.type==='redemption'),...next.activities.filter(a=>a.type==='coupon'),...next.activities.filter(a=>a.type==='purchase'),...next.activities.filter(a=>a.type==='delivery'),...feed].slice(0,8);}
  else if(!feed.length&&next.recentActivity?.length)feed=next.recentActivity;
  renderJournal();if(selected)renderInspector();renderTeam();renderModels();renderLayerCaption();
  if($('payment-dialog').open&&(!sameRun||receiptsChanged))void renderPayments();
  if(sameRun&&next.models.length>priorModels)toast('Local training finished: '+next.models.at(-1).status.toLowerCase()+'. Open Model bench to inspect the evidence.');
  for(const id of ['step','week','finish']){$(id).hidden=Boolean(next.continuous);$(id).disabled=next.status==='COMPLETED'||Boolean(next.workflowId||next.continuous);}
  document.querySelector('.speed').hidden=Boolean(next.continuous);
  if(next.status==='COMPLETED'||next.workflowId||next.continuous)setPlaying(false);
  else if(!playing)setPlaying(false);
  if(next.policyLab){
    $('planner-source').textContent=next.policyLab.branch==='mesh'?'3 Gemini agents · local models · $'+(next.policyLab.modelCostMicros/1e6).toFixed(5):next.policyLab.branch==='rules'?'Rules coordinator · same local learner':'No-campaign comparison';
    $('phase-title').textContent=next.tick<30?'Collecting randomized history':next.tick>=100?'Observing delayed outcomes':'Commerce policy experiment';
    $('clock-label').textContent='Seed '+next.seed+' · 1 day / '+next.policyLab.settings.dayMs/1000+'s · agents work in background';
    for(const id of ['step','week','finish'])$(id).hidden=true;
    document.querySelector('.speed').hidden=true;setPlaying(false);
    $('payments').textContent='PayPal receipts ↗';$('compare').disabled=false;
  }
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
    $('inspector').innerHTML='<article class="inspector-card"><h3>'+esc(u.name)+'</h3><span class="tag">'+esc(u.segment)+' · '+(u.arm==='HOLDOUT'?'RANDOMIZED HOLDOUT':'TREATMENT-ELIGIBLE')+'</span><div class="tiny-stats"><div><strong>'+u.purchases+'</strong><small>PURCHASES</small></div><div><strong>'+u.offers+'</strong><small>OFFERS</small></div><div><strong>'+u.redemptions+'</strong><small>REDEEMED</small></div></div>'+(coupon?'<div class="coupon-stamp">'+coupon.pct+'% coupon · day '+(coupon.day+1)+' · '+esc(coupon.status==='REDEEMED'?'redeemed':coupon.day<frame.tick-1?'expired unused':'delivered')+'</div>':'')+(score?'<p class="micro">Predicted purchase probability for today’s candidate product:</p><div class="probabilities"><div><b>'+pct(score.p0)+'</b><small>NO OFFER</small></div><div><b>'+pct(score.p5)+'</b><small>5% OFFER</small></div><div><b>'+pct(score.p10)+'</b><small>10% OFFER</small></div></div><p class="micro">'+esc(score.reason)+'. Model '+esc(score.modelId.split('-MODEL-').at(-1))+'.</p>':'<p class="micro">Predictions appear after a model is trained and promoted.</p>')+'<p class="micro">These are model estimates for a simulated customer, not observed customer data or an individual claim of prevented churn.</p>'+(frame.workflowId?'<a class="primary" href="/workflow.html?id='+encodeURIComponent(frame.workflowId)+'&customer='+encodeURIComponent(u.id)+'">Open complete customer trace →</a>':'')+'</article>';
  }else{
    const m=frame.merchants.find(m=>m.merchant_id===id);if(!m)return;
    $('inspector').innerHTML='<article class="inspector-card"><h3>'+esc(m.name)+'</h3><span class="tag">FICTIONAL MERCHANT · '+esc(m.district)+'</span><div class="tiny-stats"><div><strong>'+m.sold+'</strong><small>UNITS SOLD</small></div><div><strong>'+m.stock+'</strong><small>ON HAND</small></div></div>'+frame.products.filter(p=>p.merchant_id===id).map(p=>'<div class="product">'+esc(p.title)+'<small>'+money(p.price_cents)+' · '+p.stock+' available · '+esc(p.source)+'</small></div>').join('')+'</article>';
  }
}
function renderTeam(){
  $('team-roles').hidden=Boolean(frame.policyLab);
  if(frame.policyLab){$('team-source').textContent='Growth investigator · experiment scientist · outcome reviewer';$('campaign-board').innerHTML='<p>Three Gemini roles investigate, fit and review bounded policies. Merchant actors enforce their own stock and margin limits.</p>';$('open-team-office').disabled=false;$('focus-shopper').disabled=false;$('team-log').innerHTML='';return;}
  const continuous=frame.continuous,chatPlanner=frame.workflowActor==='assistant_in_current_chat',vertexPlanner=frame.workflowActor==='vertex_planner';
  $('team-source').textContent=continuous?(continuous.mode==='gemini'?'Gemini planner':'Scripted planner')+' · local models':vertexPlanner?'Gemini 3.1 Flash-Lite · '+(frame.autonomy?.callCount||0)+' calls · API $'+((frame.autonomy?.modelCostMicros||0)/1e6).toFixed(6)+(frame.autonomy?.unmeteredCostCeilingMicros?' + $'+(frame.autonomy.unmeteredCostCeilingMicros/1e6).toFixed(2)+' reserved':'')+' / $0.25':chatPlanner?'Planner: assistant in this chat · local workers · no paid API':'Scripted coordination · real local ML · no LLM';
  const enabled=continuous?.settings?.campaigns||['reactivation'];
  $('campaign-board').innerHTML=campaignBoard(continuous?.plan,enabled,frame.tick);
  $('open-team-office').disabled=!continuous;$('focus-shopper').disabled=!continuous;
  if(!$('team-roles').children.length)$('team-roles').innerHTML=officeMarkup({mode:continuous?.mode||'local'});
  updateOffice($('team-roles'),frame.team,{...continuous,mode:continuous?.mode||(vertexPlanner?'gemini':chatPlanner?'chat':'local'),clock:continuous?.clock||'PAUSED',teamEnabled:continuous?.teamEnabled},frame.tick);
  $('team-roles').onclick=()=>{if(continuous)void liveMarket.open({runId:frame.runId});};
  $('team-log').innerHTML=frame.team.map(d=>'<li><span class="stamp">DAY '+(d.day+1)+' · '+esc(d.role.toUpperCase())+' · '+esc(d.status)+' · '+(d.source==='VERTEX_PLANNER_WITH_LOCAL_TOOLS'||d.source.startsWith('GEMINI_CONTINUOUS_MARKETING')?'GEMINI PLANNER':d.source==='ASSISTANT_IN_CHAT_WITH_LOCAL_TOOLS'?'CHAT PLANNER':'SCRIPTED WORKER')+'</span><p>'+esc(d.message)+'</p><details><summary>Evidence and action</summary><pre>'+esc(JSON.stringify({action:d.action,...JSON.parse(d.evidence_json)},null,2))+'</pre></details></li>').join('');
}
function markStation(station){for(const b of $('team-roles').querySelectorAll('[data-station]'))b.classList.toggle('selected',b.dataset.station===station);}
function showTeamStation(station){if(frame?.policyLab){void policyLab.open(frame.runId);return;}showPanel('team');markStation(station);const role=$('team-roles').querySelector('[data-station="'+station+'"]');role?.scrollIntoView({block:'nearest',behavior:'smooth'});}
function renderLayerCaption(){
  $('layer-key').textContent=mapMode==='agents'?'Workflow':'Market';
  if(frame)$('population').textContent=frame.merchantCount+' merchants · '+num(frame.customerCount)+' customers · seed '+frame.seed;
}
function setMapMode(value){
  mapMode=value;garden.setMode(value);for(const [id,name]of [['map-city','city'],['map-network','agents']]){$(id).classList.toggle('selected',name===value);$(id).setAttribute('aria-pressed',String(name===value));}renderLayerCaption();
}
function renderModels(){
  const c=frame.champion;
  $('champion').innerHTML='<span>ACTIVE MODEL · LOCAL CPU</span><b>'+(c?'Version '+c.version+' · '+(c.type==='tree'?'decision tree':'logistic regression'):'Collecting history')+'</b><small>'+(c?'Fitted parameters are saved in the warehouse. The same model scores 0%, 5% and 10% offers.':'Watching customer views and purchases. Training starts when 28 completed days are available.')+'</small>';
  if(frame.continuous?.recommender){const r=frame.continuous.recommender;$('champion').innerHTML='<span>ACTIVE RECOMMENDER · LOCAL FIT</span><b>'+esc(r.type==='popularity'?'Recommend popular products':'Recommend products for each shopper')+'</b><small>Learns from recorded browsing and purchases through day '+r.cutoff+'. In the later test period, '+pct(r.candidateRecall)+' of purchases matched a top-three personalized recommendation, vs '+pct(r.baselineRecall)+' for popular products.</small>';}
  const points=frame.daily.map(d=>((d.day/Math.max(55,frame.totalTicks-1))*260).toFixed(1)+','+(76-d.conversion*65).toFixed(1)).join(' ');
  $('learning-chart').innerHTML='OBSERVED DAILY CONVERSION<svg viewBox="0 0 260 88" role="img" aria-label="Observed daily purchase conversion; vertical line marks the configured market change."><line x1="165.5" x2="165.5" y1="6" y2="82" stroke="#b78a65" stroke-dasharray="3 3"/><polyline points="'+points+'" fill="none" stroke="#6b8c58" stroke-width="2"/>'+frame.models.map(m=>'<circle cx="'+(m.day/Math.max(55,frame.totalTicks-1)*260).toFixed(1)+'" cy="8" r="3" fill="'+(m.status==='PROMOTED'?'#6d8855':'#b58b62')+'"/>').join('')+'</svg><small>Line: purchases / visits. Dots: actual training reviews. Dashed line: scenario change. Only observed days are shown.</small>';
  $('training-runs').innerHTML=frame.models.slice().reverse().map(m=>'<article class="model"><h3>Candidate '+m.version+' · day '+(m.day+1)+'<span class="status '+(m.status!=='PROMOTED'?'rejected':'')+'">'+esc(m.status)+'</span></h3><dl><dt>Training / validation rows</dt><dd>'+num(m.training_rows)+' / '+num(m.validation_rows)+'</dd><dt>Candidate log loss ↓</dt><dd>'+(m.validation_log_loss?.toFixed(4)||'—')+'</dd><dt>Offer-rate baseline</dt><dd>'+(m.baseline_log_loss?.toFixed(4)||'—')+'</dd><dt>Existing model</dt><dd>'+(m.champion_log_loss?.toFixed(4)||'—')+'</dd><dt>Local training time</dt><dd>'+(m.runtime_ms/1000).toFixed(2)+'s</dd></dl><p>'+esc(m.reason)+'</p><details><summary>Fitted candidate details</summary><pre class="micro">'+esc(JSON.stringify(JSON.parse(m.candidates_json),null,2))+'</pre></details></article>').join('');
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
  if(name==='setup'){simulationSettings.open(frame);return;}
  if(name==='team')setMapMode('agents');
  $('inspector-dock').hidden=false;$('market-view').classList.add('panel-open');
  panel=name;$('warehouse-view').hidden=true;$('market-view').hidden=false;
  for(const el of document.querySelectorAll('[data-panel]')){el.classList.toggle('active',el.dataset.panel===name);el.setAttribute('aria-selected',String(el.dataset.panel===name));}
  for(const key of ['town','team','models'])$('panel-'+key).hidden=key!==name;
  $('notebook-title').textContent={town:'Inspector',team:'Agent team',models:'Models'}[name];
  for(const el of document.querySelectorAll('[data-view]'))el.classList.toggle('active',el.dataset.view===name);
  if(name!=='town'&&matchMedia('(max-width:760px)').matches)document.querySelector('.notebook').scrollIntoView({block:'start'});
}
async function tick(steps=1){
  if(busy||!frame||frame.status==='COMPLETED'||frame.workflowId||frame.continuous)return;busy=true;
  const id=frame.runId;$('clock-label').textContent='Working locally · saving events and evaluating training steps…';
  try{const next=await api('/api/market/runs/'+encodeURIComponent(id)+'/advance',{steps});if(frame?.runId===id)render(next);return true;}
  catch(e){setPlaying(false);toast(e.message);return false;}finally{busy=false;if(frame)$('clock-label').textContent='Seed '+frame.seed+' · '+frame.policy.replaceAll('_',' ')+' · one step = one day';}
}
async function createSeason(e){
  e.preventDefault();if(busy)return;busy=true;setPlaying(false);$('create-season').disabled=true;
  try{
    if($('policy').value==='vertex_planner'){
      const c=await api('/api/market/planner/start',{requestId:crypto.randomUUID(),seed:Number($('seed').value),customerCount:Number($('population-size').value),objective:$('objective').value,budgetCents:Math.round(Number($('campaign-budget').value)*100),scenario:$('scenario').value,nativeSamples:Number($('native-sample-limit').value)});
      render(await api('/api/market/run?id='+encodeURIComponent(c.runId)));$('brief').close();showPanel('town');closeInspector();toast('Autonomous campaign started · Gemini API cap $0.25. Decisions appear in Campaign run.');return;
    }
    const f=await api('/api/market/runs',{kind:'learning',seed:Number($('seed').value),customerCount:Number($('population-size').value),merchantCount:8,objective:$('objective').value,budgetCents:Math.round(Number($('campaign-budget').value)*100),scenario:$('scenario').value,policy:$('policy').value,sandboxLimit:0,sandboxSampleLimit:Number($('native-sample-limit').value)});render(f);$('brief').close();showPanel('town');closeInspector();setPlaying(true);toast('Season started. Local training and simulated commerce'+(f.sandboxSampleLimit?' · up to '+f.sandboxSampleLimit+' real sandbox captures after day 28.':'.'));}
  catch(e){toast(e.message);}finally{busy=false;$('create-season').disabled=false;}
}
function tableNav(){
  $('table-nav').innerHTML=['table','view'].map(kind=>'<h3>'+kind.toUpperCase()+'S · '+frame.tables.filter(t=>t.kind===kind).length+'</h3>'+frame.tables.filter(t=>t.kind===kind).map(t=>'<button data-table="'+esc(t.name)+'" class="'+(t.name===tableName?'active':'')+'">'+esc(t.name)+'<span>'+(t.count===null?'…':num(t.count))+'</span></button>').join('')).join('');
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
  if(!frame||busy||frame.workflowId||frame.continuous)return;setPlaying(false);busy=true;$('compare').disabled=true;$('comparison-dialog').showModal();
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
      (sample.remaining>0?'<h3>Choose up to '+sample.remaining+' more order'+(sample.remaining===1?'':'s')+'</h3><p class="micro">Native capture uses the recorded order total after its coupon. The limit is '+sample.maxOrders+' order(s) and $1,000 in test funds per season.</p><div class="native-candidates">'+(sample.candidates.length?sample.candidates.slice(0,15).map(c=>'<label><input type="checkbox" data-native-order="'+esc(c.order_id)+'" data-cents="'+c.total_cents+'" '+(!sample.funding.ready?'disabled':'')+'><span><b>'+esc(c.merchant_name)+'</b><small>'+esc(c.product_title)+'</small><small>'+esc(c.order_id.split('-').at(-1))+' · '+(c.discount_pct?c.discount_pct+'% coupon redeemed':'No coupon')+' · simulation date '+esc(c.event_date)+'</small></span><strong>'+money(c.total_cents)+'</strong></label>').join(''):'<p>Eligible field-test orders appear after the 28-day learning history. Native refunds are not automated.</p>')+'</div><div class="native-actions"><span id="native-selection">No orders selected</span><button id="mirror-selected" class="primary" disabled>Capture selected test orders</button></div>':'<p class="native-cap">This season’s sample cap is reached. Future seasons can reuse the saved buyer automatically.</p>')+
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
function plannerChoice(){const autonomous=$('policy').value==='vertex_planner';$('planner-help').hidden=!autonomous;$('campaign-budget').max=autonomous?'1000':'10000';if(autonomous&&Number($('campaign-budget').value)>1000)$('campaign-budget').value='300';$('native-sample-limit').querySelector('[value="3"]').disabled=autonomous;if(autonomous&&$('native-sample-limit').value==='3')$('native-sample-limit').value='0';$('create-season').textContent=autonomous?'Start autonomous campaign · max $0.25':'Create this season →';}
$('policy').onchange=plannerChoice;
$('open-team-office').onclick=()=>frame.policyLab?policyLab.open(frame.runId):liveMarket.open({runId:frame.runId});
$('focus-shopper').onclick=()=>frame.policyLab?policyLab.open(frame.runId,'trace'):liveMarket.open({runId:frame.runId,storyOnly:true});
$('brief-form').onsubmit=createSeason;
$('new-season').onclick=()=>simulationSettings.open(frame);
$('play').onclick=async()=>{if(frame?.policyLab){try{await api('/api/market/policy-lab/'+frame.runId+'/control',{action:frame.policyLab.clock==='RUNNING'?'pause':'resume'});render(await api('/api/market/run?id='+frame.runId));}catch(e){toast(e.message);}return;}if(frame?.continuous){try{await api('/api/market/live/'+frame.runId+'/control',{action:frame.continuous.clock==='RUNNING'?'pause':'resume'});render(await api('/api/market/run?id='+encodeURIComponent(frame.runId)));}catch(e){toast(e.message);}return;}if(!frame||frame.status==='COMPLETED')$('new-season').click();else setPlaying(!playing);};
$('step').onclick=()=>{setPlaying(false);tick(1);};$('week').onclick=()=>{setPlaying(false);tick(7);};
$('finish').onclick=async()=>{setPlaying(false);if(!frame||busy)return;$('finish').disabled=true;try{while(frame.status!=='COMPLETED')if(!await tick(7))break;}finally{$('finish').disabled=frame?.status==='COMPLETED';}};
$('inspect').onchange=e=>inspect(e.target.value);$('zoom-in').onclick=()=>garden.zoomIn();$('zoom-out').onclick=()=>garden.zoomOut();$('home').onclick=()=>garden.home();$('rotate').onclick=()=>garden.rotate();$('close-inspector').onclick=closeInspector;$('open-inspector').onclick=()=>showPanel('town');
for(const b of document.querySelectorAll('[data-speed]'))b.onclick=()=>{speed=Number(b.dataset.speed);for(const x of document.querySelectorAll('[data-speed]'))x.classList.toggle('selected',x===b);if(playing)setPlaying(true);};
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>frame?.policyLab&&['team','models'].includes(b.dataset.view)?policyLab.open(frame.runId,b.dataset.view==='models'?'results':'live'):b.dataset.view==='data'?openData().catch(e=>toast(e.message)):b.dataset.view==='town'?(setMapMode('city'),showPanel('town'),closeInspector()):showPanel(b.dataset.view);
for(const b of document.querySelectorAll('[data-panel]'))b.onclick=()=>showPanel(b.dataset.panel);
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>$(b.dataset.close).close();
$('compare').onclick=()=>frame?.policyLab?policyLab.open(frame.runId,'results'):compare();$('payments').onclick=()=>frame?.policyLab?payments():paypalTeam.open(frame?.runId);$('team-payments').onclick=()=>frame?.policyLab?payments():paypalTeam.open(frame?.runId);
$('map-city').onclick=()=>setMapMode('city');$('map-network').onclick=()=>frame?.policyLab?policyLab.open(frame.runId):setMapMode('agents');
$('page-prev').onclick=()=>{offset=Math.max(0,offset-50);loadTable().catch(e=>toast(e.message));};$('page-next').onclick=()=>{offset+=50;loadTable().catch(e=>toast(e.message));};
$('find-row').oninput=renderRows;$('refresh-data').onclick=async()=>{render(await api('/api/market/run?id='+encodeURIComponent(frame.runId)));await loadTable();};
$('run-history').onchange=async()=>{offset=0;render(await api('/api/market/run?id='+encodeURIComponent($('run-history').value)));await loadTable();};
for(const [id,format]of [['download-db','sqlite'],['download-json','json'],['download-sql','sql'],['download-csv','csv']])$(id).onclick=()=>download(format);
setInterval(async()=>{if(liveMarketOpen||!frame||status?.comparisonRunning||(!busy&&frame.policyLab?.clock!=='RUNNING'&&frame.continuous?.clock!=='RUNNING'&&!(frame.workflowActor==='vertex_planner'&&['STARTING','RUNNING'].includes(frame.autonomy?.status))&&!frame.receipts.some(r=>['QUEUED','CREATING','APPROVED','PENDING'].includes(r.status))))return;try{const next=await api('/api/market/run?id='+encodeURIComponent(frame.runId));if(next.runId===frame.runId)render(next);}catch{}},750);
try{await refreshStatus();const preferred=new URLSearchParams(location.search).get('run')||sessionStorage.getItem('marketRun');const latest=status.runs.find(r=>r.run_id===preferred)||status.runs.find(r=>r.run_id.startsWith('GARDEN-')||r.run_id.startsWith('COMPARE-'));if(latest)render(await api('/api/market/run?id='+encodeURIComponent(latest.run_id)));else{$('phase-title').textContent='Ready';simulationSettings.open();}}catch(e){$('phase-title').textContent='Saved season unavailable';toast(e.message);}finally{document.body.dataset.loading='false';}

if(new URLSearchParams(location.search).has('policyLab'))await policyLab.openFromUrl();else if(new URLSearchParams(location.search).has('liveMarket'))await liveMarket.openFromUrl();else await judgeDemo.openFromUrl();

if(new URLSearchParams(location.search).has('paypalServices'))await paypalTeam.open(frame?.runId);
