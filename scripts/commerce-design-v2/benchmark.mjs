import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {hash,mean,SETTINGS,evaluate,evidence,rankingMetrics} from './evaluate.mjs';
import {defaults,NUMERICAL_CANDIDATES,validateConfig,WEIGHTS} from './policy.mjs';
import {openTeamVertex} from '../agent-mesh/model-client.mjs';

const ROOT=resolve(import.meta.dirname,'../..');
export const DIR=resolve(ROOT,'docs/commerce-design-v2/trial-1');
const files=['scripts/behavior-v4/engine.mjs','scripts/behavior-v4/catalog.mjs','scripts/behavior-v4/policies.mjs','scripts/marketing/recommender.mjs','scripts/marketing/economy.mjs','scripts/policy-lab/wallet-corrected.mjs','demo/market/engine.mjs','scripts/commerce-design-v2/policy.mjs','scripts/commerce-design-v2/evaluate.mjs','scripts/commerce-design-v2/benchmark.mjs','scripts/agent-mesh/model-client.mjs','benchmark/vertex.mjs'];
const sources=async()=>Object.fromEntries(await Promise.all(files.map(async f=>[f,hash(await readFile(resolve(ROOT,f),'utf8'))])));
const read=name=>readFile(resolve(DIR,name),'utf8').then(JSON.parse);
const save=async(name,value)=>{await mkdir(DIR,{recursive:true});await writeFile(resolve(DIR,name),JSON.stringify(value,null,2)+'\n');};
const exists=async(name)=>access(resolve(DIR,name)).then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e;});
const compact=e=>e.mean;
const controls=cases=>({fixed:compact(evaluate(cases,'weekly_featured')),none:compact(evaluate(cases,'none'))});
const score=(r,baseline)=>({platformUSD:r.platformUSD,merchantUSD:r.merchantUSD,orders:r.purchases,recommendationPurchases:r.recommendationPurchases,coupons:r.coupons,couponPurchases:r.couponPurchases,platformVsFixed:r.platformUSD-baseline.platformUSD,merchantVsFixed:r.merchantUSD-baseline.merchantUSD});
const ledger=()=>readFile(resolve(ROOT,'.local/gcp/model-spend.json'),'utf8').then(JSON.parse);
const runId=(p,b,arm)=>'DESIGN-'+p.id+'-'+b.id+'-'+arm;

