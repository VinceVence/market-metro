// Publish the entire registered comparison; no selection of winning seeds.
import {readFile,writeFile} from 'node:fs/promises';
const dir='docs/commerce-growth/autonomy-1/validation-1',load=async p=>JSON.parse(await readFile(p,'utf8')),
 r=await load(dir+'/results.json'),rows=(await load(dir+'/rows.json')).rows,checkpoints={},examples={};
for(const c of r.cases){
 checkpoints[c.id]=(await load(dir+'/'+c.id+'-team/checkpoints.json')).checkpoints;
 const t=await load(dir+'/'+c.id+'-autonomous_team-trajectory.json'),b=await load(dir+'/'+c.id+'-strong_fixed-trajectory.json'),fixedRetained=new Set(b.orders.filter(o=>!o.refundStatus).map(o=>o.requestId));
 const choose=extra=>t.orders.find(o=>o.day>=30&&!o.refundStatus&&(!extra||!fixedRetained.has(o.requestId))&&t.contacts.some(k=>k.requestId===o.requestId));
 const order=choose(true)||choose(false);if(order){const request=t.requests.find(q=>q.id===order.requestId),contact=t.contacts.find(k=>k.requestId===order.requestId),decision=t.decisions.find(d=>d.day===contact.day);examples[c.id]={order,request,contact,delivery:t.deliveries.find(d=>d.orderId===order.id),ranking:decision?.ranking.find(k=>k.customerId===order.customerId),retainedInFixed:fixedRetained.has(order.requestId),source:'SIMULATED_PAYMENT_NOT_NATIVE_RECEIPT'};}
}
const report={...r,checkpoints,examples,rows:rows.map(({agent,...row})=>row)};
await writeFile('demo/data/commerce-autonomy-validation.json',JSON.stringify(report,null,2)+'\n');
const usd=n=>'$'+n.toFixed(2),signed=n=>(n<0?'−':'+')+usd(Math.abs(n)),labels={strong_fixed:'Strong fixed',static_learned_routing:'Static learned routing',autonomous_team:'Fresh autonomous team'},f=r.means.strong_fixed,t=r.means.autonomous_team;
const text=`# Autonomous commerce: seven new markets

The fresh team completed ${r.modelCalls} Gemini decisions, ${r.trainingJobs} real local fits and ${r.publications} campaign publications. Mean modeled platform net after AI cost was **${usd(t.netAfterModelUSD)} vs ${usd(f.netAfterModelUSD)} fixed (${((r.ratio-1)*100).toFixed(2)}%)**. It improved ${r.wins}/7 registered markets. This is measured synthetic commerce, not PayPal production profit.

The user's completion target is autonomous operation plus measured improvement. **2× is a stretch target.** All financial guards, including individual merchant tradeoffs, remain reported.

| Approach | Platform after AI | Retailers | Retained purchases | Payment volume | Exact recommendation purchases |
|---|---:|---:|---:|---:|---:|
${Object.entries(r.means).map(([id,m])=>`| ${labels[id]} | ${usd(m.netAfterModelUSD)} | ${usd(m.retailerUSD)} | ${m.retainedPurchases.toFixed(2)} | ${usd(m.retainedVolumeUSD)} | ${m.recommendationPurchases.toFixed(2)} |`).join('\n')}

Means per market; days31–100 plus a26-day settlement tail after shared warmup. The same initial funds, opportunity stream, consent and income hashes matched in every arm.

## What changed

The market analyst examines observed search, browse, contact and settled-payment evidence. The scientist chooses a model and routing recipe, trains locally, validates its artifact and can retain or retrain it at the next review. The commerce manager chooses the audience, allowed contact types, capacity, value threshold, stock coverage and settlement route. Trusted code validates the bounded action contract and executes it without human intervention.

The new inquiry expert estimates response value from actual public intent age and mature observed outcomes. It avoids treating all inquiries as signal-free cold contacts. The ambiguous-intent recipe keeps product recommendations for explicit searches and allows inquiries for browsing. A random forest scores recommendations; local numerical tools handle complete baskets and fulfillment. These are learned estimators and deterministic execution tools, not extra LLM agents.

Team minus static learned routing is ${signed(r.versusStaticMLUSD)} per market. This control prevents crediting all numerical-model improvements to multiple LLM roles. A matched single-planner ablation was not run, so additional roles are not independently proven necessary. Generated rationales sometimes overstate optimality or compare funded responses with retained purchases across different cohorts; they are preserved as model outputs, not accepted statistical claims.

## PayPal's role and accounting

The trusted payment plane turns a customer request into an authorization, capture and settled delivery or refund. Supplier settlement affects when inventory can arrive. Those payment outcomes become the next scientist's labels. Existing Sandbox integration can mirror one selected retained merchant order using saved test consent; this benchmark deliberately made **zero native calls**. Modeled receipts are never presented as native PayPal receipts.

| Component per market | Fixed | Team |
|---|---:|---:|
| Retail fees after fee refunds and processing | ${usd(f.retailPaymentNetUSD)} | ${usd(t.retailPaymentNetUSD)} |
| Supplier payment fees after processing | ${usd(f.supplierPaymentNetUSD)} | ${usd(t.supplierPaymentNetUSD)} |
| Outreach expense | ${usd(f.outreachCostUSD)} | ${usd(t.outreachCostUSD)} |
| AI expense | $0 | $${(r.spend.costUSD/7).toFixed(6)} |

Platform transfer sums reconcile to the settled balance change. No additional shopper money, unpaid liabilities or hidden evaluator data were introduced. In this test, most of the small platform gain comes from supplier payments and outreach savings; retained retail volume fell. This is not evidence of a strong retail-demand lift.

## All registered cases

| Regime | Seed | Fixed | Team after AI | Difference | Retailer difference |
|---|---:|---:|---:|---:|---:|
${r.cases.map(c=>`| ${c.regime} | ${c.seed} | ${usd(c.fixedUSD)} | ${usd(c.teamUSD)} | ${signed(c.deltaUSD)} | ${signed(c.retailerDeltaUSD)} |`).join('\n')}

Individual merchant mean changes: ${Object.entries(r.merchantDeltas).map(([id,n])=>id+' '+signed(n)).join('; ')}.

Guards: ${Object.entries(r.gates).map(([key,pass])=>key+' '+(pass?'PASS':'FAIL')).join('; ')}.

## Cost, timing and limits

Fresh inference: **$${r.spend.costUSD.toFixed(6)}**, a token-metered estimate from the actual provider usage ledger, not a reconciled cloud invoice. Lifetime recorded cost: $${r.spend.lifetimeUSD.toFixed(6)}. Additional cap$0.25, application lifetime cap$8 and existing isolated-project control were preserved. No APAC operations or development subagents. Local CPU training has no cloud charge; CPU/energy cost is not priced in this total.

${r.timing} Total provider latency: ${(r.providerLatencyMs/1000).toFixed(1)} seconds. The existing live workflow runs the same roles in the background while fixed fallback serves shoppers.

${r.limits.map(l=>'- '+l).join('\n')}

The source hashes and seeds were registered before execution. Every result is retained. These seeds are now spent for any future policy tuning. Earlier negative runs remain unchanged.

![Paired comparison and PayPal contribution](comparison.png)

See [protocol](protocol.json), [results](results.json), [full rows](rows.json) and the per-case team checkpoints. The [interactive workspace](http://127.0.0.1:4173/studio.html?session=AUTONOMY-272a791d4860b5ca&view=performance&evaluation=autonomy-validation) includes the recorded decisions and evidence.
`;
await writeFile(dir+'/REPORT.md',text);console.log(JSON.stringify({published:true,cases:r.cases.length,checkpoints:Object.values(checkpoints).flat().length,examples:Object.keys(examples).length}));
