# Research record: ROC quality, useful LLM decisions and settled net

User instruction, November 2, 2026: strengthen the justification, treat this as a goal, keep the economy unchanged, and find an architecture with the best ROC and substantive LLM usage that lifts net. The $50 overall ceiling, no-APAC constraint and no-development-subagents instruction continue. The tighter application ledger caps remain in place.

The user cleared the open-ended goal. A subsequent bounded PayPal-net revision is complete: [results and actual agent decision](NET-RESULT.md). On 14 unseen markets it improved modeled PayPal net by $16.24 versus fixed, retailer contribution by $337.02 and partner cash by $525.78, after allocated model cost. Closing inventory fell. Its $11.14 mean advantage over the existing learned workflow remains statistically uncertain. The original broader goal of establishing incremental multi-agent value was not achieved; negative studies remain preserved.

## Measurement contract

Use ROC-AUC for a contact becoming a retained purchase after settlement. Also report average precision, calibration/Brier/log loss and within-market AUC. Higher pooled AUC alone can merely distinguish high-response from low-response markets. The same observations and labels must be used for every model comparison.

Financial measurement remains full settled modeled PayPal contribution after processing, outreach, refunds and model usage, alongside aggregate retailer contribution and retained purchases. Compare against the strong fixed rules, existing deployed numerical model workflow, and an equally equipped single planner. AUC and net are distinct outcomes. The goal is the best supported tested architecture, not a claim of global optimality or guaranteed production profit.

The 12 source hashes in `../development-1/protocol.json` are the immutable economy. No change to needs, budgets, responses, merchants, fees, prices, stock physics, payment rails or fixed controllers is authorized. Only observations, model tools, agent decisions and their evaluation may change.

## Initial diagnosis

`prior-roc-audit.json` audits the **already opened** workbench observations. Those cases are now diagnostic/development evidence, never fresh confirmation:

| Predictor | Pooled AUC | Mean within-market AUC | Brier |
|---|---:|---:|---:|
| Existing raw forest | 0.7610 | 0.7487 | 0.08597 |
| Existing deployed workflow | **0.8108** | 0.7644 | 0.08570 |
| Prior contextual hurdle, deployed | 0.8088 | 0.7499 | 0.08424 |
| Hurdle with original features, deployed | 0.8040 | **0.7680** | **0.08098** |

The deployed reference includes its real prior-day funding adjustment and inquiry posterior. New models must not be compared only with its weaker raw classifier and described as beating the complete workflow.

## Initial work plan (historical)

1. Reconstruct strictly prior-day market and shopper feedback: response, funding and matured retention. Keep source trajectories separate. Do not expose identifiers or labels before their observation time.
2. Add local boosted-tree fitting alongside forest, logistic and response-hurdle tools, with Python/JavaScript parity and whole-source-market validation.
3. Let fresh application agents choose the investigation, data contract, model jobs and campaign experiments from the diagnostic evidence. Numerical tools execute these jobs; no SQL or unrestricted code is generated.
4. Add a checkpointed return from disappointing campaign trials to model selection, so the team can reconsider a good-AUC/bad-economics choice before publication.
5. Freeze the selected artifacts before a new confirmation panel. Prior workbench seeds may be reused for development selection only. Publish all gains, losses, prediction results, costs and decision ablations.

The first new provider study will use the existing $0.25 shared envelope. No new provider calls have been made for this goal at this initial checkpoint. Recorded Gemini usage entering the goal was $3.664175; token-price estimates are not billing invoices.
