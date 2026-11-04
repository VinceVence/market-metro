# Market Metro

A local commerce simulator with a checkpointed AI team, a 3D market, an AG Studio warehouse and optional PayPal Sandbox receipts.

## Run

Requires Node.js 22.16+ and Python 3.12.

```sh
npm ci
uv venv .local/marketing-venv --python 3.12 --cache-dir .local/uv-cache
uv pip install --python .local/marketing-venv/bin/python --cache-dir .local/uv-cache -r scripts/marketing/requirements.txt
npm run dev -- --no-recover
```

Open [the workspace](http://127.0.0.1:4173/studio.html). **New live run** opens settings. The default is **V2, 12 merchants and 600 shoppers**. Existing V1 sessions and the original 3-store economy remain available.

For the recorded submission example, run `node scripts/commerce-expanded/harness-v2/replay.mjs` after setup. It imports the measured campaign into the same market and warehouse, verifies the original financial totals and prints the demo URL. Playback makes no model or payment calls. The UI distinguishes recorded Gemini decisions from a fresh run. [Submission evidence and walkthrough](docs/submission-candidate.md).

[Completed V2.3 results](docs/commerce-expanded/harness-v2/v23-20261104/README.md): mean **+$38.09 modeled PayPal net, +$417.34 merchant contribution and +4.25 purchases** over fixed rules across four fresh markets. All eight AI workflows completed. One planner performed better than the team; multi-agent superiority is not claimed.

## V2.3 workflow

[System architecture by plane](docs/figures/planner-v23/README.md) show the environment, planner, numerical tools, publication guard, checkpoints, PayPal bridge and evaluation using vector logos and source-linked evidence.

[Typed execution contracts](docs/commerce-expanded/harness-v2/typed-execution.md) validate every proposal. The LLM chooses experiments; deterministic code owns the final publish/retain decision. No new runtime dependency is required.

At days 31 and 61, economic dates pause while the team:

1. Chooses an investigation and reads observed demand, inventory and payment-funnel data.
2. Chooses a dataset/feature recipe and trains two local models.
3. Tests an exact campaign and fulfillment contract on separate development markets.
4. Compares the same campaign with incumbent supply preserved, then proposes one optional revision or finishes the search.
5. Deterministically selects the best eligible tested contract, or retains the incumbent.

The analyst, scientist and commerce manager make fresh Gemini decisions. Data queries, training, trial execution and financial checks are deterministic tools. SKU recommendations use the fitted classifier; general inquiries use a response-calibrated payment/merchant value model. Both learn from observed data. Pro handles the first campaign revision; Flash-Lite handles every other decision. Each run permits two six-stage reviews, bounded safe-operation retries, fourteen provider attempts total and at most **$0.19** in model usage. A single planner receives the same routing, tools and allowance. Uncertain billing and payment writes are never retried by this mechanism.

See **Performance → V2.3 · value-model confirmation** for current decisions and costs. Earlier recorded comparisons preserve prior results, including losses. [Implementation and results](docs/commerce-expanded/harness-v2/README.md). Retaining fixed rules is reported as a retained policy, not an agent-created financial gain.

## Data and payments

- The catalog, shoppers, demand and economic parameters are authored simulation fixtures. The current server makes no Channel3 calls.
- All 600 shoppers generate records; the renderer displays a representative crowd of 96.
- Customer baskets and merchant payment legs are separate warehouse tables. One basket may have several merchant legs.
- Payment authorizations, captures, supplier settlement, deliveries and refunds feed model observations and accounting.
- Modeled PayPal contribution is not actual PayPal profit. Merchant contribution includes inventory accounting and is reported separately from cash.
- The optional native adapter mirrors **one retained order, up to $100 fictitious funds**, through the existing saved Sandbox buyer. It does not add another simulated sale.

For native samples, add sandbox credentials to `.env` using `.env.example`, then complete the one-time buyer setup at `/sandbox-buyer.html`. [PayPal setup](docs/paypal-sandbox.md). Never commit `.env`, wallet tokens or provider credentials.

Fresh Gemini runs use the existing isolated `.local/gcp/config.json`, authorization and shared spend ledger. They do not configure another GCP project. The existing tighter application/cloud caps remain in force beneath the $50 hackathon ceiling. [Provider configuration and cost accounting](docs/campaign-workflow/autonomous-gemini.md#spending-and-configuration). A clean clone has no provider credentials or saved wallets; local tests and saved result pages require no model API calls.

## Validation

```sh
node --test tests/commerce-harness-v2.test.mjs tests/inquiry-value.test.mjs tests/commerce-operation-recovery.test.mjs tests/commerce-autonomy-live.test.mjs tests/commerce-expanded.test.mjs
npm run baseline:verify
```

The [locked v1 baseline](docs/commerce-growth/baselines/paypal-net-v1/README.md) retains its source/model snapshots and 70 sealed evidence traces. The expanded economy is independently hash-checked. Benchmark seeds, call caps and source hashes are registered before confirmation; failed cases remain in the results.

## Project layout

- `demo/commerce/`: workspace, agent decisions, campaign results and comparisons.
- `demo/garden/`: Three.js market, buildings and shopper motion.
- `scripts/commerce-expanded/`: separately versioned 12-store economy.
- `scripts/commerce-expanded/harness-v2/`: analysis, fitting, trials, exact-contract checks and comparison runner.
- `scripts/commerce-growth/autonomy/live.mjs`: live day loop, saved frames and warehouse integration.
- `scripts/market-store.mjs`: base tables, views and exports.
- `scripts/paypal-funding.mjs` and `scripts/market-service.mjs`: saved Sandbox wallet and receipt reconciliation.

Temporary training datasets and old experimental traces are not application dependencies. Keep run checkpoints, financial summaries and frozen evidence; put disposable scratch under `.local/`.

Original code is [MIT licensed](LICENSE). See [third-party notices](THIRD_PARTY_NOTICES.md) for dependencies and assets. AG Studio is in local evaluation mode; hosted judging requires suitable license coverage.
