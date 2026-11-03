# Fresh-agent comparison — October 31, 2026

**Result: the current team did not outperform the independently selected fixed campaign.** All four fresh agent markets beat no post-warmup campaign. In every market, however, the agents selected exactly the same weekly featured-product program as the fixed baseline. Purchases and merchant contribution matched; AI usage made the agent branch slightly more expensive.

| Market | Orders: none / fixed / agents | Agent platform effect vs none | Agent effect vs fixed |
| --- | ---: | ---: | ---: |
| Steady demand | 370 / 401 / 401 | +$77.02 | −$0.033646 |
| Rival sale | 406 / 436 / 436 | +$74.61 | −$0.033574 |
| Budget pressure | 307 / 317 / 317 | +$21.90 | −$0.033786 |
| Elevated returns | 410 / 417 / 417 | +$8.89 | −$0.035922 |

Orders and financial effects cover the post-warmup shopping period, with delayed refunds settled. Platform contribution is a simulator estimate after modeled processing, refund fee credits, outreach, platform discount support and actual model usage. No real PayPal profit is measured.

## What was frozen and compared

The simulator, catalog, ranking code, agent workflow and model client were hashed before evaluation. The candidate programs were evaluated locally on three separate development markets. The fixed program was selected by mean modeled platform contribution, with nonnegative mean merchant contribution versus no campaign. The winner was `weekly_featured`; its development mean was $751.22, compared with $747.37 for personalized recommendations and $721.08 for reactivation coupons.

The agent team received the same development summary, the same allowed programs and its current observed market evidence. The objective was settled purchases and modeled platform contribution while protecting merchants. This economic objective differs from the earlier demo's specific reactivation mission. None of the four evaluation outcomes was included in prompts or used to revise policies.

Evaluation used four previously unused seeds, one per scenario:310701–310704. Each market had100 shoppers, the same authored catalog,30 warmup days,100 shopping days total and14 days for returns. Initial observed order histories matched exactly across all three branches. Subsequent observations belong to each branch's own outcomes; they are not falsely described as identical after interventions.

The same production decision functions were used for the fresh team. A benchmark-only clock held virtual time at the Day30 and Day60 review boundaries, so both fixed and agent choices could apply on Days31 and61. Provider latency is recorded separately; it was not translated into arbitrary extra days of shopping. The live app continues trading during its normal reviews.

The baseline and agent branches share all stock, budget, contact-frequency, merchant-margin and return-risk controls. Both have access to the same local ranker. The selected weekly featured-product program does not use personalized ranking scores.

## What the agents actually did

There were20 fresh provider calls: one analyst, two strategist and two reviewer calls in each of four markets. All20 completed with saved inputs, public rationales, usage and validated outputs.

- All eight strategy decisions selected `weekly_featured`.
- All eight reviewer decisions approved it.
- No agent requested retraining; the five local fits per market were scheduled by code.
- No agent switched programs when observations changed.
- The rationales repeatedly cited the development table's strongest mean result.

The workflow executed correctly. It did not demonstrate adaptive decision value beyond selecting and retaining the known development winner. This result does not establish that agents are generally useless for commerce; it applies to this bounded six-program selection task and these four cases.

## Advancement check and cost

The predeclared pilot gate required at least2% mean net platform improvement over the fixed baseline, wins in at least3 of4 cases, nonnegative mean merchant difference and four valid completed cases. **The gate failed.** There were0 fixed-baseline wins and a mean difference of−$0.034232 per market. Merchant contribution matched exactly.

Total model usage was **$0.136928**, within the $1 incremental limit and20-call limit. No native PayPal API was available to the evaluator, and no payments were made. GCP project settings and APAC resources were not changed. The fees are token-ledger estimates rather than a reconciled billing statement.

This is a small pilot with one new seed per scenario. It provides no population-level confidence interval and does not compare multi-agent with single-agent planning. No further model calls or evaluation-set tuning were made after the four results.

## Artifacts

- [Frozen protocol and objective](protocol.json)
- [Development selection records](development.json)
- [All evaluation results](results.json)
- Fresh traces: [steady](case-1.json), [rival sale](case-2.json), [budget pressure](case-3.json), [returns](case-4.json)
- [Comparison figure](comparison.png)

Rebuild the summary without new model calls:

```sh
node scripts/commerce-room/confirmation.mjs --report
```

The runner checkpoints completed cases and refuses to automatically retry interrupted cases. The simulator remains unchanged; the source patch adds an isolated evaluation clock and corrects rival-sale messages so they are emitted only in that scenario.
