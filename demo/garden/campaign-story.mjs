// Presentation only: every statement comes from saved inputs/results, never a new model call.
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((n||0)/100);
const count=n=>Number(n||0).toLocaleString('en-US');
const modelName=n=>n==='logistic'?'logistic regression':n==='tree'?'decision tree':n||'model';
export const STORY_STAGES=['Watch shoppers','Find patterns','Train models','Plan coupons','Watch response','Review market','Verify payment'];
export function marketTrend(output){
  const current=output?.market?.find(m=>m.label==='latest7'),previous=output?.market?.find(m=>m.label==='previous7');
  if(!current?.observations||!previous?.observations)return null;
  const delta=current.purchases-previous.purchases;
  return {current:current.purchases,previous:previous.purchases,label:`Weekly purchases ${delta>0?'rose':delta<0?'fell':'stayed level'} from ${previous.purchases} to ${current.purchases}.`,rival:current.observedRivalPromotionRate>previous.observedRivalPromotionRate};
}
export function campaignStories(data){
  let observed=0;const prior=[],stories=[];
  for(const raw of data.checkpoints||[]){
    const cp={...raw,id:raw.id||raw.checkpoint_id,parameters:raw.parameters||raw.input?.parameters||{},rationale:raw.rationale||raw.input?.rationale||raw.input?.mission||'',evidenceIds:raw.evidenceIds||raw.input?.evidenceIds||[]};
    const p=cp.parameters,o=cp.output||{},a=cp.action,day=cp.known?.day??observed;
    // Only preceding, completed checkpoints can inform this explanation.
    const analysis=[...prior].reverse().find(c=>c.action==='analyze')?.output;
    const fit=[...prior].reverse().find(c=>c.action==='train')?.output;
    const draft=[...prior].reverse().find(c=>c.action==='draft_campaign')?.output;
    const trend=marketTrend(analysis),observedText=day?`${day} completed days of shopper activity were available.`:'Only the mission, product catalog and simulation settings were available.';
    const s={id:cp.id,day,action:a,status:cp.status,stage:0,who:a==='set_goal'?'Operator':cp.actor==='vertex_planner'?'Gemini':cp.actor==='scripted_demo'?'Scripted coordinator':'Chat planner',title:'Review the campaign',knew:[observedText],choice:cp.rationale,result:[],rationale:cp.rationale,evidenceIds:cp.evidenceIds};
    if(a==='set_goal'){s.title='Set the marketing question';s.choice=`Bring shoppers back within a ${money(data.goal?.budgetCents)} virtual coupon budget.`;s.result=['Keep a comparison group without campaign coupons.'];}
    if(a==='prepare_history'){s.title='Collect shopper behavior';s.choice='Let the market trade and save visits, offers and purchases.';s.result=[`${o.completedDays||28} learning days recorded. The demo shows two opening days, then clearly skips ahead.`];}
    if(a==='analyze'){
      s.stage=day>(data.startDay??28)?5:1;s.title=s.stage===5?'Investigate the changed market':'Look for a coupon opportunity';
      if(trend)s.knew.push(trend.label);
      s.choice=`Ask the data worker to inspect the past ${p.windowDays} days: ${(p.cuts||[]).map(v=>({model_health:'prediction quality',offers:'coupon response',market:'market trends',daily:'day-by-day sales',segments:'shopper groups'}[v]||v)).join(', ')}.`;
      const found=marketTrend(o);s.result=[`${count(o.observations)} shopper-day records examined.`,...(found?[found.label]:[]),...(found?.rival?['Rival promotions now appear in the observed data. This does not prove they caused the change.']:[])];
    }
    if(a==='train'){
      s.stage=2;s.title=`Train ${(p.modelTypes||[]).map(modelName).join(' and ')}`;if(trend)s.knew.push(trend.label);
      s.choice=`Use the last ${p.windowDays} observed days to learn who may buy with no coupon, 5% off or 10% off.`;
      s.result=[`${count(o.training_rows)} training records; ${count(o.validation_rows)} later records held out for testing.`,`${modelName(o.model_type)} ${o.status==='PROMOTED'?'passed':'did not pass'}: prediction error ${Number(o.validation_log_loss).toFixed(3)} vs ${Number(o.champion_log_loss??o.baseline_log_loss).toFixed(3)} for the ${o.champion_log_loss==null?'simple baseline':'existing model'}. Lower is better.`];
    }
    if(a==='draft_campaign'){
      s.stage=3;s.title='Turn model scores into a coupon plan';
      s.knew=[observedText,...(fit?[`${modelName(fit.model_type)} ${fit.status==='PROMOTED'?'passed':'did not pass'} its later-day test.`]:[])];
      s.choice=`Consider ${p.offerOptions?.join('% or ')}% coupons at ${p.merchantIds?.length} shops, only when predicted extra contribution reaches ${money(p.minExpectedGainCents)} per shopper.`;
      s.result=[`A ${p.durationDays}-day plan was saved. Each coupon expires on its issue day.`,`The executor still checks stock, margin, contact limits and the ${money(data.goal?.budgetCents)} budget.`];
    }
    if(a==='launch'){s.stage=3;s.title='Send the plan to the coupon worker';s.knew=[`The saved plan uses ${draft?.plan?.offerOptions?.join('% / ')||'bounded'}% offers and has passed the campaign guards.`];s.choice='Activate this plan for eligible simulated shoppers.';s.result=['Each day, local models score shoppers. The worker can issue an offer or choose no coupon.'];}
    if(a==='advance'){s.stage=4;s.title='Let shoppers respond';s.choice=`Run up to ${p.days} more days, then return the new records to the team.`;s.result=[`${o.completedDays} days recorded${o.attention?'; a new market signal stopped the advance early':''}.`,'A coupon is an offer, not a guaranteed purchase.'];}
    if(a==='review'){
      s.stage=5;s.title=p.decision==='continue'?'Keep the current model and coupon plan':'Pause for an operator review';
      if(trend)s.knew.push(trend.label);if(trend?.rival)s.knew.push('New rival-sale exposure was present in the saved analysis.');
      const reasons=cp.known?.offerExecution?.reasons||[];const blocked=reasons.filter(r=>!r.offers).sort((a,b)=>b.decisions-a.decisions)[0];
      if(blocked)s.knew.push(`${count(blocked.decisions)} recent shopper decisions were ${String(blocked.reason).replaceAll('_',' ').toLowerCase()}.`);
      s.choice=p.decision==='continue'?'Keep the existing policy and collect more shopper responses.':'Stop the campaign for review.';
      s.result=p.decision==='continue'?['No retraining or coupon-policy change was requested. The current model stays fixed.']:['The runner waits for operator attention.'];
    }
    if(a==='settle'){s.stage=4;s.title='Wait for deliveries and returns';s.choice='Collect two follow-up days before checking payment candidates.';s.result=['Only eligible redeemed orders can be selected for the sandbox sample.'];}
    if(a==='capture_samples'){s.stage=6;s.title='Link a coupon purchase to PayPal';s.knew=['A redeemed coupon order and its recorded amount were available.'];s.choice=`Ask PayPal Sandbox to capture ${p.orderIds?.length||0} selected order${p.orderIds?.length===1?'':'s'}.`;s.result=['Only verified matching amounts appear as native sandbox receipts. Other sales remain simulated.'];}
    if(a==='evaluate'){s.stage=6;s.title='Measure the campaign';s.choice='Compare outcomes and calculate merchant economics.';s.result=['Report purchases, coupons, costs and the comparison-group result. Redemptions alone do not prove an incremental benefit.'];}
    if(a==='complete'){s.stage=6;s.title='Save the final campaign report';s.choice='Close the workflow with its full audit trail.';s.result=['The campaign can now be replayed without model calls or new payments.'];}
    if(cp.status==='FAILED'){s.title='Guard blocked: '+s.title.toLowerCase();s.result=[cp.error?.message||'The action was rejected before execution.'];}
    if(!['COMPLETED','FAILED'].includes(cp.status))s.result=['The worker has not returned a result yet.'];
    stories.push(s);
    if(cp.status==='COMPLETED'){
      prior.push(cp);
      if(a==='prepare_history')observed=o.completedDays||28;
      if(['advance','settle'].includes(a)&&Number.isInteger(o.throughDay))observed=o.throughDay+1;
    }
  }
  return stories;
}
export function guidedTimeline(items){
  const removed=items.filter(s=>s.kind==='day'&&s.day>=2&&s.day<27);
  if(!removed.length)return items;
  let inserted=false;return items.flatMap(s=>{
    if(s.kind!=='day'||s.day<2||s.day>=27)return [s];
    if(inserted)return [];inserted=true;
    return [{key:'history-time-skip',kind:'history_skip',day:removed.at(-1).day,fromDay:removed[0].day,role:'Data engineer',days:removed.map(s=>s.data)}];
  });
}
export const storyEsc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function storyMarkup(s){
  const esc=storyEsc;
  return `<dl class="decision-story"><div><dt>What it knew</dt><dd>${s.knew.map(esc).join(' ')}</dd></div><div><dt>${esc(s.who)} chose</dt><dd>${esc(s.choice)}</dd></div><div><dt>What happened</dt><dd>${s.result.map(esc).join(' ')}</dd></div></dl>`;
}
