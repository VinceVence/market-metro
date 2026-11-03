// Presentation-only joins, checked against historical frames. No simulation changes.
export function enrichDemo(store,d){
 const total=d.frames.length-1,branches=[];
 for(const s of d.summaries){const w=store.state(s.runId),changes=Array(total).fill(0),dayOf=stamp=>Math.floor((Date.parse(stamp)-Date.parse(w.startedAt))/86400000);
  const rs=store.db.prepare('SELECT o.order_id,o.event_ts,o.total_cents,t.fee_cents,r.event_ts refund_at FROM orders o JOIN transactions t USING(order_id) LEFT JOIN refunds r USING(order_id) WHERE o.run_id=?').all(s.runId);
  for(const o of rs){const day=dayOf(o.event_ts);if(day<30)continue;changes[day]+=o.fee_cents-Math.round(o.total_cents*.012)-20;if(o.refund_at)changes[dayOf(o.refund_at)]-=o.fee_cents;}
  for(const a of store.db.prepare('SELECT day,SUM(outreach_cents+platform_support_cents) amount FROM behavior_actions WHERE run_id=? AND day>=30 GROUP BY day').all(s.runId))changes[a.day]-=a.amount;
  const cumulative=[0];for(const x of changes)cumulative.push(cumulative.at(-1)+x);
  branches.push({label:s.label,cumulative,lifecycle:w.behavior.daily,activeCustomerDays:w.behavior.daily.filter(x=>x.day>=30&&x.day<230).reduce((n,x)=>n+x.ACTIVE,0),dormancyEpisodes:w.behavior.transitions.filter(x=>x.day>=30&&x.day<230&&x.next_state==='DORMANT').length});
 }
 const main=branches.find(b=>b.label==='agent'),control=branches.find(b=>b.label==='none');
 for(const f of d.frames){if(main.cumulative[f.tick]!==f.behavior.outcome.platformCents)throw Error('HISTORICAL_FINANCIAL_FRAME_MISMATCH');
  // Visual destinations come from observed actions; never change policy inputs.
  for(const u of f.customers){const a=[...f.activities].reverse().find(a=>a.customerId===u.id&&a.merchantId);if(a){u.lastMerchant=a.merchantId;if(a.type==='visit'&&u.lastAction==='home')u.lastAction='browse';}}
 }
 d.comparisons=Array.from({length:total+1},(_,tick)=>({tick,branches:branches.map(b=>({label:b.label,platformCents:b.cumulative[tick],deltaUSD:(b.cumulative[tick]-control.cumulative[tick])/100-(b.label==='agent'&&tick>30?d.providerApproval.costMicros/1e6:0),lifecycle:b.lifecycle[Math.max(0,tick-1)]}))}));
 d.lifecycleAudit={scope:'Post-hoc explanation for this one demo seed, not a preregistered population claim.',activeCustomerDaysDelta:main.activeCustomerDays-control.activeCustomerDays,dormancyEpisodesDelta:main.dormancyEpisodes-control.dormancyEpisodes,branches:branches.map(({cumulative,lifecycle,...b})=>b)};
 d.presentationVersion=1;return d;
}
