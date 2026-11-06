import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {loadScaleInputs} from './merchant-scale.mjs';
import {read,scoreCampaign,assertBinding} from './tools.mjs';
import {canonicalHash} from './contracts.mjs';
import {verifyEconomy} from './trials.mjs';
import {warmGrowthWorld} from '../commerce.mjs';
import {beginGrowthDay,observeGrowthWorld} from '../environment.mjs';
import {runCoordinatedCase} from '../runner.mjs';
import {openAllocator} from '../../commerce-deadlines/solver.mjs';

export const capacityProtocol=await read('docs/merchant-capacity/protocol.json');
const work='.local/merchant-capacity',round=n=>Math.round(n*1e6)/1e6;
let prepared;
async function inputs(){
  return prepared??=(async()=>{
    const original=await loadScaleInputs();
    const views=capacityProtocol.seeds.map((seed,index)=>{
      if(index<original.views.length){assert.equal(seed,92471001+index);return original.views[index];}
      const world=warmGrowthWorld({seed,regime:capacityProtocol.regime});beginGrowthDay(world);
      const view=observeGrowthWorld(world);assert.equal(view.day,30);assert.equal(view.audience.length,600);return view;
    });
    return {...original,views};
  })().catch(error=>{prepared=undefined;throw error;});
}

export async function rankCapacity(districts){
  if(!capacityProtocol.districts.includes(districts))throw RangeError('Choose one, two, four or eight districts');
  const {views,contract,model,prior}=await inputs();
  const start=performance.now(),plans=views.slice(0,districts).map(view=>scoreCampaign(view,{contract,model,prior}));
  const rankingMs=performance.now()-start;
  const count=kind=>plans.reduce((n,p)=>n+p.actions.filter(a=>a.kind===kind).length,0);
  return {districts,merchants:districts*12,shoppers:districts*600,listings:districts*48,
    recommendations:count('recommend'),inquiries:count('ask_need'),rankingMs,
    actionHash:canonicalHash(plans.map(p=>p.actions)),modelHash:model.modelHash,newModelCalls:0,
    examples:plans.flatMap((p,i)=>{const a=p.actions.find(a=>a.kind==='recommend');return a?[{district:i+1,seed:capacityProtocol.seeds[i],
      shopper:a.customerId,product:views[i].products.find(x=>x.catalogId===a.catalogId).title}]:[];})};
}

async function save(path,value){await writeFile(path+'.tmp',JSON.stringify(value,null,2)+'\n');await rename(path+'.tmp',path);}
async function optional(path){try{return await read(path);}catch(e){if(e.code!=='ENOENT')throw e;return null;}}
async function registration(){
  const economy=await verifyEconomy(),{contract,model,prior}=await loadScaleInputs();
  const paths=[...new Set([...Object.keys(economy.economyHashes),...Object.keys(economy.implementationHashes),
    'scripts/commerce-expanded/harness-v2/capacity.mjs','scripts/commerce-expanded/harness-v2/merchant-scale.mjs',
    'scripts/commerce-expanded/harness-v2/tools.mjs','scripts/commerce-expanded/harness-v2/inquiry-value.mjs',
    'scripts/commerce-deadlines/allocator.py','docs/merchant-scale/ranking-inputs.json.gz',
    'docs/commerce-growth/team-1/development/results.json'])];
  return {protocol:capacityProtocol,modelHash:model.modelHash,contractHash:contract.hash,priorHash:canonicalHash(prior),
    economyHash:canonicalHash(economy.economyHashes),sources:Object.fromEntries(await Promise.all(paths.map(async path=>
      [path,createHash('sha256').update(await readFile(path)).digest('hex')])))};
}

async function district(index,lock){
  const seed=capacityProtocol.seeds[index],path=work+'/'+seed+'.json';
  const cached=await optional(path);
  if(cached){assert.equal(cached.registrationHash,canonicalHash(lock));return cached;}
  const {contract,model,prior}=await loadScaleInputs();assertBinding(contract,model);
  const fixed=(await read('docs/commerce-growth/team-1/development/results.json')).selectedFixed;
  const allocator=openAllocator(),arms={},start=performance.now();let identity;
  try{
    for(const arm of ['fixed','planner']){
      let firstActions=null,snapshotHash=null;
      const controller=arm==='planner'?{plan(view){const p=scoreCampaign(view,{contract,model,prior});
        if(view.day===30){firstActions=canonicalHash(p.actions);snapshotHash=canonicalHash(view);}return p;}}:null;
      const row=await runCoordinatedCase({seed,regime:capacityProtocol.regime},fixed,{allocator,prior,controller});
      const factors=[row.initialHash,row.opportunityHash,row.consentHash,row.incomeCents];
      identity??=factors;assert.deepEqual(factors,identity);assert.ok(row.reliability.invariantsPassed);assert.equal(row.unpaidLiabilities,0);
      arms[arm]={paypalBeforeAI:row.platformUSD,merchants:row.retailerUSD,purchases:row.retainedPurchases,volume:row.retainedVolumeUSD,
        recommendations:row.recommendationsSent,matchedBaskets:row.recommendationPurchases,contacts:row.contactCount,
        merchantContributions:row.merchantContributions,unpaidLiabilities:row.unpaidLiabilities,
        simulatedDays:126,wallMs:row.reliability.totalWallMs,firstActions,snapshotHash};
    }
  }finally{allocator.close();}
  const result={seed,index,registrationHash:canonicalHash(lock),identity,...arms,wallSeconds:(performance.now()-start)/1000};
  await save(path,result);console.log('Settled district',index+1,'PayPal delta',round(arms.planner.paypalBeforeAI-arms.fixed.paypalBeforeAI),'purchases',arms.planner.purchases-arms.fixed.purchases);
  return result;
}