export async function prepare(){
 if(await exists('protocol.json'))throw Error('FROZEN_PROTOCOL_ALREADY_EXISTS');
 const scenarios=[['steady','budget_squeeze'],['rival_sale','returns_wave'],['preference_shift','supply_delay']];
 const blocks=scenarios.map((names,i)=>({id:'block-'+(i+1),development:names.map((scenario,j)=>({scenario,seed:420100+i*10+j})),validation:names.map((scenario,j)=>({scenario,seed:420200+i*10+j})),test:names.flatMap((scenario,j)=>[0,1].map(k=>({scenario,seed:420300+i*100+j*10+k})))}));
 const l=await ledger(),p={id:'construct-v1',createdAt:new Date().toISOString(),settings:SETTINGS,blocks,hashes:await sources(),frozenSimulator:true,backbone:'Gemini 3.1 Pro MEDIUM for every LLM role and single-agent call',maxCalls:18,maxIncrementalUSD:2,lifetimeBeforeUSD:l.entries.reduce((n,e)=>n+e.chargedMicros,0)/1e6,perDesignCapUSD:.25,
  design:'Three construction sessions, two observed development markets each. Independent recommendation and campaign specialists propose two candidates each; coordinator sees four measured trials and proposes one. Single agent gets sequential 2+2+1 candidates and the same three calls. Numerical search evaluates five predefined diverse configurations in the same representation. Fixed winner and no campaign are shared fallbacks.',
  selection:'Choose among five proposals plus common fixed/no-campaign fallbacks by validation mean settled platform contribution, requiring validation mean merchant contribution >= fixed. Validation scores withheld from model calls. Held-out markets are opened only after all policies and selections are frozen.',
  ranking:'Day30 snapshot evaluated against days31-37 no-campaign future purchases; canonical SKU Recall@3 and NDCG@3, plus merchant-offer Recall@3. Count-affinity and popularity controls share canonical mapping. No future labels in model fit.',
  economics:'Paired same seeds, 30-day shared warmup, 60 contact days, 100 total shopping days plus14 return tail. Exact offered-item purchase attribution. Frozen wallet, fatigue, returns, fees, subsidy and outreach assumptions. Report each full construction cost and subtract it once per design block, evenly across its four test markets; also show conservative full-cost-per-market results.',
  primary:'Paired net modeled platform contribution versus fixed, numerical search and matched single agent. Also merchant contribution, recommendation-attributed orders, total orders, retained volume, coupon redemption, ranking, diversity, validation failures, latency and token cost.',
  advancement:{meanNetPlatformVsFixedPositive:true,meanMerchantVsFixedNonnegative:true,meanNetVsNumericalPositive:true,meanNetVsSinglePositive:true,atLeastTestMarketsBetterThanFixed:8,testMarkets:12},
  limits:'Three design sessions and twelve synthetic markets are a pilot, not production profit or proof of general multi-agent superiority. Markets within a design block share a learned policy. No native PayPal calls or external catalog calls.'};
 p.hash=hash(p);await save('protocol.json',p);
 for(const b of blocks){const baseline=controls(b.development);await save(b.id+'-evidence.json',{observations:b.development.map(evidence),developmentControls:baseline,ranking:b.development.map(c=>({scenario:c.scenario,...rankingMetrics(c,'weekly_featured')}))});}
 console.log(JSON.stringify({status:'FROZEN',protocol:p.hash,blocks:3,testMarkets:12,maxCalls:18,maxUSD:2}));
}
async function verify(p){const {hash:h,...rest}=p;if(hash(rest)!==h||JSON.stringify(await sources())!==JSON.stringify(p.hashes))throw Error('FROZEN_PROTOCOL_OR_SOURCE_CHANGED');}
const configSchema={type:'OBJECT',required:['basis','weights','audience','gapDays','minRecency','discountPct','priceRatio'],properties:{basis:{type:'STRING',enum:['blend','featured','none']},weights:{type:'OBJECT',required:WEIGHTS,properties:Object.fromEntries(WEIGHTS.map(k=>[k,{type:'NUMBER',minimum:0,maximum:10}]))},audience:{type:'STRING',enum:['all','observed','lapsed','intent','prospects']},gapDays:{type:'INTEGER',minimum:7,maximum:21,description:'Exactly 7,14 or21.'},minRecency:{type:'INTEGER',minimum:0,maximum:21,description:'Exactly 0,7,14 or21.'},discountPct:{type:'INTEGER',minimum:0,maximum:5,description:'Exactly 0 or5.'},priceRatio:{type:'NUMBER',minimum:0,maximum:4,description:'Exactly 0,1.5,2 or4.'}}};
const system=`You are a commerce policy researcher using typed trusted tools. Propose campaigns that improve SETTLED payment-platform contribution while protecting merchant contribution, rather than maximizing contact counts. This is a frozen synthetic economy, not proven PayPal profit. Never claim a simulation result before a tool measures it. Return concise hypotheses, not chain of thought. No SQL or executable code. All product scores are computed locally from observed data: affinity combines canonical item and category counts; collaborative is a log-count EASE item-item model with ridge32; intent matches a public search in the last14 days; priceFit matches the geometric mean price of observed purchases; value is the modeled fee minus processing cost normalized to the catalog maximum. Scores are a weighted sum (0..10 weights). Merchant exclusions for mature returns, stock and margin guards are mandatory. Contact interval is7/14/21 days; minRecency suppresses very recent buyers. Audience is all, observed, lapsed(14days), intent or prospects. Discount0 or5 only applies to lapsed shoppers at an eligible merchant. PriceRatio0 means unbounded, otherwise reject products exceeding observed historical purchase price times1.5/2/4. basis=featured uses the old weekly featured pack instead of learned ranking; none sends no contacts. Purchases also depend on affordability, latent preferences, fatigue and outside competition. You cannot inspect those private states. Local simulations are available only through returned development trial results. Each role has the same shared data and allowed policy representation. Give exactly the requested number of proposals. Avoid duplicates; refine a promising hypothesis when measured feedback warrants it.`;
async function design(p,b,arm){
 const name=b.id+'-'+arm+'.json';if(await exists(name)){const old=await read(name);if(old.protocolHash!==p.hash||old.status!=='COMPLETED')throw Error('INSPECT_INTERRUPTED_DESIGN_BEFORE_RETRY');return old;}
 const initial=await read(b.id+'-evidence.json'),result={protocolHash:p.hash,block:b.id,arm,status:'RUNNING',checkpoints:[],candidates:[],costUSD:0,invalidCandidates:0,startedAt:new Date().toISOString()};await save(name,result);
 const evaluateProposal=(proposal)=>{try{const config=validateConfig(proposal.config),development=evaluate(b.development,config);return {...proposal,config,valid:true,development:score(compact(development),initial.developmentControls.fixed)};}catch(e){result.invalidCandidates++;return {...proposal,valid:false,error:e.message};}};
 let provider;
 try{
  if(arm==='numerical')result.candidates=NUMERICAL_CANDIDATES.map(evaluateProposal);
  else{
   provider=await openTeamVertex(runId(p,b,arm),{route:'hybrid',capMicros:250000});
   for(let i=0;i<3;i++){
    const l=await ledger(),spent=l.entries.reduce((s,e)=>s+e.chargedMicros,0)/1e6-p.lifetimeBeforeUSD,used=l.entries.filter(e=>e.runId.startsWith('market-DESIGN-'+p.id+'-'));
    if(spent+.15>p.maxIncrementalUSD||used.length>=p.maxCalls||l.entries.some(e=>e.status!=='settled'))throw Error('DESIGN_SPEND_LIMIT');
    const role=arm==='single'?'Generalist '+(i+1):['Recommendation specialist','Campaign economist','Coordinator'][i],count=i<2?2:1;
    const focus=arm==='single'?'Construct and improve the full campaign using all evidence and your prior measured trials.':i===0?'Focus on product relevance, learned ranking and observed demand; construct two distinct full policies.':i===1?'Independently focus on the economics of contact timing, target eligibility and coupon cost; construct two distinct full policies.':'Compare measured specialist trials; compose or refine one full policy with an explicit reason for each change.';
    const packet={role,focus,proposalCount:count,...initial,priorTrials:arm==='multi'&&i<2?[]:result.candidates,defaultConfig:defaults(),trialBudgetRemaining:5-result.candidates.length};
    const fn={name:'propose_policy',description:'Submit typed candidate configurations to the local development simulator.',parameters:{type:'OBJECT',required:['proposals'],properties:{proposals:{type:'ARRAY',minItems:count,maxItems:count,items:{type:'OBJECT',required:['name','rationale','config'],properties:{name:{type:'STRING'},rationale:{type:'STRING'},config:configSchema}}}}}};
    const cp={index:i,role,status:'RUNNING',input:packet,startedAt:new Date().toISOString()};result.checkpoints.push(cp);await save(name,result);
    const call=await provider.client.json(system,packet,{caseId:b.id,trialId:runId(p,b,arm),functions:[fn]});
    if(!Array.isArray(call.args?.proposals)||call.args.proposals.length!==count)throw Error('INVALID_PROPOSAL_COUNT');
    cp.output=call.args;cp.provider=provider.client.events.at(-1);cp.status='COMPLETED';cp.finishedAt=new Date().toISOString();
    result.candidates.push(...call.args.proposals.map(evaluateProposal));result.costUSD=provider.client.events.reduce((s,e)=>s+(e.modelCostMicros??e.reservedMicros),0)/1e6;await save(name,result);
    console.log(JSON.stringify({block:b.id,arm,role,costUSD:result.costUSD,candidates:result.candidates.slice(-count).map(c=>({name:c.name,valid:c.valid,development:c.development}))}));
   }
  }
  const baseline=controls(b.validation),pool=[...result.candidates.filter(c=>c.valid),{name:'Fixed fallback',config:'weekly_featured'},{name:'No-campaign fallback',config:'none'}];
  for(const c of pool)c.validation=score(compact(evaluate(b.validation,c.config)),baseline.fixed);
  const eligible=pool.filter(c=>c.validation.merchantVsFixed>=-1e-8).sort((a,b)=>b.validation.platformUSD-a.validation.platformUSD||a.name.localeCompare(b.name));
  result.selection=eligible[0];result.validationCandidates=pool;result.distinctCandidates=new Set(result.candidates.filter(c=>c.valid).map(c=>hash(c.config))).size;
  result.status='COMPLETED';result.finishedAt=new Date().toISOString();await save(name,result);return result;
 }catch(e){result.status='FAILED';result.error=e.message;if(provider)result.costUSD=provider.client.events.reduce((s,e)=>s+(e.modelCostMicros??e.reservedMicros),0)/1e6;await save(name,result);throw e;}finally{await provider?.close();}
}
export async function runDesigns(){const p=await read('protocol.json');await verify(p);for(const b of p.blocks)for(const arm of ['numerical','single','multi']){await verify(p);const r=await design(p,b,arm);console.log(JSON.stringify({block:b.id,arm,selected:r.selection.name,costUSD:r.costUSD}));}}
export async function test(){
 const p=await read('protocol.json');await verify(p);if(await exists('results.json'))throw Error('HELDOUT_RESULTS_ALREADY_RECORDED');
 const designs={};for(const b of p.blocks)for(const arm of ['numerical','single','multi']){const r=await read(b.id+'-'+arm+'.json');if(r.status!=='COMPLETED'||r.protocolHash!==p.hash)throw Error('ALL_DESIGNS_MUST_BE_FROZEN_BEFORE_TEST');designs[b.id+'-'+arm]=r;}
 const selections=hash(Object.values(designs).map(d=>({block:d.block,arm:d.arm,config:d.selection.config})));await save('test-opened.json',{at:new Date().toISOString(),protocolHash:p.hash,selections});
 const cases=[];for(const b of p.blocks)for(const c of b.test){const rows={};for(const arm of ['none','fixed','numerical','single','multi']){const d=designs[b.id+'-'+arm],policy=d?.selection.config||(arm==='none'?'none':'weekly_featured'),e=evaluate([c],policy).cases[0],cost=d?.costUSD||0;rows[arm]={...e,ranking:rankingMetrics(c,policy),allocatedDesignCostUSD:cost/b.test.length,fullDesignCostUSD:cost,platformNetUSD:e.platformUSD-cost/b.test.length,platformNetFullCostUSD:e.platformUSD-cost};}if(new Set(Object.values(rows).map(r=>r.initialHash)).size!==1)throw Error('PAIRED_INITIAL_STATE_MISMATCH');cases.push({block:b.id,...c,arms:rows});console.log(JSON.stringify({tested:c,deltaVsFixed:rows.multi.platformNetUSD-rows.fixed.platformNetUSD,deltaVsSingle:rows.multi.platformNetUSD-rows.single.platformNetUSD}));}
 const arms=Object.fromEntries(['none','fixed','numerical','single','multi'].map(arm=>[arm,Object.fromEntries(['platformNetUSD','platformNetFullCostUSD','merchantUSD','purchases','retainedUSD','recommendationPurchases','retainedRecommendationPurchases','recommendations','coupons','couponPurchases','recommendationConversion'].map(k=>[k,mean(cases.map(c=>c.arms[arm][k]))]))]));
 for(const arm of Object.keys(arms)){arms[arm].skuRecall3=mean(cases.map(c=>c.arms[arm].ranking.policy.skuRecall3));arms[arm].skuNdcg3=mean(cases.map(c=>c.arms[arm].ranking.policy.skuNdcg3));}
 const differences=Object.fromEntries(['none','fixed','numerical','single'].map(arm=>[arm,{meanPlatformUSD:arms.multi.platformNetUSD-arms[arm].platformNetUSD,meanMerchantUSD:arms.multi.merchantUSD-arms[arm].merchantUSD,meanRecommendationPurchases:arms.multi.recommendationPurchases-arms[arm].recommendationPurchases,wins:cases.filter(c=>c.arms.multi.platformNetUSD>c.arms[arm].platformNetUSD).length,blockDeltas:p.blocks.map(b=>mean(cases.filter(c=>c.block===b.id).map(c=>c.arms.multi.platformNetUSD-c.arms[arm].platformNetUSD)))}]));
 const all=Object.values(designs),summary={protocolHash:p.hash,selections,status:'COMPLETED',createdAt:new Date().toISOString(),testMarkets:cases.length,designSessions:p.blocks.length,arms,differences,modelCostUSD:all.reduce((s,d)=>s+d.costUSD,0),providerCalls:all.reduce((s,d)=>s+d.checkpoints.length,0),invalidCandidates:all.reduce((s,d)=>s+d.invalidCandidates,0),advanceGatePassed:differences.fixed.meanPlatformUSD>0&&differences.fixed.meanMerchantUSD>=0&&differences.numerical.meanPlatformUSD>0&&differences.single.meanPlatformUSD>0&&differences.fixed.wins>=8,cases,designs};
 await save('results.json',summary);console.log(JSON.stringify({status:summary.status,cost:summary.modelCostUSD,arms,differences,advance:summary.advanceGatePassed},null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const command=process.argv[2];if(command==='prepare')await prepare();else if(command==='design')await runDesigns();else if(command==='test')await test();else throw Error('Use prepare, design or test. Paid calls only in design.');
}
