# Policy Lab POC — verified trial

Run: `GARDEN-LAB-df43cd08499c0c0a`. Seed314;3 simulated merchants;100 shoppers;100 trading days plus14 follow-up days.

The workflow completed. This seed does **not** show economic superiority: the team was $16.98 below rules and $29.14 below no campaign on modeled platform contribution. These are simulator estimates.

## Execution

- 12 actual Gemini attempts; 3 local fits; 3 policy publications.
- Full-run purchases:1667; action records:10000.
- Post-history:238 coupons offered,18 redeemed,660 recommendations. Warmup activity is separate.
- All7000 post-history shopper-day outcomes matured in each branch.
- Local fitting:29.9ms total CPU time.
- Corrected-run model estimate:$0.008447. Cumulative recorded model estimate:$0.869186 against the whole-hackathon $50 ceiling.

## Same-world comparison, days31–100

| Metric | Agent team + bandit | Rules + same learner | No campaign |
|---|---:|---:|---:|
| Purchases | 1198 | 1204 | 1197 |
| Retained payment volume | $53318.96 | $53654.06 | $53472.98 |
| Merchant contribution | $18371.52 | $18496.22 | $18444.76 |
| Joint incentive/outreach cost | $49.61 | $46.52 | $0.00 |
| Modeled platform contribution | $1504.69 | $1521.67 | $1533.83 |

## Decisions

- Evidence through day30 → published day39: recommendations, all audience, merchants 1, 2, max0%, exploration0.1.
- Evidence through day55 → published day64: mixed, all audience, merchants 0, 1, 2, max5%, exploration0.15.
- Evidence through day80 → published day93: recommendations, all audience, merchants 1, 2, max0%, exploration0.1.

Final reviewer: **stop_outreach**.

The 'organic' control branch outperformed both the 'mesh' and 'rules' branches in platform proxy cents (153,383 vs 150,469 and 152,167, respectively) while incurring zero support or outreach costs. The agent-driven interventions failed to generate sufficient incremental volume to offset their associated costs, and the frequent strategy shifts throughout the experiment prevented performance stabilization. The 'rules' branch showed higher merchant contribution and retained cents, but this did not translate into superior platform proxy performance compared to the organic baseline.

## PayPal and Channel3

Three selected cached Channel3 products populate nine simulated merchant listings. No real merchant inventory or customer histories are claimed.

The first trial captured $30.39 in fictitious PayPal funds, with a $1.33 provider fee (capture4H546903J1724721F). Automatic approval review rejected an additional sandbox payment, so this corrected trial has **zero new native receipts** and uses that prior record only as an explicitly labeled reference. Its original order and catalog lineage remain in the warehouse. It is never added to this run's revenue.

## What helped and what still needs work

Checkpointing preserved two rejected outputs in the corrected run: an incompatible coupon/recommendation plan and a wrong final evidence citation. Bounded corrections allowed valid continuation; all rejected narratives remain inspectable. A local replay reproduced every branch's totals without new model or payment calls.

Reasoning quality still needs improvement. The day80 investigator described a decline although the supplied weekly counts were119 versus111. The in-run reviewer relied on reward-prediction MSE as support for a policy even though MSE does not establish incrementality. All three fitted reward models had slightly worse held-out MSE than their constant baseline. The lab exposes these weaknesses; it does not prove that more agents or RL solve them.

Next research gate: improve experiment design and evidence-aware review, then evaluate over held-out structural scenarios and seeds with matched tools, learners and total budgets. Sequential RL should be added only after a cheap local comparison demonstrates value from delayed state changes.

The final review's claim that frequent strategy shifts prevented stabilization is an untested explanation. Its numerical platform ranking is correct; identifying the cause requires an ablation. Do not present that narrative as an established finding.

## Reproduce

Run `node scripts/policy-lab/replay.mjs GARDEN-LAB-df43cd08499c0c0a` for a zero-call replay. Run `node scripts/policy-lab/report.mjs GARDEN-LAB-df43cd08499c0c0a` while the local server is open to export this report.

[Raw results](report.json) · [Validation and spend](validation.json) · [Decision log](decisions.csv) · [Shopper trace](shopper-trace.json)
