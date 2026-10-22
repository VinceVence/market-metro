import {createNetwork, SHIFTS, fixtureDraw, total} from './network.mjs';

export const REVIEW_SHIFTS = SHIFTS.map(s => ({...s, price: s.price / 5}));
export const dollars = cents => new Intl.NumberFormat('en-US', {style:'currency', currency:'USD'}).format(cents / 100);
// Only the environment can read outcomes or unopened source records. Agents receive observations.
const environments = new WeakMap();
const log = (w, actor, title, detail) => w.events.push({id:`EVENT-${w.events.length + 1}`, shift:w.shift + 1, at:w.time, actor, title, detail});

export function savedReceipt(orders) {
  return [...orders].reverse().find(o => {
    const r = o?.receipt;
    return o.orderStatus === 'COMPLETED' && o.paymentState === 'COMPLETED'
      && r?.provenance === 'PAYPAL_SANDBOX' && r.status === 'COMPLETED' && r.currency === 'USD'
      && typeof r.captureId === 'string' && typeof r.orderId === 'string' && o.paypalOrderId === r.orderId
      && typeof o.verifiedAt === 'string' && Number.isFinite(Date.parse(o.verifiedAt))
      && Number.isInteger(o.quantity) && o.quantity > 0 && o.quantity <= 10
      && r.grossCents === o.quantity * 1000 && o.grossCents === r.grossCents
      && Number.isSafeInteger(r.feeCents) && r.feeCents >= 0
      && Number.isSafeInteger(r.netCents) && r.netCents >= 0
      && r.feeCents + r.netCents === r.grossCents;
  }) ?? null;
}

export function createEvidenceEconomy(count = 36, receipt = null, seed = 773) {
  if (receipt && !savedReceipt([receipt])) throw new Error('The saved sandbox receipt is incomplete or does not reconcile.');
  const w = createNetwork(count, {seed});
  Object.assign(w, {
    schema:'supply-yard-evidence-v1', mode:'EVIDENCE_REPLAY',
    paymentReference:receipt ? {quantity:receipt.quantity, verifiedAt:receipt.verifiedAt, ...structuredClone(receipt.receipt)} : null,
    roles:['Risk', 'Evidence', 'Commerce', 'Coordinator'],
    ledger:{openingCapital:count * 5000, captured:0, feesCollected:0, supplierPaid:0, refunds:0, paypalCoverage:0, released:0},
    cases:[], queries:[], currentOrders:[], reviewHistory:[], selectedPlan:'balanced',
  });
  w.merchants.forEach(m => { m.cash = 5000; m.rate = 10000; });
  environments.set(w, new Map());
  return w;
}

export function startEvidenceShift(w) {
  if (!['ready','settled'].includes(w.phase) || w.shift >= 2) throw new Error('Complete this shift first.');
  w.shift++; w.phase = 'orders'; w.phaseAt = w.time; w.paused = false;
  w.plans = []; w.debate = []; w.debateIndex = 0; w.shipments = []; w.approval = null; w.selectedPlan = 'balanced';
  w.currentOrders = []; w.cases = []; w.queries = []; w.shiftOpening = {...w.ledger};
  const s = REVIEW_SHIFTS[w.shift], scale = w.count / 12;
  w.warehouses = ['Northshore','Eastline','Harbor Stock'].map((name,i) => ({id:i, name, stock:s.stock[i]*scale, opening:s.stock[i]*scale, successBps:s.success[i]}));
  for (const m of w.merchants) {
    const anchor = w.shift === 0 && m.id === 'M001' ? w.paymentReference : null;
    Object.assign(m, {due:anchor?.quantity ?? Math.ceil(m.baseDemand*s.demand/100), purchased:0, delivered:0, lost:0, released:0, settled:false, refunded:0, coverage:0, source:null});
    const gross = m.due*1000, fee = anchor?.feeCents ?? Math.round(gross*.03), net = gross-fee;
    const order = {id:`SIM-S${w.shift+1}-${m.id}`, merchant:m.id, units:m.due, amount:gross, fee, net, held:net, released:0, delivered:0, refunded:0,
      provenance:'SIMULATED_REPLAY', paymentSource:anchor ? 'SAVED_SANDBOX_REFERENCE' : 'GENERATED_PAYMENT',
      captureReference:anchor?.captureId ?? null, status:'REVIEW_HOLD'};
    w.orders.push(order); w.currentOrders.push(order); m.reserve += net;
    w.ledger.captured += gross; w.ledger.feesCollected += fee;
    w.offices.filter(o=>o.merchant===m.id).forEach((o,j)=>{o.requested=Math.floor(m.due/4)+(j<m.due%4?1:0);});
  }
  log(w,'Environment',s.name,'Generated office orders. Current net receipts enter an authored 100% review hold; existing merchant cash funds procurement.');
  if (w.shift === 0 && w.paymentReference) log(w,'Payment evidence','Saved receipt linked to Mara Paper',`${w.paymentReference.captureId}: ${dollars(w.paymentReference.grossCents)} gross. Replayed once in this simulated ledger; no new PayPal call or payment.`);
  assertEvidenceEconomy(w);
}

