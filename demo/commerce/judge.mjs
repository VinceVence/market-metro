import {mountTutorial,continueTutorial} from '../tutorial.mjs';
import {createGarden} from '../garden/world.mjs';
import {esc,money} from '../garden/ui.mjs';
import {bindMerchantScale} from './merchant-scale.mjs';
import {bindFeedProof} from './feed-proof.mjs';
import {bindPlannerReview} from './planner-review.mjs';
import {bindTrainingReview} from './training-review.mjs';
import {judgeStory} from './judge-story.mjs';

const $=id=>document.getElementById(id);
const groups=[['market','Market',0],['workflow','Agent decisions',1],['performance','Impact',4]];

async function start(){
  const response=await fetch('/data/judge-reactivation.json');if(!response.ok)throw Error('Recorded campaign unavailable.');
  const d=await response.json(),r=d.receipt,s=d.shopper;
  if(r?.status!=='COMPLETED'||r.source!=='PAYPAL_SANDBOX'||r.currency!=='USD'||!r.capture_id||
    r.run_id!==d.runId||r.order_id!==s.orderId||r.merchant_id!==s.merchantId||r.gross_cents!==s.grossCents||
    r.fee_cents+r.net_cents!==r.gross_cents)throw Error('The saved receipt does not match this campaign order.');
  const steps=judgeStory(d);let i=0,timer=null;
  if(!['#scale','#ontology','#planner','#training','#livecampaign'].includes(location.hash))history.replaceState(null,'',location.pathname+location.search);
  const hashes=steps.map(s=>s.hash);
  const garden=createGarden($('world'),{night:true,autoFit:true,paymentLabel:'PayPal Sandbox',onCustomer:id=>{if(id===s.id)go(3);},
    onTeam:()=>go(1),onPayments:()=>go(5)});
  $('market-meta').textContent='One saved campaign · 12 merchants · 600 shoppers · Seed '+d.seed;
  $('chapters').innerHTML=groups.map(([phase,label,n],index)=>`<button type="button" data-phase="${phase}" data-chapter="${n}"><b>${index+1}</b>${label}</button>`).join('');
  const buttons=[...$('chapters').querySelectorAll('button')];
  function render(){
    const step=steps[i],frame=d.frames[step.day];
    $('source').textContent=step.source;$('heading').textContent=step.title;$('content').innerHTML=step.body;
    $('market-day').textContent='Market day '+step.day;
    $('frame-note').textContent=i===3?s.merchant+' · '+money(s.grossCents)+' simulated checkout':frame.orders.toLocaleString()+' checkouts since day 1';
    buttons.forEach(b=>{if(b.dataset.phase===step.phase)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
    $('back').disabled=i===0;$('next').disabled=false;$('next').textContent=i===steps.length-1?'Replay from Day 1':i===steps.length-2?'Show PayPal receipt →':'Next →';
    $('position').textContent=(i+1)+' / '+steps.length+' · '+step.label;
    if($('world').dataset.renderState==='unavailable'){
      $('world').hidden=true;$('flat-market').hidden=false;
      $('flat-market').innerHTML=frame.merchants.map(m=>`<span>${esc(m.name)}<small>${m.sold} units sold</small></span>`).join('');
      $('names').disabled=true;$('reset-camera').disabled=true;
    }else{
      garden.setFrame(frame);garden.setNamesVisible($('names').checked);garden.setPaused(i===steps.length-1);
      garden.home();if(i===3)garden.focusStation(s.merchantId);
    }
    if(i===steps.length-1)pause();
  }
  function pause(){clearInterval(timer);timer=null;$('playback-status').hidden=true;$('auto').textContent='Play walkthrough';$('auto').setAttribute('aria-pressed','false');}
  function go(n,manual=true){
    if(manual)pause();i=n;history.replaceState(null,'',location.pathname+location.search+(i?'#'+hashes[i]:''));
    render();
  }
  buttons.forEach(b=>b.onclick=()=>go(Number(b.dataset.chapter)));
  $('back').onclick=()=>go(Math.max(0,i-1));$('next').onclick=()=>go((i+1)%steps.length);
  function play(){
    if(timer)return pause();go(0,false);
    $('auto').textContent='Pause walkthrough';$('auto').setAttribute('aria-pressed','true');$('playback-status').hidden=false;
    timer=setInterval(()=>go(Math.min(i+1,steps.length-1),false),8000);
  }
  $('auto').disabled=false;$('auto').onclick=()=>play();
  $('names').onchange=()=>garden.setNamesVisible($('names').checked);$('reset-camera').onclick=()=>garden.home();
  $('chapters').onkeydown=e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();go(Math.max(0,Math.min(steps.length-1,i+(e.key==='ArrowRight'?1:-1))));buttons.find(b=>b.dataset.phase===steps[i].phase)?.focus();}};
  window.addEventListener('pagehide',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  render();
  bindMerchantScale(pause);
  bindFeedProof(pause);
  bindPlannerReview(()=>go(2));
  bindTrainingReview(()=>go(2));
  const autoplay=new URL(location.href).searchParams.get('autoplay')==='1';
  if(autoplay)play(false);
  let tourOrigin=0,tourWasPlaying=false;
  mountTutorial({auto:false,onStart:()=>{tourOrigin=i;tourWasPlaying=Boolean(timer);pause();},onClose:reason=>{go(reason==='finish'?0:tourOrigin);if(tourWasPlaying)play(false);},steps:[
    {title:'A quick guide for the demo',body:'Follow one campaign from market evidence to a PayPal receipt. You can pause the story and inspect any chapter.'},
    {title:'Navigate the campaign chapters',body:'Use the chapter buttons or Next and Back. Play walkthrough advances the recorded story without making new model or payment calls.',target:'#chapters',enter:()=>go(0)},
    {title:'Read what the planner decided',body:'Each chapter labels the source. Open the recorded proposal to inspect the planner’s reasoning and chosen model.',target:'.judge-card',enter:()=>go(2)},
    {title:'Check the native payment proof',body:'Match the capture ID, fee and merchant proceeds. This is an archived PayPal Sandbox receipt using test funds.',target:'.judge-card',enter:()=>go(5)},
    {title:'Explore the evidence yourself',body:'Intelligence has the decision timeline, model registry, financial comparisons and merchant ontology. Finish the tour to return to the campaign.',target:'#judge-intelligence',enter:()=>go(5),action:{label:'Continue in Intelligence →',href:()=>continueTutorial($('judge-intelligence').href)}}
  ]});
}
start().catch(error=>{$('judge-error').textContent=error.message;$('judge-error').hidden=false;});
