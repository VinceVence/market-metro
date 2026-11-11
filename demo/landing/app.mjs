const views={
 market:{image:'market.jpg',alt:'Actual Market Metro judge demo at day one, with twelve shops and the campaign walkthrough.',caption:'Start at day 1. Follow one recorded campaign from observation to outcome.',href:'/judge.html',link:'Open the market'},
 ontology:{image:'ontology.jpg',alt:'Actual merchant ontology graph connecting shoppers, checkouts, merchant orders, training data and payments.',caption:'Connect identities and money units. Count split baskets once. Hold ambiguous mappings.',href:'/analytics.html?run=judge-demo&view=ontology',link:'Explore the ontology'},
 agent:{image:'agent-studio.jpg',alt:'Actual AG Studio workspace after a verified merchant investigation, showing the planner, checks and published insights.',caption:'The Studio planner chooses a cohort. The ontology verifies it. The insight editor publishes supported views.',href:'/agent-studio.html',link:'Open Agent Studio'},
 paypal:{image:'paypal.jpg',alt:'Actual PayPal evidence view showing the completed 96-dollar Sandbox purchase, 3.56-dollar fee and 92.44-dollar merchant proceeds.',caption:'A completed Sandbox capture linked to an existing order. Test funds, with no duplicate sale.',href:'/analytics.html?run=judge-demo&view=payments',link:'View the receipt'}
};
const tabs=[...document.querySelectorAll('[data-view]')],panel=document.getElementById('evidence-panel');
function select(tab){
 const view=views[tab.dataset.view];
 for(const item of tabs){item.setAttribute('aria-selected',String(item===tab));item.tabIndex=item===tab?0:-1;}
 panel.setAttribute('aria-labelledby',tab.id);
 const image=document.getElementById('evidence-image');image.src='/landing/assets/'+view.image;image.alt=view.alt;
 document.getElementById('evidence-caption').textContent=view.caption;
 const link=document.getElementById('evidence-link');link.href=view.href;link.textContent=view.link+' ↗';
}
for(const [i,tab] of tabs.entries()){
 tab.addEventListener('click',()=>select(tab));
 tab.addEventListener('keydown',event=>{
  const next=event.key==='ArrowRight'?(i+1)%tabs.length:event.key==='ArrowLeft'?(i+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:null;
  if(next===null)return;event.preventDefault();select(tabs[next]);tabs[next].focus();
 });
}

// Saved frame only: animation is presentation, with no economic ticks or provider calls.
async function mountMarket(){
 const host=document.getElementById('hero-market');let garden;
 try{
  const [{createGarden},response]=await Promise.all([import('../garden/world.mjs'),fetch('/data/judge-reactivation.json')]);
  if(!response.ok)throw Error('Saved scene unavailable');
  const data=await response.json();garden=createGarden(host,{autoFit:true,transparent:true,paymentLabel:'PayPal Sandbox'});
  if(host.dataset.renderState!=='ready'){garden.destroy();return;}
  garden.setFrame({...data.frames[35],visibleCustomerLimit:24});garden.setNamesVisible(false);garden.home();
  garden.setPaused(matchMedia('(prefers-reduced-motion: reduce)').matches);
  host.querySelector('canvas').tabIndex=-1;host.parentElement.classList.add('ready');
  window.addEventListener('pagehide',event=>{if(!event.persisted)garden.destroy();},{once:true});
 }catch{garden?.destroy();/* The saved environment image remains visible. */}
}
mountMarket();
