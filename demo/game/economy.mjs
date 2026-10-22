import { streetRoute } from './streets.mjs';
import { NODES, PLACES } from './yard-art.mjs';

export const CASES = [
  {id:'rescue',name:'The missing shipment',description:'A supplier fails after four customers have paid. A verified substitute can change the reserve decision.'},
  {id:'no-stock',name:'Money cannot create stock',description:'The backup warehouse is out of stock. The team should retain the reserve.',stock:0},
  {id:'competing',name:'Jun got there first',description:'The last batch belongs to Jun. The team must honor that reservation.',reservedBy:'jun'},
  {id:'expired',name:'Yesterday’s quote',description:'The replacement offer has expired. A release requires fresh terms.',valid:false},
  {id:'missing',name:'The missing liability file',description:'The team cannot establish all obligations or recoverable assets. It must abstain.',liabilityKnown:false},
  {id:'fragile',name:'A fragile recovery',description:'The route is feasible, but the authored 10% success assumption makes release financially worse.',successBps:1000}
];
export const PHASES=['Orders placed','Shipment blocked','Checks in progress','Reserve choice','Reviewer approval','Outcome'];
export const usd = cents => cents == null ? 'Unknown' : new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:cents%100?2:0,maximumFractionDigits:2}).format(cents/100);

