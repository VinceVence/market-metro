# Scale check through 96 merchants

[Open the scale comparison](http://127.0.0.1:4173/judge.html#scale), select **96 merchants · 4,800 shoppers**, and press **Run local ranking**. The simulation settings also link to this comparison.

This deployment contains eight independent districts. Each has 12 merchants, 600 shoppers, its own stock, balances and fulfillment, and the same 16-item product assortment. The existing trained model and campaign serve every district. The economic rules and prior benchmarks remain hash-verified.

| Merchants | Shoppers | Median scoring | p95 | Modeled PayPal gain vs fixed | Extra retained purchases |
|---:|---:|---:|---:|---:|---:|
| 12 | 600 | 13.3 ms | 14.1 ms | $17.20 | 7 |
| 24 | 1,200 | 26.2 ms | 36.5 ms | $143.97 | 20 |
| 48 | 2,400 | 55.6 ms | 57.4 ms | $260.68 | 45 |
| 96 | 4,800 | **86.1 ms** | **109.0 ms** | **$624.95** | **103** |

Scoring times cover 15 warm local passes per size, after day-31 observations are prepared. They exclude world preparation, HTTP, LLM planning and settlement. The 16 full campaigns, two policies on each of eight seeds, took **237.8 seconds** with two local CPU workers. They all settled through day 126 with zero unpaid liabilities.

## Full deployment outcome

| Outcome | Fixed rules | Saved planner | Change |
|---|---:|---:|---:|
| Modeled PayPal net | $24,934.90 | $25,559.85 | **+$624.95** |
| Merchant contribution | $293,514.41 | $299,460.83 | **+$5,946.42** |
| Retained purchases | 4,800 | 4,903 | **+103** |
| Retained sales volume | $679,472 | $693,063 | **+$13,591** |

The planner improved aggregate PayPal net, merchant contribution and retained purchases in each of the eight districts. At the individual merchant level, **51 of 96** earned more. Some merchants lost contribution. PayPal gain per 100 shoppers was **$13.02** at the largest tier. Increasing size changes the seed mix as additional districts join.

## Scope and accounting

- The test used seeds 92471001–92471008 in registered order. Each size pools the first one, two, four or eight districts. These are separate scale-test markets from the single judge example.
- The first four districts reproduced the previous full-inventory scale results exactly. The last four extended the comparison with additional seeds. No seeds were replaced after scoring.
- Each matched pair had identical opening state, needs, consent and income. The fixed and saved policies had the same inventory visibility.
- The saved model generated 173 product recommendations and 115 general inquiries in the largest day-31 batch. Repeated batches returned identical action hashes.
- The original $0.032325 planning cost is charged once per reported deployment. This execution used **zero new LLM calls and zero native PayPal payments**.
- This measures serving a saved policy across independent markets. New LLM planning, retraining, shared inventory across districts and one unified 4,800-shopper market have separate performance characteristics.

Run `node scripts/commerce-expanded/harness-v2/capacity.mjs --run` to reproduce the comparison. Completed local district results are checked against the registration before reuse.

[Predeclared protocol](protocol.json) · [Source registration](registration.json) · [Every measured district and tier](../../demo/data/merchant-capacity.json)
