# Which data should train a product recommendation?

On day 31, the planner can ask the ontology to map a business question to the right training rows, label and features. The verifier then tests the resulting ranking against actual settlements inside the simulator. [Open the interactive training review](http://127.0.0.1:4173/judge.html#training)

| Business question | What the planner can do |
|---|---|
| Who will keep a basket after a product recommendation? | Fit a probability model on contacts that named a product. Use features the planner could observe before contacting the shopper. |
| Who might reply when asked what they need? | Use the existing inquiry model, which learns from prior intent, replies and settled value. |
| Will they keep this exact item? | Hold training. The historical contact export lacks the item IDs in the fulfilled basket. |
| Which campaign earns more? | Run both policies in matching markets and compare settled PayPal and merchant outcomes. |

## From features to a different campaign

The original 28-day training window contained 2,762 mature contacts across seven historical markets. Only 1,230 named a product, and 116 of those led to a retained purchase. The other 1,532 were general needs inquiries. A label must mature for 26 days. Earlier market funding rates can predict a response. A shopper's later authorization or refund can only help measure the outcome.

We fitted the same boosted-tree estimator on four groups of related features and chose the group with the lowest average log loss when leaving out a whole historical market at a time. The selected 12 of 20 inputs cover prior product interest, shopping history and earlier market responses. Price and stock remain inputs to value and fulfillment. We also tried all product fields and an ordinary statistical selector. The statistical selector ranked individual fields inside each training fold and had the same four search budgets. Both selectors chose 12 fields.

On the recorded day-31 snapshot, the new ranking changed four of the 36 available contact slots. For example, it dropped the **Stacking Office Stool** recommendation for **Buyer 585** and opened a shopping-needs inquiry for **Buyer 346**. In a separate local replay of the planner, the verifier actually switched models. Across three development markets, average PayPal gain over fixed rules rose from **$30.97 to $36.36** and average merchant gain from **$346.26 to $411.76**. The six planner tool choices were scripted. Both models were fitted locally, and the verifier computed its publication decision from financial trials. [Replay record](../../../demo/data/ontology-training-review.json)

## Four fresh, frozen markets

The methods and fitted models were committed before drawing the four seeds. Each policy ran through settlement with the same initial shoppers, demand, cash, inventory and contact budget on a given seed. For prediction quality, all models scored exactly the same 4,865 product contacts, of which 679 led to retained baskets. For financial outcomes, each policy made its own outreach choices. The financial totals include the same historical planner cost for every model arm. Fixed rules incur zero model cost.

| Policy | Held-out ROC AUC | Log loss ↓ | Modeled PayPal net | Merchant contribution | Retained purchases |
|---|---:|---:|---:|---:|---:|
| Fixed campaign rules | — | — | $14,703.14 | $175,402.50 | 2,798 |
| Current pooled model | 0.8271 | 0.3236 | $14,968.81 | $178,401.06 | 2,837 |
| Product rows, all eligible fields | 0.8479 | 0.3034 | $15,001.09 | $178,613.04 | 2,845 |
| Product rows, statistical selection | 0.8510 | 0.3019 | $15,019.54 | $178,816.46 | 2,845 |
| Product rows, ontology-guided selection | **0.8524** | **0.3012** | **$15,040.62** | **$178,998.95** | **2,853** |

| Ontology gain over current model | PayPal net | Merchant contribution | Retained purchases |
|---|---:|---:|---:|
| Reactivation · 949236195 | −$11.07 | −$279.69 | +1 |
| Discovery · 370105743 | +$55.49 | +$563.41 | +12 |
| Low response · 832843023 | +$27.19 | +$314.17 | +3 |
| Zero response · 712097669 | +$0.20 | $0.00 | 0 |

Matching training rows to the decision explains much of the prediction improvement. The extra gain over conventional feature selection was **$21.08 for PayPal, $182.49 for merchants and eight retained purchases** across four markets. Discovery drove most of the gain. A hand-authored pipeline could implement the same definitions. The ontology makes them explicit, reusable and testable across business questions.

These financial outcomes measure four simulated markets. The archived $96 PayPal Sandbox receipt belongs to the original judge campaign. This experiment created zero payments and made zero paid model calls. [Registered protocol](protocol.json) · [Sealed source hashes and seeds](holdout.json) · [Full results including average precision, Brier score and per-market choices](../../../demo/data/ontology-training.json)

## Reproduce locally

The interactive review reads the bundled evidence and reranks the original snapshot using Node. The fitting and settlement commands use the project's local Python environment described in the [setup instructions](../../../README.md).

```sh
npm run test:demo
node scripts/ontology/feature-study.mjs --fit
node scripts/ontology/feature-study.mjs --run
node scripts/ontology/replay-training-review.mjs
```