function actor(id,name,role,skinId,x,y,extra={}) {return {id,name,role,skinId,x,y,home:{x,y},direction:'down',path:[],walk:0,...extra};}
export function createEconomy(caseId='rescue') {
  const scenario=CASES.find(c=>c.id===caseId);if(!scenario)throw new Error('Unknown case');
  const w={
    schema:'supply-yard-v2',mode:'LOCAL_SIMULATION',caseId,scenario:{...scenario},phase:0,time:0,paused:false,speed:1,revision:0,
    orderFlow:{stage:'ready',startedAt:0},delivery:null,
    offices:[{id:'office-a',name:'West Studio',stock:2,consumed:0,received:0,requested:2},{id:'office-b',name:'Ledger Office',stock:2,consumed:0,received:0,requested:2}],nextOfficeUse:8,
    assumptions:{successBps:scenario.successBps??8500,futureVolume:50000,netContributionBps:200,refundRecoveryBps:10000,horizonDays:30},
    policy:{id:'HARBOR-DEMO-1',maxRelease:6000,maxFailureLoss:90000},
    opening:{capturedPayments:100000,spentBeforeShock:70000,available:10000,reserve:20000},
    ledger:{available:10000,reserve:20000,supplierPaid:0,customerRefunds:0,paypalPaid:0},
    quote:{id:'HARBOR-QUOTE-04',cost:16000,units:4,stock:scenario.stock??4,reservedBy:scenario.reservedBy??null,valid:scenario.valid??true,arrivalDay:2,promiseDay:4},
    liabilityKnown:scenario.liabilityKnown??true,
    orders:Array.from({length:4},(_,i)=>({id:`LOCAL-PAID-${i+1}`,customer:`buyer-${i+1}`,office:i<2?'office-a':'office-b',amount:25000,status:'CAPTURED',delivery:'AWAITING',refund:null})),
    evidence:[
      {id:'stock',agent:'scout',title:'Stock & ownership',source:'S2 stock register · E-01',target:{x:820,y:485},found:false},
      {id:'ledger',agent:'economist',title:'Funds & obligations',source:'Merchant case ledger · E-02',target:{x:820,y:260},found:false},
      {id:'terms',agent:'challenger',title:'Terms & delivery promise',source:'Quote + customer agreement · E-03',target:{x:150,y:260},found:false}
    ],
    actors:[actor('mara','Mara','merchant','C100',165,253),actor('jun','Jun','merchant','C099',492,255),actor('inez','Inez','merchant','C098',160,480),actor('reviewer','PayPal reviewer','reviewer','C097',834,250),actor('supplier','Eli','supplier','C096',837,478),
      actor('scout','Scout','agent','C009',440,482,{job:'stock',color:'#347c77'}),actor('economist','Economist','agent','C012',480,480,{job:'ledger',color:'#3d6eac'}),actor('challenger','Challenger','agent','C016',520,482,{job:'terms',color:'#a77048'}),
      ...Array.from({length:4},(_,i)=>actor(`buyer-${i+1}`,['Ava','Leo','Nia','Sam'][i],'customer',`C00${i+1}`,[220,362,595,738][i],310,{order:`LOCAL-PAID-${i+1}`,wander:i})),
      ...Array.from({length:5},(_,i)=>actor(`local-${i+1}`,`Neighbor ${i+1}`,'neighbor',`C02${i+1}`,[315,690,315,690,70][i],[145,210,430,430,310][i],{wander:i+4})),
      actor('courier','Courier','courier','C042',880,480)
    ],
    events:[],recommendations:[],recommendation:null,approval:null,outcome:null,refundPending:false,receipts:{},selected:'mara'
  };
  const entry=id=>PLACES.find(p=>p.id===id).entry;
  const spots={mara:entry('mara'),jun:entry('jun'),inez:{x:365,y:430},reviewer:entry('paypal'),supplier:entry('supply'),scout:{x:430,y:580},economist:{x:480,y:580},challenger:{x:530,y:580},courier:{x:325,y:430},'buyer-1':{x:750,y:185},'buyer-2':{x:790,y:185},'buyer-3':{x:750,y:385},'buyer-4':{x:790,y:385}};
  w.actors=w.actors.filter(a=>a.role!=='neighbor');
  for(const a of w.actors){const p=spots[a.id];a.x=p.x;a.y=p.y;a.home={...p};if(a.id==='inez')a.role='dispatcher';}
  w.evidence.find(e=>e.id==='stock').target={x:325,y:545};w.evidence.find(e=>e.id==='ledger').target={x:660,y:545};w.evidence.find(e=>e.id==='terms').target={x:530,y:430};
  log(w,'system','Case opened','Four earlier payments were captured and settled. $700 was already spent; $100 available + $200 reserve remain.');
  invariant(w);return w;
}
function log(w,actor,type,detail,flow=null){w.events.push({id:`LOCAL-EVENT-${w.events.length+1}`,at:w.time,actor,type,detail,flow,mode:'LOCAL_SIMULATION'});}
const totalOrders=w=>w.orders.reduce((s,o)=>s+o.amount,0);
const liquid=w=>w.opening.available+w.opening.reserve;
export function releaseAmount(w){return Math.max(0,w.quote.cost-w.opening.available);}
export function feasible(w){return w.quote.stock>=w.quote.units&&(!w.quote.reservedBy||w.quote.reservedBy==='mara')&&w.quote.valid&&w.quote.arrivalDay<=w.quote.promiseDay;}
export function compareOptions(w){
  if(w.phase===5&&w.comparisonAtExecution)return structuredClone(w.comparisonAtExecution);
  const paid=totalOrders(w),backing=liquid(w),release=releaseAmount(w);
  // Cohort refunds consume merchant backing first. No other recoveries assumed.
  const holdLoss=Math.max(0,paid-backing);
  const failureBacking=Math.max(0,backing-w.quote.cost);
  const failureLoss=Math.max(0,paid-failureBacking);
  const p=feasible(w)?w.assumptions.successBps:0;
  const expectedLoss=Math.round(failureLoss*(10000-p)/10000);
  const futureContribution=Math.round(w.assumptions.futureVolume*w.assumptions.netContributionBps/10000);
  const expectedContribution=Math.round(futureContribution*p/10000);
  return {
    verified:w.evidence.every(e=>e.found)&&w.liabilityKnown,
    hold:{reserve:w.opening.reserve,recoverable:backing,refunds:paid,failureLoss:holdLoss,expectedLoss:holdLoss,expectedContribution:0,net:-holdLoss,fulfilled:0},
    release:{amount:release,reserve:w.opening.reserve-release,supplierCost:w.quote.cost,recoverable:failureBacking,refundsIfFailure:paid,successLoss:0,failureLoss,expectedLoss,expectedContribution,net:expectedContribution-expectedLoss,fulfilledIfSuccess:4,feasible:feasible(w),successBps:p},
    avoidedExpectedLoss:holdLoss-expectedLoss,incrementalContribution:expectedContribution,netBenefit:holdLoss-expectedLoss+expectedContribution,
    extraFailureLoss:failureLoss-holdLoss,breakEvenBps:Math.ceil(10000*(failureLoss-holdLoss)/(failureLoss+futureContribution)),lossBreakEvenBps:Math.ceil(10000*(failureLoss-holdLoss)/failureLoss),
    interpretation:'Authored 30-day scenario; not a PayPal prediction, price, guarantee, or measured result. Historic payment fees are sunk and excluded.'
  };
}
export function evidenceDetail(w,id){
  if(id==='stock')return {ok: w.quote.stock>=4&&!w.quote.reservedBy,title:w.quote.reservedBy?'Jun owns the last batch':w.quote.stock<4?'No replacement stock':'Four units confirmed',detail:w.quote.reservedBy?'An earlier reservation belongs to Jun. Releasing cash must not displace him.':w.quote.stock<4?'The warehouse is empty. An attractive price does not create inventory.':'The backup warehouse has four unreserved kits. The inventory record is current.'};
  if(id==='ledger')return {ok:w.liabilityKnown,title:w.liabilityKnown?'These orders are already paid':'Liability evidence missing',detail:w.liabilityKnown?'$1,000 would need refunding. Only $300 remains recoverable. Authorizations cannot be voided because these payments were captured.':'The current file cannot establish other obligations and asset recoveries. Do not claim a reliable exposure estimate.'};
  return {ok:w.quote.valid&&w.quote.arrivalDay<=w.quote.promiseDay,title:w.quote.valid?'A $160 batch, not a $40 order':'Quote expired',detail:w.quote.valid?'$40 per unit × four units; upfront, non-splittable. Two-day arrival fits the original four-day promise.':'The quote is no longer valid. Refresh terms before making a reserve decision.'};
}
function recommendation(w){
  const m=compareOptions(w);
  let decision='RELEASE',reason='The team found a feasible substitute. Under the labeled assumptions, a capped release lowers expected uncovered refunds.';
  if(!w.liabilityKnown||!w.quote.valid){decision='MORE_EVIDENCE';reason='Missing or stale evidence prevents a reliable reserve recommendation.';}
  else if(!feasible(w)){decision='HOLD';reason=w.quote.reservedBy?'The batch is already reserved by Jun. Cash cannot override stock ownership.':'There is no feasible replacement supply. Releasing money adds no recovery benefit.';}
  else if(releaseAmount(w)>w.policy.maxRelease||m.release.failureLoss>w.policy.maxFailureLoss){decision='HOLD';reason='The proposed action exceeds an authored funding or maximum-downside constraint.';}
  else if(m.avoidedExpectedLoss<=0||m.netBenefit<=0){decision='HOLD';reason='At this success assumption, expected uncovered refunds do not improve. The demo policy does not let speculative future contribution override that constraint.';}
  return {decision,reason,version:w.revision,metrics:m};
}
function fingerprint(w){return JSON.stringify({revision:w.revision,quote:w.quote,assumptions:w.assumptions,policy:w.policy,liabilityKnown:w.liabilityKnown,ledger:w.ledger});}

