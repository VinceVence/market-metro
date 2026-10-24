const plannerName=mode=>mode==='gemini'?'Gemini planner':mode==='chat'?'Chat planner':'Scripted planner';
const roles=[['Coordinator','Gemini planner','#cda45c','plan'],['Business lead','Business analyst','#6b8e9c','chart'],['Data engineer','Data engineer','#619b8c','data'],['Data scientist','Data scientist','#8a7fa9','model'],['Campaign manager','Campaign manager','#be896a','coupon'],['Experiment analyst','Experiment analyst','#7d9364','chart']];
export function worker(color,i){return `<svg viewBox="0 0 142 106" aria-hidden="true"><ellipse cx="71" cy="92" rx="48" ry="9" fill="#273c3f" opacity=".1"/><path d="M44 39Q44 25 71 25Q98 25 98 39V73H44Z" fill="#456068"/><path d="M50 42Q71 34 92 42V79H50Z" fill="#5f7a80"/><rect x="57" y="33" width="28" height="37" rx="10" fill="${color}"/><rect x="64" y="26" width="14" height="12" rx="5" fill="#d6a77f"/><rect x="57" y="5" width="28" height="28" rx="11" fill="${['#dcad87','#ae805e','#c7936e'][i%3]}"/><path d="M57 18V13Q57 2 70 3Q86 0 86 15V20L78 13L60 16V23Z" fill="${i%2?'#493f38':'#795b43'}"/><circle cx="66" cy="21" r="1.5" fill="#34413d"/><circle cx="77" cy="21" r="1.5" fill="#34413d"/><path d="M69 28Q72 30 75 27" stroke="#8c5d49" fill="none"/><path d="M25 58H117L125 83H17Z" fill="#bc986c"/><path d="M17 83H125V90H17Z" fill="#977650"/><path d="M24 90V101M118 90V101" stroke="#52615a" stroke-width="5"/><path d="M29 59H114L119 78H23Z" fill="#e6cfa6"/><rect x="52" y="45" width="40" height="29" rx="3" fill="#263f48"/><rect x="56" y="49" width="32" height="20" rx="1" fill="#b8d5ce"/><path d="M60 63L66 58L72 61L79 54L84 56" stroke="${color}" stroke-width="3" fill="none"/><path d="M67 74V78M59 79H85" stroke="#425955" stroke-width="3"/><g class="jd-hands"><ellipse cx="44" cy="66" rx="7" ry="4" fill="#d7a780"/><ellipse cx="101" cy="67" rx="7" ry="4" fill="#d7a780"/></g><rect x="99" y="75" width="12" height="7" rx="1" fill="#faf5e7"/><path d="M34 65V73H43V65Z" fill="${color}"/><path d="M43 66Q50 66 46 71H43" stroke="${color}" stroke-width="2" fill="none"/></svg>`;}
export function officeMarkup({mode='gemini'}={}){return `<div class="jd-office-scene"><div class="jd-office-wall"><span class="jd-office-window"></span><span>MARKET METRO<br><b>Campaign office</b></span><span class="jd-office-window"></span></div><div class="jd-office-desks">${roles.map(([role,name,color,kind],i)=>`<button type="button" class="jd-desk" data-role="${role}" style="--desk-accent:${color}" aria-label="${role}: ${role==='Coordinator'?(mode==='gemini'?'Gemini planner':'scripted planner'):'local tool worker'}"><span class="jd-worker-badge">${role==='Coordinator'?(mode==='gemini'?'LLM':'RULES'):'TOOL'}</span>${worker(color,i)}<b>${role==='Coordinator'?plannerName(mode):name}</b><small>${role==='Coordinator'?'Chooses the next action':role}</small><i class="jd-desk-light"></i></button>`).join('')}</div><div class="jd-office-bottom"><span class="jd-cabinet">▥ <b>Warehouse</b><small>every event saved</small></span><span class="jd-payment-station" data-role="Payments"><strong>P</strong> PayPal ledger</span><span class="jd-office-plant">♧</span></div><div class="jd-paper-trail" aria-hidden="true">▤</div></div>`;}
export function activateOffice(root,role,busy=false){root.querySelector('.jd-office-scene').dataset.busy=String(busy);for(const desk of root.querySelectorAll('[data-role]'))desk.classList.toggle('is-working',desk.dataset.role===role);root.querySelector('.jd-paper-trail').classList.toggle('moving',busy);}
export const coinSprite=`<svg viewBox="0 0 22 24" aria-hidden="true" shape-rendering="crispEdges"><path d="M6 1H16V3H19V7H21V17H19V21H16V23H6V21H3V17H1V7H3V3H6Z" fill="#9b6428"/><path d="M6 2H15V4H18V7H20V16H18V20H15V22H6V20H4V16H2V8H4V4H6Z" fill="#f1c665"/><path d="M7 5H15V7H17V17H15V19H7V17H5V8H7Z" fill="#d59b3d"/><path d="M10 6H12V8H15V10H9V11H14V13H15V16H12V18H10V16H7V14H13V13H8V11H7V8H10Z" fill="#fff0aa"/><rect x="5" y="5" width="2" height="5" fill="#fff4bf"/></svg>`;
export const couponSprite=`<svg viewBox="0 0 30 22" aria-hidden="true"><path d="M2 2H28V7C23 7 23 15 28 15V20H2V15C7 15 7 7 2 7Z" fill="#f1d7aa" stroke="#ad7e42" stroke-width="2"/><path d="M20 3V19" stroke="#ad7e42" stroke-dasharray="2 2"/><path d="M9 15L15 7" stroke="#6a714d" stroke-width="2"/><circle cx="10" cy="8" r="2" fill="#6a714d"/><circle cx="14" cy="14" r="2" fill="#6a714d"/></svg>`;


const duties={
  Coordinator:'Chooses the campaign',
  'Business lead':'Finds product trends',
  'Data engineer':'Records views & purchases',
  'Data scientist':'Trains prediction models',
  'Campaign manager':'Delivers the campaign',
  'Experiment analyst':'Checks measured results'
};
export function officeState(log,team,completedDays=0){
  const working=team.teamEnabled!==false&&team.clock==='RUNNING';
  const active=working?({ANALYZING:'Business lead',TRAINING:'Data scientist',DECIDING:'Coordinator'}[team.teamStatus]||(completedDays<28?'Data engineer':team.plan?'Campaign manager':null)):null;
  return roles.map(([role])=>({role,active:role===active,duty:duties[role],entry:log.find(row=>row.role===role),badge:role==='Coordinator'?(team.mode==='gemini'?'LLM':team.mode==='chat'?'CHAT':'RULES'):'TOOL'}));
}
export function updateOffice(root,log,team,completedDays=0,selectedRole=null){
  const state=officeState(log,team,completedDays),active=state.find(row=>row.active);
  activateOffice(root,active?.role||null,Boolean(active));
  for(const row of state){
    const desk=root.querySelector('[data-role="'+row.role+'"]');
    desk.querySelector('.jd-worker-badge').textContent=row.badge;
    if(row.role==='Coordinator')desk.querySelector('b').textContent=plannerName(team.mode);
    desk.querySelector('small').textContent=row.active?(row.role==='Data engineer'?'Collecting shopper events':row.role==='Data scientist'?'Training in background':row.role==='Campaign manager'?'Campaign is live':row.duty):row.duty;
    desk.setAttribute('aria-label',row.role+': '+desk.querySelector('small').textContent);
    desk.setAttribute('aria-pressed',String(row.role===selectedRole));
    desk.title=row.entry?.message||row.duty;
  }
}
