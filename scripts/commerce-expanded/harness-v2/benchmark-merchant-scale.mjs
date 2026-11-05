import assert from 'node:assert/strict';
import {writeFile,rename,mkdir} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {canonicalHash} from './contracts.mjs';
import {assertBinding,fitModel,read,scoreCampaign} from './tools.mjs';
import {scaleFolder,scaleProtocol as protocol,enrolledStores,withFeeds,loadScaleInputs,rankDistricts} from './merchant-scale.mjs';
import {verifyEconomy,DEVELOPMENT_CASES} from './trials.mjs';
import {warmGrowthWorld} from '../commerce.mjs';
import {beginGrowthDay,observeGrowthWorld} from '../environment.mjs';
import {runCoordinatedCase} from '../runner.mjs';
import {openAllocator} from '../../commerce-deadlines/solver.mjs';
import {outreachPlan} from '../../commerce-growth/team/control.mjs';

const scratch='.local/merchant-scale',round=n=>Math.round(n*1e6)/1e6;
async function prepare(){
  const {lockHash,...lock}=await read('docs/commerce-expanded/model-check/reactivation-fresh/decisions.json');
  assert.equal(canonicalHash(lock),lockHash);
  const arm=lock.arms.find(a=>a.seed===92111706&&a.arm==='single'),fit=arm.models.find(m=>m.hash===arm.checked.modelHash);
  assert.ok(arm.complete&&arm.comparison.status==='switched');
  for(const seed of protocol.seeds)assert.ok(!lock.arms.some(a=>a.seed===seed)&&!DEVELOPMENT_CASES.some(a=>a.seed===seed));
  let source;
  try{source=await read(`.local/reactivation-fresh-r1/${arm.id}/review-30/fit-${fit.slot}/model.json`);}
  catch(error){if(error.code!=='ENOENT')throw error;
    const {rows}=await read('docs/commerce-growth/autonomy-1/funding-training/dataset.json');
    source=await fitModel(scratch+'/refit',rows,[],fit.spec,30);}
  const {id,modelHash,artifact,cutoffDay}=source,model={id,modelHash,artifact,cutoffDay};
  assertBinding(arm.checked,model);assert.equal(modelHash,fit.hash);
  const views=protocol.seeds.map(seed=>{
    const w=warmGrowthWorld({seed,regime:protocol.regime});beginGrowthDay(w);
    const v=observeGrowthWorld(w);assert.equal(v.day,30);assert.equal(v.audience.length,600);assert.equal(v.products.length,48);
    return v;
  });
  const data={protocolHash:canonicalHash(protocol),contract:arm.checked,model,planMicros:arm.paidMicros,views};
  const path=scaleFolder+'/ranking-inputs.json.gz';
  await writeFile(path+'.tmp',gzipSync(JSON.stringify({...data,hash:canonicalHash(data)})));await rename(path+'.tmp',path);
  console.log('Prepared four day-31 observations and the verified judge model.');
}

async function runDistrict(index){
  const seed=protocol.seeds[index],params={seed,regime:protocol.regime};
  const {views,model,contract,prior}=await loadScaleInputs();
  const fixed=(await read('docs/commerce-growth/team-1/development/results.json')).selectedFixed;
  const products=new Map(views[index].products.map(p=>[p.id,p]));
  const openingView=canonicalHash(views[index]);
  const allocator=openAllocator(),tiers=[];let identity=null;
  try{
    for(const feeds of protocol.feeds){
      const enrolled=enrolledStores(views[index].merchants,feeds,index),pair={};
      assert.equal(enrolled.size,feeds);
      for(const arm of ['fixed','planner']){
        let firstActions;
        const controller={plan:view=>{
          const proposal=arm==='planner'?scoreCampaign(view,{contract,model,prior}):{...outreachPlan(view,fixed.config,prior),configuration:fixed.config};
          if(view.day===30)firstActions=canonicalHash(proposal.actions);
          return proposal;
        }};
        const row=await runCoordinatedCase(params,fixed,{allocator,prior,trace:true,controller,observationProjector:w=>{
          const v=observeGrowthWorld(w);if(v.day===30)assert.equal(canonicalHash(v),openingView);
          return withFeeds(v,enrolled);
        }});
        assert.ok(row.reliability.invariantsPassed);assert.equal(row.unpaidLiabilities,0);
        const exogenous={opening:row.initialHash,needs:row.opportunityHash,consent:row.consentHash,incomeCents:row.incomeCents};
        identity??=exogenous;assert.deepEqual(exogenous,identity);
        const recommended=new Map(row.trace.contacts.filter(c=>c.kind==='recommend'&&c.consentChecked&&c.requestId).map(c=>[c.requestId,c.catalogId]));
        const sellers=new Set();let baskets=0;
        for(const o of row.trace.orders){
          if(o.day<30||['SETTLED','PENDING_FUNDS'].includes(o.refundStatus)||!recommended.has(o.requestId))continue;
          const matches=o.items.filter(i=>products.get(i.productId).catalogId===recommended.get(o.requestId));
          if(matches.length)baskets++;
          for(const i of matches)sellers.add(i.merchantId);
        }
        assert.equal(baskets,row.recommendationPurchases);assert.ok(firstActions);
        pair[arm]={paypalBeforeAI:row.platformUSD,merchants:row.retailerUSD,retained:row.retainedPurchases,volume:row.retainedVolumeUSD,
          recommendations:row.recommendationsSent,matchedBaskets:baskets,fulfilledSellerIds:[...sellers].sort(),
          enrolledSellersReached:[...sellers].filter(id=>enrolled.has(id)).length,
          byMerchant:row.merchantContributions,firstActions};
      }
      tiers.push({feeds,enrolled:[...enrolled],...pair});
      console.log('Settled district',index+1,'with',feeds,'feeds');
    }
  }finally{allocator.close();}
  return {index,seed,identity,tiers};
}

