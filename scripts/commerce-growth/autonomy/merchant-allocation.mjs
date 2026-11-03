// Preserve the reference buyer baskets and payment amounts. Secondary routing
// may improve observed merchant balance without lowering immediate aggregate
// order contribution. This is not a guarantee about future market profit.
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {resolve} from 'node:path';
import {openAllocator} from '../../commerce-deadlines/solver.mjs';
import {merchantContributionWeights} from '../experiments/program.mjs';

export function openMerchantAllocator({preserveEachMerchant=false}={}){
 if(typeof preserveEachMerchant!=='boolean')throw Error('INVALID_MERCHANT_GUARD_MODE');
 const base=openAllocator(),child=spawn(resolve('.local/marketing-venv/bin/python'),['-u',resolve('scripts/commerce-growth/autonomy/merchant-allocation.py')],{stdio:['pipe','pipe','pipe']}),pending=new Map();let id=0,stderr='';const stats={preserveEachMerchant,calls:0,changed:0,fallbacks:0,immediateMerchantGainCents:0};
 child.stderr.on('data',b=>{stderr=(stderr+b).slice(-2000);});
 createInterface({input:child.stdout}).on('line',line=>{let r;try{r=JSON.parse(line);}catch{return;}const p=pending.get(r.id);if(!p)return;clearTimeout(p.timer);pending.delete(r.id);r.error?p.reject(Error(r.error)):p.resolve(r);});
 child.on('exit',code=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('MERCHANT_SOLVER_EXIT_'+code+':'+stderr));}pending.clear();});
 return {stats,async solve(view,quotes){
  const reference=await base.solve(view,quotes);if(reference.selected.length<2)return reference;
  const products=new Map(view.products.map(p=>[p.id,p])),signature=q=>q.items.map(i=>[i.lineId,products.get(i.productId).catalogId,i.quantity].join(':')).sort().join('|'),
   chosen=new Map(reference.selected.map(i=>[quotes[i].requestId,quotes[i]])),options=quotes.map((q,index)=>({q,index})).filter(({q})=>chosen.has(q.requestId)&&signature(q)===signature(chosen.get(q.requestId))&&q.quote.grossCents===chosen.get(q.requestId).quote.grossCents&&q.quote.feeCents===chosen.get(q.requestId).quote.feeCents&&q.quote.processingCents===chosen.get(q.requestId).quote.processingCents),
   history=merchantContributionWeights(view),merchant=q=>Object.fromEntries(q.quote.merchants.map(m=>[m.id,m.grossCents-m.feeCents-m.costCents-m.deliveryCents])),sum=qs=>qs.reduce((s,q)=>s+Object.values(merchant(q)).reduce((n,v)=>n+v,0),0),minimumAggregate=sum([...chosen.values()]),
   anchors=Object.fromEntries(Object.entries(history).map(([m,h])=>[m,Math.max(100,h.warmup)])),past=Object.fromEntries(Object.entries(history).map(([m,h])=>[m,h.warmup+h.sinceWarmup])),
   fair=qs=>Math.min(...Object.keys(anchors).map(m=>(past[m]+qs.reduce((s,q)=>s+(merchant(q)[m]||0),0))/anchors[m])),before=fair([...chosen.values()]);
  const minimumByMerchant=preserveEachMerchant?Object.fromEntries(Object.keys(anchors).map(m=>[m,[...chosen.values()].reduce((s,q)=>s+(merchant(q)[m]||0),0)])):null,
   packet={id:++id,stock:Object.fromEntries(view.products.map(p=>[p.id,p.available])),quotes:options.map(({q})=>({requestId:q.requestId,quantities:q.quantities,merchant:merchant(q)})),anchors,past,minimumAggregate,minimumByMerchant};stats.calls++;
  try{
   const result=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(packet.id);reject(Error('MERCHANT_SOLVER_TIMEOUT'));},5000);pending.set(packet.id,{resolve,reject,timer});child.stdin.write(JSON.stringify(packet)+'\n');});
   if(!Array.isArray(result.selected)||new Set(result.selected).size!==result.selected.length||result.selected.some(i=>!Number.isInteger(i)||!options[i]))throw Error('INVALID_MERCHANT_SELECTION');
   const selected=result.selected.map(i=>options[i].index),qs=selected.map(i=>quotes[i]),stock={...packet.stock};
   if(qs.length!==chosen.size||new Set(qs.map(q=>q.requestId)).size!==chosen.size||sum(qs)<minimumAggregate)throw Error('MERCHANT_GUARD_FAILED');
   if(minimumByMerchant&&Object.entries(minimumByMerchant).some(([m,floor])=>qs.reduce((s,q)=>s+(merchant(q)[m]||0),0)<floor))throw Error('INDIVIDUAL_MERCHANT_GUARD_FAILED');
   for(const q of qs)for(const [p,n]of Object.entries(q.quantities)){stock[p]-=n;if(stock[p]<0)throw Error('MERCHANT_STOCK_FAILED');}
   const after=fair(qs),improved=preserveEachMerchant?sum(qs)>minimumAggregate:after>before+1e-8;
   if(!improved)return {...reference,merchantReview:{changed:false,preserveEachMerchant,reason:'No verified improvement under the declared merchant floors.'}};
   stats.changed++;stats.immediateMerchantGainCents+=sum(qs)-minimumAggregate;
   return {...reference,selected,merchantReview:{changed:true,preserveEachMerchant,before,after,immediateMerchantGainCents:sum(qs)-minimumAggregate,sameBuyerBaskets:true,samePaymentAmounts:true,scope:'Current observed order contribution only; future inventory, refunds and merchant results remain evaluated separately.'},runtimeSeconds:reference.runtimeSeconds+result.runtimeSeconds};
  }catch(error){stats.fallbacks++;return {...reference,merchantReview:{changed:false,fallback:error.message}};}
 },close(){base.close();child.stdin.end();}};
}
