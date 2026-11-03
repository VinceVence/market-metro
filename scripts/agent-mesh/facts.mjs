// Shared numerical reader for agents and code controls. Never generates SQL.
import {createHash} from 'node:crypto';
import {ASSUMPTIONS} from '../policy-lab/economy.mjs';
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');

export function unitEconomics(priceCents,pct){
  if(!Number.isSafeInteger(priceCents)||priceCents<1||![0,5,10].includes(pct))throw Error('INVALID_ECONOMIC_INPUT');
  const discountCents=Math.round(priceCents*pct/100),paidCents=priceCents-discountCents;
  const feeCents=Math.round(paidCents*ASSUMPTIONS.feeRate)+ASSUMPTIONS.feeFixedCents;
  const processingCents=Math.round(paidCents*ASSUMPTIONS.processingRate)+ASSUMPTIONS.processingFixedCents;
  const subsidyCents=Math.round(discountCents*ASSUMPTIONS.platformDiscountShare);
  const retainedSaleMarginCents=feeCents-processingCents-subsidyCents;
  const baseMarginCents=Math.round(priceCents*ASSUMPTIONS.feeRate)+ASSUMPTIONS.feeFixedCents-Math.round(priceCents*ASSUMPTIONS.processingRate)-ASSUMPTIONS.processingFixedCents;
  return {currency:'USD',priceBasis:'CATALOG_LIST_PRICE',priceCents,pct,paidCents,discountCents,feeCents,processingCents,subsidyCents,retainedSaleMarginCents,baseMarginCents,
    outreachCents:ASSUMPTIONS.outreachCents,
    conversionMultiplierBeforeOutreach:retainedSaleMarginCents>0?baseMarginCents/retainedSaleMarginCents:null,
    limit:'Illustrative catalog-list-price economics under frozen simulator assumptions, before refunds. Live markdowns can change amounts. Assumes converted shoppers buy the promoted item. This is not an incrementality forecast or actual PayPal pricing.'};
}

function weighted(rows,action){
  const chosen=rows.filter(r=>r.selected_action===action);let weight=0,reward=0,purchases=0;
  for(const r of chosen){if(!(r.propensity>0&&r.propensity<=1))throw Error('INVALID_LOGGED_PROPENSITY');const w=1/r.propensity;weight+=w;reward+=w*r.reward_cents;purchases+=w*Number(Boolean(r.order_id));}
  return {observations:chosen.length,weight,rewardCents:weight?reward/weight:null,purchaseRate:weight?purchases/weight:null};
}
export function randomizedEffects(actions,cutoff){
  const lastPurchase=new Map(),classified=[];
  for(const row of [...actions].filter(a=>a.day<cutoff).sort((a,b)=>a.day-b.day||a.customer_id.localeCompare(b.customer_id))){
    const last=lastPurchase.get(row.customer_id),lapsed=last!==undefined&&row.day-last>=7;
    if(row.day<30&&row.matures_day<=cutoff&&Number.isSafeInteger(row.reward_cents)&&row.source==='RANDOMIZED_SIMULATION')classified.push({...row,lapsed,eligible:typeof row.eligible_json==='string'?JSON.parse(row.eligible_json):row.eligible_json});
    if(row.order_id)lastPurchase.set(row.customer_id,row.day);
  }
  const actionsAvailable=[...new Set(classified.flatMap(r=>r.eligible))].filter(a=>a!=='none').sort(),rows=[];
  for(const audience of ['all','lapsed'])for(const action of actionsAvailable){
    const population=classified.filter(r=>(audience==='all'||r.lapsed)&&r.eligible.includes('none')&&r.eligible.includes(action));
    const treated=weighted(population,action),control=weighted(population,'none');
    rows.push({audience,action,eligibleDecisions:population.length,customers:new Set(population.map(r=>r.customer_id)).size,treated,control,
      directRewardDifferenceCents:treated.rewardCents===null||control.rewardCents===null?null:treated.rewardCents-control.rewardCents,
      interpretation:'Self-normalized propensity-weighted randomized-history estimate on common action support. Small samples, carryover and shared inventory limit interpretation. This does not establish full-campaign or long-horizon lift.'});
  }
  return rows;
}

