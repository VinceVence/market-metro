# Fresh LLM decisions with and without ontology

This comparison uses the original judge market, seed 92111706, with 12 merchants and 600 shoppers. Both planners receive the same observations through day 30. They make six fresh Gemini decisions, train two local models, test campaigns in three development markets and let the same financial verifier choose a publication. Each campaign then runs through day 126 settlement. [Open the comparison](http://127.0.0.1:4173/judge.html#livecampaign)

| Policy | Decisions available |
|---|---|
| Fixed rules | The existing fixed campaign, replenishment and fulfillment policy |
| Planner | Investigate demand, choose a historical window and feature recipe, fit two models, select a model, propose a campaign, inspect trial results and optionally revise |
| Planner with ontology | The same sequence, with an explicit product-contact training target and a list of features chosen by the LLM from reviewed pre-contact relationships |

The ontology validates feature names, observation timing and the entities each field describes. The agent must include shopper history and prior product interest. Current-contact responses, authorization outcomes and refunds supply labels or evaluation data. The training tool fits exactly the requested features. General shopping-needs inquiries use the existing separate response and value model.

Training uses mature outcomes from prior simulated markets. Current observations inform the business question and campaign. The financial verifier evaluates separate development worlds before the full market runs. The publication binds a specific model and campaign. Days resume after this review, with local predictions and fulfillment decisions throughout the remaining campaign.

Both planners use Gemini 3.1 Flash-Lite for the first five decisions and Gemini 3.1 Pro for the final review. Each has a $0.19 cap, for a combined $0.38 maximum inside the existing project ledger. The report includes token-based cost estimates and subtracts each planner's inference cost from its modeled PayPal net. This execution requests no native PayPal payments.

The source fingerprints, economic rules, seed and comparison were registered before inference. This is one demonstration on the existing judge seed. The two planners can choose different campaigns, so their net difference combines data selection, model selection and campaign choices. The earlier matched-feature study supplies the more controlled feature comparison. [Registration](registration.json) · [Prior feature comparison](../training/README.md)

## Settled results

| Policy | Modeled PayPal net after AI | Merchant contribution | Retained purchases | Inference cost estimate |
|---|---:|---:|---:|---:|
| Fixed rules | $3,309.83 | $38,928.95 | 627 | $0.000000 |
| Fresh planner | $3,391.08 | $39,494.31 | 642 | $0.034568 |
| Fresh planner with ontology | $3,424.78 | $39,953.81 | 643 | $0.042875 |

The ontology-assisted workflow added **$33.70 in modeled PayPal net, $459.50 in merchant contribution and one retained purchase** over the fresh planner. Both beat fixed rules in this scenario. The project ledger finished at **$7.354942**, including **$0.077443** for these 12 fresh model responses. All three policies settled their liabilities. [Complete decisions and daily activity](../../../demo/data/ontology-live-campaign.json)

Both planners chose 28-day training windows. The plain planner trained a forest on shopper-intent features and a two-stage response model on the original features. It proposed intent assistance and increased its contact ceiling from 6 to 10 per 100 after a positive trial. The verifier switched its preferred forest to the two-stage model after comparing financial outcomes.

The ontology planner requested eight fields. They were age of product interest, category affinity, shopper recency, prior purchases, price, stock, prior response rate and prior mature-retention rate. The tool fitted those fields on 1,230 product contacts. Its recommendation ROC AUC was **0.7311**, below **0.7668** for the broader boosted model. Gemini chose the broader model. The verifier also found that the smaller model reduced merchant contribution, volume and cash relative to the chosen campaign.

The ontology planner initially proposed ranked discovery with a 10-per-100 contact ceiling and different supply settings. Its stress test lost money. The LLM restored the current supply settings and reduced the ceiling to 6 per 100. That revision passed. The final campaign used the broader 20-field model, so this run demonstrates a successful campaign workflow and rejection of a weaker feature experiment. Improvement from deploying the LLM's eight selected features remains unproven.

The runner saves the complete local checkpoints and settled traces under the study ID. A rerun reuses completed paid reviews and verifies their fingerprints. Interrupted reviews retain their evidence for diagnosis. The public comparison includes the actual tool choices, supplied evidence, model reports, daily activity, shopper examples and financial results.

```sh
node scripts/ontology/live-campaign.mjs --run
```
