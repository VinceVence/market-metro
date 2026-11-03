# Market Metro behavior V3

**Training-rights clarification pending:** Channel3's published terms restrict ML training and synthetic training data derived from its output. Our current catalog-derived local training needs explicit permission clarification or separation from Channel3 output. See `../data-provenance-review-2026-10-26.md`. V3 does not require Hillstrom.

V3 implements the behavioral contract from the simulator audit: product relevance and persistent awareness, active/dormant/prospect relationships, organic reactivation, shopping-pressure replenishment and satiation, competing outside purchases/household spending, independent frequency fatigue, and conserved integer-cent wallets. Old engines and all prior negative results remain frozen.

**This is a new authored model, not a calibrated model of real PayPal customers.** Its positive results cannot be called a policy-only improvement over V1. Channel 3 provides cached product listings and prices; it does not supply customer behavior, inventory, merchant costs or campaign response.

## What is running

- `/behavior-lab.html`: the existing 3D market and office art with day-by-day replay, a settings popup, shopper traces, local model checkpoints, normalized warehouse tables and research figures.
- The default seed 124001 changes shopper interests. It starts at day 1, collects 30 days of shared history, runs campaigns for 100 days, observes another 100 days after outreach stops, then settles 14 days of refunds.
- Twelve real cached Channel 3 listings cover stationery, electronics, furniture and office bundles. Topics are explicitly derived from public titles; malformed cached category strings are not used as features. Three fictional merchants offer the catalog.
- Two fresh Gemini 3.1 Pro custom-tools calls performed campaign selection and independent review, using development outcomes plus observed day 30 data. Both selected the earlier high-value weekly program. The reviewer did not receive the proposer's rationale.
- Generated seeds reuse that recorded program at no additional model cost. Shopper behavior, model fitting and transactions are actually regenerated locally. Playback is not a fresh LLM conversation. The selected program uses price, timing, familiarity and observed merchant quality; it does not use the fitted recommender to choose individual items. The same fitted ranker is used by the strong-rule and personalized alternatives.
- Local count-based rankers are fitted every 14 days and evaluated against popularity on a later seven-day window. Models use observed views and actual purchased products; a purchase of another item is not mislabeled as a purchase of the viewed recommendation.
- The new engine writes orders, items, transactions, refunds, coupons, actions, local models, daily states and evaluator-only outside-spending records to the existing SQLite warehouse. It makes no native payment calls. Existing PayPal saved-wallet sampling and verified receipt joins remain available in the main app; a prior receipt reference is never counted as a payment in the new run.

## Preregistered comparison

Before inspecting profit results, the source hashes, catalog, response assumptions, policies, seeds and metrics were saved in `protocol.json`. Five structural checks passed first; an additional exhausted-budget check was added afterward. The core simulator and policies were not changed after registration.

Development:3 seeds ×5 scenarios =15 markets. Evaluation:8 untouched seeds ×6 scenarios =48 markets. The additional scenario changes preferences. All six programs run on each paired market with identical exogenous draws, initial conditions, budget and financial equations. Each sees its own resulting observed history. Every final refund is mature. Uncertainty bootstraps the eight seed clusters, not individual shoppers.

| Mean per 100 shoppers | Selected program, after model cost |
|---|---:|
| Platform difference through the active campaign window | +$163.42 |
| Platform difference through day 230 | **+$231.49** |
| 95% seed-cluster interval | +$212.35 to +$252.90 |
| Difference versus rules with the same fitted ranker | +$97.75 |
| Merchant contribution difference vs no campaign | +$3,463.29 |
| Retained payment volume difference | +$9,745.71 |
| Modeled platform contribution growth | +15.8% |

The selected policy beats no campaign in 48/48 nominal markets and the rules baseline in 46/48. These are deterministic policy executions after two generated selection/review decisions. **The same selected numerical program without an LLM produces the same purchases and avoids inference cost; no LLM-specific economic superiority is established.**

Financial bridge: $259.54 extra payment margin after processing/returns −$28.00 outreach −$0.041034 allocated model usage =+$231.49. No discount subsidy is used by the selected policy. Outside-retailer volume decreases $7,116.54, while total retained commerce rises $2,629.18; much of the network-volume benefit is payment-share capture.

## Failure and negative controls remain visible

Campaign response was halved on four additional markets: results remained positive. Those checks have only two seed clusters and are descriptive. In four zero-response markets, purchases, lifecycle transitions and cash outcomes match no campaign exactly; the selected policy loses $28.041034 in outreach plus the model allowance. A positive result is not mechanically awarded to agents or campaigns.

The true need/preferences/relationship state and outside-spending ledger never enter the planner or ranker input. `publicEvidence` and `actionInput` expose prior observed partner events, public catalog attributes, merchant permissions and completed model validation. Evaluator truth is labeled separately in the UI and warehouse.

Unique reactivated-customer counts are lower in the selected program by 6.02 on average. That metric alone cannot establish better retention. A separate post-hoc audit of the single demo seed finds 1,213 additional active-customer days and 23 fewer dormancy episodes versus no campaign. It is an explanation of that one run, not a preregistered population claim or proof that named individuals were saved from churn.

Need pressure is a simplified recurring office-shopping model. It is not a calibrated replacement schedule for durable goods, and category relevance is a soft preference rather than a hard shopping-list requirement. All response, lifecycle, cost, stock and outside-choice coefficients remain assumptions. Real deployment would require behavioral calibration and a real controlled experiment.

## Cost and checkpoints

The two fresh model calls cost $0.041034 using recorded provider usage and the configured pricing calculation. The project ledger total is $2.747027; no APAC configuration was touched. The full approval cost is conservatively allocated to each alternative market, although only two provider calls were made. Replays, benchmarks, new local seeds and local model fits add no model charges. Local CPU is unpriced.

`agent-protocol.json`, `agent-pending.json` and `agent.json` preserve exact evidence, requests, decisions and provider usage. `verification.json` checks that the approval file predates every held-out result, hashes still match, the ledger has no pending calls, the old engine remains frozen, foreign keys are valid, and 245 historical financial frames reconcile with warehouse records.

## Reproduce

```sh
node --test tests/behavior-v3.test.mjs tests/simulator-wallet.test.mjs tests/market.test.mjs tests/paypal-market-vault.test.mjs
node scripts/behavior-v3/benchmark.mjs
node scripts/behavior-v3/benchmark.mjs --evaluate
node scripts/behavior-v3/report.mjs
node scripts/behavior-v3/build-demo.mjs
node scripts/behavior-v3/verify.mjs
.local/research-venv/bin/python scripts/plot-behavior-v3.py
```

These commands make no model or payment calls. The separately named `agent.mjs` is the model-call entry point; a completed saved approval is reused, pending/failed outcomes require inspection, and its existing $0.25/session and project spend guards remain active. Do not rerun or retune against the held-out results.
