// Deterministic network economy. Money and goods are owned here, never by the renderer.
export const GROUPS=['Mara Paper','Jun Print','Atlas Office','Cedar Supply','North Desk','Orbit Paper','West Stationery','Field & Form','Loop Supply','Cobalt Print','Union Office','Pine Works'];
export const SHIFTS=[
  {name:'Supplier outage',detail:'Northshore stops dispatching. Everyone competes for two remaining warehouses.',price:2000,stock:[0,38,30],success:[0,9200,7800],demand:100},
  {name:'Freight price shock',detail:'Northshore returns, but restocking costs 40% more. Yesterday’s payment rules affect cash today.',price:2800,stock:[40,30,38],success:[8800,9400,8200],demand:110},
  {name:'Demand surge',detail:'Office demand jumps 50%. Supply recovers, but cash and payment restrictions carry over.',price:2400,stock:[60,60,60],success:[9500,9000,8600],demand:150}
];
export const usd=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n/100);
export const total=(items,key)=>items.reduce((s,o)=>s+(typeof key==='function'?key(o):o[key]),0);
const record=(w,actor,title,detail)=>w.events.push({id:`LOCAL-NET-${w.events.length+1}`,shift:w.shift+1,at:w.time,actor,title,detail});
export const ZERO_ECONOMICS={feeBps:0,processingCostBps:0,refundFeeReturnBps:0,reviewCostPerMerchant:0,churnBaseBps:0,churnServiceBps:0,churnPauseBps:0,churnReserveBps:0};
export function createNetwork(count=36,options={}){
  if(![12,36,120].includes(count))throw new Error('Choose 12, 36 or 120 merchants.');
  const economics={...ZERO_ECONOMICS,...options.economics},seed=options.seed??773;
  if(!Number.isInteger(seed)||seed<0||seed>2147483647)throw new Error('Invalid scenario seed.');
  for(const [key,value] of Object.entries(economics)){
    const cap=key==='reviewCostPerMerchant'?100000:key==='feeBps'?5000:10000;
    if(!(key in ZERO_ECONOMICS)||!Number.isInteger(value)||value<0||value>cap)throw new Error('Invalid economic assumption.');
  }
  const merchants=Array.from({length:count},(_,i)=>({id:`M${String(i+1).padStart(3,'0')}`,group:i%12,name:GROUPS[i%12]+(count>12?` ${Math.floor(i/12)+1}`:''),cash:0,reserve:0,rate:2000,acceptNew:true,active:true,churnedAt:null,baseDemand:8+(i%4)*2,overheadBps:5500+(i%4)*500,due:0,purchased:0,delivered:0,lost:0,settled:false}));
  return {schema:'supply-yard-network-v2',mode:'LOCAL_SIMULATION',count,seed,economics,merchants,offices:merchants.flatMap(m=>Array.from({length:4},(_,j)=>({id:`${m.id}-O${j+1}`,merchant:m.id,park:Math.floor(m.group/3),received:0,requested:0}))),shift:-1,phase:'ready',time:0,paused:false,speed:1,revision:0,ledger:{captured:0,overhead:0,supplierPaid:0,refunds:0,paypalCoverage:0,feesCollected:0,feesReturned:0,processingCost:0,agentCost:0,merchantWithdrawals:0},warehouses:[],orders:[],events:[],history:[],churnAudit:[],shipments:[],plans:[],debate:[],debateIndex:0,selectedPlan:'balanced',releaseCap:60000*count/12,extraLossCap:39000*count/12,approval:null};
}
export function beginShift(w){
  if(!['ready','settled'].includes(w.phase)||w.shift>=2)throw new Error('Finish this shift before opening another.');
  w.shift++;w.revision++;w.phase='orders';w.phaseAt=w.time;w.paused=false;w.plans=[];w.debate=[];w.debateIndex=0;w.shipments=[];w.approval=null;w.selectedPlan='balanced';
  const s=SHIFTS[w.shift],scale=w.count/12;
  w.warehouses=['Northshore','Eastline','Harbor Stock'].map((name,i)=>({id:i,name,stock:s.stock[i]*scale,opening:s.stock[i]*scale,successBps:s.success[i]}));
  w.shiftOpening={...w.ledger};w.declined=0;w.lostToChurn=0;w.currentOrders=[];
  for(const m of w.merchants){
    m.requested=Math.ceil(m.baseDemand*s.demand/100);m.due=m.active&&m.acceptNew?m.requested:0;m.blockedUnits=m.active&&!m.acceptNew?m.requested:0;m.purchased=0;m.delivered=0;m.lost=0;m.settled=false;m.coverage=0;m.refunded=0;m.released=0;m.source=null;
    w.declined+=m.blockedUnits;if(!m.active)w.lostToChurn+=m.requested;
    const gross=m.due*5000,held=Math.round(gross*m.rate/10000);
    m.currentFees=Math.round(gross*w.economics.feeBps/10000);
    m.reserve+=held;m.cash+=gross-held-m.currentFees;w.ledger.captured+=gross;
    w.ledger.feesCollected+=m.currentFees;w.ledger.processingCost+=Math.round(gross*w.economics.processingCostBps/10000);
    const overhead=Math.min(m.cash,Math.round(gross*m.overheadBps/10000));m.cash-=overhead;w.ledger.overhead+=overhead;
    if(m.due){const order={id:`LOCAL-ORDER-${w.shift+1}-${m.id}`,merchant:m.id,units:m.due,amount:gross,fee:m.currentFees,feeReturned:0,status:'CAPTURED',delivered:0,refunded:0};w.currentOrders.push(order);w.orders.push(order);}
    const offices=w.offices.filter(o=>o.merchant===m.id);offices.forEach((o,j)=>{o.requested=Math.floor(m.due/4)+(j<m.due%4?1:0);});
  }
  record(w,'PayPal','New payments captured',`${total(w.merchants,'due')} units paid; ${w.declined} units not charged due to payment pauses; ${w.lostToChurn} potential units lost after merchant departures.`);
  record(w,'Environment',s.name,s.detail);assertNetwork(w);
}
const fingerprint=w=>JSON.stringify({shift:w.shift,revision:w.revision,merchants:w.merchants,warehouses:w.warehouses,ledger:w.ledger,economics:w.economics,seed:w.seed,releaseCap:w.releaseCap,extraLossCap:w.extraLossCap});
const feeReturn=(w,m,refund)=>m.due?Math.round(m.currentFees*refund/(m.due*5000)*w.economics.refundFeeReturnBps/10000):0;

