export const ROLE_FOR_ACTION={set_goal:'Business lead',prepare_history:'Data engineer',analyze:'Business lead',train:'Data scientist',draft_campaign:'Campaign manager',launch:'Coordinator',advance:'Campaign manager',review:'Coordinator',settle:'Data engineer',capture_samples:'Payments',evaluate:'Experiment analyst',complete:'Coordinator'};
export function demoTimeline(data){
  const items=[{key:'catalog',kind:'catalog',day:-1,role:'Data engineer'}],days=new Map(data.days.map(d=>[d.day,d]));let through=-1,receiptsVisible=false;
  for(const cp of data.checkpoints){
    const role=ROLE_FOR_ACTION[cp.action]||'Coordinator';
    if(cp.action==='capture_samples'&&cp.status==='COMPLETED')receiptsVisible=true;
    items.push({key:cp.id,kind:'checkpoint',day:through,role,checkpoint:cp,receiptsVisible});
    if(cp.status!=='COMPLETED')continue;
    const generated=cp.action==='prepare_history'?data.days.filter(d=>d.day<28):['advance','settle'].includes(cp.action)?(cp.output?.days||[]).map(d=>days.get(d.day)).filter(Boolean):[];
    for(const d of generated)if(d.day>through){items.push({key:'day-'+d.day,kind:'day',day:d.day,role:cp.action==='prepare_history'?'Data engineer':'Campaign manager',data:d});through=d.day;}
    if(cp.output?.attention)items.push({key:cp.id+'-shock',kind:'shock',day:through,role:'Coordinator',attention:cp.output.attention});
  }
  return items;
}
export function demoFrame(data,item){
  const day=data.days.find(d=>d.day===item.day),motions=new Map((day?.motions||[]).map(r=>[r[0],r])),events=day?.events||[];
  return {runId:data.runId,merchantCount:data.base.merchantCount,tick:item.day+1,receipts:item.receiptsVisible?data.receipts.map(r=>({status:r.paypal_status})):[],featuredIds:events.map(e=>e.customerId).filter(Boolean),
    merchants:data.base.merchants.map((m,i)=>({...m,sold:day?.shops[i]?.sold||0,stock:day?.shops[i]?.stock??m.stock})),
    customers:data.base.customers.map(u=>{const a=motions.get(u.index);return {...u,lastAction:a?.[2]||'home',lastMerchant:a?data.base.merchants[a[1]]?.merchant_id:null,coupon:a?.[3]?{pct:a[3]}:null};}),
    activities:events.filter(e=>e.kind==='delivery').map(e=>({...e,type:'delivery'}))};
}
