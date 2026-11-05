# Which model should rank shoppers for this campaign?

A merchant has a limited outreach budget. The analyst identifies a sales opportunity, the scientist trains two ranking models, and the commerce manager proposes a campaign. In the V2.3 study, all 16 reviews fitted two models. Each review tested the financial outcome of just one model.

The optional verifier now puts both rankings behind **the same campaign**. The offer, contact limit, inventory policy and settlement terms stay fixed during this comparison. The verifier measures retained purchases, merchant contribution and modeled PayPal net on three development markets. An eligible original model sets the floor for the challenger. A more profitable alternative also has to protect merchant contribution, purchases, payment volume and partner cash, pass the existing inventory and stress checks, and clear its liabilities. A tie or unavailable comparison keeps the original decision. The publisher binds the chosen campaign to its tested model and receipt. The next review can read the result.

## What happened on fresh shoppers

The four model choices were locked before evaluation. Each policy ran from displayed day 31 through settlement with the original 12-merchant, 600-shopper economy. Each agent arm carries the same $0.144437 in total recorded first-review model costs. New model charges and native payments were both zero.

| Total across four markets | PayPal net after AI | Merchant contribution | Retained purchases | Retained payment volume |
|---|---:|---:|---:|---:|
| Strong fixed rules | $15,029.77 | $178,391.15 | 2,871 | $398,372 |
| Original agent model choices | $15,136.62 | $179,565.70 | 2,889 | $400,839 |
| Agent choices with model check | **$15,222.47** | **$180,520.10** | **2,900** | **$402,870** |

| Unseen market | Model choice | PayPal vs original | Merchants vs original | Purchases vs original | PayPal vs fixed |
|---|---|---:|---:|---:|---:|
| Product discovery | Kept | $0.00 | $0.00 | 0 | +$87.75 |
| Reactivation | Switched | +$84.03 | +$954.40 | +11 | +$104.86 |
| Low response | Switched | +$1.82 | $0.00 | 0 | −$1.58 |
| No response | Kept | $0.00 | $0.00 | 0 | +$1.66 |

**Reactivation explains all 11 additional purchases.** The scientist preferred boosted trees with market feedback. It ranked historical buyers more accurately, with validation AUC of 0.773 versus 0.680 for the two-stage response model. The manager proposed recommending products or asking what a shopper needed. On the three development markets, the same campaign earned $30.97 above fixed rules per market with boosted trees, and $37.71 with the two-stage model. The verifier switched. On the fresh reactivation seed that switch produced $2,031 more in retained payment volume.

**The check can also reject a higher-earning model.** For the campaign proposed in the no-response scenario, the alternative would have earned $1.97 more per development market on average. It would have reduced retained purchases, so the verifier kept the original. The low-response campaign still finished $85.12 below fixed rules for merchants and one purchase behind on its unseen seed.

## Replay and interpretation

Open [the four-market comparison](http://127.0.0.1:4173/studio.html?view=performance&evaluation=model-check). Select a market to see both model trials and its held-out outcome. The link under the comparison opens the recorded agent decisions for that campaign. **New live run → Workflow → V2.3 + compare both models on campaign earnings** enables the check for future reviews.

You can reproduce the comparison from the project root after completing the [local setup](../../../README.md).

```sh
node scripts/commerce-expanded/harness-v2/benchmark-model-check.mjs
```

The command verifies the frozen economy and the archived original trial outcomes. It reloads or reproduces each trained model, writes the choices under `.local/model-check/` before opening the unseen markets, and saves a new local report. The checked-in report contains the choices, receipts, case inputs and every outcome. Receipt IDs fingerprint the evaluator build.

This is a four-seed comparison of **one change to a saved first-review campaign**. Holding the campaign through close isolates the model switch. The earlier two-review study evaluated fresh LLM decisions and one planner earned more than the team. Results from the two experiments have different baselines. PayPal net here uses simulated fees, costs and refunds. Merchant contribution includes inventory at its modeled value. The separate native Sandbox receipt confirms a working payment integration.

[Registered protocol](protocol.json) · [Machine-readable results](../../../demo/data/commerce-model-check.json) · [Earlier fresh-planner comparison](../harness-v2/v23-20261104/README.md)