export function startSupplyFlow(w){
  if(w.phase!==0||w.orderFlow.stage!=='ready')throw new Error('The order flow has already started.');
  w.orderFlow={stage:'requests',startedAt:w.time};w.paused=false;w.nextOfficeUse=w.time+8;
  for(const office of w.offices)log(w,office.id,'Stock requested',`${office.name} requests two kits from Mara. Replaying its existing $500 paid order; no new charge.`);
}
export function injectShock(w){
  if(w.phase!==0)throw new Error('Start from an open market.');
  w.phase=1;w.orderFlow.stage='blocked';
  w.recommendations.push({decision:'HOLD',label:'Demo baseline',reason:'Original supplier failed; no verified replacement yet.'});
  log(w,'mara','Supplier failure','Northshore warehouse cannot dispatch. Four paid office-supply orders are exposed to cancellation.');
}
export function sendAgents(w){
  if(w.phase!==1)throw new Error('Investigation starts after the shock.');
  w.phase=2;w.paused=false;
  for(const e of w.evidence){const a=w.actors.find(a=>a.id===e.agent);a.path=streetRoute(a,e.target);if(!a.path.length)a.path=[{...e.target}];a.job=e.id;delete e.checkUntil;}
  log(w,'agents','Team dispatched','Scout checks stock; Economist checks recoverable funds; Challenger checks minimum batch and delivery terms. All roles are scripted.');
}
function collect(w,e){
  if(e.found)return;e.found=true;const finding=evidenceDetail(w,e.id);e.finding=finding;e.observedRevision=w.revision;
  log(w,e.agent,`Evidence ${e.source}`,finding.detail);
  if(w.evidence.every(e=>e.found)){
    w.recommendation=recommendation(w);w.recommendations.push({...w.recommendation,label:'After investigation'});w.phase=3;
    log(w,'agents','Recommendation updated',`${w.recommendation.decision}: ${w.recommendation.reason}`);
  }
}
export function tick(w,delta,reduced=false){
  if(w.paused)return;const dt=Math.max(0,Math.min(delta,.1))*w.speed;w.time+=dt;
  if(w.phase===0&&w.orderFlow.stage==='requests'&&w.time-w.orderFlow.startedAt>=4){
    w.orderFlow={stage:'restock',startedAt:w.time};
    log(w,'mara','Restock requested','Mara combines the two office requests into one four-kit restock request to Northshore.');
  }else if(w.phase===0&&w.orderFlow.stage==='restock'&&w.time-w.orderFlow.startedAt>=4)injectShock(w);
  if(w.orderFlow.stage!=='ready'&&w.phase<5)while(w.time>=w.nextOfficeUse){for(const office of w.offices){if(office.stock>0){office.stock--;office.consumed++;}}w.nextOfficeUse+=8;}
  for(const a of w.actors){
    if(a.role==='neighbor'){
      if(reduced)continue;
      if(!a.path.length&&w.time>(a.nextWalk??(Number(a.id.split('-')[1])*1.7))){a.wander=(a.wander??0)+1;a.path=streetRoute(a,NODES[(a.wander*7+Number(a.id.split('-')[1])*3)%NODES.length]);a.nextWalk=w.time+5+(a.wander%4);}
    }
    const target=a.path[0];if(!target)continue;
    const dx=target.x-a.x,dy=target.y-a.y,d=Math.hypot(dx,dy),step=dt*(a.role==='agent'?220:a.role==='courier'?190:30);
    a.direction=Math.abs(dx)>Math.abs(dy)?dx<0?'left':'right':dy<0?'up':'down';a.walk+=dt;
    if(d<=step){a.x=target.x;a.y=target.y;a.path.shift();}
    else{a.x+=dx/d*step;a.y+=dy/d*step;}
  }
  if(w.phase===2)for(const e of w.evidence){
    if(e.found||w.actors.find(a=>a.id===e.agent).path.length)continue;
    e.checkUntil??=w.time+1.4;
    if(w.time>=e.checkUntil)collect(w,e);
  }
  advanceDelivery(w);
}

