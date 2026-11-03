# Market Metro: the learning market

**Final PayPal scorecard:** [14 fresh markets](docs/commerce-growth/economic-final-1/README.md): reviewed workflow $765.47 versus fixed $738.79, **+$26.68 / +3.61%** modeled net after allocated AI cost. The workflow retained v1; the new overlay did not beat it. Fresh Gemini cost $0.058668. All losses, partner safeguards and the planner's rationale errors are disclosed. Open **Economic workflow** for results and checkpoints.

**Economic workflow:** [a planner-led extension of v1](docs/commerce-growth/economic-workflow/README.md) can inspect demand, inventory, liquidity, supply and payment economics, fit a forecast, compose a temporary conditional policy, and request a historical trial. Open **Economic workflow** in the sidebar to inspect a real Gemini tool trace. The demonstrated proposal failed its historical comparison and v1 was retained; the capability is implemented, but no new profit advantage is claimed.

**Locked comparison baseline:** [PayPal net v1](docs/commerce-growth/baselines/paypal-net-v1/README.md). Exact confirmed Gemini policy, model artifacts and results are archived; the economy is hash-frozen. `npm run baseline:verify` enforces the lock. Future agent architectures must beat this policy on matching new seeds, not alter the economy or overwrite its results.

**Fresh challenger study:** [Model training, campaign auditing and checkpointed repair](docs/commerce-growth/baseline-v1-challenger-5/README.md) did **not** beat v1. On 14 new shadow-test markets, the strongest fresh team proposal averaged $735.06 net versus v1's $735.86; its single-planner counterpart produced the same commercial outcomes. The actual agent decisions, source-data choices, contribution ablations and losses are in **Performance → Team vs locked v1 · fresh decisions**. All attempts cost $0.513690 in recorded model usage. V1 remains locked; no candidate was promoted to the live controller.

