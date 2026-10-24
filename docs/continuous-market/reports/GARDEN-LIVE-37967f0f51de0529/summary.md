# 100-day Gemini marketing demo

Run: `GARDEN-LIVE-37967f0f51de0529`. Seed 314; 300 simulated shoppers; 10 merchants; rival sale; $300.00 virtual marketing budget. Planner: `gemini-3.1-flash-lite`.

**20 validated LLM choices, 9 executed campaign publications, and 8 local training jobs.** 0 failed or rejected LLM attempts are retained in the log.

LLM cost for this run: **$0.035081**. Total accounted across the shared budget: **$0.063577 / $0.25**. These are estimates from provider-reported tokens and saved pricing, not a billing invoice.

The data collection phase is days 1–28. The first automatic LLM review uses observations through day 30. Days 29–100 below include ordinary shopping before and between campaigns; those purchases are not all attributable to the agent.

| Statistic | Learning days 1–28 | Live days 29–100 | Total |
| --- | ---: | ---: | ---: |
| Completed purchases | 554 | 964 | 1518 |
| Product visits | 3417 | 6212 | 9629 |
| Coupons issued | 1381 | 0 | 1381 |
| Coupons seen | 1089 | 0 | 1089 |
| Coupons redeemed | 109 | 0 | 109 |
| Recommendation exposures | 0 | 2213 | 2213 |
| Recommendation clicks | 0 | 764 | 764 |
| Recommendation-associated purchases | 0 | 230 | 230 |
| Simulated payment volume | $36728.75 | $82247.76 | $118976.51 |
| Modeled transaction fees | $1554.58 | $3345.25 | $4899.83 |
| Modeled merchant contribution | $13286.16 | $32116.10 | $45402.26 |

Live campaign spend: $0.00 redeemed discounts + $44.26 assumed outreach. Discounts already reduce revenue; they are not subtracted again in contribution.

Distinct model versions activated in published campaigns: 7. Training jobs: 8 recommender fits and 0 offer-response jobs (0 fitted offer-model candidates). A rejected candidate is a completed fit, not a deployed model. Model artifacts and validation results are in [report.json](report.json).

Actual provider attempts: 20. Research decisions: 10. Publication decisions: 10. Provider tokens: 114752 input, 4256 output, 0 thinking.

Native PayPal sandbox receipts in this run: 0. Ordinary payment volume and fees above are simulated. No live-money transactions were performed. Cached Channel3 listings supply products; the app generates shopper behavior and marketing outcomes.

This is workflow verification in a seeded economy, not proof of incremental marketing benefit or production ROI. The LLM chooses the campaign strategy and training request; local workers fit, validate, execute and log it. The code never substitutes a scripted planner for a failed Gemini response.

## Decision log from day 30

“Evidence through” is the completed-data cutoff. “Decided at” is when the provider response arrived in simulated time. Research rows are proposals; a campaign starts only after publication executes. Justifications below are the model’s saved public rationales, not reconstructed explanations.

### Day 32 05:00 — research — VALIDATED

- Evidence through day 30: 139 purchases in the latest seven days vs 162 before; 148 previously purchasing shoppers inactive for 7+ days.
- Choice: launch / recommendation; 0% discount; 3 products; retrain true.
- Execution for this review: PUBLISH_PRODUCT_CAMPAIGN (DONE) at day 34
- Metered call cost: $0.001538.

Targets observed at the cutoff:

- Pop-Up Desk Keyboard and Touchpad Foldaway Kit: 13 recent purchases, 37 views (previously 1 purchases / 23 views).
- JAM Paper Desk Essentials Office Supply Kit: 18 recent purchases, 29 views (previously 18 purchases / 32 views).
- Starter Bundles: 9 recent purchases, 29 views (previously 8 purchases / 39 views).

P3 shows strong recent growth in purchases (13 vs 1). P24 and P27 maintain high purchase volume. A recommendation campaign is launched to drive discovery of these high-performing items. No coupon is needed for discovery.

### Day 34 12:00 — publish — VALIDATED

- Evidence through day 31: 129 purchases in the latest seven days vs 163 before; 145 previously purchasing shoppers inactive for 7+ days.
- Choice: launch / recommendation; 0% discount; 3 products; retrain false.
- Execution for this review: PUBLISH_PRODUCT_CAMPAIGN (DONE) at day 34
- Metered call cost: $0.001630.

