# Merchant scale

[Open the scale demo](http://127.0.0.1:4173/judge.html#scale) and press **Run local ranking**. The server executes the same trained model used in the judge campaign on the saved day-31 observations. Four districts with all feeds enabled produced 91 product recommendations and 53 shopping-needs inquiries for a population of 2,400. The button previews actions. The settlement table comes from the completed experiment.

## What happens when more sellers share inventory?

We held the same four districts and 2,400 shoppers fixed. Each district had 12 trading stores and 16 products throughout. Enrolling four, eight or twelve stores per district gave the outreach policy current stock and inbound information from one, two or three sellers per product category. The other stores could continue selling and fulfilling orders. Which stores enrolled first rotated across seeds and categories.

| Participating inventory feeds | Visible stock listings | Participating sellers fulfilling a kept recommendation | Kept baskets containing the recommended product | All retained purchases | Modeled PayPal net after AI |
|---:|---:|---:|---:|---:|---:|
| 16 | 64 | 12 of 16 | 250 | 2,419 | $12,703.22 |
| 32 | 128 | 26 of 32 | 481 | 2,436 | $12,805.53 |
| 48 | 192 | 36 of 48 | 631 | 2,443 | $12,855.58 |

With 16 to 48 feeds, the planner reached three times as many participating sellers. The 381 additional baskets containing a recommended product corresponded to **24 additional retained purchases overall**, **$152.36 more modeled PayPal net** and **$950.88 more aggregate merchant contribution**. Enrollment changes which products the campaign can confidently recommend and which purchases get attributed to those recommendations. A recommendation-attributed basket can displace another purchase.

Strong fixed rules benefited substantially from better stock visibility as well. At 48 feeds they generated 761 exact-product purchases from 7,100 product recommendations (10.7%). The planner generated 631 from 4,620 (13.7%) and could also ask shoppers what they needed. On all purchases, the planner finished **45 retained purchases, $260.68 in modeled PayPal net and $2,407.45 in merchant contribution ahead of fixed rules**. It improved all three aggregate outcomes in each of the four full-feed districts. Across individual merchants, 24 of 48 earned more under the planner.

## What happens when the same model serves more districts?

The deployment test adds independent 12-store districts in registered order, with separate stock, shoppers, consent and balances. The server scores them sequentially in one request. Each district carries the same product assortment. Both controls use the frozen inventory, fulfillment and payment rules.

| Stores with full feeds | Shoppers | Day-31 product recommendations / inquiries | Median local scoring time | p95 | Modeled PayPal gain vs fixed per 100 shoppers |
|---:|---:|---:|---:|---:|---:|
| 12 | 600 | 14 / 22 | 12.1 ms | 12.8 ms | +$2.87 |
| 24 | 1,200 | 40 / 32 | 23.7 ms | 24.2 ms | +$12.00 |
| 48 | 2,400 | 91 / 53 | 36.0 ms | 40.6 ms | +$10.86 |

Timing covers 15 warm local scoring passes per size. The first load, network transport, language-model planning and payment settlement have separate costs and latency. The original judge plan cost $0.032325 in metered model usage. We charge it once per deployment. This evaluation made zero additional model or PayPal calls. The $96 judge receipt remains the native Sandbox integration evidence.

## Reproduce

With the Python environment from the [project setup](../../README.md), run `node scripts/commerce-expanded/harness-v2/benchmark-merchant-scale.mjs --run`. This saves an independent report under `.local/merchant-scale/`. Use `--prepare` to rebuild the compact scoring inputs from the observed markets and hash-verified original model. The judge button uses the bundled inputs and needs only the normal Node setup.

All 24 market runs settled. Within each seed we verified identical opening state, underlying needs, consent and income across both policies and all three feed sizes. The selected campaign, training artifact and simulated economy stayed frozen. Reusing the saved campaign isolates the feed and deployment changes. The measured throughput and economics apply to these four independent synthetic reactivation markets.

[Predeclared protocol](protocol.json) · [All runs, matched controls and timing observations](../../demo/data/merchant-scale.json)