function worker(index){
  return new Promise((resolve,reject)=>{
    const w=new Worker(new URL(import.meta.url),{workerData:{index}});let result;
    w.once('message',value=>{result=value;});w.once('error',reject);
    w.once('exit',code=>{if(code||!result)reject(Error('Scale worker failed '+index));else resolve(result);});
  });
}

async function summarize(cases){
  const {planMicros,hash,model}=await loadScaleInputs(),plans=[];
  for(const districts of protocol.districts)for(const feeds of protocol.feeds){
    const sample=cases.slice(0,districts).map(c=>c.tiers.find(t=>t.feeds===feeds));
    const sum=(arm,key)=>sample.reduce((n,r)=>n+r[arm][key],0);
    const arms={};
    for(const arm of ['fixed','planner']){
      const cost=arm==='planner'?planMicros/1e6:0;
      arms[arm]={paypal:round(sum(arm,'paypalBeforeAI')-cost),merchants:round(sum(arm,'merchants')),retained:sum(arm,'retained'),
        volume:round(sum(arm,'volume')),recommendations:sum(arm,'recommendations'),matchedBaskets:sum(arm,'matchedBaskets'),
        enrolledSellersReached:sum(arm,'enrolledSellersReached')};
    }
    const delta=Object.fromEntries(Object.keys(arms.planner).map(k=>[k,round(arms.planner[k]-arms.fixed[k])]));
    const merchantWins=sample.reduce((n,r)=>n+r.enrolled.filter(id=>r.planner.byMerchant[id]>r.fixed.byMerchant[id]).length,0);
    const {actionHash,...live}=await rankDistricts(districts,feeds);
    const latencies=[];
    for(let i=0;i<15;i++){
      const r=await rankDistricts(districts,feeds);assert.equal(r.actionHash,actionHash);latencies.push(r.rankingMs);
    }
    latencies.sort((a,b)=>a-b);
    plans.push({districts,feeds,stores:districts*feeds,shoppers:districts*600,listings:districts*feeds*4,...arms,delta,merchantWins,
      paypalLiftPer100:round(delta.paypal/(districts*6)),purchaseLiftPer100:round(delta.retained/(districts*6)),
      day31:{actionHash,recommendations:live.recommendations,inquiries:live.inquiries,medianMs:round(latencies[7]),p95Ms:round(latencies[14]),samples:latencies.length}});
  }
  return {version:protocol.id,protocolHash:canonicalHash(protocol),inputHash:hash,economyHash:canonicalHash((await verifyEconomy()).economyHashes),
    modelHash:model.modelHash,planCostUSD:planMicros/1e6,newModelCalls:0,newPayments:0,cases,deployments:plans};
}

if(!isMainThread)parentPort.postMessage(await runDistrict(workerData.index));
else{
  await verifyEconomy();await mkdir(scratch,{recursive:true});
  if(process.argv.includes('--prepare'))await prepare();
  if(process.argv.includes('--run')){
    const cases=[];
    for(let i=0;i<protocol.seeds.length;i+=2)cases.push(...await Promise.all([worker(i),worker(i+1)]));
    const result=await summarize(cases),path=process.argv.includes('--publish')?'demo/data/merchant-scale.json':scratch+'/results.json';
    await writeFile(path+'.tmp',JSON.stringify(result,null,2)+'\n');await rename(path+'.tmp',path);
    console.log('Published',path,JSON.stringify(result.deployments.map(d=>[d.districts,d.feeds,d.delta.paypal,d.delta.retained,d.planner.enrolledSellersReached])));
  }else if(!process.argv.includes('--prepare'))throw Error('Use --run to evaluate the registered scale comparison.');
}
