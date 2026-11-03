# V2.1: proposals from the LLM, execution decisions from code

The LLM proposes analysis, model experiments and campaigns. It has **no publish tool**. A deterministic controller chooses which tested campaign can run.

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
| Business rules | Model validation and measured PayPal, merchant, purchase and liability checks must pass. Valid JSON alone never authorizes publication. |

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

After the first trial, the LLM may call `propose_campaign_revision` or `finish_review`. Finishing the search is not a veto. The controller considers the initial and any valid revised candidate, applies the same guards, and selects by:

1. Highest measured modeled PayPal contribution.
2. Then merchant contribution.
3. Then retained purchases.
4. Then canonical contract hash for a stable tie-break.

If no candidate qualifies, code retains the incumbent. A worse revision cannot discard a better eligible initial candidate. A rejected optional revision leaves the completed initial trial available; uncertain model calls are not retried. The checkpoint records the controller's authority, every candidate's checks, and the selected evidence hashes.

Development trials now use the execution market's size: 600 shoppers/12 merchants or 100/3. They still use separate development seeds, never future outcomes from the active market. Cache identities include the market profile, evaluator sources, controls and prior inputs. Trial records are checksummed; mismatched, changed or non-finite evidence is rejected. These hashes detect changes and bind artifacts—they are not cryptographic authentication against someone who controls the host filesystem.

## Determinism and its limits

- The same fixed evidence, model, validated proposals and configuration produce the same validator/selector outcome. Candidate order does not change the winner.
- Compiled plans are deeply frozen. Execution checks the bound configuration again.
- Repeated same-day planning shares one in-flight operation and returns a copy of its result. Changed evidence, overlapping days and date rewinds are rejected.
- Review dates pause while work runs. Checkpoints preserve proposals, results and rejection reasons. Server restart still marks uncertain runs interrupted; this is not a new automatic crash-resume engine.
- Fresh LLM output can differ. Training/solver reproducibility requires pinned runtimes. External PayPal responses remain external state; the existing idempotency and receipt reconciliation boundaries still apply.

**This guarantees controlled execution, not profitable recommendations.** It does not remove simulation assumptions, selection bias or prediction error. The saved four-seed financial comparison is the earlier V2 run and is not evidence of a V2.1 improvement.

## Verification

```sh
node --test tests/commerce-harness-v2.test.mjs tests/commerce-autonomy-live.test.mjs tests/commerce-expanded.test.mjs
npm run baseline:verify
```

The tests cover invalid nested proposals, unknown tools, changed evidence, mismatched trial contexts, corrupted measurements, stable selection, a worse revision losing to the initial proposal, same-day deduplication and the full paused-date workflow with actual local training. Provider calls and trial financial gains in the integration fixture are explicitly test doubles. No paid model calls or new profit benchmark are part of this validation.
