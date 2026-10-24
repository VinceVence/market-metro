import {createHash} from 'node:crypto';

// Small fitted count model: observed item/category affinity plus smoothed popularity.
// No embeddings, external APIs, or access to simulator preferences.
export function fitRanker(rows,products){
  const popularity={},profiles={},byId=new Map(products.map(p=>[p.product_id,p]));
  for(const r of rows){
    const p=byId.get(r.product_id),weight=Number(r.visited)+3*Number(r.purchased);if(!p||!weight)continue;
    popularity[p.product_id]=(popularity[p.product_id]||0)+weight;
    const u=profiles[r.customer_id]??={items:{},categories:{},total:0};
    u.items[p.product_id]=(u.items[p.product_id]||0)+weight;u.categories[p.category]=(u.categories[p.category]||0)+weight;u.total+=weight;
  }
  return {type:'affinity_popularity',popularity,profiles};
}
export function rankProducts(artifact,products,customerId){
  const u=artifact.profiles?.[customerId],max=Math.max(1,...Object.values(artifact.popularity));
  return products.map(p=>{
    const popularity=((artifact.popularity[p.product_id]||0)+1)/(max+1);
    const personal=u?((u.items[p.product_id]||0)*.7+(u.categories[p.category]||0)*.3)/u.total:0;
    return {productId:p.product_id,score:artifact.type==='popularity'?popularity:.8*personal+.2*popularity,reason:u&&artifact.type!=='popularity'?'Matches recorded browsing and purchase interests; balanced with observed popularity.':'Popular in completed market observations; no personal preference inferred.'};
  }).sort((a,b)=>b.score-a.score||a.productId.localeCompare(b.productId));
}
export function trainRecommender(store,w){
  const started=performance.now(),cutoff=w.tick,split=cutoff-7;
  const rows=store.db.prepare('SELECT day,customer_id,product_id,visited,purchased FROM customer_days WHERE run_id=? AND day>=? AND day<? ORDER BY day,customer_id').all(w.runId,Math.max(0,cutoff-28),cutoff);
  const training=rows.filter(r=>r.day<split),validation=rows.filter(r=>r.day>=split&&r.purchased),candidate=fitRanker(training,w.products),baseline={...candidate,type:'popularity',profiles:{}};
  const recall=artifact=>{const cache=new Map();return validation.reduce((n,r)=>{if(!cache.has(r.customer_id))cache.set(r.customer_id,new Set(rankProducts(artifact,w.products,r.customer_id).slice(0,3).map(p=>p.productId)));return n+Number(cache.get(r.customer_id).has(r.product_id));},0)/Math.max(1,validation.length);};
  const candidateRecall=recall(candidate),baselineRecall=recall(baseline),personalized=validation.length>=20&&candidateRecall>baselineRecall;
  // Select using the later window, then refit only on data available at publication.
  const artifact=fitRanker(rows,w.products);if(!personalized){artifact.type='popularity';artifact.profiles={};}
  return {id:w.runId+'-REC-'+cutoff,cutoff,split,type:artifact.type,artifact,trainingRows:training.length,validationPurchases:validation.length,candidateRecall,baselineRecall,refitRows:rows.length,datasetHash:createHash('sha256').update(JSON.stringify(rows)).digest('hex'),runtimeMs:Math.round(performance.now()-started),reason:personalized?'Personalized affinity beat popularity on the later seven-day purchase window.':'Personalized affinity did not beat popularity, or there were fewer than 20 validation purchases. Serve the popularity fallback.'};
}
