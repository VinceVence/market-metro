# Marketing beyond coupons

Implemented 24 October 2026. The existing city, saved runs, checkpointed coupon workflows and PayPal adapter are preserved.

## Operator and team responsibilities

**Run simulation** opens the simulation-settings popup. Operators set the environment, budget, business goal and allowed actions. A change creates a new run; it never rewrites a recorded population. Supported bounds are 4–12 merchants, 50–1,200 shoppers, 42–365 total days, starting at Day 1 with no pre-generated history, and 0.1–5 seconds per simulated hour. First automatic review: after 30 completed days (28 days of learning plus two observation days). Later review cadence: 4–14 days.

The coordinator chooses among full-price recommendations, reactivation offers, trend promotions or waiting. The local coordinator is explicitly scripted: goal-sensitive priority scores rank enabled, affordable opportunities. Those priority scores are not estimates of incremental profit. The Gemini tool schema supports the same choices, but the new path has only fake-provider tests; no fresh paid Gemini run was authorized or performed for this expansion. One planner and local workers implement the team, not six independent LLMs.

- Business lead: dated product-view, purchase and inactivity aggregates.
- Data engineer: completed observations, catalog identities and training cutoff.
- Data scientist: choose the relevant worker—offer-response fitting or lightweight product ranking.
- Experiment analyst: later-day validation; recommend popularity if personalization loses; preserve customer holdouts.
- Coordinator: choose campaign type, product scope, retraining and publication, with a public rationale.
- Campaign manager: execute the published action under stock, budget, contact and margin guards. Record outcomes; never force purchases.

## Lightweight recommender

`scripts/marketing/recommender.mjs` fits observed counts in JavaScript, without a package dependency or external service. A visited item contributes one weight and a purchased item adds three. Each customer's observed item/category shares are combined with smoothed catalog popularity. Rank scores are not probabilities. Cold-start shoppers use popularity.

For each fit, the final seven completed days supply validation purchases; the previous 21 days supply training. Recall@3 compares the personalized ranker and popularity over the same catalog and later purchases. Personalization must be strictly better with at least 20 validation purchases. Otherwise popularity is selected. The selected form is refit on all 28 completed days, with the cutoff, row counts, hash, artifact, runtime and metrics saved. There is no access to hidden simulator traits or future data. Execution also filters for the published product scope and available stock, so offline Recall@3 is not a claim of live campaign uplift.

A fitted candidate is saved separately from the active recommender. It cannot serve shoppers until the publication checkpoint. Model fitting and analysis leave the market clock running. Candidate failures preserve the previous campaign. The offer-response worker retains its existing chronological loss gates.

## Shopper behavior and financial assumptions

Recommendation outreach costs a modeled 2 cents per exposure. Eligible targetable shoppers see at most one campaign contact within seven days. Holdouts receive no live marketing. Products must have available stock and at least 20% modeled margin. Recommendations carry **zero discount**. Reactivation and trend promotions retain the 5%/10% offer-response and positive-contribution guards.

A recommendation click is a seeded draw: 34% for the simulator's hidden preferred category, 10% otherwise. Clicking selects that product for a visit; purchasing still depends on the existing independent seeded purchase draw, wallet, stock and hidden behavior. The ranker never receives the hidden preferred category. These click rates are authored simulation assumptions, not measured Channel3 or PayPal data. Ignored recommendations and clicks without purchases are recorded. There is no special success rule for the featured shopper.

No return or marketing-linked purchase is labeled causal lift. The persistent randomized holdout remains available for aggregate evaluation. Transaction fees (3.49% + 49 cents), unit costs and fulfillment costs remain modeled assumptions. Discounts already reduce revenue and are not deducted a second time.

## Warehouse and PayPal

New tables are `recommendation_models` and `recommendations`. `v_recommendation_journey` joins exposure, ranked alternatives, selected model and review, click, optional same-day order, simulated transaction, and optional native receipt for that exact order. All exports include these tables and the view; hidden world state remains excluded. There are now 32 public base tables and 12 SQL views.

