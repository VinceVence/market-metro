// Seeded commerce simulation. No model calls and no network or payment authority.
export const CHANNELS = ['search', 'social', 'email', 'direct'];
export const DISTRICTS = ['Exchange Quarter', 'Studio Mile', 'Foundry Park'];
export const SAMPLE_PRODUCTS = [
  ['Paper & Co.', 'Office', 'Grid notebook set', 1800, '📓'], ['Deskform', 'Office', 'Desk organizer', 2400, '▦'],
  ['Orbit Audio', 'Electronics', 'Wireless headphones', 6900, '◉'], ['Circuit House', 'Electronics', 'USB-C desk hub', 3900, '⌘'],
  ['Field Supply', 'Outdoor', 'Everyday backpack', 4800, '◈'], ['Trail Works', 'Outdoor', 'Insulated bottle', 2200, '◒'],
  ['Thread Studio', 'Fashion', 'Everyday cotton tee', 2900, '✦'], ['Sunday Goods', 'Fashion', 'Canvas tote', 1900, '◇'],
  ['Hearth Market', 'Home', 'Ceramic mug pair', 2600, '◡'], ['Lumen Living', 'Home', 'Reading lamp', 5400, '☀'],
  ['Bloom Apothecary', 'Beauty', 'Hand care set', 3100, '✿'], ['Good Ritual', 'Beauty', 'Daily essentials kit', 4200, '◎'],
].map(([brand, category, title, priceCents, symbol], i) => ({ id: `sample-${i+1}`, brand, category, title,
  priceCents, currency: 'USD', symbol, imageUrl: '', sourceUrl: '', source: 'AUTHORED_SAMPLE', channel3Id: null }));

export function random(world) {
  world.rng = (Math.imul(world.rng, 1664525) + 1013904223) >>> 0;
  return world.rng / 4294967296;
}
const pick = (w, array) => array[Math.floor(random(w) * array.length)];
const money = n => Math.max(0, Math.round(n));
export function eventDate(iso) { return new Date(Date.parse(iso) + 8 * 3600000).toISOString().slice(0, 10); }
export function createMarket({ runId, seed = 42, merchantCount = 24, customerCount = 600, days = 3, catalog = SAMPLE_PRODUCTS, sandboxLimit = 3, startedAt = new Date().toISOString() }) {
  const world = { runId, seed, rng: seed >>> 0, tick: 0, totalTicks: days * 24, status: 'READY', startedAt,
    sandboxLimit, sandboxAssigned: 0, promotion: false, shock: null, sequence: 0, merchants: [], products: [], customers: [], campaigns: [], pending: [], inventory: {}, stats: { revenueCents: 0, refundsCents: 0, feesCents: 0, costCents: 0, deliveryCostCents: 0, spendCents: 0, orders: 0, units: 0, impressions: 0, clicks: 0, carts: 0, deliveries: 0, stockouts: 0 } };
  const products = catalog.filter(p => p.currency === 'USD' && Number.isSafeInteger(p.priceCents) && p.priceCents > 0 && p.priceCents <= 200000);
  if (!products.length) throw new Error('Catalog has no usable USD products.');
  for (let i = 0; i < merchantCount; i++) {
    const ref = products[i % products.length], suffix = i >= products.length ? ` ${Math.floor(i/products.length)+1}` : '';
    const merchant = { merchant_id: `${runId}-M${String(i+1).padStart(3,'0')}`, run_id: runId,
      name: `${ref.brand || 'Market House'}${suffix}`, district: DISTRICTS[Math.floor(i/8)%3], category: ref.category || 'General',
      position: i, starting_cash_cents: 250000, source: 'SIMULATED_MERCHANT', paypal_account_mapping: 'SINGLE_CONNECTED_SANDBOX_STORE',
      color: ['#f6b56b','#8cc5f5','#b0d9c0','#c3b1ee','#f2a9b9','#e8cf86'][i%6], sold: 0, revenue: 0, stock: 0 };
    world.merchants.push(merchant);
    for (let j=0;j<3;j++) {
      const item = products[(i+j*5)%products.length];
      const product = { product_id: `${runId}-P${i*3+j+1}`, run_id: runId, merchant_id: merchant.merchant_id,
        channel3_product_id: item.channel3Id || null, title: item.title, brand: item.brand || '', category: item.category || 'General',
        currency: 'USD', price_cents: item.priceCents, cost_cents: money(item.priceCents * (.42 + random(world)*.16)),
        source: item.source, source_url: item.sourceUrl || '', image_url: item.imageUrl || '', symbol: item.symbol || '◈',
        initial_stock: 16 + Math.floor(random(world)*28), cost_assumption: 'Authored: 42–58% of catalog price', retrieved_at: item.retrievedAt || null };
      world.products.push(product); world.inventory[product.product_id] = product.initial_stock; merchant.stock += product.initial_stock;
    }
    for (const channel of CHANNELS.slice(0,3)) world.campaigns.push({ campaign_id: `${runId}-C${i*3+CHANNELS.indexOf(channel)+1}`,
      run_id: runId, merchant_id: merchant.merchant_id, name: `${merchant.name} · ${channel}`, channel,
      objective: 'PROFITABLE_PURCHASES', daily_budget_cents: 1800, spend_cents: 0, status: 'ACTIVE', policy: 'SCRIPTED',
      creative: channel === 'search' ? 'Find your everyday essential' : channel === 'social' ? 'A little upgrade for your day' : 'Your next favorite is here' });
  }
  const segments = ['Office teams', 'Value seekers', 'Creative shoppers', 'Weekend explorers'];
  for (let i=0;i<customerCount;i++) world.customers.push({ customer_id: `${runId}-U${String(i+1).padStart(4,'0')}`,
    run_id: runId, segment: segments[i%4], budget_cents: 3000 + Math.floor(random(world)*18000), source: 'SYNTHETIC', last_purchase_tick: -10, purchases: 0 });
  return world;
}

