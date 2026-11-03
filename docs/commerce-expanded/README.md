# Expanded live market v1

The approved expansion is a separate **12-merchant, 600-shopper** live economy. Select it in **New live run → Size**. Existing sessions and the sealed `paypal-net-v1` benchmark remain intact.

## What scales

| Input | Original | Expanded v1 |
|---|---:|---:|
| Shoppers | 100 | 600 |
| Merchants | 3 general stores | 12 stores: 3 per category |
| Authored catalog | 16 products | Same 16 products |
| Merchant listings | 48 | 48 |
| Per-person need-arrival probability | Scenario rate / 100 | Same |
| Pooled initial stock per SKU | Scenario stock × 3 | Scenario stock × 18 |
| Initial merchant cash, total | $4,500 | $27,000 |
| Simulated outreach budget | $50 | $300 |
| Daily contact ceiling | 10 | 60 |
| Per-shopper contact gap | 7 days | Same |
| Real model budget per run | $0.25 | Same |

Prices, supplier costs, response probabilities, consent, household income per person, return behavior, fee assumptions, margin checks and delivery timing retain the original formulas. Category specialization is a versioned structural change. We did not fit any of these assumptions to PayPal customer data. All products are independently authored fixtures; this version makes no Channel3 API calls.

## One team for the whole market

The analyst sees observed demand and funded requests. The scientist chooses a model and invokes local CPU training. The commerce manager publishes a typed campaign and stock/settlement settings. Each role uses Gemini Flash-Lite; no additional model call is made per shopper or merchant. Campaign rates of 3/6/10 contacts mean **per 100 shoppers** and execute as 18/36/60; previews and checkpoints disclose this conversion. The original training data remains from the smaller market, so transfer quality must be measured rather than assumed.

Shopping continues during reviews. Consent, funds, stock, approved substitutions and merchant margin checks execute in trusted code. Full input/need/consent audits run at day boundaries; individual actions validate their own authorization and financial invariants. The expanded kernel computes conservation with count maps, using the same equations as the original. No inventory or cash is created by rendering.

PayPal-style authorizations, basket captures, supplier settlement, delivery and refunds feed the warehouse. The optional existing Sandbox adapter mirrors **one** eligible retained merchant leg, up to $100 fictitious funds, after settlement. It is off for the expansion verification run. Simulated entries are not native receipts or actual PayPal profit.

## Evaluation and display

One same-seed fixed-policy control runs after each live campaign. Opening-state, finite-need, consent and income hashes must match. Report retained customer baskets, merchant order legs separately, payment volume, modeled platform contribution after AI cost, and merchant contribution. Show net and purchases **per 100 shoppers**, plus contribution **per merchant**, so larger population is not presented as policy lift. A single run is an integration demonstration, not a generalization benchmark.

All 600 customers are simulated and written to the warehouse; the scene renders 96 representative shoppers to bound GPU work. Store labels remain toggleable, and every shopper is available in warehouse records and trace APIs. Saved day frames and checkpoints support replay without new model calls.

Verification: `node --test tests/commerce-expanded.test.mjs tests/commerce-autonomy-live.test.mjs` and `npm run baseline:verify`.

## First live integration run

`AUTONOMY-e8dbdeebec59428a`, seed `20261103`, discovery scenario. Completed all 100 market days and 26 settlement days with six fresh Gemini decisions, two local model fits, two campaign publications and 29 local funding-calibration updates. The second model fit included 197 matured contacts from this run. Actual token-metered model cost estimate: **$0.013447**; cumulative project ledger **$4.909317**, no unsettled entries. No native Sandbox call was made.

| Campaign-period outcome, after settlement | Same-size fixed rules | Live team |
|---|---:|---:|
| Retained customer purchases | 871 | 875 |
| Retained payment volume | $111,200 | $111,081 |
| Modeled PayPal contribution, after AI | $4,364.26 | $4,373.39 |
| Merchant contribution | $51,763.38 | $51,741.00 |
| PayPal contribution per 100 shoppers | $727.38 | $728.90 |
| Retained purchases per 100 shoppers | 145.17 | 145.83 |

**Operationally passed; joint financial improvement not demonstrated.** The team produced four more retained purchases and $9.13 more modeled platform contribution, but $22.38 less merchant contribution and $119 less retained volume. These are one-run differences, not statistically established gains. Total live purchases including shared warmup were 1,596; that larger number must not be compared with the campaign-period 871/875. The run's evidence and decisions are in `live-run-1.json`.

The online funding adjustment also needs improvement: on 715 issued recommendation predictions, Brier error rose from 0.1617 to 0.1680 (about 3.9% worse). This evaluation uses the same issued contacts; it does not measure causal campaign lift. Successful execution and historical model validation are not proof of better current-market predictions.
