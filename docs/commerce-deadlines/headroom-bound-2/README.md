# Financial headroom audit

**The registered2× development gate cannot be reached in this six-market case set with the current actions and financial safeguards.** This is a bound on this authored simulator and registered cohort, not a claim about every possible market or PayPal production economics.

| Quantity | Total across six markets | Mean per market |
|---|---:|---:|
| Strongest fixed policy, measured | $7,458.44 | $1,243.07 |
| Required2× contribution | $14,916.88 | $2,486.15 |
| Conservative optimistic upper bound | **$11,755.60** | **$1,959.27** |

The upper-bound ratio is **1.5761473×**. It includes a further$1 per-market safety cushion after residual-corrected dual verification. No candidate is credited with this result; an actual policy need not be able to attain the bound.

## What is deliberately made easier

The relaxation knows all future requests and refund indicators. It permits fractional requests and continuous spending inside the attainable basket-price envelope. It ignores stock availability, merchant financing limits, shipping delays, carrying costs, model costs and outside purchases. Refunds restore buyer funds immediately. Counterparty floors and the closing-inventory cap are pooled across markets; the terminal-cash gate is omitted. These choices enlarge the feasible set.

Buyer resources, declared product/budget limits, payment fees, production costs, the20% quote margin floor, merchant contribution floors and the registered inventory safeguard still constrain the calculation. Actor tools remain limited to valid basket reservation/capture and funded procurement. They cannot invent requests, change prices, move arbitrary funds or force extra invoice batches.

## Accounting derivation

Use USD. For request r let g be its charged amount, n its fractional service indicator, c its cost of goods, and z the known future refund indicator. Actual policies have n either0 or1; the relaxation permits any value between them.

- The catalogue determines a minimum/maximum basket price and the declared budget. Charges cannot exceed the optimistic buyer resources available by the last permissible capture day.
- Listed product costs imply0.43g ≤ c ≤0.60g. The quote margin guard also implies c ≤0.7651g −3.985n, after relaxing shipping to a single shipment per basket.
- Retained retail payment contribution is at most0.0229g +0.30n. Refunded payments contribute at most−0.012g −0.195n. These envelopes include cent-rounding slack.
- Retained buyer spending must satisfy cumulative per-buyer resource limits. Refunded charges are treated as immediately reimbursed, which is optimistic. Existing warmup refund proceeds are included.
- If T is new procurement cost, C the cost of sold goods, I closing inventory and I0 opening inventory plus pipeline, stock conservation gives T=C+I−I0.
- Factory invoice gross G is0.7T plus a bounded cent-rounding error. Since each procurement line costs at least$7.74, the error magnitude is at most0.005T/7.74.
- Let X and Y be PayPal-funded gross at the retailer/wholesaler and wholesaler/factory stages. X≤T and Y≤G. Their platform contribution is bounded by0.0229(X+Y)+0.30(A+B), where A and B count PayPal invoices.
- The fixed daily settlement batching permits at most one PayPal root invoice and two PayPal factory invoices per scored day. Splitting procurement calls does not create additional same-rail batches.
- Wholesaler contribution is at most T−G−0.0349X−0.485A; manufacturer contribution is at most0.4G plus raw-material rounding slack minus0.0349Y−0.485B. Ignoring bank fees makes these bounds more generous.
- Positive remaining warmup cash flows receive separate conservative allowances. The model preserves aggregate retailer, wholesaler and manufacturer contribution relative to the strongest fixed policy, and total closing inventory is limited to110% of that comparator.

Maximizing these upper expressions gives a necessary financial ceiling. Every policy obeying the current simulator and the registered safeguards must lie inside this relaxation. It is therefore not legitimate to report2× merely by changing the planner or increasing its model budget.

## Verification and scope

`witness-verification.json` maps the actual strongest-fixed trajectories into the relaxation. The largest equality residual is below1e-10 USD. Their relaxed objective exceeds their measured contribution, as required for an upper bound.

`dual-certificate.json` supplies a residual-corrected dual bound. `verify-certificate.py` checks that certificate using60-digit decimal arithmetic without calling an optimizer or importing the model builder. It also checks every fee-rounding residue in the10,000-cent period.

The inputs include future information solely for this evaluator-only audit. They must never be passed to a deployable agent. No held-out policy-performance set has been opened, no native payments were made, and no paid LLM calls were used.

This bound depends on the current request universe, posted-price interface and safeguards. A broader business action set would need a separately versioned contract and a new headroom audit. The current benchmark and its failures must remain intact.
