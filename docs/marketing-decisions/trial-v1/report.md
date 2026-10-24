# Market Metro: first marketing decision trial

**DO NOT ADD PAID LLM CALLS: the pilot did not clear the predefined gate.**

The assistant reviewed the same frozen evidence packets as a rules-and-ML optimizer. Decisions were sealed before future replays. This is a developer-assisted, open-simulator trial, not a blinded or held-out agent benchmark. The author knew the simulator and baseline code. No adaptive evidence collection or multi-agent orchestration was tested.

Each of 12 independent checkpoints changes one merchant campaign for seven days. Each action uses 16 paired future tapes. Table amounts sum case means, not all Monte Carlo repeats. All payments and fees below are simulated.

| Metric | Strong rules + ML | Assistant in this chat |
| --- | ---: | ---: |
| Reviewed merchant contribution, before operating cost | $5330.40 | $5329.95 |
| Assumed operating cost | $0.0016 | $1.2016 |
| Total economic costs after discounted sales (COGS, fulfillment, refunds, fees, outreach, operation) | $14737.27 | $14736.79 |
| Redeemed discounts, already reflected in sales | $106.20 | $105.96 |
| Reviewed merchant net after assumed operating cost | $5330.40 | $5328.75 |
| Material harmful decisions versus keeping the campaign | 1 | 1 |
| Executed guard violations | 0 | 0 |
| Human review escalations | 0 | 0 |
| All-merchant contribution, including spillovers | $50063.10 | $50067.93 |
| Reviewed merchant completed payment volume | $20067.67 | $20065.54 |
| Modeled payment fees, not PayPal profit | $1002.28 | $1002.17 |

Assistant minus rules: **$-1.65** (-0.03%). The descriptive paired case-mean 95% bootstrap interval is $-0.21 to $-0.10 per reviewed case.

## Cost and accounting assumptions

New paid API spend was $0. Current-chat account costs/token usage and electricity are not metered; the assistant is not claimed to be free. The headline modeled total uses $0.10 per chat-reviewed case, $0.10/hour for measured shared fitting/decision runtime, and five human minutes at $30/hour for each escalation. Shared model fitting is charged equally. Replay/evaluation time is reported separately and excluded from deployment cost. Cost sensitivity follows.

| Assumed chat cost per case | Assistant net advantage over rules |
| --- | ---: |
| $0.00 | $-0.45 |
| $0.01 | $-0.57 |
| $0.10 | $-1.65 |
| $1.00 | $-12.45 |
| $5.00 | $-60.45 |

Merchant contribution = discounted sales − refunds − product costs − fulfillment − modeled payment fees − outreach. Redeemed discounts are already reflected in sales and are not deducted twice. All seven-day sale-cohort refunds, including pending returns, are settled in evaluation. This is not a retention study or production ROI.

## Decisions and mistakes

A material harmful decision loses more than $5 mean merchant contribution versus KEEP_CURRENT, with a paired-replay interval entirely below zero. This is an outcome diagnostic, not a claim that a stochastic loss proves bad reasoning. Hindsight gaps compare all allowed actions on the same future tapes and are optimistic diagnostics, never evidence available to a controller.

| Case | Rules | Chat | Chat minus rules, net | Harmful: rules / chat | Hindsight gap: rules / chat |
| --- | --- | --- | ---: | --- | ---: |
| MD-01 | OFFER_10 | KEEP_CURRENT | $-0.10 | no / no | $28.04 / $28.04 |
| MD-02 | USE_RECENT_MODEL | USE_RECENT_MODEL | $-0.10 | yes / yes | $26.75 / $26.75 |
| MD-03 | KEEP_CURRENT | KEEP_CURRENT | $-0.10 | no / no | $0.65 / $0.65 |
| MD-04 | KEEP_CURRENT | KEEP_CURRENT | $-0.10 | no / no | $3.35 / $3.35 |
| MD-05 | KEEP_CURRENT | KEEP_CURRENT | $-0.10 | no / no | $0.00 / $0.00 |
| MD-06 | PAUSE_OFFERS | PAUSE_OFFERS | $-0.10 | no / no | $0.00 / $0.00 |
| MD-07 | KEEP_CURRENT | KEEP_CURRENT | $-0.10 | no / no | $3.61 / $3.61 |
| MD-08 | KEEP_CURRENT | USE_RECENT_MODEL | $-0.53 | no / no | $1.12 / $1.54 |
| MD-09 | USE_RECENT_MODEL | USE_RECENT_MODEL | $-0.10 | no / no | $2.86 / $2.86 |
| MD-10 | KEEP_CURRENT | KEEP_CURRENT | $-0.10 | no / no | $0.00 / $0.00 |
| MD-11 | USE_RECENT_MODEL | KEEP_CURRENT | $-0.12 | no / no | $0.56 / $0.58 |
| MD-12 | PAUSE_OFFERS | PAUSE_OFFERS | $-0.10 | no / no | $0.00 / $0.00 |

