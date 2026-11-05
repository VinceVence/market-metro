import assert from 'node:assert/strict';
import {mkdir, rename, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {observeGrowthWorld} from '../environment.mjs';
import {runCoordinatedCase} from '../runner.mjs';
import {openAllocator} from '../../commerce-deadlines/solver.mjs';
import {canonicalHash} from './contracts.mjs';
import {assertBinding,digest,fitModel,read,scoreCampaign} from './tools.mjs';
import {verifyEconomy} from './trials.mjs';

const folder='docs/commerce-expanded/model-check/reactivation-fresh';
const protocol=await read(join(folder,'protocol.json'));
const {lockHash,...lock}=await read(join(folder,'decisions.json'));
assert.equal(canonicalHash(lock),lockHash);assert.equal(canonicalHash(protocol),lock.protocolHash);
assert.equal(canonicalHash((await verifyEconomy()).economyHashes),lock.economyHash);
assert.deepEqual(lock.arms.map(a=>a.seed+'-'+a.arm).sort(),
  protocol.seeds.flatMap(seed=>protocol.arms.map(arm=>seed+'-'+arm)).sort());
assert.ok(lock.arms.every(a=>a.sourceHash===lock.sourceHash && a.protocolHash===lock.protocolHash));
const fixed=(await read('docs/commerce-growth/team-1/development/results.json')).selectedFixed;
const prior=await read('docs/commerce-growth/team-1/training/model.json');
const work=join('.local',protocol.id),models=new Map();
const round=n=>Math.round(n*1e6)/1e6;
function amounts(row,paidMicros){
  return {paypal:round(row.platformUSD-paidMicros/1e6),merchants:row.retailerUSD,purchases:row.retainedPurchases,
    volume:row.retainedVolumeUSD,paypalBeforeAI:row.platformUSD,aiCost:paidMicros/1e6};
}
const delta=(a,b)=>Object.fromEntries(Object.keys(a).map(k=>[k,round(a[k]-b[k])]));
const positive=a=>a.paypal>0 && a.merchants>0 && a.purchases>0;
async function modelFor(arm,contract){
  if(models.has(contract.modelHash))return models.get(contract.modelHash);
  const fit=arm.models.find(m=>m.hash===contract.modelHash);
  assert.ok(fit && fit.ownRows===0);
  let model;
  try{model=await read(join(work,arm.id,'review-'+protocol.decisionDay,'fit-'+fit.slot,'model.json'));}
  catch(e){
    if(e.code!=='ENOENT')throw e;
    const {rows}=await read('docs/commerce-growth/autonomy-1/funding-training/dataset.json');
    model=await fitModel(join(work,'reconstruct',fit.hash),rows,[],fit.spec,protocol.decisionDay);
  }
  assert.equal(model.cutoffDay,protocol.decisionDay);assert.equal(model.ownRows,0);
  assert.equal(digest(model.artifact),fit.hash);assert.equal(model.modelHash,fit.hash);
  assert.deepEqual(model.report.metrics,fit.metrics);assert.deepEqual(model.artifact.spec,fit.spec);
  models.set(fit.hash,model);return model;
}
const allocator=openAllocator(),cases=[];
try{
  for(const seed of protocol.seeds){
    const arms=lock.arms.filter(a=>a.seed===seed);
    assert.equal(arms[0].snapshotHash,arms[1].snapshotHash);
    const snapshotHash=arms[0].snapshotHash;
    const settings={seed,regime:protocol.regime},byContract=new Map();
    const project=w=>{
      const v=observeGrowthWorld(w);
      if(v.day===protocol.decisionDay)assert.equal(canonicalHash(v),snapshotHash);
      return v;
    };
    const execute=controller=>runCoordinatedCase(settings,fixed,{allocator,prior,controller,observationProjector:project});
    const base=await execute(null);
    assert.equal(base.unpaidLiabilities,0);assert.ok(base.reliability.invariantsPassed);
    byContract.set('FIXED',base);
    const rows={fixed:amounts(base,0)},choices={};
    for(const arm of arms){
      choices[arm.arm]={complete:arm.complete,modelCheck:arm.comparison?.status??'fallback',
        original:arm.original?.hash??'FIXED',checked:arm.checked?.hash??'FIXED',
        paidMicros:arm.paidMicros,calls:arm.decisions.reduce((s,d)=>s+d.provider.length,0)};
      for(const version of ['original','checked']){
        const contract=arm[version],key=contract?.hash??'FIXED';
        if(contract){
          const model=await modelFor(arm,contract);assertBinding(contract,model);
          if(!byContract.has(key))byContract.set(key,await execute({plan:view=>scoreCampaign(view,{contract,model,prior})}));
        }
        const r=byContract.get(key);
        for(const name of ['initialHash','opportunityHash','consentHash','incomeCents'])assert.equal(r[name],base[name]);
        assert.equal(r.unpaidLiabilities,0);assert.ok(r.reliability.invariantsPassed);
        rows[arm.arm+'_'+version]=amounts(r,arm.paidMicros);
      }
    }
    const comparisons={singleVsFixed:delta(rows.single_checked,rows.fixed),teamVsFixed:delta(rows.team_checked,rows.fixed),
      teamVsSingle:delta(rows.team_checked,rows.single_checked),singleVerifier:delta(rows.single_checked,rows.single_original),
      teamVerifier:delta(rows.team_checked,rows.team_original)};
    cases.push({seed,snapshotHash,opportunityHash:base.opportunityHash,allocatedPolicies:byContract.size,
      unpaidLiabilities:0,choices,rows,comparisons});
    console.log('Settled seed',seed,JSON.stringify(comparisons));
  }
}finally{allocator.close();}
function sum(rows){return Object.fromEntries(Object.keys(rows[0]).map(k=>[k,round(rows.reduce((s,r)=>s+r[k],0))]));}
const totals=Object.fromEntries(Object.keys(cases[0].rows).map(key=>[key,sum(cases.map(c=>c.rows[key]))]));
const comparisons=Object.fromEntries(Object.keys(cases[0].comparisons).map(key=>{
  const rows=cases.map(c=>c.comparisons[key]),total=sum(rows);
  const wins=rows.filter(positive).length,ordered=rows.map(x=>x.paypal).sort((a,b)=>a-b);
  return [key,{total,strictJointWins:wins,positivePayPalSeeds:rows.filter(x=>x.paypal>0).length,
    medianPayPal:round((ordered[Math.floor((ordered.length-1)/2)]+ordered[Math.floor(ordered.length/2)])/2),
    majorityRepeat:wins>=4 && positive(total)}];
}));
const summary={protocolHash:lock.protocolHash,lockHash,economyHash:lock.economyHash,sourceHash:lock.sourceHash,
  completeReviews:lock.arms.filter(a=>a.complete).length,modelCalls:lock.arms.flatMap(a=>a.decisions.flatMap(d=>d.provider)).length,
  freshDecisions:lock.arms.flatMap(a=>a.decisions.filter(d=>d.status==='VALIDATED')).length,
  localFits:lock.arms.reduce((s,a)=>s+a.models.length,0),studyCostUSD:lock.studyMicros/1e6,projectModelUSD:lock.projectMicros/1e6,
  nativePayments:0,totals,comparisons,cases};
assert.equal(round(totals.single_checked.aiCost+totals.team_checked.aiCost),summary.studyCostUSD);
assert.equal(canonicalHash((await verifyEconomy()).economyHashes),lock.economyHash);
const out=process.argv.includes('--publish')?join(folder,'results.json'):join(work,'replicated-results.json');
await mkdir(work,{recursive:true});await writeFile(out+'.tmp',JSON.stringify(summary,null,2)+'\n');await rename(out+'.tmp',out);
console.log('Six paired markets',JSON.stringify(comparisons),out);
