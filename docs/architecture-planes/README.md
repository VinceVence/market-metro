# Market Metro interaction maps

These diagrams describe the implemented components as of **25 October 2026**. They separate the v5 campaign-controller benchmark from the existing live-app PayPal integration. They are logical responsibility planes inside one local application, not a claim that every box is a separately deployed service or an LLM agent.

[Four-page PDF](../figures/architecture-planes/market-metro-interactions.pdf)

| Figure | What to follow |
|---|---|
| [A. System planes](../figures/architecture-planes/system-planes.svg) | Channel3 listings become a seeded market, then trusted evidence, a controller choice, checked execution and an independent result. |
| [B. Evaluation](../figures/architecture-planes/evaluation-design.svg) | All controllers receive the same observations; each policy acts in its own matched market. Future scores stay hidden. |
| [C. Recorded review](../figures/architecture-planes/recorded-review.svg) | One development example where current demand, premium purchases and mature returns lead Gemini to skip a campaign. |
| [D. PayPal path](../figures/architecture-planes/paypal-live-path.svg) | The separate live-app commerce planner and guarded adapters create or inspect native sandbox objects and link them to the warehouse. |

## Who actually decides

- **Campaign planner: Gemini.** v5 receives observed simulation data, candidate recipes and model evidence. It chooses a campaign or observation, and can revise that choice at later reviews.
- **Analytics worker: code.** It computes dated demand, product mix, stock and mature return statistics. It owns joins, units and denominators.
- **Model worker: local ML/code.** The current registry includes real fitted ridge models and explicitly authored targeting rules. Authored rules are not relabeled as trained models. The pooled model is trained offline before the current v5 trial; the LLM is selecting from available artifacts, not writing or training arbitrary models at each review.
- **Execution guard: code.** It checks the allowed candidate, scope, budgets and input identity, then saves and applies the decision.
- **PayPal operations planner: a separate live-app Gemini role.** It chooses typed commerce actions when that path is enabled. Native amounts, recipients, consent and request identities are enforced server-side.
- **Evaluator: independent code.** It computes financial results and uncertainty. It does not accept an LLM's assertion that a campaign was profitable.

The current `trusted.html` default is the v4.1 semantic router with predictable workers. The v5 campaign controller is a separate benchmark runner, with its saved decisions available in `campaign-controller.html`. Neither should be presented as a fully autonomous team of LLMs doing every role. Additional LLM roles have to justify their cost and accuracy independently.

## The important data boundary

In **v5's fair-comparison mode**, a shared no-outreach market monitor supplies identical observations to Gemini and code baselines. The LLM also remembers its prior choices. Its evaluated policy world changes as its campaign acts, but those treatment outcomes and final comparison results are sealed from the planner. There is deliberately no arrow from final evaluation back into the LLM.

This is a controlled test of data-dependent policy selection, not yet proof of a production agent learning from its own campaign outcomes. The existing continuous-market app has its own event/warehouse feedback loop; the v5 benchmark uses in-memory state and JSON artifacts rather than automatically writing each comparison world into the app's SQLite warehouse.

Channel3 supplies cached product listings, not a merchant's private inventory or customer data. Customers, merchant stock, behavior and shocks are simulated. The live app's native PayPal captures are linked samples of existing orders and must not be counted again as extra sales.

## How evaluation works

1. Freeze simulator code, catalog, assumptions, candidate library and the controller before the evaluation seeds are run.
2. Give all methods the same observed evidence and publish at the same one-day simulated delay.
3. Compare eight policies: no outreach, static rules, risk-sensitive static rules, contextual rules, risk-sensitive contextual rules, the original rules, fresh Gemini decisions, and repetition of Gemini's first choice.
4. Run 100 shopping days and then a **modeled 14-day return-observation tail**. That window is a simulator assumption, not a PayPal policy.
5. Compute retained modeled fees minus modeled processing, outreach, platform incentive funding and recorded inference cost. Merchant contribution is a separate measure. This is not full or actual PayPal profit.
6. Compare the LLM against no campaign, the strongest comparator selected before evaluation, and the first-choice ablation. Resample seed clusters, not individual shoppers.
7. Completed validation used 16 seeds × five conditions. Independent confirmation reserves another 16 seeds × five conditions and runs only after validation passes. All losses and failed attempts remain in the report.

The implemented gates require at least $0.50 mean modeled gain and a positive 95% lower bound against both no campaign and the primary code baseline; the paired lower bound must also exceed zero against each code comparator. Revisions must add value versus repeating the first choice; mean merchant effect must be nonnegative; hard accounting/authority violations and failed reviews must be zero.

**The full validation did not pass.** Gemini averaged +$0.8494 per market versus no outreach, with a 95% seed-cluster interval of −$1.5622 to +$3.0940. Revising the campaign averaged −$0.3234 versus repeating its first choice. The 240 requests included one timeout; its failed review and full $0.03 reservation were retained. All 80 cases and every branch reproduced without new model calls. Independent confirmation was not run. See [the complete v5 report](../policy-lab/benchmarks/v5/README.md).

## The recorded example

The day-80 snapshot in `CAMP5-pilot-2fcb4d2284fa390e` contains 91 purchases versus 100 in the preceding window, 19 premium purchases versus 25, and mature returns of 4/68 and 4/63 at two stores. Gemini chose `observe`. Code validated and checkpointed the choice, then published no third campaign at day 81. Ordinary shopping continued.

After day 114, that one development run had a **+$1.791115** modeled platform difference versus no outreach. Repeating the first choice produced **+$0.366671** after its cheaper model cost. The difference attributable to the revision sequence and extra inference was **+$1.424444**. This is a selected illustrative case, not evidence of repeatable profit; other development cases lost money.

## Source of truth

- `scripts/campaign-controller/runtime.mjs`: shared monitor, controller branches, publication timing and sealed outcomes.
- `scripts/campaign-controller/evidence.mjs`: observed metrics and maturity definitions.
- `scripts/campaign-controller/benchmark.mjs`: comparison arms, accounting, gates and planned seed sets.
- `scripts/campaign-controller/agent.mjs`: actual Gemini action contract and spend checkpoints.
- `scripts/market-store.mjs`: live-app tables and provider lineage views.
- `scripts/paypal-commerce.mjs` and [PayPal service evidence](../paypal-services.md): separate commerce planner, guarded API effects and recorded sandbox limitations.

[Manifest and source hashes](manifest.json) · [Diagram interaction checks](ui-validation.json)
