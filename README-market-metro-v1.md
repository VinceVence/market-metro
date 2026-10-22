# Market Metro

> Historical implementation notes. Use [the current README](README.md) for setup and the saved-wallet PayPal flow. This earlier UI is available at `/metropolis.html`.

A local commerce tycoon with an original isometric metropolis and a persistent marketing data warehouse. Choose 12, 24 or 36 merchants, 100–2,000 synthetic shoppers, and 1, 3 or 7 market days. Launch an 8% offer, change market conditions, watch shoppers and deliveries, then inspect or export every base table and SQL view.

## Run

Node.js 22.16+ with the built-in `node:sqlite` module (tested on Node 25.2.1). No npm dependencies, paid models, cloud deployment or account login is needed for the simulation.

```sh
npm run dev
npm test
```

Open **http://127.0.0.1:4173/**. Choose **New simulation**, **Resume market**, or **Run to close**. **Data warehouse** opens the saved tables. Pausing or closing the browser stops simulation stepping; runs persist across server restarts. The local server binds only to `127.0.0.1`.

## Data and exports

The database is `.local/market-metro.sqlite`. It is ignored by Git. Each run has unique primary keys, a seed, a business clock, and a separate state snapshot. Dates use Asia/Manila business dates; timestamps are ISO UTC. Monetary amounts are integer USD cents. IDs are shortened only on screen; exports preserve full identifiers.

**14 base tables:** `simulation_runs`, `merchants`, `products`, `customers`, `campaigns`, `events`, `orders`, `order_items`, `transactions`, `refunds`, `deliveries`, `inventory_movements`, `campaign_spend`, `paypal_receipts`.

**6 SQL views:** `v_marketing_transactions`, `v_daily_merchant_sales`, `v_campaign_performance`, `v_marketing_funnel`, `v_inventory`, `v_customer_segments`.

Use **SQLite database** to export a self-contained database for the selected run, including working views. **Run JSON** exports all base tables and materialized view rows. **Table CSV** exports the entire selected table/view, not just the visible page. **Schema SQL** exports the DDL. The SQLite export omits internal application fingerprints, idempotency-key values and private simulation state. There are no credentials or card details in the exported data.

All generated commerce is explicitly `SIMULATED`; sample catalog rows are `AUTHORED_SAMPLE`. Native sandbox receipt rows are separate. Never sum sandbox mirrors into the simulated sales total. Refunds in the marketing views are attributed to the original sale date; they are not cash-flow-date reports. ROAS and contribution are simulated accounting measures, not causal marketing lift or PayPal profit.

## PayPal sandbox

Existing `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` in `.env` are reused. The server only calls `https://api-m.sandbox.paypal.com`; live mode is rejected. No real card or bank account is used. The optional mirror uses PayPal's published sandbox test card with the standard create-then-capture flow and provider readback, stable request IDs, amount/reference checks and separate provider fee/net fields.

**Current account result:** authentication works, but PayPal rejects direct test-card purchases with `PAYEE_NOT_ENABLED_FOR_CARD_PROCESSING`. The UI therefore leaves the simulation usable, disables additional automatic batches for this app profile and displays the rejected attempts honestly. An API key alone does not enable that merchant capability. No new native capture was produced during this implementation. The previous $100 wallet capture was reverified successfully and is shown separately in **Sandbox receipts**.

The connected test store would receive every native mirror; the fictional merchants are not onboarded PayPal merchants. Sandbox mirrors use actual provider times, while the generated economy advances its own clock. Simulated returns do not issue actual sandbox refunds. The maximum mirror batch is ten orders, and a provider or network error stops the batch. Wallet checkout remains available at `/sandbox.html`; it is never invoked by ordinary simulation runs.

## Channel3 catalog

The live connection was verified on October 21, 2026: one successful `POST https://api.trychannel3.com/v1/search` imported **22 usable USD products** using the user's hackathon credits. New simulations now use this cached catalog. Sample products remain available when no import has been saved.

For setup, use a sponsor/free-credit key and set `CHANNEL3_API_KEY` plus `CHANNEL3_FREE_CREDITS_CONFIRMED=true` in the existing `.env`, then refresh the page and select **Sync Channel3**. These two settings reload without restarting the server. Start a new simulation to use the imported catalog. The adapter caches accepted USD products for 24 hours, preserves provider IDs and source URLs, and reuses the cache for every simulation. It does not purchase credits, top up balances, invoke a model, or place orders with real retailers. Keep the provider account on a free plan; local rate limits are not a provider billing guarantee. If Node cannot read the local certificate chain, the adapter uses the system's `curl` with TLS verification enabled; keys pass through stdin, never command arguments.

Channel3 products are reference catalog data. The simulation's merchant identities, inventory quantities, product costs and customer behavior remain synthetic even after catalog import.

## Model assumptions

- Products have authored costs of 42–58% of their displayed price. Starting inventories, shopping behavior, return probability and demand shocks are seeded simulation assumptions.
- Generated transaction fees use an explicitly labeled 3.49% + $0.49 assumption, not a quoted PayPal rate. Native receipts retain actual sandbox-reported fees when supplied.
- Contribution deducts product cost, assumed delivery cost, payment fees, refunds and modeled campaign spend. Returned units are not resold during the run; original COGS stays charged.
- There is no LLM, calibrated marketing model, autonomous agent team, causal uplift claim or real ad spend. The current objective is a visible economy and a usable data foundation.

## Implementation

- `demo/market/engine.mjs`: pure seeded commerce simulation.
- `demo/market/city.mjs`: original Canvas metropolis, shoppers and vehicles.
- `demo/market/app.mjs`, `style.css`: controls, merchant inspection, warehouse and receipt display.
- `scripts/market-store.mjs`: SQLite schema, six views, transactional writes and exports.
- `scripts/market-service.mjs`: run orchestration and bounded sandbox receipt verification.
- `scripts/market-catalog.mjs`: sample catalog and cached Channel3 adapter.
- `tests/market.test.mjs`: accounting, referential integrity, reproducibility, exports, payment recovery and HTTP boundaries.

The prior reserve economy is preserved at `/supply-yard.html`, with its evidence comparisons and benchmark lab at their original URLs. Historical notes are in [README-supply-yard.md](README-supply-yard.md). No APAC project or cloud infrastructure was changed.
