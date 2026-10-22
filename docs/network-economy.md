# Supply Yard: network economy

Historical optimization model: the main `/` page now uses the [receipt-linked evidence economy](evidence-economy.md). The engine described below remains in use by `/comparison.html`; its prices and policy assumptions differ from the new reserve-review replay.

This iteration answers the request for a larger economy with conflicting agent ideas and multiple PayPal decisions. It keeps one playfield, one contextual inspector, and one action dock. The default simulation has 36 merchants, 144 office buyers, three suppliers and three consecutive shocks; 12- and 120-merchant options are also supported. Every merchant has an individual wallet and order batch, even when several are grouped in one loading bay.

The optional [paired comparison](paired-comparison.md) at `/comparison.html` adds fee and churn accounting to this shared engine. This document’s numbers describe the original zero-fee, no-churn walkthrough; the paired page shows its own explicitly configured results.

## Who acts

- Offices create demand and pay a specific merchant. Paused payment channels reject new requests before a capture is recorded.
- Merchants receive available cash, pay authored operating expenses, and request stock they can afford. Their reserves cannot fund another merchant.
- Suppliers allocate their own inventory in a fixed FIFO order queue and use authored batch-delivery probabilities.
- The simulated PayPal reviewer approves a batch of individual reserve releases, future reserve rates and future payment-acceptance settings. Refunds use merchant funds first; the modeled provider covers the remaining eligible shortfall.
- The agent roles calculate opposing proposals. They have no authority to approve or execute themselves.

Reserve authority and payment-acceptance controls are hypothetical internal policy surfaces. No public API capability or live PayPal integration is claimed.

## Why disagreement matters

Risk retains existing reserves, raises future reserve rates to 40% and pauses channels whose current modeled fulfillment is weak. This reduces immediate all-fail exposure but can choke later trading.

Commerce uses a greedy next-kit search to maximize units purchased under the release cap. Ties favor larger demand. It holds 10% of future sales and keeps channels open.

Network challenges service gaps, displaced procurement and additional all-fail coverage. The coordinator then searches for a different allocation, balancing expected coverage, worst-case coverage and service distribution. It uses 20–30% future reserves and targeted payment pauses. Risk retains its dissent when the revised plan still adds downside.

The first default shift has these computed contrasts:

| Policy | Released | Merchant releases | Kits purchased | Merchants below half of demand | Next-payment pauses | Expected provider coverage | All-fail provider coverage |
|---|---:|---:|---:|---:|---:|---:|---:|
| Protect funds | $0 | 0 | 153 | 18 | 36 | $8,979 | $15,660 |
| Maximize trading | $940 | 8 | 204 | 10 | 0 | $7,926 | $16,680 |
| Coordinated recovery | $900 | 18 | 204 | 6 | 6 | $7,926 | $16,680 |

The revised plan is a preference trade-off, not a universal winner: it releases less cash and spreads fulfillment, but pauses six merchants. The next shift makes that cost visible. All numbers are authored scenario outputs, not PayPal estimates or evidence of agent superiority.

## A persistent three-shift world

1. Supplier outage: Northshore stops dispatching; remaining stock is scarce.
2. Freight price shock: kit procurement rises from $20 to $28. Existing balances and prior payment rules determine which new orders are captured and how much cash remains.
3. Demand surge: requested quantities increase by 50% over the initial base while supply recovers and procurement costs $24 per kit.

Each approved plan sends physical loads through warehouse pickup, merchant packing, and grouped office delivery. Inventory and receipts settle at the corresponding simulated arrivals. Failed or unfilled quantities receive full refunds under the authored coverage assumption. Outcomes are reproducible synthetic realizations; actual future draws are not passed to policy evaluation.

## Financial and objective assumptions

Retail price is $50 per kit. Merchants start at zero, hold 20% of first-shift captures, and spend an authored 55–70% of gross receipts on operating costs, capped by available cash. No later claim for unpaid operating expenses is modeled. There are no fees, credit lines, cross-merchant funding, later asset recoveries or future contribution estimates.

For a merchant purchasing `q` of `d` paid units, with backing `B` after procurement:

- Successful batch loss: `max(0, (d − q) × $50 − B)`.
- Failed batch loss: `max(0, d × $50 − B)`.
- Expected coverage: authored batch success probability × success loss + failure probability × failed loss.

All-fail exposure is a stress scenario, not an estimated probability. The release limit scales with merchant count. The permitted increase in all-fail coverage is 65% of that limit. Both are invented demo constraints.

The coordinator’s greedy objective is expected coverage + 20% of all-fail coverage + $100 per unserved merchant + $200 times squared unfilled share + $600 times the share below 50% fulfillment, per merchant. These terms are visible in Money & rules. This is a transparent scripted heuristic, not a calibrated social-welfare function or globally optimal solver.

## State and controls

The simulation engine owns all balances, stock, requests, policy settings, clocks, outcomes and receipts. The renderer owns artwork only. Pause stops timed progression. The debate advances every six simulation seconds and can also be stepped manually. Opening dialogs pauses the economy. Every new shift carries merchant balances and future payment policies forward.

Execution rejects non-reviewer authority, an ineligible proposal, changed stock or balances, and repeated application. Inventory is reconciled against each supplier’s verified stock at approval, including after a re-investigation of changed inventory. Global money satisfies:

`merchant cash + reserves + operating spend + supplier spend + refunds = captured payments + provider coverage`.

The UI explicitly separates modeled expected coverage from the realized selected synthetic branch. It records rejected new requests separately instead of manufacturing captures or refunds for them. Changing size restarts the simulation. The old focused case remains at `/case.html`.
