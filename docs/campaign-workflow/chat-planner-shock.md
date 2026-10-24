# Current-chat planner: rival-sale review

Recorded workflow: `WF-c1b681f9d804c0ec`. Open the existing Market Metro UI at
`/?run=GARDEN-WF-c1b681f9d804c0ec`, or its checkpoint trail at
`/workflow.html?id=WF-c1b681f9d804c0ec`.

The assistant in the current chat selected the investigation, observation horizon,
training request and final review. The server executed typed requests and saved
their rationale, evidence IDs, revisions and results. There is no app-hosted LLM
loop. Simulation workers, training code, promotion gates and coupon execution
remain deterministic. The separate scripted demo coordinator cannot drive this
assistant-owned run.

The prior campaign had already completed. Its seed-314 setup was deliberately
reproduced, preserving the original run and its PayPal receipt. All 10,800
customer-day observations through the first shock day match after normalizing run
IDs; the initial training-data hash and model results also match. The setup replay
is labeled in the `prefix-*` checkpoint rationales. The new investigation starts
at `shock-diagnosis`. This is not a blinded comparison: the original run was
already known in this conversation, and no general agent advantage is claimed.

| Chat-selected action | Evidence and outcome |
| --- | --- |
| Inspect daily outcomes and saved prediction accuracy | First shock day: 13 purchases vs 20.93 predicted; all stock available. Saved pre-action log loss was 0.1741 vs 0.1812 before the shock. One changed day did not justify wider discounts. |
| Observe two more days under the existing plan | Three shock days then showed 41 purchases vs 56.76 predicted. Overprediction persisted, although log loss alone did not show a collapse. |
| Fit one recent challenger locally | Selected logistic regression on a 21-day window, preserving the seven-day validation and 0.001 improvement requirement. No window sweep or threshold change. |
| Reject promotion and retain coupons | Candidate loss 0.1816708 vs incumbent 0.1820030: improvement 0.0003322, below the gate. The original model remained active. The evidence also did not justify wider eligibility, lower gain floors or an across-the-board cut to 5%. |
| Finish and evaluate | Kept the original 5%/10% choices, 20% margin floor, seven-day contact gap and $300 virtual budget. All 4,800 customer decisions use the original model. |

The trainer's candidate training partition still contained no rival-exposed rows;
the three changed days were in temporal validation. Its final refit includes all
observed rows, but that does not independently validate a learned rival response.
The planner recorded this limitation before requesting the fit.

## Outcome and cost

Both this trial and the scripted reference produced 222 campaign purchases,
74 coupons, 17 redemptions, $69.78 virtual spending and $6,810.49 modeled merchant
contribution. There is no demonstrated incremental benefit over the script.
Repeat-purchase difference was +15.2 percentage points, with an approximate
interval of -1.0 to +31.4 points; uplift remains inconclusive.

The additional challenger took 2.695 seconds of local wall time. No paid model API
calls, Channel3 searches, new PayPal captures or subagents were used. Local hardware
and current-chat usage are not priced as zero. The old sandbox receipt remains
attached only to its original order, not to this new run.

## Verification

- 18 completed checkpoints, attributed to `assistant_in_current_chat`.
- Replaying the rejected training request preserved the model count, day,
  revision and completed state.
- The scripted demo endpoint returned `NOT_A_DEMO` for this workflow.
- Zero holdout coupons; original model version 1 used for all shopper decisions.
- Seven workflow tests passed, including new coverage for saved-score selection,
  the training/validation split, and exclusion of future and foreign-run rows.
- The existing UI displays chat-planner attribution separately from scripted
  worker events; no layout or city art was changed.

[Recorded requests, outputs and checks](chat-planner-shock.json).
