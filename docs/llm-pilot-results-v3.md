# Shared reader repair and stronger-model results

Completed 2026-10-21T12:31:59.871Z. **The repaired pipeline works better, but this comparison still does not justify the extra agent planning.**

Gemini 3.1 Pro Preview, with LOW thinking for reading and MEDIUM for planning. Exact same ten V2 development cases, two repetitions per method. Same raw evidence, oracle, tool costs, limits, fixed routing and planner prompt. No additional inference remains running.

| Method | Supported packets | Ready but failed grading | Unnecessary escalations | Harness stops | Evidence queries | Equivalent model cost | Assumed query cost |
|---|---:|---:|---:|---:|---:|---:|---:|
| Fixed workflow + Pro reader | 20/20 | 0 | 0 | 0 | 24 | $0.419648 | $0.620000 |
| Adaptive Pro investigator + same reader | 20/20 | 0 | 0 | 0 | 24 | $0.620874 | $0.620000 |

V2 produced **6/20** supported packets for each method. V3 repairs the shared reading contract and upgrades the model together; this is not an isolated test of model size. All **20 paired inputs** matched, and shared documents had identical extracted facts, quotes and reader receipts. Reader batches are costed once per unique receipt per policy, including reuse. Both methods use the same deterministic final interpreter.

## What was fixed

Physical wall-clock times are not a fair speed comparison: the second method reuses the reader cache, and both runs include deliberate request pacing. The table compares quality, source usage and equivalent model cost.

The reader now returns nullable typed fields, per-order allocation rows, verbatim supporting quotes, and partially informative old records. Explicit cancelled non-delivery is distinguished from a bare label. The shared interpreter rejects missing quantities/status/age as answers rather than inventing zero or silently dropping context. The independent three-document reader probe passed before the 40 scored trials.

These fixes were motivated by known development failures. This is not a blind evaluation or a production accuracy claim. The original cases and previous negative results remain preserved.

## Cost and value

The agent's additional equivalent model cost is **$0.201226**. Its difference in assumed source-query cost is **$0.000000**, for a combined machine-cost difference of **$0.201226** across 20 trials. Source-query prices are authored assumptions; they are not charges on the Google bill. Human review, correction and maintenance costs remain unknown, so no actual PayPal savings or losses are claimed.

The reference-only [headroom audit](llm-pilot-headroom-v3.json) shows that nine of ten fixed routes already use the cheapest sufficient evidence. The remaining case offers a two-cent assumed query saving per repetition. This small sample therefore gives an adaptive policy little room to outperform a competent workflow. The audit uses private reference answers outside the model and was never supplied to either policy.

## Actual run accounting

- Prior returned-token estimate: **$0.043416**, preserved unchanged.
- This rerun, including its reader probe: **$0.636276**.
- Cumulative token-based estimate across all runs: **$0.679692**, below the user's $10 ceiling and the stricter $8 application limit.
- V3 provider attempts: 89; returned usage receipts: 89; rejected HTTP responses: 0; pending reservations: zero.

These costs use returned input/output/thinking token counts at verified global list prices. Cache discounts are ignored; the Google billing invoice has not been reconciled. The native $10/month Vertex cap and cumulative local guard remain in place. No APAC resource/configuration/credential file was modified. No PayPal payment or reserve mutation occurred; the visual economy remains scripted.

## Decision

Use the fixed workflow with the repaired reader for these cases. The agent has not improved the measured quality/cost tradeoff. Any broader claim needs fresh reviewer-validated cases where source selection has meaningful consequences; do not add artificial complexity merely to favor an agent.

[Protocol](reader-pro-v3.md) · [Machine-readable results](llm-pilot-results-v3.json) · [V2 comparison](llm-pilot-results.md). Full trace: `.local/benchmarks/llm-pilot-10a535b4-adfc-475a-817b-9acad41708e3.json`.
