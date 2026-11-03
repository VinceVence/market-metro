# Autonomous commerce team

The user explicitly confirmed the completion target: demonstrate an autonomous team that learns from the frozen economy, trains and revises models, and makes useful commerce decisions without a human choosing the campaign. Improvement over strong fixed rules matters;2x is a stretch target, not a prerequisite to implementing or demonstrating the workflow. Historical failures and the earlier2x scorecard remain intact.

## Concrete controller gaps

1. The fixed outreach rule ranks recent interest with a small search bonus and stock availability. The pooled learned alternative only groups responses by contact kind and signal age. Neither learns the full association between search/browse intent, prior purchases, product category, signal age, stock and a retained purchase.
2. The current agent interface largely selects existing settings. It cannot conduct a model-training experiment and inspect that experiment's measured result before deciding what to deploy.
3. Model refresh and review happen on a preset schedule. The system does not distinguish poor response predictions, stale product interest, supply failure and a payment/settlement problem before choosing a remedy.

## Agent responsibilities

| Component | Decision | Trusted tools and recorded output |
|---|---|---|
| Market analyst agent | Which change or underperforming cohort needs investigation; whether evidence is sufficient to act | Read aggregate observations, compare recent/mature windows, inspect recommendation and fulfillment failures; evidence snapshot and cited findings |
| ML scientist agent | Whether to retain, retrain or replace the response/ranking model; model family and observation window | Fit small local models, validate on past data or separate training episodes, inspect calibration and ranking; versioned model artifact, cutoff, metrics and runtime |
| Commerce agent | Which eligible shoppers/products to target, contact intensity, and whether to keep/change/stop a campaign | Score product alternatives, estimate retained payment contribution after outreach/discount costs, inspect stock and deadlines; typed campaign policy |
| PayPal execution tools | Execute the bounded, validated commerce instructions | Existing-funds authorization, order/capture references, funded supplier settlement, delivery/refund reconciliation, optional selected Sandbox mirror |
| Coordinator and verifier | Schedule jobs, preserve checkpoints, reject invalid/stale actions, deploy or retain the last valid policy | Deterministic orchestration, idempotency, consent, budget, stock and merchant margin checks; durable handoff records |

These are application-agent roles. Development remains solo. Local training, per-customer scoring and accounting do not need an LLM call. Agents choose and revise the workflow; ordinary software executes expensive/repetitive numerical work.

## End-to-end run

1. Customers continue shopping. The current valid policy remains active while analysis/training runs.
2. A review consumes an immutable past-only snapshot. Each role records what it observed, its decision and the tool/model artifact handed to the next role.
3. The analyst identifies a specific gap, such as low conversion among recent product searches despite available stock.
4. The scientist trains a small candidate response model using completed observations. The same training/evaluation tools remain available to numerical controls. Better validation is evidence to try a model, not proof of profit.
5. The commerce agent constructs a recommendation/reactivation policy using predicted retained purchases, net payment contribution, inventory and consent. The frozen growth economy has recommendations and general inquiries; no new coupon response rule is invented.
6. Trusted checks publish a bounded campaign automatically. The market keeps trading; the trained model scores shoppers locally.
7. Outcomes distinguish no response, unfunded request, stock/deadline failure, delivery and refund. These become the next review's evidence. Retraining and rollback follow observed evidence, not a requirement to make every role change something.

## PayPal is part of the commerce loop

- A recommendation has no revenue value until a shopper's existing funds support an authorized purchase and a valid capture. The order, payment and delivery share identifiers.
- Supplier settlement can affect when replenishment arrives. The team can evaluate whether modeled PayPal speed justifies its fee for a particular deadline; choosing PayPal for every invoice is not automatically beneficial.
- Refunds, fees, processing expense and outreach cost reduce the measured contribution. Pending liabilities cannot be reported as settled success.
- The existing saved Sandbox buyer can mirror an eligible demo order through the real PayPal Sandbox adapter and link its receipt to the warehouse. A mirrored receipt is not an additional sale. New native calls remain disabled in benchmark runs.
- Judges should see shopper interest → agent/model decision → funded order → fulfillment → payment/receipt → outcome feedback. PayPal volume, completed payments, modeled net contribution and merchant outcomes are displayed separately from model accuracy.

## Evaluation

Preserve the engine, catalogue, fees, consent and exogenous draws. Compare no outreach, the existing strong fixed controller, a fixed workflow using the same new ML tool, and the autonomous team on identical seeds. A single-agent ablation is useful once the end-to-end team works; it must not delay the first working demonstration.

Report retained/recommendation purchases, payment volume, modeled platform net after inference cost, merchant/supplier contribution, inventory/cash effects, model quality, successful handoffs, interventions/rollbacks, latency and actual metered model usage. Existing point estimates are not promised gains. Development runs are labeled separately from held-out evidence. No production PayPal ROI claim follows from synthetic outcomes.

## First implementation slice

Enrich the observed training records with intent/context features that the old pooled model discarded. Fit and export inexpensive local response models with whole-market validation. Then expose train/evaluate/publish tools to the three agent roles and connect their checkpoints to the existing office UI. Start with one bounded autonomous demonstration; broaden the comparison only after the full path works.

Keep the approved UI, private repository, original benchmarks, no development subagents, no APAC changes and existing model-spend controls. The user clarified the objective; no simulation behavior change is authorized by this document.
