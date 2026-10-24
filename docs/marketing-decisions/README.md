# Marketing decision benchmark

This is a decision-only experiment for Market Metro. One reviewer changes one
merchant campaign for seven simulated days. A strong rules-and-ML controller and
the assistant in the current chat receive the exact same frozen evidence JSON,
forecasts, real locally fitted model candidates, actions and execution guards.
There is no LLM API client, agent swarm, provider checkout or paid cloud fallback.
The market's existing saved-wallet consent and database are not used or modified.

## Run the protocol

Set up the local Python trainer using the root README, then:

```sh
npm run benchmark:marketing -- prepare --run trial-v1
npm run benchmark:marketing -- packets --run trial-v1
# Review the public packets and write decisions.json before evaluating outcomes.
npm run benchmark:marketing -- submit --run trial-v1 --file decisions.json
npm run benchmark:marketing -- score --run trial-v1
```

The first completed trial is in [trial-v1/report.md](trial-v1/report.md).
Its [packets](trial-v1/packets.json), [frozen protocol](trial-v1/manifest.json),
[reviewer recommendations](trial-v1/submission.json),
[submission receipt](trial-v1/submission-receipt.json) and
[full results](trial-v1/results.json) provide the audit trail.

A run name is write-once. `prepare` freezes the source, packets, evaluator state
and baseline recommendations. `submit` validates all cases and seals the
recommendations. `score` refuses changed evidence, changed source, changed
recommendations or an absent submission. Rejected submission attempts are logged.
The rules recommendations and future tapes remain under the ignored
`.local/marketing-decisions/<run>/` until scoring; only the evidence packets are
shown to the reviewer. Keep that directory for exact local replay. A fresh
`prepare` deliberately creates a new randomized suite, not the original trial.

The assistant authored the simulator and baseline, so this is **exploratory and
not blinded** even though predictions are sealed before outcome replays. After
scoring, these cases are development cases. A future generalization claim needs
new independently authored cases; changing seeds alone does not establish it.

## Action interface

Each submission contains `actor: "assistant_in_current_chat"`, the
`packetSetHash` printed by the packet command, and one entry per case:

```json
{
  "schema": "MARKETING_DECISION_V1",
  "caseId": "MD-01",
  "evidenceHash": "copy-the-exact-hash-from-the-case",
  "merchantId": "copy-the-exact-merchant-id",
  "action": "KEEP_CURRENT",
  "evidenceIds": ["quality", "models", "forecasts"],
  "rationale": "Explain the choice using these observations and its uncertainty."
}
```

Actions are `KEEP_CURRENT`, `PAUSE_OFFERS`, `USE_RECENT_MODEL`, `OFFER_5`,
`OFFER_10` and `ESCALATE`. Recent-model adoption is available only after the shared
local validation gate passes. Escalation preserves the current policy and incurs
an assumed human handling cost; it receives no magical human intervention.

The reusable JavaScript interface lives in
[`decision-actions.mjs`](../../scripts/marketing/decision-actions.mjs):

```js
const offerPolicy = makeOfferPolicy(packet, decision, {world, candidate});
const nextDay = advanceLearningDay(world, {offerPolicy});
```

The callback receives observed features, product economics and current scores.
It changes a proposed offer only for the scoped merchant and seven-day window.
It cannot change the objective, extend the budget, contact holdouts, bypass the
contact gap, skip stock checks or override the margin floor. Coupon and score
records retain the actual selected model ID. This first interface is used in
isolated benchmark forks; there is no endpoint that changes an existing live
season or initiates a payment.

## Evidence and comparison

The suite has 12 independently seeded checkpoints: two each covering steady
trading, rival promotions, household budget pressure, supply delays, delayed
outcome labels and margin compression. Each world has 400 customers and eight
merchants. The hidden cause label, seed, customer preferences, future innovations
and expected winner are absent from the controller packet. A visible rival
promotion is represented as an observed feature for both controllers.

Both controllers receive reconciled simulated payment totals, completed outcome
windows, randomized-history arm summaries, current product costs and stock,
shared model-validation results, and identical contribution forecasts. Delayed
labels are excluded from BOTH training inputs rather than interpreted as failed
purchases. The rules baseline can adopt a model trained on that complete window;
it is not artificially forbidden from using the same evidence.

The baseline checks margins and reconciliation, then maximizes the shared
forecasted contribution with a $1 change threshold. Forecasts are explicitly
imperfect: static estimates do not fully represent future budget/stock depletion,
contact changes, cross-merchant effects or causal parameter uncertainty. The
reviewer may disagree but does not get an extra model, private state or extra data.

Each action is executed in the existing seeded economy, with 16 common future
randomness tapes per checkpoint. Past state, holdouts, model artifacts and
merchant economics are identical. Future outcomes legitimately diverge after
different actions. Unaffected merchants retain their current policy; their
outcomes can still change through shared customers/budgets, so portfolio effects
are reported. No new models are fitted inside the seven-day replay.

## Scoring and costs

- Primary outcome: reviewed merchant contribution after assumed operating costs.
- Secondary outcomes: all-merchant contribution, completed payment volume,
  modeled payment fees, coupon discounts, outreach, escalations and guard failures.
- Material harm signal: over $5 mean contribution lost versus KEEP_CURRENT, with
  the paired future-replay interval below zero. This is an outcome diagnostic,
  not an independent annotation of reasoning correctness.
- Hindsight opportunity loss: gap to the best allowed action on the evaluated
  future tapes. This is an optimistic diagnostic and is unavailable to controllers.
- Future tapes are repeated measurements of a case, not 192 independent cases.
  The primary paired bootstrap samples the 12 case means.
- Seven-day sale-cohort refunds are settled, including pending returns. No extra
  sales are generated for refund settlement. There is no 14-day retention claim.

Sales already include redeemed discounts. Contribution subtracts refunds, COGS,
fulfillment, modeled payment fees and outreach without subtracting discounts
again. Fees use the existing 3.49% + $0.49 simulation assumption, not quoted PayPal
rates. The report separates fee revenue from profit.

No new paid API calls occur. Current-chat account cost/token usage and electricity
are unmetered. The default cost model assumes $0.10 per chat-reviewed case,
$0.10 per hour of measured shared fitting/decision runtime, and five minutes at
$30/hour for each escalation. Shared model fitting is charged to both approaches.
A $0/$0.01/$0.10/$1/$5 chat-cost sensitivity table avoids calling this chat free.
Evaluation replay time is measured separately and is not a deployment expense.

The preliminary gate is at least 5% better net contribution, a positive lower
bound on the paired case interval, zero executed guard violations and no decline
in mean all-merchant contribution. Even a pass is only a reason for further
independent validation. Failure is a reason to keep the conventional workflow
and avoid paid LLM integration.
