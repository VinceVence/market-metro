// Read-only completion audit. No provider calls, payments or new test markets.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {hash} from './evaluate.mjs';
const read=async path=>JSON.parse(await readFile(path,'utf8'));
const dir='docs/commerce-design-v2/trial-1',p=await read(dir+'/protocol.json'),r=await read(dir+'/results.json'),opened=await read(dir+'/test-opened.json'),publicReport=await read('demo/data/commerce-design-v2.json'),replay=await read('demo/data/commerce-design-replay.json');
const {hash:expected,...body}=p;assert.equal(hash(body),expected);assert.equal(r.protocolHash,p.hash);
for(const [path,expected] of Object.entries(p.hashes))assert.equal(hash(await readFile(path,'utf8')),expected,path);
assert.equal(r.cases.length,12);assert.equal(r.providerCalls,18);assert.equal(r.modelCostUSD<2,true);
const dev=new Set(p.blocks.flatMap(b=>b.development.map(c=>c.seed))),validation=new Set(p.blocks.flatMap(b=>b.validation.map(c=>c.seed)));
for(const c of r.cases){assert.equal(dev.has(c.seed)||validation.has(c.seed),false);assert.equal(new Set(Object.values(c.arms).map(a=>a.initialHash)).size,1);for(const a of Object.values(c.arms))assert.equal(a.integrity,true);}
for(const d of Object.values(r.designs)){assert.equal(d.status,'COMPLETED');assert.ok(Date.parse(d.finishedAt)<=Date.parse(opened.at));assert.equal(d.candidates.length,5);if(d.arm!=='numerical'){assert.equal(d.checkpoints.length,3);for(const cp of d.checkpoints){assert.equal(cp.status,'COMPLETED');assert.equal(cp.provider.status,'settled');assert.match(cp.provider.configuredModel,/gemini-3.1-pro/);assert.equal(cp.input.observations.length,2);}}}
const ledger=await read('.local/gcp/model-spend.json'),entries=ledger.entries.filter(e=>e.runId.startsWith('market-DESIGN-'+p.id+'-'));
assert.equal(entries.length,18);assert.equal(entries.every(e=>e.status==='settled'),true);const actualCost=entries.reduce((n,e)=>n+e.chargedMicros,0)/1e6;assert.ok(Math.abs(actualCost-r.modelCostUSD)<1e-10);assert.equal(ledger.entries.some(e=>e.status!=='settled'),false);assert.ok(ledger.entries.reduce((n,e)=>n+e.chargedMicros,0)<ledger.lifetimeCapMicros);
for(const [arm,metrics] of Object.entries(r.arms))for(const key of ['platformNetUSD','merchantUSD','recommendationPurchases'])assert.equal(metrics[key],publicReport.arms[arm][key]);
const db=new DatabaseSync('.local/market-metro.sqlite',{readOnly:true});
const saved=db.prepare('SELECT state_json FROM run_state WHERE run_id=?').get(replay.runId),w=JSON.parse(saved.state_json);
assert.equal(w.seed,r.cases[0].seed);assert.equal(w.tick,114);assert.equal(db.prepare('SELECT COUNT(*) n FROM commerce_room_frames WHERE run_id=?').get(replay.runId).n,115);assert.equal(db.prepare('SELECT COUNT(*) n FROM recommendation_models WHERE run_id=?').get(replay.runId).n,5);
assert.equal(db.prepare('SELECT COUNT(*) n FROM paypal_receipts WHERE run_id=?').get(replay.runId).n,0);
const exact=db.prepare("SELECT COUNT(*) n FROM orders WHERE run_id=? AND channel='behavior_recommendation' AND event_date>=date(?, '+30 days')").get(replay.runId,w.startedAt).n;assert.equal(exact,r.cases[0].arms.multi.recommendationPurchases);
const api=await fetch('http://127.0.0.1:4173/api/market/room/'+replay.id+'?day=31').then(r=>r.json());assert.equal(api.day,31);assert.equal(api.steps.filter(s=>s.actor==='GEMINI').length,3);assert.equal(api.campaigns[0].name,r.designs['block-1-multi'].selection.name);
db.close();
const audit={verifiedAt:new Date().toISOString(),passed:true,frozenSourceFiles:Object.keys(p.hashes).length,heldOutMarkets:12,freshProviderCalls:18,providerCostUSD:actualCost,lifetimeRecordedCostUSD:ledger.entries.reduce((n,e)=>n+e.chargedMicros,0)/1e6,unsettledEntries:0,simulatorUnchanged:true,seedSplitsDisjoint:true,allDesignsBeforeHeldout:true,pairedInitialHistoriesIdentical:true,replay:{id:replay.id,seed:w.seed,savedDays:115,localFits:5,exactRecommendationPurchases:exact,paypalCaptures:0},advancementGate:r.advanceGatePassed,scope:'Research, implementation, measurement and replay verified. Advancement gate failed; this does not authorize replacing the live default or claim three-agent superiority.'};
await writeFile('docs/commerce-design-v2/completion-audit.json',JSON.stringify(audit,null,2)+'\n');console.log(JSON.stringify(audit,null,2));