async function benchmark(){
  await mkdir(work,{recursive:true});
  const lock=await registration(),lockPath='docs/merchant-capacity/registration.json',old=await optional(lockPath);
  if(old)assert.deepEqual(old,lock,'Registered scale method changed');
  else await writeFile(lockPath,JSON.stringify(lock,null,2)+'\n',{flag:'wx'});
  const start=performance.now(),cases=[];
  for(let i=0;i<capacityProtocol.seeds.length;i+=2){
    cases.push(...await Promise.all([i,i+1].map(index=>new Promise((resolve,reject)=>{
      const worker=new Worker(new URL(import.meta.url),{workerData:{task:'capacity',index,lock}});let value;
      worker.once('message',r=>{value=r;});worker.once('error',reject);
      worker.once('exit',code=>{if(code||!value)reject(Error('Capacity worker failed '+index));else resolve(value);});
    }))));
  }
  const settlementWallSeconds=(performance.now()-start)/1000;
  const {views,planMicros,model,contract,prior}=await inputs();
  for(const c of cases){
    assert.equal(c.planner.snapshotHash,canonicalHash(views[c.index]));
    assert.equal(c.planner.firstActions,canonicalHash(scoreCampaign(views[c.index],{contract,model,prior}).actions));
  }
  const previous=await read('demo/data/merchant-scale.json');
  for(const c of cases.slice(0,4)){
    const old=previous.cases[c.index].tiers.find(t=>t.feeds===12);
    for(const arm of ['fixed','planner'])for(const metric of ['paypalBeforeAI','merchants','volume','recommendations','matchedBaskets'])assert.equal(c[arm][metric],old[arm][metric]);
    assert.equal(c.planner.purchases,old.planner.retained);assert.equal(c.fixed.purchases,old.fixed.retained);
  }
  const deployments=[];
  for(const size of capacityProtocol.districts){
    const sample=cases.slice(0,size),rows={};
    for(const arm of ['fixed','planner']){
      rows[arm]=Object.fromEntries(['paypalBeforeAI','merchants','purchases','volume','contacts','recommendations','matchedBaskets'].map(k=>[k,round(sample.reduce((n,c)=>n+c[arm][k],0))]));
      rows[arm].planCostUSD=arm==='planner'?planMicros/1e6:0;
      rows[arm].paypal=round(rows[arm].paypalBeforeAI-rows[arm].planCostUSD);
    }
    const warm=await rankCapacity(size),times=[];
    for(let i=0;i<15;i++){const r=await rankCapacity(size);assert.equal(r.actionHash,warm.actionHash);times.push(r.rankingMs);}
    times.sort((a,b)=>a-b);
    const delta=Object.fromEntries(['paypal','merchants','purchases','volume'].map(k=>[k,round(rows.planner[k]-rows.fixed[k])]));
    deployments.push({districts:size,merchants:size*12,shoppers:size*600,...rows,delta,
      paypalGainPer100:round(delta.paypal/(size*6)),purchaseGainPer100:round(delta.purchases/(size*6)),
      merchantWins:sample.reduce((n,c)=>n+Object.keys(c.fixed.merchantContributions).filter(id=>c.planner.merchantContributions[id]>c.fixed.merchantContributions[id]).length,0),
      day31:{actionHash:warm.actionHash,recommendations:warm.recommendations,inquiries:warm.inquiries,medianMs:round(times[7]),p95Ms:round(times[14]),samples:15}});
  }
  assert.deepEqual(await registration(),lock);
  const report={version:capacityProtocol.id,registrationHash:canonicalHash(lock),modelHash:model.modelHash,
    cases,deployments,newModelCalls:0,newPayments:0,settlementWallSeconds,environment:{node:process.version,platform:process.platform,arch:process.arch},
    scope:capacityProtocol.economy,timingScope:capacityProtocol.timing};
  await save('demo/data/merchant-capacity.json',report);console.log(JSON.stringify({settlementWallSeconds,deployments},null,2));
}

if(!isMainThread&&workerData?.task==='capacity')parentPort.postMessage(await district(workerData.index,workerData.lock));
else if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.argv.includes('--run'))throw Error('Use --run for the registered local scale comparison.');
  await benchmark();
}
