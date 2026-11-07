import test from 'node:test';
import assert from 'node:assert/strict';
import {createMarketStore} from '../scripts/market-store.mjs';
import {createAutonomyRoom} from '../scripts/commerce-growth/autonomy/live.mjs';

test('saved navigation reads frames without loading a world, preserves results and respects replay cutoffs', async () => {
  const store=createMarketStore(),db=store.db;
  const room=createAutonomyRoom({store,autoPump:false,providerFactory:()=>{throw Error('No model calls allowed');}});
  const id='AUTONOMY-navigation',runId='GARDEN-navigation';
  const comparison={fixed:{platformUSD:100,retailerUSD:500,retainedPurchases:30},team:{platformUSD:120,retailerUSD:600,retainedPurchases:40}};
  const checkpoint={day:30,completedDay:30,actor:'TRUSTED_PUBLISHER',role:'Verifier',status:'COMPLETED',input:{overview:{marketScale:{virtualCampaignBudgetCents:240000,dailyContactLimit:480}}},output:{decision:'publish',effectiveDay:30,campaign:{audience:'lapsed',contactsPerDay:6},modelId:'model-1'}};
  const s={id,runId,status:'COMPLETED',seed:42,marketProfile:'metropolis-96',team:{checkpoints:[checkpoint]},comparison};
  const frame={runId,totalTicks:126,customerCount:4800,merchantCount:96,marketVersion:'frozen-test',stats:{orders:40,deliveries:40,revenueCents:9000}};
  try {
    db.prepare('INSERT INTO simulation_runs(run_id) VALUES(?)').run(runId);
    db.prepare('INSERT INTO autonomy_sessions(id,run_id,state_json,status) VALUES(?,?,?,?)').run(id,runId,JSON.stringify({s,worldRef:id}),'COMPLETED');
    // A deliberately unreadable world proves navigation never inflates it.
    db.prepare('INSERT INTO metropolis_states VALUES(?,?)').run(id,Buffer.from('not a world'));
    for (const day of [29,31,126])db.prepare('INSERT INTO autonomy_frames VALUES(?,?,?)').run(runId,day,JSON.stringify({...frame,tick:day}));
    const before=db.prepare('SELECT total_changes() n').get().n;
    const saved=room.snapshot(id,undefined,{details:false});
    assert.deepEqual(saved.comparison,comparison);
    assert.equal(saved.detailsDeferred,true);assert.equal(saved.ontology,null);assert.equal(saved.learning,null);
    assert.equal(saved.settings.customerCount,4800);assert.equal(saved.settings.campaignBudgetUSD,2400);
    assert.equal(saved.campaigns[0].contactsPerDay,288);
    const early=room.snapshot(id,29,{details:false});
    assert.equal(early.comparison,null);assert.equal(early.steps.length,0);assert.equal(early.campaigns.length,0);
    assert.equal(room.snapshot(id,31,{details:false}).campaigns.length,1);
    assert.deepEqual(room.latest({details:false}),saved);
    assert.equal(db.prepare('SELECT total_changes() n').get().n,before,'Reading must not change the economy');
    assert.throws(()=>room.snapshot(id),/header|gzip|compression/i,'Full evidence still requires a genuine world');
  } finally {await room.close();store.close();}
});
