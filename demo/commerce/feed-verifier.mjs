// A small reviewed commerce ontology. Source descriptions and declared keys are
// evidence. Coincidentally equal values or similar-looking IDs cannot certify a join.
const terms = {
  checkout: ['shopper checkout', 'customer basket', 'buyer purchase'],
  leg: ['merchant order', 'seller portion', 'merchant allocation'],
  checkoutGross: ['checkout gross', 'basket total before refunds', 'gross shopper charge'],
  legGross: ['merchant order gross', 'seller share before fees', 'allocated gross'],
  seller: ['merchant identifier', 'seller identifier', 'store reference'],
  checkoutRef: ['shopper checkout reference', 'parent basket identifier', 'buyer purchase reference']
};
const fixedNames = {
  checkout: ['autonomy_baskets','baskets','checkouts'], leg: ['orders','merchant_orders','order_rows'],
  checkoutId: ['basket_id','checkout_id'], legId: ['order_id','merchant_order_id'],
  checkoutGross: ['gross_cents','checkout_gross','basket_total'], legGross: ['total_cents','leg_gross','merchant_total'],
  seller: ['merchant_id','seller_id'], checkoutRef: ['basket_id','checkout_id']
};
const fold = s => typeof s === 'string' ? s.toLowerCase().replace(/[\s_-]+/g,'') : '';
const matches = (value,options) => options.some(option=>fold(option)===fold(value));