function driveTo(w,id){
  const van=w.actors.find(a=>a.id==='courier');
  van.path=streetRoute(van,PLACES.find(p=>p.id===id).entry);
}
function advanceDelivery(w){
  const d=w.delivery;if(!d||d.stage==='complete'||w.actors.find(a=>a.id==='courier').path.length)return;
  if(d.stage==='pickup'){
    d.awaitingPickup=0;d.load=4;d.stage='restock';driveTo(w,'mara');
    log(w,'courier','Four kits loaded','The van collects the paid batch from backup stock. Office inventory is unchanged.');
  }else if(d.stage==='restock'){
    d.load=0;d.packing=4;d.stage='packing';d.readyAt=w.time+2;
    log(w,'mara','Merchant restocked','Four kits reach Mara’s bench. She packs two for each office.');
  }else if(d.stage==='packing'&&w.time>=d.readyAt){
    d.packing=0;d.load=4;d.stage='office-a';driveTo(w,'office-a');
    log(w,'courier','Office deliveries dispatched','The van leaves the packing bench with four kits. Both office deliveries remain pending.');
  }else if(d.stage==='office-a'||d.stage==='office-b'){
    const office=w.offices.find(o=>o.id===d.stage);
    office.received+=office.requested;office.stock+=office.requested;d.load-=office.requested;
    for(const order of w.orders.filter(o=>o.office===office.id))order.delivery='DELIVERED';
    log(w,office.id,'Office delivery received',`${office.name} receives two kits when the van arrives. No new customer payment.`);
    if(d.stage==='office-a'){d.stage='office-b';driveTo(w,'office-b');}
    else{d.stage='complete';log(w,'courier','All deliveries complete','Both offices received their kits. All four existing paid orders are fulfilled in this selected local branch.');}
  }
  invariant(w);
}
export function setAssumptions(w,patch){
  if(w.phase===5)throw new Error('Replay the case to change assumptions.');
  for(const [key,value] of Object.entries(patch)){
    const cap=key==='successBps'?10000:key==='futureVolume'?1000000:key==='netContributionBps'?1000:null;
    if(cap===null||!Number.isInteger(value)||value<0||value>cap)throw new Error('Invalid scenario assumption');
  }
  Object.assign(w.assumptions,patch);w.revision+=1;
  if(w.evidence.every(e=>e.found)){w.recommendation=recommendation(w);w.phase=3;w.approval=null;}
  log(w,'reviewer','Scenario assumption changed','Any prior approval is invalid. The selected probability is authored, not learned from evidence.');
}
export function choose(w,decision,role='human-reviewer'){
  if(w.phase!==3)throw new Error('Wait for the investigation.');
  if(role!=='human-reviewer'){log(w,'gate','Agent self-approval blocked','Only the simulated human reviewer may authorize the reserve action.');throw new Error('Agents advise. The reviewer authorizes.');}
  if(!['HOLD','RELEASE'].includes(decision))throw new Error('Unknown decision');
  if(decision==='RELEASE'&&w.recommendation.decision!=='RELEASE')throw new Error('Release is blocked by evidence or the declared constraints.');
  w.approval={decision,role,amount:decision==='RELEASE'?releaseAmount(w):0,fingerprint:fingerprint(w),consumed:false};w.phase=4;
  log(w,'reviewer',decision==='RELEASE'?'Capped release approved':'Reserve retained',`Scoped to ${w.caseId}, evidence revision ${w.revision}. Local authority only.`);
}
export function stockRace(w){
  if(w.phase!==4)throw new Error('Inject a race after review.');
  w.quote.reservedBy='jun';w.revision+=1;log(w,'jun','Stock reservation changed','Jun now owns the batch. The previous approval must not execute.');
}
function receipt(w,id,action,status){
  if(w.receipts[id])return w.receipts[id];
  const r={id,action,status,mode:'LOCAL_SIMULATION'};w.receipts[id]=r;return r;
}
function finishRefund(w){
  if(w.receipts['LOCAL-REFUND-BATCH']?.status==='COMPLETED')return;
  const owed=totalOrders(w),backing=w.ledger.available+w.ledger.reserve,merchantPart=Math.min(owed,backing),availablePart=Math.min(w.ledger.available,merchantPart);
  w.ledger.available-=availablePart;w.ledger.reserve-=merchantPart-availablePart;w.ledger.paypalPaid=owed-merchantPart;w.ledger.customerRefunds=owed;w.refundPending=false;
  for(const o of w.orders){o.refund='COMPLETED';o.status='REFUNDED';o.delivery='CANCELLED';}
  receipt(w,'LOCAL-REFUND-BATCH','refund','COMPLETED').status='COMPLETED';
  log(w,'paypal','Refund completed locally',`${usd(merchantPart)} from merchant funds + ${usd(w.ledger.paypalPaid)} assumed PayPal coverage = ${usd(owed)} refunded.`,{from:'paypal',to:'customers',amount:owed,kind:'refund'});
  invariant(w);
}
export function execute(w,outcome='success'){
  if(w.phase!==4||!w.approval||w.approval.consumed)throw new Error('A current, unconsumed reviewer approval is required.');
  if(!['success','failure','pending'].includes(outcome))throw new Error('Unknown outcome');
  if(w.approval.fingerprint!==fingerprint(w)){
    log(w,'gate','Stale approval rejected','No money moved. The team must inspect the new reservation.');
    w.phase=1;w.approval=null;w.recommendation=null;w.evidence.forEach(e=>{e.found=false;delete e.finding;});throw new Error('Stock changed. Approval blocked before any funds moved.');
  }
  const releasing=w.approval.decision==='RELEASE';
  if(releasing&&(!feasible(w)||recommendation(w).decision!=='RELEASE'))throw new Error('Fresh execution checks failed.');
  w.comparisonAtExecution=compareOptions(w);
  w.approval.consumed=true;
  if(releasing){
    const amount=w.approval.amount;w.ledger.reserve-=amount;w.ledger.available+=amount;
    log(w,'paypal','Simulated reserve release',`${usd(amount)} of Mara’s own funds moved to available cash. This is not a PayPal expense.`,{from:'paypal',to:'mara',amount,kind:'release'});
    w.ledger.available-=w.quote.cost;w.ledger.supplierPaid+=w.quote.cost;w.quote.stock-=4;w.quote.reservedBy='mara';
    log(w,'mara','Replacement purchased',`${usd(w.quote.cost)} paid for four units. Remaining merchant backing: ${usd(w.ledger.reserve+w.ledger.available)}.`,{from:'mara',to:'supplier',amount:w.quote.cost,kind:'purchase'});
  }
  w.outcome=releasing?outcome:'failure';w.phase=5;
  if(releasing&&outcome==='success'){
    w.delivery={stage:'pickup',awaitingPickup:4,load:0,packing:0};w.paused=false;driveTo(w,'supply');
    log(w,'courier','Pickup dispatched','The van is heading to backup stock. Delivery will be recorded separately at each office arrival.');
  }else if(outcome==='pending'){
    w.refundPending=true;w.outcome='pending';for(const o of w.orders)o.refund='PENDING';receipt(w,'LOCAL-REFUND-BATCH','refund','PENDING');
    log(w,'paypal','Refund pending locally','A pending refund is not completed money movement. Reconcile the local fixture before settling the ledger.');
  }else finishRefund(w);
  invariant(w);
}
export function reconcileRefund(w){if(!w.refundPending)return;finishRefund(w);w.outcome='failure';}
export function invariant(w){
  for(const amount of Object.values(w.ledger))if(!Number.isSafeInteger(amount)||amount<0)throw new Error('Invalid money state');
  const l=w.ledger;if(l.available+l.reserve+l.supplierPaid+l.customerRefunds!==liquid(w)+l.paypalPaid)throw new Error('Money was created or lost');
  if(w.quote.stock<0)throw new Error('Stock allocated twice');
  if(w.opening.spentBeforeShock+liquid(w)!==w.opening.capturedPayments)throw new Error('Opening captured funds are not reconciled');
  for(const office of w.offices)if(office.stock<0||office.stock+office.consumed!==2+office.received)throw new Error('Office stock is not conserved');
  if(w.delivery){
    const counts=[w.delivery.awaitingPickup,w.delivery.load,w.delivery.packing,...w.offices.map(o=>o.received)];
    if(counts.some(n=>!Number.isInteger(n)||n<0)||counts.reduce((s,n)=>s+n,0)!==4)throw new Error('Replacement stock is not conserved');
    for(const office of w.offices)if(w.orders.filter(o=>o.office===office.id&&o.delivery==='DELIVERED').length!==office.received)throw new Error('Delivery does not match received stock');
  }
  return true;
}
export function exportEconomy(w){return {...structuredClone(w),comparison:compareOptions(w),disclosure:'Scripted agents, authored probabilities and local payments. PayPal is assumed to cover the full eligible refund shortfall with no later recovery. This is not actual PayPal policy or measured savings. Existing fees are sunk; future contribution is a separate conditional assumption.',horizon:{days:30,completeScenarioAssumptions:true,realObservationComplete:false,fulfilledOrdersAssumedNoAdditionalReturns:true}};}
