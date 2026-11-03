import test from 'node:test';
import assert from 'node:assert/strict';
import {openAllocator} from '../scripts/commerce-deadlines/solver.mjs';
import {openMerchantAllocator} from '../scripts/commerce-growth/autonomy/merchant-allocation.mjs';
test('secondary routing preserves buyer items, payment and aggregate margin while improving the lagging merchant',async()=>{
 const products=['A','B'].flatMap(m=>['P','Q'].map(c=>({id:m+c,catalogId:c,available:1}))),view={day:40,products,merchants:[{id:'A'},{id:'B'}],pastOrders:[]},quotes=['P','Q'].flatMap((c,i)=>['A','B'].map(m=>({requestId:'R'+i,items:[{lineId:'L',productId:m+c,quantity:1}],quantities:{[m+c]:1},expectedPlatformCents:300,preferred:1,quote:{grossCents:10000,feeCents:400,processingCents:100,merchants:[{id:m,grossCents:10000,feeCents:400,costCents:4250,deliveryCents:350}]}}))),base=openAllocator(),protectedAllocator=openMerchantAllocator();
 try{
  const reference=await base.solve(view,quotes),byMerchant={A:0,B:0};for(const i of reference.selected)byMerchant[quotes[i].quote.merchants[0].id]++;
  const over=byMerchant.A>=byMerchant.B?'A':'B';view.pastOrders=[{day:10,refundStatus:null,merchants:['A','B'].map(id=>({id,grossCents:2000,feeCents:100,costCents:550,deliveryCents:350}))},{day:35,refundStatus:null,merchants:[{id:over,grossCents:1000000,feeCents:0,costCents:0,deliveryCents:0}]}];
  const result=await protectedAllocator.solve(view,quotes);assert.equal(result.merchantReview.changed,true);assert.ok(result.merchantReview.after>result.merchantReview.before);assert.ok(result.merchantReview.immediateMerchantGainCents>=0);assert.equal(result.selected.length,2);
  for(const i of result.selected){const q=quotes[i],r=quotes[reference.selected.find(j=>quotes[j].requestId===q.requestId)];assert.equal(q.quote.grossCents,r.quote.grossCents);assert.equal(q.quote.feeCents,r.quote.feeCents);assert.equal(products.find(p=>p.id===q.items[0].productId).catalogId,products.find(p=>p.id===r.items[0].productId).catalogId);}
  const individual=openMerchantAllocator({preserveEachMerchant:true});try{
   const protectedResult=await individual.solve(view,quotes);assert.equal(protectedResult.merchantReview.changed,false);assert.equal(protectedResult.merchantReview.preserveEachMerchant,true);assert.deepEqual(protectedResult.selected,reference.selected);assert.equal(individual.stats.fallbacks,0);
  }finally{individual.close();}
 }finally{base.close();protectedAllocator.close();}
});
