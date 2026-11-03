// Merchant-authorized quote interface. Prices remain real buyer debits; this
// creates no credits, sales, artificial utility bonuses or new fee revenue.
export const QUOTE_LIMITS=Object.freeze({minimumFactor:.75,maximumFactor:1.25,minimumQuotedMargin:.20,factors:[.75,.85,1,1.1,1.25],merchantAdjustPct:[-5,0,5]});
const fee=n=>Math.round(n*.0349)+49;
export function quoteRange(w,p){
 const base=w.commerce.basePrices[p.product_id],max=Math.floor(base*QUOTE_LIMITS.maximumFactor);
 let min=Math.max(Math.ceil(base*QUOTE_LIMITS.minimumFactor),Math.ceil((p.cost_cents+350+49)/(.8-.0349)));
 while((min-fee(min)-p.cost_cents-350)/min<QUOTE_LIMITS.minimumQuotedMargin)min++;
 if(min>max)throw Error('NO_QUOTE_WITHIN_MARGIN_CAP');return {min,max};
}
export function buildPriceBook(w,{byCategory,merchantAdjustPct=[0,0,0]}){
 const categories=[...new Set(w.products.map(p=>p.category))];
 if(!byCategory||Object.keys(byCategory).sort().join()!==categories.sort().join()||Object.values(byCategory).some(v=>!QUOTE_LIMITS.factors.includes(v))||merchantAdjustPct.length!==3||merchantAdjustPct.some(v=>!QUOTE_LIMITS.merchantAdjustPct.includes(v)))throw Error('INVALID_QUOTE_PLAN');
 return Object.fromEntries(w.products.map(p=>{const range=quoteRange(w,p),merchant=w.merchants.findIndex(m=>m.merchant_id===p.merchant_id),wanted=Math.round(w.commerce.basePrices[p.product_id]*byCategory[p.category]*(1+merchantAdjustPct[merchant]/100));return [p.product_id,Math.max(range.min,Math.min(range.max,wanted))];}));
}
export function publishPriceBook(w,book,{evidenceDay,actor='PRICE_BOOK_TOOL'}={}){
 if(!Number.isInteger(evidenceDay)||evidenceDay>w.tick||!book||typeof book!=='object'||Array.isArray(book)||Object.keys(book).length!==w.products.length)throw Error('INVALID_PRICE_BOOK');
 const checked={};for(const p of w.products){const price=book[p.product_id],range=quoteRange(w,p);if(!Number.isSafeInteger(price)||price<range.min||price>range.max)throw Error('UNAUTHORIZED_QUOTE');checked[p.product_id]=price;}
 w.commerce.priceBook=checked;w.commerce.events.push({id:w.runId+'-COM-'+w.commerce.events.length,day:w.tick,type:'PRICE_BOOK_PUBLISHED',evidenceDay,actor,quotes:{...checked},source:'SIMULATED_COMMERCE_V6'});
 return {quotes:w.products.length,evidenceDay};
}