function dispatch(w) {
  const price = REVIEW_SHIFTS[w.shift].price;
  for (const m of w.merchants) {
    const source = [m.group%3,(m.group+1)%3,(m.group+2)%3].find(i=>w.warehouses[i].stock>0) ?? null;
    const qty = source === null ? 0 : Math.min(m.due, Math.floor(m.cash/price), w.warehouses[source].stock);
    m.source = source; m.purchased = qty; m.cash -= qty*price; w.ledger.supplierPaid += qty*price;
    if (source !== null) w.warehouses[source].stock -= qty;
    if (!qty) { arrive(w,m); continue; }
    const id = `${m.group}-${source}`;
    let van = w.shipments.find(d=>d.id===id);
    if (!van) {van={id,group:m.group,source,members:[],units:0,stage:'pickup',progress:0,wait:0,delay:w.shipments.length*.16};w.shipments.push(van);}
    van.members.push(m.id); van.units += qty;
  }
  w.phase = 'delivery'; w.phaseAt = w.time;
  log(w,'Merchants','Restock requests dispatched',`${total(w.merchants,'purchased')} kits bought with available merchant cash. Held receipts cannot be spent.`);
}

const matches = (proof, unit) => proof?.status === 'DELIVERED' && proof.orderId === unit.orderId
  && proof.unitId === unit.id && typeof proof.id === 'string' && proof.id.length > 0;

function arrive(w,m) {
  const order = w.currentOrders.find(o=>o.merchant===m.id);
  let delivered = m.purchased && fixtureDraw(w,m.id) < w.warehouses[m.source].successBps ? m.purchased : 0;
  // Authored first-shift teaching cases: partial delivery vs an actual failure.
  if (w.shift === 0 && m.id === 'M001') delivered = Math.min(m.purchased, Math.floor(m.due*.6));
  if (w.shift === 0 && m.id === 'M002') delivered = 0;
  m.delivered = delivered; m.lost = m.purchased-delivered; m.settled = true; order.delivered = delivered;
  w.offices.filter(o=>o.merchant===m.id).forEach((o,j)=>{o.received+=Math.floor(delivered/4)+(j<delivered%4?1:0);});
  for (let i=0;i<m.due;i++) {
    const id = `${order.id}-U${i+1}`, arrived = i < delivered;
    const proof = {id:`POD-${id}`, orderId:order.id, unitId:id, status:'DELIVERED', provenance:'GENERATED_CARRIER'};
    const focus = w.shift === 0 && m.id === 'M001';
    const visible = arrived && (focus ? i < Math.min(2,delivered) : fixtureDraw(w,id,'scan')<3500);
    const wrongOrder = w.shift === 0 && m.id === 'M002' && i < 2;
    const recoverable = arrived && (focus || fixtureDraw(w,id,'carrier')<8000);
    const carrier = wrongOrder ? {...proof,orderId:'UNRELATED-ORDER'} : recoverable ? proof
      : {id:`TRACE-${id}`,orderId:order.id,unitId:id,status:'NO_PROOF',provenance:'GENERATED_CARRIER'};
    const buyer = {id:`OFFICE-${id}`,orderId:order.id,unitId:id,status:arrived ? 'RECEIVED' : 'NOT_RECEIVED',provenance:'GENERATED_OFFICE'};
    environments.get(w).set(id,{arrived,carrier,buyer});
    w.cases.push({id,orderId:order.id,merchant:m.id,amount:1000,feed:visible?proof:null,
      confirmed:visible,source:visible?'Initial carrier feed':null,carrier:null,buyer:null,rejected:false});
  }
  log(w,'Environment',`${m.name}: route completed`,`${delivered}/${m.due} kits physically delivered. Evidence feed generated independently; investigators cannot read physical outcomes.`);
}

