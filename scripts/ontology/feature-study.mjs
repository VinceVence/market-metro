import assert from 'node:assert/strict';
import {createHash,randomInt} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {scoreCampaign,inputFeatures,compileCampaign,assertBinding,read,digest} from '../commerce-expanded/harness-v2/tools.mjs';
import {canonicalHash} from '../commerce-expanded/harness-v2/contracts.mjs';
import {verifyEconomy} from '../commerce-expanded/harness-v2/trials.mjs';
import {loadScaleInputs} from '../commerce-expanded/harness-v2/merchant-scale.mjs';
import {runCoordinatedCase} from '../commerce-expanded/runner.mjs';
import {openAllocator} from '../commerce-deadlines/solver.mjs';
import {contactFeatures} from '../commerce-growth/experiments/program.mjs';
import {observedFeedbackHistory} from '../commerce-growth/autonomy/feedback-features.mjs';
import {predictResponse} from '../commerce-growth/autonomy/features.mjs';
import {predictionMetrics} from '../commerce-growth/autonomy/prediction-metrics.mjs';
import {fitTrainingChoices,trainingMatrix} from './training.mjs';

const folder='docs/ontology/training',scratch='.local/ontology-training';
const protocol=await read(folder+'/protocol.json');
const bundlePath=folder+'/models.json.gz',lockPath=folder+'/holdout.json',publicPath='demo/data/ontology-training.json';
const historicalPath='docs/commerce-growth/autonomy-1/funding-training/dataset.json';
const sourceFiles=[folder+'/protocol.json','scripts/ontology/training.mjs','scripts/ontology/train-features.py','scripts/ontology/feature-study.mjs',
  ...['tools','contracts','inquiry-value','merchant-scale'].map(n=>'scripts/commerce-expanded/harness-v2/'+n+'.mjs'),
  ...['features','feedback-features','team-workbench-tools','prediction-metrics'].map(n=>'scripts/commerce-growth/autonomy/'+n+'.mjs'),
  'scripts/commerce-growth/experiments/program.mjs','scripts/commerce-deadlines/allocator.py',
  'docs/commerce-growth/team-1/training/model.json','docs/commerce-growth/team-1/development/results.json',
  'docs/merchant-scale/ranking-inputs.json.gz',historicalPath,bundlePath];
const sha=b=>createHash('sha256').update(b).digest('hex'),round=n=>Math.round(n*1e6)/1e6;
const prob=(model,x)=>predictResponse(model.artifact.models.boosted,x,model.artifact.featureNames);
const sources=()=>Promise.all(sourceFiles.map(async f=>[f,sha(await readFile(f))])).then(Object.fromEntries);
const key=a=>JSON.stringify([a.customerId,a.kind,a.catalogId]);

async function fit(){
  const {model:base}=await loadScaleInputs(),{rows,featureNames}=await read(historicalPath);
  const {RESPONSE_FIELDS}=await import('../commerce-growth/autonomy/features.mjs');
  assert.deepEqual(featureNames,RESPONSE_FIELDS);
  const result=await fitTrainingChoices(scratch+'/study',rows,[],base,30,{controls:true});
  const matrix=trainingMatrix(rows,[],base,30);
  assert.ok(matrix.rows.every(r=>Math.abs(prob(base,r.x)-prob(result.models.pooled,r.x))<1e-9),'Pooled refit must reproduce the judge classifier');
  const models={...result.models};delete models.pooled;
  for(const m of Object.values(models)){
    delete m.report.runtimeSeconds; // Timing is machine-specific and cannot identify a reproducible fit.
    for(const head of ['valueMeans','sharedValueMeans','sharedValueModel','inquiryValue'])assert.deepEqual(m.artifact[head],base.artifact[head]);
    const allowed=new Set(m.artifact.trainingFields);
    for(const t of m.artifact.models.boosted.trees)assert.ok(t.feature.every(i=>i<0||allowed.has(m.artifact.featureNames[i])));
  }
  const pack={baselineHash:base.modelHash,models,audit:result.audit,pooledValidation:result.models.pooled.report.metrics};
  try{await writeFile(bundlePath,gzipSync(JSON.stringify(pack)),{flag:'wx'});}
  catch(e){if(e.code!=='EEXIST')throw e;assert.deepEqual(JSON.parse(gunzipSync(await readFile(bundlePath))),JSON.parse(JSON.stringify(pack)),'Preserve the registered fitted bundle');}
  console.log('Locked fitted models',result.audit.choices,result.audit.selected.ontology.fields);
}

