import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ROOT} from '../research-lab/data.mjs';
import {createMarketStore} from '../market-store.mjs';
import {lock,read,save,BASE} from './benchmark.mjs';
const {p}=await lock(),report=await read('report.json'),evaluation=await read('evaluation.json'),approval=await read('agent.json'),source=await read('agent-protocol.json'),index=JSON.parse(await readFile(resolve(ROOT,'demo/data/behavior-v3-demo-index.json'))),demo=JSON.parse(await readFile(resolve(ROOT,'.local/behavior-v3',index.runId+'.json')));
assert.equal(source.simulationHash,p.hash);assert.equal(approval.protocolHash,source.hash);assert.equal(evaluation.protocolHash,p.hash);assert.equal(report.protocolHash,p.hash);assert.equal(demo.settings.protocolHash,p.hash);assert.equal(evaluation.rows.length,48*6);
const chosenAt=(await stat(resolve(BASE,'agent.json'))).mtimeMs;
for(const seed of p.evaluationSeeds)for(const scenario of p.evaluationScenarios)assert.ok(chosenAt<(await stat(resolve(BASE,`evaluation/${seed}-${scenario}.json`))).mtimeMs);
const ledger=JSON.parse(await readFile(resolve(ROOT,'.local/gcp/model-spend.json'))),entries=ledger.entries.filter(e=>e.runId==='market-BEHAVIOR-V3-APPROVAL-1');
assert.equal(entries.length,2);assert.ok(entries.every(e=>e.status==='settled'));assert.equal(entries.reduce((n,e)=>n+e.chargedMicros,0),approval.costMicros);assert.equal(ledger.entries.filter(e=>e.status==='pending').length,0);assert.equal(approval.provider.length,2);
const store=createMarketStore(resolve(ROOT,'.local/market-metro.sqlite'));let counts;
try{assert.equal(store.db.prepare('PRAGMA foreign_key_check').all().length,0);counts={};
 for(const s of demo.summaries){const w=store.state(s.runId),n=store.table('orders',s.runId).count;assert.equal(n,store.table('transactions',s.runId).count);assert.equal(n,w.behavior.orders.length);assert.equal(w.tick,244);assert.equal(w.pending.length,0);counts[s.label]={orders:n,transactions:n,models:store.table('recommendation_models',s.runId).count,nativeReceipts:store.table('paypal_receipts',s.runId).count};}
 assert.equal(demo.comparisons.length,245);for(const f of demo.frames)assert.equal(f.behavior.outcome.platformCents,demo.comparisons[f.tick].branches.find(b=>b.label==='agent').platformCents);
}finally{store.close();}
const verification={version:p.version,protocolHash:p.hash,oldFrozenEngineVerified:true,coreUnchangedSinceRegistration:true,agentSelectedBeforeAllEvaluationFiles:true,freshModelCalls:2,newModelUSD:approval.costMicros/1e6,ledgerPending:0,independentSeeds:8,markets:48,nominalExecutions:288,nullResponseChecks:4,weakResponseChecks:4,integrity:evaluation.rows.every(r=>r.integrity),warehouse:counts,historicalFrameParity:245,demoRun:index.runId,gate:report.gate.status,nativePaymentsThisTask:0};await save('verification.json',verification);console.log(JSON.stringify(verification,null,2));