// A public observation boundary: no cash-driven outcome draws, physical counts, or unopened records.
export function investigatorView(w) {
  return {orders:w.currentOrders.map(({id,merchant,units,amount,net})=>({id,merchant,units,amount,net})), units:structuredClone(w.cases)};
}
export function investigationRequests(observation, source) {
  return observation.units.filter(u=>!u.confirmed && (source === 'carrier' ? !u.carrier : u.carrier && !u.buyer))
    .map(u=>({unitId:u.id, source, reason:source==='carrier'?'Missing delivery proof: request a source record.':'Carrier proof absent or mismatched: ask the receiving office.'}));
}
function investigate(w,source) {
  for (const request of investigationRequests(investigatorView(w),source)) {
    const u = w.cases.find(c=>c.id===request.unitId), response = structuredClone(environments.get(w).get(u.id)[source]);
    u[source] = response;
    if (source === 'carrier') {
      u.confirmed = matches(response,u);
      u.rejected = response.status === 'DELIVERED' && !u.confirmed;
    } else {
      // Office confirmation alone is deliberately insufficient. Retain the hold for manual review.
      u.confirmed = matches(u.carrier,u) && response.status==='RECEIVED' && response.orderId===u.orderId && response.unitId===u.id;
    }
    if (u.confirmed) u.source='Recovered carrier proof';
    w.queries.push({...request,response,accepted:u.confirmed,provenance:'SCRIPTED_INVESTIGATION'});
  }
}
export function evidenceTotals(w,merchant=null) {
  const units=w.cases.filter(u=>!merchant||u.merchant===merchant);
  return {units:units.length, initial:units.filter(u=>matches(u.feed,u)).length, confirmed:units.filter(u=>u.confirmed).length,
    unresolved:units.filter(u=>!u.confirmed).length, rejected:units.filter(u=>u.rejected).length};
}

function proposals(w) {
  // All three options apply to the same wallets; the checklist and team use the same reserve rule.
  return ['hold','checklist','balanced'].map(kind=>{
    const rows=w.merchants.map(m=>{
      const o=w.currentOrders.find(o=>o.merchant===m.id), e=evidenceTotals(w,m.id);
      const verified=kind==='hold'?0:kind==='checklist'?e.initial:e.confirmed;
      const target=(o.units-verified)*1000+verified*200, held=Math.min(o.net,target);
      return {id:m.id,due:o.units,verified,initial:e.initial,unresolved:o.units-verified,before:o.net,
        target,held,release:o.net-held,shortfall:Math.max(0,target-o.net)};
    });
    return {kind,rows,released:total(rows,'release'),held:total(rows,'held'),verified:total(rows,'verified'),
      unresolved:total(rows,'unresolved'),releaseCount:rows.filter(r=>r.release>0).length,eligible:true};
  });
}
const reviewStamp = w => JSON.stringify({cases:w.cases,merchants:w.merchants,orders:w.currentOrders,ledger:w.ledger});

// The paired reference applies a static policy without borrowing the investigator's source queries.
export function prepareBaselineReview(w,kind='hold') {
  if(w.phase!=='debate'||w.queries.length||!['hold','checklist'].includes(kind))throw new Error('Baseline review requires untouched initial evidence.');
  w.plans=proposals(w);w.selectedPlan=kind;w.phase='review';w.reviewStamp=reviewStamp(w);
}