export function verifiedFacts({asOfDay,recentPurchases,previousPurchases,merchants,products,events=[],actions=[],model=null}){
  if(!Number.isInteger(asOfDay)||![recentPurchases,previousPurchases].every(x=>Number.isSafeInteger(x)&&x>=0))throw Error('INVALID_FACT_CUTOFF');
  const difference=recentPurchases-previousPurchases;
  const demand={id:'demand-trend',recent:recentPurchases,previous:previousPurchases,difference,direction:difference>0?'UP':difference<0?'DOWN':'FLAT',
    percentageChange:previousPurchases?100*difference/previousPurchases:null,scope:'Observed purchase counts in adjacent seven-day windows, not a causal campaign effect.'};
  const caps={id:'merchant-caps',marginFloorPct:ASSUMPTIONS.minMerchantMargin*100,rule:'effective coupon limit = minimum(global campaign ceiling, merchant limit). Raising the global ceiling cannot override a merchant limit. The coupon cap and the merchant margin floor are different quantities.',merchants:merchants.map(m=>({index:m.index,name:m.name,stock:m.stock,maxOfferPct:m.maxOfferPct}))};
  const economics=products.map(p=>({productId:p.product_id,channel3Id:p.channel3_product_id||null,title:p.title,source:p.source,priceCents:p.price_cents,
    offers:[0,5,10].map(pct=>unitEconomics(p.price_cents,pct))}));
  const announcements=events.filter(e=>e.day<asOfDay).map(e=>({id:e.id,day:e.day,text:e.text,source:'OBSERVED_SIMULATOR_EVENT',untrustedText:true}));
  const modelCheck=model?{id:'model-check',modelId:model.modelId||model.model_id,trainingCutoff:model.cutoff??model.cutoffDay??model.cutoff_day,mse:model.mse,constantMse:model.baselineMse??model.baseline_mse,
    beatConstant:Number.isFinite(model.mse)&&Number.isFinite(model.baselineMse??model.baseline_mse)&&model.mse<(model.baselineMse??model.baseline_mse),
    scope:'Prediction MSE is a predictive diagnostic. It is not campaign incrementality or permission to spend.'}:null;
  const packet={asOfDay,demand,caps,economics,announcements,modelCheck,randomizedEffects:randomizedEffects(actions,asOfDay),
    limits:['Synthetic behavior, stock, cost assumptions and marketing effects; real cached Channel3 catalog provenance.','No current-world future, hidden traits, other evaluated branches or real payment authority is included.','Merchant permission to discount is not evidence that the discount is profitable.']};
  return {id:'FACTS-'+digest(packet).slice(0,20),...packet};
}

export function readVerifiedFacts(store,id,snapshot,{model=null}={}){
  const cutoff=snapshot.asOfDay,w=store.state(id);if(!w||cutoff>w.tick)throw Error('FACTS_CUTOFF_UNAVAILABLE');
  const timestamp=new Date(Date.parse(w.startedAt)+cutoff*86400000).toISOString();
  const actions=store.db.prepare('SELECT customer_id,day,selected_action,eligible_json,propensity,order_id,matures_day,reward_cents,source FROM policy_lab_actions WHERE run_id=? AND day<? ORDER BY day,customer_id').all(id,cutoff)
    .map(r=>({...r,reward_cents:r.matures_day<=cutoff?r.reward_cents:null}));
  const products=store.db.prepare('SELECT product_id,channel3_product_id,title,source,price_cents FROM products WHERE run_id=? ORDER BY product_id').all(id);
  const events=store.db.prepare("SELECT event_id,event_ts,detail_json FROM events WHERE run_id=? AND event_type='market_change' AND event_ts<? ORDER BY event_ts").all(id,timestamp).map(r=>{const d=JSON.parse(r.detail_json);return {id:r.event_id,day:d.day,text:d.change};});
  return verifiedFacts({...snapshot,products,events,actions,model});
}
