# Deadline-driven commerce scenario

**User-approved extension with completed local economic, coordination and headroom audits. The 2× goal is unchanged and unproven.**

Implemented: seeded requests, product alternatives, quantities, explicit customer budgets, delivery deadlines, authorization holds, inventory reservations, idempotent simulated captures, delivery, refunds/fee liabilities, expiration/outside purchases and a policy observation boundary. Every authorization moves existing wallet funds into a separate hold account. Failed funding attempts create no money. Policies cannot see future requests, the simulator seed or individual income profiles.

The new case retains the prior initial-wallet and weekly-income formulas and payment fee assumptions. Unspent income is retained instead of being discarded at a wallet-cap boundary, so every comparator receives the same exogenous funding. Old v5/v6 scores remain separate and cannot be directly compared with this scenario.

Scenarios are ordinary demand, scarce stock, concentrated needs, mixed deadlines, supplier delay and preference shift. They are authored test conditions, not measured PayPal workloads. Buyer requirements are firm conditional requests: an executable quote must meet the declared budget, products, quantities and deadline. They are not guaranteed orders; inventory, funding, settlement and fulfillment still have to succeed.

A scripted $64 basket passes request → authorization → reservation → simulated capture → on-time delivery. The smoke trace is in `smoke-1/trace.json`. Supplier procurement now includes retailer-to-wholesaler and wholesaler-to-factory settlement, physical lead times, funded clearing, stock delivery and expense accounting. These are local simulated records, not native PayPal receipts. Request creation and authorization holds never count as revenue.

## Validation completed

- Identical seeds reproduce the same request stream and funding transitions.
- Money remains conserved across income, holds, releases and outside purchases.
- Insufficient funds and negative transfer amounts are rejected.
- Observation packets omit private household state, the seed and future refund outcomes.
- Repeated captures with the same key, including after a JSON checkpoint restore, do not charge twice.
- Competing reservations cannot consume the same unit; expired quotes cannot capture.
- Refunds conserve money and unpaid fee rebates remain explicit liabilities.

Run the current checks with `node --test tests/commerce-deadlines.test.mjs`.

## Completed comparisons and next architecture

`development-1/` contains 48 matched runs: five fixed workflows and three numerical allocators across six development markets. The strongest fixed workflow averaged $1,243.07 modeled platform contribution; the best original joint allocator averaged $1,242.23. All runs closed without unpaid liabilities. The independently verified ceiling in `headroom-bound-2/` is 1.576× under the registered action set and safeguards; it is not executable agent performance.

`constraint-audit-1/` isolates the effects of pricing, inventory and funding constraints without modifying the simulator. Even an optimistic 25% price envelope reaches only 1.612× with unchanged buyer resources and the retained safeguards. Removing funding constraints creates an invalid apparent gain; that diagnostic cannot count as success.

`horizon-trial-2/` contains a complete comparison of a new rolling-horizon controller with an exactly reproduced fixed baseline. It schedules current purchases and future replenishment together and replans if completing purchases changes valid procurement limits. Its platform result is 0.988×, retailer contribution improves by $172.30 per market, and manufacturer contribution falls by $3.50. It fails the promotion gate. `horizon-trial-1/` retains the original handoff failure.

The working numerical tool and checkpointed execution boundary are described in `constraint-mediated-architecture.md`. Fresh single-LLM and multi-LLM trials remain unrun. They need economically feasible headroom, a frozen protocol, identical parsed requests and tool access, matched costs, and independent markets. No numerical or hindsight result should be called multi-agent performance.

No new paid model calls or native PayPal actions have been made for this extension. APAC is untouched. See `scope.json` for the recorded user authorization and the retained benchmark boundaries.
