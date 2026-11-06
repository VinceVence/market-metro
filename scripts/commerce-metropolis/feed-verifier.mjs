import {verifyMerchantFeed} from '../../demo/commerce/feed-verifier.mjs';
const hold=(code,reason)=>({decision:'HOLD',mode:'ontology',code,reason,metrics:null,payment:null});

// Preserve the existing schema and accounting checks. Each page contains whole
// checkouts, and global key checks prevent duplicates from crossing page boundaries.
export function verifyLargeFeed(feed){
  if(!Array.isArray(feed?.tables)||feed.tables.every(t=>Array.isArray(t?.rows)&&t.rows.length<=20000))return verifyMerchantFeed(feed);
  if(feed.tables.some(t=>!Array.isArray(t?.rows)||t.rows.length>1000000))return hold('feed-capacity','The export exceeds the supported live-market bound.');
  const schema=verifyMerchantFeed({...feed,tables:feed.tables.map(t=>({...t,rows:[]}))});
  if(schema.decision!=='CERTIFY')return schema;
  const m=schema.mapping,legs=feed.tables.find(t=>t.name===m.orderTable),parents=m.layout==='relational'?feed.tables.find(t=>t.name===m.checkoutTable):null;
  const column=(t,name)=>t.columns.findIndex(c=>c.name===name),parentIndex=parents?column(parents,m.checkoutKey):-1;
  const link=column(legs,m.orderToCheckout),orderIndex=column(legs,m.orderKey),orders=new Set(),groups=new Map();
  if(parents)for(const row of parents.rows){
    if(!Array.isArray(row)||row.length!==parents.columns.length)return hold('row-shape','A parent row has the wrong shape.');
    if(groups.has(row[parentIndex]))return hold('duplicate-checkout','A checkout key appears more than once across the export.');
    groups.set(row[parentIndex],{parent:row,legs:[]});
  }
  for(const row of legs.rows){
    if(!Array.isArray(row)||row.length!==legs.columns.length)return hold('row-shape','A merchant-order row has the wrong shape.');
    if(orders.has(row[orderIndex]))return hold('duplicate-order','A merchant-order key is repeated across the export.');orders.add(row[orderIndex]);
    if(!groups.has(row[link])){if(parents)return hold('orphan-order','A merchant order refers to a missing checkout.');groups.set(row[link],{legs:[]});}
    groups.get(row[link]).legs.push(row);
  }
  const metrics={purchases:0,merchantOrders:0,splitBaskets:0,grossCents:0};let batch=[],rows=0,pages=0,splitExample=null;
  function verifyPage(){
    if(!batch.length)return null;
    const result=verifyMerchantFeed({...feed,tables:parents?[{...parents,rows:batch.map(g=>g.parent)},{...legs,rows:batch.flatMap(g=>g.legs)}]:[{...legs,rows:batch.flatMap(g=>g.legs)}]});
    if(result.decision!=='CERTIFY')return result;
    for(const key of Object.keys(metrics)){metrics[key]+=result.metrics[key];if(!Number.isSafeInteger(metrics[key]))return hold('amount-range','The total exceeds the integer money range.');}
    splitExample??=result.splitExample;pages++;batch=[];rows=0;return null;
  }
  for(const group of groups.values()){
    if(group.legs.length>20000)return hold('feed-capacity','A single checkout exceeds the per-page limit.');
    if(batch.length>=1000||rows+group.legs.length>18000){const error=verifyPage();if(error)return error;}
    batch.push(group);rows+=group.legs.length;
  }
  const error=verifyPage();if(error)return error;
  return {...schema,metrics,splitExample,pages,reason:'Every checkout and merchant portion reconciled across '+pages+' bounded pages.'};
}
