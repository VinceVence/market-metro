# Market Metro

Market Metro shows how one LLM planner designs a merchant campaign and a local verifier tests which ranking earns more after purchases, refunds and settlement.

## Play the judge demo

With Node.js 22.16 or newer, run these commands from the project root.

```sh
npm ci
npm run dev -- --no-recover
```

Open [the judge demo](http://127.0.0.1:4173/) and select **Play walkthrough**, or step through at your own pace. The seven chapters use a recorded single-planner review, simulation snapshots and a verified PayPal Sandbox receipt bundled with the project. Playback makes zero model or payment calls and requires no provider credentials.

The planner's campaign brought Shopper 179 back after 16 days for a $96 Mobile Side Table. The receipt belongs to that exact warehouse order. Across this frozen market, the planner and verifier added **$114.96 in modeled PayPal net after AI, $1,024.86 in merchant contribution and 16 retained purchases** over fixed rules. [Judge walkthrough and evidence](docs/submission-candidate.md).

Choose **Merchant scale → Run local ranking** to try the same model on up to 48 simulated stores across four independent districts. Judges can vary how many stores share inventory and compare settled outcomes for the same shoppers against fixed rules. [Live scale demo](http://127.0.0.1:4173/judge.html#scale) · [Measured results](docs/merchant-scale/README.md).

At the receipt, select **Why is this one purchase?** The read-only merchant feed verifier reconciles 1,922 seller orders into 1,384 shopper checkouts and explains why the saved $96 capture adds zero additional purchases. Try renamed headers, flat seller rows or two conflicting checkout links. [Open the verifier](http://127.0.0.1:4173/judge.html#ontology) · [Method, results and scope](docs/ontology/README.md).

In **Verifier → Try a feed that holds this campaign**, two declared checkout keys stop the day-31 planner before it can issue outreach. Apply the simulated merchant’s corrected mapping to admit 715 past checkouts and execute the recorded policy on the same shoppers. It selects 31 product recommendations and five needs inquiries. The local replay requires zero new model calls, payments or Python setup. [Run the hold and correction](http://127.0.0.1:4173/judge.html#planner).

## Run a live simulation

In the [simulation workspace](http://127.0.0.1:4173/studio.html?view=market), **New live run** defaults to one planner, the financial verifier and reactivation. The full live workflow reviews on days 31 and 61. The recorded judge comparison holds its day-31 campaign through settlement. For live runs and offline numerical reproduction, install the Python dependencies and configure the appropriate services below.

```sh
uv venv .local/marketing-venv --python 3.12 --cache-dir .local/uv-cache
uv pip install --python .local/marketing-venv/bin/python --cache-dir .local/uv-cache -r scripts/marketing/requirements.txt
```

To populate a local warehouse with all 126 days of the judge run, use `node scripts/commerce-expanded/harness-v2/judge-reactivation.mjs`. It reproduces the saved campaign, both financial controls and the selected shopper locally. The checkout receipt included with the judge demo remains a read-only record of the original test capture.

[Completed V2.3 results](docs/commerce-expanded/harness-v2/v23-20261104/README.md): mean **+$38.09 modeled PayPal net, +$417.34 merchant contribution and +4.25 purchases** over fixed rules across four fresh markets. All eight AI workflows completed. One planner performed better than the team; multi-agent superiority is not claimed.

Open [Campaign model check](http://127.0.0.1:4173/studio.html?view=performance&evaluation=model-check) to see what happened when the verifier tested the same campaign with both trained models. Each market links to the original team decisions and shows the outcome on an unseen shopper population. You can enable this check in **New live run → Workflow**. [Method and frozen comparison](docs/commerce-expanded/model-check/README.md).

## V2.3 workflow

In the [fresh reactivation comparison](docs/commerce-expanded/model-check/reactivation-fresh/README.md), one planner with the verifier improved modeled PayPal net, merchant contribution and retained purchases on all six new markets versus fixed rules. The three-role team did so on five. The extra model check lifted purchases on one seed per arm. [Open the scorecard](http://127.0.0.1:4173/studio.html?view=performance&evaluation=reactivation-fresh).

[System architecture by plane](docs/figures/planner-v23/README.md) uses the selected C layout, B palette and DM Sans to show the market, LLM agent, saved decisions, local tools and PayPal. Labels use plain language and the capture is linked to saved evidence.

[Typed execution contracts](docs/commerce-expanded/harness-v2/typed-execution.md) validate every proposal. The LLM chooses experiments; deterministic code owns the final publish/retain decision. No new runtime dependency is required.

At days 31 and 61, economic dates pause while the team:

1. Chooses an investigation and reads observed demand, inventory and payment-funnel data.
2. Chooses a dataset/feature recipe and trains two local models.
3. Tests an exact campaign and fulfillment contract on separate development markets.
4. Compares the same campaign with incumbent supply preserved, then proposes one optional revision or finishes the search.
5. Deterministically selects the best eligible tested contract, or retains the incumbent.

In the default live run, one planner handles analysis, model selection and campaign design. The optional three-role team divides these same Gemini decisions among the analyst, scientist and commerce manager. Data queries, training, trial execution and financial checks are deterministic tools. SKU recommendations use the fitted classifier; general inquiries use a response-calibrated payment/merchant value model. Both learn from observed data. Pro handles the first campaign revision; Flash-Lite handles every other decision. Each run permits two six-stage reviews, bounded safe-operation retries, fourteen provider attempts total and at most **$0.19** in model usage. A single planner receives the same routing, tools and allowance. Uncertain billing and payment writes are never retried by this mechanism.

See **Performance → Fresh reactivation test** for the six-seed planner and team comparison. Earlier recorded comparisons preserve prior results, including losses. [Implementation and results](docs/commerce-expanded/harness-v2/README.md). Retaining fixed rules is reported as a retained policy, not an agent-created financial gain.

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

Run `npm run test:demo` to check the bundled receipt, default routes, merchant-scale inputs and live local rankings using Node alone. The broader workflow checks below also exercise local training. The full historical suite additionally expects local fixtures from the V3 catalog, expert-stack, policy-value and team-repair studies.

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

Historical V1–V4 chart generators, the pre-V2 review-timing diagnostic and the old research/confirmation runners are available in the [pre-cleanup source tree](https://github.com/VinceVence/market-metro/tree/6544108c67dcb458ddafb2a8dee1cb1e4adc5195/scripts). To reproduce those studies, use a separate checkout of that revision.

Temporary training datasets and old experimental traces are not application dependencies. Keep run checkpoints, financial summaries and frozen evidence; put disposable scratch under `.local/`.

Original code is [MIT licensed](LICENSE). See [third-party notices](THIRD_PARTY_NOTICES.md) for dependencies and assets. AG Studio is in local evaluation mode; hosted judging requires suitable license coverage.
