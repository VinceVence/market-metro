import assert from 'node:assert/strict';
import {mkdir, readFile, rename, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {beginGrowthDay, observeGrowthWorld} from '../environment.mjs';
import {warmGrowthWorld} from '../commerce.mjs';
import {openCommerceHarnessV2} from './controller.mjs';
import {canonicalHash, MODEL_CAP_MICROS} from './contracts.mjs';
import {compileCampaign, read} from './tools.mjs';
import {createTrialTool, verifyEconomy} from './trials.mjs';

if (!process.argv.includes('--run')) throw Error('Pass --run to execute the registered, capped Gemini reviews.');
const folder='docs/commerce-expanded/model-check/reactivation-fresh';
const protocol=await read(join(folder,'protocol.json'));
const work=join('.local',protocol.id);
const ledgerPath='.local/gcp/model-spend.json';
const {budget}=protocol;
assert.equal(budget.perArmMicros,MODEL_CAP_MICROS);
const protocolHash=canonicalHash(protocol);
const fixed=(await read('docs/commerce-growth/team-1/development/results.json')).selectedFixed;
const prior=await read('docs/commerce-growth/team-1/training/model.json');
const economy=await verifyEconomy();
const sources=[...new Set([...Object.keys(economy.economyHashes),...Object.keys(economy.implementationHashes),
  ...['contracts','inquiry-value','model-check'].map(n=>'scripts/commerce-expanded/harness-v2/'+n+'.mjs'),
  'benchmark/vertex.mjs','scripts/commerce-deadlines/solver.mjs','scripts/commerce-deadlines/allocator.py',
  'docs/commerce-growth/team-1/development/results.json','docs/commerce-growth/team-1/training/model.json'])];
const sha=buf=>createHash('sha256').update(buf).digest('hex');
const priorLock=await optional(join(folder,'decisions.json'));
const fingerprints={};
for(const path of sources){
  fingerprints[path]=sha(execFileSync('git',['show',protocol.baseCommit+':'+path],{maxBuffer:32*1024*1024}));
  if(!priorLock)assert.equal(sha(await readFile(path)),fingerprints[path],path);
}
const sourceHash=canonicalHash(fingerprints);
async function optional(path){try{return await read(path);}catch(e){if(e.code!=='ENOENT')throw e;return null;}}
async function save(path,body){await writeFile(path+'.tmp',JSON.stringify(body,null,2)+'\n');await rename(path+'.tmp',path);}
const total=entries=>entries.reduce((s,e)=>s+e.chargedMicros,0);
const prefix='market-HARNESS-V2-'+protocol.id+'-';
async function spending(){
  const l=await read(ledgerPath);
  assert.equal(l.projectId,'supply-yard-pilot-261021');
  assert.equal(l.lifetimeCapMicros,budget.existingLedgerMicros);
  assert.ok(!l.circuit && l.entries.every(e=>e.status==='settled'),'Unresolved model reservation');
  const entries=l.entries.filter(e=>e.runId.startsWith(prefix));
  const project=total(l.entries),study=total(entries);
  assert.ok(project<=Math.min(budget.externalMaximumUSD*1e6,l.lifetimeCapMicros) && study<=budget.studyMicros);
  return {project,study,entries};
}
await mkdir(work,{recursive:true});
if(priorLock){
  const {lockHash,...decisions}=priorLock;assert.equal(canonicalHash(decisions),lockHash);
  assert.equal(priorLock.protocolHash,protocolHash);assert.equal(priorLock.sourceHash,sourceHash);
  console.log('Registered decisions already locked. No provider calls made.');process.exit(0);
}
const initial=await spending();
assert.ok(initial.project>=budget.startingLedgerMicros);
const trialTool=await createTrialTool({fixed,prior,marketProfile:protocol.economy});
const arms=[];
for(const [index,seed] of protocol.seeds.entries()){
  const w=warmGrowthWorld({seed,regime:protocol.regime});beginGrowthDay(w);
  const view=observeGrowthWorld(w);assert.equal(view.day,protocol.decisionDay);
  const snapshotHash=canonicalHash(view);
  const order=index%2?[...protocol.arms].reverse():protocol.arms;
  const entries=await spending();
  const pairIds=order.map(arm=>protocol.id+'-pair'+(index+1)+'-'+arm);
  const missing=(await Promise.all(pairIds.map(id=>optional(join(work,id,'locked.json'))))).filter(x=>!x).length;
  assert.ok(entries.study+missing*budget.perArmMicros<=budget.studyMicros &&
    entries.project+missing*budget.perArmMicros<=budget.existingLedgerMicros,'Insufficient headroom to complete the next pair');
  for(const [j,arm] of order.entries()){
    const id=pairIds[j],dir=join(work,id),lockPath=join(dir,'locked.json');
    const cached=await optional(lockPath);
    if(cached){assert.equal(cached.protocolHash,protocolHash);assert.equal(cached.snapshotHash,snapshotHash);
      assert.equal(cached.sourceHash,sourceHash);arms.push(cached);continue;}
    const ledgerId='market-HARNESS-V2-'+id,already=entries.entries.some(e=>e.runId===ledgerId);
    let state=await optional(join(dir,'checkpoints.json'));
    if(already || state){
      assert.ok(state && !state.pending && (state.publications.length===1 || state.failed),
        'Partially executed review. Preserved paid checkpoints and refused to replay '+id);
    }else{
      console.log('Starting fresh review',index+1,arm);
      const controller=await openCommerceHarnessV2({id,dir,mode:arm,modelCheck:true,prior,incumbent:fixed.config,
        trialFactory:async()=>trialTool});
      try{await controller.plan(view);}finally{await controller.close();}
      state=await read(join(dir,'checkpoints.json'));
    }
    const ai=state.checkpoints.filter(c=>c.actor==='GEMINI');
    const calls=ai.flatMap(c=>c.provider||[]);
    const settled=await spending(),receipts=settled.entries.filter(e=>e.runId===ledgerId);
    assert.deepEqual(calls.map(c=>c.reservationId).sort(),receipts.map(e=>e.id).sort());
    assert.ok(calls.every(c=>c.trialId===id && ['settled','rejected'].includes(c.status)));
    const paid=total(receipts);
    assert.equal(paid,calls.reduce((s,e)=>s+e.modelCostMicros,0));assert.ok(paid<=budget.perArmMicros);
    const checked=state.schedule.at(-1)??null;
    const comparison=state.checkpoints.find(c=>c.actor==='LOCAL_MODEL_COMPARISON')?.output;
    let original=checked;
    if(comparison?.baselineDecision==='keep')original=null;
    else if(comparison?.status==='switched'){
      const fits=state.checkpoints.filter(c=>c.actor==='LOCAL_TRAINING_TOOL');
      const fit=fits.find(c=>c.output?.modelHash===comparison.anchor.modelHash);
      const model=await read(fit.output.artifactFile);
      const terms=comparison.campaign;
      original=compileCampaign({...terms,contactsPer100:String(terms.contactsPer100),coverDays:String(terms.coverDays)},
        model,fixed.config,checked.context);
      assert.equal(original.hash,comparison.anchor.contractHash);
    }
    for(const contract of [original,checked].filter(Boolean))assert.equal(contract.context.snapshotHash,snapshotHash);
    if(comparison)assert.equal(comparison.selectedContractHash,checked?.hash??'FIXED');
    const models=state.checkpoints.filter(c=>c.actor==='LOCAL_TRAINING_TOOL'&&c.status==='COMPLETED').map(c=>({
      hash:c.output.modelHash,slot:Number(c.output.artifactFile.match(/fit-(\d+)\/model\.json$/)[1]),
      spec:{family:c.input.family,featureView:c.input.featureView,windowDays:c.input.windowDays},ownRows:c.input.ownMatureRows,metrics:c.output.metrics
    }));
    for(const m of models)assert.equal(m.ownRows,0);
    const decisions=ai.map(c=>({role:c.role,tool:c.toolName??null,status:c.status,evidenceId:c.input.evidenceId,
      recommendation:c.output??null,error:c.error,provider:(c.provider??[]).map(e=>({id:e.reservationId,responseId:e.responseId,
        model:e.configuredModel,version:e.modelVersion,status:e.status,micros:e.modelCostMicros}))}));
    const complete=!state.failed && ai.length===6 && ai.every(c=>c.status==='VALIDATED') && Boolean(comparison);
    const result={id,seed,arm,sourceHash,protocolHash,snapshotHash,paidMicros:paid,complete,failed:state.failed,
      models,decisions,comparison:comparison??null,original,checked,
      failures:state.checkpoints.filter(c=>c.status==='FAILED').map(c=>({role:c.role,actor:c.actor,error:c.error}))};
    await save(lockPath,result);arms.push(result);
    console.log('Locked review',index+1,arm,comparison?.status??'fallback','calls',calls.length,'micros',paid);
    if(!calls.length && !complete)throw Error('Provider unavailable. Preserved '+id+' and stopped before further paid work.');
  }
}
assert.equal(arms.length,protocol.seeds.length*2);
const allResponses=arms.flatMap(a=>a.decisions.flatMap(d=>d.provider.filter(p=>p.status==='settled').map(p=>p.responseId)));
assert.ok(allResponses.every(Boolean) && new Set(allResponses).size===allResponses.length,'Missing or reused Gemini responses');
const end=await spending();assert.equal(end.study,arms.reduce((n,a)=>n+a.paidMicros,0));
const lock={protocolHash,sourceHash,economyHash:canonicalHash(economy.economyHashes),arms,
  studyMicros:end.study,projectMicros:end.project};
await save(join(folder,'decisions.json'),{...lock,lockHash:canonicalHash(lock)});
console.log('All choices locked before held-out scoring',canonicalHash(lock));
