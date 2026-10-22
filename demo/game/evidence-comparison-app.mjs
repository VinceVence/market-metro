import {total} from './network.mjs';
import {REVIEW_SHIFTS,savedReceipt,dollars} from './evidence-economy.mjs';
import {createEvidenceComparison,startEvidencePairShift,tickEvidencePair,evidencePairMetrics,evidenceBenefit,exportEvidencePair} from './evidence-comparison.mjs';
import {drawWorker,drawVan,rounded,label} from './yard-art.mjs';
const $=id=>document.getElementById(id),signed=n=>(n>0?'+':'')+dollars(n);
const names={hold:'Full hold',checklist:'Initial feed only',balanced:'Same scripted review'};
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let receipt=null,loading=true,receiptMessage='',pair=createEvidenceComparison(),selected='M001',stamp='',previous=0;
const portraits=new Map(),sides=['fixed','agents'],reduced=matchMedia('(prefers-reduced-motion: reduce)');
function face(id){
  if(!portraits.has(id)){const canvas=document.createElement('canvas');canvas.width=48;canvas.height=64;const c=canvas.getContext('2d');c.translate(24,62);drawWorker(c,0,0,id,'merchant');portraits.set(id,canvas.toDataURL('image/png'));}
  return portraits.get(id);
}
const contexts=sides.map(name=>{const canvas=$(name+'-flow');canvas.width=1200;canvas.height=108;const c=canvas.getContext('2d');c.scale(2,2);return c;});
function attempt(fn){try{$('error').textContent='';fn();render(true);}catch(e){pair.paused=true;$('error').textContent=e.message;}}
function fresh(settings=pair.settings){pair=createEvidenceComparison(settings,receipt);selected='M001';stamp='';render(true);}
async function loadReceipt(){
  try{
    const response=await fetch('/api/paypal/orders',{signal:AbortSignal.timeout(5000)});
    if(!response.ok)throw new Error('Receipt unavailable');
    const data=await response.json();if(!Array.isArray(data.orders))throw new Error('Invalid receipt list');
    receipt=savedReceipt(data.orders);
    receiptMessage=receipt?`Same saved sandbox receipt in both worlds: ${dollars(receipt.receipt.grossCents)} gross · ${dollars(receipt.receipt.feeCents)} fee · ${dollars(receipt.receipt.netCents)} net. Reused as a reference; no new payment.`
      :'Synthetic-only comparison: no eligible saved receipt. No checkout is required to run.';
  }catch{receiptMessage='Saved receipt unavailable. This run uses synthetic payments only; no checkout is attempted.';}
  loading=false;fresh();
}
$('run').addEventListener('click',()=>attempt(()=>{if(pair.phase==='complete')fresh();pair.auto=true;startEvidencePairShift(pair);}));
$('step').addEventListener('click',()=>attempt(()=>{pair.auto=false;startEvidencePairShift(pair);}));
$('pause').addEventListener('click',()=>{pair.paused=!pair.paused;render(true);});
$('speed').addEventListener('click',()=>{pair.speed=pair.speed===1?2:pair.speed===2?4:1;render(true);});
$('assumptions-open').addEventListener('click',()=>{$('assumptions').open=true;$('assumptions').scrollIntoView({behavior:reduced.matches?'instant':'smooth'});});
$('settings-form').addEventListener('submit',event=>{
  event.preventDefault();attempt(()=>{
    fresh({count:Number($('setting-count').value),seed:Number($('setting-seed').value),
      processingCostBps:Math.round(Number($('setting-processing').value)*100),
      reviewCostPerMerchant:Math.round(Number($('setting-review').value)*100),referencePolicy:$('setting-reference').value});
    $('assumptions').open=false;$('verdict-box').scrollIntoView({behavior:'instant',block:'start'});
  });
});
$('merchant-select').addEventListener('change',()=>{selected=$('merchant-select').value;render(true);});
$('export').addEventListener('click',()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(exportEvidencePair(pair),null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=`supply-yard-evidence-pair-${pair.settings.seed}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
function stat(k,v){return `<div><dt>${k}</dt><dd>${v}</dd></div>`;}
function selectMerchant(id){selected=id;$('merchant-inspection').open=true;render(true);$('merchant-inspection').scrollIntoView({behavior:'instant',block:'nearest'});}
function render(force=false){
  const key=[pair.phase,pair.paused,pair.speed,pair.auto,pair.rounds.length,selected,loading,...pair.worlds.flatMap(w=>[w.phase,w.events.length])].join('|');
  if(!force&&stamp===key)return;stamp=key;
  const settings=pair.settings,reference=names[settings.referencePolicy],metrics=pair.worlds.map(w=>evidencePairMetrics(w,settings)),[a,b]=metrics;
  const delta=evidenceBenefit(pair),closed=['between','complete'].includes(pair.phase),running=pair.phase==='running',shift=pair.worlds[0].shift;
  $('receipt-status').textContent=loading?'Loading saved receipt…':receiptMessage;
  $('shared-settings').textContent=`${settings.count} merchants / world · seed ${settings.seed} · 3% generated fee · ${settings.processingCostBps/100}% processing · ${dollars(settings.reviewCostPerMerchant)} / investigated merchant / shift`;
  $('matching-status').textContent=pair.audit.length?`${pair.audit.length}/3 matched order and shock audits`:'Same orders and shocks · independent balances';
  $('verdict-label').textContent=`Reviewed release minus ${reference.toLowerCase()}${closed?` · ${pair.rounds.length} shift${pair.rounds.length>1?'s':''}`:''}`;
  $('net-benefit').textContent=closed?signed(delta.total):running?'Outcomes settling…':'Ready to compare';
  $('verdict-box').classList.toggle('ahead',closed&&delta.total>0);$('verdict-box').classList.toggle('behind',closed&&delta.total<0);
  $('verdict-detail').textContent=closed?`${delta.extraDeliveries} additional kits delivered. ${delta.total>0?'Reviewed release has higher modeled contribution.':delta.total<0?'Reviewed release has lower modeled contribution.':'Direct modeled contribution is equal.'} ${delta.fees===0&&delta.coverage===0?(delta.review===0?'Fees, provider shortfalls and review costs match. ':'Fees and provider shortfalls are identical; the difference is investigation cost. '):''}This is a synthetic outcome, not measured PayPal ROI.`
    :running?'The verdict waits until both worlds close the same shift. Interim fees are not a final profit result.'
    :'Fees − processing cost − provider refund shortfall − review cost. Freed merchant reserves are not PayPal profit.';
  $('fixed-title').textContent=reference;$('reference-column').textContent=reference;
  $('reference-label').textContent=settings.referencePolicy==='balanced'?'CONTROL · IDENTICAL WORKFLOW AND COST':'REFERENCE · SCRIPTED POLICY';
  $('fixed-definition').textContent=settings.referencePolicy==='hold'?'Keep all net proceeds held at review. Refunds consume merchant funds; remaining cash constrains the next restock.'
    :settings.referencePolicy==='checklist'?'Use only initial delivery scans and the same reserve formula. No carrier or office lookups.'
    :'Run exactly the same retrieval, reserve rule and costs as the reviewed side. This control should match exactly.';
  $('shared-shock').textContent=shift<0?'Supplier outage → freight price shock → demand surge'
    :`SHIFT ${shift+1}/3 · ${REVIEW_SHIFTS[shift].name} · ${pair.audit.at(-1).paidUnits} paid kits / world · ${dollars(REVIEW_SHIFTS[shift].price)} restock cost`;
  const stateNames={ready:'Ready',orders:'Orders arriving',delivery:'Vans delivering',debate:'Investigating',review:'Review ready',settling:'Reserve & refunds',settled:'Shift settled'};
  pair.worlds.forEach((w,i)=>{
    const prefix=sides[i],m=metrics[i];
    $(prefix+'-state').textContent=(w.shift<0?'':`Shift ${w.shift+1} · `)+stateNames[w.phase];
    $(prefix+'-merchants').innerHTML=w.merchants.map(merchant=>{
      const status=merchant.settled?(merchant.delivered===merchant.due?'complete':'incomplete'):'waiting';
      return `<button class="merchant-token ${status==='incomplete'?'paused':status==='waiting'?'waiting':''}" data-merchant="${merchant.id}" aria-pressed="${selected===merchant.id}" aria-label="${escape(merchant.name)}: ${merchant.delivered} of ${merchant.due} delivered this shift. Inspect both wallets." title="${escape(merchant.name)}"><img src="${face(merchant.id)}" alt=""><small>${merchant.id}</small></button>`;
    }).join('');
    $(prefix+'-net').textContent=dollars(m.net);$(prefix+'-net').classList.toggle('negative',m.net<0);
    $(prefix+'-stats').innerHTML=stat('Kits delivered',`${m.delivered} / ${m.paid}`)+stat('Fees retained',dollars(m.fees))+stat('Provider shortfall',dollars(m.coverage));
    $(prefix+'-flow').setAttribute('aria-label',`${i? 'Reviewed':reference} supply flow: ${m.delivered} total deliveries. ${w.shipments.filter(v=>v.stage==='complete').length} vans completed this shift.`);
    const speech=w.debate.at(-1);
    $(prefix+'-investigation').textContent=pair.strategies[i]==='balanced'?(w.phase==='debate'?`${speech.role}: ${speech.title}`:`${m.queries} source lookups · ${dollars(m.released)} released from merchant reserves`)
      :`${settings.referencePolicy==='hold'?'Full hold retained at review.':'Initial-feed rule applied.'} No source lookups. ${dollars(m.released)} released.`;
  });
  document.querySelectorAll('[data-merchant]').forEach(button=>button.addEventListener('click',()=>selectMerchant(button.dataset.merchant)));
  $('service-result').textContent=closed?`Service outcome: ${a.delivered} vs ${b.delivered} kits delivered; ${dollars(a.refunds)} vs ${dollars(b.refunds)} total refunds. Most refunds use merchant money and are excluded from provider expense.`
    :'The first shift starts identically. Reserve decisions change cash available for later procurement; they cannot change deliveries that already happened.';
  const rows=[
    ['Fees retained',a.fees,b.fees,delta.fees],
    ['Processing cost',a.processing,b.processing,delta.processing],
    ['Provider-funded refund shortfall',a.coverage,b.coverage,delta.coverage],
    ['Investigation / review cost',a.reviewCost,b.reviewCost,delta.review],
    ['Net contribution',a.net,b.net,delta.total,'total'],
    ['Merchant reserves released',a.released,b.released,null,'secondary-metric'],
    ['All customer refunds',a.refunds,b.refunds,null,'secondary-metric']
  ];
  $('accounting-rows').innerHTML=rows.map(([label,x,y,effect,cls=''])=>`<tr class="${cls}"><th scope="row">${label}</th><td>${dollars(x)}</td><td>${dollars(y)}</td><td class="${effect>0?'positive':effect<0?'negative':'neutral'}">${effect===null?(label==='All customer refunds'?'Provider share counted above':'Merchant-owned transfer'):signed(effect)}</td></tr>`).join('');
  $('round-rows').innerHTML=REVIEW_SHIFTS.map((shock,i)=>{
    const row=pair.rounds[i],r=row?.perShift;
    return `<tr><th scope="row">${i+1}. ${shock.name}</th><td>${r?r[0].delivered+' / '+r[1].delivered:'—'}</td><td>${r?dollars(r[0].fees)+' / '+dollars(r[1].fees):'—'}</td><td>${r?dollars(r[0].net)+' / '+dollars(r[1].net):'—'}</td><td class="${row?.shiftBenefit<0?'negative':'neutral'}">${row?signed(row.shiftBenefit):'—'}</td><td class="${row?.benefit<0?'negative':'neutral'}">${row?signed(row.benefit):'—'}</td></tr>`;
  }).join('');
  $('pause').disabled=['ready','complete'].includes(pair.phase);$('pause').textContent=pair.paused?'Resume both':'Pause both';$('speed').textContent=pair.speed+'×';
  $('run').disabled=loading||running;$('run').textContent=loading?'Loading receipt…':running?'Both worlds running…':pair.phase==='complete'?'Replay all three shifts →':pair.phase==='between'?'Run remaining shifts →':'Run both for 3 shifts →';
  $('step').disabled=loading||running||pair.phase==='complete';$('step').textContent=pair.phase==='between'?'Step next shift':'Step one shift';
  $('export').disabled=!pair.rounds.length||running;
  $('replay-status').textContent=pair.phase==='complete'?'Three matched shifts complete':running?`Both worlds resolving shift ${shift+1}`:pair.phase==='between'?`Shift ${pair.rounds.length} closed${pair.auto?' · next shock follows':''}`:`${settings.count} merchants · 3 shared shifts`;
  $('merchant-select').innerHTML=pair.worlds[0].merchants.map(m=>`<option value="${m.id}"${m.id===selected?' selected':''}>${escape(m.name)}</option>`).join('');
  $('merchant-detail').innerHTML=pair.worlds.map((w,i)=>{
    const m=w.merchants.find(m=>m.id===selected),orders=w.orders.filter(o=>o.merchant===selected),row=w.applied?.rows.find(r=>r.id===selected);
    return `<article><h3>${i?'Reviewed release':reference} · ${escape(m.name)}</h3><p>Cash ${dollars(m.cash)} · reserve ${dollars(m.reserve)}.</p><p>${total(orders,'delivered')} kits delivered; ${dollars(total(orders,'fee'))} fees; ${dollars(total(orders,'refunded'))} customer refunds.</p><p>This shift: ${m.purchased} kits purchased at ${dollars(REVIEW_SHIFTS[w.shift]?.price??0)} each.</p>${row?`<p>Review hold ${dollars(row.before)} → ${dollars(row.held)}; ${dollars(row.release)} released. ${row.verified} delivery proofs used.</p>`:''}</article>`;
  }).join('');
  if(closed)$('live-result').textContent=`${pair.rounds.length} shifts complete. ${a.delivered} reference deliveries; ${b.delivered} reviewed deliveries. Modeled provider benefit ${signed(delta.total)}.`;
}
function flow(c,w){
  c.clearRect(0,0,600,54);c.strokeStyle='#c1d2db';c.lineWidth=2;c.beginPath();c.moveTo(35,23);c.lineTo(563,23);c.stroke();
  for(const x of [35,290,563])rounded(c,x-10,15,20,17,3,'#b7cbd4');
  label(c,'WAREHOUSE',13,47,8,'#8ba0aa');label(c,'PACK & DISPATCH',253,47,8,'#8ba0aa');label(c,'OFFICES',545,47,8,'#8ba0aa');
  if(w.phase==='orders'){const x=563-528*(reduced.matches?.5:Math.min(1,(w.time-w.phaseAt)/3));rounded(c,x-5,17,10,11,2,'#4b91b3');}
  for(const d of w.shipments){
    if(d.stage==='complete'||d.delay>0)continue;
    const progress=reduced.matches?.5:d.progress,x=d.stage==='pickup'?290-255*progress:d.stage==='merchant'?35+255*progress:d.stage==='packing'?290:290+273*progress;
    c.save();c.translate(x,15+(d.group%3)*7);c.scale(.32,.32);drawVan(c,0,0,d.stage==='pickup'?'left':'right',d.stage!=='pickup');c.restore();
  }
}
document.addEventListener('visibilitychange',()=>{previous=0;});
function frame(t){
  const dt=previous?Math.min(.1,(t-previous)/1000):0;previous=t;
  if(!document.hidden){
    try{tickEvidencePair(pair,dt);}catch(e){pair.paused=true;$('error').textContent=e.message;}
    pair.worlds.forEach((w,i)=>flow(contexts[i],w));render();
  }
  requestAnimationFrame(frame);
}
render(true);requestAnimationFrame(frame);loadReceipt();
