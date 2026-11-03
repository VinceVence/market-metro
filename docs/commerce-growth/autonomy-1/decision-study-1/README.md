# Fresh campaign decisions: matched single planner and specialist team

The measured campaign improves on fixed rules, but this study **does not justify a multi-agent advantage**. Both LLM approaches rejected their weaker proposed changes and selected the same existing numerical policy. The numerical policy alone produces identical shopper outcomes without the additional model-call cost.

Run `DECISION-99b28df73ad85720`, completed November 2, 2026. The app shows it under **Performance → Campaign decisions · equal-budget comparison**. This is a saved experiment; the current live controller is unchanged.

## What was implemented

The model now writes an executable, bounded campaign rather than choosing only predefined labels. It controls an observed-feature eligibility expression, a ranking expression, and the daily contact limit. A trusted local tool measures the exact proposed program on historical markets. The reviewer can revise once; the coordinator selects a hash-bound measured artifact. Consent, existing buyer funds, fulfillment, stock, settlement, and all 12 frozen economy files are unchanged.

The three specialist contexts are campaign strategist, measurement scientist/critic, and commerce coordinator. The single planner receives the same evidence and expertise instructions, local models, three Gemini calls, and two trial opportunities. Both use Gemini 3.1 Flash-Lite with MEDIUM reasoning. There were no developer subagents, APAC operations, or native payment calls.

```mermaid
flowchart LR
    W[Observed market history] --> M[Shared local prediction tools]
    M --> P[LLM campaign proposal]
    P --> V[Validate bounded expression]
    V --> T[Historical simulation trial]
    T --> R[LLM critique and optional revision]
    R --> T2[Measure exact revised artifact]
    T2 --> C[LLM selects tested campaign]
    C --> G[Hash and financial checks]
    G --> F[Freeze before unseen seeds]
    F --> E[Seven matched confirmation markets]
    E --> PP[Funded requests / captures / delivery / refunds]
    PP --> O[Settled outcomes and cost]
```

Numerical tools are ordinary software, not extra LLM agents. The market continues to process organic purchases. LLM calls happen during campaign design; the frozen resulting program executes locally in the confirmation markets. This is not an online per-day LLM intervention study.

## Results on seven unseen seeds

Each market has 100 shoppers, 100 market days, and 26 settlement days. Values are means per market. All actual design-call cost is deducted once, distributed across the seven confirmation markets. A reused identical program reuses its deterministic simulator result; this is not independent agent replication.

| Approach | Modeled payment net after AI | Retailer contribution | Retained purchases | Exact recommended-product purchases |
|---|---:|---:|---:|---:|
| Strong fixed | $729.32 | $8,698.67 | 128.29 | 23.86 |
| Shared numerical models, no LLM | $741.07 | $8,832.11 | 129.43 | 19.57 |
| Single planner, three fresh calls | $741.07 | $8,832.11 | 129.43 | 19.57 |
| Specialist team, three fresh calls | $741.07 | $8,832.11 | 129.43 | 19.57 |

Team versus fixed: +$11.7475 modeled payment net (+1.61%), +$133.4371 retailer contribution, +1.1429 retained purchases per market. Five of seven markets improved payment net; two declined. Exact recommended-product purchases declined because the selected policy also uses general need inquiries. This is not a universal recommendation lift claim.

All approaches had zero unpaid liabilities. Confirmation seeds were 991210–991216, one per existing regime. They are now spent evaluation seeds, not future holdouts.

The team and single planner chose the same program hash, `7cfeae02dbb9befcd567b931799877872d28bd678dbf58004a557a8440611d01`. No commerce benefit can be attributed to splitting the planner into roles. The team's slightly shorter prompts cost $0.002110 less in total; that is not decision improvement.

## What the team actually decided

1. **Strategist:** broaden recent-interest eligibility and inbound-delivery tolerance; allow inquiries following a search. Historical result: +$8.85 payment net and +$115.14 retailer contribution versus fixed, but below the existing numerical policy.
2. **Scientist/critic:** tighten interest age to six days and arrival tolerance to four. Historical result: +$3.69 payment net and +$1.91 retailer contribution versus fixed. The revision was worse, despite its plausible explanation.
3. **Coordinator:** reject both and publish the measured numerical policy: +$14.88 payment net and +$140.52 retailer contribution on historical markets. The unseen-market result is reported separately above.

The single planner also rejected its revision and selected that numerical policy. Its first proposal produced the same historical outcomes as the control; its second cut too much contact capacity. This is evidence that the measurement/selection harness avoids deploying weaker ideas. It does not establish that an LLM, or three LLM roles, is necessary to select the best measured candidate.

Some raw justifications overstate “optimal” or “significant.” They remain preserved as model outputs; neither claim was established. No hand-written successful campaign was substituted for the model's proposals.

## PayPal and cost

PayPal's modeled role is authorization of existing buyer funds, capture of a complete basket, supplier settlement, delivery/refund reconciliation, and payment-fee/processing accounting. Those outcomes determine the objective. The simulation's fees and behavior remain assumptions, not production PayPal data or profit. Native Sandbox receipts from prior integrations are separate records and are not double-counted in this comparison.

Six fresh calls cost **$0.017326** by recorded token usage and configured list prices: single $0.009718; team $0.007608. The additional limit was $0.25. Lifetime recorded model estimate after the study is **$3.640225**, with no unsettled ledger entries. These are estimates, not a cloud billing invoice. No paid retry or further search ran.

## Evidence and limits

- `protocol.json`: preregistered cases, equal budgets, objective and frozen economy hashes.
- `shared-evidence.json`: common model/market evidence supplied to both arms.
- `progress.json`: every raw model input, output, tool measurement and provider receipt.
- `frozen-decisions.json`: exact selected policies saved before confirmation opened.
- `confirmation-rows.json`: every paired market, including negative outcomes.
- `results.json`: measured financial and activity summary.
- `attribution-audit.json`: correction of a reporting predicate that initially counted different token costs for identical campaigns as multi-agent value. The original raw report is retained; no measurements or policies changed.
- Saved source snapshots and per-policy traces preserve the execution evidence.

Seven markets with one design per approach are a screening pilot, not a statistically established multi-agent advantage. More role labels or another threshold search are not justified by this result. A later design needs agents to contribute distinct analytical work and needs ablations that isolate that work; the current strong model policy remains a useful baseline.

## Reproduction

Local checks: `node --test tests/campaign-experiment.test.mjs tests/commerce-program.test.mjs`.

The study refuses an existing output directory. A new paid run requires a fresh directory and the explicit `--run-authorized` flag; running the UI or exporter does not call a model. The current result should not be repeatedly retuned against these confirmation seeds.
