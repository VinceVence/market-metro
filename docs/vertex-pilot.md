# Supply Yard Vertex pilot

**Current runner:** [V3 shared-reader repair and Gemini 3.1 Pro](reader-pro-v3.md), authorized after the V2 result below. V3 preserves the original cases and prior spending, uses a $5 run limit within the same $8 cumulative application limit, and retains the native $10/month cap. The remaining sections document the earlier V2 Flash-Lite experiment and its $1 run limit.

This is a local evidence-acquisition experiment. It does not execute PayPal payments, change reserves, deploy an application, or contact merchants. The main Supply Yard economy and browser benchmark remain scripted.

**Completed pilot:** [Results and decision](llm-pilot-results.md). Both methods passed 6/20 case trials; the agent queried 35 sources versus 22 and had higher equivalent model cost. This implementation did not demonstrate an agent advantage. Total returned-token estimate across setup probes and the comparison was **$0.043416**, with no pending reservations.

## Isolated cloud setup

Created October 21, 2026: project **`supply-yard-pilot-261021`**, number **`1066619937195`**. It uses the existing Main Account billing account. The only new setup is in this project and its project-scoped budget; APAC resources, service settings, budgets, credential files and application files were not changed.

The local token helper reads the existing authorized ADC, refreshes it in memory, and overrides the quota/billing project to Supply Yard for these calls. It does not copy or edit the credential file. The ignored `.local/gcp/config.json` contains the local interpreter/ADC paths and budget resource name. Tokens are captured privately by the runner and never written to reports or passed to the model.

## Spending controls

| Control | Scope |
|---|---|
| Native **$10/month** spend cap | This project's Vertex/Agent Platform service (`C7E2-9256-1C43`) only |
| **$8 lifetime** application admission limit | All calls recorded in `.local/gcp/model-spend.json`; restarting does not reset it |
| **$1 per pilot invocation** | Includes paid document reading and planning |
| **$0.03 reserved before every request** | Reconciled to measured token usage; uncertain execution keeps the reservation and opens the circuit |
| 32,768 request bytes / 2,048 output tokens / 14 model calls per trial | Fixed text-only envelope; no search, external tools, model upgrades or automatic retries |
| Six seconds between provider request starts | One local runner, exclusive ledger lock |

The runner re-reads the native budget before inference and refuses a wrong project, service, currency, amount or non-configured cap. Do not delete the ledger or its lock to make a run pass. A crashed or unknown request requires reconciliation against saved receipts. The first ledger creation requires `--initialize-ledger`; ordinary runs require it to exist.

Google's native cap is not an absolute invoice ceiling: enforcement is delayed, in-flight requests complete, and other services are outside this cap. The local $8 admission limit provides a buffer below $10 for this isolated model pilot. No hosted compute, training, storage warehouse or provisioned throughput was created. [Google spend-cap documentation](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps).

## Model and comparison

Model: **`gemini-3.1-flash-lite`**, global standard pay-as-you-go, temperature 0, minimal thinking, JSON schemas. Verified list prices on October 21: **$0.25 per million text input tokens and $1.50 per million output/thinking tokens**. Estimates conservatively ignore cache discounts; final billing can differ. The runner refuses inference after the pinned price verification expires on November 12. [Pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing) · [Model documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-1-flash-lite).

The frozen V2 pilot uses ten development cases: three complete-evidence, three mixed-pallet, two stale-record and two cancelled-replacement cases, each repeated twice. No holdout cases are used. Cases are known to the author and are not independent validation.

1. **Fixed + LLM reader:** Gemini extracts only the raw documents already observed. The existing conditional workflow selects the next source and stops when its criteria are met.
2. **Adaptive + same reader:** The same extractions and shared evidence interpreter are supplied to Gemini, which chooses the next permitted source or stops. The common interpreter produces the final human-review packet.

The model sees no private oracle, scenario family, source generator or unretrieved document. The controller can request only five read-only simulated sources. Each action has a brief public purpose; private thinking is not requested or stored.

A per-case, per-repetition cache shares **identical** extractions, including failures, across policies. Cached results are disclosed only after that policy retrieves the document. Both policies are charged the original reader token cost as if they ran independently. Actual API spend is reported separately. The second arm benefits from a physical cache, so wall-clock times are not a fair latency comparison. A normalized scripted reference is retained separately and is not ranked as a raw-document competitor.

## Reproduce and inspect

```sh
npm test
node scripts/llm-pilot.mjs
# Executes paid calls only after the native cap, local config and ledger pass:
node scripts/llm-pilot.mjs --run
```

The run is serial and checkpoints every trial into `.local/benchmarks/llm-pilot-<run-id>.json`. A completed summary goes to `docs/llm-pilot-results.json`. Configuration, source hash, prompt hash, model version, token receipts, chosen tools, source citations and grading are recorded. Frozen plans refuse to overwrite a changed experiment. No paid endpoint is exposed through the local website.

The initial V1 infrastructure probe is preserved in `docs/llm-pilot-plan.json`, `docs/llm-pilot-v1-stop.json` and its full ignored trace. It stopped after HTTP 429, with $0.005950 in measured list-price token cost. Its failed extractions were not reused consistently, so it is unsuitable for policy comparison. The failed HTTP 429 reservation was explicitly reconciled to zero using Google's non-200 pricing rule; the original reservation and reconciliation remain in the ledger. V2 adds schemas, failed-extraction parity and request pacing. The case facts, grading rules and evidence policy were not changed.

V2 also encountered HTTP 429. `scripts/continue-llm-pilot.mjs <run-id>` performs at most one explicit operator recovery of that definitive response: it verifies the frozen implementation, preserves prior usage and the rejected attempt, and continues under the same cumulative $1 run allowance at twelve-second request spacing. It cannot clear an unknown timeout or run twice for the same experiment. The completed run had 40 case trials and 20 matching evidence/input pairs. This is a quality pilot conditional on provider execution, not an availability or latency benchmark.

## What would justify an agent

Compare supported completion, unsupported conclusions, missed contradictions, unnecessary escalation and equivalent machine cost. Tool prices remain authored assumptions. Analyst review/correction time, maintenance cost, workload prevalence and PayPal outcomes are unmeasured; total handling cost and PayPal benefit remain unknown.

Extra tool use is not inherently valuable. If the fixed workflow with the same reader matches quality more cheaply, this pilot supports keeping that workflow. If both fail, first separate reading failures from evidence-selection failures. A small success or failure with one model does not establish the quality of all LLM systems, production readiness or PayPal-specific novelty.
