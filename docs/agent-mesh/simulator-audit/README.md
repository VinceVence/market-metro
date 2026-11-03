# Campaign-response audit

The benchmark simulator responds to campaigns, but its behavioral assumptions are too restricted to validate the intended acquisition, personalized discovery and reactivation system. This audit changes no old benchmark result and makes no paid model or native payment calls.

## What actually works

The unmodified engine was exercised on 128 isolated single-shopper counterfactual fixtures with identical initial state and keyed random draws. Recommendations changed visits in 11 fixtures and purchase/no-purchase outcomes in 8. These are wiring fixtures, not a population lift estimate or a profitable policy benchmark.

First purchase-changing fixture: seed 810011, zero-based day 37. The shopper has $178.05. Without outreach: no visit and no purchase. With one recommendation: a visit and a $31.99 purchase. The same visit draw is 0.3513. Campaigns change the threshold and product/merchant choice utility; they do not merely append a campaign label to independent purchases. The shopper may buy from a different merchant after the campaign-induced visit.

Source: `scripts/policy-lab/economy.mjs:76–123`.

## Structural limitations

1. **Visits almost cancel by construction.** An 80% read probability times a 0.10 visit boost creates0.08 expected additional same-day visits per contact. Every sent contact also adds 0.2 fatigue, decaying by 0.9 each day. At 0.04 fewer visit-probability units per fatigue unit, its infinite-horizon penalty is 0.04 ×0.2 /(1−0.9) =0.08. The actual unmodified transition produces a 60-day penalty of0.07985624, leaving only0.00014376 expected extra visits before the rest of the tail. This is about visits; recommendation utility can still change conversion and merchant choice. Ordinary probability clipping is inactive at the tested activity levels.
2. **No persistent customer lifecycle.** Base activity, latent merchant affinity and loyalty do not learn from marketing or purchase. A lapsed shopper is a recency filter, not a distinct dormant state whose future behavior can recover. Campaigns mainly affect the current visit/choice, future cash availability and fatigue.
3. **Weak product relevance.** The product category is drawn uniformly before the policy acts. A read recommendation gives the same 0.55 utility increment regardless of item–shopper taste match. The inherited product-affinity field is not used in this policy-lab transition. This limits what an improved recommendation model could accomplish.
4. **A captive shopping allowance.** All three modeled retailers accept PayPal. The outside option means no purchase, not another payment network. There is no acquisition of external shoppers. Across six diagnostic 400-day control markets, about90.0–93.4% of the available credited shopping budget is already spent without campaigns after the shared learning history. Campaigns have limited remaining budget to unlock and can move purchases forward. These six samples are descriptive, not a population calibration.
5. **Spending and platform margin are different objectives.** Under the authored fixed/percentage fee assumptions, a $31.99 order yields 3.22% contribution before returns/outreach, while an$89 order yields 2.62%. Larger baskets can help merchant economics while reducing the platform's fixed-fee income per dollar. This is an assumption-dependent tradeoff, not a claim about actual PayPal pricing or profit.

These are properties of the policy-lab benchmark. The app also contains a separate continuous-market engine; results from one engine must not be represented as validation of the other.

## Actual accounting defects corrected in an isolated version

Weekly credit used `min(50000, existingWallet + income)`. If refunds have raised an existing wallet above$500, the refresh destroys existing money. Natural diagnostic worlds exhibited this; the minimal reproducer starts at $520 and ends at $500 before purchases. Budget-pressure multiplication also creates fractional-cent credits.

`scripts/policy-lab/wallet-corrected.mjs` fixes both: limit only new credits to available headroom, preserve all existing money, and round credits to integer cents. Three focused tests pass, including a reproduction of the original defect and exact transition parity on unaffected days. The corrected version requires a new versioned world; it is **not silently applied to archived runs or the current server's frozen benchmark engine**.

## Keep the earlier promising policy; distinguish the questions

The earlier high-value weekly recommendation policy remains a candidate. Its existing 80-market result is +$5.43 at 100 days, falling to−$5.33 at 200 days when outreach stops at 100. The latter measures post-campaign durability, not a continuously operating campaign team.

On six previously examined diagnostic markets, the original 200-day difference averaged **$-4.5037** with outreach stopped at 100. The wallet correction alone left those results unchanged. Continuing the original policy through 200 days, under the same$50 virtual budget and original behavioral equations, averaged **$-0.1237**. This sensitivity improves our understanding of the evaluation window; it is not fresh confirmation and does not prove a positive continuing policy.

## Next behavioral version: specification, not implemented

Retain the earlier strong policy as a baseline. Before another agent search, introduce observable needs and item–shopper relevance, explicit but stochastic customer acquisition/dormancy/reactivation, organic returns to activity, competing uses of shopping budgets, and frequency-dependent fatigue. Financial accounting must conserve money. These mechanisms must apply identically to rules and agents.

Validate the behavior independently: a well-matched offer should change choice in responsive fixtures; irrelevant offers and spam should not automatically win; a zero-response population must incur costs without lift; budgets and stock cannot be bypassed. Product matching must use Channel3 attributes rather than policy/agent identity. Select response assumptions before policy evaluation and disclose them as uncalibrated until backed by data. Measure ongoing campaign performance and post-campaign persistence separately. No response coefficient should be tuned merely until an LLM wins.

## Reproduce

```sh
node scripts/audit-campaign-response.mjs
node --test tests/simulator-wallet.test.mjs
node scripts/audit-strong-policy-wallet.mjs
```

`audit.json` includes every counterfactual fixture, the measured fatigue impulse, wallet diagnostics and source hashes. `strong-policy-wallet-sensitivity.json` preserves all six outcomes and exact reproduction checks against archived results. New cloud/model calls:0. New payments:0. Original engine hashes verified unchanged.