**Current verified demo: [Intent & conversion team](docs/commerce-growth/autonomy-1/completion-1/README.md).** Open [`/studio.html`](http://127.0.0.1:4173/studio.html) for the market, live agent decisions, campaigns, base tables and PayPal receipts in one workspace. It uses DM Sans and a PayPal-inspired navy/blue palette. AG Studio supplies grids and analytics; the catalog is independently authored.

```sh
npm ci
npm run dev
```

**New live run** executes a bounded three-role workflow: observed commerce data → analyst → local model training → campaign decisions → funded purchases → feedback updates. Shoppers keep trading during reviews. The verified live run used six Gemini calls, one local model fit and 58 feedback updates; prediction error fell 6.8% on 247 issued recommendations. Model usage was $0.011666. Profit is reported separately. **Replay** starts at day 1 using saved checkpoints, with no new calls.

**Fresh decision study:** [Matched single-planner / specialist-team trial](docs/commerce-growth/autonomy-1/decision-study-1/README.md). Six new Gemini calls proposed, tested, revised and selected campaigns before seven unseen seeds. Both approaches chose the same numerical policy: +1.61% modeled payment contribution versus fixed, but no demonstrated multi-agent advantage. Cost: $0.017326. Inspect **Performance → Campaign decisions · equal-budget comparison** for every handoff and result. This study does not replace the live controller.

**Demand → models → campaigns:** the [new research-team workbench](docs/commerce-growth/team-workbench-1/README.md) gives agents demand queries, executable dataset contracts, real model-training jobs and campaign trials. Twelve fresh calls and four local fits completed for $0.023950 estimated. Component removals identify positive contributions from model training and campaign choice, and a negative contribution from the added features. The team beats fixed in mean modeled net, while the matched single planner remains slightly ahead. See **Performance → Demand, models and campaigns · role contributions**.

**PayPal-net revision:** [one fresh Gemini plan on 14 unseen markets](docs/commerce-growth/roc-net-goal-1/NET-RESULT.md) expanded consented needs inquiries and coordinated funded baskets. Mean modeled net improved **$16.24 (+2.21%) versus fixed**, total retailer contribution **$337.02**, and partner cash **$525.78**; closing inventory fell. The $11.14 mean gain over the existing learned workflow remains uncertain (95% interval −$3.04 to +$28.09). Broader inquiries helped; the additional fulfillment component slightly hurt. Cost: $0.025186. See **Performance → PayPal net · coordinated campaign** for the actual decision, customer trace, component removals and every losing market. This measured plan does not replace the live controller or establish multi-agent superiority.

**Earlier workspace run:** the [original commerce guide](docs/commerce-room/README.md) records the previous coupon campaign, 7 redemptions and an $18 native Sandbox capture. Those are archived results, not the current run’s figures.

The earlier authored-catalog replay remains at `/behavior-lab.html`; its analytics view is `/reports.html`. Previous Channel3-derived results below are archives and are not current-catalog performance claims. Channel3 importing remains disabled in the active server. AG Studio remains in local evaluation mode; hosted judging needs suitable license coverage.

**Earlier:** [Trusted commerce workflow](docs/policy-lab/benchmarks/v4-1/README.md) — source-grounded Gemini requests, tested data/model workers, durable checkpoints and fresh confirmation results. Open [`/trusted.html`](http://127.0.0.1:4173/trusted.html) to inspect that earlier experiment.

**Earlier live POC: [Commerce Policy Lab](docs/policy-lab/README.md).** Click **Run demo** for three Gemini reasoning roles, competing merchant policies, a real local contextual bandit, paired controls, delayed financial outcomes and customer traces. The first completed trial and its limitations are recorded in the [measured report](docs/policy-lab/runs/GARDEN-LAB-df43cd08499c0c0a/summary.md). New trials default to no additional sandbox payment and retain the $0.25 model cap beneath the $50 hackathon ceiling.

The earlier simulation modes remain available:

A local 3D commerce tycoon with an orbitable camera, hover inspection and DM Sans throughout the interface. Historical runs used cached Channel3 products; new active runs use the authored catalog. Shoppers receive product recommendations or merchant coupons, buy, return and become inactive. A six-role **scripted** marketing workflow defines a business brief, validates observed data, trains real CPU models, launches controlled offers, and measures results. Ordinary scripted seasons invoke no LLM or catalog search. The optional **Gemini 3.1 Flash-Lite** workflow runs an autonomous planner with a $0.25 application cap per campaign; tools and model fitting stay local. Optional native PayPal Sandbox samples use a saved test wallet: up to three selected field-test orders per season, with fictitious funds and no repeated checkout.

![Market Metro commerce district](docs/screenshots/commerce-district-overview.jpg)

The [four-plane architecture](docs/market-system-architecture.md) shows the emulator, Channel3, PayPal and agent boundaries. The [PayPal commerce team](docs/paypal-services.md) has six service workflows verified in sandbox, with agent decisions, provider states and financial events in the warehouse. Cashback remains unfunded and Transaction Search lacks permission; these limits are shown in the demo.

## Run

Requirements: Node.js 22.16+ and Python 3.12 for the local trainer.

```sh
npm ci
uv venv .local/marketing-venv --python 3.12 --cache-dir .local/uv-cache
uv pip install --python .local/marketing-venv/bin/python --cache-dir .local/uv-cache -r scripts/marketing/requirements.txt
npm run dev
```

Without uv, create the same environment with Python 3.12's venv module and install the requirements using its pip. Setup downloads open-source packages; it does not configure cloud services. A fresh clone uses authored sample products and starts without any saved buyer, receipts or simulation database. No provider account is needed to run the economy and local models.

Open http://127.0.0.1:4173/. The server binds to loopback only. `npm test` runs all regression checks; `npm run test:marketing` includes real local training. Real training checks explicitly skip when the Python environment is absent.

### Optional provider setup

1. Copy `.env.example` to `.env` if `.env` does not already exist.
2. For PayPal, set `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` from a **sandbox** REST app in the [Developer Dashboard](https://developer.paypal.com/dashboard/). Keep `PAYPAL_ENVIRONMENT=SANDBOX`, restart the server, and open `/sandbox-buyer.html` for the one-time test-buyer consent described below.
3. Channel3 settings are retained for historical compatibility but are not read by the active catalog service. Do not enable training from imported catalog responses without applicable permission; see the [provenance review](docs/data-provenance-review-2026-10-26.md).

Your credentials, wallet consent and generated database remain under ignored local paths. The repository includes source and validation reports, not a reusable copy of the developer's accounts.

## Configurable continuous market

The current **Run demo** preset uses **Gemini 3.1 Flash-Lite for 100 days**, with the existing $0.25 application cap. The LLM chooses research and publication actions; local workers fit/validate models and execute guarded campaigns. Offline scripted mode is an explicit testing option. A new clone without GCP credentials should select that offline mode.

The verified [100-day result and decision log](docs/continuous-market/reports/GARDEN-LIVE-37967f0f51de0529/summary.md) records 20 valid Gemini decisions, 9 published campaigns, 8 locally fitted recommender versions, 2,213 recommendations and 230 associated purchases. Gemini chose zero live coupons. The clean run's metered-token estimate was $0.035081; diagnostic plus clean runs used $0.063577 of one shared $0.25 budget. See **Run report** in the demo for statistics and saved public justifications.

Every provider attempt is stored in `marketing_planner_calls`, including the dated input, validated/rejected output and provider receipt. Publication actions are limited to campaign types with a ready model; publication cannot request training. A rejected model is fed back as a rejection, never represented as a deployed campaign. Linked retries share the original dollar cap; each actual trial retains its 32-call limit. Unknown provider outcomes still stop spending.

Use **Run simulation** to open the settings popup before a run. Choose 4–12 merchants, 50–1,200 customers, seed, business goal, virtual marketing budget, scenario, 42–365 total days, 0.1–5 seconds per simulated hour, and a 4–14 day review interval. New runs begin empty at Day 1, 00:00. The first 28 days collect learning observations; the first automatic review follows day 30. Changes create a new run; previous data stays saved. A representative sample of shoppers is drawn in the city, while every configured shopper generates warehouse observations.

Enable the actions the team may choose:

- **Recommendations:** full-price product discovery, using a locally fitted affinity/popularity ranker. Personalization must beat popularity on later purchases; otherwise the model serves popularity. No offer-response model is needed for this action.
- **Reactivation:** 5% or 10% offers for previous buyers inactive for at least seven days, subject to model-estimated contribution and execution controls.
- **Trend promotions:** 5% or 10% offers scoped to products selected from observed demand.

The planner can also wait. The local mode uses disclosed, goal-sensitive priority rules; it does **not** invent new strategies. Gemini uses the same validated action menu and spending limits; the 100-day run above verifies the real provider path. All shoppers and responses remain seeded simulations. Reading the team log or shopper story never pauses commerce.

**Agents → Open team view** shows the playbook, active campaign, worker decisions and fitted model evidence. **Run demo** opens a new Day 1 run with the office beside the market (default seed 314, 100 days, Gemini planner, 0.25 seconds per hour). Nothing is pre-generated or skipped. The **Shopper story** inside that view follows one recorded campaign journey (prefers Iris 10 when she has a campaign purchase, otherwise another completed example). It shows catalog → model → campaign checkpoint → exposure → shopper response → warehouse/payment. It does not force that shopper to purchase. The wider market keeps trading. The local fitted ranker costs $0 in model APIs; recommendations have an assumed 2¢ virtual outreach cost.

Continuous runs start with native payment actions disabled. The sample button can mirror one selected order using the existing saved sandbox wallet and fictitious funds. Enabling **PayPal team** for a run also allows the planner to select bounded payment actions during publication; see its [consent, limits and validation state](docs/paypal-services.md). The story labels a modeled ledger entry separately from a native receipt for that **same** order.

## Checkpointed campaign workflow

Open **/workflow.html** for the campaign room and individual shopper traces. The first complete campaign was planned by the assistant in this chat, using observed analysis, real local model fitting, a validated campaign plan and saved tool checkpoints. The app now also runs an unattended Gemini 3.1 Flash-Lite planner using the same validated tool interface, SQLite checkpoints and shared spending ledger. Choose it in **Run simulation → Timing & experiment settings → Earlier coupon workflow → Workflow**, or inspect a saved run in the campaign room. Existing ordinary seasons remain scripted. See [autonomous setup and recovery](docs/campaign-workflow/autonomous-gemini.md).

The [workflow guide](docs/campaign-workflow/README.md) documents the API and first-run evidence. The run recorded 300 shoppers, 4,800 daily decisions, 74 coupons, 17 redemptions and 222 campaign-window purchases. Three redeemed orders have verified native PayPal sandbox captures totaling $139.28. No paid model calls or new Channel3 searches were made. Training, advancing, receipt and completion checkpoints were replayed after restart without repeating their effects.

## Walkthrough

1. **Earlier coupon-only seasons:** choose the objective, population, seed, virtual budget, shock and workflow.
2. **Days 1–28:** observe history and randomized exploratory offers. History spending is separate from the live budget.
3. **Day 29:** fit logistic regression and a small decision tree, reserving the latest seven days for temporal validation.
4. **Field test:** a persistent 25% customer holdout receives no live coupons. Eligible treatment customers receive model-selected offers or a disclosed rule fallback.
5. **Day 36:** the configured market conditions change. The adaptive coordinator waits for completed outcomes before its scenario-driven review.
6. **After days 42 and 56:** report 14-day inactivity in the baseline-active randomized cohort, signed lift and an approximate 95% interval.
7. **Model bench → Compare four policies locally:** replay no offers, fixed rules, scheduled ML and adaptive coordination under matched inputs.
8. **PayPal records:** inspect verified native receipts, select existing emulator orders to mirror, or open the order-to-capture warehouse view.
9. **Warehouse:** inspect or export tables, views, fitted artifacts and coupon-to-payment lineage.

Pause, advance a day, run seven days, or finish a season. Drag to pan the 3D map, right-drag to orbit, and scroll to zoom. Distinct heritage stores, showrooms, supply sheds, offices and street furniture form the commerce district. Screen-space shop names retain readable DM Sans text while the camera moves; nearby labels are repositioned to avoid collisions. Hover over people or stores for current details; click to open a details dock that reflows the map instead of covering it. The inspector also offers keyboard-accessible selection. With the canvas focused, arrow keys pan, R rotates and Home resets. A stable sample of up to 32 customers follows sidewalk routes; refreshed data does not reset in-progress movement. Customers stop at their recorded destination and people who return home disappear inside. One simulation step is one day; visual motion replays that day and creates no additional transactions.

## Agent workplaces in the district

Switch **District → Agent network** to locate the team. Lines show workflow dependencies, not live messages. Click a workplace to open its responsibilities and recorded decisions; click a role to focus the camera on its building.

| Workplace | Role | Implemented responsibility |
| --- | --- | --- |
| Operations HQ | Business lead | Records the chosen objective and budget; flags the configured market change. |
| Data Exchange | Data engineer | Builds completed-day observed features and enforces the data cutoff. |
| Model Lab | Data scientist | Fits logistic regression and a tree on the local CPU; produces offer-response scores. |
| Model Lab, evaluation desk | Experiment analyst | Checks temporal validation and randomized holdout outcomes, with uncertainty. |
| Operations HQ, control room | Coordinator | Requests reviews, promotes or rejects candidates, and keeps the existing policy on failure. |
| Campaign Studio | Campaign manager | Issues eligible coupons under budget, contact, stock and margin constraints. |
| PayPal ledger | Payment connection | Captures selected orders using a saved sandbox wallet and joins real provider IDs, fees and verification timestamps to those emulator orders. |

The feedback path is **city events → observed warehouse → models → review → offers → purchases → payment ledger → warehouse**. In ordinary seasons these responsibilities are scripted. In autonomous campaigns, one Gemini planner selects tools and plans while deterministic workers fit models and execute offers. The trail distinguishes Gemini decisions from scripted worker events. Autonomy does not establish superior campaign outcomes.

## Data and capability boundaries

- **Historical catalog:** 22 Channel3 products imported on October 21, 2026. These remain in archived runs. Active new runs use independently authored fixtures, with no external product IDs, prices or images.
- **Real local ML:** scikit-learn fits each season's observed rows. Saved JSON artifacts contain actual coefficients/scales or tree thresholds/probabilities. JavaScript predictions must match Python predictions before use.
- **Coordinator source:** ordinary seasons use scripts, earlier workflow runs use the assistant in chat, and Gemini campaigns use a metered app-owned planner. Attribution and token receipts are saved; no general LLM-agent advantage is claimed.
- **Simulated economy:** customers, merchants, inventory, coupons, payments, delivery, returns and market changes are fictional.
- **PayPal:** selected orders now use a saved sandbox PayPal wallet. Native captures, fees, net amounts and IDs are read back from PayPal and stored in `paypal_receipts`; `v_paypal_order_lineage` joins them to orders, merchants, products and coupons. The earlier standalone $100 receipt remains separate. The blocked legacy card path is not used by this wallet flow.

Customer scores are our fitted predictions, not Channel3 customer data or proprietary Channel3 scores.

For a fresh Channel3 import on another machine, follow the existing .env setup in README-market-metro-v1.md, open /metropolis.html and choose Sync Channel3. This is an explicit provider request using the configured credits. Then create a new learning season to use the cached result. The learning-market UI never syncs automatically.

## Native sandbox payment samples

The reusable sandbox buyer is already configured on this machine. The **legacy coupon-season form** defaults to three native samples when the saved buyer is ready; zero or one can also be selected. Automatic samples begin after the 28-day learning history and never exceed the selected count. Matched-policy comparisons always run without provider calls.

For another machine, open `/sandbox-buyer.html` and approve a generated Personal sandbox account once. The server verifies approval through Payment Method Tokens v3 and stores the resulting wallet token in the ignored, owner-readable `.local/paypal-vault-setup.json`. Use the sandbox account credentials from the Developer Dashboard. Do not enter real card details. A sandbox app's Client ID and Client Secret are server credentials, not the buyer login.

**PayPal records** also lets you choose existing field-test orders. The server reads the authoritative order amounts, permits at most three orders and $1,000 of test funds per season, writes stable request IDs before calling PayPal, and verifies the returned order reference, emulator order ID, invoice, USD amount, capture and fee/net reconciliation. A retry reuses the same request identity. Uncertain requests older than the conservative five-hour retry window require reconciliation rather than a fresh charge attempt.

One consenting sandbox buyer represents the selected synthetic customers; all fictional stores settle to the connected sandbox merchant. This is not a multi-merchant onboarding implementation. Native receipts do not add revenue to the simulated ledger. Native timestamps remain separate from simulation dates. Simulated buyer refunds do not issue provider refunds. Live PayPal hosts and live mode are unsupported.

The saved consent was verified across a server restart and two seasons: three main-season captures ($192.59 total) and one automatic second-season capture ($31.99), without another checkout. See [native integration validation](docs/paypal-wallet-integration-validation.json).

## Experiment contract

The [marketing decision benchmark](docs/marketing-decisions/README.md) compares sealed recommendations from the assistant in this chat with strong rules and the same local models on identical evidence. It executes bounded campaign actions in isolated economy forks, records costs and mistakes, and makes no provider calls. This tests decision review before adding an LLM planner.

Private customer traits include preferences, coupon response, loyalty, spending capacity and affinity. Training sees only observed pre-offer history, price, stock, payday and market conditions. Hidden traits are excluded from model inputs, public frames and exports.

External random draws are keyed by seed, customer, day and event kind. Policy changes do not change unrelated randomness. Comparison policies share identical history. Live inventory is partitioned between treatment and holdout so treatment demand cannot exhaust holdout stock.

The model predicts **a purchase during the next simulated day given the offer**. This differs from the evaluation's 14-day inactivity outcome. Current/future days are excluded from fitting. A candidate must improve validation log loss by at least 0.001 against both the fitted offer-rate baseline and any current champion. The selected candidate is then refit using already-observed rows. Rejection or failure preserves the current policy.

A scenario change is a disclosed scripted review trigger. After the first review, a follow-up runs once changed-condition days exist in both fitting and validation windows. Weekly checks can also trigger adaptive training if recent prediction loss exceeds the champion's validation loss by 20%. Scheduled ML retrains every seven live days. These are workflow rules, not learned orchestration.

Coupons are single-customer, single-product, single-day and single-use. Live contacts have a seven-day gap. Maximum discounts are reserved before issuing. Redeemed discounts plus assumed 2-cent outreach cannot exceed the virtual budget. A 20% post-fee/fulfillment order-margin floor applies. The profit objective additionally requires positive estimated incremental contribution.

Costs are assumed at 42–58% of catalog price, delivery at $3.50, and transaction fees at 3.49% + $0.49 (**not quoted PayPal rates**). Returned goods are not resold and COGS remains charged. Discounts already reduce payment volume; contribution deducts COGS, delivery, fees, refunds and outreach without subtracting discounts twice.

Retention uses the baseline-active randomized cohort, including eligible treatment customers who receive no coupon. Reported reduction is aggregate, signed and uncertain. Repeated windows reuse customers; do not add them as distinct saved people. Small samples and intervals spanning zero do not establish benefit. Results describe the authored simulator, not production ROI or PayPal profit.

## Warehouse

`.local/market-metro.sqlite` contains **33 public base tables and 12 SQL views**. Private `run_state` is excluded from exports.

Recommendation and audit additions: `marketing_planner_calls`, `recommendation_models`, `recommendations`, and `v_recommendation_journey` join fitted rankings and exposures to clicks, orders and optional same-order sandbox receipts.

Learning tables: `business_goals`, `campaign_assignments`, `coupons`, `coupon_redemptions`, `customer_days`, `model_runs`, `model_scores`, `team_decisions`, `retention_results` and `policy_comparisons`.

Views include `v_coupon_journey`, `v_learning_daily`, `v_model_history`, `v_retention_experiments` and `v_paypal_order_lineage`. Customer-day records pair a pre-action feature snapshot with the subsequently observed label. Model records preserve cutoffs, dataset hashes, candidate losses and fitted artifacts.

SQLite exports include one selected run and working views. JSON/CSV preserve full IDs, provenance and integer cents. Credentials, private state and payment request keys are omitted. Comparison run IDs are references to separate runs; a selected-run export retains comparison summaries without embedding all compared datasets. Campaign attribution alone is not causal lift.

## Code

- `demo/garden/world.mjs`: locally served Three.js 0.180 scene, people, camera controls, readable place labels and the workflow overlay.
- `demo/garden/city-art.mjs`: original, distinct retail and infrastructure architecture; street furniture and contextual city blocks.
- `demo/garden/agent-roles.mjs`: implemented role responsibilities and their map locations.
- `demo/garden/tycoon-motion.mjs`: tested sidewalk routing, continuous motion and pedestrian spacing.
- `demo/garden/app.mjs` and `style.css`: brief, town, team, models, comparisons and warehouse.
- `scripts/paypal-funding.mjs`: one-time sandbox wallet consent, private durable vault token and subsequent merchant-initiated payment source.
- `scripts/market-service.mjs`: bounded order selection, saved-wallet captures, idempotency and native receipt reconciliation.
- `scripts/marketing/economy.mjs`: seeded customer behavior, coupons, inventory and outcomes.
- `scripts/marketing/contract.mjs`: public feature contract, schema and portable inference.
- `scripts/marketing/train.py` and `trainer.mjs`: local fitting, validation, worker limits and parity checks.
- `scripts/marketing/orchestrator.mjs`: scripted roles, training decisions and fallback.
- `tests/city-art.test.mjs`: valid geometry and addressable workplaces for 8- and 12-merchant districts.
- `tests/tycoon-motion.test.mjs`: route clearance, stable refreshes and a crowded two-way replay.
- `tests/marketing-learning.test.mjs`: replay, seed changes, real training, accounting, isolation and failure behavior.

The previous metropolis remains at /metropolis.html and the reserve lab at /supply-yard.html. Historical setup is preserved in [README-market-metro-v1.md](README-market-metro-v1.md) and [README-supply-yard.md](README-supply-yard.md). The current demo needs no cloud infrastructure.

## License

Original project code is [MIT licensed](LICENSE). Fonts, dependencies, trademarks and provider data retain their respective terms; see [third-party notices](THIRD_PARTY_NOTICES.md).

### Recorded campaign demo

The main market uses the Market Metro city view. Checkpointed campaigns, cached Channel3 products and PayPal Sandbox receipts remain available through **Campaign run** and **PayPal records**.

See [the recorded demo results](docs/campaign-workflow/playful-demo.md) for the measured run, receipt lineage and limitations. Its former toy-village UI has been reverted.

### Side-by-side judge demo

**Run simulation** starts continuous commerce; **Run demo** creates a fresh Day 1 presentation; **Open team view** inspects the current run. Customers trade on an independent server clock while the marketing team analyzes snapshots, trains local models and chooses full-price recommendations, reactivation offers or trend promotions. Inspecting the work log or a shopper never pauses trading. Local mode costs $0 in model API calls and is explicitly scripted; the optional Gemini analyst retains the $0.25 cap. **Recorded campaign** keeps the older checkpoint replay available. See [the Microsoft Magentic Marketplace source audit and implementation notes](docs/continuous-market/magentic-source-audit.md).

Use **Run demo** in the main header to view the market and campaign office together. A fresh seed-314 campaign uses the existing Gemini planner with a $0.25 model-cost cap and up to one saved-wallet PayPal Sandbox capture. **Replay current campaign · free** reads saved checkpoints and warehouse rows without model calls or payment effects.

The day scrubber shows recorded visits, coupon issues, purchases and deliveries. Gold money sprites are simulated sales; coupon tickets come from issued coupon rows; blue PayPal effects require a verified receipt from that same campaign. The office contains one Gemini planner and local tool workers, not six separate LLMs. See [the judge demo guide](docs/campaign-workflow/judge-demo.md) for controls, provenance and the verified run.