Targets observed at the cutoff:

- Pop-Up Desk Keyboard and Touchpad Foldaway Kit: 15 recent purchases, 40 views (previously 0 purchases / 20 views).
- JAM Paper Desk Essentials Office Supply Kit: 20 recent purchases, 34 views (previously 18 purchases / 31 views).
- Starter Bundles: 11 recent purchases, 36 views (previously 7 purchases / 37 views).

P3 (15 recent purchases), P24 (20 recent purchases), and P27 (11 recent purchases) are currently the highest-performing products by volume. A recommendation campaign is launched to capitalize on this momentum and drive further discovery. No coupon is required for this discovery-focused campaign.

### Day 39 10:00 — research — VALIDATED

- Evidence through day 37: 118 purchases in the latest seven days vs 139 before; 166 previously purchasing shoppers inactive for 7+ days.
- Choice: launch / recommendation; 0% discount; 3 products; retrain true.
- Execution for this review: PUBLISH_PRODUCT_CAMPAIGN (DONE) at day 41
- Metered call cost: $0.001718.

Targets observed at the cutoff:

- Home Office Desk: 12 recent purchases, 36 views (previously 8 purchases / 26 views).
- JAM Paper Desk Essentials Office Supply Kit: 49 recent purchases, 115 views (previously 18 purchases / 29 views).
- Starter Bundles: 22 recent purchases, 58 views (previously 9 purchases / 29 views).

P24 (49 recent purchases) and P27 (22 recent purchases) continue to show strong momentum. P18 has also emerged with 12 recent purchases, showing significant growth. A recommendation campaign is launched to maintain discovery of these high-performing products. No coupon is required.

### Day 41 15:00 — publish — VALIDATED

- Evidence through day 38: 113 purchases in the latest seven days vs 129 before; 167 previously purchasing shoppers inactive for 7+ days.
- Choice: launch / recommendation; 0% discount; 3 products; retrain false.
- Execution for this review: PUBLISH_PRODUCT_CAMPAIGN (DONE) at day 41
- Metered call cost: $0.001765.

Targets observed at the cutoff:

- Home Office Desk: 8 recent purchases, 28 views (previously 11 purchases / 30 views).
- JAM Paper Desk Essentials Office Supply Kit: 46 recent purchases, 109 views (previously 20 purchases / 34 views).
- Starter Bundles: 19 recent purchases, 52 views (previously 11 purchases / 36 views).

P24 (46 recent purchases) and P27 (19 recent purchases) continue to lead in volume. P18 (8 recent purchases) remains a strong performer. A recommendation campaign is launched to maintain discovery of these high-performing products. No coupon is required.

### Day 46 05:00 — research — VALIDATED

- Evidence through day 44: 101 purchases in the latest seven days vs 118 before; 184 previously purchasing shoppers inactive for 7+ days.
- Choice: launch / recommendation; 0% discount; 3 products; retrain true.
- Execution for this review: PUBLISH_PRODUCT_CAMPAIGN (DONE) at day 48
- Metered call cost: $0.001761.

Targets observed at the cutoff:

- JAM Paper Desk Supply Assortment Pack, Red, 1 Rubber Bands 1 Binder Clips 1 Coloured Staples 1 Regular Paperclips (3345REASRTD): 19 recent purchases, 42 views (previously 5 purchases / 11 views).
- JAM Paper Desk Essentials Office Supply Kit: 25 recent purchases, 68 views (previously 49 purchases / 115 views).
- Computer Desk and Ergonomic Mesh Office Chair Bundle: 7 recent purchases, 45 views (previously 1 purchases / 9 views).

P24 (25 recent purchases) remains the top performer. P28 (7 recent purchases) and P1 (19 recent purchases) show strong recent volume and growth. A recommendation campaign is launched to maintain discovery of these high-performing products. No coupon is required.

### Day 48 04:00 — publish — VALIDATED

- Evidence through day 45: 99 purchases in the latest seven days vs 113 before; 191 previously purchasing shoppers inactive for 7+ days.
- Choice: launch / recommendation; 0% discount; 3 products; retrain false.
- Execution for this review: PUBLISH_PRODUCT_CAMPAIGN (DONE) at day 48
- Metered call cost: $0.001773.

