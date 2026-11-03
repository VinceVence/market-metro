// Bounded, local development search for a richer observed-only action policy.
// No held-out markets, hidden traits, model API requests or native payments.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createWorld,stepWorld,outcome,assertIntegrity} from '../behavior-v4/engine.mjs';
import {authoredCatalog} from '../behavior-v4/catalog.mjs';
import {publicEvidence,train,compilePolicy} from '../behavior-v4/policies.mjs';
import {fitFeatures,rankOffers,defaults} from './policy.mjs';
import {SETTINGS,hash,mean} from './evaluate.mjs';
const cases=[{seed:420100,scenario:'steady'},{seed:420101,scenario:'budget_squeeze'},{seed:420110,scenario:'rival_sale'},{seed:420111,scenario:'returns_wave'},{seed:420120,scenario:'preference_shift'},{seed:420121,scenario:'supply_delay'}];
const configs=[];
// Identical action semantics and costs; only the policy mapping is expanded.
for(const mode of ['intent_value','learned_value','discovery','affinity'])for(const intentAge of [2,14])for(const recency of [0,7])for(const priceRatio of [0,2])configs.push({mode,intentAge,recency,priceRatio});
const worlds=cases.map(c=>{const w=createWorld({...SETTINGS,...c,runId:'FRONTIER-'+c.seed,catalog:authoredCatalog()});while(w.tick<30)stepWorld(w);return w;});
function choosePolicy(w,model,c){
 const excluded=new Set(publicEvidence(w).matureMerchantRisk.filter(r=>r.exclude).map(r=>r.merchantIndex)),byId=new Map(w.products.map(p=>[p.product_id,p]));
 return input=>{const u=input.customer;if(u.purchases&&input.day-u.lastPurchase<c.recency)return null;
  const intent=u.observedIntent&&input.day-u.observedIntent.day<=c.intentAge?u.observedIntent.topic:null,category=intent||Object.entries(u.seenCategories).sort((a,b)=>b[1]-a[1])[0]?.[0];if(!category)return null;
  let pool=rankOffers(input,model,{...defaults(),priceRatio:c.priceRatio},excluded);
  const seen=new Set(Object.keys(u.seenItems).map(id=>byId.get(id)?.catalog_item_id)),topic=p=>p.category===category;
  if(c.mode!=='learned_value')pool=pool.filter(topic);
  pool=pool.map(p=>{const f=p.features,affinity=.5*f.affinity+.5*f.collaborative,unit=Math.max(0,Math.round(p.priceCents*.0349)+49-Math.round(p.priceCents*.012)-20),novel=Number(!seen.has(p.catalogItemId));
   const score=c.mode==='intent_value'?unit*(.5+.5*f.priceFit):c.mode==='learned_value'?unit*(.1+affinity+Number(topic(p))):c.mode==='discovery'?unit*(.2+novel+affinity*.25):affinity+f.priceFit*.25;
   return {...p,policyScore:score};});
  pool.sort((a,b)=>b.policyScore-a.policyScore||Number(b.merchantIndex===u.lastMerchantIndex)-Number(a.merchantIndex===u.lastMerchantIndex)||a.merchantIndex-b.merchantIndex);
  return pool[0]?{productId:pool[0].productId,pct:0,reason:'Observed-only '+c.mode+' policy; '+category+'; new-product and payment-value features.'}:null;
 };
}
function run(initial,config){const w=structuredClone(initial);let model;
 while(w.tick<w.totalTicks){if(w.tick<90&&(w.tick-30)%14===0){train(w);model=fitFeatures(w.behavior.observations,w.products,w.tick);}stepWorld(w,w.tick<90?(config==='fixed'?compilePolicy(w,'weekly_featured'):choosePolicy(w,model,config)):()=>null);}
 assertIntegrity(w);return outcome(w);
}
await mkdir('docs/commerce-headroom',{recursive:true});
const frozen={createdAt:new Date().toISOString(),cases,configs,sourceHash:hash(await readFile(import.meta.filename,'utf8')),simulatorHash:hash(await readFile('scripts/behavior-v4/engine.mjs','utf8')),scope:'32 predeclared conditional policy configurations on six previously used DEVELOPMENT markets. Not an LLM or held-out performance claim.'};
await writeFile('docs/commerce-headroom/frontier-protocol.json',JSON.stringify(frozen,null,2)+'\n');
const fixed=worlds.map(w=>run(w,'fixed')),rows=[];
for(const [i,config] of configs.entries()){const results=worlds.map(w=>run(w,config)),row={index:i,config,results,meanPlatformUSD:mean(results.map(r=>r.platformCents/100)),meanMerchantDeltaUSD:mean(results.map((r,j)=>(r.merchantCents-fixed[j].merchantCents)/100)),ratio:mean(results.map(r=>r.platformCents))/mean(fixed.map(r=>r.platformCents))};rows.push(row);console.log(JSON.stringify({candidate:i+1,config,ratio:row.ratio,merchantDelta:row.meanMerchantDeltaUSD}));}
const ordered=[...rows].sort((a,b)=>b.meanPlatformUSD-a.meanPlatformUSD),bestEligible=ordered.find(r=>r.meanMerchantDeltaUSD>=0),result={...frozen,fixed,rows,bestPlatform:ordered[0],bestEligible,paidCalls:0};
await writeFile('docs/commerce-headroom/frontier.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({bestPlatform:ordered[0].ratio,bestEligible:bestEligible?.ratio,config:bestEligible?.config}));
