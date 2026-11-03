// Prespecified durability sensitivity: same selected policy, no campaigns after
// day99, ordinary shopping continues through day199 plus14 refund days.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ROOT,BASE,POLICIES,scheduleModel,matureMerchantRisk,save} from './aggressive-policy.mjs';
import {frozenInputs} from '../research-lab/data.mjs';
import {createFreshWorld} from '../policy-lab/fresh-world.mjs';
import {pairedEstimate} from '../policy-lab/benchmark-stats.mjs';
const read=async f=>JSON.parse(await readFile(resolve(BASE,f),'utf8'));
const evaluation=await read('evaluation.json'),summary=await read('summary.json'),protocol=await read('protocol.json'),{catalog}=await frozenInputs(),selected=POLICIES.find(p=>p.id===evaluation.selectedPolicy);
await save('followup-protocol.json',{parentProtocolHash:protocol.hash,policy:selected,shoppingDays:200,campaignStopsAt:100,returnTailDays:14,seeds:protocol.evaluationSeeds,scenarios:protocol.scenarios,selection:'No policy change or selection from extended outcomes. Same evaluation seeds, sensitivity analysis rather than new independent confirmation.',modelCalls:0});
function run(seed,scenario,policy){
 const r=createFreshWorld({id:`AGGRESSIVE-${seed}-${scenario}-${policy.id}`,seed,scenario,catalog,startedAt:'2026-10-26T01:00:00.000Z',settings:{customerCount:100,days:200,budgetCents:5000}}),model=scheduleModel(policy);
 while(r.world.tick<214){const day=r.world.tick;
  if(day>=30&&day<100&&policy.id!=='organic'){
   const risk=matureMerchantRisk(r),active=!policy.weekdays||policy.weekdays.includes(day%7),indices=risk.filter(m=>!policy.risk||!m.excluded).map(m=>m.index);
   r.publish({id:policy.id,strategy:active?'recommendations':'observe',audience:'all',merchantIndices:active?indices:[],maxOfferPct:0,duration:1,penalty:0,epsilon:0},model,day);
  }
  r.step();
 }
 if(r.actions.some(a=>a.day>=100&&a.selected_action!=='none'))throw Error('UNAUTHORIZED_EXTENDED_OUTREACH');
 const expected=evaluation.rows.find(x=>x.seed===seed&&x.scenario===scenario&&x.policy===policy.id),prefix=r.actions.filter(a=>a.day>=30&&a.day<100);
 if(prefix.reduce((n,a)=>n+a.reward_cents,0)!==expected.platformProxyCents||prefix.filter(a=>a.order_id).length!==expected.purchases)throw Error('FIRST_100_DAY_PARITY_FAILED');
 const result=r.result(policy.id);if(Object.values(result.checks).some(v=>v!==0))throw Error('EXTENDED_ACCOUNTING_FAILED');return result;
}
const rows=[];
for(const seed of protocol.evaluationSeeds)for(const scenario of protocol.scenarios){
 const path=`followup/${seed}-${scenario}.json`;let row;
 try{row=await read(path);}catch(e){if(e.code!=='ENOENT')throw e;const c=run(seed,scenario,POLICIES[0]),t=run(seed,scenario,selected);row={seed,scenario,deltaUSD:(t.platformProxyCents-c.platformProxyCents)/100-summary.financialBridge.allocatedModelUSD,merchantDeltaUSD:(t.merchantContributionCents-c.merchantContributionCents)/100,volumeDeltaUSD:(t.retainedCents-c.retainedCents)/100,purchaseDelta:t.purchases-c.purchases};await save(path,row);}
 rows.push(row);console.log(JSON.stringify({completed:rows.length,total:80}));
}
const result={parentProtocolHash:protocol.hash,scope:'DURABILITY_SENSITIVITY_SAME_SEEDS',campaignStopsAt:100,shoppingDays:200,first100DayParity:true,noExtendedOutreach:true,rows,platform:pairedEstimate(rows,'deltaUSD'),merchant:pairedEstimate(rows,'merchantDeltaUSD'),volume:pairedEstimate(rows,'volumeDeltaUSD'),modelCalls:0};await save('followup.json',result);console.log(JSON.stringify({platform:result.platform,merchant:result.merchant,volume:result.volume}));