Targets observed at the cutoff:

- JAM Paper Desk Supply Assortment Pack, Red, 1 Rubber Bands 1 Binder Clips 1 Coloured Staples 1 Regular Paperclips (3345REASRTD): 22 recent purchases, 48 views (previously 6 purchases / 13 views).
- JAM Paper Desk Essentials Office Supply Kit: 24 recent purchases, 67 views (previously 46 purchases / 109 views).
- Computer Desk and Ergonomic Mesh Office Chair Bundle: 6 recent purchases, 40 views (previously 2 purchases / 15 views).

P24 (24 recent purchases) remains the top volume driver. P1 (22 recent purchases) and P28 (6 recent purchases) show strong recent activity. The current recommendation campaign is expiring, so I am launching a new one to maintain discovery of these high-performing products. No coupon is required.

### Day 53 06:00 — research — VALIDATED

- Evidence through day 51: 93 purchases in the latest seven days vs 101 before; 193 previously purchasing shoppers inactive for 7+ days.
- Choice: launch / recommendation; 0% discount; 3 products; retrain true.
- Execution for this review: PUBLISH_PRODUCT_CAMPAIGN (DONE) at day 55
- Metered call cost: $0.001776.

Targets observed at the cutoff:

- JAM Paper Desk Supply Assortment Pack, Red, 1 Rubber Bands 1 Binder Clips 1 Coloured Staples 1 Regular Paperclips (3345REASRTD): 9 recent purchases, 28 views (previously 2 purchases / 3 views).
- JAM Paper Desk Essentials Office Supply Kit: 28 recent purchases, 79 views (previously 25 purchases / 68 views).
- Modern Office Kit - Pkg of 43: 11 recent purchases, 28 views (previously 3 purchases / 17 views).

P24 (28 recent purchases) remains the top volume driver. P23 (9 recent purchases) and P29 (11 recent purchases) show strong recent growth in volume. I am launching a new recommendation campaign to maintain discovery of these high-performing products as the previous campaign expires. No coupon is required.

### Day 55 07:00 — publish — VALIDATED

- Evidence through day 52: 95 purchases in the latest seven days vs 99 before; 190 previously purchasing shoppers inactive for 7+ days.
- Choice: launch / recommendation; 0% discount; 3 products; retrain false.
- Execution for this review: PUBLISH_PRODUCT_CAMPAIGN (DONE) at day 55
- Metered call cost: $0.001780.

Targets observed at the cutoff:

- JAM Paper Desk Supply Assortment Pack, Red, 1 Rubber Bands 1 Binder Clips 1 Coloured Staples 1 Regular Paperclips (3345REASRTD): 10 recent purchases, 31 views (previously 4 purchases / 6 views).
- JAM Paper Desk Essentials Office Supply Kit: 28 recent purchases, 79 views (previously 24 purchases / 67 views).
- Modern Office Kit - Pkg of 43: 14 recent purchases, 39 views (previously 2 purchases / 15 views).

P24 (28 recent purchases) remains the top volume driver. P23 (10 recent purchases) and P29 (14 recent purchases) show strong recent growth in volume. I am launching a new recommendation campaign to maintain discovery of these high-performing products as the previous campaign expires. No coupon is required.

### Day 60 08:00 — research — VALIDATED

- Evidence through day 58: 80 purchases in the latest seven days vs 93 before; 208 previously purchasing shoppers inactive for 7+ days.
- Choice: launch / recommendation; 0% discount; 3 products; retrain true.
- Execution for this review: PUBLISH_PRODUCT_CAMPAIGN (DONE) at day 62
- Metered call cost: $0.001777.

Targets observed at the cutoff:

- JAM Paper Desk Supply Assortment Pack, Red, 1 Rubber Bands 1 Binder Clips 1 Coloured Staples 1 Regular Paperclips (3345REASRTD): 10 recent purchases, 24 views (previously 9 purchases / 28 views).
- JAM Paper Desk Essentials Office Supply Kit: 22 recent purchases, 89 views (previously 28 purchases / 79 views).
- Modern Office Kit - Pkg of 43: 10 recent purchases, 34 views (previously 11 purchases / 28 views).

