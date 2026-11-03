# Planner-led economic workflow

This extends the **locked v1 workflow** with economic observations and bounded operating tools. A planner chooses its next investigation or action; it does not follow a fixed sequence of named agents. The market rules and v1 snapshot remain unchanged.

**Finalized November 3:** [fresh 14-market confirmation](../economic-final-1/README.md) measured $765.47 reviewed-workflow net versus $738.79 fixed (+3.61%). The new planner retained v1 after a historical loss; this is positive confirmation of v1, not additional profit from its new overlay. The sidebar now shows this complete result and all five fresh Gemini decisions. Version4 binds the review brief to the checkpoint and prevents selection of candidates that fail the supplied financial gates.

## What it can investigate and do

| Tool | Available work |
|---|---|
| Inspect economic indicators | Demand growth, outreach response, funded-basket fillability, stockouts, merchant cash, funded replenishment needs, supplier quotes, payment fees/costs and matured refunds. Choose7/14/28-day windows. |
| Fit a demand model | Local rolling Poisson demand rates. Compare7/14/28-day windows with past-only validation; no paid training service. |
| Preview a conditional policy | Compose up to two economic conditions. Change campaign focus, temporarily pause paid outreach, prioritize funded stock, use forecast inventory cover, or change modeled supplier settlement routing. |
| Compare historical outcomes | Run the exact previewed artifact against v1 on a different completed historical market. Never roll out the current target's private future for the planner. |
| Finish | Keep v1 or queue a tested candidate for wider shadow research. Selection is by artifact ID; trusted code retrieves the measured values. No live promotion. |

An intervention lasts **three or seven days**, checks conditions using their cited observation windows, and automatically reverts to v1. Organic shopping and fulfillment continue during an outreach pause.

These are **local, modeled economic indicators** derived from the existing economy. Inflation, interest rates, stock prices and legal changes were not invented or wired into frozen behavior.

## Why PayPal matters

The workflow reads the platform's modeled retail/supplier fee ledger, processing costs, fee returns, outstanding obligations and funded-order queue alongside merchant stock and cash. A marketing plan must turn into funded, fulfillable, retained payments to create value. Extra supplier fees are visible alongside merchant cash/inventory effects; they are not automatically treated as healthy growth.

`fast` means modeled immediate PayPal settlement; physical delivery still takes time. `deadline` uses the existing guarded SKU stock planner and chooses bank settlement when observed deadlines allow. Bank settlement adds the existing delay at each stage. This mode also changes replenishment planning; it is not a free acceleration feature or a claim about a new PayPal product.

## Actual demonstration

The completed [day45 review](../economic-workflow-2/checkpoints.json) used fresh Gemini decisions and observed history through day44:

1. Requested economic indicators, including demand, stock, liquidity, supply and payment information.
2. Observed a14-day request-growth ratio of0.36, a6-day supplier quote versus3 normally, and $13,093.82 spendable merchant cash. The two funded baskets were individually fillable despite many empty store/SKU listings.
3. Requested a local demand fit. Past-window validation selected the7-day recipe from133 available funded observations.
4. Composed a temporary reactivation/forecast-stock/settlement policy, with conditions bound to the14-day evidence.
5. Requested a matched trial on a **different completed historical market**. The intervention was active on days45–51, then v1 resumed.
6. Kept v1 after the combined candidate lost money.

| Historical result | v1 | Candidate | Change |
|---|---:|---:|---:|
| Settled modeled PayPal contribution | $664.34 | $581.19 | −$83.15 |
| Retailer contribution | $7,331.99 | $7,078.10 | −$253.89 |
| Closing partner cash | $24,601.39 | $24,322.86 | −$278.53 |
| Retained purchases | 123 | 121 | −2 |

This tests the workflow, **not a claim of improved profit**. Multiple policy components changed together, so this trial does not identify which component caused the loss. No unseen benchmark, target-future rollout, live deployment or native payment was performed.

Recorded costs: first diagnostic run $0.056360; corrected end-to-end run $0.072214; total **$0.128574**. Project model ledger total after both was **$4.659648**, below the user's $50 ceiling and existing tighter application caps. These are token-usage estimates, not cloud invoices.

## Harness protections and changes found during validation

- Economic observations project only current merchant/funded-order state and prior platform events. Hidden needs, response draws, future refunds, seeds and shopper wallet balances are not exposed to the planner.
- Demand is timestamped when a request was discovered, not backdated to its earlier latent-need creation date.
- The14-day comparison at day45 crosses the simulation's initial warmup boundary. It describes discovered-request volume, not a proven fall in latent customer demand. The current tool explicitly flags comparisons across that boundary; a planner can request shorter, comparable windows. Combining more indicators does not establish causation.
- Actions unlock when their required domains have been inspected. Evidence IDs, forecast IDs, the snapshot and exact policy hashes are checked.
- Conditions explicitly carry their7/14/28-day window. An earlier diagnostic revealed a14-day/7-day mismatch; that trace is preserved in [run1](../economic-workflow-1/) and the binding is now enforced.
- Model request → pending tool → result checkpoints are saved atomically. Tool caching ignores JSON key order and explanatory text. Resume rejects changed snapshot/schema/source; completed replay makes no new model calls.
- The recorded v2 trace includes two rejected final-argument attempts. Current v3 removes that ambiguity: the model selects only a known artifact ID, and the harness supplies decision status and measured amounts. V3 selection and the temporary-outreach-pause action were validated locally; no extra provider rerun was charged.
- No generated SQL/code, economic rule edits, arbitrary cash transfers or native PayPal mutations are available.

## Run and inspect

Open **Economic workflow** in Market Metro's sidebar. This displays saved decisions, exact evidence, model validation, trigger evaluation and the historical comparison without additional charges. It is separate from the existing live market controller.

```sh
npm run test:economic
npm run baseline:verify

# Explicit fresh provider execution; at most $0.30, eight model calls,
# two local fits, two proposals and one historical comparison.
npm run workflow:economic -- --run-llm --run-id economic-review-a

# Same completed ID returns the saved result without new calls.
# For an interrupted run with a checkpoint and unchanged source/snapshot:
npm run workflow:economic -- --run-llm --run-id economic-review-a --resume
```

New runs live under `docs/commerce-growth/economic-workflows/<run-id>/`. A process lock prevents concurrent execution of one ID. A changed tool contract requires a new ID. The reusable `openEconomicHarness` accepts an observed snapshot and a historical-trial callback; the CLI is a bounded illustrative adapter.

Next financial evidence should compare this workflow with v1 on registered fresh seeds. The present improvement is broader, correctly grounded investigation and action capability; **v1 remains the comparison baseline**.
