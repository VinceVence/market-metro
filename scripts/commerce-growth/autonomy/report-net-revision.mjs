import {readFile,writeFile} from 'node:fs/promises';
const root='docs/commerce-growth/roc-net-goal-1',read=async p=>JSON.parse(await readFile(p,'utf8')),r=await read('demo/data/commerce-net-revision.json'),s=r.results,n=r.protocol.cases.length,cost=r.decision.costUSD/n,
 usd=x=>'$'+x.toFixed(2),signed=x=>(x<0?'−':'+')+usd(Math.abs(x)),f=s.differences.revised.fixed,m=s.differences.revised.numerical,
 contribution=arm=>r.rows.filter(x=>x.arm==='revised').reduce((a,x)=>a+x.netAfterModelUSD-r.rows.find(y=>y.arm===arm&&y.case===x.case).platformUSD,0)/n,
 intervals=s.netIntervals,meanFields=Object.keys(r.rows[0].paymentBreakdown),decomposition=Object.fromEntries(meanFields.map(k=>[k,r.rows.filter(x=>x.arm==='revised').reduce((a,x)=>a+x.paymentBreakdown[k]-r.rows.find(y=>y.arm==='fixed'&&y.case===x.case).paymentBreakdown[k],0)/n]));
const text=`# A campaign revision measured on PayPal net

One fresh Gemini 3.1 Pro planning call chose a broader consented-needs campaign and complete funded-basket fulfillment. Its exact plan was frozen before **14 unseen markets**, two seeds for each of the seven authored scenarios. No economy parameters, buyer funds, response probabilities, payment rules or baseline policies changed.

## Measured outcomes

Means per 100-shopper market after 100 market days and 26 clearing days:

| Approach | PayPal net after AI | Retailer contribution | Retained purchases | Retained payment volume | Closing partner cash |
|---|---:|---:|---:|---:|---:|
${['fixed','numerical','revised'].map(a=>{const x=s.summary[a];return '| '+r.labels[a]+' | '+usd(x.platformUSD-(a==='revised'?cost:0))+' | '+usd(x.retailerUSD)+' | '+x.retainedPurchases.toFixed(2)+' | '+usd(x.retainedVolumeUSD)+' | '+usd(x.terminalCashUSD)+' |';}).join('\n')}

The revised plan changed modeled PayPal net by **${signed(f.meanNetUSD-cost)} (${((f.meanNetUSD-cost)/s.summary.fixed.platformUSD*100).toFixed(2)}%) versus fixed**, and **${signed(m.meanNetUSD-cost)} versus the existing learned workflow**. The paired-market bootstrap 95% interval versus fixed is [${signed(intervals.fixed.low)}, ${signed(intervals.fixed.high)}]; versus the learned workflow it is [${signed(intervals.numerical.low)}, ${signed(intervals.numerical.high)}]. These intervals describe this authored test cohort, not production ROI.

Retailer contribution changed ${signed(f.meanRetailerUSD)} and closing partner cash ${signed(f.meanCashUSD)} versus fixed. Closing inventory was ${f.inventoryRatio.toFixed(4)}× fixed, within the predeclared 1.10× limit. All arms ended with zero unpaid liabilities: ${!s.unpaidLiabilities}. Aggregate financial checks passed: ${s.eligibleForConfirmation}. No metric was substituted for a failed one.

The two independent seed-panel net changes versus fixed were ${s.panels.map(p=>signed(p.differences.fixed.meanNetUSD-cost)).join(' and ')}. Mean per-merchant contribution changes versus fixed were ${Object.entries(f.merchantDeltas).map(([id,x])=>id+' '+signed(x)).join(', ')}. Individual market losses remain in [the full results](net-revision-confirmation-1/results.json).

## What the LLM actually changed

The old learned workflow discarded shoppers without a product-interest signal in the past seven days, even for general needs inquiries. Gemini requested an additional legal campaign action: permit inquiries for currently consenting shoppers when locally estimated payment and retailer values are positive. Product recommendations still require observed product interest. Contact gaps, the ten-per-day limit and the existing budget remain enforced.

Gemini also chose the existing complete-basket planner and rejected speculative interest-stock accumulation after the development trial raised fees while reducing partner cash. The trusted executor plans already-authorized baskets, acceptable substitutions, stock arrivals and merchant cash. Neither action changes the buyer's needs or spending money.

Actual model rationale: “${r.decision.output.rationale}”

The LLM authored the combination. Existing local models rank individual shoppers and update from matured outcomes. Numerical tools execute stock allocation and payment operations. This run made **one fresh application-model call**, costing **$${r.decision.costUSD.toFixed(6)}**, and no native payment calls. Local model training in the earlier studies is reused here; no new training is falsely attributed to this revision.

## Remove one decision

| Policy output removed | Full workflow's net advantage after allocated design cost |
|---|---:|
| Broader consented inquiries | ${signed(contribution('without_outreach'))} |
| Complete-basket fulfillment | ${signed(contribution('without_fulfillment'))} |

Positive means the full workflow earned more than the corresponding ablation. A negative component result is retained and should inform the next revision. It does not erase the chosen plan's full-market result or establish a new independently confirmed best policy. These are policy-output ablations, not evidence that multiple LLM personas outperform one equally equipped planner.

## PayPal accounting

Mean changes versus fixed: ${Object.entries(decomposition).map(([k,v])=>k+' '+signed(v)).join('; ')}; allocated AI ${signed(-cost)}. Every row's platform-ledger inflows and outflows reconcile to its settled platform net. Refunds, processing and outreach are costs, not additional purchases. Supplier-payment income is checked alongside retailer outcomes, partner cash and inventory to expose fee gains driven by unnecessary stock.

## A customer trace

In seed ${r.example.market.seed}, ${r.example.contact.customerId} received a general needs inquiry on day ${r.example.contact.day}, despite lacking recent product interest. The pre-action forecast was ${usd(r.example.forecast.expectedNetCents/100)} expected net. The shopper revealed an existing stationery/furniture need, authorized ${usd(r.example.request.authorizedCents/100)} of existing simulated funds, and paid ${usd(r.example.order.grossCents/100)} for a complete basket. Delivery arrived on day ${r.example.delivery.day}, before deadline ${r.example.request.deadlineDay}. The fixed policy never captured that request.

The order contributed ${usd((r.example.order.feeCents-r.example.order.processingCents-r.example.contact.costCents)/100)} directly after retail processing and contact cost. This is a post-hoc example; displaced purchases and supplier effects are measured across the whole market. [Forecast, authorization, capture and delivery](net-revision-confirmation-1/customer-example.json) are modeled events, not a native PayPal receipt.

## Reproducibility and limits

- [Actual Gemini input, decision and token usage](net-revision-decision.json).
- [Protocol fixed before confirmation](net-revision-confirmation-1/protocol.json), [all rows](net-revision-confirmation-1/rows.json), and [results including losses](net-revision-confirmation-1/results.json).
- Original 12 economy file hashes verified before and after execution. Fresh-case opening, opportunity, consent and income hashes match every comparator. Predictor inputs contain no hidden seed, regime, latent needs, future outcomes or household wallet.
- Consent/budget/no-interest inquiry check passed. Existing controller parity and money-integrity checks passed. No APAC operations; no subagents.
- Recorded project Vertex token-price estimate is $${r.spend.lifetimeRecordedUSD.toFixed(6)}; unsettled entries: ${r.spend.unsettled}. This is a usage estimate, not a cloud billing invoice. User ceiling remains $50; tighter existing application caps remain intact.
- Higher ROC had already been shown for the experimental ensemble. It was not selected for this economic revision. Model discrimination, profitable policy choices and multi-agent necessity remain separate claims.
- The simulator uses authored response assumptions. This result supports this campaign in this frozen environment; it does not establish production PayPal profit or universal merchant improvement.

![Paired outcomes and payment accounting](net-revision-confirmation-1/net-contribution.png)
`;
await writeFile(root+'/NET-RESULT.md',text);
const progress=await read(root+'/progress.json');Object.assign(progress,{goalStatus:'cleared_by_user',goalAchieved:false,activeStudy:null,next:null,currentWork:{stage:'bounded_net_revision_complete',report:'NET-RESULT.md',economyUnchanged:true,measuredNetVsFixedUSD:f.meanNetUSD-cost,measuredNetVsNumericalUSD:m.meanNetUSD-cost,financialChecksPassed:s.eligibleForConfirmation,multiAgentSuperiorityProven:false},spend:{lifetimeRecordedUSD:r.spend.lifetimeRecordedUSD,unsettled:r.spend.unsettled,overallUserCapUSD:50}});await writeFile(root+'/progress.json',JSON.stringify(progress,null,2)+'\n');
console.log(JSON.stringify({report:root+'/NET-RESULT.md',netVsFixed:f.meanNetUSD-cost,netVsNumerical:m.meanNetUSD-cost,components:{outreach:contribution('without_outreach'),fulfillment:contribution('without_fulfillment')}}));
