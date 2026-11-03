# Business-action economy v5

User scope amendment, 2026-10-31: **Add business actions; rebuild all comparisons.** The original v4 engine and benchmark stay unchanged. The goal remains at least2× settled modeled platform net against a strong fixed policy in this same new economy, with3× a stretch target. Neither the earlier $685 fixed result nor a campaign-only v5 condition is the primary denominator.

Implemented prototype:

- Bounded merchant price changes of−10%,−5%,0%,+5%,+10%; the actual price changes shopper choices and paid amounts. Costs do not change with the actor label.
- Cash-constrained procurement, a3-day delivery lead time and the existing supply-delay scenario. Opening inventory is6 units per offer and merchant cash is$1,500 each. Procurement consumes cash; inventory and pending deliveries remain assets. Holding cost is an authored0.02% of stocked cost per day.
- Optional replenishment offers for Stationery and Office bundles, with7/14/28-day intervals. A simulated shopper may accept or decline. Each mandate has an amount cap and explicit consent record. Charges are skipped for insufficient funds, unavailable stock, insufficient merchant margin, price-cap violations or no current consumer need. A refunded replenishment cancels the mandate.
- Same underlying household income, outside spending, preference, fatigue, ordinary purchase and return mechanics inherited from v4. No income is created by campaigns or subscriptions.
- Local training and public-evidence interfaces remain separate from private consumer state.

These economic parameters are **authored assumptions**, not real merchant or PayPal measurements. Smart-replenishment need checks are a merchant/application simulation feature, not something PayPal can infer. There are **no new native payment calls or payment-failure simulations** in v5. Six fresh application-agent calls have now been measured, costing$0.140734 in total. PayPal's documented automatic subscription retries remain infrastructure; they will not be credited to an LLM.

The completed Hyperresearch follow-up recommends three specialists: Demand Scientist, Merchant Economist and Lifecycle Strategist. A shared numerical planner composes their artifacts; typed validation, spend control and payment idempotency remain code. There is no permanently paid coordinator role: the prior pilot selected none of its refinements.

Required comparisons are campaign-only reference, fixed rules with new business actions, numerical search, matched single-agent planner and the three-specialist network. All receive identical legal controls and observed data. A capability gain over campaign-only is reported separately from architecture value.

Validation commands:

```sh
node --test tests/commerce-v5.test.mjs
```

The target is not achieved. This version is separate from the approved live UI/default while the new experiments are built.

## Latest measured checkpoint

The three-role agent network and matched single-agent construction completed. The strengthened harness preserves incumbent components and runs an equal64-candidate local search per arm. On six new validation markets, team-seeded search reached1.292× fixed modeled net with positive aggregate partner/cash deltas; it has not reached2× and has not opened final test markets. The gain is in the combined business policy, not increased recommendation-attributed purchases. See [audited results](search-1/README.md).

The supplier network tracks two distinct goods trades and conserves cash across merchants, wholesaler, manufacturer, processing, bank and clearing accounts. Invoice aggregation occurs in fixed settlement batches (old clearing arrivals at day start and new procurement payments), not arbitrary agent-created fragments. These modeled payments are not native receipts.