function beginInvestigation(w) {
  w.phase='debate'; w.phaseAt=w.time; w.debateIndex=0; w.nextArgumentAt=w.time; w.baseline=proposals(w)[1];
  advanceInvestigation(w);
}
export function advanceInvestigation(w) {
  if (w.phase!=='debate') throw new Error('Wait for deliveries before investigating.');
  const step=w.debateIndex; let speech;
  if (step===0) {
    const e=evidenceTotals(w);
    speech={role:'Risk',tone:'risk',title:'Missing scans do not prove failure.',text:`${e.unresolved} kits lack proof in the initial feed. Keep the funds held while we check. A PayPal receipt proves payment, not delivery.`};
  } else if (step===1) {
    investigate(w,'carrier'); const e=evidenceTotals(w);
    speech={role:'Evidence',tone:'network',title:'Go back to the carrier records.',text:`I queried ${w.queries.length} missing scans. Matched order and unit IDs recover ${e.confirmed-e.initial} additional delivery proofs. ${e.rejected} “delivered” records belong to a different order and are rejected.`};
  } else if (step===2) {
    investigate(w,'buyer'); const e=evidenceTotals(w);
    speech={role:'Risk',tone:'risk',title:'Challenge the remaining claims.',text:`Receiving offices were queried where carrier proof was missing or wrong. ${e.unresolved} kits remain unverified. An office claim alone does not meet this demo’s rule; keep those funds held for review.`};
  } else if (step===3) {
    w.plans=proposals(w); const p=w.plans[2],baseline=w.plans[1];
    speech={role:'Commerce',tone:'commerce',title:'Release what the evidence supports.',text:`The same reserve rule now permits ${dollars(p.released)}, versus ${dollars(baseline.released)} from the initial feed. That is merchant cash for the next restock—not PayPal profit. I want the recovered proofs acted on.`};
  } else if (step===4) {
    const p=w.plans[2];
    speech={role:'Coordinator',tone:'balanced',title:'Change the hold, not the facts.',text:`Recommend ${p.releaseCount} merchant releases totaling ${dollars(p.released)}. Keep ${dollars(p.held)} of this shift’s net receipts held. Unverified gross stays protected; verified gross keeps a 20% buffer. The reviewer decides.`};
  } else {
    w.phase='review'; w.reviewStamp=reviewStamp(w); return;
  }
  w.debate.push(speech); w.debateIndex++; w.nextArgumentAt=w.time+5;
  log(w,speech.role,speech.title,speech.text);
}

