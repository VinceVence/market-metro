# Approved additional scenario — implementation pending

The current goal remains2× settled modeled platform contribution against a strong fixed comparator, while preserving merchant contribution. No present result meets that goal. This proposal does not revise the target or claim it will succeed.

## Concrete workflow

Existing simulated shoppers submit funded shopping requests: for example, a small office needs desk supplies and a meeting device before its next opening date. A request records the customer's declared budget, acceptable product alternatives, required quantities and delivery deadline. No customer receives additional money.

The agent team must decide which requests can be fulfilled together without committing the same stock twice. It may request quotes, select products, reserve stock, arrange an existing legal restock, choose an allowed settlement rail and produce an executable payment/fulfillment plan. Bank versus modeled PayPal settlement timing can matter when inventory arrives close to a deadline. All prices, fees, funding debits and lead times must be shown; no payment is counted unless it settles.

The first demo would show three simultaneous requests competing for one stock pool, an alternative supplier, a quote that is too expensive, and a later deadline that permits cheaper settlement. These are illustrative review cases, not the hidden evaluation set.

## What requires a scope decision

This adds buyer deadlines and explicit product requirements. Those are new behavior/information mechanisms, beyond the already approved merchant price and replenishment actions. The present goal freezes the existing simulator. The user explicitly approved this extension on October31,2026: “Add the separate deadline-driven scenario.” It must remain separate from the prior benchmarks.

The current100-day v5/v6 benchmarks, their sources, negative results, UI and original v4 economy remain intact. No old comparison would be relabelled as a success. The new experiment must predeclare its own scenarios before agent development.

## Roles and tools

1. Demand analyst: identify outstanding needs, uncertainty and stock contention from observed requests and warehouse records.
2. Commercial planner: propose feasible product/price alternatives and call a bounded allocation solver; it cannot invent funds or modify buyer preferences.
3. Settlement/fulfillment planner: compare existing payment rails and inventory arrival times, then construct a typed execution plan.
4. Verifier: enforce price consent, unique stock reservation, sufficient funds, counterparties, deadlines and idempotent execution. This gate is deterministic code.

LLMs would interpret and revise business plans and choose trusted tools. Numerical allocation, money arithmetic and publication checks remain code. Whether separate LLM roles help must be tested; role names alone are not evidence.

## Comparators and success criteria

- No-intervention merchant workflow.
- Event-aware fixed rules using the same parsed requests, price books, inventory, budget and payment tools.
- A competent numerical allocation planner, to expose whether a gain comes from the solver alone.
- One LLM planner with the same tool/call budget as the specialist team.
- Specialist team with checkpoints and explicit tool handoffs.

Use identical initial states and shocks. Include ordinary demand, no scarcity, plentiful lead time, demand concentration, constrained inventory and ambiguous requirements; do not evaluate only cases selected to favor the agent. Keep hidden evaluation seeds unopened until architecture and criteria are frozen.

Measure total settled modeled platform contribution after model/tool costs, retailer and supplier contribution separately, completed requests, missed deadlines, budget violations, double allocations, latency and all model calls. Count lost and rejected orders, refunds and incomplete runs. Do not claim PayPal production ROI from this synthetic scenario.

## Cost and native integration

Build and test the deterministic environment and numerical headroom first with local compute. No new paid model calls are needed to establish that headroom. Preserve the existing$50 overall ceiling and stricter active spend controls. Do not touch APAC. Existing Sandbox receipts remain integration evidence; any new native transaction must remain within the user's established sandbox authorization and saved consent scope.
