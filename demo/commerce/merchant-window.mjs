/** Project a bounded render district without changing the underlying economy. */
export function merchantWindow(frame,requestedPage=0,size=32){
 const total=frame.merchants.length,pages=Math.max(1,Math.ceil(total/size));
 const page=Math.max(0,Math.min(pages-1,Math.trunc(Number(requestedPage)||0))),start=page*size;
 const merchants=frame.merchants.slice(start,start+size).map((merchant,i)=>({...merchant,position:i,displayNumber:start+i+1}));
 const visible=new Set(merchants.map(m=>m.merchant_id));
 return {page,pages,total,first:total?start+1:0,last:start+merchants.length,frame:{...frame,runId:pages>1?frame.runId+'-PAGE-'+page:frame.runId,merchants,merchantCount:merchants.length,activities:(frame.activities||[]).filter(a=>!a.merchantId||visible.has(a.merchantId))}};
}
