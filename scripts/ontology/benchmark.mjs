import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash,randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {verifyMerchantFeed} from '../../demo/commerce/feed-verifier.mjs';
import {merchantExport,syntheticLedger} from './feeds.mjs';

const folder='docs/ontology',lockPath=folder+'/holdout-lock.json',output='demo/data/ontology-study.json';
const read=async file=>JSON.parse(await readFile(file,'utf8'));
const hash=data=>createHash('sha256').update(data).digest('hex');
const sources=[folder+'/protocol.json','demo/commerce/feed-verifier.mjs','scripts/ontology/feeds.mjs','scripts/ontology/benchmark.mjs'];
const fingerprints=Object.fromEntries(await Promise.all(sources.map(async p=>[p,hash(await readFile(p))])));
const protocol=await read(sources[0]);
const reasons={'ambiguous-checkout-link':'ambiguous-link','unit-unknown':'unit-unknown','duplicate-merchant-order':'duplicate-order',
  'orphan-merchant-order':'orphan-order','gross-disagreement':'gross-disagreement','conflicting-flat-checkout':'conflicting-checkout'};
if(process.argv[2]==='--file'){
  const feed=await read(process.argv[3]);
  console.log(JSON.stringify({fixed:verifyMerchantFeed(feed,{mode:'fixed'}),ontology:verifyMerchantFeed(feed)},null,2));
}else if(process.argv[2]==='--register'){
  assert.equal(execFileSync('git',['status','--porcelain','--',...sources],{encoding:'utf8'}).trim(),'','Commit the methods before unsealing merchant exports');
  const lock={study:protocol.study,commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    sources:fingerprints,registeredAt:new Date().toISOString(),seed:randomBytes(16).toString('hex')};
  await writeFile(lockPath,JSON.stringify(lock,null,2)+'\n',{flag:'wx'});
  console.log('Locked new evaluation seed',lock.seed,'against',lock.commit);
}else if(process.argv[2]==='--run'){
  const lock=await read(lockPath);assert.deepEqual(fingerprints,lock.sources,'Methods changed after holdout registration');
  assert.equal(lock.study,protocol.study);
  const cases=[],total={};
  for(const mode of ['fixed','ontology'])total[mode]={exactCertifications:0,unnecessaryHolds:0,unsafeHeld:0,falseCertifications:0,wrongNumbers:0,holdReasonsMatched:0};
  const seen=new Set();
  for(let i=0;i<protocol.repetitions;i++)for(const family of [...protocol.answerableFamilies,...protocol.holdFamilies]){
    const fault=protocol.holdFamilies.includes(family)?family:null;
    const layout=fault?(fault==='conflicting-flat-checkout'?(i?'renamed-flat':'standard-flat'):(i?'renamed-relational':'warehouse')):family;
    const seed=hash(lock.seed+'/'+i+'/'+family),ledger=syntheticLedger(seed);
    const feed=merchantExport(ledger,layout,seed,{fault});
    const digest=hash(JSON.stringify(feed));assert.ok(!seen.has(digest));seen.add(digest);
    const expected=fault?null:{purchases:ledger.checkouts.length,merchantOrders:ledger.checkouts.reduce((s,c)=>s+c[2].length,0),
      splitBaskets:ledger.checkouts.filter(c=>c[2].length>1).length,grossCents:ledger.checkouts.reduce((s,c)=>s+c[1],0)};
    const row={id:'M'+String(cases.length+1).padStart(2,'0'),family,layout,feedHash:digest,expected,expectedHold:reasons[fault]??null};
    for(const mode of ['fixed','ontology']){
      const {decision,code,reason,metrics}=verifyMerchantFeed(feed,{mode});
      row[mode]={decision,metrics,...(code?{code,reason}:{})};
      const t=total[mode];
      if(decision==='HOLD'){
        assert.equal(metrics,null);if(expected)t.unnecessaryHolds++;else{t.unsafeHeld++;if(code===row.expectedHold)t.holdReasonsMatched++;}
      }else if(!expected)t.falseCertifications++;
      else if(Object.keys(expected).every(k=>metrics[k]===expected[k]))t.exactCertifications++;
      else{t.wrongNumbers++;t.falseCertifications++;}
    }
    cases.push(row);
  }
  const results={study:protocol.study,lock,answerable:cases.filter(c=>c.expected).length,unsafe:cases.filter(c=>!c.expected).length,
    total,cases,accepted:total.ontology.exactCertifications>total.fixed.exactCertifications && total.ontology.falseCertifications===0};
  if(process.argv.includes('--publish')){
    try{assert.deepEqual(await read(output),results,'Preserve the published result. Register a new study for changed methods.');}
    catch(e){if(e.code!=='ENOENT')throw e;await writeFile(output,JSON.stringify(results,null,2)+'\n',{flag:'wx'});}
  }
  console.log(JSON.stringify({study:results.study,answerable:results.answerable,unsafe:results.unsafe,total,accepted:results.accepted},null,2));
}else throw Error('Use --file feed.json, --register, or --run [--publish].');
