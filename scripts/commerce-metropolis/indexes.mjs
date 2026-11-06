const cache=new WeakMap();
export function invalidateDay(w){const c=cache.get(w);if(c)c.exposureKey=null;}
const grouped=(map,key,row)=>{if(!map.has(key))map.set(key,[]);map.get(key).push(row);};
export function indexWorld(w){
  let c=cache.get(w);
  if(!c||c.productArray!==w.products){
    c={productArray:w.products,products:new Map(w.products.map(p=>[p.id,p])),people:new Map(w.people.map(p=>[p.id,p])),
      productsByMerchant:new Map(),productsByCatalog:new Map(),requestsByCustomer:new Map(),ordersByCustomer:new Map(),contactsByCustomer:new Map(),signalsByCustomer:new Map(),needsByCustomer:new Map(),
      counts:{},arrays:{},requests:new Map(),orders:new Map(),procurements:new Map()};
    for(const p of w.products){grouped(c.productsByMerchant,p.merchantId,p);grouped(c.productsByCatalog,p.catalogId,p);}
    cache.set(w,c);
  }
  for(const [name,rows,groups] of [['requests',w.requests,'requestsByCustomer'],['orders',w.orders,'ordersByCustomer'],['procurements',w.procurements,null],
    ['contacts',w.growth?.contacts??[],'contactsByCustomer'],['signals',w.growth?.signals??[],'signalsByCustomer'],['needs',w.growth?.needs??[],'needsByCustomer']]){
    if(c.arrays[name]!==rows){c.counts[name]=0;c.arrays[name]=rows;if(c[name] instanceof Map)c[name].clear();if(groups)c[groups].clear();}
    for(let i=c.counts[name]??0;i<rows.length;i++){
      const row=rows[i];if(c[name] instanceof Map)c[name].set(row.id,row);if(groups)grouped(c[groups],row.customerId??row.request.customerId,row);
    }
    c.counts[name]=rows.length;
  }
  return c;
}
export function merchantExposure(w,id){
  const c=indexWorld(w),signature=w.day+':'+w.orders.length+':'+w.liabilities.length;
  if(c.exposureKey!==signature){
    c.exposureKey=signature;c.exposure=new Map(w.merchants.map(m=>[m.id,{owed:0,refundable:0}]));
    for(const o of w.orders)for(const m of o.merchants){const e=c.exposure.get(m.id);if(o.refundStatus==='PENDING_FUNDS')e.owed+=m.grossCents;if(o.day+14>w.day&&!o.refundStatus)e.refundable+=m.grossCents;}
    for(const l of w.liabilities)if(l.status==='HOLDING_COST_DUE')c.exposure.get(l.merchantId).owed+=l.amountCents;
  }
  return c.exposure.get(id);
}
