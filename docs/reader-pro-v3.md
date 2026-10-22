# Shared reader repair and Pro comparison

Protocol frozen October 21, 2026 before paid V3 inference. This reruns the same ten V2 development case IDs, two repetitions per method: 40 case trials. Raw source documents, reference answers, source-query prices, permitted tools, source/turn budgets, fixed routing and the planner prompt are unchanged. [Frozen V3 plan](llm-pilot-plan-v3.json).

**Completed result:** both methods passed **20/20**, with **24 source queries each** and no unsupported packets, unnecessary escalations or harness stops. The agent added **$0.201226** equivalent model cost without improving the outcome. Cumulative token-cost estimate, including all prior runs and the probe: **$0.679692**. [Full results](llm-pilot-results-v3.md).

## Repairs applied to both methods

- Every reader field is present in the JSON contract; unknown and inapplicable scalar fields are explicitly null. Unknown quantities are not replaced by zero or the purchase-order size.
- Pallet manifests retain separate allocation rows. An unnamed other purchase order keeps a null ID. Each row includes a verbatim source quote.
- Stale or incomplete shipment records retain their classification even without a quantity. Deterministic date checks can still identify stale evidence.
- A bare shipping label is distinct from a later carrier record explicitly confirming cancellation and no delivery.
- Short supporting quotes must occur in the same document. This checks textual provenance; it does not independently prove every claim's semantic correctness. The private grader still evaluates conclusions and citations.
- The shared interpreter refuses unknown quantities, refund status and business age as answers. Missing business age does not become a false legal-entity mismatch.
- Newly observed documents are read together. Both policies receive identical cached extractions for any document they both retrieve, including failures. Each policy is costed once per unique reader batch receipt; sharing never counts the same batch once per document.

The controller still sees only permitted observations. No case oracle, family, private reference value or unretrieved document is sent to the model. The fixed workflow's source-selection code is unchanged. The adaptive policy still chooses a source or stops; the common interpreter produces the final review packet.

## Model and budget

Both methods use **Gemini 3.1 Pro Preview**, `gemini-3.1-pro-preview`, on the global Vertex endpoint. Reading uses LOW thinking; adaptive planning uses MEDIUM. Temperature 0, one candidate, JSON schema, at most 4,096 output tokens. Private thought text is neither requested nor stored. [Model documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-1-pro).

Verified standard global prices below 200K input tokens: **$2 per million input tokens and $12 per million output/thinking tokens**. The request envelope is at most 32,768 bytes. A $0.15 durable reservation precedes every request; returned usage reconciles it at the price saved with that request. Historical Flash-Lite entries retain their original recorded charge. Cache discounts are ignored conservatively. [Pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing).

The user's ceiling is **$10 total**. The existing cumulative application limit remains **$8**, including the earlier **$0.043416**. This rerun has a **$5** admission limit. The project's existing **$10/month native Vertex cap** remains configured; no APAC setting, resource, credential file or application file is changed. These protections do not constitute an absolute invoice guarantee: native enforcement can lag. No hosting, training, provisioned throughput or additional paid service is created.

Requests start at least 12 seconds apart and have a 45-second deadline. Unknown network outcomes retain the full reservation and open the spend circuit. A definitive HTTP error is retained as a rejected attempt with no input/output token charge under Google's documented non-200 pricing; there is no automatic retry. The runner stops on provider errors, budget rejection or an uncertain charge.

## Before the comparison

An independent three-document reader probe checks allocation preservation, an incomplete older record and explicit cancelled non-delivery. Probe expectations stay in the harness; the model receives only the source documents and reading schema. The probe is excluded from the 40 graded trials but included in actual spending.

The original normalized scripted baseline and 123 software tests pass before inference. They cover preserved spending, quote provenance, partial facts, batch-cost deduplication, identical extraction reuse, forbidden payment actions and the existing 48-case fixture contract. These passing software checks are separate from measured model quality.

## Interpretation

The reader repair, batching and model upgrade changed together. A cross-version gain cannot be attributed to the model alone. Within V3, however, both methods share the same reader, sources and final interpreter, so their comparison tests the additional planning step.

This is a known development sample, and repairs were motivated by observed V2 errors. It is not hidden or independent validation. Query prices are assumptions. Human review/correction time and actual PayPal outcomes remain unknown. Readiness does not authorize any reserve change; the main visual economy remains scripted.

An evaluator-only [query-cost lower-bound audit](llm-pilot-headroom-v3.json) finds that nine of the ten cases already have a fixed route using the cheapest sufficient source set. One case offers a two-cent assumed source saving per repetition through an alternative source. This limited opportunity is a property of the frozen benchmark, not information supplied to either controller. We preserve it rather than modify cases to favor the agent.

## Reproduction and history

```sh
npm test
node scripts/llm-pilot.mjs        # Freeze/verify only; no inference
node scripts/llm-pilot.mjs --run  # Paid, guarded V3 run
```

The existing ignored `.local/gcp/config.json` points to owner-authorized credentials and the dedicated project. Preserve `.local/gcp/model-spend.json`; never delete it to replenish the allowance. The V3 runner uses a V2 source snapshot to verify the planner text is unchanged. The snapshot is included under `docs/experiments/v2-source/`; if restoring this workspace, copy those files into `.local/benchmarks/v2-source/` before verifying the plan. Do not copy or publish credentials.

The V2 results remain in [the original report](llm-pilot-results.md). V3 writes a separate `docs/llm-pilot-results-v3.json` summary and a complete trace under `.local/benchmarks/llm-pilot-<run-id>.json`. No previous negative result is overwritten.
