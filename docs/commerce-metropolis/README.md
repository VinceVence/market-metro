# Shared live-market size ladder

Open the live market's **Run settings → Size**. The shared-market tiers are 96 / 4,800, 192 / 9,600 and 384 / 19,200 merchants and shoppers. Each is one market with shared inventory competition, request allocation and supplier clearing.

These profiles use **one fresh planner + ontology + verifier**. Reviews pause economic time on days 31 and 61. The existing $0.19 model cap applies to each run, inside the shared project budget. The scale validation requests zero native payments.

## What to inspect

1. **Live market** shows the actual population and transaction totals. A storefront selector pages through groups of 32 merchants. The renderer samples shoppers while every shopper participates in the economic engine.
2. **Ontology graph** reads that run's observed checkout and merchant-order relationships. Large exports are verified in complete-checkout batches, with duplicate-key checks across the full export.
3. **Agent workflow** shows the real LLM investigation, chosen features, local model fits, campaign revisions and verification records.
4. **Performance** compares the latest same-seed, same-scenario runs at each size. It plots settled PayPal net gain over fixed rules per 100 shoppers and also shows absolute PayPal net, merchant contribution and purchases. Incomplete runs and prior attempts remain in the history.

## Version and assumptions

`commerce-metropolis-1` is a separate version from the frozen 12-merchant economy. Fee, processing, refund, household funding and supplier timing parameters are retained. Population grows at 50 shoppers per merchant. Merchant cash and initial stock are normalized to that ratio.

Needs are generated deterministically on their date, preserving the same demand distributions and consent rules. Monetary conservation and stock accounting are checked at day boundaries. Transaction operations also validate funds, ownership, stock and idempotency. Household financing is stored as aggregate counters. Merchant payments retain individual records.

Fulfillment considers shared-market stock in deadline-ordered batches of 128 requests, with bounded legal basket alternatives and the existing numerical solver. Both the planner and fixed comparator use this same execution mechanism. Indexed lookup, compressed world checkpoints, incremental warehouse updates and representative rendering keep the live interface bounded.

## Validation boundary

The planner's proposal verifier uses three separate **12-merchant / 600-shopper proxy markets**. It reports those actual trial measurements and binds the accepted policy to the large run. The final profit comparison executes the **entire selected shared market** against the strong fixed policy, with matched generated needs, consent, income and starting state. Proxy approval does not establish positive outcomes at every live size.

All three supported tiers completed through day 126, with twelve fresh model responses and zero unpaid liabilities per successful run.

| Merchants / shoppers | Fixed PayPal net | Planner + ontology net | PayPal gain | Merchant contribution change | Extra retained purchases |
|---|---:|---:|---:|---:|---:|
| 96 / 4,800 | $24,395.05 | $24,418.68 | +$23.63 | −$480.29 | +1 |
| 192 / 9,600 | $49,530.34 | $51,406.77 | +$1,876.43 | +$18,112.09 | +314 |
| 384 / 19,200 | $100,111.95 | $103,422.70 | **+$3,310.75** | **+$36,042.88** | **+532** |

These outcomes are modeled and measured on one seed per size, with fresh planning at each size. PayPal gain per 100 shoppers was $0.49, $19.55 and $17.24 respectively. Larger total gains combine population and policy effects.

At 384 merchants, the LLM's day-31 ontology experiment selected eight features and trained a product-contact model. Its product-recommendation AUC was 0.7620 versus 0.7503 for the broader candidate. The revised intent-assistance campaign passed the proxy verifier and was deployed using the eight-feature model. On day 61, the planner proposed new product-only campaigns, but the verifier retained the existing policy. The full market then settled with the gains above.

The three completed runs used $0.177020 in model inference. Including the interrupted technical attempt, this work used **$0.218706** and the project ledger reached **$7.573648**. The 384-merchant run itself used **$0.059695**. [Actual runs, model choices, checkpoints and comparisons](../../demo/data/metropolis-live-results.json)

The first 96-merchant attempt exposed a missing warehouse helper before any LLM calls. The first 192-merchant attempt stopped at the prior verifier's 20,000-row limit. Both records and their checkpoints are preserved. The larger verifier now checks each complete checkout in a bounded page and validates identities globally, including duplicates across pages and errors on the final page.

## Checks

`node --test tests/metropolis-live.test.mjs` checks real populations through 384 merchants, shared-market purchases, unchanged monetary parameters, targeting parity with the reference planner, checkpoint restoration and large-feed validation. An earlier bounded 1,000-merchant startup probe processed three days with zero model calls. The released live settings are capped at 384 merchants as requested.

Full runs use the normal `/api/market/autonomy/start` entry and its persisted `autoPump` clock. The selected market's result appears through `/api/market/autonomy/scale-results`. No separate scheduler or provider-dispatch service is used.

[Registered size and accounting plan](protocol.json)