// Suppliers allocate their own stock in the existing order queue. PayPal never assigns inventory.
export function evaluatePlan(w,releases,kind='balanced'){
  const stock=w.warehouses.map(s=>s.stock),price=SHIFTS[w.shift].price,rows=[];
  for(let i=0;i<w.merchants.length;i++){
    const m=w.merchants[i],release=releases[i]||0;
    if(!Number.isSafeInteger(release)||release<0||release>m.reserve)throw new Error('A merchant can release only its own reserve.');
    const preference=[m.group%3,(m.group+1)%3,(m.group+2)%3],source=preference.find(j=>stock[j]>0)??null;
    const qty=source===null?0:Math.min(m.due,Math.floor((m.cash+release)/price),stock[source]);
    if(source!==null)stock[source]-=qty;
    const spend=qty*price,backing=m.cash+m.reserve-spend,p=qty?w.warehouses[source].successBps/10000:0;
    const successRefund=(m.due-qty)*5000,failureRefund=m.due*5000;
    const successLoss=Math.max(0,successRefund-backing-feeReturn(w,m,successRefund)),failureLoss=Math.max(0,failureRefund-backing-feeReturn(w,m,failureRefund));
    const expectedLoss=Math.round(p*successLoss+(1-p)*failureLoss),ratio=m.due?qty/m.due:1;
    const rate=kind==='fixed'?2000:kind==='risk'?4000:kind==='commerce'?1000:ratio<.5?3000:2000;
    const acceptNew=m.active&&(kind==='fixed'||kind==='commerce'||(m.due===0)||(kind==='risk'?ratio>=.75&&p>=.9:ratio>=.25&&p>=.75));
    rows.push({id:m.id,release,source,qty,spend,p,expectedLoss,failureLoss,rate,acceptNew,due:m.due,active:m.active});
  }
  return {kind,rows,released:total(rows,'release'),expectedLoss:total(rows,'expectedLoss'),worstLoss:total(rows,'failureLoss'),expectedUnits:total(rows,r=>r.qty*r.p),units:total(rows,'qty'),unserved:rows.filter(r=>r.due&&r.qty===0).length,underserved:rows.filter(r=>r.due&&r.qty/r.due<.5).length,servicePenalty:total(rows,r=>r.due?Math.round((1-r.qty/r.due)**2*20000+Math.max(0,.5-r.qty/r.due)*60000):0),paused:rows.filter(r=>r.active&&!r.acceptNew).length,releaseCount:rows.filter(r=>r.release>0).length,remainingStock:stock};
}
function optimize(w,kind,baseline){
  const releases=w.merchants.map(()=>0),price=SHIFTS[w.shift].price;
  let current=evaluatePlan(w,releases,kind);
  const score=p=>kind==='commerce'?p.units*100000:-p.expectedLoss-.2*p.worstLoss-p.unserved*10000-p.servicePenalty;
  // Small, explicit greedy search over the next affordable kit; no model or hidden outcome access.
  for(let turn=0;turn<w.count*30;turn++){
    let best=null,bestGain=.01;
    for(let i=0;i<w.count;i++){
      const m=w.merchants[i];if(!m.due||current.rows[i].qty>=m.due)continue;
      const increment=price-((m.cash+releases[i])%price);
      if(increment>m.reserve-releases[i]||current.released+increment>w.releaseCap)continue;
      const candidate=[...releases];candidate[i]+=increment;const plan=evaluatePlan(w,candidate,kind);
      if(kind==='balanced'&&(plan.worstLoss>baseline.worstLoss+w.extraLossCap||plan.expectedLoss>baseline.expectedLoss))continue;
      const gain=score(plan)-score(current);
      if(gain>bestGain||(gain===bestGain&&best&&m.due>w.merchants[best.i].due)){best={i,increment,plan};bestGain=gain;}
    }
    if(!best)break;releases[best.i]+=best.increment;current=best.plan;
  }
  return current;
}
export function buildPlans(w){
  if(w.shift<0)throw new Error('Open the economy first.');
  const risk=evaluatePlan(w,w.merchants.map(()=>0),'risk');
  const commerce=optimize(w,'commerce',risk),balanced=optimize(w,'balanced',risk);
  const input=fingerprint(w);
  return [risk,commerce,balanced].map(p=>({...p,input,eligible:p.released<=w.releaseCap&&p.worstLoss<=risk.worstLoss+w.extraLossCap,expectedAvoided:risk.expectedLoss-p.expectedLoss,extraWorst:p.worstLoss-risk.worstLoss}));
}
export function buildFixedPlan(w){
  if(w.shift<0)throw new Error('Open the economy first.');
  const p=evaluatePlan(w,w.merchants.map(()=>0),'fixed');
  return {...p,input:fingerprint(w),eligible:true,expectedAvoided:0,extraWorst:0};
}
export function beginDebate(w){
  if(!['observe','review'].includes(w.phase))throw new Error('Wait for the current requests.');
  w.plans=buildPlans(w);w.phase='debate';w.phaseAt=w.time;w.debateIndex=1;w.nextArgumentAt=w.time+6;w.paused=false;
  const [risk,commerce,balanced]=w.plans;
  const nameFor=id=>w.merchants.find(m=>m.id===id).name;
  const winners=balanced.rows.filter((r,i)=>r.qty>commerce.rows[i].qty);
  const displaced=commerce.rows.filter((r,i)=>r.qty<risk.rows[i].qty);
  w.debate=[
    {role:'Risk',tone:'risk',title:'Protect refund funds.',text:`Hold existing reserves. Keep ${usd(total(w.merchants,'reserve'))} protected before refunds; hold 40% on future sales and pause ${risk.paused} merchants’ new payments. Lower failure exposure, less trading.`},
    {role:'Commerce',tone:'commerce',title:'Keep orders moving.',text:`Release ${usd(commerce.released)} across ${commerce.releaseCount} merchants; buy ${commerce.units} kits. Hold only 10% on future sales and keep every payment channel open.`},
    {role:'Network',tone:'network',title:'Challenge the knock-on effects.',text:`That plan leaves ${commerce.underserved} merchants below half of their paid demand${displaced.length?` and reduces stock for ${displaced.length} versus holding reserves`:''}. Failure exposure rises ${usd(commerce.extraWorst)}; the authored increase limit is ${usd(w.extraLossCap)}. ${commerce.eligible?'It fits the limit, but the trade-off remains.':'It breaches the limit and cannot execute.'}`},
    {role:'Coordinator',tone:'balanced',title:'Revise the merchant-by-merchant plan.',text:`Release ${usd(balanced.released)} across ${balanced.releaseCount} merchants, keep ${balanced.rows.filter(r=>!r.release).length} reserves unchanged, and pause ${balanced.paused} new-payment channels. Merchants below half of demand: ${commerce.underserved} → ${balanced.underserved}. Expected refund coverage: ${usd(risk.expectedLoss)} → ${usd(balanced.expectedLoss)}.${winners.length?` ${nameFor(winners[0].id)} gets ${winners[0].qty} kits instead of ${commerce.rows.find(r=>r.id===winners[0].id).qty}.`:''}`},
    {role:'Risk',tone:'risk',title:'The disagreement remains.',text:`I still prefer holding funds. The revised plan adds ${usd(balanced.extraWorst)} of exposure if every replacement fails. Expected benefit is based on authored probabilities, not a proven forecast. You make the final call.`}
  ];
  record(w,'Agents','Competing policies calculated','Three independent scripted objectives evaluated the same wallets, supplier stock and order queue. Actual future delivery outcomes were not inputs.');
}
export function advanceDebate(w){
  if(w.phase!=='debate')throw new Error('Start the agent debate first.');
  if(w.debateIndex<w.debate.length)w.debateIndex++;
  else{w.phase='review';w.selectedPlan='balanced';}
  w.nextArgumentAt=w.time+6;
}
export function changeReleaseLimit(w,perTwelve){
  if(!['ready','observe','review'].includes(w.phase))throw new Error('Change the limit between runs or before approval.');
  if(![30000,60000,90000].includes(perTwelve))throw new Error('Unknown release limit.');
  w.releaseCap=perTwelve*w.count/12;w.extraLossCap=Math.round(w.releaseCap*.65);w.revision++;w.plans=[];w.debate=[];if(w.phase==='review')w.phase='observe';
}

