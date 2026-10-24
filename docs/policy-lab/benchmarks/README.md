# Policy Lab benchmark and improvement goals

[Open the measured benchmark in Market Metro](http://127.0.0.1:4173/?run=GARDEN-LAB-df43cd08499c0c0a&policyLab=GARDEN-LAB-df43cd08499c0c0a&policyView=benchmarks)

The evaluation suite is implemented. Economic superiority and real-world validity are **not demonstrated**. Goal status is computed from the frozen criteria, never from whether a run finished.

## What was evaluated

Version `v1` is a **saved-plan transfer benchmark**: reuse the three plans and publication delays selected in the original Gemini trial, and refit the local contextual bandit using each new market's mature observations. This is not 100 fresh autonomous-agent trials.

- 20 evaluation seeds, each evaluated in five fixed scenarios: steady market, rival sale, budget squeeze, supply delay and return wave.
- 100 paired cases, four branches per case: no campaign, rules with matched publication timing, immediately acting rules, and the saved agent plan with local refits.
- 100 shoppers and three merchants per world. Thirty days of common randomized history, 70 campaign days, and 14 follow-up days for returns.
- Four million shopper-day action records evaluated in memory; 2.8 million post-history outcomes matured. There are **20 seed clusters**, not four million independent statistical observations.
- Same catalog, initial conditions, exogenous draws, learner, action constraints and virtual funding ceiling. Policies can cause different later purchases, inventory and balances.
- No new Gemini calls, PayPal calls, paid compute resources or APAC changes. No native receipt is duplicated into benchmark revenue.

## Measured results

All amounts below are paired differences relative to no campaign, per 100 shoppers over the 70-day campaign. Platform contribution includes an allocated model cost; merchant contribution does not subtract platform-funded marketing twice.

| Policy | Platform contribution | 95% interval | Merchant contribution | Retained volume |
|---|---:|---:|---:|---:|
| Saved agent plan + refits | −$15.80 | −$19.35 to −$11.73 | +$111.42 | +$330.34 |
| Rules, matched timing | −$11.78 | −$14.81 to −$8.13 | +$66.83 | +$293.32 |
| Rules, immediate | −$13.56 | −$16.64 to −$10.08 | +$51.39 | +$267.29 |

The saved plan's mean difference versus matched rules is −$4.02; its interval is approximately −$7.98 to +$0.01. This does not establish superiority or a statistically resolved disadvantage versus matched rules. All three intervention policies have negative mean platform effects relative to no campaign in this simulator.

The saved plan's worst observed case loses $41.43 of platform contribution relative to no campaign. Its average merchant effect is positive, but individual cases can lose merchant value; the aggregate merchant guard is not a per-merchant guarantee.

**Reactivation is saturated:** every shopper classified as lapsed at day30 returns within the remaining 70 days even in the no-campaign branch. Incremental reactivation is zero for every evaluated policy. This exposes a measurement/simulator limitation; it is not evidence that campaigns prevent churn.

## Goals and acceptance criteria

Machine-readable criteria: [protocol](v1/protocol.json). Computed status: [goals](v1/goals.json).

| Goal | Gate | Current status |
|---|---|---|
| Additional platform value | Paired 95% lower bound exceeds $0 versus no campaign | Not demonstrated |
| Value beyond rules | Paired 95% lower bound exceeds $0 versus matched rules | Not demonstrated |
| Merchant economics | Aggregate merchant contribution lower bound at least $0 | Pass in this simulator |
| Downside containment | Worst observed platform loss no worse than $50 | Pass on evaluated cases |
| Execution integrity | No accounting, maturity, budget, stock, contact-gap or eligibility violations | Pass |
| Multi-agent advantage | Fresh team versus single planner on unseen evidence, matched tools and budgets | Not tested |
| Real-world validity | Behavioral calibration against observed data | Not validated |

The $0 statistical boundary and $50 downside threshold are engineering starting points, not PayPal requirements. A practical minimum business gain still needs to be agreed. Simulator financial inputs are assumptions, not actual PayPal rates or profit estimates.

## Measurement contract

Primary economic score:

```
platform contribution = retained-order modeled fees
                      − modeled processing costs on every purchase
                      − platform-funded incentive reimbursements
                      − outreach
net comparison        = policy contribution − control contribution
                      − allocated model API cost
```

The existing simulator credits its modeled fee when an order is refunded but retains processing and subsidy costs. Refund principal is removed from merchant sales; it is not all treated as PayPal's expense. These are explicit assumptions. The 80/20 merchant/platform incentive split is unchanged.

Every saved-plan world is conservatively allocated the **full $0.008447 source-trial model estimate**, including rejected calls and final review. This allocation is not a new charge or an estimate of fresh agent behavior. Actual new paid API spend is **$0**. Local training/runtime is measured; electricity, hardware depreciation and operator labor remain unpriced rather than being claimed to cost zero. `result.json` records both quantities.

Reactivation fixes the lapsed cohort before intervention: a previous purchaser with no purchase for seven days at day30, who then purchases during days31–100. The comparison uses the same starting people in every branch. It does not identify individually prevented real-world churn.

Shock recovery uses the trailing seven-day mean of daily paired contribution increments. After a negative window following day35, recovery requires 14 consecutive days with a nonnegative trailing mean. Non-recovery is censored at day100, not discarded. This is descriptive economic recovery, not an estimate of whether the agent correctly detected the shock. The UI also reports the sum of negative paired increments as post-shock shortfall in the raw result.

## Uncertainty and version discipline

For each policy, compute the difference from its paired control before aggregation. Average the five fixed scenarios within each seed, then bootstrap the 20 seed means with 2,000 deterministic resamples. Scenario plots resample the 20 paired seed differences for that scenario. The intervals are percentile 95% intervals conditional on these scenarios and the authored world model. Scenario breakdowns are exploratory and not multiplicity-adjusted. Time-curve bands are pointwise, not simultaneous bands.

All plotted curves are reconstructed from fully matured cohorts after day114. They are not the information the agents saw while shopping was running. Final review cost is allocated to the final campaign endpoint for display.

The [lock](v1/lock.json) pins transition code, initialization, learner, policy rules, metrics, protocol, catalog and saved plans. The runner refuses a changed fingerprint. Output cases are resumable under the exact fingerprint. The version chart currently has **one measured point**; there is no invented upward curve.

The seeds were held out from source-plan selection. Once these results are inspected, use them for regression only. Do not tune on them and continue calling them untouched test data. A new policy version needs a new immutable protocol/lock and a fresh confirmatory split. Versions with different simulator dynamics must be shown separately; changing the world until agents win is not policy improvement.

## Reliability and validity

- 17 adversarial/valid typed-contract cases: zero false accepts or false rejects for the tested cases.
- Seven controlled simulator probes: determinism, no-stock/no-money purchase constraints, price affordability, returns shock behavior, no future/immature-reward leakage, and valid publication timing.
- Adapter parity against the original recorded run: exact purchases, contribution, retained volume, merchant contribution and budget totals. Rules-immediate and organic totals also match their original branches.
- Original Gemini trace: 12 attempts, two structurally rejected attempts, two corrections. Three policy publication delays were nine, nine and 13 simulated days.
- Four manual, non-exhaustive semantic findings remain visible: a contradictory trend claim, prediction error misused as campaign evidence, wrong merchant-value ranking, and an unsupported explanation about stabilization. Schema acceptance is not semantic accuracy.
- The original three local fits all have slightly worse held-out reward MSE than their constant baseline. Better predictive fit would remain diagnostic rather than proof of campaign lift.

## Reproduce and inspect

```sh
npm run test:policy-benchmark
npm run benchmark:policy
npm run plot:policy
```

The first command is fully offline. The benchmark uses cached local public-catalog inputs and creates no provider client. The plotting script uses the existing `.local/research-venv` with matplotlib 3.9.4; on a fresh checkout, create a local virtual environment and install that version before invoking it. No GPU is required.

For another suite, create a separate versioned protocol and source inputs, validate the adapter on development seeds, freeze the code and inputs before inspecting new outcomes, then run all predeclared cases. Do not overwrite this v1 lock.

[All numeric results](v1/result.json) · [Per-case CSV](v1/cases.csv) · [Source plans and catalog](v1/inputs.json) · [Adapter verification](v1/adapter-validation.json) · [Version record](v1/versions.json)

Research figures, each exported as SVG, PNG and PDF:

1. [Economic effects and confidence intervals](../../figures/policy-lab-benchmark-v1/economic-impact.pdf)
2. [Cumulative economic effect](../../figures/policy-lab-benchmark-v1/cumulative-value.pdf)
3. [Merchant economics and reactivation](../../figures/policy-lab-benchmark-v1/merchant-and-reactivation.pdf)
4. [Agent reliability, delay and local fit quality](../../figures/policy-lab-benchmark-v1/agent-reliability.pdf)
5. [Measured version progress](../../figures/policy-lab-benchmark-v1/version-progress.pdf)

## Next experiments, without moving this benchmark

1. Audit why higher retained volume fails to cover platform incentive/outreach costs. Use development seeds to compare cost-aware stopping and less frequent contact; retain v1 as the regression baseline.
2. Diagnose the reactivation ceiling using shorter prespecified measurement windows and sensitivity studies. Any changed customer dynamics belong to a new simulator version, applied identically to every policy.
3. After a useful local policy improvement, evaluate fresh LLM planning and a single-planner comparator under matched evidence and budgets. The current transfer benchmark does not answer whether three agents beat one.