P24 (22 recent purchases), P23 (10 recent purchases), and P29 (10 recent purchases) continue to be the highest volume drivers. I am launching a new recommendation campaign to maintain discovery of these high-performing products as the current campaign approaches expiry. No coupon is required.

### Day 62 06:00 — publish — VALIDATED

- Evidence through day 59: 83 purchases in the latest seven days vs 95 before; 209 previously purchasing shoppers inactive for 7+ days.
- Choice: launch / recommendation; 0% discount; 3 products; retrain false.
- Execution for this review: PUBLISH_PRODUCT_CAMPAIGN (DONE) at day 62
- Metered call cost: $0.001778.

Targets observed at the cutoff:

- Home Office Desk: 7 recent purchases, 31 views (previously 0 purchases / 6 views).
- JAM Paper Desk Essentials Office Supply Kit: 23 recent purchases, 95 views (previously 28 purchases / 79 views).
- Starter Bundles: 7 recent purchases, 22 views (previously 1 purchases / 7 views).

P24 (23 purchases) remains the top volume driver. P27 (7 purchases) and P18 (7 purchases) show strong recent growth and high volume, replacing P23 and P29 which have slowed. Launching a new recommendation campaign to maintain discovery of these high-performing products. No coupon required.

### Day 67 07:00 — research — VALIDATED

- Evidence through day 65: 76 purchases in the latest seven days vs 80 before; 225 previously purchasing shoppers inactive for 7+ days.
- Choice: launch / recommendation; 0% discount; 3 products; retrain true.
- Execution for this review: WAIT_FOR_EVIDENCE (DONE) at day 69
- Metered call cost: $0.001773.

Targets observed at the cutoff:

- Home Office Desk: 9 recent purchases, 30 views (previously 3 purchases / 21 views).
- JAM Paper Desk Essentials Office Supply Kit: 29 recent purchases, 101 views (previously 22 purchases / 89 views).
- Starter Bundles: 11 recent purchases, 38 views (previously 4 purchases / 16 views).

P24 (29 purchases) remains the top volume driver. P27 (11 purchases) and P18 (9 purchases) continue to show strong performance and growth. I am launching a new recommendation campaign to maintain discovery of these high-performing products as the current campaign nears its expiry. No coupon is required.

### Day 69 09:00 — publish — VALIDATED

- Evidence through day 66: 69 purchases in the latest seven days vs 83 before; 224 previously purchasing shoppers inactive for 7+ days.
- Choice: wait / recommendation; 0% discount; 3 products; retrain false.
- Execution for this review: WAIT_FOR_EVIDENCE (DONE) at day 69
- Metered call cost: $0.001794.

Targets observed at the cutoff:

- Home Office Desk: 5 recent purchases, 22 views (previously 7 purchases / 31 views).
- JAM Paper Desk Essentials Office Supply Kit: 28 recent purchases, 95 views (previously 23 purchases / 95 views).
- Starter Bundles: 8 recent purchases, 33 views (previously 7 purchases / 22 views).

The current recommendation campaign (active until day 71) continues to perform well, with P24 remaining a dominant volume driver (28 recent purchases) and P27 (8 purchases) and P18 (5 purchases) maintaining steady interest. Given the campaign's continued effectiveness and remaining duration, I am choosing to wait rather than launch a new campaign.

### Day 74 00:00 — research — VALIDATED

- Evidence through day 72: 81 purchases in the latest seven days vs 76 before; 209 previously purchasing shoppers inactive for 7+ days.
- Choice: launch / recommendation; 0% discount; 3 products; retrain true.
- Execution for this review: PUBLISH_PRODUCT_CAMPAIGN (DONE) at day 75
- Metered call cost: $0.001790.

Targets observed at the cutoff:

- Desk Essentials Gift Set: 6 recent purchases, 40 views (previously 1 purchases / 9 views).
- JAM Paper Desk Essentials Office Supply Kit: 23 recent purchases, 79 views (previously 29 purchases / 101 views).
- Pop-Up Desk Keyboard and Touchpad Foldaway Kit: 7 recent purchases, 32 views (previously 1 purchases / 5 views).

P24 remains the top volume driver (23 recent purchases). P25 (7 purchases) and P16 (6 purchases) have shown strong recent growth in interest and sales, outperforming previous secondary products like P27 and P18. I am launching a new recommendation campaign to focus on these high-performing items. No coupon is required.

