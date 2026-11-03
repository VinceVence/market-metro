import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {repairTeamV2} from '../scripts/commerce-growth/autonomy/repair-team-v2.mjs';import {BASE_CANDIDATE} from '../scripts/commerce-growth/autonomy/team-v2.mjs';
test('a reviewer cannot publish a repair that raises platform income by harming merchants',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'team-repair-check-'));let experiments=0;
 const provider={client:{events:[],async json(_system,input,options){this.events.push({status:'TEST_DOUBLE',modelCostMicros:0});const schema=options.functions[0].parameters.properties;return {name:'select_economic_policy',args:{...(schema.repairId?{repairId:schema.repairId.enum[0],hypothesis:'Test-only intervention.'}:{selected:'repair',finding:'Test requests publication despite a failed merchant guard.'}),rationale:'Test double, not an application model result.',evidenceId:input.evidenceId}};}}};
 try{const result=await repairTeamV2({mode:'team',dir:join(temp,'design'),evidence:{baselineDevelopment:{platformUSD:100,retailerUSD:1000,terminalCashUSD:2000},fixedDevelopment:{terminalInventoryUSD:100},baselineDesignCostUSD:0,priorAttemptCosts:{team:0}},provider,trial:async()=>{experiments++;return {platformUSD:110,retailerUSD:999,terminalCashUSD:2000,terminalInventoryUSD:100,unpaidLiabilities:0};}});
  assert.equal(experiments,1);assert.equal(result.state.requested,'repair');assert.equal(result.state.repair.passes,false);assert.deepEqual(result.state.selected,BASE_CANDIDATE);assert.equal(result.state.publication.selected,'baseline');
 }finally{await rm(temp,{recursive:true,force:true});}
});