export function applyEvidenceReview(w,kind='balanced',role='human-reviewer') {
  if (w.phase!=='review'||w.approval) throw new Error('A fresh review is required.');
  if (role!=='human-reviewer') throw new Error('Agents recommend; the reviewer authorizes simulated releases.');
  if (w.reviewStamp!==reviewStamp(w)) throw new Error('Evidence or balances changed. Restart the shift before approval.');
  if (!['hold','checklist','balanced'].includes(kind)) throw new Error('Unknown review policy.');
  // Recalculate from observations instead of trusting editable UI proposal objects.
  const p=proposals(w).find(p=>p.kind===kind);
  w.approval={role,kind,at:w.time};w.applied=structuredClone(p);w.phase='settling';w.phaseAt=w.time;w.paused=false;
  for (const r of p.rows) {
    const m=w.merchants.find(m=>m.id===r.id),o=w.currentOrders.find(o=>o.merchant===r.id);
    m.reserve-=r.release;m.cash+=r.release;m.released=r.release;o.held-=r.release;o.released=r.release;
  }
  w.ledger.released+=p.released;
  log(w,'Simulated PayPal reviewer','Reserve review approved',`${dollars(p.released)} moved from each merchant’s own reserve to its cash. No external API call.`);
  assertEvidenceEconomy(w);
}
function closeEvidenceShift(w) {
  for (const m of w.merchants) {
    const o=w.currentOrders.find(o=>o.merchant===m.id),refund=(m.due-m.delivered)*1000;
    let left=refund;
    const ownHeld=Math.min(left,o.held);o.held-=ownHeld;m.reserve-=ownHeld;left-=ownHeld;
    const cash=Math.min(left,m.cash);m.cash-=cash;left-=cash;
    const priorHeld=Math.min(left,m.reserve);m.reserve-=priorHeld;left-=priorHeld;
    m.refunded=refund;m.coverage=left;o.refunded=refund;o.status=refund?'REFUND_WINDOW_CLOSED':'FULFILLED';
    w.ledger.refunds+=refund;w.ledger.paypalCoverage+=left;
  }
  const h={shift:w.shift+1,policy:w.applied.kind,paid:total(w.merchants,'due'),delivered:total(w.merchants,'delivered'),
    released:w.applied.released,reviewHeld:w.applied.held,reserveAfterRefunds:total(w.merchants,'reserve'),
    refunds:w.ledger.refunds-w.shiftOpening.refunds,coverage:w.ledger.paypalCoverage-w.shiftOpening.paypalCoverage,
    evidence:evidenceTotals(w),queries:w.queries.length,fees:w.ledger.feesCollected-w.shiftOpening.feesCollected,
    nextBuyingPower:total(w.merchants,m=>Math.floor(m.cash/(REVIEW_SHIFTS[w.shift+1]?.price??480)))};
  w.history.push(h);w.reviewHistory.push({shift:w.shift+1,orders:structuredClone(w.currentOrders),cases:structuredClone(w.cases),queries:structuredClone(w.queries),proposals:structuredClone(w.plans),applied:structuredClone(w.applied)});
  w.phase='settled';log(w,'Environment','Refund window closed',`${dollars(h.refunds)} synthetic refunds for actual undelivered units. ${dollars(h.coverage)} modeled provider shortfall. Released cash and remaining reserves carry forward.`);
  assertEvidenceEconomy(w);
}
export function tickEvidenceEconomy(w,delta) {
  if(w.paused)return;
  const dt=Math.max(0,Math.min(.1,delta))*w.speed;
  w.time+=dt;
  if(w.phase==='orders'&&w.time-w.phaseAt>=3)dispatch(w);
  if(w.phase==='debate'&&w.time>=w.nextArgumentAt)advanceInvestigation(w);
  if(w.phase==='settling'&&w.time-w.phaseAt>=4)closeEvidenceShift(w);
  if(w.phase!=='delivery')return;
  for(const d of w.shipments) {
    if(d.stage==='complete')continue;
    if(d.delay>0){d.delay-=dt;continue;}
    if(d.stage==='packing'){d.wait+=dt;if(d.wait>=1.2){d.stage='office';d.progress=0;}continue;}
    d.progress=Math.min(1,d.progress+dt/1.8);
    if(d.progress<1)continue;
    if(d.stage==='pickup'){d.stage='merchant';d.progress=0;}
    else if(d.stage==='merchant'){d.stage='packing';d.progress=0;}
    else {d.stage='complete';for(const id of d.members)arrive(w,w.merchants.find(m=>m.id===id));}
  }
  if(w.merchants.every(m=>m.settled))beginInvestigation(w);
}
export function assertEvidenceEconomy(w) {
  const l=w.ledger, money=[...Object.values(l),...w.merchants.flatMap(m=>[m.cash,m.reserve])];
  if(money.some(n=>!Number.isSafeInteger(n)||n<0))throw new Error('Invalid simulated money.');
  if(total(w.merchants,m=>m.cash+m.reserve)+l.feesCollected+l.supplierPaid+l.refunds!==l.openingCapital+l.captured+l.paypalCoverage)throw new Error('Replay ledger does not reconcile.');
  if(w.warehouses.some(s=>s.stock<0||!Number.isInteger(s.stock)))throw new Error('Invalid inventory.');
  if(total(w.warehouses,s=>s.opening-s.stock)!==total(w.merchants,'purchased'))throw new Error('Procurement does not reconcile.');
  if(w.phase==='settled'&&w.currentOrders.some(o=>o.delivered*1000+o.refunded!==o.amount))throw new Error('Orders do not reconcile.');
  return true;
}
export function exportEvidenceEconomy(w) {
  const snapshot=structuredClone(w);delete snapshot.reviewStamp;delete snapshot.baseline;
  return {...snapshot,disclosure:'One previously verified PayPal sandbox receipt is reused as a reference in a simulated ledger. No checkout, capture, or PayPal reserve API runs in this economy. All other orders, carrier and office records, delivery outcomes, fees, holds, releases and refunds are generated. Agents are scripted and cannot access hidden outcomes. Authored reserve rule: unresolved gross + 20% verified gross, capped at that order’s net proceeds. Both initial-feed and investigated options use this same rule. No production benefit or LLM advantage is established.'};
}
