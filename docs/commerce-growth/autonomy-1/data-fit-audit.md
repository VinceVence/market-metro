# Why the models do not translate cleanly into commerce gains

This audit responds to the user's clarification that the primary demonstration is an autonomous commerce/data-science team. The separate economic scorecard remains visible; a completed workflow is not proof of universal profitability. No economy, baseline, recorded outcome or cloud setting was changed for this audit. No paid call was made.

## What the current data can support

The seven development seeds produced7,010 pre-contact observations and457 retained-purchase labels. Logistic and forest models were fitted locally with whole-market folds. The forest's validation AUC is0.672922, versus0.534663 for the coarse predictor; log loss is0.221257 versus0.240712. These measurements show useful conditional intent prediction in the synthetic data. They are model-selection evidence, not final causal campaign lift or production performance.

The fresh seven-market comparison completed42 actual Gemini decisions,10 local fits and14 automated publications. In the reactivation case, the scientist changed the model recipe at raw day61 (display day62), selected a28-day historical window and trained on2,791 rows including29 matured outcomes from its own campaign. The commerce manager published the result. Autonomy is observable in the checkpoint records; it does not depend on a2x financial claim.

## The task/data mismatch

1. **The environment has weak persistent taste structure.** `requestFor()` in `scripts/commerce-growth/kernel.mjs` draws a category and preferred product from seed/day/person/line keys. It does not maintain a persistent customer preference vector that generates repeated choices. There are market-level cycles in `concentrated_needs`, and stable income/wallet differences can affect observed purchases, so the data is not devoid of predictive structure. But a long-term personalized-taste recommender has little of its intended mechanism to learn.
2. **Campaign response is primarily a market-level mechanism.** `contactCustomer()` in `scripts/commerce-growth/environment.mjs` first checks whether an existing dormant need matches the action, then compares a pre-generated draw with the regime's response probability multiplied by the inquiry/recommendation factor. Actions matter through matching, timing, funding and inventory. Individual discount sensitivity, message preference, brand affinity and learned recommendation-score response are not part of this frozen scenario.
3. **The training label differs from the business target.** `train.py` predicts whether a contacted shopper eventually has a retained order. The optional value head predicts retail payment contribution. Neither label directly measures the change in total merchant contribution, supplier settlements, holding costs or displaced future purchases caused by that contact. A better purchase predictor therefore need not improve the entire economy.
4. **The reference is already competent.** Strong fixed rules use recent specific intent, availability, rolling demand estimates and joint numerical basket allocation. A small predictive model does not automatically create a large advantage over this reference.
5. **New-market adaptation is diluted.** Retraining appends tens of mature own-market labels to thousands of historical rows. The inquiry posterior does adapt locally, but the recommendation classifier does not currently have an explicit market-response calibration layer. A training call is not itself proof of adapting effectively to that market.
6. **Some generated explanations are too confident.** Logged rationales sometimes call a policy optimal or compare funded-response rates with retained-purchase rates from different cohorts. Those statements are preserved as model outputs. Only the separately computed validation and settled-accounting results should be treated as measured evidence.

## Interpretation and next authorized work

For the frozen economy, describe the ML component as **observed-intent and conversion modeling**, not a validated personalized-taste recommender. Show the analyst's evidence, scientist's model/window/routing choice, actual fit and validation, manager's campaign publication, shopper outcome and payment record as separate checkpoints.

Keep two scorecards: operational/model quality, and settled business outcomes. Do not use workflow completion or AUC to overwrite the failed retailer/cash guards in validation-1. PayPal's modeled contribution improved0.32% in that study while aggregate retailer contribution fell$10.67 per market; no production profit is demonstrated.

The next compatible modeling experiment is local response calibration using only already observed contact/funding outcomes, checked on development data before any paid trial. It should measure prediction calibration and business effects separately, preserve all negative cases and avoid adding LLM roles solely to increase apparent complexity.

A richer recommendation task would require a **separately versioned, explicitly approved** scenario with persistent customer preferences, product attributes, heterogeneous response and temporal changes. That would be a new task definition with all baselines rebuilt, not a repair to the frozen score. No such change is authorized or made by this audit.

Evidence: [model report](training/model-report.json), [fresh comparison](validation-1/results.json), [reactivation checkpoints](validation-1/C2-team/checkpoints.json), [independent audit](validation-1/audit.json).
