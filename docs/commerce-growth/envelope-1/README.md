# Exact-basket financial feasibility audit

This is an **evaluator-only upper bound, not a measured policy or agent improvement**. It covers the seven registered development markets and the existing legal commerce actions. The latest fresh-agent result on different, unseen markets remains 1.001× strong fixed rules.

| Protection retained in this audit | Optimistic ceiling / fixed |
|---|---:|
| Each retailer's contribution plus the registered inventory cap | 1.708× |
| Aggregate retailer contribution plus the same inventory cap | **1.829×** |

The weaker aggregate-retailer version relaxes individual retailer and supplier profit floors and the terminal-cash guard. It still cannot reach 2× **on this development cohort under the registered closing-inventory allowance**. The allowance is 110% of the fixed comparator's closing inventory. It is a benchmark safeguard, not a law of commerce or a PayPal policy. This audit does not establish a universal limit across other cohorts or broader action sets.

## What was made more precise

The earlier financial relaxation allowed fractional requests and continuously variable spending within an item's price envelope. This audit enumerates complete baskets using the frozen catalogue, accepted alternatives, quantities, merchant costs, fees, shipping charges and margin constraints. Each buyer then chooses at most one complete basket per need, subject to their own cumulative funds by the latest capture date.

Actual customer response and refund facts are known only to the evaluator. Impossible-to-contact needs are excluded. Contact-window inequalities enforce necessary conditions for the seven-day contact gap. They are deliberately weaker than full scheduling. Stock availability, physical dispatch limits, operational financing, outside-market spending, delayed refund liquidity, holding costs, failed-contact costs and LLM costs are relaxed. These choices make the ceiling optimistic.

The independent mapping audit re-enumerated 59,891 legal combinations and checked 892 actual captured baskets from the strongest fixed workflow. Every recorded basket was covered; stock-cost identities had zero residual. All original economic and controller source hashes remained unchanged.

## Financial derivation

Use cents. A legal basket has exact retail platform contribution `p`, goods cost `c` and a retailer contribution vector. Refunded baskets include the processing loss and no retained checkout fee. A discovered hidden need incurs at least one five-cent outreach cost.

Let `T` be new procurement cost, `C` the cost of sold goods, `I` closing inventory cost and `I0` opening inventory plus pipeline cost. With the clearing tail, valid completed trajectories satisfy `T = C + I - I0`.

Factory invoice gross is at most `0.7T + 0.5T/m`, where `m` is the minimum cost of a procurement line in cents. The extra term bounds the half-cent rounding per line. PayPal supplier contribution is at most `0.0229 × (root gross + factory gross) + 30 × invoice count`. Therefore its variable part is bounded by `beta × T`, with `beta = 0.0229 × (1.7 + 0.5/m)`.

This converts the platform objective into a sum of basket rewards `p + beta × c - minimum outreach cost`, plus an inventory/batch allowance. The inventory term uses the registered `I <= 1.1 × fixed closing inventory` guard. Batch limits follow the last day on which procurement can legally serve an authorized request, or be ordered using the pre-close forecast. The minimum physical lead is three days; customer quotes reserve two delivery days. There is at most one PayPal root batch and two PayPal factory batches per eligible day. The documented warmup allowances are retained.

For any nonnegative multiplier on a coupled constraint `A x <= b`, `p x <= multiplier × b + (p - multiplier × A) x`. A linear program finds useful multipliers; its optimality is not needed for the certificate. Independent per-buyer dynamic programs maximize the adjusted reward over complete baskets and prefix budgets. Rewards round upward to nanocents, and an additional $1 per market is added to the final bound.

## Verification

- `mapping-verification.json`: independent quote enumeration and actual fixed-trajectory checks, using the frozen fee/cent-allocation primitives.
- `verification.json` and `aggregate/verification.json`: independent rational/integer arithmetic and sparse-dictionary dynamic programs, with no optimizer or model-builder imports.
- `certificate.json` and `aggregate/certificate.json`: multipliers, per-buyer maxima, constants and upward-rounding accounting.
- `choice-model.json`: evaluator-only choice and coupling data. Never supply this to an application agent.

The implementation of the general envelope and timing lemma must remain part of the proof; a passing arithmetic verifier alone would not validate an incorrectly modeled problem. Source review, exhaustive quote coverage and actual-trajectory membership address different obligations.

## Sensitivity and limits

Increasing the closing-inventory allowance increases this optimistic ceiling. With aggregate retailer protection, the allowance would need to exceed approximately **2.062× the fixed closing inventory** merely for the bound to reach 2×. That does not establish a feasible strategy, saleable inventory, preserved cash or an actual 2× gain. `inventory-sensitivity.json` retains the full calculation.

The current 110% safeguard prevents an apparent platform win obtained largely through extra supplier payments and terminal stock accumulation. Whether another capital-risk policy is appropriate is a separate evaluation decision; it must not be silently changed to make a failed result pass. The current economy and benchmark remain untouched.

A supplementary calculation removes that inventory cap and instead preserves aggregate closing partner cash, while retaining retailer contribution floors. Its conservative upper envelope is **2.370×** with either aggregate or individual retailer contribution protection. The arithmetic certificate is checked in `cash/verification.json` and `cash-individual/verification.json`; cash-flow identities were checked on already recorded trajectories in `cash-mapping-verification.json`.

For this calculation, let `U` be PayPal supplier-payment volume, `T` procurement cost and `N` supplier invoice count. With minimum line cost `m` cents, `U <= aT` for `a = 1.7 + 0.5/m`. Raw-material expense is at least `gamma T`, where `gamma = 0.42 - 0.8/m`; PayPal supplier fees are at least `0.0349U + 48.5N` cents. Define `eta = 0.0229 / (0.0349 + gamma/a)`. Supplier contribution is then no greater than `eta × (raw expense + supplier fees) + (30 - 48.5 eta)N`. Preserving partner cash limits those expenses by actual retained retail cash inflow plus documented warmup allowances. This yields another separable basket envelope without assigning an arbitrary inventory maximum.

**Interpretation:** the 1.829× result is not a universal impossibility claim. The inventory safeguard materially limits the registered comparison. The cash-preserving envelope leaves theoretical room, but it neither supplies a feasible observed-only policy nor shows that extra inventory is useful or saleable. A later controller study must report both the original scorecard and capital/inventory effects; the current result cannot be promoted by silently discarding the failed guard.

No new model or native payment calls were made. The full 2× agent goal remains unachieved.
