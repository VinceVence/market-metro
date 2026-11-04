# V2.3: proposals from the LLM, execution decisions from code

The LLM proposes analysis, model experiments and campaigns. It has **no publish tool**. A deterministic controller chooses which tested campaign can run.

V2.2 retains the V2.1 comparison and recorded demo. Its new financial study uses separately registered seeds; implementation improvements alone are not a profit claim.

V2.2.1 changes operational recovery only. Its confirmation uses new registered seeds; prior V2.2 failures remain in their original report.

V2.3 adds an action-specific value model. Development performance motivates this change; the new confirmation must finish before claiming an unseen gain. All prior comparisons remain available.

## Different data needs different models

SKU recommendations retain the scientist's fitted classifier and value model. A general needs inquiry has no SKU; it now uses its own reply/value head instead of placeholder product features.

The inquiry head learns response rates and payment/merchant value from completed historical contacts, grouped by observed intent age. A regularized logistic intercept updates response estimates using only replies observed before the current day. Payment and merchant value update only after the 26-day simulation settlement window. Immediate funding is never substituted for eventual retained value.

The model's precision/pseudo-count strength is 8 and the response window is 28 days. These are disclosed modeling assumptions. The historical data, fitted head and parameters are bound into the model artifact hash. Routing by action type is deterministic. The LLM still chooses the investigation, classifier experiments, campaign audience, contact allowance and supply proposal.

The production scorer reproduced the free prototype's three development markets exactly. This proves implementation parity, not generalization. Classifier AUC is not presented as validation of the separate value head. Publication additionally requires no negative PayPal, merchant or purchase difference in any of the three known development stress cases; this does not guarantee future gains.

```text
Observed snapshot → LLM proposal → strict contract validation
                  → local analysis / training / trial
                  → optional revised proposal and trial
                  → deterministic selection → guarded execution → checkpoint
```

## The three checks

| Layer | What it checks |
|---|---|
| Structure | Required fields, exact types and enum values, nested fields, text bounds and evidence references. Unknown fields and implicit coercions are rejected. |
| Evidence and meaning | Product preference is distinct from shopper targeting. Model bytes, campaign, review date, snapshot, market size, prior policy and trial context must match. Pending outcomes are excluded from the retention-rate denominator. |
| Business rules | Model validation and measured PayPal, merchant, purchase, retained-volume, partner-cash, inventory and liability checks must pass. Valid JSON alone never authorizes publication. |

The orchestrator is JavaScript. `contracts.mjs` provides the same boundary-validation role that strict Pydantic models would provide in Python, without adding a second runtime or a dependency. The same owned schemas generate model tool declarations and validate replies locally. This is a deliberately limited validator for these contracts, not a general JSON-Schema implementation.

Natural-language rationale is recorded as the agent's explanation. It is never treated as an approval, an executable command or verified financial evidence.

## Unambiguous campaign proposal

```json
{
  "kind": "intent_assistance",
  "objective": "joint",
  "contactsPer100": "10",
  "forecast": "recent14",
  "coverDays": "7",
  "supplierSettlement": "paypal_fast",
  "productPreference": "lowest_acceptable_price"
}
```

Numeric enum strings are the wire format. Only those validated values are converted to canonical integers. `productPreference` means which acceptable **product** to replenish; it never means preferred shoppers. Routing maps explicitly to the existing PayPal/bank settlement behavior. No proposal can add SQL, a payment amount, a customer-funds override or a hidden simulator field.

## Final authority

After the first trial, the LLM may call `propose_campaign_revision` or `finish_review`. When the initial proposal also changes supply, code tests the same learned campaign with incumbent supply settings preserved. This isolates the contribution of the supply change. Finishing the search is not a veto. The controller considers the initial, supply-preserved and any valid revised candidate, applies the same guards, and selects by:

1. Highest measured modeled PayPal contribution.
2. Then merchant contribution.
3. Then retained purchases.
4. Then canonical contract hash for a stable tie-break.

If no candidate qualifies, code retains the incumbent. A worse revision cannot discard a better eligible initial candidate. An unchanged proposal reuses its existing trial; it does not fail the entire workflow. A rejected optional revision leaves completed trials available. The checkpoint records the controller's authority, every candidate's checks, and the selected evidence hashes.