async function scoreMarket(settings,pack){
  const {contract:campaign,model:incumbent,prior,planMicros}=await loadScaleInputs();
  assert.equal(incumbent.modelHash,pack.baselineHash);
  const models={incumbent,...pack.models},fixed=(await read('docs/commerce-growth/team-1/development/results.json')).selectedFixed;
  const terms={...campaign.campaign,contactsPer100:String(campaign.campaign.contactsPer100),coverDays:String(campaign.campaign.coverDays)};
  const allocator=openAllocator(),outcomes={},panel=[],ordersByDay={},firstDays={};
  let identity=null;
  try{
    for(const arm of ['fixed',...protocol.controls]){
      const actionsByDay=[],model=models[arm];let contract;
      if(model){assert.equal(digest(model.artifact),model.modelHash);contract=compileCampaign(terms,model,campaign.configuration,campaign.context);assertBinding(contract,model);}
      const controller=!model?null:{plan(view){
        const p=scoreCampaign(view,{contract,model,prior});
        if(view.day<view.marketDays)actionsByDay.push({day:view.day,items:p.actions.map(key).sort()});
        if(view.day===30)firstDays[arm]={snapshot:canonicalHash(view),items:p.actions};
        if(arm==='incumbent'&&p.actions.some(a=>a.kind==='recommend')){
          const candidates=new Map(contactFeatures(view,prior,7).filter(c=>c.action.kind==='recommend').map(c=>[key(c.action),c]));
          const history=observedFeedbackHistory(view);
          for(const r of p.ranking.filter(r=>r.kind==='recommend')){
            const x=inputFeatures(view,candidates.get(key(r)),incumbent.artifact.featureNames,history);
            const probabilities=Object.fromEntries(Object.entries(models).map(([a,m])=>[a,prob(m,x)]));
            assert.ok(Math.abs(probabilities.incumbent-r.probability)<1e-9);
            panel.push({day:view.day,shopper:r.customerId,product:r.catalogId,probabilities});
          }
        }
        return p;
      }};
      const r=await runCoordinatedCase(settings,fixed,{prior,allocator,controller,trace:arm==='incumbent'});
      const factors=[r.initialHash,r.opportunityHash,r.consentHash,r.incomeCents];
      identity??=factors;assert.deepEqual(factors,identity);assert.equal(r.unpaidLiabilities,0);assert.ok(r.reliability.invariantsPassed);
      if(arm==='incumbent'){
        const contacts=new Map(r.trace.contacts.filter(c=>c.kind==='recommend').map(c=>[JSON.stringify([c.day,c.customerId,c.catalogId]),c]));
        const orders=new Map(r.trace.orders.map(o=>[o.requestId,o]));
        for(const row of panel){
          const c=contacts.get(JSON.stringify([row.day,row.shopper,row.product]));assert.ok(c);assert.ok(row.day+26<126);
          const o=orders.get(c.requestId);row.y=Number(!!o&&!['PENDING_FUNDS','SETTLED'].includes(o.refundStatus));
        }
        assert.equal(panel.length,r.recommendationsSent);
      }
      const cost=model?planMicros/1e6:0;
      outcomes[arm]={paypal:round(r.platformUSD-cost),merchants:r.retailerUSD,purchases:r.retainedPurchases,volume:r.retainedVolumeUSD,
        recommendations:r.recommendationsSent,exactProductBaskets:r.recommendationPurchases,originalPlanCost:cost};
      if(model)ordersByDay[arm]=actionsByDay;
    }
  }finally{allocator.close();}
  const changedDays={};
  for(const arm of protocol.controls)changedDays[arm]=ordersByDay[arm].filter((d,i)=>JSON.stringify(d.items)!==JSON.stringify(ordersByDay.incumbent[i].items)).length;
  const firstChange={};
  for(const arm of protocol.controls.slice(1)){
    assert.equal(firstDays[arm].snapshot,firstDays.incumbent.snapshot);
    const original=new Set(firstDays.incumbent.items.map(key)),challenger=new Set(firstDays[arm].items.map(key));
    firstChange[arm]={added:firstDays[arm].items.filter(a=>!original.has(key(a))),removed:firstDays.incumbent.items.filter(a=>!challenger.has(key(a)))};
  }
  console.log('Settled',settings.regime,settings.seed,'common evaluation rows',panel.length);
  return {...settings,identity,outcomes,changedDays,firstChange,panel};
}

