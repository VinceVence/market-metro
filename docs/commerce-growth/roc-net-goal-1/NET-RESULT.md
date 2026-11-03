# A campaign revision measured on PayPal net

One fresh Gemini 3.1 Pro planning call chose a broader consented-needs campaign and complete funded-basket fulfillment. Its exact plan was frozen before **14 unseen markets**, two seeds for each of the seven authored scenarios. No economy parameters, buyer funds, response probabilities, payment rules or baseline policies changed.

## Measured outcomes

Means per 100-shopper market after 100 market days and 26 clearing days:

| Approach | PayPal net after AI | Retailer contribution | Retained purchases | Retained payment volume | Closing partner cash |
|---|---:|---:|---:|---:|---:|
| Strong fixed rules | $735.41 | $8486.17 | 131.71 | $19289.21 | $27716.06 |
| Existing learned workflow | $740.51 | $8541.22 | 132.43 | $19368.36 | $27773.60 |
| Gemini’s revised workflow | $751.65 | $8823.19 | 137.36 | $19988.43 | $28241.84 |

The revised plan changed modeled PayPal net by **+$16.24 (2.21%) versus fixed**, and **+$11.14 versus the existing learned workflow**. The paired-market bootstrap 95% interval versus fixed is [+$1.37, +$33.17]; versus the learned workflow it is [−$3.04, +$28.09]. These intervals describe this authored test cohort, not production ROI.

Retailer contribution changed +$337.01 and closing partner cash +$525.78 versus fixed. Closing inventory was 0.9812× fixed, within the predeclared 1.10× limit. All arms ended with zero unpaid liabilities: true. Aggregate financial checks passed: true. No metric was substituted for a failed one.

The two independent seed-panel net changes versus fixed were +$28.50 and +$3.98. Mean per-merchant contribution changes versus fixed were MERCHANT-0 +$3.39, MERCHANT-1 +$285.60, MERCHANT-2 +$48.02. Individual market losses remain in [the full results](net-revision-confirmation-1/results.json).

## What the LLM actually changed

The old learned workflow discarded shoppers without a product-interest signal in the past seven days, even for general needs inquiries. Gemini requested an additional legal campaign action: permit inquiries for currently consenting shoppers when locally estimated payment and retailer values are positive. Product recommendations still require observed product interest. Contact gaps, the ten-per-day limit and the existing budget remain enforced.

Gemini also chose the existing complete-basket planner and rejected speculative interest-stock accumulation after the development trial raised fees while reducing partner cash. The trusted executor plans already-authorized baskets, acceptable substitutions, stock arrivals and merchant cash. Neither action changes the buyer's needs or spending money.

Actual model rationale: “The funded_baskets_interest fulfillment increased platform and retailer contribution but drained partner cash due to speculative interest-stock blending. By switching to funded_baskets, we plan complete authorized baskets using existing/incoming stock and shared cash before historical-demand buffer stock, protecting terminal cash. Using the consented_positive_value audience expands outreach to positive-expected-value inquiries, avoiding the failed pause policy. The existing model is retained as it outperformed the expert model in global campaign profit.”

The LLM authored the combination. Existing local models rank individual shoppers and update from matured outcomes. Numerical tools execute stock allocation and payment operations. This run made **one fresh application-model call**, costing **$0.025186**, and no native payment calls. Local model training in the earlier studies is reused here; no new training is falsely attributed to this revision.

## Remove one decision

| Policy output removed | Full workflow's net advantage after allocated design cost |
|---|---:|
| Broader consented inquiries | +$11.53 |
| Complete-basket fulfillment | −$1.48 |

Positive means the full workflow earned more than the corresponding ablation. A negative component result is retained and should inform the next revision. It does not erase the chosen plan's full-market result or establish a new independently confirmed best policy. These are policy-output ablations, not evidence that multiple LLM personas outperform one equally equipped planner.

## PayPal accounting

Mean changes versus fixed: retailFees +$27.48; supplierFees +$15.88; processing −$15.10; outreach −$11.71; refunds −$0.30; other +$0.00; allocated AI −$0.00. Every row's platform-ledger inflows and outflows reconcile to its settled platform net. Refunds, processing and outreach are costs, not additional purchases. Supplier-payment income is checked alongside retailer outcomes, partner cash and inventory to expose fee gains driven by unnecessary stock.

## A customer trace

In seed 998610, BUYER-0096 received a general needs inquiry on day 37, despite lacking recent product interest. The pre-action forecast was $0.06 expected net. The shopper revealed an existing stationery/furniture need, authorized $207.95 of existing simulated funds, and paid $193.00 for a complete basket. Delivery arrived on day 38, before deadline 44. The fixed policy never captured that request.

The order contributed $4.66 directly after retail processing and contact cost. This is a post-hoc example; displaced purchases and supplier effects are measured across the whole market. [Forecast, authorization, capture and delivery](net-revision-confirmation-1/customer-example.json) are modeled events, not a native PayPal receipt.

## Reproducibility and limits

- [Actual Gemini input, decision and token usage](net-revision-decision.json).
- [Protocol fixed before confirmation](net-revision-confirmation-1/protocol.json), [all rows](net-revision-confirmation-1/rows.json), and [results including losses](net-revision-confirmation-1/results.json).
- Original 12 economy file hashes verified before and after execution. Fresh-case opening, opportunity, consent and income hashes match every comparator. Predictor inputs contain no hidden seed, regime, latent needs, future outcomes or household wallet.
- Consent/budget/no-interest inquiry check passed. Existing controller parity and money-integrity checks passed. No APAC operations; no subagents.
- Recorded project Vertex token-price estimate is $4.017384; unsettled entries: 0. This is a usage estimate, not a cloud billing invoice. User ceiling remains $50; tighter existing application caps remain intact.
- Higher ROC had already been shown for the experimental ensemble. It was not selected for this economic revision. Model discrimination, profitable policy choices and multi-agent necessity remain separate claims.
- The simulator uses authored response assumptions. This result supports this campaign in this frozen environment; it does not establish production PayPal profit or universal merchant improvement.

![Paired outcomes and payment accounting](net-revision-confirmation-1/net-contribution.png)
