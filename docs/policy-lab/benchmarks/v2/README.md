# Fresh Gemini policy benchmark v2

The simulator and original rules remained frozen. This evaluation generated new Gemini decisions from each case's observed evidence; it does not replay saved campaign choices.

[Open the benchmark](http://127.0.0.1:4173/?run=GARDEN-LAB-df43cd08499c0c0a&policyLab=GARDEN-LAB-df43cd08499c0c0a&policyView=benchmarks)

## Result

30 paired cases: 6 new seed clusters × five fixed scenarios, with five policy branches per case. Each world has 100 shoppers, 30 history days, 70 campaign days and a 14-day return tail.

| Policy | Mean platform difference vs no campaign | 95% seed-cluster interval | Mean merchant difference |
|---|---:|---:|---:|
| Fresh Gemini team | $+0.3698 | $-0.4516 to $+1.3541 | $+15.5637 |
| Conservative code · no LLM | $-0.0853 | $-0.2307 to $-0.0007 | $+3.5357 |
| Original rules · matched latency | $-9.5827 | $-13.2803 to $-5.6747 | $+117.0017 |
| Original rules · immediate | $-13.7220 | $-18.1757 to $-9.8627 | $+95.1287 |

Fresh Gemini versus original immediate rules: $+14.0918, interval $+10.2424 to $+18.2002.

Fresh Gemini versus the conservative code-only policy: $+0.4551, interval $-0.3933 to $+1.4555. Improvement over an unnecessarily expensive campaign does not establish an LLM advantage. The no-campaign control remains the economic reference.

These are **modeled platform contribution** differences after actual recorded model cost, not real PayPal profit. Six seed clusters form a small pilot; intervals do not cover uncertainty in the authored economic model or repeated fresh LLM draws. Scenario breakdowns are exploratory, with no multiplicity correction. Agent-count advantage against a single LLM planner was not tested.

V2 is implemented as a separate evaluation runner and exposed in the Benchmarks tab. The existing live-demo runner is preserved; this benchmark does not silently promote an unproven policy to the New experiment flow.

## Policy changes

- Campaigns expire after three or seven days rather than running indefinitely between reviews.
- Random post-history offer exploration is zero. Conservative policies apply an explicit predicted-reward penalty; it is not a causal confidence interval.
- Gemini selects an evidence focus, policy, merchants, training window and refit/reuse decision. A separately prompted Gemini reviewer approves or rejects the proposal.
- Separate observe and active-campaign tools prevent an active campaign from being published without a model. Numeric purchase facts and evidence IDs are checked against the exact snapshot.
- All local training uses the unchanged seven features and only mature past outcomes. No hidden customer traits, future scenario labels or other-world outcomes enter the planner's packet.

Development inspected 17 local policy variants on the pre-existing three development seeds. The selected cautious recommendation policy had only a small positive development mean; that is selection-biased preliminary evidence, not a result for the evaluation seeds. A common-support training variant was abandoned after insufficient mature data and was not deployed.

## Matched controls and timing

Original rules use the unchanged `rulesPlan` and learner. The immediate branch acts after days30,55,80; the matched branch publishes when the fresh team finishes. The no-LLM conservative control uses the selected three-day policy and matched publication timing. The no-campaign branch observes without outreach after history collection.

All branches advance together every1.5 seconds while Gemini reasons. Outside inference the runner advances locally without waiting. This measures actual publication delay in the accelerated simulator; it is not a production latency forecast. Each completed review saves its publication day and model, so recovery uses the same timing. An interrupted review without a completion record stops for inspection rather than silently moving its publication earlier.

The version1 saved-plan results are historical context, not a same-seed comparison. World mechanics, merchant constraints, catalog, costs and reward definitions are pinned to the original hashes in [protocol.json](protocol.json). Policy code is separately frozen before the new evaluation seeds are run.

## Spending and reliability

- Evaluation: 268 actual requests; $0.126326 provider-token cost estimate.
- Entire v2 suite including all development pilots: $0.136004, under the $1 suite ceiling.
- Recorded lifetime model spend: $1.005190, below the user's $50 ceiling. The stricter $8 local lifetime and $0.25 per-case limits remain unchanged.
- 0 validation-rejected evaluation attempts; 1 failed evaluation reviews retained in outcomes.
- Actual effects: 418 recommendations, 0 coupons, 0 redemptions and 30 local fits. 16 cases produced no outreach at all. Choosing a campaign plan is not the same as actually delivering an offer.
- No new payment API calls or APAC changes. Local electricity, hardware depreciation and operator labor are unpriced, not asserted to be free.
- Development retained one provider-schema failure and one model-action validation failure, followed by a successful pilot. Their calls and costs remain in the ledger and `pilot/` artifacts.

Costs are estimates from provider-reported tokens, not final billing invoices. All failed and corrected attempts are included. Numeric/schema validation does not guarantee that every natural-language justification is correct; inspect the per-case decision log.

Manual review of the first completed case found an unsupported attribution to "strong organic demand": the purchase increase was observed, but the agent had no control-world comparison to establish its cause. This non-exhaustive finding is surfaced in the UI and is not presented as a measured semantic accuracy rate.

## Reproduce and inspect

For this historical study, run the commands below in a separate checkout of [revision `6544108`](https://github.com/VinceVence/market-metro/tree/6544108c67dcb458ddafb2a8dee1cb1e4adc5195). It contains the matching scripts and npm commands.

`node scripts/policy-lab/fresh-benchmark.mjs --run` resumes this exact frozen suite. Completed case results are reused; unknown in-flight paid calls are not retried. Do not change policy files and rerun the same holdout as if untouched. A new version requires a new protocol and new confirmatory seeds after tuning.

`.local/research-venv/bin/python scripts/plot-fresh-policy.py` rebuilds figures and the browser index without new model or payment calls.

[Full results](result.json) · [Per-world CSV](cases.csv) · [Frozen protocol](protocol.json)

Research figures are in `docs/figures/policy-lab-benchmark-v2/`, each as PNG, SVG and PDF. Per-case model requests, outputs, usage and published model artifacts remain under `cases/`. The app's Fresh decision log explains each agent's known facts and public justification.