function stats(rows,arm){
  if(!rows.length)return {n:0,positives:0,auc:null,averagePrecision:null,brier:null,logLoss:null,macroMarketAUC:null};
  const {roc,marketAUCs,...m}=predictionMetrics(rows.map(r=>({y:r.y,p:r.probabilities[arm],market:r.market})));return m;
}
const pack=()=>readFile(bundlePath).then(b=>JSON.parse(gunzipSync(b)));
if(!isMainThread){
  parentPort.postMessage(await scoreMarket(workerData,await pack()));
}else if(process.argv[2]==='--fit'){
  await mkdir(scratch,{recursive:true});await fit();
}else if(process.argv[2]==='--register'){
  assert.equal(execFileSync('git',['status','--porcelain','--',...sourceFiles],{encoding:'utf8'}).trim(),'','Commit the model choices and study before opening new seeds');
  const used=new Set((await read('demo/data/commerce-reactivation-fresh.json')).cases.map(c=>c.seed));
  for(const s of (await read('docs/merchant-scale/protocol.json')).seeds)used.add(s);
  const cases=protocol.markets.map(regime=>{let seed;do{seed=randomInt(100000000,999999999);}while(used.has(seed));used.add(seed);return {seed,regime};});
  const lock={study:protocol.study,commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sources:await sources(),cases,
    economyHash:canonicalHash((await verifyEconomy()).economyHashes)};
  await writeFile(lockPath,JSON.stringify(lock,null,2)+'\n',{flag:'wx'});console.log('Registered all markets',cases);
}else if(process.argv[2]==='--run'){
  const lock=await read(lockPath);assert.deepEqual(await sources(),lock.sources);assert.equal(canonicalHash((await verifyEconomy()).economyHashes),lock.economyHash);
  const cases=[];
  const worker=c=>new Promise((resolve,reject)=>{const w=new Worker(new URL(import.meta.url),{workerData:c});let r;
    w.once('message',v=>{r=v;});w.once('error',reject);w.once('exit',code=>code||!r?reject(Error('WORKER_FAILED')):resolve(r));});
  for(let i=0;i<lock.cases.length;i+=2)cases.push(...await Promise.all(lock.cases.slice(i,i+2).map(worker)));
  const panel=cases.flatMap(c=>c.panel.map(r=>({...r,market:c.seed}))),quality={};
  const totals={};
  for(const arm of ['fixed',...protocol.controls]){
    const rows=cases.map(c=>c.outcomes[arm]);totals[arm]=Object.fromEntries(Object.keys(rows[0]).map(k=>[k,round(rows.reduce((s,r)=>s+r[k],0))]));
    if(arm!=='fixed')quality[arm]=stats(panel,arm);
  }
  for(const c of cases){c.quality=Object.fromEntries(protocol.controls.map(a=>[a,stats(c.panel,a)]));delete c.panel;}
  const {models,audit,pooledValidation}=await pack(),o=totals.ontology,b=totals.incumbent;
  const promotion={betterLogLoss:quality.ontology.logLoss<quality.incumbent.logLoss,higherPayPal:o.paypal>b.paypal,higherMerchants:o.merchants>b.merchants,purchasesProtected:o.purchases>=b.purchases};
  const result={study:protocol.study,lock,development:{audit,pooledValidation,quality:Object.fromEntries(Object.entries(models).map(([k,m])=>[k,m.report.metrics]))},
    cases,quality,totals,promotion,recommendPromotion:Object.values(promotion).every(Boolean),newModelCalls:0,newPayments:0};
  assert.deepEqual(await sources(),lock.sources);await verifyEconomy();
  if(process.argv.includes('--publish')){
    try{assert.deepEqual(await read(publicPath),result,'Existing study differs. Preserve the registered results.');}
    catch(e){if(e.code!=='ENOENT')throw e;await writeFile(publicPath,JSON.stringify(result,null,2)+'\n',{flag:'wx'});}
  }
  console.log(JSON.stringify({quality,totals,promotion},null,2));
}else throw Error('Use --fit, --register or --run [--publish].');
