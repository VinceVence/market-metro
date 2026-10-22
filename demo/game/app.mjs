import { CASES, PHASES, usd, createEconomy, startSupplyFlow, sendAgents, tick, choose, execute, stockRace, reconcileRefund, compareOptions, setAssumptions, exportEconomy } from './economy.mjs';
import { createHarborView, portrait } from './town-view.mjs';
import { PLACES } from './yard-art.mjs';

const $=id=>document.getElementById(id),escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let world=createEconomy(),stamp='',stockStamp='',previousTime=0,pausedBeforeDialog=false,hidden=false;
const view=createHarborView($('town'),selectActor),portraits=new Map();
const face=id=>{if(!portraits.has(id))portraits.set(id,portrait(id));return portraits.get(id);};
const fact=(label,value)=>`<div class="fact-pair"><span>${label}</span><b>${value}</b></div>`;
const signed=cents=>(cents>0?'+':'')+usd(cents);
$('case-select').innerHTML=CASES.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
$('case-select').addEventListener('change',()=>reset($('case-select').value));
$('reset').addEventListener('click',()=>reset(world.caseId));
$('pause').addEventListener('click',()=>{world.paused=!world.paused;render(true);});
$('speed').addEventListener('click',()=>{world.speed=world.speed===1?2:1;render(true);});
$('focus-town').addEventListener('click',()=>{const expanded=document.body.classList.toggle('town-expanded');$('focus-town').setAttribute('aria-pressed',String(expanded));$('focus-town').textContent=expanded?'Show case':'Expand operation';resize();});
for(const id of ['compare-open','impact-explain'])$(id).addEventListener('click',()=>openDialog('compare-dialog'));
$('journal-open').addEventListener('click',()=>openDialog('journal-dialog'));
$('assumptions-open').addEventListener('click',()=>openDialog('assumptions-dialog'));
$('source-open').addEventListener('click',()=>openDialog('source-dialog'));
document.querySelectorAll('dialog').forEach(dialog=>{
  dialog.querySelector('.close-dialog').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{world.paused=pausedBeforeDialog;render(true);});
});
$('success-rate').addEventListener('input',()=>changeAssumption({successBps:Number($('success-rate').value)*100}));
$('future-volume').addEventListener('change',()=>changeAssumption({futureVolume:Math.round(Number($('future-volume').value)*100)}));
$('contribution-rate').addEventListener('change',()=>changeAssumption({netContributionBps:Math.round(Number($('contribution-rate').value)*100)}));
$('export-run').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify(exportEconomy(world),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`supply-yard-${world.caseId}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
document.addEventListener('visibilitychange',()=>{hidden=document.hidden;previousTime=0;});
document.addEventListener('keydown',e=>{if(e.code==='Space'&&e.target===document.body&&!document.querySelector('dialog[open]')){e.preventDefault();world.paused=!world.paused;render(true);}});

function reset(id){world=createEconomy(id);stamp='';$('status-message').textContent='';$('case-select').value=id;render(true);}
function act(fn){try{$('status-message').textContent='';fn();render(true);}catch(error){render(true);$('status-message').textContent=error.message;}}
function button(label,fn,className='primary',disabled=false){const b=document.createElement('button');b.className=className;b.textContent=label;b.disabled=disabled;b.addEventListener('click',()=>act(fn));$('actions').append(b);}
function selectActor(id){
  id=({paypal:'reviewer',supply:'supplier',lab:'scout'})[id]||id;
  if(!world.actors.some(a=>a.id===id)&&!PLACES.some(p=>p.id===id))return;world.selected=id;render(true);
  const a=world.actors.find(a=>a.id===id)||PLACES.find(p=>p.id===id).entry,frame=$('world-frame'),canvas=$('town');
  if(canvas.clientWidth>frame.clientWidth)frame.scrollTo({left:Math.max(0,a.x/960*canvas.clientWidth-frame.clientWidth/2),behavior:view.reduced()?'instant':'smooth'});
}
function openDialog(id){
  pausedBeforeDialog=world.paused;world.paused=true;
  if(id==='compare-dialog'){
    $('success-rate').value=world.assumptions.successBps/100;$('future-volume').value=world.assumptions.futureVolume/100;$('contribution-rate').value=world.assumptions.netContributionBps/100;
    for(const field of ['success-rate','future-volume','contribution-rate'])$(field).disabled=world.phase===5;
    renderComparison();
  }
  if(id==='journal-dialog')renderJournal();
  $(id).showModal();render(true);
}
function changeAssumption(patch){act(()=>setAssumptions(world,patch));renderComparison();}
function resize(){
  const frame=$('world-frame'),canvas=$('town'),mobile=window.innerWidth<=780;
  const width=mobile?Math.max(frame.clientWidth,640):Math.max(1,Math.min(frame.clientWidth,frame.clientHeight*1.6));
  canvas.style.width=`${width}px`;canvas.style.height=`${width/1.6}px`;
}
new ResizeObserver(resize).observe($('world-frame'));

function render(force=false){
  const key=[world.phase,world.orderFlow.stage,world.delivery?.stage,world.events.length,world.selected,world.paused,world.speed,world.revision,world.outcome,world.refundPending].join('|');
  const officeKey=world.offices.map(o=>o.stock).join('|');
  if(!force&&key===stamp){if(officeKey!==stockStamp){stockStamp=officeKey;updateStockDescription();if(world.selected.startsWith('office-'))renderPerson();}return;}stamp=key;stockStamp=officeKey;
  const previousOutcome=$('branch-outcome')?.value;
  const m=compareOptions(world),mission=$('mission'),delivering=world.delivery&&world.delivery.stage!=='complete',received=world.offices.reduce((n,o)=>n+o.received,0);
  $('phase-label').textContent=`0${world.phase+1} / ${PHASES[world.phase].toUpperCase()}`;
  $('world-status').textContent=PHASES[world.phase].toUpperCase();$('step-badge').textContent=world.phase+1;
  const flowDone=world.delivery?.stage==='complete'||world.orders.every(o=>o.refund==='COMPLETED');
  const step=world.phase===0?(world.orderFlow.stage==='restock'?1:0):world.phase===1?1:world.phase===2?2:world.phase<5?3:flowDone?5:4;
  $('flow-steps').innerHTML=['Offices request','Restock attempt','Agents check','PayPal decides',world.phase===5&&!world.delivery?'Refund orders':'Van delivers'].map((s,i)=>`<li class="${i===1&&world.phase>0?'blocked':i<step?'done':i===step?'current':''}"${i===step?' aria-current="step"':''}><span>${i===1&&world.phase>0?'!':i<step?'✓':i+1}</span>${i===1&&world.phase>0?'Restock blocked':s}</li>`).join('');
  if(world.phase===0)$('world-status').textContent={ready:'READY TO REQUEST',requests:'OFFICES REQUEST STOCK',restock:'MERCHANT REQUESTS RESTOCK'}[world.orderFlow.stage];
  if(delivering){$('world-status').textContent='DELIVERY IN PROGRESS';$('phase-label').textContent='06 / DELIVERY IN PROGRESS';}
  else if(world.delivery)$('world-status').textContent='BOTH OFFICES RESTOCKED';
  $('pause').textContent=world.paused?'Resume':'Pause';$('pause').setAttribute('aria-label',world.paused?'Resume operation animation':'Pause operation animation');$('speed').textContent=world.speed+'×';
  $('backing-hud').innerHTML=`${usd(world.ledger.available+world.ledger.reserve)} <small>${usd(world.ledger.reserve)} in reserve</small>`;
  $('journal-count').textContent=world.events.length;
  $('flow-status').textContent=world.delivery?`${received}/4 kits delivered · ${usd(world.ledger.reserve)} held`:world.refundPending?'Refunds awaiting confirmation':world.orders.every(o=>o.refund==='COMPLETED')?'4 orders refunded · 2 offices':`4 paid kits · ${world.quote.reservedBy||!world.quote.valid?0:world.quote.stock} backup kits available`;
  const announcement=`${$('world-status').textContent}. ${$('flow-status').textContent}.`;
  if($('flow-announcement').textContent!==announcement)$('flow-announcement').textContent=announcement;
  updateStockDescription();
  $('impact-value').parentElement.classList.toggle('good',world.phase===5?world.outcome==='success':world.phase>=3&&world.recommendation?.decision==='RELEASE');
  $('impact-value').parentElement.classList.toggle('bad',world.phase===5&&world.outcome==='failure');
  if(world.phase>=3&&world.recommendation?.decision==='RELEASE'){
    $('impact-label').textContent='Modeled expected refund loss avoided';$('impact-value').innerHTML=`${usd(m.avoidedExpectedLoss)} <small>under ${world.assumptions.successBps/100}% success assumption</small>`;
  }else{$('impact-label').textContent='PayPal exposure if cancelled';$('impact-value').innerHTML=`${usd(m.hold.failureLoss)} <small>assumed uncovered refunds</small>`;}
  if(world.phase===5&&!delivering){$('impact-label').textContent=world.refundPending?'Refund outcome unresolved':'PayPal coverage in selected branch';$('impact-value').innerHTML=world.refundPending?'Pending <small>not completed money movement</small>':`${usd(world.ledger.paypalPaid)} <small>local ${world.outcome==='success'?'success':'failure'} scenario</small>`;}
  $('actions').replaceChildren();
  if(world.phase===0){
    const started=world.orderFlow.stage!=='ready',restocking=world.orderFlow.stage==='restock';
    mission.innerHTML=`<h2 id="inspector-title">${restocking?'Mara needs four kits.':started?'“Two supply kits, please.”':'Follow one supply run.'}</h2><p>${restocking?'Mara combines the two requests and asks Northshore to restock her packing desk. Watch the four-kit request travel to the warehouse.':'West Studio and Ledger Office each request two kits. Follow the blue order slips to Mara, then the van back to each office.'}</p>${fact('Office orders','2 + 2 kits')}${fact('Already paid through PayPal','$1,000')}<div class="callout blue"><b>What happens when supply fails?</b>The agents investigate whether releasing $60 of Mara’s reserve could get these orders delivered.</div><p class="micro-note">Replaying existing paid orders. No new checkout or charge.</p>`;
    $('objective-text').textContent=restocking?'Mara sends one restock request. Watch the original supply route.':started?'Follow the order slips from both offices to Mara.':'Play the requests, restock attempt, and supply failure.';
    if(!started)button('Play supply flow →',()=>startSupplyFlow(world));
    else button(world.paused?'Resume supply flow':restocking?'Restock requested…':'Offices requesting…',()=>{world.paused=false;},'primary',!world.paused);
  }else if(world.phase===1){
    mission.innerHTML=`<h2 id="inspector-title">Restock blocked.<br>Agents step in.</h2><p>Northshore cannot deliver. Backup stock costs $160, but Mara has only $100 available. The reserve could close the $60 gap.</p>${fact('If all orders are refunded','$1,000')}${fact('Merchant can cover','$300')}${fact('PayPal would cover','$700')}<div class="callout warn"><b>Baseline: hold the $200 reserve.</b>The agents must verify stock, funds, and delivery terms before proposing a change.</div>`;
    $('objective-text').textContent='The baseline holds the reserve. Can the agents find a viable alternative?';button('Send the agent team →',()=>sendAgents(world));
  }else if(world.phase===2){
    mission.innerHTML=`<h2 id="inspector-title">Check stock, terms, and funds.</h2><p>Scout checks the backup warehouse. Economist checks the reserve. Challenger checks the batch price and the offices’ deadline.</p><div class="callout"><b>${world.evidence.filter(e=>e.found).length} of 3 checks complete.</b>The team performs scripted checks around the supply operation. No LLM is running.</div>`;
    $('objective-text').textContent=world.paused?'Resume the operation to continue the checks.':'Watch the team collect stock, money, and contract evidence.';
    button(world.paused?'Resume investigation':'Investigating…',()=>{world.paused=false;},'primary',!world.paused);
  }else if(world.phase===3){
    const release=world.recommendation.decision==='RELEASE',missing=world.recommendation.decision==='MORE_EVIDENCE';
    mission.innerHTML=`<h2 id="inspector-title">${release?'The evidence changes the decision.':missing?'The team needs more evidence.':'The team keeps the reserve.'}</h2><div class="recommendation-arrow"><span>Baseline: hold $200</span>→<strong>${release?'Release $60':missing?'Abstain':'Keep $200'}</strong></div><p>${release?'Four kits exist, the $160 batch can arrive on time, and a $60 release closes Mara’s cash gap. The agents propose; you authorize.':world.recommendation.reason}</p>${release?fact('Reserve after release','$140 stays held')+fact('Expected PayPal refund loss','$700 → '+usd(m.release.expectedLoss))+`<p class="micro-note">Assumes ${world.assumptions.successBps/100}% recovery success. If recovery fails: ${usd(m.release.failureLoss)} loss, ${usd(m.extraFailureLoss)} worse than holding.</p>`:`<div class="callout warn">${missing?'Approval stays blocked until the missing information is supplied.':'The comparison must justify the intervention. A cash gap alone is insufficient.'}</div>`}<button class="small-action" id="self-approval">Test: agent attempts self-approval</button>`;
    $('self-approval').addEventListener('click',()=>act(()=>choose(world,'RELEASE','agent')));
    $('objective-text').textContent=release?'Review both the expected benefit and the worse failure branch.':'Retain the reserve, or inspect why the proposal failed.';
    button('Keep reserve',()=>choose(world,'HOLD'),'secondary');button('Approve $60 release',()=>choose(world,'RELEASE'),'primary release',!release);
  }else if(world.phase===4){
    const release=world.approval.decision==='RELEASE';
    mission.innerHTML=`<h2 id="inspector-title">${release?'A bounded release is approved.':'You chose to keep the reserve.'}</h2><p>${release?'The gate rechecks stock and this evidence version before moving $60 of Mara’s own money.':'Without the replacement purchase, the four paid orders are cancelled and require refunds.'}</p>${fact('Reserve action',release?'Release $60':'Keep $200')}${fact('Payment path',release?'Purchase → fulfill or refund':'Refund captured payments')}<label class="outcome-select" for="branch-outcome">Play an authored outcome</label><select id="branch-outcome">${release?'<option value="success">Replacement arrives on time</option><option value="failure">Replacement also fails</option>':''}<option value="pending">Refund stays pending</option></select>${!release?'<p class="callout warn">Choose “Complete cancellation” below to settle refunds immediately.</p>':''}<button class="small-action" id="race">Inject race: Jun reserves the stock</button>`;
    $('race').addEventListener('click',()=>act(()=>stockRace(world)));
    if(previousOutcome&&[...$('branch-outcome').options].some(o=>o.value===previousOutcome))$('branch-outcome').value=previousOutcome;
    if(world.revision!==world.recommendation.version)mission.insertAdjacentHTML('beforeend','<div class="callout warn"><b>Stock changed after approval.</b>Execution must reject the stale decision before releasing funds.</div>');
    $('objective-text').textContent='Choose a branch and watch the funds, crates, and refunds move.';
    if(!release)button('Complete cancellation',()=>execute(world,'failure'),'secondary');
    button(release?'Run approved plan →':'Play pending refund →',()=>execute(world,$('branch-outcome').value));
  }else{
    if(world.delivery){
      const stage=world.delivery.stage,titles={pickup:'First, pick up the stock.',restock:'Mara’s restock is on its way.',packing:'Two kits for each office.','office-a':'Next stop: West Studio.','office-b':'Next stop: Ledger Office.',complete:'Both offices are restocked.'};
      mission.innerHTML=`<h2 id="inspector-title">${titles[stage]}</h2><div class="recommendation-arrow"><span>Reserve $200</span>→<strong>$140 held</strong></div><p>${delivering?'The approved $60 release enables the $160 purchase. Follow the van: backup stock → Mara’s packing desk → both offices.':'The $60 release unlocked the supply run. Four existing paid orders are now fulfilled; PayPal covers $0 in this selected success branch.'}</p><ol class="delivery-checks">${[['Pickup',!['pickup'].includes(stage)],['Pack 2 + 2',!['pickup','restock','packing'].includes(stage)],...world.offices.map(o=>[o.name+' · 2 kits',o.received===2])].map(([text,done])=>`<li class="${done?'done':''}"><span>${done?'✓':'○'}</span>${text}</li>`).join('')}</ol>${fact('Supplier paid',usd(world.ledger.supplierPaid))}<p class="micro-note">${delivering?'Inventory changes only when the van reaches each office.':'Local success branch, not measured savings.'} If the replacement failed, PayPal’s assumed shortfall would be $860.</p>`;
    }else mission.innerHTML=`<h2 id="inspector-title">${world.refundPending?'The refund is still pending.':'PayPal covers the shortfall.'}</h2><p>${world.refundPending?'No refund funds have moved yet. Reconcile the local response before calling the payment completed.':'The ledger consumes recoverable merchant funds first. The remaining amount is covered by PayPal under this scenario’s assumptions.'}</p>${fact('Supplier paid',usd(world.ledger.supplierPaid))}${fact('Customers refunded',usd(world.ledger.customerRefunds))}${fact('PayPal coverage used',world.refundPending?'Pending':usd(world.ledger.paypalPaid))}<div class="callout warn"><b>This branch matters.</b>A release can lose more when recovery fails. The expected benefit depends on the visible success assumption.</div>`;
    $('objective-text').textContent=delivering?'Watch stock move: warehouse → packing → each office.':'This is a selected local outcome, not measured PayPal savings.';
    if(world.refundPending)button('Reconcile refund → completed',()=>reconcileRefund(world));
    else if(delivering)button(world.paused?'Resume delivery':'Van delivering…',()=>{world.paused=false;},'primary',!world.paused);
    else button('Replay this case',()=>reset(world.caseId));
    button('Compare PayPal outcomes',()=>openDialog('compare-dialog'),'secondary');
  }
  $('evidence-strip').hidden=world.phase<2||world.phase===5;
  $('evidence-strip').innerHTML=world.evidence.map(e=>{const a=world.actors.find(a=>a.id===e.agent);return `<div class="evidence-item" role="button" tabindex="0" data-agent="${a.id}" aria-label="Inspect ${a.name} evidence"><img src="${face(a.skinId)}" alt=""><div><b>${e.title}</b><small>${e.found?e.finding.title:a.name+' is checking'}</small></div><span class="${e.found?e.finding.ok?'':'bad':'pending'}">${e.found?e.finding.ok?'✓':'!':'·'}</span></div>`;}).join('');
  document.querySelectorAll('[data-agent]').forEach(el=>{el.addEventListener('click',()=>selectActor(el.dataset.agent));el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectActor(el.dataset.agent);}});});
  renderPerson();renderResidents();
  if($('compare-dialog').open)renderComparison();
}

function updateStockDescription(){
  $('town').setAttribute('aria-label',`Supply Yard: ${world.offices.map(o=>`${o.name} has ${o.stock} kits on hand; ${o.received?`${o.received} replacement kits received`:world.orders.every(x=>x.refund==='COMPLETED')?'replacement orders refunded':`${o.requested} paid replacement kits awaited`}`).join('; ')}. Backup warehouse has ${world.quote.stock} unallocated kits${world.delivery?.awaitingPickup?`; ${world.delivery.awaitingPickup} purchased kits await pickup`:''}. ${world.delivery?`Van carries ${world.delivery.load} kits; ${world.delivery.packing} at the packing bench. `:''}Reserve: ${usd(world.ledger.reserve)}. Use the participant buttons to inspect staff.`);
}

function renderPerson(){
  const a=world.actors.find(a=>a.id===world.selected);
  if(!a){const p=PLACES.find(p=>p.id===world.selected),office=world.offices.find(o=>o.id===world.selected);if(!p)return;const text=office?`${office.stock} kits on hand. Two replacement kits are already ordered and paid. ${office.received?'Both have been received.':world.orders[0].refund==='COMPLETED'?'The replacement order was refunded.':'Waiting for delivery.'}`:world.phase>0?'The original warehouse cannot dispatch the promised batch. The team must verify a replacement.':'The original warehouse is scheduled to send four supply kits.';$('selected-person').innerHTML=`<div class="person-heading"><img src="${face(office?'office':'warehouse')}" alt="Supply operation staff"><div><b>${p.name}</b><span>${office?'OFFICE BUYER':'ORIGINAL SUPPLIER'}</span></div></div><p>${text}</p>`;return;}
  const e=world.evidence.find(e=>e.agent===a.id);
  const descriptions={mara:`Mara runs the office-supply packing desk. Funds: ${usd(world.ledger.available)} available, ${usd(world.ledger.reserve)} reserved. ${world.ledger.supplierPaid?'The approved release enabled the $160 replacement purchase.':world.phase===5?'No replacement was purchased; the orders are cancelled.':'The replacement batch needs $60 more available cash.'}`,jun:world.quote.reservedBy==='jun'?'Jun’s print-supply business owns the last batch reservation. Mara cannot take its stock.':'Jun runs a neighboring print-supply desk. Both merchants can request stock from the backup warehouse.',inez:'Inez coordinates loading and delivery. Watch the van take the selected recovery route.',courier:world.delivery?`The van carries ${world.delivery.load} kits. ${world.offices.reduce((n,o)=>n+o.received,0)} of four kits have reached their offices. Stock moves only at the actual simulation stops.`:'The van is waiting for an approved and funded replacement order.',reviewer:'The reviewer owns the reserve decision. Agents cannot approve themselves. Reserve changes and payment responses remain local simulations.',supplier:`The backup warehouse quotes four supply kits for $160 upfront. Unallocated kits: ${world.quote.stock}. Stock ownership is checked again before execution.`};
  const text=e?e.found?e.finding.detail:`${a.name} will inspect ${e.title.toLowerCase()}. Evidence source: ${e.source}.`:descriptions[a.id]|| (a.role==='customer'?'This customer already paid $250. Their order will be fulfilled or refunded in the selected branch.':'A supply-operation staff member. Their movements do not create financial ledger events.');
  $('selected-person').innerHTML=`<div class="person-heading"><img src="${face(a.skinId)}" alt="Supply staff portrait of ${escape(a.name)}"><div><b>${escape(a.name)}</b><span>${e?'SCRIPTED INVESTIGATOR':a.role.toUpperCase()}</span></div></div><p>${escape(text)}</p>`;
}
function renderResidents(){
  $('residents').innerHTML=world.actors.filter(a=>['mara','jun','inez','scout','economist','challenger'].includes(a.id)).map(a=>`<button data-person="${a.id}" aria-label="Select ${a.name}" aria-pressed="${world.selected===a.id}"><img src="${face(a.skinId)}" alt=""><span>${a.name}<small>${a.role==='agent'?'Investigator':a.role==='dispatcher'?'Dispatch':'Merchant'}</small></span></button>`).join('');
  document.querySelectorAll('[data-person]').forEach(b=>b.addEventListener('click',()=>selectActor(b.dataset.person)));
}
function renderComparison(){
  const m=compareOptions(world),p=world.assumptions.successBps/100,release=world.recommendation?.decision==='RELEASE';
  $('success-label').textContent=p+'%';
  $('decision-change').innerHTML=world.phase<3?'<span class="unverified">Evidence is not verified yet. These numbers are a conditional illustration, not an executable recommendation.</span>':`<b>Demo baseline: HOLD → ${release?'agent proposal: RELEASE $60':world.recommendation?.decision==='MORE_EVIDENCE'?'agent response: MORE EVIDENCE':'agent proposal: KEEP RESERVE'}.</b> ${escape(world.recommendation?.reason||'')}${!world.liabilityKnown?' Arithmetic below excludes the unknown obligations; it cannot justify approval.':''}`;
  const option=(title,o,candidate)=>`<article class="option ${candidate?'candidate':''}"><div class="option-label"><h3>${title}</h3><span>${candidate?'CANDIDATE':'BASELINE'}</span></div><p class="loss-label">Expected uncovered refunds / 30-day model</p><div class="big-value">${usd(o.expectedLoss)}</div><div class="loss-track" role="img" aria-label="Expected uncovered refunds ${usd(o.expectedLoss)} of 1000 dollars"><i style="width:${o.expectedLoss/1000}%"></i></div><dl><div><dt>Reserve after decision</dt><dd>${usd(o.reserve)}</dd></div><div><dt>Merchant backing if recovery fails</dt><dd>${usd(o.recoverable)}</dd></div><div><dt>PayPal loss if recovery fails</dt><dd class="downside">${usd(o.failureLoss)}</dd></div><div><dt>Expected future payment contribution</dt><dd>${usd(o.expectedContribution)}</dd></div></dl><p class="micro">${candidate?m.release.feasible?`Assumed success ${p}%; assumed failure ${100-p}%. A failed replacement payment is unrecoverable.`:'The proposed route is infeasible. Effective recovery chance is 0% despite the slider input.':'No replacement purchase. All four already-paid orders are assumed cancelled. $1,000 refunds − $300 merchant funds.'}</p></article>`;
  $('comparison-options').innerHTML=option('Keep $200 reserve',m.hold,false)+option('Release $60',m.release,true);
  $('net-benefit').classList.toggle('bad',m.netBenefit<0);
  $('net-benefit').innerHTML=`<div><span>Modeled net benefit of release versus hold</span><strong>${signed(m.netBenefit)}</strong></div><p>${usd(Math.abs(m.avoidedExpectedLoss))} ${m.avoidedExpectedLoss>=0?'less':'more'} expected uncovered refunds; ${usd(m.incrementalContribution)} conditional future contribution.<br><b>Failure downside: ${usd(m.extraFailureLoss)} more uncovered refunds than keeping the reserve.</b></p>`;
  $('calculation').innerHTML=`<p><b>Hold:</b> $1,000 eligible refunds − ($100 available + $200 reserve) = $700 uncovered.</p><p><b>Release, failure:</b> $1,000 refunds − ($300 original backing − $160 supplier spend) = $860 uncovered.</p><p><b>Release, expected:</b> ${100-m.release.successBps/100}% failure × $860 + ${m.release.successBps/100}% success × $0 = ${usd(m.release.expectedLoss)}.</p><p><b>Future contribution:</b> ${m.release.successBps/100}% success × ${usd(world.assumptions.futureVolume)} new volume × ${world.assumptions.netContributionBps/100}% assumed net contribution = ${usd(m.incrementalContribution)}. The existing $1,000 cohort earns no additional fee in this calculation.</p><p><b>Break-even:</b> approximately ${(m.breakEvenBps/100).toFixed(1)}% recovery success for a positive net benefit. The separate protection rule requires lower expected uncovered refunds (above ${(m.lossBreakEvenBps/100).toFixed(1)}%), current evidence and the downside limit. No real-world probability or loss model was estimated.</p>`;
}
function renderJournal(){
  $('journal').innerHTML=[...world.events].reverse().map((e,i)=>`<div class="journal-entry"><span>${String(world.events.length-i).padStart(2,'0')}</span><div><small>${escape(e.actor)} · T+${Math.floor(e.at)}s</small><h3>${escape(e.type)}</h3><p>${escape(e.detail)}</p></div></div>`).join('');
}
function frame(time){
  const dt=previousTime?Math.min((time-previousTime)/1000,.1):0;previousTime=time;
  if(!hidden){tick(world,dt,view.reduced());view.draw(world);render();$('world-clock').textContent=`T+${String(Math.floor(world.time/60)).padStart(2,'0')}:${String(Math.floor(world.time%60)).padStart(2,'0')}`;}
  requestAnimationFrame(frame);
}
render(true);resize();requestAnimationFrame(frame);