### Day 75 23:00 — publish — VALIDATED

- Evidence through day 73: 89 purchases in the latest seven days vs 69 before; 206 previously purchasing shoppers inactive for 7+ days.
- Choice: launch / recommendation; 0% discount; 3 products; retrain false.
- Execution for this review: PUBLISH_PRODUCT_CAMPAIGN (DONE) at day 75
- Metered call cost: $0.001784.

Targets observed at the cutoff:

- Desk Essentials Gift Set: 5 recent purchases, 40 views (previously 1 purchases / 13 views).
- JAM Paper Desk Essentials Office Supply Kit: 23 recent purchases, 79 views (previously 28 purchases / 95 views).
- Pop-Up Desk Keyboard and Touchpad Foldaway Kit: 8 recent purchases, 33 views (previously 2 purchases / 11 views).

P24 remains the primary volume driver (23 recent purchases). P25 (8 purchases) and P16 (5 purchases) show strong growth and higher margins, outperforming the previous secondary products. I am launching a new recommendation campaign to focus on these high-performing items to optimize discovery. No coupon is required.

### Day 81 05:00 — research — VALIDATED

- Evidence through day 79: 100 purchases in the latest seven days vs 81 before; 215 previously purchasing shoppers inactive for 7+ days.
- Choice: launch / recommendation; 0% discount; 3 products; retrain true.
- Execution for this review: PUBLISH_PRODUCT_CAMPAIGN (DONE) at day 83
- Metered call cost: $0.001784.

Targets observed at the cutoff:

- JAM Paper Desk Essentials Office Supply Kit: 13 recent purchases, 40 views (previously 2 purchases / 7 views).
- JAM Paper Desk Essentials Office Supply Kit: 21 recent purchases, 82 views (previously 23 purchases / 79 views).
- Modern Office Kit - Pkg of 43: 11 recent purchases, 45 views (previously 2 purchases / 6 views).

P24 remains the top volume driver (21 purchases). P2 (13 purchases) and P29 (11 purchases) have shown significant recent growth in interest and sales, outperforming previous secondary products. I am launching a new recommendation campaign to focus on these high-performing items to optimize discovery. No coupon is required.

### Day 83 02:00 — publish — VALIDATED

- Evidence through day 80: 100 purchases in the latest seven days vs 89 before; 213 previously purchasing shoppers inactive for 7+ days.
- Choice: launch / recommendation; 0% discount; 3 products; retrain false.
- Execution for this review: PUBLISH_PRODUCT_CAMPAIGN (DONE) at day 83
- Metered call cost: $0.001777.

Targets observed at the cutoff:

- JAM Paper Desk Essentials Office Supply Kit: 15 recent purchases, 48 views (previously 3 purchases / 7 views).
- JAM Paper Desk Essentials Office Supply Kit: 21 recent purchases, 82 views (previously 23 purchases / 79 views).
- Modern Office Kit - Pkg of 43: 12 recent purchases, 47 views (previously 2 purchases / 9 views).

P24 remains the top volume driver (21 purchases). P2 (15 purchases) and P29 (12 purchases) have shown significant recent growth in interest and sales, outperforming previous secondary products. I am launching a new recommendation campaign to focus on these high-performing items to optimize discovery. No coupon is required.

### Day 88 03:00 — research — VALIDATED

- Evidence through day 86: 111 purchases in the latest seven days vs 100 before; 203 previously purchasing shoppers inactive for 7+ days.
- Choice: launch / recommendation; 0% discount; 3 products; retrain false.
- Execution for this review: PUBLISH_PRODUCT_CAMPAIGN (DONE) at day 90
- Metered call cost: $0.001781.

Targets observed at the cutoff:

- Computer Desk and Ergonomic Mesh Office Chair Bundle: 6 recent purchases, 14 views (previously 0 purchases / 5 views).
- Home Office Desk: 8 recent purchases, 26 views (previously 0 purchases / 6 views).
- JAM Paper Desk Essentials Office Supply Kit: 38 recent purchases, 98 views (previously 21 purchases / 82 views).