export function advanceMarket(world) {
  if (world.tick >= world.totalTicks) { world.status='COMPLETED'; return { rows: {}, activities: [] }; }
  world.status='RUNNING';
  const tick = world.tick++, stamp = new Date(Date.parse(world.startedAt)+tick*3600000).toISOString();
  const date = eventDate(stamp), rows = { events: [], orders: [], order_items: [], transactions: [], refunds: [], deliveries: [], inventory_movements: [], campaign_spend: [] }, activities=[];
  const uid = prefix => `${world.runId}-${prefix}${++world.sequence}`;
  const event = (type, m, u=null, p=null, c=null, order=null, detail={}) => {
    rows.events.push({ event_id:uid('E'), run_id:world.runId, event_ts:stamp,event_date:date, merchant_id:m?.merchant_id||null,
      customer_id:u?.customer_id||null, product_id:p?.product_id||null,campaign_id:c?.campaign_id||null,order_id:order,
      channel:c?.channel||'direct', event_type:type, detail_json:JSON.stringify(detail), source:'SIMULATED' });
  };
  const movement=(p,quantity,type,orderId=null)=>rows.inventory_movements.push({movement_id:uid('I'),run_id:world.runId,product_id:p.product_id,merchant_id:p.merchant_id,order_id:orderId,event_ts:stamp,event_date:date,quantity,reason:type,source:'SIMULATED'});
  for (const delivery of world.pending.filter(x=>x.due <= tick)) {
    const m=world.merchants.find(x=>x.merchant_id===delivery.merchantId),p=world.products.find(x=>x.product_id===delivery.productId);
    const u=world.customers.find(x=>x.customer_id===delivery.customerId), c=world.campaigns.find(x=>x.campaign_id===delivery.campaignId);
    rows.deliveries.push({delivery_id:uid('D'),run_id:world.runId,order_id:delivery.orderId,merchant_id:m.merchant_id,event_ts:stamp,event_date:date,units:delivery.units,status:'DELIVERED',source:'SIMULATED'});
    world.stats.deliveries++; event('delivered',m,u,p,c,delivery.orderId,{units:delivery.units});
    activities.push({type:'delivery',merchantId:m.merchant_id,merchant:m.name,amount:delivery.gross,units:delivery.units,orderId:delivery.orderId});
    if(delivery.refund) {
      rows.refunds.push({refund_id:uid('R'),run_id:world.runId,order_id:delivery.orderId,transaction_id:delivery.transactionId,merchant_id:m.merchant_id,event_ts:stamp,event_date:date,amount_cents:delivery.gross,currency:'USD',reason:'Buyer return',source:'SIMULATED'});
      world.stats.refundsCents+=delivery.gross; event('refunded',m,u,p,c,delivery.orderId,{amount_cents:delivery.gross});
      // Returned units are not resold during this short run; original COGS stays in contribution.
      activities.push({type:'refund',merchantId:m.merchant_id,merchant:m.name,amount:delivery.gross,orderId:delivery.orderId});
    }
  }
  world.pending=world.pending.filter(x=>x.due>tick);
  if(tick%12===0 && tick>0) for(const p of world.products) {
    if(world.inventory[p.product_id]>=12 || world.shock==='supply') continue;
    const qty=20;world.inventory[p.product_id]+=qty;movement(p,qty,'RESTOCK');
    const m=world.merchants.find(x=>x.merchant_id===p.merchant_id);m.stock+=qty;
    event('restocked',m,null,p,null,null,{units:qty});activities.push({type:'restock',merchantId:m.merchant_id,merchant:m.name,units:qty});
  }
  if(tick>=world.totalTicks-1){world.status='COMPLETED';return {rows,activities:activities.slice(-100)};}
  const hour=(new Date(stamp).getUTCHours()+8)%24;
  const traffic=hour>=8&&hour<=22 ? 1 : .25;
  for(const m of world.merchants) {
    const stock=world.products.filter(p=>p.merchant_id===m.merchant_id);
    const campaigns=world.campaigns.filter(c=>c.merchant_id===m.merchant_id);
    const n=Math.max(1,Math.round((3+random(world)*7)*traffic*(world.shock==='payday'?1.65:1)));
    for(let j=0;j<n;j++) {
      const u=pick(world,world.customers),p=pick(world,stock),channel=pick(world,CHANNELS);
      let c=campaigns.find(x=>x.channel===channel)||null;
      if(c && c.spend_cents >= c.daily_budget_cents*(Math.floor(tick/24)+1)) c=null;
      const adCost=c?Math.min(channel==='search'?18:channel==='social'?10:3,c.daily_budget_cents*(Math.floor(tick/24)+1)-c.spend_cents):0;
      if(c){c.spend_cents+=adCost;world.stats.spendCents+=adCost;rows.campaign_spend.push({spend_id:uid('A'),run_id:world.runId,campaign_id:c.campaign_id,merchant_id:m.merchant_id,event_ts:stamp,event_date:date,channel:c.channel,amount_cents:adCost,currency:'USD',source:'SIMULATED'});}
      world.stats.impressions++;event('impression',m,u,p,c);
      if(random(world)>(world.promotion ? .60 : .42))continue;
      world.stats.clicks++;event('product_view',m,u,p,c);activities.push({type:'visit',merchantId:m.merchant_id,merchant:m.name,customerId:u.customer_id});
      if(random(world)>.64)continue;
      world.stats.carts++;event('add_to_cart',m,u,p,c);
      const units=random(world)<.18?2:1, subtotal=p.price_cents*units;
      const discount=world.promotion?money(subtotal*.08):0, shipping=subtotal>=6000?0:450;
      const gross=subtotal-discount+shipping, rate=world.shock==='competition' ? .37 : .60;
      if(world.inventory[p.product_id]<units){world.stats.stockouts++;event('stockout',m,u,p,c);continue;}
      if(gross>u.budget_cents || random(world)>rate){event('cart_abandoned',m,u,p,c,null,{reason:gross>u.budget_cents?'BUDGET':'NO_PURCHASE'});continue;}
      const oid=uid('O'),tid=uid('T'), fee=money(gross*.0349)+49, cost=p.cost_cents*units,deliveryCost=350;
      const mirror=world.sandboxAssigned < world.sandboxLimit && gross <= 50000;
      if(mirror)world.sandboxAssigned++;
      rows.orders.push({order_id:oid,run_id:world.runId,merchant_id:m.merchant_id,customer_id:u.customer_id,campaign_id:c?.campaign_id||null,event_ts:stamp,event_date:date,channel:c?.channel||'direct',currency:'USD',subtotal_cents:subtotal,discount_cents:discount,shipping_cents:shipping,total_cents:gross,cost_cents:cost,delivery_cost_cents:deliveryCost,status:'PAID',source:'SIMULATED',sandbox_requested:mirror?1:0});
      rows.order_items.push({order_item_id:uid('L'),run_id:world.runId,order_id:oid,product_id:p.product_id,quantity:units,unit_price_cents:p.price_cents,line_total_cents:subtotal});
      rows.transactions.push({transaction_id:tid,run_id:world.runId,order_id:oid,merchant_id:m.merchant_id,event_ts:stamp,event_date:date,currency:'USD',gross_cents:gross,fee_cents:fee,net_cents:gross-fee,status:'COMPLETED',source:'SIMULATED',fee_assumption:'3.49% + $0.49; demo assumption, not a quoted PayPal rate'});
      event('checkout_started',m,u,p,c,oid);event('purchase',m,u,p,c,oid,{amount_cents:gross,units});
      world.inventory[p.product_id]-=units;m.stock-=units;movement(p,-units,'SALE',oid);m.sold+=units;m.revenue+=gross;u.purchases++;u.last_purchase_tick=tick;
      const s=world.stats;s.orders++;s.units+=units;s.revenueCents+=gross;s.feesCents+=fee;s.costCents+=cost;s.deliveryCostCents+=deliveryCost;
      world.pending.push({orderId:oid,transactionId:tid,merchantId:m.merchant_id,customerId:u.customer_id,productId:p.product_id,campaignId:c?.campaign_id||null,units,gross,due:Math.min(world.totalTicks-1,tick+2+Math.floor(random(world)*5)),refund:random(world)<.035});
      activities.push({type:'purchase',merchantId:m.merchant_id,merchant:m.name,customerId:u.customer_id,amount:gross,product:p.title,orderId:oid,sandbox:mirror});
    }
  }
  // The final hour drains all scheduled deliveries without creating unfulfillable final-hour sales.
  if(world.tick>=world.totalTicks)world.status='COMPLETED';
  return {rows,activities:activities.slice(-100)};
}

export function marketFrame(world) {
  const s=world.stats;
  return {runId:world.runId,seed:world.seed,status:world.status,tick:world.tick,totalTicks:world.totalTicks,startedAt:world.startedAt,
    eventTs:new Date(Date.parse(world.startedAt)+Math.max(0,world.tick-1)*3600000).toISOString(),promotion:world.promotion,shock:world.shock,
    stats:{...s,contributionCents:s.revenueCents-s.refundsCents-s.feesCents-s.costCents-s.deliveryCostCents-s.spendCents},
    merchantCount:world.merchants.length,customerCount:world.customers.length,merchants:world.merchants, sandboxLimit:world.sandboxLimit,
    products:world.products.map(p=>({...p,stock:world.inventory[p.product_id]}))};
}
