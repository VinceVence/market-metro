# Can this merchant feed measure purchases?

Once the current market history is certified, the planner can select training data by business question and test which features improve its product rankings. [Training decisions and four-market results](training/README.md)

[Open the verifier](http://127.0.0.1:4173/judge.html#ontology) or select **Why is this one purchase?** in the PayPal receipt chapter. The tool returns **CERTIFY** with the evidence supporting a measurement, or **HOLD** with the missing or conflicting definition. A hold publishes no totals or receipt claim. The tool reads local data and can run in a browser or in Node.

## The recorded case

The ledger covers the full 126-day judge run, including warm-up. At capture, **1,384 shopper checkouts** totaled **$164,451.00**. They produced **1,922 merchant orders** because **538 checkouts split across stores**. The first checkout had portions of $48 and $140. That is one $188 purchase. Captured gross includes subsequently refunded purchases. The original benchmark’s 643 retained purchases have a different period and definition.

Shopper 179’s **$96** checkout had one merchant order. PayPal Sandbox capture `2M324038C71499318` links to that order, with **$3.56** in native fees and **$92.44** in test merchant proceeds. The verifier checks the recorded run, capture status, USD currency, seller, exact order key and amount. It reconciles fee plus proceeds to gross. This confirmation adds **zero purchases and zero gross** to the simulated ledger. It uses the archived, previously verified test receipt. Opening the verifier makes zero model or payment calls.

## How the verifier works

NVIDIA Auto Ontology distinguishes business terms, relationships and certified metric definitions. This implementation applies that pattern locally with a reviewed commerce vocabulary and deterministic checks. The default single-planner workflow requires a certified merchant history before entering its financial review. [NVIDIA’s design at the inspected revision](https://github.com/NVIDIA/auto-ontology/blob/2a24f5d34ef6b6e168a7f22d308504d3ab36a198/README.md#how-it-works)

1. **Bind the terms.** Read the source dictionary’s row grain, column descriptions, currency and units. The physical IDs can be unfamiliar. A normalized export needs one declared merchant-order-to-checkout foreign key. A flat export needs an explicit checkout reference and an independently stated checkout total on every row.
2. **Test the relationships.** Check primary-key uniqueness, parent existence, one seller portion per checkout and consistent parent totals. Convert declared dollar amounts to integer cents exactly. Reconcile every merchant portion to its checkout. Coincidentally identical values cannot resolve two competing joins.
3. **Release the measurement.** Count checkout keys once and sum checkout gross once. A separately supplied trusted Sandbox receipt can corroborate one merchant order. A locally uploaded file is checked in-browser and supplies no provider attestation.

The input is one complete USD capture export for one run. Its reviewed data dictionary and its declaration of completeness are assumptions. Whole checkouts omitted by the source need an independent control total to detect. Mixed currencies, undeclared units, missing links and unsupported grains require clarification. These checks establish accounting consistency within the feed. Campaign lift and production PayPal profit require additional evidence.

For the recorded projection, the checkout-to-order foreign key comes from each actual `autonomy_baskets.legs_json` entry. The exporter cross-checks every referenced warehouse order’s amount, run, merchant and shopper before bundling the ledger. The alternate formats in the UI present those same rows with authored partner schemas. [Source projection](../../scripts/ontology/export-judge.mjs) · [Example merchant feed](http://127.0.0.1:4173/api/market/ontology/feed?example=warehouse)

## Fixed mapping versus semantic binding

Both methods saw identical inputs, including source descriptions and keys, and used the same accounting and receipt checks. The fixed comparator knows the warehouse projection and common partner aliases, accepts reordered columns, and supports a conventional flat export with repeated checkout totals. The ontology verifier can bind unfamiliar physical names using the reviewed business meanings and relationships.

| Result on 24 held-out synthetic exports | Fixed mapping | Ontology verifier |
|---|---:|---:|
| Answerable feeds certified with all four numerical answers exact | 6 / 12 | 12 / 12 |
| Unsafe feeds held | 12 / 12 | 12 / 12 |
| Holds identifying the injected cause | 6 / 12 | 12 / 12 |
| False certifications | 0 | 0 |

The gain was six additional usable feeds. Both methods were correct on familiar exports and safely withheld all unsafe inputs. Fixed mapping often stopped at an unfamiliar header before reaching the actual data defect. The benchmark covers six documented valid layout families and six error families. The concrete merchant IDs, physical names, column/row ordering, amounts and basket compositions were generated from fresh entropy after the methods and generator were committed. The families and vocabulary were designed in advance. External merchant onboarding and open-ended schema discovery remain untested.

Run `node scripts/ontology/benchmark.mjs --run` to reproduce all 24 decisions. Run `node scripts/ontology/benchmark.mjs --file path/to/feed.json` to check your own documented export locally. `npm run test:demo` also checks the real ledger proof, HTTP entry points, error handling and receipt binding. Rebuilding the portable judge ledger requires the populated local warehouse and its existing native receipt, using `node scripts/ontology/export-judge.mjs`.

[Predeclared protocol](protocol.json) · [Frozen source hashes and challenge seed](holdout-lock.json) · [All inputs’ fingerprints, expected answers and decisions](../../demo/data/ontology-study.json)

## How a bad mapping changes a campaign

[Run the interactive decision](http://127.0.0.1:4173/judge.html#planner) or run `node scripts/ontology/planner-demo.mjs` locally. In this counterfactual, the simulated merchant initially declares both `basket_id` and `second_ticket` as the parent checkout key. The values happen to match. Only the merchant's corrected dictionary identifies `basket_id` as authoritative.

| Day-31 decision | Ambiguous export | Corrected mapping |
|---|---|---|
| Admitted history | Withheld | 715 captured checkouts, 976 merchant orders, 261 split checkouts, $67,730.00 captured gross |
| Planner | Held before entering review | Resumed once with the certified checkout history |
| Campaign | Zero publications and contacts | Published ranked discovery using boosted trees |
| Day-31 outreach | 0 | 31 product recommendations and 5 shopping-needs inquiries |

Both paths use seed 92111706 and the same observations through displayed day 30. The correction removes one declared relationship and preserves every column and row. The gate checks the row and market fingerprints and resolves the planner’s purchase history through the certified checkout key. Later purchases, refunds and the day-35 Sandbox example supply no inputs to this review.

The judge path reuses six recorded Gemini decisions and two previously fitted models. It reconstructs the original proposal, its supply-preserved version and its alternative ranking, reruns the real publication checks against sealed development receipts, and executes the normal ranker locally. Judge actions are previews. The full-run financial comparison measures the recorded campaign versus fixed rules; this comparison isolates the mapping’s effect on launch permission.

Live single-planner V2 runs with the financial verifier apply the same gate at both review dates. **New live run → Merchant checkout mapping** selects a standard, renamed, flat or two-link export. During a hold the room preserves its last committed day, records the reason and waits for the exact held review. Applying the confirmed mapping resumes that day under the live run’s existing model budget. Repeated or stale corrections cannot dispatch a second batch. Standard server interruption rules still apply. The judge replay uses the local, provider-free execution path.

[Planner gate](../../scripts/ontology/planner-gate.mjs) · [Recorded decision and replay](../../scripts/ontology/planner-demo.mjs) · [Live room](../../scripts/commerce-growth/autonomy/live.mjs)
