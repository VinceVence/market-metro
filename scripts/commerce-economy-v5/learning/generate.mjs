import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {createWorld,stepWorld} from '../engine.mjs';
import {authoredCatalog} from '../../behavior-v4/catalog.mjs';
import {applyPlan,defaultPlan} from '../operations.mjs';
import {draw} from '../../marketing/economy.mjs';
import {observedFeatures,FEATURES} from './features.mjs';
import {hash} from '../../commerce-design-v2/evaluate.mjs';
const dir='docs/commerce-economy-v5/learning-1';await mkdir(dir,{recursive:true});if(await access(dir+'/protocol.json').then(()=>true,()=>false))throw Error('TRAINING_PROTOCOL_EXISTS');
const scenarios=['steady','rival_sale','budget_squeeze','returns_wave','preference_shift','supply_delay'],episodes=Array.from({length:18},(_,i)=>({seed:620000+i,scenario:scenarios[i%6],split:i<12?'train':'model_validation',randomizationSeed:820000+i}));
const files=['scripts/commerce-economy-v5/engine.mjs','scripts/commerce-economy-v5/operations.mjs','scripts/commerce-economy-v5/network.mjs','scripts/commerce-economy-v5/learning/features.mjs','scripts/commerce-economy-v5/learning/generate.mjs'];
const protocol={createdAt:new Date().toISOString(),episodes,features:FEATURES,settings:{customers:100,days:100,campaignStop:90,budgetCents:5000},assignmentProbability:.5,outcomeDays:14,returnFollowupDays:14,lastLabeledDecisionDay:75,scope:'Synthetic randomized recommendation trials using existing legal actions. The potential recommended product is randomized for treatment AND control opportunities. Labels are observed future14-day retained retail payment contribution and retailer contribution under the randomized continuation policy. No counterfactual oracle labels or private features. Split by entire market episode; overlapping windows are not independent observations. No native payments or model API calls.',economicHashes:Object.fromEntries(await Promise.all(files.map(async f=>[f,hash(await readFile(f,'utf8'))])))};protocol.hash=hash(protocol);await writeFile(dir+'/protocol.json',JSON.stringify(protocol,null,2));
for(const f of files){const path=dir+'/source/'+f;await mkdir(path.slice(0,path.lastIndexOf('/')),{recursive:true});await writeFile(path,await readFile(f));}
const dataset=[],summaries=[];
for(const c of episodes){const w=createWorld({...protocol.settings,runId:'RCT-'+c.seed,seed:c.seed,scenario:c.scenario,catalog:authoredCatalog()}),decisions=[];
 while(w.tick<w.totalTicks){if(w.tick>=30&&w.tick<90&&(w.tick-30)%7===0){const pricePct=[0,1,2].map(m=>[-10,0,10][Math.floor(draw(c.randomizationSeed,'price',w.tick,m)*3)]);applyPlan(w,{...defaultPlan(),pricePct},{evidenceDay:w.tick,actor:'RANDOMIZED_TRAINING_PRICES'});}
  stepWorld(w,input=>{const pool=input.products.filter(p=>p.stock>0&&p.allowedPct.includes(0));if(!pool.length)return null;const p=pool[Math.floor(draw(c.randomizationSeed,'potential-product',input.day,input.customer.index)*pool.length)],assigned=Number(draw(c.randomizationSeed,'recommendation',input.day,input.customer.index)<.5);
   if(input.day<=75)decisions.push({episode:c.seed,split:c.split,day:input.day,customerId:input.customer.customerId,potentialProductId:p.productId,assigned,propensity:.5,x:observedFeatures(w,input,p)});
   return assigned?{productId:p.productId,pct:0,reason:'Randomized training recommendation; ordinary consumer choice and budget limits still apply.'}:null;});
 }
 const byUser=new Map();for(const o of w.behavior.orders){if(!byUser.has(o.customerId))byUser.set(o.customerId,[]);byUser.get(o.customerId).push(o);}
 for(const d of decisions){const orders=(byUser.get(d.customerId)||[]).filter(o=>o.day>=d.day&&o.day<d.day+14),actions=w.behavior.actions.filter(a=>a.customer_id===d.customerId&&a.day>=d.day&&a.day<d.day+14),platform=orders.reduce((s,o)=>s+(o.refund?0:o.fee)-o.processing,0)-actions.reduce((s,a)=>s+a.outreach_cents+a.platform_support_cents,0),merchant=orders.reduce((s,o)=>s+o.gross-o.refund-(o.refund?0:o.fee)-o.cost-o.delivery+o.support,0);dataset.push({...d,y:[platform,merchant]});}
 summaries.push({episode:c.seed,scenario:c.scenario,split:c.split,opportunities:decisions.length,assigned:decisions.reduce((s,d)=>s+d.assigned,0),outreachCents:w.behavior.outreachCents,realFunds:false});console.log(JSON.stringify(summaries.at(-1)));
}
await writeFile(dir+'/dataset.json',JSON.stringify({protocolHash:protocol.hash,features:FEATURES,rows:dataset}));await writeFile(dir+'/summary.json',JSON.stringify({summaries,rows:dataset.length,modelCalls:0,nativePayments:0,scope:protocol.scope},null,2));
