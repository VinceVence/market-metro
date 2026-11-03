# PayPal net baseline v1 — locked

Accepted by the user on November 2, 2026. This is the exact full Gemini policy from the 14-market confirmation, including the fulfillment component that slightly hurt performance. The retrospectively better ablation has not replaced it.

| Recorded mean per market | Baseline v1 |
|---|---:|
| Modeled PayPal net after allocated AI cost | $751.65 |
| Net improvement over strong fixed rules | $16.24 / 2.21% |
| Total retailer contribution | $8,823.19 |
| Retained purchases | 137.36 |
| Closing partner cash | $28,241.84 |
| Closing inventory | $2,836.98 |

The 95% paired bootstrap interval versus fixed is +$1.37 to +$33.17. The +$11.14 mean improvement over the previous learned workflow is uncertain: its interval is −$3.04 to +$28.09.

## What is frozen

- The original 12 economy files: customer needs, response behavior, funds, prices, catalog, payment fees, delivery/refund rules and evaluation accounting.
- The exact Gemini decision, original models, priors, complete-basket program, execution dependencies and evaluation results: 45 copied files in `snapshot/`.
- The original 70 detailed trial traces remain at their existing paths and are SHA-256 checked. They are not duplicated into another 220 MB archive.
- `manifest.json` records every hash, the selected arm, the scorecard, runtime versions and the comparison contract. `manifest.sha256` seals that manifest. Existing files cannot be overwritten by the lock command.

No credentials, GCP configuration, PayPal wallet tokens or spend-ledger secrets are included. This is a local comparison baseline, not a change to the live app controller.

## Verify or replay

From the repository root:

```sh
npm run baseline:verify
npm run baseline:replay -- C0
```

Verification checks the current economy, archived artifacts and published traces. The normal test suite also includes this guard. Changes to future agent code are allowed; changes to the frozen economy or archived baseline fail verification.

Replay uses the copied code/models in an isolated temporary directory and the installed local Python environment. It checks the recorded Node, Python, NumPy and SciPy versions, disables fetch and never calls an LLM or PayPal. C0 reproduced all 14 checked identity/financial fields exactly: $615.40 platform contribution, $7,648.73 retailer contribution and 151 retained purchases. This is a regression replay, not fresh evidence.

## How future candidates must compare

1. Keep the economy unchanged. Improve agent roles, observations, model selection, orchestration or legal commerce actions in separate candidate code.
2. Register new evaluation seeds before looking at their outcomes. The 14 published seeds are now regression/development cases.
3. Rerun the archived baseline and candidate on identical seeds, funds, consent, shocks and settlement horizons. **$751.65 is the recorded cohort mean, not a fixed target for every new cohort.**
4. Measure settled modeled PayPal net after AI cost, retailer contribution, partner cash, inventory, retained purchases and unpaid liabilities. Keep the original inventory safeguard and show losses.
5. Compare the team with an equally equipped single planner and remove individual outputs to measure their contribution. More roles are not automatically an improvement.
6. Preserve this baseline and all earlier negative evidence. A successor receives a new version after confirmation; never rewrite this snapshot to make a candidate win.

The supported claim is **an LLM-selected campaign improved modeled net versus strong fixed rules in this frozen simulation**. Broader consented inquiries added value. Multi-agent superiority over one planner and production PayPal profit remain unproven. The next architecture should be measured against this stronger workflow.

[Locked manifest](manifest.json) · [Archived result report](snapshot/docs/commerce-growth/roc-net-goal-1/NET-RESULT.md) · [Archived confirmation](snapshot/docs/commerce-growth/roc-net-goal-1/net-revision-confirmation-1/results.json)