Channel3 supplies the existing cached product catalog; synthetic merchants may list the same provider product. Shopper data comes from our simulator. No Channel3 refresh or paid API request was made for this expansion.

Ordinary purchases write simulated transactions. The existing PayPal sandbox connection can separately mirror one selected continuous-run order using fictitious funds. It never captures automatically in continuous mode. The shopper demo does not borrow another order's receipt, and the capture control is disabled until that shopper has an eligible order. No new sandbox capture was made during this work.

## UI and demo

- Main simulation: settings popup, marketing playbook, active action, model results and clickable worker roles; city remains visible.
- Team view: live market on one side, compact role cards and Evidence / Action / Result on the other; recommendation effects join coupon/money effects.
- Run demo: a fresh Day 1 hourly run with the visible office and a five-stage observation-to-response guide. Shopper story: one recorded journey through catalog, model, campaign checkpoint, exposure, response and ledger. Prefer Iris 10 if she has a campaign purchase; otherwise follow another completed shopper. The view explicitly labels this as an example, not a success rate. Opening or reading it does not pause the market.

## Validation and observed local run

`node --test tests/continuous-market.test.mjs tests/marketing-learning.test.mjs tests/market.test.mjs tests/campaign-workflow.test.mjs` passed **23 tests**. This includes real local offer-response training, a fitted count ranker, publication staging, frozen cutoffs, continued trading during asynchronous work, holdouts, costs, allowed campaign actions, idempotent configuration, SQL exports and legacy workflow behavior. Fake-provider tests do not claim paid Gemini quality.

The [saved local evidence](marketing-expansion-evidence.json) records run `GARDEN-LIVE-c98f5f5f949daa06`, seed 314, ten merchants, 300 shoppers, rival-sale scenario and a $300 virtual budget. At day 109: 2,539 recommendation exposures, 867 clicks, 188 associated purchases, 1,002 total live purchases, and $50.78 modeled outreach. No live coupons were needed for the profit-oriented local policy. This is a single authored environment, not evidence of profit improvement against a control.

Theo 01's first completed recommendation journey used Channel3 product `w7qtfaR`: published after day 58, exposed and purchased on day 60 for $31.99 at full price. The corresponding ranker had 36.2% personalized Recall@3 versus 20.3% popularity over 69 later validation purchases. The local ledger modeled a $1.61 payment fee. No native PayPal receipt exists for this order. The GCP spending ledger remained byte-for-byte unchanged.


## Day 1 and hourly clock update

New continuous runs default to `clockUnit: "hour"` and begin paused at Day 1, 00:00 with no orders or customer observations. The UI renders that first frame, then resumes the independent market clock. `Run demo` opens the same settings popup with seed 314, 42 total days, a local planner and 100 milliseconds per simulated hour. `Run simulation` also starts at Day 1 and uses the configured pace. Existing saved daily runs and the explicit `clockUnit: "day"` compatibility path retain their recorded history.

This is hourly execution, not a cosmetic clock over precomputed daily purchases. Each shopper receives one seeded opportunity in a specific hour each day. Events, orders, payments and deliveries are committed at that hour. Daily restocking/holdout setup runs once, daily budgets persist across hours, and a day is finalized only after its 24th hour. Training queries exclude the currently open day. Reading a log or fitting a model does not pause the market.

The office view uses the existing worker sprites. Collection highlights the data engineer, model fitting highlights the data scientist, and the coordinator/campaign roles reflect recorded activity. Role subtext stays visible on small screens. Redundant "Market details" headings are removed; the main market and demo both show a prominent day/hour clock. Learning-period coupons are explicitly labeled learning offers, rather than being attributed to a not-yet-trained planner.

The [hourly run evidence](hourly-demo-evidence.json) records 42 completed days, 12,600 customer observations (300 shoppers × 42 days), and events in 1,003 of the 1,008 hours; quiet hours legitimately have no events. The run fitted its local recommender and published product campaigns. No model API calls or native PayPal captures occurred. The spend ledger stayed unchanged. 28 relevant automated tests passed, including hourly uniqueness, budgets, completed-day training cutoffs, delivery reconciliation and legacy workflows.
