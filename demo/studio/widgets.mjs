export const WIDGET_IDS=['net_sales','orders','daily_sales','merchant_sales','refunds','campaign_costs','order_ledger','model_quality','payment_evidence'];
const title=text=>({title:{text,enabled:true}}),field=(id,aggregation)=>({id,...(aggregation?{aggregation}:{})});
export function widgetFor(id){
 switch(id){
 case 'net_sales':return {type:'value',format:{...title('Retained sales · simulated USD'),style:{color:'#0070e0',typography:{fontSize:36,fontWeight:'bold'}}},dataMapping:{value:[field('summary.netSalesUSD','sum')]}};
 case 'orders':return {type:'value',format:{...title('Shopper orders'),style:{color:'#168470',typography:{fontSize:36,fontWeight:'bold'}}},dataMapping:{value:[field('summary.orders','sum')]}};
 case 'daily_sales':return {type:'line-chart',format:title('Sales by observed day'),dataMapping:{categoryKey:[field('daily.day')],valueKey:[field('daily.netSalesUSD','sum')]}};
 case 'merchant_sales':return {type:'bar-chart-grouped',format:title('Retained sales by merchant'),dataMapping:{categoryKey:[field('merchants.merchant')],valueKey:[field('merchants.netSalesUSD','sum')]}};
 case 'refunds':return {type:'bar-chart-grouped',format:title('Observed refunds by merchant'),dataMapping:{categoryKey:[field('merchants.merchant')],valueKey:[field('merchants.refundUSD','sum')]}};
 case 'campaign_costs':return {type:'grid',format:title('Campaign contacts and costs'),dataMapping:{cols:['kind','contacts','outreachUSD','subsidyUSD'].map(k=>field('campaigns.'+k))}};
 case 'order_ledger':return {type:'grid',format:title('Traceable order ledger'),dataMapping:{cols:['orderId','day','merchant','product','netSalesUSD','refundUSD','transactionId'].map(k=>field('sales.'+k))}};
 case 'model_quality':return {type:'grid',format:title('Chronological model checks'),dataMapping:{cols:['day','modelType','trainingRows','candidateRecall','popularityRecall'].map(k=>field('models.'+k))}};
 case 'payment_evidence':return {type:'payment-evidence',format:title('PayPal evidence'),dataMapping:{value:[field('summary.verifiedCaptures','sum')]}};
 default:throw Error('Unknown dashboard widget');
 }
}
export function compileDashboard(ids,{previous=null,pageId='overview'}={}){
 if(!Array.isArray(ids)||ids.length<1||ids.length>9||new Set(ids).size!==ids.length||ids.some(x=>!WIDGET_IDS.includes(x)))throw Error('Invalid widget plan');
 const widgets={},widgetLayout={};let y=0;
 // Pair similarly sized views so a tiny KPI cannot leave a large empty pocket.
 const ordered=[...ids].sort((a,b)=>Number(!['net_sales','orders','payment_evidence'].includes(a))-Number(!['net_sales','orders','payment_evidence'].includes(b)));
 for(let i=0;i<ordered.length;i++){const id=ordered[i];widgets[id]=widgetFor(id);const compact=['net_sales','orders','payment_evidence'].includes(id),height=compact?12:20;widgetLayout[id]={xTrack:i%2?12:0,yTrack:y,xSpan:12,ySpan:height};if(i%2||i===ordered.length-1)y+=Math.max(height,i?(['net_sales','orders','payment_evidence'].includes(ordered[i-1])?12:20):height);}
 const page={id:pageId,widgets,widgetLayout,layout:{columns:24,rowHeight:16,minWidth:320,maxWidth:1600,pagePadding:10,widgetPadding:16,widgetBorderEnabled:true,widgetBorderRadius:12,widgetBorderColor:'#e0e5ed',widgetBackgroundColor:'#ffffff',backgroundColor:'#f5f7fa'}};
 return {...(previous||{}),version:'3.0.0',pages:previous?.pages?.length?previous.pages.map(p=>p.id===pageId?page:p):[page],selectedPageId:pageId,panels:{filters:{collapsed:true},data:{collapsed:true},edit:{collapsed:true},ai:{collapsed:true},...(previous?.panels||{})}};
}
export function styleReport(state,{compact=false}={}){
 const result=structuredClone(state);
 for(const page of result.pages||[]){page.layout={...page.layout,minWidth:320,widgetPadding:16,widgetBorderRadius:12,widgetBorderColor:'#e0e5ed',widgetBackgroundColor:'#ffffff',backgroundColor:'#f5f7fa'};
  // A narrow office gets one column. Data and user-created widget definitions stay intact.
  if(compact){let y=0;const columns=page.layout.columns||24;page.widgetLayout={...page.widgetLayout};for(const id of Object.keys(page.widgets||{}).sort((a,b)=>(page.widgetLayout[a]?.yTrack||0)-(page.widgetLayout[b]?.yTrack||0)||(page.widgetLayout[a]?.xTrack||0)-(page.widgetLayout[b]?.xTrack||0))){const h=page.widgetLayout[id]?.ySpan||20;page.widgetLayout[id]={xTrack:0,yTrack:y,xSpan:columns,ySpan:h};y+=h;}}
 }
 return result;
}
export function studioWidgets(defaults,{receipt=null}={}){
 const base=defaults.widgets.find(w=>w.id==='value');
 class PaymentEvidence {
  constructor(){this.el=document.createElement('div');this.el.className='payment-evidence-card';}
  getGui(){return this.el;}
  async init(p){await this.refresh(p);}
  async refresh(p){const f=p.dataMapping.value?.[0];if(!f){p.widgetApi.setDisplayState('incompleteDataMapping');return;}
   p.widgetApi.setDisplayState('loading');const r=await p.widgetApi.getData({fields:[f]}),n=Number(r.results.rows[0]?.[f.key]||0);this.el.replaceChildren();
   const brand=document.createElement('b');brand.className='payment-brand';brand.textContent='PayPal Sandbox';const value=document.createElement('strong');value.textContent=String(n);const note=document.createElement('p');note.textContent=n?'Verified native captures linked to this run. Sandbox test funds only.':'No native captures in this run. Modeled fees and simulated orders are not provider receipts.';
   const source=document.createElement('small');source.textContent='Read-only evidence · no payment authority';this.el.append(brand,value,note,source);p.widgetApi.setDisplayState('displayed');
   if(n>0&&receipt?.status==='COMPLETED'&&[receipt.grossUSD,receipt.feeUSD,receipt.netUSD].every(Number.isFinite)){
    const usd=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
    value.textContent=usd(receipt.grossUSD);note.textContent=`${usd(receipt.feeUSD)} fee · ${usd(receipt.netUSD)} to the test merchant`;
    source.textContent='Archived Sandbox capture · '+receipt.capture;
    const proof=document.createElement('span');proof.className='payment-proof-badge';proof.textContent='✓ Existing purchase matched · no new sale';this.el.append(proof);
   }
  }
 }
 return agStudio.createWidgets({additionalTypes:[{...base,id:'payment-evidence',label:'PayPal evidence card',comp:PaymentEvidence,defaultSize:{width:350,height:200},minSize:{width:230,height:150},ai:{description:'Run-level number of native PayPal Sandbox captures. Distinguishes verified provider receipts from simulated payments.'}}],menu:[{label:'Market Metro',widgetIds:['payment-evidence']},...defaults.menu]});
}
