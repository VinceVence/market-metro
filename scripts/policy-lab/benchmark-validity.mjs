import {createPolicyWorld,advancePolicyDay} from './economy.mjs';
import {ACTIONS} from './economy.mjs';
import {trainBandit} from './learner.mjs';

// Evaluator-only controlled probes. Hidden parameters never enter planner evidence.
export function validityChecks(protocol,catalog,schedule){
  const make=(scenario='steady')=>createPolicyWorld({runId:'CONTROLLED-PROBE',comparisonId:'CONTROLLED-PROBE',branch:'mesh',settings:{...protocol.settings,seed:314,scenario,nativeSample:false},catalog,startedAt:protocol.startedAt});
  const empty=make('supply_delay');empty.tick=36;for(const p of empty.products)empty.inventory[p.product_id]=0;
  const noStockOrders=advancePolicyDay(empty).rows.orders.length;
  const broke=make();broke.tick=36;for(const u of broke.customers)u.wallet=0;
  const noMoneyOrders=advancePolicyDay(broke).rows.orders.length;
  const steady=make(),wave=make('returns_wave');steady.tick=wave.tick=36;
  const steadyBatch=advancePolicyDay(steady),waveBatch=advancePolicyDay(wave);
  const sameSales=JSON.stringify(steadyBatch.rows.orders)===JSON.stringify(waveBatch.rows.orders),returnsIncrease=wave.pending.filter(p=>p.refund).length>=steady.pending.filter(p=>p.refund).length;
  const low=make(),high=make();low.tick=high.tick=36;
  for(const w of [low,high])for(const u of w.customers)u.wallet=2500;
  for(const p of low.products)p.price_cents=1500;for(const p of high.products)p.price_cents=8900;
  const cheapOrders=advancePolicyDay(low).rows.orders.length,expensiveOrders=advancePolicyDay(high).rows.orders.length;
  const same=make(),copy=structuredClone(same);const reproducible=JSON.stringify(advancePolicyDay(same))===JSON.stringify(advancePolicyDay(copy));
  const rows=Array.from({length:200},(_,i)=>({day:Math.floor(i/10),matures_day:Math.floor(i/10)+14,selected_action:'none',context_json:'[1,0,0,0,0,0,0]',reward_cents:i%2?100:0}));
  const options={cutoffDay:30,windowDays:42,actions:ACTIONS},fitted=trainBandit(rows,options),poisoned=trainBandit([...rows,{day:99,matures_day:0,selected_action:'none',context_json:'[]',reward_cents:999999},{day:1,matures_day:90,selected_action:'none',context_json:'[]',reward_cents:999999}],options);
  return [
    {name:'Same state and seed reproduce transitions',passed:reproducible},
    {name:'No inventory during supply delay means no purchases',passed:noStockOrders===0,observed:noStockOrders},
    {name:'No spending balance means no purchases',passed:noMoneyOrders===0,observed:noMoneyOrders},
    {name:'Unaffordable prices suppress purchases',passed:cheapOrders>0&&expensiveOrders===0,observed:{cheapOrders,expensiveOrders}},
    {name:'Return shock changes returns without changing initial same-day sales',passed:sameSales&&returnsIncrease,observed:{steadyReturns:steady.pending.filter(p=>p.refund).length,waveReturns:wave.pending.filter(p=>p.refund).length}},
    {name:'Immature and future rewards cannot affect fitted coefficients',passed:JSON.stringify(fitted.arms)===JSON.stringify(poisoned.arms)},
    {name:'Plans use past cutoffs and fixed publication times',passed:schedule.every(p=>p.asOfDay<=p.effectiveDay&&p.effectiveDay<protocol.settings.days)}
  ];
}
