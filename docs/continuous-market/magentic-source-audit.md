# Magentic Marketplace source audit → continuous Market Metro

Inspected Microsoft’s public MIT-licensed repository at commit `9a651c7632685e4aeb2956dfe315df0cec6e8a92` on 23 October 2026. This is an architectural adaptation using our existing engine, not a fork of Microsoft's app or a claim to reproduce its experiments. No Microsoft code or artwork was copied into the shipped runtime.

## What the source actually does

- [Agent launcher](https://github.com/microsoft/multi-agent-marketplace/blob/9a651c7632685e4aeb2956dfe315df0cec6e8a92/packages/magentic-marketplace/src/magentic_marketplace/platform/launcher.py) starts participants as concurrent asynchronous tasks. Customers can finish independently; business agents can be shut down once the primary customers finish. This is an experiment lifecycle, not an endless retail tycoon.
- [Visualizer](https://github.com/microsoft/multi-agent-marketplace/blob/9a651c7632685e4aeb2956dfe315df0cec6e8a92/packages/marketplace-visualizer/src/App.tsx) fetches customers and businesses, polls messages and analytics every five seconds, and filters threads by the selected participant. Inspecting a participant is a view operation rather than a market action.
- [Typed messages](https://github.com/microsoft/multi-agent-marketplace/blob/9a651c7632685e4aeb2956dfe315df0cec6e8a92/packages/magentic-marketplace/src/magentic_marketplace/marketplace/actions/messaging.py) represent text, order proposals and payment acceptance. The [message handler](https://github.com/microsoft/multi-agent-marketplace/blob/9a651c7632685e4aeb2956dfe315df0cec6e8a92/packages/magentic-marketplace/src/magentic_marketplace/marketplace/protocol/send_message.py) checks that a referenced proposal exists; it is not a PayPal gateway. Proposal expiry is explicitly ignored in that revision. Our one-day coupon expiry and existing payment guards are retained.
- [README](https://github.com/microsoft/multi-agent-marketplace) describes configurable LLM buyers and sellers, search, communication, transactions and economic evaluation. The synthetic restaurants/contractors are research scenarios. It does not provide our Channel3 catalog, PayPal bridge, marketing ML workflow or repeated retail reactivation policy.

The useful pattern is independent market actors + a central event/transaction record + an observer UI. The previous Market Metro workflow instead made the planner advance the environment and halted on analysis checkpoints. That coupling is removed in the new live mode.

## Implemented behavior

The market clock advances a seeded retail economy every 2.5 seconds. Marketing reads a frozen observation cutoff, fits local models asynchronously, refreshes product demand after fitting, and publishes a guarded product campaign for a future tick. The training cutoff stays fixed while the publication snapshot can be newer. New post-training observations also provide a drift check (an explicitly authored 1.25× constant-loss guard). Trading and event ingestion continue during analysis, training, model errors and when the user reads a past decision. Only the explicit market pause, session end or unattended-view timeout pauses the clock.

The opening 28 days are generated history. Two live trading days follow before the first review. Product interest rotates in seeded nine-day regimes; a seeded subset of shoppers becomes less active in fourteen-day periods. These are simulator assumptions, not real Channel3 behavioral data. The analyst receives observed product views, purchases, prices, stock and inactivity counts; it does not receive hidden preferences or future regimes.

Campaigns target individual observed product IDs. Reactivation requires a previous purchase and at least seven days without buying. Local model estimates, positive expected contribution, a 20% margin floor, stock, a seven-day contact gap, the $300 virtual budget and randomized holdouts still govern each offer. A shopper can ignore the offer, buy without it, redeem it or return organically. “Returned with a coupon” is observed linkage, not a causal saved-customer claim.

Two planner modes share this action interface:

- **Local policy rehearsal:** explicitly scripted choice of rising-view profitable products, real scikit-learn training, no model API calls.
- **Gemini analyst:** two bounded choices per review (research and publication), at most three reviews, using the existing isolated Vertex project, $0.25 ledger limit and provider receipts. It never owns the market clock. This UI change does not itself authorize or start a paid run.

PayPal remains a separate settlement adapter. Ordinary transactions are simulated. The live run permits one explicitly selected sandbox sample; it never captures automatically. Native receipts retain their own timestamps and amounts and join to the selected order, coupon and Channel3 product.

## Implementation map

- `scripts/marketing/continuous-market.mjs`: independent clock, frozen snapshots, asynchronous model commits, bounded analyst choices, guarded product plans, durable work log and shopper trace.
- `scripts/marketing/economy.mjs`: opt-in demand/lapse dynamics, ordinary commerce and observed reactivation events. Historical workflow behavior is retained when continuous mode is absent.
- `demo/garden/live-market.mjs`: independently updating market and office, product demand, dated decisions, shopper/transaction inspection and sandbox sample control.
- Existing SQLite base tables remain authoritative: `orders`, `order_items`, `transactions`, `events`, `coupons`, `coupon_redemptions`, `customer_days`, `model_scores`, `model_runs`, `team_decisions`, `paypal_receipts`.

## Validation contract

Tests hold training unfinished while advancing three real market days, then assert that publication does not rewind those days or overwrite orders. They also verify product-only reactivation eligibility, holdout exclusion, snapshot cutoffs, invalid-action rejection, planner failure isolation, and that local mode makes no cloud or payment calls. The Gemini adapter is exercised with an explicitly fake provider; that test is not a paid Gemini result.

The local integration run `GARDEN-LIVE-c6d311b3b18d6b11` produced 163 campaign offers and 61 redemptions by the saved observation in [local-run-evidence.json](local-run-evidence.json). Iris 10 received a 10% offer after 13 inactive days and purchased a Channel3 desk kit (`oPnCNpb`) for $28.79. Its locally fitted purchase estimates were 13.9% without an offer, 23.1% with 5% off and 35.9% with 10% off. Those estimates and the recorded purchase do not establish individual causal lift.

Actual local fits promoted logistic regression on market day 31 and a decision tree on day 80, each using 6,300 training and 2,100 validation rows. Their wall times were 4.676 and 4.298 seconds after the query fix. The seed fixes exogenous draws; wall-clock job completion and publication timestamps are also required for exact asynchronous replay.

The first integration pass exposed two issues that were corrected: stale pre-training product selections and inclusion of warm-up returns in the live reactivation counter. Live metrics now require day 29 onward, and publication uses a refreshed observation packet. Live rendering also avoids global warehouse-view counts and indexes the order-item and coupon-redemption joins.
