# Constraint-mediated commerce planning

The implemented improvement is a rolling-horizon numerical planner with checkpointed handoffs and atomic simulated execution. It is a tool for a future LLM team, **not a completed multi-LLM architecture or a winning economic result**. All original benchmarks and their negative outcomes remain intact.

## The research-backed design

Three ideas are useful together:

1. **Plan several days, commit only the current action, and observe again.** Model predictive control makes stock, supplier lead times and cash dependencies explicit. A current-day basket optimizer can miss those dependencies. Our horizon is ten days; it includes only already observed funded requests and confirmed or bounded supplier arrivals. Future customer requests are not exposed. [Boyd, Model Predictive Control](https://web.stanford.edu/class/ee364b/lectures/mpc_slides.pdf)
2. **Use LLMs to propose bounded plans and numerical tools to evaluate them.** LLMPC studies sampled action sequences with external cost/constraint feedback. Its solvable control example favors exact MPC over approximate LLM planning. That supports keeping arithmetic and allocation in tools; it does not promise a commerce profit multiplier. [Maher, LLMPC](https://arxiv.org/pdf/2501.02486)
3. **Route concrete constraint failures to the responsible planning stage.** Formal planning research uses solver feedback to guide further information gathering and plan repair. Its guarantees concern the encoded problem. Market Metro also needs to verify the mapping from real observations to constraints. Our current feedback is a typed execution failure, not a claimed minimal SMT unsatisfiable core. [Hao et al., planning with formal verification tools](https://arxiv.org/pdf/2404.11891)

These methods already exist. The application hypothesis is that connecting semantic commerce decisions to inventory, settlement timing and an audited contribution ledger makes agent coordination more useful. We have not established that this combination is globally novel or absent from private PayPal research.

## Proposed LLM roles and implemented tools

| Stage | A future LLM's decision | Implemented deterministic responsibility |
|---|---|---|
| Demand scientist | Is a demand shift meaningful? Which permitted forecasting hypothesis deserves a bounded trial? | Observed-only Gamma-Poisson forecast and explicit cutoff; the current window is fixed |
| Commerce strategist | Which eligible needs and alternative-product proposals should be investigated, and why? | Funded basket candidates with product, quantity, margin and deadline validation |
| Supply and settlement planner | Which stock/payment dependencies warrant replanning? | Joint inventory schedule and legal bank/PayPal procurement options |
| Coordinator | Request a bounded revision based on evidence; choose a validated contract | Shared optimizer combines choices under cash, stock and time constraints |
| Verifier and executor | No LLM authority to waive checks | Reject stale snapshots; validate action limits; commit only today's actions atomically; record receipts |

The current prototype implements the right column. No paid agent roles were invoked for this experiment. Before adding the left column, compare a single planner with the same tools against the specialist team under equal call and local-search budgets. More roles are justified only by measured quality or reliability changes.

## Actual checkpoint sequence

`OBSERVE → DEMAND_MODEL → PROPOSE → COORDINATE → VERIFY → COMMIT`

An execution-state change can add:

`REPLAN → REVISED_SUPPLY → VERIFY_REVISED_SUPPLY → COMMIT`

Every plan records a hash of its observed snapshot. The optimizer schedules hypothetical future captures, but they are not reservations, promises or receipts. Only today's captures and funded procurement instructions execute. On the next day the planner solves again using updated observations.

The original trial found a meaningful handoff failure: separately permitted procurement routes could jointly exceed the pending-demand limit. The execution guard rejected the overlarge order. Longer-lead orders now have nested demand limits so competing payment routes cannot consume the same procurement capacity. This fixed the benchmark failure.

The workflow also supports one bounded repair if a procurement plan is invalid after today's purchases: roll back the uncommitted simulated batch, observe the post-purchase state, and recompute the supply stage. That repair path is checked by fault injection. It was not invoked in the completed six-market run; all 576 daily solver calls passed without an extra planning call. The saved trace must not claim otherwise.

Atomic rollback applies only to this local simulator. A real PayPal capture is an external fact and cannot be rolled back by restoring JSON. Native execution requires durable intent, idempotency, receipt reconciliation, and explicit refund/compensation actions where appropriate.

## Concrete recorded day

In ordinary development market 970100, day 30 had five funded requests. The tool produced 170 basket schedules and 132 procurement options. It captured three requests immediately, purchased one replenishment unit, and scheduled two remaining requests for day 33.

Those two requests were actually captured on day 33 for $26 and $144 and delivered on day 35. Their records are `SIMULATED_NOT_PAYPAL_RECEIPT`; no native Sandbox call was made. The full decision and later outcomes are in `horizon-trial-2/example.json`. This example explains coordination, not incremental lift by itself.

## Measured result and interpretation

| Mean across six identical development markets | Strong fixed | Rolling planner |
|---|---:|---:|
| Settled modeled platform contribution | $1,243.07 | $1,228.35 |
| Retailer contribution | $14,833.98 | $15,006.28 |
| Wholesaler contribution | $2,956.82 | $2,963.86 |
| Manufacturer contribution | $2,912.32 | $2,908.82 |
| Retained purchase volume | $32,127.67 | $32,313.00 |
| On-time requests | 245.33 | 241.67 |
| Unpaid liabilities | 0 | 0 |

The platform ratio is **0.988×**, not 2×. Higher retained purchase volume does not automatically produce higher total platform contribution when transaction counts and upstream payment choices differ. The manufacturer floor also fails. The candidate is not promoted. Each fixed financial result, initial-state hash and request-stream hash reproduced the original reference exactly.

The new coordination path averages about 44 ms for the per-market 95th-percentile planning duration. This includes proposal generation, worker communication and any revision. The old fixed timing field measures its narrower allocation step, so it is not a fair end-to-end latency ratio. All solver calls completed within their configured limits. Report full run times separately.

An independent optimistic ceiling already limits the registered case set to 1.576×. Further diagnostics give 1.612× for bounded price flexibility and 1.817× with five times the reference closing inventory. Neither is a legal deployed policy or agent score. Removing buyer funding constraints gives 3.276×, which illustrates an invalid way to manufacture the requested improvement. None of these diagnostics changes the economy or the goal.

## Advancement remains conditional

The 2× target remains active and unmet. Do not spend on a bigger LLM group merely to optimize a case whose financial ceiling is lower than the target. A separately approved growth scenario would need finite opportunities, the same real funding constraints, legitimate consent, equal actions for all baselines, an untouched test set, and a new headroom audit. Its assumptions and negative results would remain visible. The existing customer-growth proposal is not activated by this implementation.
