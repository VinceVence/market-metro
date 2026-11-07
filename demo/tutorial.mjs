const SEEN_KEY='market-metro-navigation-tour-v1';
const icons={market:'<path d="M3 10h18M4 10v11h16V10M3 10l2-7h14l2 7M9 21v-7h6v7"/>',agent:'<rect x="5" y="5" width="14" height="14" rx="3"/><path d="M9 1v4m6-4v4M9 19v4m6-4v4M1 9h4m-4 6h4m14-6h4m-4 6h4M9 10h6m-6 4h4"/>',payment:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18m-13 5h4"/>'};
const symbol=(name)=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
/** A local navigation guide. Callbacks only select existing views; they never start jobs. */
export function mountTutorial({steps,onStart=()=>{},onClose=()=>{},auto=true}){
 const dialog=document.createElement('dialog');dialog.className='page-tour';dialog.setAttribute('aria-labelledby','tour-title');dialog.setAttribute('aria-describedby','tour-copy');dialog.setAttribute('aria-modal','false');
 dialog.innerHTML=`<header class="tour-head"><span>MARKET METRO · QUICK TOUR</span><button type="button" class="tour-close" aria-label="Close tutorial">×</button></header><div class="tour-route" aria-hidden="true"><span>${symbol('market')}<b>Market</b></span><i>→</i><span>${symbol('agent')}<b>Agent</b></span><i>→</i><span>${symbol('payment')}<b>PayPal</b></span></div><div class="tour-text" aria-live="polite"><small id="tour-count"></small><h2 id="tour-title"></h2><p id="tour-copy"></p></div><nav class="tour-dots" aria-label="Tutorial steps"></nav><a class="tour-action" hidden></a><footer class="tour-footer"><button class="tour-skip" type="button">Skip tour</button><span></span><button class="tour-back" type="button">Back</button><button class="tour-next primary" type="button">Start tour →</button></footer>`;
 document.body.append(dialog);let index=0,target=null,opener=null;
 const q=s=>dialog.querySelector(s);
 steps.forEach((step,i)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',`Step ${i+1}: ${step.title}`);b.onclick=()=>show(i);q('.tour-dots').append(b);});
 function clearTarget(){target?.classList.remove('tour-target');target=null;}
 function show(next){
  clearTarget();index=Math.max(0,Math.min(steps.length-1,next));const step=steps[index];step.enter?.();
  dialog.classList.toggle('tour-welcome',index===0);q('#tour-title').textContent=step.title;q('#tour-copy').textContent=step.body;q('#tour-count').textContent=`${index+1} / ${steps.length}`;
  q('.tour-back').hidden=index===0;q('.tour-next').textContent=index===0?'Start tour →':index===steps.length-1?'Finish tour':'Next →';
  q('.tour-dots').querySelectorAll('button').forEach((b,i)=>{b.setAttribute('aria-current',i===index?'step':'false');b.classList.toggle('done',i<index);});
  const link=q('.tour-action');link.hidden=!step.action;if(step.action){link.textContent=step.action.label;link.href=typeof step.action.href==='function'?step.action.href():step.action.href;}
  if(step.target){target=document.querySelector(step.target);if(target){target.classList.add('tour-target');target.scrollIntoView({block:'nearest',inline:'nearest'});}}
 }
 function close(reason='close'){if(!dialog.open)return;dialog.close();clearTarget();try{localStorage.setItem(SEEN_KEY,'seen');}catch{}onClose(reason);if(reason!=='navigate'&&opener?.isConnected)opener.focus?.();}
 function open(){if(dialog.open)return;if(document.querySelector('dialog[open]'))return;opener=document.activeElement;onStart();show(0);dialog.show();try{localStorage.setItem(SEEN_KEY,'seen');}catch{}}
 q('.tour-close').onclick=()=>close();q('.tour-skip').onclick=()=>close('skip');q('.tour-back').onclick=()=>show(index-1);q('.tour-next').onclick=()=>index===steps.length-1?close('finish'):show(index+1);
 document.addEventListener('click',e=>{if(dialog.open&&!dialog.contains(e.target)&&!e.target.closest('[data-tour-open]')&&e.target.closest('button,a,summary,input,select'))close('navigate');},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&dialog.open){e.preventDefault();close();}});
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('keydown',e=>{if(e.key==='ArrowRight'&&index<steps.length-1){e.preventDefault();show(index+1);}else if(e.key==='ArrowLeft'&&index>0){e.preventDefault();show(index-1);}});
 for(const b of document.querySelectorAll('[data-tour-open]')){b.disabled=false;b.addEventListener('click',open);}
 const url=new URL(location.href),forced=url.searchParams.get('tutorial')==='1';let seen=false;try{seen=localStorage.getItem(SEEN_KEY)==='seen';}catch{}
 if(forced){url.searchParams.delete('tutorial');history.replaceState(null,'',url);}
 if(forced||auto&&!seen)open();
 return {open,close};
}
export function continueTutorial(href){const url=new URL(href,location.href);url.searchParams.set('tutorial','1');return url.pathname+url.search+url.hash;}
