// Merchant exports expose only physical schema, source documentation and rows.
// The generating checkout ledger and expected answers are kept outside the input.
import {createHash} from 'node:crypto';
const token=(seed,key)=>createHash('sha256').update(seed+'/'+key).digest('hex').slice(0,12);
const integer=(seed,key,max)=>parseInt(token(seed,key).slice(0,8),16)%max;
const dollars=n=>Math.floor(n/100)+'.'+String(n%100).padStart(2,'0');

export function syntheticLedger(seed){
  const runId='MERCHANT-'+token(seed,'export'),checkouts=[];
  const count=6+integer(seed,'count',20);
  for(let n=0;n<count;n++){
    const key=token(seed,'checkout'+n),legs=[];
    const size=n===0?2:1+integer(seed,'split'+n,3);
    for(let j=0;j<size;j++)legs.push([token(seed,'order'+n+'/'+j),'S-'+((n+j)%7),1+integer(seed,'value'+n+'/'+j,18000)]);
    checkouts.push([key,legs.reduce((s,x)=>s+x[2],0),legs]);
  }
  return {runId,checkouts};
}

function table(name,grain,key,foreignKeys,columns,records,seed){
  // Vary order without making ordering or example identifiers semantic hints.
  const ordered=columns.map((c,i)=>({c,i,sort:token(seed,'column/'+name+'/'+i)})).sort((a,b)=>a.sort.localeCompare(b.sort));
  const rows=records.map((r,i)=>({r,sort:token(seed,'row/'+name+'/'+i)})).sort((a,b)=>a.sort.localeCompare(b.sort));
  return {name,grain,primaryKey:key,foreignKeys,columns:ordered.map(x=>x.c),rows:rows.map(({r})=>ordered.map(({i})=>r[i]))};
}

export function merchantExport(ledger,layout,seed,{fault=null}={}){
  const names={
    warehouse:['autonomy_baskets','orders','basket_id','order_id','basket_id','merchant_id','gross_cents','total_cents'],
    'standard-partner':['Checkouts','MerchantOrders','checkoutId','merchantOrderId','checkoutId','sellerId','basketTotal','merchantTotal'],
    'standard-flat':['Checkouts','OrderRows','checkoutId','merchantOrderId','checkoutId','sellerId','checkoutGross','legGross']
  };
  const opaque=['renamed-relational','renamed-decimal','renamed-flat'].includes(layout);
  if(!opaque&&!Object.hasOwn(names,layout))throw Error('UNKNOWN_EXPORT_LAYOUT');
  const [bt,lt,bk,lk,fk,seller,bg,lg]=opaque?Array.from({length:8},(_,i)=>'f_'+token(seed,'physical'+i)):names[layout];
  const flat=layout.endsWith('flat'),major=layout.includes('decimal')||layout==='standard-partner'||flat;
  const bUnit=major?'USD':'USD cents',lUnit=layout==='renamed-decimal'?'USD':'USD cents';
  const enc=(n,unit)=>unit==='USD'?dollars(n):n;
  const field=(name,description,unit)=>unit?{name,description,unit}:{name,description};
  const basketFields=[field(bk,'shopper checkout identifier'),field(bg,opaque?'gross shopper charge':'checkout gross',bUnit)];
  const parentMeaning=opaque?'buyer purchase reference':'shopper checkout reference';
  const legFields=[field(lk,'merchant order identifier'),field(fk,parentMeaning),field(seller,opaque?'store reference':'merchant identifier'),
    field(lg,opaque?'allocated gross':'merchant order gross',lUnit),field('customer_note','buyer account reference')];
  if(flat)legFields.push(basketFields[1]);
  const bRows=[],lRows=[];
  for(const [basket,amount,legs] of ledger.checkouts){
    bRows.push([basket,enc(amount,bUnit)]);
    for(const [order,store,gross] of legs){
      const values=[order,basket,store,enc(gross,lUnit),'customer-'+integer(seed,basket,4)];
      if(flat)values.push(enc(amount,bUnit));
      lRows.push(values);
    }
  }
  const links=flat?[]:[{column:fk,toTable:bt,toColumn:bk}];
  switch(fault){
    case null:break;
    case 'ambiguous-checkout-link':
      legFields.push(field('alternate_ref',parentMeaning));
      lRows.forEach(r=>r.push(r[1]));
      links.push({column:'alternate_ref',toTable:bt,toColumn:bk});break;
    case 'unit-unknown':delete legFields[3].unit;break;
    case 'duplicate-merchant-order':lRows.push([...lRows[0]]);break;
    case 'orphan-merchant-order':lRows[0][1]='unlisted-'+token(seed,'orphan');break;
    case 'gross-disagreement':lRows[0][3]=enc(ledger.checkouts[0][2][0][2]+1,lUnit);break;
    case 'conflicting-flat-checkout':lRows[1][5]=enc(ledger.checkouts[0][1]+1,bUnit);break;
    default:throw Error('UNKNOWN_EXPORT_FAULT');
  }
  const tables=[table(lt,opaque?'seller portion':'merchant order',lk,links,legFields,lRows,seed)];
  if(!flat)tables.push(table(bt,opaque?'customer basket':'shopper checkout',bk,[],basketFields,bRows,seed));
  if(integer(seed,'table-order',2))tables.reverse();
  return {version:1,runId:ledger.runId,currency:'USD',measure:'gross at capture',complete:true,tables};
}
