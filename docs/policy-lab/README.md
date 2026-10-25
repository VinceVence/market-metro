# Commerce Policy Lab

The latest [trusted workflow and confirmation](benchmarks/v4-1/README.md) completed **24/24** authored requests with a source-ID Gemini interpreter versus **17/24** with the same downstream workflow and a command parser. The default uses predictable workers after interpretation; extra free-form planning was not promoted. [Open the standalone demo](http://127.0.0.1:4173/trusted.html) for recorded evidence or a live request. No saved private economy is required for playback.

Open Market Metro and click **Run demo**. This opens Policy Lab settings. The existing district UI and older simulation controls remain available.

[Open the completed POC](http://127.0.0.1:4173/?run=GARDEN-LAB-df43cd08499c0c0a&policyLab=GARDEN-LAB-df43cd08499c0c0a)

[Scope and budget](poc-scope.md) · [Measured trial](runs/GARDEN-LAB-df43cd08499c0c0a/summary.md) · [Decision CSV](runs/GARDEN-LAB-df43cd08499c0c0a/decisions.csv)

[Benchmarks, improvement goals and research figures](benchmarks/README.md) · [Open the Benchmarks tab](http://127.0.0.1:4173/?run=GARDEN-LAB-df43cd08499c0c0a&policyLab=GARDEN-LAB-df43cd08499c0c0a&policyView=benchmarks)

The v1 evaluation contains 400 local worlds across 100 paired cases, with clustered uncertainty, cost accounting, simulator probes and agent-trace findings. It tests transfer of saved plans with local refitting; it does not substitute replay for fresh LLM evaluation. The computed economic goals remain unmet.

The [fresh Gemini v2 evaluation](benchmarks/v2/README.md) uses new live model decisions, unchanged original rules, a code-only conservative control and new seeds. Its protocol and paid-call ledger are separate from the v1 saved-plan benchmark. The normal live-demo runner remains unchanged pending the promotion criteria; the new policy is available in the evaluation runner and its decision log.

The [research workflow v3](benchmarks/v3/README.md) adds actual Gemini-written SQL, bounded feature recipes, local training, development pilots and independent review. The Benchmarks tab now opens its six-mission recorded office replay, research figures and annotated failures. All six workflows completed; economic superiority was not established. v1 and v2 remain accessible. The live planner has not been replaced by this research runner.

## What is autonomous

Three separately prompted Gemini roles choose an evidence investigation, a bounded campaign/model plan, and an approval/narrowing/rejection. The scientist can fit or reuse a local contextual ridge bandit. Every request, proposed decision, correction and publication has a saved checkpoint. One final reviewer sees the sealed comparison only after the outcome tail and recommends a next policy; this does not authorize another run or payment.

Merchant actors enforce their own stock and modeled margin constraints in code. Shoppers use seeded behavioral assumptions. The bandit fits actual local coefficients from mature recorded rewards. These components are labeled separately from the LLM roles; full sequential RL and multi-agent RL are not implemented.

## Data and effects

Cached Channel3 records provide catalog provenance. The emulator generates behavior and transaction tables. A chosen native sample can use the existing sandbox wallet and receipt adapter, subject to its standing authorization. New experiments default to **no new sandbox payment**. Prior native proof is visibly labeled as a reference and never counted as a current purchase.

The goal is a platform incentive decision. The displayed platform contribution is a proxy with explicit fee, processing, reimbursement and return assumptions, not PayPal's actual profit. The three branches share initial conditions and exogenous draws. LLM latency affects publication time, so reproducibility requires saved policy activation times as well as a seed.

## Code map

| File | Responsibility |
|---|---|
| `scripts/policy-lab/economy.mjs` | Shared seeded market mechanics, merchant constraints, synthetic payments and delayed rewards |
| `scripts/policy-lab/learner.mjs` | Local ridge fits, temporal validation and bounded exploration |
| `scripts/policy-lab/service.mjs` | Role contracts, checkpoints, independent market clock, controls and final evaluation |
| `scripts/policy-lab/schema.mjs` | Six base tables and the joined customer journey view |
| `demo/garden/policy-lab.mjs` | Setup, district/office view, evidence, comparisons and shopper trace |

`npm test` runs the offline tests. `node scripts/policy-lab/replay.mjs <run-id>` verifies a stored run without cloud or payment calls. `node scripts/policy-lab/report.mjs <run-id>` exports results while the local server is running.

The existing model spend ledger is reused. Its stricter USD8 lifetime limit and USD0.25 per-run limit remain in force below the user's USD50 whole-hackathon ceiling. Nothing was provisioned in APAC.