// Outcome draws are isolated from planning. These are reproducible authored realizations, not predictions.
export function fixtureDraw(w,id,channel='delivery'){
  let n=w.seed+w.shift*911;const key=channel==='delivery'?id:id+':'+channel;
  for(const c of key)n=(Math.imul(n,31)+c.charCodeAt(0))>>>0;n^=n>>>16;n=Math.imul(n,0x45d9f3b)>>>0;return n%10000;
}
function deliveredInFixture(w,m,p){return fixtureDraw(w,m.id)<Math.round(p*10000);}
function settleMerchant(w,m,delivered){
  if(m.settled)return;m.settled=true;m.delivered=delivered;m.lost=m.purchased-delivered;
  const refund=(m.due-delivered)*5000,returnedFee=feeReturn(w,m,refund);m.cash+=returnedFee;w.ledger.feesReturned+=returnedFee;
  const merchantPart=Math.min(refund,m.cash+m.reserve),cashPart=Math.min(m.cash,merchantPart);
  m.cash-=cashPart;m.reserve-=merchantPart-cashPart;m.refunded=refund;m.coverage=refund-merchantPart;
  w.ledger.refunds+=refund;w.ledger.paypalCoverage+=m.coverage;
  const order=w.currentOrders.find(o=>o.merchant===m.id);if(order){order.status=delivered===m.due?'FULFILLED':delivered?'PARTLY_REFUNDED':'REFUNDED';order.delivered=delivered;order.refunded=refund;order.feeReturned=returnedFee;}
  w.offices.filter(o=>o.merchant===m.id).forEach((o,j)=>{o.received+=Math.floor(delivered/4)+(j<delivered%4?1:0);});
  record(w,'PayPal',`${m.name}: ${delivered}/${m.due} delivered`,`${usd(refund)} refunded; merchant covers ${usd(merchantPart)}, assumed PayPal coverage ${usd(m.coverage)}.`);
}
export function applyPlan(w,kind,role='human-reviewer'){
  if(w.phase!=='review'||w.approval)throw new Error('A fresh review is required.');
  if(role!=='human-reviewer')throw new Error('Agents propose. The PayPal reviewer authorizes.');
  const plan=w.plans.find(p=>p.kind===kind);if(!plan)throw new Error('Unknown policy.');
  if(plan.input!==fingerprint(w)){w.phase='observe';w.plans=[];w.debate=[];w.debateIndex=0;record(w,'Gate','Stale policy rejected','Stock or balances changed; no money moved. Recalculate the proposals.');throw new Error('The evidence changed. Re-run the debate before any funds move.');}
  if(!plan.eligible)throw new Error('This proposal exceeds the authored failure-exposure limit.');
  w.approval={role,kind,input:plan.input,stockOpening:w.warehouses.map(s=>s.stock),at:w.time};w.applied=structuredClone(plan);w.phase='delivery';w.phaseAt=w.time;w.paused=false;
  if(kind!=='fixed')w.ledger.agentCost+=w.merchants.filter(m=>m.active).length*w.economics.reviewCostPerMerchant;
  for(const [i,m] of w.merchants.entries()){
    const r=plan.rows[i];m.cash+=r.release;m.reserve-=r.release;m.released=r.release;m.rate=r.rate;m.acceptNew=r.acceptNew;
    m.cash-=r.spend;w.ledger.supplierPaid+=r.spend;m.purchased=r.qty;m.source=r.source;m.assumedSuccess=r.p;
    if(r.source!==null)w.warehouses[r.source].stock-=r.qty;
    if(!r.qty){settleMerchant(w,m,0);continue;}
    const key=`${m.group}-${r.source}`;let shipment=w.shipments.find(d=>d.id===key);
    if(!shipment){shipment={id:key,group:m.group,source:r.source,members:[],units:0,stage:'pickup',progress:0,wait:0,delay:w.shipments.length*.3};w.shipments.push(shipment);}
    shipment.members.push(m.id);shipment.units+=r.qty;
  }
  record(w,'PayPal','Reviewer policy applied',`${plan.releaseCount} reserve releases totaling ${usd(plan.released)}. Future reserve rates and ${plan.paused} payment pauses are stored for the next shift. Supplier FIFO allocations are independent.`);
  assertNetwork(w);
}
export function churnProbability(w,m){
  const e=w.economics,unfilled=m.due?1-m.delivered/m.due:0,paused=m.blockedUnits>0||!m.acceptNew;
  const reservePressure=Math.min(1,Math.max(0,(m.rate-2000)/2000));
  return Math.min(10000,Math.round(e.churnBaseBps+e.churnServiceBps*unfilled+e.churnPauseBps*Number(paused)+e.churnReserveBps*reservePressure));
}
function settleChurn(w){
  if(!Object.entries(w.economics).some(([k,v])=>k.startsWith('churn')&&v>0))return;
  for(const m of w.merchants.filter(m=>m.active)){
    const probabilityBps=churnProbability(w,m),draw=fixtureDraw(w,m.id,'churn'),left=draw<probabilityBps;
    const observation={merchant:m.id,shift:w.shift+1,probabilityBps,draw,left,delivered:m.delivered,due:m.due,paymentPaused:m.blockedUnits>0||!m.acceptNew,reserveRate:m.rate};
    w.churnAudit.push(observation);m.lastChurn=observation;
    if(left){m.active=false;m.acceptNew=false;m.churnedAt=w.shift+1;const withdrawal=m.cash+m.reserve;w.ledger.merchantWithdrawals+=withdrawal;m.cash=0;m.reserve=0;record(w,'Merchant',`${m.name} leaves`,`${probabilityBps/100}% authored departure chance. Current refunds settled first; ${usd(withdrawal)} remaining merchant funds withdrawn. Future PayPal volume stops.`);}
  }
}
function closeShift(w){
  settleChurn(w);
  const result={shift:w.shift+1,shock:SHIFTS[w.shift].name,policy:w.approval.kind,paid:total(w.merchants,'due'),requested:total(w.merchants,'requested'),delivered:total(w.merchants,'delivered'),declined:w.declined,released:w.applied.released,refunds:w.ledger.refunds-w.shiftOpening.refunds,coverage:w.ledger.paypalCoverage-w.shiftOpening.paypalCoverage,expectedCoverage:w.applied.expectedLoss,paused:w.applied.paused};
  Object.assign(result,{lostToChurn:w.lostToChurn,feesCollected:w.ledger.feesCollected-w.shiftOpening.feesCollected,feesReturned:w.ledger.feesReturned-w.shiftOpening.feesReturned,processingCost:w.ledger.processingCost-w.shiftOpening.processingCost,agentCost:w.ledger.agentCost-w.shiftOpening.agentCost,activeMerchants:w.merchants.filter(m=>m.active).length,churnedThisShift:w.merchants.filter(m=>m.churnedAt===w.shift+1).length});
  result.netContribution=result.feesCollected-result.feesReturned-result.processingCost-result.coverage-result.agentCost;
  w.history.push(result);w.phase='settled';record(w,'Environment','Shift closed',`${result.delivered}/${result.paid} paid units delivered. ${usd(result.coverage)} realized coverage in the selected synthetic branch. Balances and payment rules carry forward.`);
}
export function tickNetwork(w,delta){
  if(w.paused)return;const dt=Math.max(0,Math.min(.1,delta))*w.speed;w.time+=dt;
  if(w.phase==='orders'&&w.time-w.phaseAt>=3)w.phase='observe';
  if(w.phase==='debate'&&w.time>=w.nextArgumentAt)advanceDebate(w);
  if(w.phase!=='delivery')return;
  for(const d of w.shipments){
    if(d.stage==='complete')continue;if(d.delay>0){d.delay-=dt;continue;}
    if(d.stage==='packing'){d.wait+=dt;if(d.wait>=1.4){d.stage='office';d.progress=0;}continue;}
    const duration=d.stage==='pickup'?1.4:d.stage==='merchant'?2.2:2.4;
    d.progress=Math.min(1,d.progress+dt/duration);if(d.progress<1)continue;
    if(d.stage==='pickup'){d.stage='merchant';d.progress=0;}
    else if(d.stage==='merchant'){d.stage='packing';d.progress=0;}
    else{d.stage='complete';for(const id of d.members){const m=w.merchants.find(m=>m.id===id);settleMerchant(w,m,deliveredInFixture(w,m,m.assumedSuccess)?m.purchased:0);}}
  }
  if(w.merchants.every(m=>m.settled))closeShift(w);
  assertNetwork(w);
}
export function assertNetwork(w){
  const amounts=[...Object.values(w.ledger),...w.merchants.flatMap(m=>[m.cash,m.reserve])];
  if(amounts.some(n=>!Number.isSafeInteger(n)||n<0))throw new Error('Invalid money balance.');
  const l=w.ledger;if(total(w.merchants,m=>m.cash+m.reserve)+l.overhead+l.supplierPaid+l.refunds+l.feesCollected-l.feesReturned+l.merchantWithdrawals!==l.captured+l.paypalCoverage)throw new Error('Network money is not conserved.');
  if(l.feesReturned>l.feesCollected)throw new Error('Fee credits exceed collected fees.');
  if(w.shift>=0&&total(w.merchants,'due')+w.declined+w.lostToChurn!==total(w.merchants,'requested'))throw new Error('Potential demand is not reconciled.');
  if(w.warehouses.some(s=>s.stock<0||!Number.isInteger(s.stock)))throw new Error('Supplier stock allocated twice.');
  if(w.approval){
    for(const [i,s] of w.warehouses.entries())if(w.approval.stockOpening[i]-s.stock!==total(w.merchants,m=>m.source===i?m.purchased:0))throw new Error('Purchased stock does not reconcile.');
    for(const m of w.merchants){if(m.delivered+m.lost+(m.settled?0:m.purchased)!==m.purchased)throw new Error('Goods lost between simulation stops.');}
  }
  return true;
}
export function exportNetwork(w){return {...structuredClone(w),disclosure:'Local simulation only. Scripted objectives, synthetic demand, prices, overhead, supplier FIFO and delivery probabilities. PayPal is assumed to cover eligible refund shortfalls without later recovery. Reserve and acceptance controls are hypothetical internal policy surfaces, not connected public APIs. No LLM, real payment or measured savings. Any enabled fees, costs and churn are authored assumptions. Merchant reserve releases are not provider expenses.'};}