class Hold extends Error {
  constructor(code, reason){super(reason);this.code=code;}
}
function requireFact(condition,code,reason){if(!condition)throw new Hold(code,reason);}
function one(items,code,what){
  requireFact(items.length===1,code,`Expected exactly one ${what}. Found ${items.length}.`);
  return items[0];
}
const id = value => typeof value==='string' && value.length>0 && value.length<=256 && value.trim()===value;
function add(a,b){
  const sum=a+b;
  requireFact(Number.isSafeInteger(sum),'amount-range','The monetary total exceeds the safe integer range.');
  return sum;
}
function cents(value,unit){
  requireFact(['number','string'].includes(typeof value),'amount-format','A monetary field must contain a numeric amount.');
  const text=String(value);
  requireFact((unit==='USD cents'?/^\d+$/:/^\d+(?:\.\d{1,2})?$/).test(text),
    'amount-format','A gross amount must be nonnegative and exact to one US cent.');
  const [whole,fraction='']=text.split('.');
  const amount=Number(unit==='USD cents'?whole:whole+fraction.padEnd(2,'0'));
  requireFact(Number.isSafeInteger(amount),'amount-range','A gross amount exceeds the safe integer range.');
  return amount;
}
function inspectTable(raw){
  requireFact(raw && id(raw.name) && id(raw.primaryKey) && Array.isArray(raw.columns) && raw.columns.length>0 && raw.columns.length<=32 &&
    Array.isArray(raw.foreignKeys) && Array.isArray(raw.rows) && raw.rows.length<=20000,'invalid-table','A table needs a name, primary key, columns, foreign keys and bounded rows.');
  const indexes=new Map();
  for(const [i,c] of raw.columns.entries()){
    requireFact(c && id(c.name) && !indexes.has(c.name),'column-identity','Each column needs a unique physical name.');
    indexes.set(c.name,i);
  }
  requireFact(indexes.has(raw.primaryKey),'missing-primary-key','The declared primary key is missing from the columns.');
  for(const fk of raw.foreignKeys)requireFact(fk && indexes.has(fk.column) && id(fk.toTable) && id(fk.toColumn),
    'invalid-relationship','A relationship refers to an unknown column or table identifier.');
  requireFact(raw.rows.every(row=>Array.isArray(row)&&row.length===raw.columns.length),'row-shape','A record does not match its declared columns.');
  for(const [i,c] of raw.columns.entries())if(matches(c.description,['currency','currency code'])||matches(c.name,['currency','currency_code'])){
    requireFact(raw.rows.every(row=>row[i]==='USD'),'currency-conflict','A row currency conflicts with the USD export.');
  }
  return {...raw,at:(row,column)=>row[indexes.get(column)]};
}
function bind(feed,mode){
  requireFact(feed?.version===1 && id(feed.runId) && feed.currency==='USD' && feed.measure==='gross at capture' && feed.complete===true,
    'scope','Supply a complete, single-run USD export of gross amounts at capture.');
  requireFact(Array.isArray(feed.tables) && [1,2].includes(feed.tables.length),'table-scope','Supply the checkout and merchant-order tables, or one flat merchant-order export.');
  const tables=feed.tables.map(inspectTable);
  requireFact(new Set(tables.map(t=>t.name)).size===tables.length,'table-identity','The table names must be distinct.');
  const fixed=mode==='fixed';
  function table(role){
    const candidate=one(tables.filter(t=>fixed?matches(t.name,fixedNames[role]):matches(t.grain,terms[role])),
      'table-binding',`table for the ${role==='leg'?'merchant-order':'shopper-checkout'} grain`);
    requireFact(matches(candidate.grain,terms[role]),'grain','The source grain conflicts with the expected business definition.');
    if(fixed)requireFact(matches(candidate.primaryKey,fixedNames[role==='leg'?'legId':'checkoutId']),
      'fixed-key','The primary key is outside the fixed field map.');
    return candidate;
  }
  function field(t,role){
    const c=one(t.columns.filter(c=>fixed?matches(c.name,fixedNames[role]):matches(c.description,terms[role])),
      'field-binding',`column for “${terms[role][0]}” in ${t.name}`);
    requireFact(matches(c.description,terms[role]),'field-definition','The physical field conflicts with its declared meaning.');
    if(fixed)one(t.columns.filter(c=>matches(c.description,terms[role])),'field-binding',`documented definition of “${terms[role][0]}” in ${t.name}`);
    if(role.endsWith('Gross')){
      requireFact(['USD','USD cents'].includes(c.unit),'unit-unknown',`Declare whether ${t.name}.${c.name} contains US dollars or integer US cents.`);
      requireFact(!fold(c.name).endsWith('cents')||c.unit==='USD cents','unit-conflict','The cents column conflicts with its declared dollar unit.');
    }
    return c;
  }
  const legs=table('leg'),baskets=tables.length===2?table('checkout'):null;
  const basketMoney=field(baskets??legs,'checkoutGross'),legMoney=field(legs,'legGross'),seller=field(legs,'seller');
  let parentKey;
  if(baskets){
    requireFact(baskets!==legs && baskets.foreignKeys.length===0,'grain','The checkout table must be the parent of merchant orders.');
    const fk=one(legs.foreignKeys,'ambiguous-link','declared merchant-order to checkout relationship');
    requireFact(fk.toTable===baskets.name && fk.toColumn===baskets.primaryKey,'wrong-link','Merchant orders must link to the declared shopper-checkout primary key.');
    parentKey=fk.column;
    requireFact(matches(legs.columns.find(c=>c.name===parentKey).description,terms.checkoutRef),'key-definition','The foreign key must identify a shopper checkout in the source dictionary.');
    if(fixed)requireFact(matches(parentKey,fixedNames.checkoutRef),'fixed-key','The checkout link is outside the fixed field map.');
  }else{
    requireFact(legs.foreignKeys.length===0,'missing-parent','A flat export cannot certify a reference to a missing parent table.');
    parentKey=field(legs,'checkoutRef').name;
  }
  const roleColumns=[legs.primaryKey,parentKey,legMoney.name,seller.name,...(baskets?[]:[basketMoney.name])];
  requireFact(new Set(roleColumns).size===roleColumns.length && (!baskets||baskets.primaryKey!==basketMoney.name),
    'overlapping-roles','One column cannot supply two independent business facts.');
  return {legs,baskets,basketMoney,legMoney,seller,parentKey};
}

