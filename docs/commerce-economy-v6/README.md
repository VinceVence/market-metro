# Per-product quote extension

**Research candidate;2× target not achieved. No policy promoted.**

Version6 adds a merchant price-book interface. Without a price book it reproduces v5 orders, outside purchases, stock, merchant cash and contribution exactly in the parity check. It leaves buyer response equations, money, fees, returns and settlement rules unchanged. The original v5 source and benchmark snapshots remain intact.

Quotes are authored test limits of75–125% of base price and must preserve a20% pre-return unit margin. These limits are not PayPal policies. Outside-retailer prices remain immutable, and a new quote cannot increase an existing subscription consent cap.

The first trial compared24 local quote proposals against a family of six fixed price strategies with catalogue rotation. The strongest eligible fixed comparator was the uniform1.1 price plan. Its mean platform net was$799.475 on six development markets. The maximum-net candidate reached1.747× after design cost but reduced retailer contribution by$4,183.53 and failed the financial gate. No candidate passed every counterparty check. Validation remained unopened.

## Evidence

- `quote-search-1/protocol.json`: registered limits, comparator family, cases and source hashes.
- `quote-search-1/fixed.json`: all fixed comparators.
- `quote-search-1/development.json`: all proposals, including rejected results.
- `quote-search-1/results.json`: failed advancement gate.
- `tests/commerce-v6.test.mjs`: parity, cash/stock neutrality of quote publication, outside-price isolation and subscription consent checks.

## Research direction

The next legitimate optimization tool is a learned surrogate for both contribution and financial constraints, with measured failures retained as training observations. Constrained expected improvement explicitly values improvement only when a candidate is feasible; its simplest multi-constraint factorization assumes conditional independence. Our financial outcomes are coupled, so that assumption cannot be silently treated as a safety guarantee. [Gardner et al., ICML2014](https://proceedings.mlr.press/v32/gardner14.html).

Trial estimates also vary across markets. A method that substitutes a single best observed result into ordinary expected improvement can overfit noisy outcomes; uncertainty-aware constrained acquisition is a relevant research direction. This is methodological support, not evidence of a2× commerce gain. [Letham et al., Constrained Bayesian Optimization with Noisy Experiments](https://arxiv.org/abs/1706.07094).

The agents should choose and interpret bounded experiments through trusted tools. A surrogate only proposes the next trial; exact simulation and independent evaluation still control publication. The local surrogate selector is now implemented in `scripts/commerce-economy-v6/propose-probe.py`, with checkpointed execution in `surrogate-trial.mjs`. It was compared with random proposals using the same12-trial budget per arm and the same candidate-generation streams. Neither arm found a financially feasible improvement in this trial. The surrogate was not promoted.

[A separate deadline-driven scenario is proposed for review](deadline-scenario-proposal.md). The user approved the separate scenario. Funded-request generation, customer authorizations and observation boundaries are implemented; allocation, settlement and performance evaluation are still pending.
