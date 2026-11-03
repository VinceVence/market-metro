// Matched-observation classifier metrics, including ties and absent classes.
export function predictionMetrics(rows){
 if(!rows.length||rows.some(r=>![0,1].includes(r.y)||!Number.isFinite(r.p)||r.p<0||r.p>1))throw Error('INVALID_PREDICTION_ROWS');
 const sorted=[...rows].sort((a,b)=>b.p-a.p),positives=rows.reduce((s,r)=>s+r.y,0),negatives=rows.length-positives;
 let tp=0,fp=0,area=0,ap=0,previousTP=0,previousFP=0;
 const roc=[{fpr:0,tpr:0,threshold:null}];
 for(let i=0;i<sorted.length;){let j=i;while(j<sorted.length&&sorted[j].p===sorted[i].p){tp+=sorted[j].y;fp+=1-sorted[j].y;j++;}
  area+=(fp-previousFP)*(tp+previousTP)/2;ap+=positives?(tp-previousTP)/positives*tp/(tp+fp):0;
  roc.push({fpr:negatives?fp/negatives:null,tpr:positives?tp/positives:null,threshold:sorted[i].p});previousTP=tp;previousFP=fp;i=j;
 }
 const byMarket={};for(const r of rows){const key=r.market??'all';(byMarket[key]??=[]).push(r);}
 const marketAUCs=Object.keys(byMarket).length>1?Object.entries(byMarket).map(([market,r])=>({market,n:r.length,positives:r.reduce((s,x)=>s+x.y,0),auc:predictionMetrics(r.map(x=>({p:x.p,y:x.y}))).auc})):[];
 return {n:rows.length,positives,auc:positives&&negatives?area/(positives*negatives):null,averagePrecision:positives?ap:null,
  brier:rows.reduce((s,r)=>s+(r.p-r.y)**2,0)/rows.length,
  logLoss:rows.reduce((s,r)=>{const p=Math.max(1e-9,Math.min(1-1e-9,r.p));return s-r.y*Math.log(p)-(1-r.y)*Math.log(1-p);},0)/rows.length,
  macroMarketAUC:marketAUCs.some(m=>m.auc!==null)?marketAUCs.filter(m=>m.auc!==null).reduce((s,m)=>s+m.auc,0)/marketAUCs.filter(m=>m.auc!==null).length:null,
  marketAUCs,roc};
}
