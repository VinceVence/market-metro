# Current campaign versus no campaign

Measured October 30, 2026, after the live demonstration. This was one local counterfactual calculation with recorded decisions, not a new Gemini run or a multi-seed benchmark. No new payments or model API calls were made.

## Setup

- Source: `COMMERCE-4980808c005eefd6`, seed150001, 100 shoppers and the authored catalog.
- 100 shopping days, including 30 shared warmup days; 14 additional days settle returns.
- Identical initial history, random draws, rival-sale shock, inventory, wallets and economic parameters.
- Recorded campaign: `reactivate`, published Day48 and retained Day74; offers stop after Day90.
- Scheduled local fits at zero-based cutoffs30,44,58,72,86. The strategist also requested cutoff67, displayed as Day68.
- The reconstructed campaign matched the saved live run's **entire order and action arrays exactly**, before comparing controls.

## Result

All financial outcomes below cover the post-warmup period, including settled returns. Both worlds share137 warmup purchases, which are excluded from the purchase row.

| Metric | No post-warmup campaign | Recorded agent campaign | Difference |
| --- | ---: | ---: | ---: |
| Purchases | 408 | 440 | +32 (+7.8%) |
| Retained simulated sales | $28,576.00 | $29,606.48 | +$1,030.48 |
| Modeled merchant contribution | $10,685.19 | $11,089.08 | +$403.89 |
| Modeled platform contribution after AI cost | $760.95 | $784.37 | +$23.42 |
| Coupon offers | 0 | 242 | +242 |
| Coupon redemptions | 0 | 7 | +7 |
| Distinct reactivated customers, evaluator truth | 19 | 20 | +1 |

The campaign's242 coupon offers include repeated contacts to eligible shoppers; they are not242 distinct customers. Its7 redemptions are not7 proven incremental purchases. In the simulator, relevant contacts also affect awareness, visits and later full-price buying.

Campaign costs were $4.88 outreach and $32.02 redeemed coupon discounts, of which the platform funded $6.40 and merchants funded the remainder. The platform contribution formula subtracts modeled processing costs, fee credits on refunds, platform-funded discounts, outreach and the full $0.021008 AI usage. Its fee/processing assumptions are authored simulation inputs, not actual PayPal economics. The $18 native Sandbox receipt mirrors an existing order and is excluded from incremental revenue.

## Does the extra agent action add value?

A second diagnostic reused the selected `reactivate` program and exactly the same publication timing, but used only the normal scheduled model fits and no LLM calls. This is a **post-hoc ablation**, not an independently selected strong-rule benchmark.

| Metric | Same program, scheduled fits only | Agent-requested extra fit included |
| --- | ---: | ---: |
| Purchases after warmup | 440 | 440 |
| Retained simulated sales | $29,612.28 | $29,606.48 |
| Merchant contribution | $11,093.25 | $11,089.08 |
| Platform contribution after AI cost | $783.90 | $784.37 |

The extra-fit branch adds $0.468992 in modeled platform contribution after deducting all campaign AI usage, but loses $4.17 merchant contribution and $5.80 retained sales. This is not a material multi-agent performance advantage. The current evidence supports the campaign-versus-inactivity result in this one simulated market; it does not isolate or prove the value of having multiple LLM roles choose that campaign.

## Actual decision workflow

The analyst saw25 observed lapsed shoppers after Day30. The strategist chose the predefined reactivation program; the reviewer approved it, and trusted code published it on Day48. In the second review, the strategist saw82 recent orders versus96 in the previous window and31 observed lapsed shoppers. It retained reactivation and requested a fresh fit. That fit ran on Day68, and the reviewer retained the campaign on Day74.

The Day68 ranker achieved15/41 top-three hits (36.6% Recall@3), versus8/41 (19.5%) for popularity on the same later validation window. This checks product ranking, not incremental sales or LLM quality. Five of the six fits were scheduled by code; one was requested by the agent. Both reviewer decisions approved the proposed policy; no reviewer disagreement occurred in this run.

The ranking algorithm is a lightweight observed-count model: browsing and purchase counts form item/category affinity, blended with smoothed popularity using fixed weights. The LLM chooses among six authored program families and can request retraining. Local code chooses eligible products/customers and enforces contact gaps, stock, budget and minimum margin. It is a bounded commerce orchestration workflow, not a newly invented optimization algorithm.

## Limits and reproducibility

This one-seed result is conditional on authored shopper-response assumptions. There is no confidence interval, held-out population result or demonstrated superiority over independently specified strong fixed campaigns. The no-campaign and fixed-program branches do not call Gemini; the selected agent decisions are held fixed. Simulator source hashes and exact results are in [paired-control.json](paired-control.json).

Reproduce without cloud or payment calls:

```sh
node scripts/commerce-room/paired-control.mjs
```

Earlier AG Studio handoff acceptance checks and the older230-day personalized-recommendation experiment are separate evaluations. Their results must not be presented as this campaign's benchmark.