## Case explanations

### MD-01 — Willow Goods

Observed family (revealed after submission): steady.

Rules: Shared model forecast estimates 176 cents improvement over keep; it clears the $1 inertia threshold. Execution retains stock, contact, holdout, margin and budget checks.

Assistant: Orders rose from 51 to 56 and payment records reconcile. The qualified recent model only adds $1.76 in the static forecast, which omits contact dynamics and shared-budget effects. With no evidence of campaign deterioration, retain the current policy for this seven-day window rather than force 10% offers or make a marginal model change. This is a conservative judgment, not proof that the new model would lose.

Seven-day merchant contribution: rules $550.78, assistant $550.78. Best action in hindsight: USE_RECENT_MODEL.

### MD-02 — Sunroom Market

Observed family (revealed after submission): rival_sale.

Rules: Shared model forecast estimates 5839 cents improvement over keep; it clears the $1 inertia threshold. Execution retains stock, contact, holdout, margin and budget checks.

Assistant: The observed rival-promotion feature appears throughout the latest complete week and purchases fell from 46 to 33. The tree passed temporal validation and its shared forecast improves contribution by $58.39, more than blanket 10% offers. Use the qualified candidate while retaining all contact, margin and budget guards. Its prediction improvement is supporting evidence, not a guarantee of campaign lift.

Seven-day merchant contribution: rules $420.56, assistant $420.56. Best action in hindsight: KEEP_CURRENT.

### MD-03 — The Desk Shop

Observed family (revealed after submission): budget_squeeze.

Rules: Keep the current campaign unless an allowed alternative has positive modeled incremental contribution.

Assistant: The recent candidate did not pass the shared validation threshold. Keep has the highest permitted forecast. A 10% offer fails the tote margin floor and the other blanket-offer choices also reduce estimated contribution. The sales decline alone does not justify a broader coupon policy.

Seven-day merchant contribution: rules $310.70, assistant $310.70. Best action in hindsight: OFFER_5.

### MD-04 — Oak & Ink

Observed family (revealed after submission): supply_delay.

Rules: Keep the current campaign unless an allowed alternative has positive modeled incremental contribution.

Assistant: Payment records are complete, current stock is positive, and the candidate failed the promotion gate. Keep leads the available contribution estimates; a blanket 10% offer adds contacts and slightly reduces estimated value. The recent sales fall is insufficient evidence to override the model or pause organic demand.

Seven-day merchant contribution: rules $899.07, assistant $899.07. Best action in hindsight: OFFER_5.

### MD-05 — River General

Observed family (revealed after submission): delayed_outcomes.

Rules: Keep the current campaign unless an allowed alternative has positive modeled incremental contribution.

Assistant: Fourteen captures await delayed labels, but payment totals reconcile and completed sales increased. Do not treat the missing labels as failed purchases. The recent model was rejected and no permitted alternative beats keep in the shared forecast. Preserve the product-specific margin safeguards instead of expanding coupons while labels catch up.

Seven-day merchant contribution: rules $592.44, assistant $592.44. Best action in hindsight: KEEP_CURRENT.

### MD-06 — Clover Trading

Observed family (revealed after submission): margin_compression.

Rules: Every product is below the coupon margin floor; preserve organic purchases and stop proposing discounts.

Assistant: Every product falls below the 20% margin floor even at a 5% discount. Pause coupon proposals and preserve organic purchases. A better predictive model cannot repair these unit economics. The executor already blocks these offers, so I expect little or no financial advantage over simply keeping the guarded policy.

Seven-day merchant contribution: rules $102.77, assistant $102.77. Best action in hindsight: KEEP_CURRENT.