function reconcile(mapping){
  const {legs,baskets,basketMoney,legMoney,seller,parentKey}=mapping;
  const parents=new Map(),orders=new Map();
  const parent=(key,gross)=>({key,gross,legTotal:0,orders:[],sellers:new Set()});
  if(baskets)for(const row of baskets.rows){
    const key=baskets.at(row,baskets.primaryKey);
    requireFact(id(key)&&!parents.has(key),'duplicate-checkout','A shopper-checkout key is empty or duplicated.');
    parents.set(key,parent(key,cents(baskets.at(row,basketMoney.name),basketMoney.unit)));
  }
  for(const row of legs.rows){
    const key=legs.at(row,legs.primaryKey),basketKey=legs.at(row,parentKey),merchant=legs.at(row,seller.name);
    requireFact(id(key)&&!orders.has(key),'duplicate-order','A merchant-order key is empty or duplicated.');
    requireFact(id(basketKey)&&id(merchant),'missing-identity','Every merchant order needs an explicit checkout and seller identity.');
    if(!baskets){
      const gross=cents(legs.at(row,basketMoney.name),basketMoney.unit);
      if(!parents.has(basketKey))parents.set(basketKey,parent(basketKey,gross));
      requireFact(parents.get(basketKey).gross===gross,'conflicting-checkout','Rows for one checkout disagree about its total.');
    }
    const p=parents.get(basketKey);
    requireFact(p,'orphan-order','A merchant order points to a checkout missing from the export.');
    requireFact(!p.sellers.has(merchant),'repeated-seller','Two rows claim the same seller portion of one checkout.');
    const gross=cents(legs.at(row,legMoney.name),legMoney.unit);
    p.legTotal=add(p.legTotal,gross);p.orders.push(key);p.sellers.add(merchant);
    orders.set(key,{key,basketKey,merchant,gross});
  }
  let grossCents=0,splitBaskets=0,splitExample=null;
  for(const p of parents.values()){
    requireFact(p.orders.length>0 && p.gross===p.legTotal,'gross-disagreement',
      'Every checkout must have merchant portions that sum exactly to its gross amount.');
    grossCents=add(grossCents,p.gross);
    if(p.orders.length>1){
      splitBaskets++;
      splitExample??={basket:p.key,grossCents:p.gross,legs:p.orders.map(k=>orders.get(k))};
    }
  }
  return {parents,orders,splitExample,metrics:{purchases:parents.size,merchantOrders:orders.size,splitBaskets,grossCents}};
}

function corroborate(feed,r,{orders,parents}){
  requireFact(r.source==='PAYPAL_SANDBOX'&&r.status==='COMPLETED'&&r.currency==='USD'&&r.run_id===feed.runId &&
    [r.capture_id,r.paypal_order_id].every(v=>typeof v==='string'&&/^[A-Z0-9]{8,32}$/.test(v)) && id(r.receipt_id) &&
    id(r.verified_at) && Number.isFinite(Date.parse(r.verified_at)),'receipt-provenance','The archived Sandbox evidence has the wrong scope or verification status.');
  const leg=orders.get(r.order_id);
  requireFact(leg && leg.merchant===r.merchant_id && leg.gross===r.gross_cents,'receipt-order','The saved capture must match the exact merchant order, seller and amount.');
  requireFact([r.gross_cents,r.fee_cents,r.net_cents].every(n=>Number.isSafeInteger(n)&&n>=0) &&
    add(r.fee_cents,r.net_cents)===r.gross_cents,'receipt-money','The native fee and merchant proceeds must reconcile to the captured amount.');
  return {source:r.source,capture:r.capture_id,providerOrder:r.paypal_order_id,merchantOrder:leg.key,
    basket:leg.basketKey,basketGrossCents:parents.get(leg.basketKey).gross,grossCents:r.gross_cents,
    feeCents:r.fee_cents,netCents:r.net_cents,extraPurchases:0,extraGrossCents:0};
}

// The caller supplies trusted, independently archived provider evidence, never a receipt inside the feed.
export function verifyMerchantFeed(feed,{mode='ontology',receipt=null}={}){
  if(!['fixed','ontology'].includes(mode))throw new TypeError('Unknown mapping strategy');
  try{
    const m=bind(feed,mode),r=reconcile(m);
    const payment=receipt?corroborate(feed,receipt,r):null;
    return {decision:'CERTIFY',mode,metrics:r.metrics,splitExample:r.splitExample,payment,
      mapping:{layout:m.baskets?'relational':'flat',checkoutTable:m.baskets?.name??m.legs.name,
        checkoutKey:m.baskets?.primaryKey??m.parentKey,orderTable:m.legs.name,orderKey:m.legs.primaryKey,
        orderToCheckout:m.parentKey,seller:m.seller.name,checkoutGross:m.basketMoney.name,checkoutUnit:m.basketMoney.unit,
        orderGross:m.legMoney.name,orderUnit:m.legMoney.unit}};
  }catch(error){
    if(!(error instanceof Hold))throw error;
    return {decision:'HOLD',mode,code:error.code,reason:error.message,metrics:null,payment:null};
  }
}
