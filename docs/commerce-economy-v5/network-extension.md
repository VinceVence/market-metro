# Supplier-payment network hypothesis

The initial v5 development search did not approach2×. One pricing defect was found: the copied v4 engine referenced merchant-zero prices for outside retailers. v5.0.1 now keeps competitor prices independent; the earlier development results are explicitly invalidated and retained.

The next structural hypothesis is **joint procurement and payment routing**, rather than additional marketing role prompts. Customer purchases fund merchant restocking; merchants pay a wholesaler, and that wholesaler pays a manufacturer. These are separate purchases at different stages, not duplicate counts of one retail sale. Invoice creation alone never counts as a payment.

All comparisons receive the same business controls. The strong fixed comparator uses ordinary reorder rules, batches daily invoices, and chooses a fast payment only when its expected avoided stockout value exceeds the extra payment cost. It must not be deliberately forced onto bank payments. A numerical planner without an LLM remains a comparator.

Before evaluating any policies, declare and freeze:

- Standing supplier quotes, bank/PayPal settlement lags, fee assumptions, upstream cost shares, shipment costs and any bulk-order terms. These are authored hypotheses; PayPal documentation establishes API capabilities, not these economic parameters.
- Supplier starting cash and every cash transfer. No grants triggered by an agent action, no invented household income, no circular transfers to manufacture volume.
- Per-settlement-batch, per-counterparty invoice aggregation to prevent fee farming through payment fragmentation.
- Retail and B2B payment volumes reported separately; platform contribution sums actual simulated settled fees minus modeled processing and incentives. It is not consolidated business revenue.
- Retailer AND supplier contribution, available cash, pipeline stock and terminal excess inventory as gates. Buying unnecessary stock solely to generate payment fees must fail promotion.
- Original v4 artifacts remain intact. New outcomes are compared only with the stronger fixed policy in the same final frozen network version.

Agent responsibilities: Demand Scientist produces validated demand/ranking artifacts; Merchant Economist proposes price and procurement policies; Lifecycle/Treasury Strategist proposes consented replenishment and payment-timing policies. The shared numerical planner checks a combined plan. Counterparties expose standing terms and normal APIs; the demo does not assume each external merchant has its own AI agent.

PayPal mapping: supplier invoices and their payment status, existing saved-wallet Orders for authorized test samples, refunds and subscription offers where separately approved. The existing native invoice demo is deliberately unpaid; it remains evidence of integration, not economic uplift. Native subscriptions require buyer approval. Benchmark runs make no native payment calls.

Status: design hypothesis, not a measured2× result. The new target remains active.

## First development evidence

The bank/PayPal routing and joint price/stock probes did not reach2× with partner protection. Across three development scenarios, forcing fast payments reached about1.58× over100 days and1.74× over365 days, but reduced aggregate retailer/supplier contribution. These are failures, not promoted policies. The annual horizon was declared before its runs and is reported alongside100 days; no horizon sweep was used. No fresh model calls or native payments were made.

Next hypothesis: learn a demand-aware replenishment assortment rather than restock every observed SKU independently. This changes procurement authority, not shopper income, needs or choice equations. Keep on-hand units and let physical inventory deplete normally; do not destroy goods or force purchases. Compare a competent margin-aware fixed restocking rule and a numerical assortment optimizer with the agent designs.
