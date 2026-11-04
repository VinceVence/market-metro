# Commerce harness V2

**Current implementation: [V2.1 typed execution](typed-execution.md).** Strict shared schemas and deterministic final selection replace the LLM's publish/retain choice. New development trials match the live market size. The historical comparison below predates these changes and has not been relabeled. A separately registered [4 November V2.1 comparison](v21-20261104-transport/protocol.json) is in progress; incomplete results are not a financial claim.

V2 is implemented in the live app. Economic dates pause at review boundaries; the analyst can query demand, the scientist trains two local candidates, and the commerce manager tests and revises a hash-bound campaign. The verifier retains the existing policy if financial or model checks fail.

## Four unseen markets

| Mean per 600 shoppers | Fixed | One planner | Three-agent team |
|---|---:|---:|---:|
| Modeled PayPal net after AI | $3,749.9475 | $3,749.9221 | $3,749.9217 |
| Merchant contribution | $45,093.15 | $45,093.15 | $45,093.15 |
| Retained payment volume | $99,817.00 | $99,817.00 | $99,817.00 |
| Retained purchases | 694.5 | 694.5 | 694.5 |

**No financial lift was demonstrated.** All 16 reviews retained the fixed policy because the proposals failed the development financial gate. Every workflow completed without a provider/tool failure. Merchant outcomes and purchases were identical across approaches; model cost reduced the AI arms' platform contribution. This is evidence of functioning analysis/training/trial/revision and protection, not superior deployed campaigns.

- 96 fresh Gemini calls, 32 local model fits, 13 agent-requested revisions.
- 45 development trial requests, including incumbent checks; identical deterministic trials may reuse the cache.
- Model cost: **$0.205055** for the whole comparison. Project ledger: **$5.114372**, no unsettled entries.
- No native Sandbox payments in this comparison.

## Evaluation boundaries

Four pre-registered seeds cover discovery, reactivation, low response and zero response. All arms use the same 12 merchants, 600 shoppers, initial states, needs, consent, income and review dates. Each paid arm receives the same Flash-Lite model, tool interfaces, six-call review budget and two reviews. Historical training data is shared. Current-run labels are admitted only after maturity, and initially unfunded but later retained purchases remain positive.

Development trials use two separate preserved **100-shopper** markets as a cheap surrogate. This distribution/scale mismatch can reject a policy that would help the larger market; the gate is not a guarantee of live performance. No active confirmation-world future is exposed to a planner. Local models include direct retained-purchase and response-hurdle recipes; a complete funding/capture/return survival-model stack is not part of this POC.

The original and expanded economic kernels are unchanged. The publication check binds model bytes, campaign fields, supply settings and the tested contract hash. Model metrics, trial results, rejections and rationales are retained in [results.json](results.json). [Protocol](protocol.json) records the source hashes and caps before confirmation. All 32 fit reports are consolidated in [model-reports.json](model-reports.json). Losslessly compressed trajectories and original byte hashes are listed in [trace-manifest.json](trace-manifest.json).

## Use

Open `/studio.html` → **New live run** → **V2**. Dates pause on displayed days 31 and 61 while tools execute. Prior V1 sessions retain background behavior. The existing PayPal sample is optional, disabled in this benchmark, and separate from simulated sales.

Open `/studio.html?view=performance&evaluation=harness-v2` for the comparison and every agent handoff. This saved view incurs no model charges. A new live V2 run retains the $0.25 cap.

Checks:

```sh
node --test tests/commerce-harness-v2.test.mjs tests/commerce-autonomy-live.test.mjs tests/commerce-expanded.test.mjs
npm run baseline:verify
```

The benchmark command is `node scripts/commerce-expanded/harness-v2/benchmark.mjs --run`. It refuses to reopen an already registered pilot; preserve these results when registering a subsequent study.