Development trials use the execution market's size: 600 shoppers/12 merchants or 100/3. The three separate development seeds cover discovery, low response and no response; active-market future is never exposed. Two bounded local CPU workers execute trials, with financial/input parity checked against sequential execution. They are numerical workers, not additional model agents. Cache identities include the market profile, evaluator sources, controls and prior inputs. Trial records are checksummed; mismatched, changed or non-finite evidence is rejected. These hashes detect changes and bind artifacts—they are not cryptographic authentication against someone who controls the host filesystem.

## Roles, memory and bounded recovery

The analyst owns the demand hypothesis and feature handoff; the scientist owns model experiments and validation; the manager owns campaign economics. Each receives its role brief plus shared measured artifacts. The single-planner comparator receives all three role briefs and the same tools, limits and evidence. This tests a division of work, not a claim that more personas automatically improve outcomes.

Each review sees the exact active policy, observed response counts and earlier experiment results. Model summaries retain contact-type metrics and source-market validation gaps; full reports remain saved. Pro handles the first campaign revision on day 30. Flash-Lite handles every other decision, including the day-60 revision. Both architectures use this same schedule. Local fitting supports forests, logistic regression, response-hurdle models and shallow gradient boosting, plus the inquiry value head.

For billed model requests, only definitive HTTP 429/500/502/503/504 rejections with a matching recorded rejection event are retryable. The same evidence is reused, each retry obtains a new spend reservation, and no commerce action has executed at that stage. There is at most one retry per decision and two per run. Uncertain model-request timeouts, uncertain billing, invalid tool output and permission errors are not retried. Limits are six decision stages per review, two reviews, fourteen total provider attempts and **$0.19 per run**. The lifetime $8 ledger cap is unchanged.

Two additional **safe-operation boundaries** now recover without discarding completed analysis:

- Authentication and spend-cap reads may retry once for an identified transport failure or transient HTTP rejection. Spend-cap verification still must succeed before any model request. Wrong projects, permission failures, malformed tokens and cancellation remain closed. The token is never recorded in a checkpoint.
- A local numerical trial may retry once after its process deadline, at most twice per run. It reuses the exact saved input, does not repeat a model or payment call, and records a recovery event before retrying. Invalid models, invalid outputs and ordinary process errors are not retried. Only a complete validated result enters the publication gate.

Recovery counts and structured exit metadata are saved with the workflow. The original failed trial input was replayed through the recovery boundary with one controlled timeout; all financial means matched the earlier completed replay. That campaign remained unprofitable and would still be rejected. Recovery does not manufacture a positive result.

## Determinism and its limits

- The same fixed evidence, model, validated proposals and configuration produce the same validator/selector outcome. Candidate order does not change the winner.
- Compiled plans are deeply frozen. Execution checks the bound configuration again.
- Repeated same-day planning shares one in-flight operation and returns a copy of its result. Changed evidence, overlapping days and date rewinds are rejected.
- Review dates pause while work runs. Checkpoints preserve proposals, results and rejection reasons. Server restart still marks uncertain runs interrupted; this is not a new automatic crash-resume engine.
- Fresh LLM output can differ. Training/solver reproducibility requires pinned runtimes. External PayPal responses remain external state; the existing idempotency and receipt reconciliation boundaries still apply.

**This guarantees controlled execution, not profitable recommendations.** It does not remove simulation assumptions, selection bias or prediction error. The saved V2 and V2.1 studies remain separately labeled; they are not evidence of a V2.2 improvement.

## Verification

```sh
node --test tests/commerce-harness-v2.test.mjs tests/commerce-autonomy-live.test.mjs tests/commerce-expanded.test.mjs
npm run baseline:verify
```

The tests cover invalid nested proposals, unknown tools, changed evidence, mismatched trial contexts, corrupted measurements, stable selection, a worse revision losing to the initial proposal, same-day deduplication and the full paused-date workflow with actual local training. Provider calls and trial financial gains in the integration fixture are explicitly test doubles. No paid model calls or new profit benchmark are part of this validation.
