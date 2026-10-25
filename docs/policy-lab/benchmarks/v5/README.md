# Campaign controller v5

The preregistered economic requirements were not all met. This version is not promoted.

Gemini 3.1 Flash-Lite made fresh campaign choices from observed market data at days 30, 55 and 80. It selected among fourteen executable recipes, including no outreach, authored targeting rules and a real local ridge model. Typed code validated the choice and published it one simulated day later. No generated SQL or native PayPal payments were used.

## Completed evidence

- 80 markets: 16 independent seeds across five authored conditions.
- 240 model requests; 99 changed choices; 1 failed reviews.
- Platform difference versus no outreach: **$0.849429 per market**, 95% seed-cluster interval $-1.562172 to $3.093966.
- Difference versus the development-selected comparator (riskContextual): $0.849429, interval $-1.562172 to $3.093966.
- Revision effect versus repeating the first choice: **$-0.323384**, interval $-1.729720 to $1.115099.
- Mean merchant contribution difference: $108.643125, interval $72.301537 to $144.464019.
- This batch cost $0.765655; complete v5 suite $0.878059; cumulative recorded provider-token estimate $2.028336. These are not cloud billing invoices.

| Policy | Mean platform difference vs no outreach | 95% interval | Mean merchant difference |
| --- | ---: | --- | ---: |
| organic | $0.000000 | $0.000000 to $0.000000 | $0.000000 |
| static | $1.029250 | $-2.574950 to $4.306519 | $135.486375 |
| riskStatic | $0.000000 | $0.000000 to $0.000000 | $0.000000 |
| contextual | $1.076625 | $-2.152978 to $3.953356 | $108.408125 |
| riskContextual | $0.000000 | $0.000000 to $0.000000 | $0.000000 |
| original | $-10.378500 | $-13.586847 to $-6.907875 | $32.503375 |
| llm | $0.849429 | $-1.562172 to $3.093966 | $108.643125 |
| firstChoice | $1.172813 | $-1.213057 to $3.600529 | $121.050125 |

| Predeclared check | Result |
| --- | --- |
| positiveModeledValue | NOT PROVEN |
| beatsStrongCode | NOT PROVEN |
| beatsEveryCode | NOT PROVEN |
| revisionsAddValue | NOT PROVEN |
| merchantNonnegative | PASS |
| accountingAndAuthority | PASS |
| validDecisions | NOT PROVEN |

## What is frozen and shared

The original simulator, catalog, accounting and baseline sources remain hash-locked. All policies start from the same seeded state and exogenous draws. A separate no-outreach monitor supplies identical current/past observations. The planner sees no current scenario label, private shopper traits, candidate-branch outcomes or future evaluation. Candidate development profiles, authority and publication delay are shared with code controls. The unchanged original-rule comparator remains as a legacy reference; the stronger static/contextual controls use the same candidate library as Gemini.

The full seed grid and every failed/negative case are retained. Validation uses seeds 96001–96016; confirmation reserves 97001–97016 and runs only after validation passes. Selected development maxima are not reported as held-out wins. Confidence intervals resample seeds, with all five conditions kept together.

## Boundaries

This measures **modeled platform contribution**, not actual PayPal profit: retained modeled fees minus processing, outreach, incentive funding and inference. Each case has 100 shoppers, 100 shopping days and a modeled 14-day return-observation tail; the economic comparison covers the last 70 shopping days. Behavior, fees, stock and returns are assumptions. Channel3 contributes cached product listings, not customer data. Local compute and labor are unpriced.

The shared-monitor design isolates data-dependent selection. It does not test learning from the agent’s own treatment outcomes, and it does not establish multi-agent superiority. There is one marketing LLM role; analysis, local model training, contract checks and evaluation are code. The separate live-app PayPal operations planner and sandbox receipt linkage are documented in [the architecture guide](../../../architecture-planes/README.md).

## Reproduce and inspect

Open [the local replay](http://127.0.0.1:4173/campaign-controller.html). Playback incurs no model charges.

- [Frozen protocol](protocol.json) and [all outcomes](validation-result.json).
- [Independent integrity verification](verification.json) and [browser checks](ui-validation.json).
- [Candidate development profiles](priors.json) and [pooled local model](pooled-model.json).
- Per-case review checkpoints and provider request records are under `validation/`.
- Three figures are under `docs/figures/campaign-controller/`: paired comparisons, every seed/condition, and the revision ablation.

Run `node scripts/campaign-controller/verify.mjs validation` for a no-call replay. Run `node scripts/campaign-controller/benchmark.mjs --validate` only to resume the same frozen batch; completed records are reused and uncertain paid requests require inspection. A failed version must remain failed; a changed controller requires a new protocol and new evaluation seeds.

## Accounted cost and provider failures

The batch total includes $0.735655 in metered-token estimates and $0.030000 in conservative reservations for 1 request(s) with unknown usage. These failed requests remain failed; they were not retried or dropped. The lifetime ledger includes $0.060000 of such reservations. Actual billed cost is not established.

## Explanation quality

A qualitative audit of the first predeclared seed found 5 issues across 15 review records: overstated store coverage, an alternative identical to the selected choice, and an unsupported risk comparison. Structural validation does not establish sound reasoning. [Read the exact records and findings](explanation-audit.json). This sample is not a complete accuracy estimate, and it does not alter the frozen financial outcomes.
