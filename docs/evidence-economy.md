# Supply Yard: receipt-linked evidence economy

The main page at `/` reuses a completed PayPal sandbox receipt as the reference for Mara Paper's first simulated order. It reads the local `/api/paypal/orders` snapshot once on page load. Run, restart, investigation, local approval and subsequent shifts make no PayPal calls. No additional order or capture was created during validation.

The native receipt proves only the original sandbox payment: $100 gross, $3.70 fee, $96.30 net, capture `7UA38506PR3477149`. The original proof artifact was verified at `2026-10-20T14:37:46.312Z`; the main page displays the verification timestamp in the currently saved local snapshot. Its original quantity is ten $10 kits. A generated order is never relabeled as another provider transaction.

## What happens in one run

1. **Orders.** Four offices per merchant generate demand. The reference anchors exactly one first-shift order; all ledger entries are explicitly simulated replays.
2. **Restocking.** Merchants use available cash, and suppliers allocate limited stock in a fixed queue. Consolidated vans collect, pack and deliver.
3. **Evidence.** Arrivals generate unit-level initial scans and private source records. Missing scans can hide a real delivery, a failure, or a carrier record for another order.
4. **Investigation.** Risk asks to retain funds while facts are missing. Evidence requests carrier records for gaps and matches the order and kit IDs. Risk challenges absent or mismatched records with an office query. Commerce asks to act on recovered proofs; Coordinator recommends bounded merchant releases.
5. **Reserve decision.** The reviewer chooses the full hold, the initial-feed calculation, or the investigated calculation. The last two use the same formula. Scripted roles cannot approve their own recommendations.
6. **Consequences.** Released reserves become that merchant's available cash. The generated refund window closes and refunds actual undelivered units. Remaining cash and reserves carry into the next shock.

The environment's source records are held in a module-private `WeakMap`, outside the state passed to investigators. `investigatorView()` exposes only order reference fields and published evidence. Request selection and reserve calculation do not use physical delivery counters or hidden outcome draws. Physical counts are visible to the demo audience, labeled as environment state.

## The concrete case

Mara's initial cash is an authored $50. Buying ten kits costs $40, leaving $10 available. The order's $96.30 net is held for review.

| Decision | Proofs used | Hold after review | Cash released | Actual kits purchased next shift |
|---|---:|---:|---:|---:|
| Keep full hold | None | $96.30 | $0 | 1 |
| Use initial feed | 2 | $84.00 | $12.30 | 3 |
| Use investigated evidence | 6 | $52.00 | $44.30 | 9 |

These three rows come from complete deterministic replays with the same seed and inputs. They are not live PayPal results. The main UI executes only the selected branch.

The investigation recovers four matching carrier proofs. Four kits remain unverified. Target hold = $40 unverified gross + $12 buffer on verified gross. After approval, $40 in generated refunds reduces the $52 review hold to $12. Mara has $54.30 cash available, so the next shift's $5.60 procurement cost permits nine purchases. Reserve release is a transfer of merchant-owned funds, not a PayPal expense or profit.

Jun Print's first order supplies the adverse case: two carrier responses say delivered but reference another order. Office responses report not received. No kit is verified and no reserve is released. Some other delivered kits also remain unresolved when no matching carrier proof is available; an office claim alone is insufficient under the demo rule.

## Explicit assumptions

- 12, 36 or 120 merchants; four offices each; three suppliers; seed 773.
- Retail $10; procurement $4, $5.60 and $4.80 across supplier outage, freight shock and demand surge. Stocks, outcomes and evidence availability are generated.
- Each merchant starts with $50 working capital. New net proceeds enter a 100% review hold. This is not PayPal's default reserve policy.
- Generated fees are an assumed 3%. The single referenced order uses its actual saved sandbox fee. No extrapolation of that fee to other orders.
- Target = unverified gross + 20% of verified gross, capped at that order's net. A cap can leave the target underfunded; the export includes that shortfall. Prior-shift held funds are not automatically released or expired.
- At the authored deadline, refund every physically undelivered kit. Consume that order's held proceeds, merchant cash, then other merchant reserves. Any remaining gap is assumed provider coverage with no recovery. This is not actual PayPal coverage policy.
- No new future reserve-rate or payment-pause controls, operating expenses, churn, model cost or production savings estimate in this replay. The older paired experiment models different assumptions separately.
- These are scripted source queries and deterministic rules, not evidence of an LLM advantage or a claim of undisclosed PayPal novelty.

Conservation invariant:

`merchant cash + merchant reserves + collected fees + supplier spend + refunds = initial working capital + simulated gross payments + modeled provider coverage`.

## Validation

Ten new tests cover receipt eligibility and single-reference reuse; matching and adverse evidence; observation isolation; the 1/3/9 next-shift purchasing contrast; three shifts at all scales; merchant-level conservation; reviewer authority; stale-state rejection; double-execution prevention; pause; and the main page's read-only receipt boundary.

The original 78 checks and all ten new checks pass. Browser playtesting verified saved receipt loading, automatic generation and investigation, the $96.30 → $52 proposal, per-kit source records, wrong-order rejection, local approval, refund settlement, and next-shift progression. Browser logs were free of errors and warnings at the reviewed state.

The generated [full trace](evidence-economy-trace.json) preserves the reference receipt, all three policy replays' summaries and the investigated run's unit evidence and queries. The prior native receipt artifact remains separate at [paypal-sandbox-receipt.json](paypal-sandbox-receipt.json).

The earlier main page/controller were copied before editing to `docs/archive/network-before-receipt-economy-2026-10-20/`. The paired engine and standalone sandbox integration remain available.
