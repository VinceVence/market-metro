# Investigator benchmark and orchestrators

Implemented October 21, 2026. **The browser lab runs scripted baselines. A separate metered Vertex CLI pilot now compares fixed routing plus an LLM reader with adaptive routing using the same extractions.** Neither is a validated production reserve-review system. See [the live model protocol and cost controls](vertex-pilot.md) and the [completed Pro rerun](llm-pilot-results-v3.md): both methods pass 20/20, and the fixed route is cheaper.

Open [the benchmark lab](http://127.0.0.1:4173/benchmark.html), or run from the project root:

```sh
npm run benchmark
npm test
```

The default run evaluates 48 authored cases with three controllers, producing 144 isolated trials. Results and full traces are saved to `.local/benchmarks/latest.json`. No credentials are required for the CLI. The browser lab uses `npm run dev` and shares the existing local server.

## What is built

| Module | Responsibility |
|---|---|
| `benchmark/fixtures.mjs` | Harness-private case documents, normalized source claims and reference answers |
| `benchmark/manifest.json` | Frozen dataset, source-query prices and latency assumptions; SHA-256 digest |
| `benchmark/environment.mjs` | Immutable observations, permitted source tools, budgets and per-case trace |
| `benchmark/analysis.mjs` | Common deterministic interpretation of retrieved evidence |
| `benchmark/controllers.mjs` | Fixed workflow, gather-all, cost-aware script and always-escalate control |
| `benchmark/scoring.mjs` | Private grader, citation sufficiency, errors, useful coverage and budget feasibility |
| `benchmark/orchestrator.mjs` | Async case loop, timeout/cancellation, matched suite execution, aggregation and human-cost joining |
| `benchmark/service.mjs` | Single-flight execution and atomic local report persistence |
| `scripts/benchmark.mjs` | CLI, freeze verification, report export and optional offline human-cost log |
| `demo/benchmark.html` | Results, source documents, selected checks and grader inspection |

The case orchestrator supplies an observation to `chooseNext(observation, {signal})`. A controller returns one permitted tool request or a terminal review packet. The suite orchestrator constructs a fresh controller and evidence environment for every case/trial, then grades only after the controller stops. Input hashes confirm all controllers received the same case, source records, tool prices and limits.

The environment receives only the public packet and source records. It never receives the oracle object. Controllers receive no case family, split, expected answers or unretrieved documents. Family metadata is appended to reports only after each trial finishes. The static server cannot serve the root `benchmark/` directory.

These are trusted in-process callbacks, not an operating-system sandbox for arbitrary JavaScript. Async deadlines supply an abort signal; the Vertex adapter combines it with a per-request deadline. No arbitrary filesystem, network, payment, refund, reserve mutation or messaging tool is exposed to the investigator.

## Cases and normalization

There are eight variants in each of six families:

- Clean, complete evidence where no extra query is needed.
- Mixed pallets requiring manifest and receiving-record reconciliation.
- Stale carrier records requiring current evidence.
- Cancelled replacement shipments with pending/completed refund records.
- Business-history context, including unrelated legal-entity records.
- Unavailable records and merchant documents containing untrusted instructions.

Development contains 32 cases from the first four families; the remaining 16 form a family-disjoint holdout. **The fixture author knew the designs. This split checks plumbing and data separation; it is not independent validation.** Fresh cases and domain review are still needed before an agent-advantage claim.

Every document has raw narrative text and authored normalized source claims. The latter are available equally to scripted baselines, which isolates planning and deterministic evidence handling. They are not outputs of a tested parser and are not evaluator labels. `runCase(..., {view: 'raw'})` removes normalized claims from controller observations for the LLM reading experiment. Scripted baselines run on normalized observations only.

The manifest freezes the cases, oracle and tool-cost catalog. `npm run benchmark:freeze` is idempotent for an identical suite and refuses to overwrite a different frozen dataset. Review/version a changed suite instead of silently replacing its reference. An alternate seed is labeled unfrozen. Each report records a separate implementation hash.

## Baselines and results

The fixed workflow has relevant conditional branches and stops when evidence is sufficient. It is not the previous blanket-reserve-hold reference. Gather-all retrieves every permitted source within budget. The cost-aware script chooses the cheapest untried relevant source; this heuristic is explicitly not an LLM agent. All three use the same evidence interpreter. The always-escalate diagnostic verifies that passing work to a human is not useful case completion.

Default seed 773, eight source calls and an assumed $0.30 source-query budget per case:

| Controller | Supported ready packets | Appropriate escalations | Unsupported ready | Calls | Assumed query cost |
|---|---:|---:|---:|---:|---:|
| Fixed conditional workflow | 41/48 | 7 | 0 | 60 | $1.72 |
| Gather all | 41/48 | 7 | 0 | 240 | $7.20 |
| Cost-aware script | 41/48 | 7 | 0 | 76 | $1.80 |

These are authored planning-control results, not AI performance or PayPal ROI. The cost-aware script does not outperform the fixed workflow. With a two-call limit, it prepares only 33 cases versus the fixed workflow's 41; its lower query bill does not establish a benefit when useful completion drops.

A ready packet can document **zero delivered units and a pending refund**. It means the requested facts are supported for human review, not that funds should be released. Every actual reserve decision stays outside this benchmark.

## Mistakes and cost

The grader checks values against private reference facts and requires sufficient citations to documents actually retrieved. Material findings also require source citations; an invented contradiction cannot earn escalation credit. Guessing a correct answer or inventing a citation cannot pass. It reports unsupported readiness, unsupported facts, missed material findings, unnecessary escalation, unauthorized tools and harness stops. It separately identifies cases that cannot be resolved under the chosen budget. It accepts alternative sufficient evidence sets and does not require a particular action order.

The optional gross-exposure field measures overclaimed delivered value under an authored case. It is not realized PayPal loss. A blanket-escalation run has zero useful completion and 41 unnecessary escalations at the default budget.

Model calls/tokens are zero for the implemented scripts. Query prices and source latency are **authored assumptions**; no query API bill is incurred and the runner does not sleep for the virtual latency. Actual local execution time is recorded separately. Total handling cost remains null while human review/correction work is unknown.

For an offline review study, use `attachHumanCostStudy(report, entries, {hourlyRateCents})` or:

```sh
npm run benchmark -- --human-log review-log.json --hourly-rate-cents 3000 --out .local/benchmarks/with-human-study.json
```

Each entry identifies `caseId`, `controllerId`, `repeat`, `reviewSeconds`, `correctionSeconds`, and provenance `recorded` or `assumed`. Use IDs from the run. The hourly rate is an explicit assumption. Partial observations keep aggregate cost unknown; missing model cost also remains unknown. Grades are not changed by attaching time data. Estimates exclude local compute pricing and engineering/maintenance costs, and do not establish actual provider profit.

## Controls and interface before an LLM

```sh
npm run benchmark -- --split holdout --controllers fixed_workflow,cost_aware_script --out .local/benchmarks/holdout.json
npm run benchmark -- --max-calls 2 --out .local/benchmarks/two-calls.json
npm run benchmark -- --controllers abstain_control --out .local/benchmarks/abstain.json
npm run benchmark -- --controllers fixed_workflow --repeats 2 --out .local/benchmarks/determinism.json
```

Repeated scripts check determinism, not statistical model reliability. An LLM controller must supply model-usage metering. Paid runs use `scripts/llm-pilot.mjs`, never the browser's scripted controller factory. The shared case loop and grader are reused.

The model receives only the observation and approved tool names. The raw-document pilot shares semantic extraction across the two policies and records a separate authored-normalization reference. Do not give the tested model this repository's fixture generator, the authoring contract's evaluator answers, prior scored traces, or unrestricted filesystem/browser tools during an evaluation.

## Validation

All 123 tests pass: the original 110 include 14 benchmark tests covering fixture reproducibility/splits; hidden-state isolation and raw observations; strong baseline outcomes; fresh matched trials; guessed answers and fabricated citations; unsupported exposure; blanket escalation; cost/call/turn budgets; unauthorized tools; timeout/malformed output; unknown human/model costs; single-flight persistence/freeze mismatch; and the HTTP/static-file boundary. Thirteen Vertex/reader tests additionally cover durable spend admission, uncertain outcomes, project/cap pinning, usage metering, shared reader success/failure, preserved historical spend, grounded partial records and prohibited actions.

The browser executed the baseline suite and a two-call run with the always-escalate diagnostic. It showed the expected coverage/cost changes without browser errors. CLI and browser use the same orchestration and grading modules.
