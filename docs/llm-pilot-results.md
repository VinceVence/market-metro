# Live LLM pilot results — October 21, 2026

**The current adaptive investigator did not earn its extra complexity or cost.** This is evidence about this implementation and these authored cases, not all agents or PayPal production.

Project: [Supply Yard Pilot](https://console.cloud.google.com/home/dashboard?project=supply-yard-pilot-261021). Model: gemini-3.1-flash-lite. Ten known development cases, two trials per method, 40 case trials total. No holdout or independent human-review study. The main Supply Yard economy remains scripted.

| Method | Packets passing all checks | Marked ready but failed grading | Unnecessary escalations | Harness stops (subset of escalations) | Evidence queries | Equivalent model cost | Assumed query cost |
|---|---:|---:|---:|---:|---:|---:|---:|
| Fixed workflow + LLM reader | 6/20 | 4 | 10 | 6 | 22 | $0.018216 | $0.600000 |
| Adaptive investigator + same reader | 6/20 | 4 | 10 | 6 | 35 | $0.036876 | $0.840000 |

Equivalent model costs count shared reading as though each method independently paid for it. Query prices are authored assumptions; they are not API charges. Human handling and maintenance cost are unknown. All 20 paired comparisons had identical inputs and matching extractions for shared documents. Physical wall times are not comparable because of shared reader caching and request pacing.

## What actually happened

- Passed: 12 trials across both methods.
- INVALID_MANIFEST: 12 trials across both methods.
- Missed STALE_EVIDENCE: 8 trials across both methods.
- Missed REPLACEMENT_CANCELLED: 8 trials across both methods.

The stale-record failures returned the correct delivery count but omitted the required stale-evidence warning. Do not describe these as wrong monetary amounts or actual fund releases. Mixed-pallet manifest outputs omitted the allocation array; the harness rejected them for both methods. Cancellation-case details and all reasons are retained in the full trace.

In one complete-evidence case (CASE-1ef2a6730c5d), the fixed workflow needed no extra source check. The agent requested two additional sources and reached the same supported answer. More queries did not create more value in that case.

## Cloud cost and operational record

Total estimated token cost, including the initial V1 probe: **$0.043416**. V2 alone: **$0.037466**. There are 142 returned usage receipts and 2 explicitly reconciled non-200 responses. No pending reservations remain. These are returned-token estimates at verified list prices, not a reconciled Google invoice.

V1 was excluded because failed extractions were not reused consistently. V2 added JSON schemas, shared failures and pacing before this comparison. A provider HTTP429 interrupted V2; one explicit continuation used the same model, prompts, cases, grader and cumulative $1 allowance at a slower request rate. Its failed infrastructure attempt is preserved separately. Quality results are conditional on completed provider execution; this is not an availability benchmark.

A $10/month native Vertex spend cap is configured on this project, with an $8 lifetime application limit and $1 per run. Native caps can lag and allow overage; the local limit supplies a buffer. No APAC resources/settings were changed, and no new PayPal checkout, refund or reserve mutation occurred. See [setup verification](gcp-pilot-setup.json), [protocol and safeguards](vertex-pilot.md), and [Google cap limitations](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps).

## Decision

Do not expand this prototype into an agent mesh or claim PayPal ROI. The fixed route with the same reader matches the agent's case outcomes at lower measured/assumed machine cost. Repair and validate the shared reading contract first; any future adaptive-policy claim needs new reviewer-validated cases where selecting a different source can improve the result. Preserve this negative result and the strong baseline.

[Machine-readable summary](llm-pilot-results.json) · [Frozen V2 plan](llm-pilot-plan-v2.json). Full local trace: `.local/benchmarks/llm-pilot-50ab9565-034e-4bc5-acc4-84faba3f055d.json`.