### MD-07 — Corner Supply

Observed family (revealed after submission): steady.

Rules: Keep the current campaign unless an allowed alternative has positive modeled incremental contribution.

Assistant: Sales are stable, the candidate is worse than the champion, and keep leads every permitted forecast. Two products cannot support 10% offers; only 32 randomized-history observations received 10%, so that conversion rate is weak evidence for a broader campaign. Retain the targeted policy.

Seven-day merchant contribution: rules $343.88, assistant $343.88. Best action in hindsight: OFFER_5.

### MD-08 — Juniper House

Observed family (revealed after submission): rival_sale.

Rules: Keep the current campaign unless an allowed alternative has positive modeled incremental contribution.

Assistant: Sales fell from 51 to 26 with an observed rival promotion and complete labels. The recent model passed validation. Its retrospective coupon choices tie the current forecast, but updated response scores can change priority under the shared budget as future customer states change. Adopt it for the bounded window rather than offer 10% indiscriminately. This is an uncertain judgment about ranking; the packet does not demonstrate incremental profit.

Seven-day merchant contribution: rules $378.35, assistant $377.93. Best action in hindsight: OFFER_5.

### MD-09 — Willow Goods

Observed family (revealed after submission): budget_squeeze.

Rules: Shared model forecast estimates 340 cents improvement over keep; it clears the $1 inertia threshold. Execution retains stock, contact, holdout, margin and budget checks.

Assistant: The validated candidate modestly improves forecast contribution by $3.40 while reducing proposed contacts from 98 to 95. Its more selective allocation fits the uneven product margins; neither blanket 5% nor 10% performs as well in the shared estimates. Use the qualified candidate, acknowledging that the forecast gain is small and not causal proof.

Seven-day merchant contribution: rules $486.70, assistant $486.70. Best action in hindsight: OFFER_10.

### MD-10 — Sunroom Market

Observed family (revealed after submission): supply_delay.

Rules: Keep the current campaign unless an allowed alternative has positive modeled incremental contribution.

Assistant: The candidate failed the common promotion gate. Keep has the highest available estimated contribution; blanket 10% increases contacts while reducing forecast contribution by $14.67. Historical 10% response is encouraging but does not establish that expanding the current targeted campaign helps under current shared-budget conditions.

Seven-day merchant contribution: rules $731.59, assistant $731.59. Best action in hindsight: KEEP_CURRENT.

### MD-11 — The Desk Shop

Observed family (revealed after submission): delayed_outcomes.

Rules: Shared model forecast estimates 131 cents improvement over keep; it clears the $1 inertia threshold. Execution retains stock, contact, holdout, margin and budget checks.

Assistant: Eighteen captures await labels, while the independent payment ledger shows sales rising. The recent model is valid on the completed window, but its $1.31 forecast gain comes with more proposed contacts and incomplete latest outcomes. Retain the current policy for this bounded window; delay is not a payment failure and does not warrant paid human escalation.

Seven-day merchant contribution: rules $470.70, assistant $470.68. Best action in hindsight: OFFER_5.

### MD-12 — Oak & Ink

Observed family (revealed after submission): margin_compression.

Rules: Every product is below the coupon margin floor; preserve organic purchases and stop proposing discounts.

Assistant: All three products fail the 20% coupon margin floor, including at 5%; some discounted orders have negative unit contribution. Pause offers and leave organic purchases possible. Model validation cannot fix the cost problem. The existing execution guard already prevents these discounts, so no material uplift from this decision is assumed.

Seven-day merchant contribution: rules $42.85, assistant $42.85. Best action in hindsight: KEEP_CURRENT.

## Interpretation

The scripts and reviewer shared all observations, forecasts, permitted actions, real locally fitted models and guards. The baseline optimizes predicted contribution with reconciliation, margin, data-freshness and model-validation checks. It is not a weak coupon rule. A failed gate means this trial provides no reason to purchase LLM calls or expand into an agent team. A passed pilot gate still requires independently authored cases and actual model execution to establish an agent advantage.

PayPal relevance is offer-to-completed-payment measurement and merchant sustainability. Sandbox receipts elsewhere in the project validate the connector, not the causal value of these decisions. Channel3 is a catalog integration; this benchmark deliberately uses portable sample products and zero fresh provider calls.
