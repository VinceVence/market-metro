import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createMarketStore} from '../scripts/market-store.mjs';
import {createAutonomyRoom} from '../scripts/commerce-growth/autonomy/live.mjs';
import {savedPlanningEvidence} from '../scripts/ontology/saved-policy.mjs';

test('a judge can run a new seed, resolve its mapping and settle with zero provider or payment calls',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'judge-exploration-')),store=createMarketStore();
  let paid=0,native=0;
  const room=createAutonomyRoom({store,market:{mirror:async()=>{native++;throw Error('Unexpected native payment');}},
    providerFactory:async()=>{paid++;throw Error('Unexpected provider call');},
    v2ControllerFactory:async()=>{throw Error('Saved execution must use its own controller');},rootDir:dir,autoPump:false});
  const input={requestId:'judge-free-new-seed',seed:92111707,regime:'reactivation',marketProfile:'expanded-12x600',
    harnessVersion:'v2',plannerMode:'single',modelCheck:true,merchantMapping:'two-links',execution:'saved',sandbox:false};
  try{
    const start=await room.start(input);assert.equal(start.settings.execution,'saved');assert.equal(start.ontology.counts.checkouts,0);
    assert.equal((await room.start(input)).id,start.id);
    await assert.rejects(()=>room.start({...input,execution:'fresh'}),/another run/);
    for(let day=0;day<31;day++)await room.step(start.id);
    const held=room.snapshot(start.id);
    assert.equal(held.status,'AWAITING_MAPPING');assert.equal(held.day,30);
    assert.equal(held.ontology.mapping.decision,'HOLD');assert.equal(held.ontology.mapping.metrics,null);
    assert.equal(held.ontology.counts.contacts,0);assert.equal(held.modelCalls,0);
    room.correctMapping(start.id,{holdId:held.feedHold.holdId,column:'basket_id'});
    await room.step(start.id);
    const resumed=room.snapshot(start.id);
    assert.equal(resumed.day,31);assert.equal(resumed.ontology.mapping.decision,'CERTIFY');
    assert.equal(resumed.ontology.mapping.metrics.purchases,resumed.ontology.counts.checkouts);
    assert.ok(resumed.ontology.counts.contacts>0);assert.equal(resumed.ontology.counts.trainedModels,0);
    assert.ok(resumed.steps.some(s=>s.actor==='SAVED_POLICY'));
    assert.equal(resumed.latestCampaign.contactsPerDay,36);
    assert.equal(room.snapshot(start.id,15).ontology.mapping.decision,'HOLD','Later corrections must not appear in earlier history');
    const old=room.snapshot(start.id,15);assert.ok(old.ontology.counts.checkouts<resumed.ontology.counts.checkouts);
    assert.equal(old.ontology.counts.contacts,0);assert.equal(old.ontology.counts.matureContacts,0);
    for(let day=31;day<126;day++)await room.step(start.id);
    const finished=room.snapshot(start.id);
    assert.equal(finished.status,'COMPLETED',finished.warning);
    assert.equal(finished.day,126);assert.equal(finished.comparison.team.unpaidLiabilities,0);
    assert.equal(finished.modelCalls,0);assert.equal(finished.costMicros,0);assert.equal(paid,0);assert.equal(native,0);
    assert.ok(finished.comparison.team.retainedPurchases>0);
    assert.equal(finished.ontology.counts.merchantOrders,store.table('orders',finished.runId,{limit:1}).count);
    const reference=await savedPlanningEvidence();assert.equal(reference.contractHash,finished.ontology.reference.contractHash);
    assert.equal(reference.checkpoints.filter(c=>c.actor==='GEMINI').length,6);
    console.log('Completed free judge run',finished.id,'retained',finished.comparison.team.retainedPurchases,'PayPal',finished.comparison.team.platformUSD);
  }finally{await room.close();store.close();await rm(dir,{recursive:true,force:true});}
});
