import {SHIFTS,total} from './network.mjs';
import {createComparison,startComparisonShift,tickComparison,comparisonMetrics,benefitBreakdown,exportComparison} from './paired-comparison.mjs';
import {drawWorker,drawVan,rounded,label} from './yard-art.mjs';
const $=id=>document.getElementById(id),money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(n/100),signed=n=>(n>0?'+':'')+money(n);
let pair=createComparison(),selected='M001',stamp='',previous=0;
const portraits=new Map(),sideNames=['fixed','agents'];
function face(id){if(!portraits.has(id)){const canvas=document.createElement('canvas');canvas.width=48;canvas.height=64;const c=canvas.getContext('2d');c.translate(24,62);drawWorker(c,0,0,id,'merchant');portraits.set(id,canvas.toDataURL('image/png'));}return portraits.get(id);}
const contexts=sideNames.map(name=>{const canvas=$(name+'-flow');canvas.width=1200;canvas.height=108;const c=canvas.getContext('2d');c.scale(2,2);return c;});
function stateOf(m){return !m.active?'left':!m.acceptNew?'paused':'open';}
function attempt(fn){try{$('error').textContent='';fn();render(true);}catch(e){$('error').textContent=e.message;}}
function fresh(settings=pair.settings){pair=createComparison(settings);selected='M001';stamp='';render(true);}
$('run').addEventListener('click',()=>attempt(()=>{if(pair.phase==='complete')fresh();pair.auto=true;startComparisonShift(pair);}));
$('step').addEventListener('click',()=>attempt(()=>{pair.auto=false;startComparisonShift(pair);}));
$('pause').addEventListener('click',()=>{pair.paused=!pair.paused;render(true);});
$('speed').addEventListener('click',()=>{pair.speed=pair.speed===1?2:1;render(true);});
$('assumptions-open').addEventListener('click',()=>{$('assumptions').open=true;$('assumptions').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});
$('settings-form').addEventListener('submit',e=>{e.preventDefault();attempt(()=>{fresh({count:Number($('setting-count').value),seed:Number($('setting-seed').value),feeBps:Math.round(Number($('setting-fee').value)*100),processingCostBps:Math.round(Number($('setting-processing').value)*100),refundFeeReturnBps:Number($('setting-returns').value),reviewCostPerMerchant:Math.round(Number($('setting-review').value)*100),churnScaleBps:Number($('setting-churn').value)});$('assumptions').open=false;$('verdict-box').scrollIntoView({behavior:'instant',block:'start'});});});
$('merchant-select').addEventListener('change',()=>{selected=$('merchant-select').value;render(true);});
$('export').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(exportComparison(pair),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`supply-yard-paired-seed-${pair.settings.seed}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
function selectMerchant(id){selected=id;$('merchant-inspection').open=true;render(true);$('merchant-inspection').scrollIntoView({behavior:'instant',block:'nearest'});}
function statsRow(name,value){return `<div><dt>${name}</dt><dd>${value}</dd></div>`;}
function render(force=false){
  const key=[pair.phase,pair.paused,pair.speed,pair.auto,pair.rounds.length,selected,...pair.worlds.flatMap(w=>[w.phase,w.events.length])].join('|');if(!force&&key===stamp)return;stamp=key;
  const metrics=pair.worlds.map(comparisonMetrics),[fixed,agents]=metrics,delta=benefitBreakdown(pair),settings=pair.settings,running=pair.phase==='running',settled=['between','complete'].includes(pair.phase),shift=pair.worlds[0].shift;
  $('shared-settings').textContent=`${settings.count} merchants each · seed ${settings.seed} · assumed fees ${settings.feeBps/100}% · processing ${settings.processingCostBps/100}% · churn ${settings.churnScaleBps/10000}× · review ${money(settings.reviewCostPerMerchant)}/merchant/shift`;
  $('matching-status').textContent=pair.audit.length?`${pair.audit.length}/3 shocks checked · matched potential demand and keyed draws`:'Matched starting wallets · independent ledgers';
  $('shared-shock').textContent=shift<0?'Supplier outage → freight price shock → demand surge':`SHARED SHOCK ${shift+1}/3 · ${SHIFTS[shift].name} · ${pair.audit.at(-1).potentialUnits} potential kits per world · ${pair.audit.at(-1).stock} supplier kits · ${money(SHIFTS[shift].price)} restock price`;
  const verdict=$('verdict-box');verdict.classList.toggle('ahead',settled&&delta.total>0);verdict.classList.toggle('behind',settled&&delta.total<0);
  $('verdict-label').textContent=settled?`Agent net benefit versus fixed · through shift ${pair.rounds.length}`:'Agent net benefit versus fixed';
  $('net-benefit').textContent=settled?signed(delta.total):running?`Comparing shock ${shift+1}…`:'Ready to compare';
  $('verdict-detail').textContent=settled?`${delta.total>0?'The agent policy has higher modeled net contribution.':delta.total<0?'The fixed reference has higher modeled net contribution.':'Both policies have equal modeled net contribution.'} ${fixed.net<0&&agents.net<0?'Both worlds still lose money. ':''}Fixed: ${money(fixed.net)}. Agents: ${money(agents.net)}. This is a ${pair.rounds.length}-shift synthetic result.`:running?'Deliveries, refunds and churn are still settling. The net-benefit verdict updates only after both worlds close the same shift.':'Net contribution = fees kept − processing cost − PayPal refund coverage − agent review cost.';
  const stateNames={ready:'Ready',orders:'Capturing payments',observe:'Evaluating',debate:'Evaluating',review:'Policy ready',delivery:'Delivering',settled:'Shift settled'};
  pair.worlds.forEach((w,i)=>{
    const prefix=sideNames[i],m=metrics[i];$(prefix+'-state').textContent=(w.shift<0?'':`Shift ${w.shift+1} · `)+stateNames[w.phase];
    $(prefix+'-merchants').innerHTML=w.merchants.map(merchant=>`<button class="merchant-token ${stateOf(merchant)}" data-merchant="${merchant.id}" aria-pressed="${merchant.id===selected}" aria-label="${merchant.name}: ${!merchant.active?'left after shift '+merchant.churnedAt:!merchant.acceptNew?'payments paused':'payments open'}. Inspect both policies." title="${merchant.name}"><img src="${face(merchant.id)}" alt=""><small>${merchant.id}</small></button>`).join('');
    $(prefix+'-net').textContent=money(m.net);$(prefix+'-net').classList.toggle('negative',m.net<0);
    $(prefix+'-stats').innerHTML=statsRow('Fees kept',money(m.netFees))+statsRow('PayPal refund coverage',money(m.coverage))+statsRow('Merchants remaining',`${m.active} / ${w.count}`);
    $(prefix+'-flow').setAttribute('aria-label',`${prefix==='fixed'?'Fixed':'Agent'} policy: ${m.delivered} kits delivered so far. ${m.churned} merchants left; ${m.paused} remaining merchants have paused payments.`);
  });
  document.querySelectorAll('[data-merchant]').forEach(b=>b.addEventListener('click',()=>selectMerchant(b.dataset.merchant)));
  const rows=[
    ['Fees collected',fixed.feesCollected,agents.feesCollected,agents.feesCollected-fixed.feesCollected],
    ['Fee credits returned',fixed.feesReturned,agents.feesReturned,fixed.feesReturned-agents.feesReturned],
    ['Processing cost',fixed.processingCost,agents.processingCost,delta.processing],
    ['PayPal refund coverage',fixed.coverage,agents.coverage,delta.coverage],
    ['Agent review cost',fixed.agentCost,agents.agentCost,delta.agentCost],
    ['Net contribution',fixed.net,agents.net,delta.total,'total'],
    ['Captured payment volume',fixed.captured,agents.captured,null,'secondary-metric'],
    ['Potential volume lost after churn',fixed.lostChurnGMV,agents.lostChurnGMV,null,'secondary-metric'],
    ['Requests not charged: payment pauses',fixed.blockedGMV,agents.blockedGMV,null,'secondary-metric']
  ];
  $('accounting-rows').innerHTML=rows.map(([label,f,a,effect,cls=''])=>`<tr class="${cls}"><th scope="row">${label}</th><td>${money(f)}</td><td>${money(a)}</td><td class="${effect===null?'neutral':effect>0?'positive':effect<0?'negative':'neutral'}">${effect===null?'Included through volume':signed(effect)}</td></tr>`).join('')+`<tr class="secondary-metric"><th scope="row">Merchants who left</th><td>${fixed.churned}</td><td>${agents.churned}</td><td>Future volume stops</td></tr><tr class="secondary-metric"><th scope="row">Kits delivered</th><td>${fixed.delivered}</td><td>${agents.delivered}</td><td>Service outcome</td></tr>`;
  $('round-rows').innerHTML=SHIFTS.map((shock,i)=>{const row=pair.rounds[i];return `<tr><th scope="row">${i+1}. ${shock.name}</th><td>${row?money(row.cumulative[0].net):'—'}</td><td>${row?money(row.cumulative[1].net):'—'}</td><td class="${row?.benefit>0?'positive':row?.benefit<0?'negative':'neutral'}">${row?signed(row.benefit):'—'}</td><td>${row?row.cumulative[0].active+' / '+row.cumulative[1].active:'—'}</td></tr>`;}).join('');
  $('pause').disabled=['ready','complete'].includes(pair.phase);$('pause').textContent=pair.paused?'Resume both':'Pause both';$('speed').textContent=pair.speed+'×';
  $('run').disabled=running;$('run').textContent=pair.phase==='complete'?'Replay both policies →':pair.phase==='between'?'Run remaining shocks →':running?'Comparison running…':'Run paired comparison →';
  $('step').disabled=running||pair.phase==='complete';$('step').textContent=pair.phase==='between'?'Step next shock':'Step one shock';
  $('export').disabled=!pair.rounds.length||running;
  $('replay-status').textContent=pair.phase==='complete'?'Three matched shocks complete':running?`Both worlds resolving ${SHIFTS[shift].name}`:pair.phase==='between'?`Shift ${pair.rounds.length} closed${pair.auto?' · next shared shock follows':''}`:`${settings.count} merchants · 3 shared shocks`;
  $('merchant-select').innerHTML=pair.worlds[0].merchants.map(m=>`<option value="${m.id}"${m.id===selected?' selected':''}>${m.name}</option>`).join('');
  $('merchant-detail').innerHTML=pair.worlds.map((w,i)=>{const m=w.merchants.find(m=>m.id===selected),check=m.lastChurn,orders=w.orders.filter(o=>o.merchant===m.id);return `<article><h3>${i===0?'Fixed reference':'Agent policy'} · ${m.name}</h3><p>${!m.active?'Left after shift '+m.churnedAt:m.acceptNew?'Still active; payments open.':'Still active; payments paused.'}</p><p>Cash ${money(m.cash)} · reserve ${money(m.reserve)}${m.active?` · next reserve ${m.rate/100}%`:" · closed account"}.</p><p>${total(orders,'delivered')} kits delivered; ${money(total(orders,o=>o.fee-o.feeReturned))} fees kept across this merchant’s captures.</p>${check?`<p>Last churn check: shift ${check.shift}. ${check.due?`${check.delivered}/${check.due} paid kits delivered`:"No paid orders"}; ${check.reserveRate/100}% reserve; payment pause ${check.paymentPaused?"factored in":"absent"}. Authored chance ${check.probabilityBps/100}%; keyed draw ${check.draw/100}%. ${check.left?'Draw below chance: merchant left.':'Draw did not trigger departure.'}</p>`:'<p>No churn assessment yet, or churn is disabled.</p>'}</article>`;}).join('');
  if(settled)$('live-result').textContent=`Shift ${pair.rounds.length} settled in both worlds. Fixed net ${money(fixed.net)}; agent net ${money(agents.net)}. Agent benefit ${signed(delta.total)}. Merchants remaining ${fixed.active} fixed, ${agents.active} agents.`;
}
function flow(c,w){
  c.clearRect(0,0,600,54);c.strokeStyle='#c1d2db';c.lineWidth=2;c.beginPath();c.moveTo(35,23);c.lineTo(563,23);c.stroke();
  for(const x of [35,290,563])rounded(c,x-10,15,20,17,3,'#b7cbd4');
  label(c,'WAREHOUSE',13,47,8,'#8ba0aa');label(c,'PACK & DISPATCH',253,47,8,'#8ba0aa');label(c,'OFFICES',545,47,8,'#8ba0aa');
  if(w.phase==='orders'){const t=Math.min(1,(w.time-w.phaseAt)/3),x=563-(563-35)*t;rounded(c,x-5,17,10,11,2,'#4b91b3');}
  for(const d of w.shipments){
    if(d.stage==='complete'||d.delay>0)continue;
    const x=d.stage==='pickup'?290-255*d.progress:d.stage==='merchant'?35+255*d.progress:d.stage==='packing'?290:290+273*d.progress,y=15+(d.group%3)*7;
    c.save();c.translate(x,y);c.scale(.32,.32);drawVan(c,0,0,d.stage==='pickup'?'left':'right',d.stage!=='pickup');c.restore();
  }
}
document.addEventListener('visibilitychange',()=>{previous=0;});
function frame(t){const dt=previous?Math.min(.1,(t-previous)/1000):0;previous=t;if(!document.hidden){tickComparison(pair,dt);pair.worlds.forEach((w,i)=>flow(contexts[i],w));render();}requestAnimationFrame(frame);}
render(true);requestAnimationFrame(frame);