P24 remains the dominant volume driver (38 recent purchases). P18 (8 purchases) and P6 (6 purchases) have shown strong recent growth in sales, outperforming previous secondary products like P2 and P29. I am updating the recommendation campaign to focus on these high-performing items to optimize discovery. No coupon is required.

### Day 90 01:00 — publish — VALIDATED

- Evidence through day 87: 104 purchases in the latest seven days vs 100 before; 204 previously purchasing shoppers inactive for 7+ days.
- Choice: launch / recommendation; 0% discount; 3 products; retrain false.
- Execution for this review: PUBLISH_PRODUCT_CAMPAIGN (DONE) at day 90
- Metered call cost: $0.001769.

Targets observed at the cutoff:

- Computer Desk and Ergonomic Mesh Office Chair Bundle: 6 recent purchases, 17 views (previously 0 purchases / 4 views).
- Home Office Desk: 8 recent purchases, 31 views (previously 0 purchases / 6 views).
- JAM Paper Desk Essentials Office Supply Kit: 40 recent purchases, 102 views (previously 21 purchases / 82 views).

P24 remains the dominant volume driver (40 recent purchases). P18 (8 purchases) and P6 (6 purchases) continue to show strong growth, significantly outperforming other secondary products. I am launching this recommendation campaign to focus on these high-performing items to optimize discovery. No coupon is required.

### Day 95 07:00 — research — VALIDATED

- Evidence through day 93: 83 purchases in the latest seven days vs 111 before; 220 previously purchasing shoppers inactive for 7+ days.
- Choice: launch / recommendation; 0% discount; 3 products; retrain false.
- Execution for this review: PUBLISH_PRODUCT_CAMPAIGN (DONE) at day 97
- Metered call cost: $0.001770.

Targets observed at the cutoff:

- Home Office Desk: 5 recent purchases, 28 views (previously 8 purchases / 26 views).
- JAM Paper Desk Essentials Office Supply Kit: 26 recent purchases, 83 views (previously 38 purchases / 98 views).
- Starter Bundles: 5 recent purchases, 34 views (previously 4 purchases / 26 views).

P24 remains the dominant volume driver (26 recent purchases). P18 (5 purchases) and P27 (5 purchases) are showing consistent performance and growth, outperforming P6. I am updating the recommendation campaign to focus on these high-performing items to optimize discovery. No coupon is required.

### Day 97 09:00 — publish — VALIDATED

- Evidence through day 94: 91 purchases in the latest seven days vs 104 before; 217 previously purchasing shoppers inactive for 7+ days.
- Choice: launch / recommendation; 0% discount; 3 products; retrain false.
- Execution for this review: PUBLISH_PRODUCT_CAMPAIGN (DONE) at day 97
- Metered call cost: $0.001763.

Targets observed at the cutoff:

- Home Office Desk: 5 recent purchases, 23 views (previously 8 purchases / 31 views).
- JAM Paper Desk Essentials Office Supply Kit: 25 recent purchases, 82 views (previously 40 purchases / 102 views).
- Starter Bundles: 4 recent purchases, 28 views (previously 4 purchases / 31 views).

P24 remains the top performer (25 recent purchases). P18 (5 purchases) and P27 (4 purchases) continue to show stable, consistent performance. I am launching this recommendation campaign to maintain focus on these high-performing items for discovery. No coupon is required.

## Days without a model decision

No decision was recorded on days 30, 31, 33, 35, 36, 37, 38, 40, 42, 43, 44, 45, 47, 49, 50, 51, 52, 54, 56, 57, 58, 59, 61, 63, 64, 65, 66, 68, 70, 71, 72, 73, 76, 77, 78, 79, 80, 82, 84, 85, 86, 87, 89, 91, 92, 93, 94, 96, 98, 99, 100. The market continues independently; there is no invented daily rationale.

## Artifacts

- [Complete report and worker log](report.json)
- [LLM decision CSV](decisions.csv)
- [Daily decision counts](daily-decisions.csv)

## Diagnostic run retained

This clean validation is linked to diagnostic run `GARDEN-LIVE-58dfe54bd5e555c9` and uses the same $0.25 budget. The diagnostic had a provider-schema rejection and subsequent proposals blocked because response models failed validation. The fixes make available publication actions depend on model readiness and feed actual execution outcomes back to the LLM. Its records are preserved in [diagnostic-report.json](diagnostic-report.json).
