import {createGarden} from './world.mjs';
import {worker,coinSprite,couponSprite} from './office-scene.mjs';
import {esc,money} from './ui.mjs';
const $=id=>document.getElementById(id),r=await(await fetch('/data/marketing-story.json')).json();
let index=0,timer=null;
const garden=createGarden($('md-world'),{onCustomer:()=>{},onMerchant:()=>{},onTeam:()=>{},onPayments:()=>{}});
const roles=[['Analyst','Finds the opportunity','#cda45c'],['Campaign agent','Builds the campaign','#8a7fa9'],['Reviewer','Challenges the proposal','#619b8c']];
$('md-team').innerHTML=roles.map(([name,duty,color],i)=>`<div class="pl-agent"><span class="pl-badge">GEMINI</span>${worker(color,i)}<b>${name}</b><small>${duty}</small><i></i></div>`).join('');
const evidence=r.growth.input.packet,p=r.science.output,v=r.review.output,buyer=r.purchase;
const steps=[
 {name:'Customers shop',day:29,role:null,title:'The market creates the data.',tag:'Market + warehouse',body:`<p>Shoppers browse products and buy from the stores. Those visits, offers and purchases become warehouse records.</p><p>The team starts its first review after <b>30 days of observations</b>.</p>`,note:'Warmup offers were randomized to collect response data. They were not agent campaigns.'},
 {name:'Analyst investigates',day:r.growth.day,role:0,title:'“What changed in the market?”',tag:'Agent 1 · analyst',body:`<p>The analyst sees <b>${evidence.recentPurchases} purchases</b> in the latest week versus <b>${evidence.previousPurchases}</b> before it.</p><p>It chooses the <b>offer-response analysis</b> and passes a campaign hypothesis to the next agent.</p>`,record:r.growth,note:'The hypothesis is a question to investigate, not an established cause.'},
 {name:'Campaign agent plans',day:r.model.day,role:1,title:'The campaign agent proposes an offer.',tag:'Agent 2 · campaign design',body:`<p>It proposes recommendations and coupons across <b>${p.merchantIndices.length} stores</b>, with a <b>${p.maxOfferPct}% campaign ceiling</b>.</p><p>It also requests a local model fit using <b>${r.model.training_rows.toLocaleString()} mature observations</b>.</p><div class="md-pill">Real local training · requested by Gemini</div>`,record:r.science,note:'The campaign ceiling cannot override a merchant’s own discount limit.'},
 {name:'Reviewer changes it',day:r.publish.output.policy.effectiveDay,role:2,title:'The reviewer changes the proposal.',tag:'Agent 3 · independent review',body:`<p>The reviewer checks merchant limits and model validation, then narrows the campaign before it can be published.</p><div class="md-change"><span>${p.maxOfferPct}%</span><b>→</b><span>${v.maxOfferPct}% coupon ceiling</span></div><p>Exploration also changes from <b>${Math.round(p.epsilon*100)}%</b> to <b>${Math.round(v.epsilon*100)}%</b>.</p>`,record:r.review,note:`The code executor publishes the accepted settings on day ${r.publish.output.policy.effectiveDay}.`},
 {name:'Shopper gets a coupon',day:buyer.issued_day,role:null,title:`${esc(buyer.customerName)} receives a coupon.`,tag:'Campaign execution · code',body:`<p>The approved campaign reaches an individual simulated shopper.</p><div class="md-change"><span>${buyer.discount_pct}% off</span></div><p><b>${esc(buyer.merchant_name)}</b><br>${esc(buyer.title)}</p>`,note:'Coupon eligibility and delivery are executed by code under the approved campaign.'},
 {name:'Purchase is recorded',day:buyer.issued_day,role:null,title:'The shopper redeems it and buys.',tag:'Shopper → order → warehouse',body:`<p>${esc(buyer.customerName)} uses the coupon and pays <b>${money(buyer.total_cents)}</b> in the simulation.</p><div class="md-order"><b>${esc(buyer.title)}</b><span>Channel3 product linked to the order</span><code>${esc(buyer.channel3_product_id)}</code><b>Paid · simulated transaction</b><code>${esc(buyer.transaction_id)}</code></div>`,note:'This demonstrates the workflow, not proven financial uplift. Full results remain available below.'}
];
function stop(){clearInterval(timer);timer=null;$('md-play').textContent='▶ Play demo';}
function render(){
 const s=steps[index],frame=structuredClone(r.frames[index]);frame.replayTick=index;frame.simTime=null;
 if(index>=4){const person=frame.customers.find(c=>c.id===buyer.customer_id);person.lastAction=index===4?'coupon':'redeem';person.lastMerchant=buyer.merchant_id;person.coupon={id:buyer.coupon_id,pct:buyer.discount_pct,day:buyer.issued_day,status:index===4?'DELIVERED':'REDEEMED'};}
 garden.setFrame(frame);garden.setNamesVisible($('md-names').checked);garden.setPaused(false);
 $('md-day').textContent=index===0?'Days 1–30 · shopping history':`Day ${s.day} · recorded highlight`;
 $('md-card').innerHTML=`<span class="md-pill">${s.tag}</span><h2>${s.title}</h2>${s.body}<p class="md-note">${s.note}</p>${s.record?`<details><summary>View the actual saved agent decision</summary><pre>${esc(JSON.stringify(s.record.output,null,2))}</pre></details>`:''}`;
 $('md-team').querySelectorAll('.pl-agent').forEach((el,i)=>{el.classList.toggle('is-working',i===s.role);el.classList.toggle('is-selected',i===s.role);});
 $('md-stats').innerHTML=[['Market purchases',frame.stats.orders.toLocaleString()],['Agent roles','3'],['Current step',`${index+1} / ${steps.length}`]].map(([name,value])=>`<div><b>${value}</b><small>${name}</small></div>`).join('');
 $('md-source').innerHTML=index===5?`<strong>PayPal Sandbox connection verified</strong><br>Existing capture ${esc(r.referenceReceipt?.capture_id||'available in the full run')} is a prior integration reference. This shopper’s order is simulated.`:'<strong>Channel3 catalog → campaign → shopper events</strong><br>Real cached product listings. Simulated customers, stock and purchases.';
 $('md-steps').innerHTML=steps.map((step,i)=>`<li><button data-step="${i}" ${i===index?'aria-current="step"':''}><small>${i+1}</small>${step.name}</button></li>`).join('');
 $('md-progress').textContent='Recorded playback · no new charges';$('md-back').disabled=index===0;$('md-next').disabled=index===steps.length-1;
 $('md-details').href='/mesh.html?policyLab='+encodeURIComponent(r.runId);
 $('md-fx').innerHTML=index>=4?`<span class="md-bubble">${index===4?couponSprite:coinSprite}<b>${index===4?buyer.discount_pct+'% coupon':money(buyer.total_cents)}</b></span>`:'';
 for(const button of $('md-steps').querySelectorAll('button'))button.onclick=()=>{stop();index=Number(button.dataset.step);render();window.scrollTo({top:0,behavior:'instant'});};
}
$('md-play').onclick=()=>{if(timer){stop();return;}if(index===steps.length-1)index=0;render();$('md-play').textContent='Ⅱ Pause demo';timer=setInterval(()=>{if(document.hidden){stop();return;}index++;render();if(index===steps.length-1)stop();},5500);};
$('md-back').onclick=()=>{stop();index=Math.max(0,index-1);render();window.scrollTo({top:0,behavior:'instant'});};$('md-next').onclick=()=>{stop();index=Math.min(steps.length-1,index+1);render();window.scrollTo({top:0,behavior:'instant'});};$('md-names').onchange=()=>garden.setNamesVisible($('md-names').checked);
render();
