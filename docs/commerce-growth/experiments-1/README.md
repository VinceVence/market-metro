# Observed-feature programs and complete-basket planning

**Goal active. 2x is not achieved. No new candidate was promoted.** These are development-assistant-authored programs, executed with local numerical tools. They are not fresh application-agent decisions, unseen evaluation, or real PayPal profit.

## Changes

- A bounded typed policy language selects contact rankings, basket scores and per-product stock targets using observed fields. It cannot execute arbitrary code, SQL, network requests or money mutations.
- The new fulfillment tool plans a complete authorized basket before buying missing items. It considers acceptable substitutions, available/incoming stock, deadlines and shared merchant cash. A planned future basket is not a stock reservation or a guaranteed delivery.
- Experiment results are copied and hash-bound to the exact program and fitted response model. Publication rejects changed measurements, changed programs, unmeasured profit claims, nonpositive gains and failed financial guards.
- Checkpoint writes are atomic; errors produce a FAILED checkpoint. Reusing an existing output path is rejected rather than overwriting evidence.
- The financial engine, buyer behavior, catalogue, payment rules, original fixed controller and approved UI stayed unchanged.

## Matched development evidence

Two predeclared variants ran on seven previously used development markets. One subsequent revision blended the two observed stock-target formulas and ran on the same seven development markets. No unseen seeds were opened.

| Controller | Platform net / market | Ratio / fixed | Retailer contribution | Closing partner cash | Closing inventory | Retained purchases | Exact recommendation purchases |
|---|---:|---:|---:|---:|---:|---:|---:|
| Strong fixed | $690.36 | 1.000x | $7,910.75 | $27,074.77 | $3,146.28 | 123.57 | 23.14 |
| Complete baskets | $714.54 | 1.035x | $8,306.23 | $27,623.07 | $3,193.73 | 128.14 | 17.57 |
| Complete baskets + intent stock | $734.00 | 1.063x | $8,315.54 | $27,399.65 | $3,728.54 | 128.57 | 18.14 |
| Measured balanced revision | $722.14 | 1.046x | $8,316.98 | $27,560.16 | $3,383.86 | 128.43 | 17.71 |

Complete-basket planning alone added $1.06 modeled platform contribution per market over the same outreach policy with the previous SKU-based replenishment planner. Most of its gain versus fixed therefore comes from the previously changed outreach/selection policy, not the new basket tool.

The 1.063x variant reduced MERCHANT-2 contribution by $18.26 per market and closed with inventory above the original 110% allowance. The 1.046x balanced revision respected the inventory allowance but reduced MERCHANT-0 contribution by $9.83. It was rejected; aggregate gains do not erase these individual losses. Recommendation-attributed purchases also remained below strong fixed rules.

The balanced revision was a fresh local experiment after observing the first two variants. Its hypothesis came from the development assistant in this chat. It was not chosen by an application Gemini call, and interpolating formulas was not treated as proof that financial outcomes would interpolate. The workflow ended at OBSERVE with no published policy.

## One repeatable customer outcome

In a post-hoc explanatory replay of development seed 980102, BUYER-0007's REQUEST-89-7 expired under the earlier SKU planner. With complete-basket planning, the same request produced a $160 simulated capture on day 91 and delivery on day 92. Across that market, retained purchases went from 112 to 113 and modeled platform contribution from $650.83 to $657.19.

This shows a downstream effect of the changed controller, not a direct LLM action on that customer. The buyer was not the subject of a future-basket planning record. Both replays matched their previously recorded financial results; this is explanatory evidence, not a second independent performance sample. The receipt is local simulated data, not a native PayPal receipt.

## Verification and cost

- Frozen economy hashes and paired initial/opportunity/consent/income hashes checked.
- All 21 development executions ended with zero unpaid liabilities.
- Two selected-case replays reproduced recorded platform, retailer, purchase, cash and inventory totals.
- Six focused program/integration checks passed; the three affected workflow/basket checks passed again after checkpoint hardening.
- New model calls: 0. Native PayPal calls: 0. New model cost: $0. Recorded lifetime token-price estimate: $3.512636, with all ledger entries settled. No APAC operations.
- Existing seven-unseen-seed application-team result remains 1.001x fixed. These development scores do not replace it.

## Artifacts

- [Two-variant protocol and results](bundled-1/results.json)
- [Measured revision](balanced-revision-1/results.json)
- [Checkpointed workflow](balanced-revision-1/workflow.json)
- [Explanatory customer trace](bundled-1/customer-example.json)
- [Research basis: bounded policy programs and measured refinement](../../../research/notes/final_report_commerce-net-headroom-0335d1.md)

The next policy change must preserve merchant contribution while improving demand fulfillment. A larger inventory bill or additional agent role is not sufficient evidence. The 2x objective, original scorecard and historical negative results remain intact.
