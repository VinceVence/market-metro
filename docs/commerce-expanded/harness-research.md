# Market Metro expanded v1: a multi-agent harness for commerce experiments

**Recommendation: pause economic time at scheduled decision boundaries when evaluating policy quality, then give three agents a genuine diagnose–experiment–revise workflow.** Keep a separate asynchronous mode to test operational latency. A model taking a few seconds to train should not accidentally mean that its campaign arrives eleven business days late. However, removing that delay does not itself produce a better policy: the timing diagnostic below improved one market and harmed another. The larger problem is that the current team has limited analytical tools and publishes campaigns without testing the exact proposal's financial effects. [Local code and timing audit](harness-audit.md)

The defensible project is an autonomous commerce experimentation team: it finds a bottleneck, builds an appropriate dataset, trains and checks candidate models, tests campaign and fulfillment contracts, and revises its decision from measured feedback. Published agent research supports those components, but does not prove that this combination will increase PayPal profit. This report proposes the next architecture; the live application still runs the current team. The new work completed here is a code audit and a free, controlled timing diagnostic. [Building Effective AI Agents — Anthropic](https://www.anthropic.com/engineering/building-effective-agents) [MLE-STAR: A state-of-the-art machine learning engineering agent](https://research.google/blog/mle-star-a-state-of-the-art-machine-learning-engineering-agents/)

## Why the current team is underperforming

The baseline name is misleading. **Strong fixed rules already use data science:** a rolling demand forecast and joint stock allocation. Consequently, a near tie does not show that forecasting, optimization or recommendation systems are useless. It shows that the additional learned outreach policy and LLM choices have not consistently improved on an already competent numerical workflow. The right comparison must isolate the extra contribution of model learning, experiment selection and multiple decision makers. [Local code and timing audit](harness-audit.md)

The implementation audit found six concrete limitations:

| Current behavior | Why it matters | Proposed change |
|---|---|---|
| Two reviews and at most six LLM calls in the current live campaign | Agents make occasional choices from a prepared packet; they cannot investigate an unexpected bottleneck through tools | Allow bounded analytical queries and one evidence-driven revision per review |
| First model uses 2,762 historical contacts and zero matured local contacts | Thirty days of shopping does not automatically provide thirty days of labeled campaign responses | Build separate datasets for observed demand, immediate funding and delayed retained purchases |
| Second fit adds 197 local rows to 2,762 historical rows | Only about 6.7% of that training set reflects the current run | Validate local-versus-historical weighting and cohort performance |
| Campaign previews use all shoppers and a zero-value threshold | The manager may publish a narrower audience and a different threshold than the preview evaluated | Evaluate and identify the exact proposed contract before publication |
| Funding response adjusts retained-purchase odds | Authorization and eventual retained purchase are different events | Model the funnel stages separately and validate their composition |
| The publication gate compares historical classifier loss with a coarse predictor | A passing model can still reduce merchant contribution or waste stock | Add current-domain model checks and campaign-level financial validation |

These are verified properties of the current code and saved run, rather than diagnoses inferred from a disappointing headline. The first review read internal day 30 and published for day 41; the second read day 61 and published for day 71. Displayed dates are one day higher. On 715 issued recommendations, the funding adjustment worsened Brier error from 0.1617 to 0.1680. The run achieved four more retained purchases, but merchant contribution fell $22.38. [Local code and timing audit](harness-audit.md)

**The learning target needs more attention than the model's name.** The application estimates a retained purchase conditional on an issued contact. That is useful, but it does not establish how much the contact changed the purchase probability. Observed contacts are also selected by earlier policies. Schnabel and colleagues show why such selection matters in recommender training and evaluation. We cannot turn uncontacted shoppers into negative examples or call attributed purchases incremental sales. [Recommendations as Treatments: Debiasing Learning and Evaluation](https://proceedings.mlr.press/v48/schnabel16.html)

There is also a concrete label-timing issue: **40 contacts without immediate authorization later produced retained purchases** in the saved expanded run. For example, a contact on internal day 30 became a capture on day 35. Immediate funding is therefore an early signal, not the final sales outcome. This is an after-settlement finding, not a fact the policy could know before those contacts. [Local code and timing audit](harness-audit.md)

Chapelle's delayed-feedback work separates conversion probability from the time needed to observe conversion, illustrating the tradeoff between premature negative labels and stale training sets. That is a methodological precedent; our payment funnel has its own authorization, fulfillment, deadline and return events. [Modeling Delayed Feedback in Display Advertising](https://wnzhang.net/share/rtb-papers/delayed-feedback.pdf)

The current feature pipeline is intentionally small and observable. That is a useful safety boundary, but the scientist should be able to propose additional bounded features, such as category-level demand acceleration, stock coverage relative to expected demand, recent inquiry effectiveness, and delivery feasibility. These must be computed identically during training and serving. Google’s production guidance explicitly separates model metrics from business impact and emphasizes feature consistency, data slices and model age. [Production ML systems: Monitoring pipelines  |  Machine Learning  |  Google](https://developers.google.com/machine-learning/crash-course/production-ml-systems/monitoring)

## How simulation time should work

There are two different experiments: **decision quality under equal information** and **service quality under real computational delay**. Mixing them makes the answer depend on laptop load, network response time and animation speed. SimPy's documented distinction between an ordinary event-driven environment and a wall-clock-synchronized environment provides the relevant engineering precedent. We do not need to replace the JavaScript engine with SimPy to adopt that separation. [Environments — SimPy 4.1.2.dev16+gf43816490 documentation](https://simpy.readthedocs.io/en/latest/topical_guides/environments.html) [Real-time simulations — SimPy 4.1.2.dev16+gf43816490 documentation](https://simpy.readthedocs.io/en/latest/topical_guides/real-time-simulations.html)

| Mode | Economic clock during a review | What it measures |
|---|---|---|
| Decision benchmark — recommended default for comparisons | Wait at the same scheduled decision boundary for every arm | Quality of decisions given the same information and action opportunity |
| Live asynchronous market | Continue using the last valid published policy | Staleness, deployment delay, throughput and recovery behavior |
| Judge replay | Play already committed events at adjustable visual speed | Explanation of a recorded run; no new decisions or transactions |

In benchmark mode, the engine creates a dated observation, checkpoints it, waits for analysis and training, validates the proposed policy, then continues economic events. Waiting does not mint income, settle invoices, advance returns or create extra customer needs. The old economy's transition rules remain unchanged. Every comparator gets the same logical decision schedule, even if a fixed rule takes milliseconds and an LLM takes seconds. Record actual latency and model cost separately so the quality benchmark does not hide operational expense.

For the visual demo, show **Day 31 · team reviewing** with visible agent work and a stationary economic counter. Ambient character animation may continue, but it must not fabricate new purchases while transaction time is paused. Once a valid policy is committed, the next economic events proceed. The live asynchronous option remains available when we specifically want shoppers to trade through a review.

Checkpointed execution is useful here because model calls and training are nondeterministic or costly operations. LangGraph's official documentation describes restoring completed task results on replay and requiring idempotence for side effects that may run again after interruption. Our equivalent implementation can use the existing SQLite store and artifact files; adopting these semantics does not require a framework migration. [docs/src/oss/langgraph/functional-api.mdx at main · langchain-ai/docs · GitHub](https://github.com/langchain-ai/docs/blob/main/src/oss/langgraph/functional-api.mdx) [Persistence - Docs by LangChain](https://docs.langchain.com/oss/python/langgraph/durable-execution)

**I tested the timing hypothesis without new Gemini calls.** Both arms used the same first trained model, which contained no local-run training labels, and the same already chosen campaign. One activated at internal day 30; the other at day 41. The later model and second review were excluded from both arms. Within each seed, opening state, finite needs, consent and income matched. This is a conditional timing diagnostic, not a fresh-agent benchmark. [Local code and timing audit](harness-audit.md)

| Seed | Earlier activation: PayPal net difference | Merchant difference | Retained purchase difference |
|---|---:|---:|---:|
| 20261103, previously seen | +$49.45 | +$621.55 | +5 |
| 20261104, additional diagnostic | −$109.64 | −$1,674.68 | −10 |
| Mean of these two | −$30.10 | −$526.57 | −2.5 |

The signs differ. Earlier exposure to a campaign can help or hurt because contacts, stock and household budgets affect later opportunities. **Use the decision barrier to remove an accidental timing confound, not to manufacture a win.** Keep the unsuccessful diagnostic in the report. Neither two seeds nor replaying a saved policy proves that a new multi-agent architecture is strong. [Local code and timing audit](harness-audit.md)

## A stronger commerce harness

The proposed team has **three LLM roles and a deterministic execution/verifier layer**. Its defining change is the ability to choose and evaluate analytical work. It does not need an LLM for every shopper, arithmetic calculation or payment operation. Anthropic distinguishes model-directed tool use from a prescribed prompt chain; this distinction helps identify where the current application needs more agency. [Building Effective AI Agents — Anthropic](https://www.anthropic.com/engineering/building-effective-agents)

The architecture and decision table below assigns each role a distinct job.

| Component | Decisions it owns | Concrete tools and output |
|---|---|---|
| Demand analyst | Which category, cohort or funnel stage is limiting purchases; what to investigate next | Query observed demand, compare time windows, inspect stock coverage and conversion stages; emit an evidence-backed opportunity contract |
| Modeling scientist | Which target, features, training window and model family address that bottleneck; whether an experiment improved it | Build versioned datasets, fit local models, evaluate temporal/cohort slices, ablate a feature group; emit a model contract with failed trials retained |
| Campaign and fulfillment strategist | Which eligible shoppers and products to target; contact timing and budget; stock cover and permitted settlement routing | Compile a campaign, evaluate that exact contract on development markets, compare alternatives, revise once; emit a deployable campaign contract |
| Trusted verifier and executor | Whether a proposal satisfies evidence, budget, consent, inventory and financial constraints | Validate artifact hashes and cutoffs, enforce limits, commit policy, execute modeled payments, reconcile native samples |

### Give agents an experiment loop

The analyst should be able to request another breakdown after an initial query. For example, a falling purchase rate might come from weak interest, insufficient authorization, missing stock, or failed fulfillment. Those imply different actions. Automatically retraining the same response classifier for every symptom is not a useful data-science workflow.

The scientist receives the analyst's evidence references and decides which component to test. Google’s MLE-STAR uses component ablations and targeted refinement rather than repeatedly replacing an entire pipeline. The relevant adaptation is to compare a small number of feature, target or calibration changes and retain their measured effects. Its reported machine-learning benchmark results do not establish commerce profit, and we should not imply that our bounded trainer is a complete implementation of MLE-STAR. [MLE-STAR: A state-of-the-art machine learning engineering agent](https://research.google/blog/mle-star-a-state-of-the-art-machine-learning-engineering-agents/)

Harness² provides a complementary pattern: propose a change to the harness, probe executions, and compose an improved harness from the resulting evidence. In Market Metro, that suggests learning whether a better demand query, dataset contract or evaluation tool changes the campaign decision. Harness²'s original probes are not a license to consult future outcomes from the active benchmark market. Use completed development markets for candidate testing and keep confirmation markets sealed. [GitHub - google-research/harness2 · GitHub](https://github.com/google-research/harness2)

A first implementation should expose typed tools such as `query_funnel`, `compare_cohorts`, `build_dataset`, `fit_model`, `ablate_features`, `compile_campaign`, `evaluate_campaign` and `publish_campaign`. The query tool accepts registered metrics, dimensions and time windows. The dataset tool accepts an allowlisted feature recipe and target definition. Agents can vary those specifications, but cannot write arbitrary SQL into production tables, edit buyer behavior or access hidden need/response draws.

Each tool result should include its observation cutoff, dataset or artifact hash, row count, warnings and measured output. The next role receives references to those artifacts. The scientist can challenge a tiny cohort; the strategist can reject a prediction improvement that loses money after fulfillment costs. **A successful handoff changes the next action.**

### Recommender and model training

Use separate targets for funding within the request deadline, capture after funding, and retention after capture. Keep immediate funding as an auxiliary prediction. A conceptual factorization is:

`P(retained purchase | context, action) = P(funded | context, action) × P(captured | funded, context, action) × P(retained | captured, funded, context, action)`.

Here, funded means eventual funding before expiry, not immediate authorization. Each head needs its own eligible observations and maturity rule. An unfunded request may fund later; a funded request awaiting inventory is pending for capture; a purchase inside the return window is pending for retention. Quick funding observations can inform an auxiliary head without directly shifting retained-purchase odds. Start with logistic or small tree models and validate the composed probabilities. The delayed-feedback literature motivates handling incomplete outcomes explicitly. [Modeling Delayed Feedback in Display Advertising](https://wnzhang.net/share/rtb-papers/delayed-feedback.pdf)

Build the recommendation process in three stages: generate candidates from allowed observed signals and purchase history, estimate their relevant outcomes, then rerank under stock, consent, contact-frequency and economic constraints. Google's recommendation guidance supports separating candidate generation from scoring and final constraints. A deep two-tower model is unnecessary for sixteen products; a small, well-validated candidate pool can be more appropriate. [Scoring  |  Machine Learning  |  Google for Developers](https://developers.google.com/machine-learning/recommendation/dnn/scoring) [Re-ranking  |  Machine Learning  |  Google for Developers](https://developers.google.com/machine-learning/recommendation/dnn/re-ranking)

Score business proposals using the actual accounting objective. Modeled platform contribution includes retail and supplier payment fees, less processing, fee returns, outreach and real AI expense. Merchant contribution includes goods, delivery, payment costs, returns and inventory effects under the current accounting. Report cash and terminal inventory separately. Extra supplier purchases must not be rewarded merely because they generate more payment fees. Those quantities are outcomes of the frozen economy and need to be compared against the same-size control. [Local code and timing audit](harness-audit.md)

An uplift model is a possible later addition, not an automatic fix. To learn whether contacting someone causes an additional purchase, we need an exposure design with known assignment probabilities and an appropriate control. A small consented randomized exploration allocation could supply such data without changing shopper behavior, but competing buyers share inventory and cash constraints. Treat whole-market paired runs as the primary financial comparison; do not overstate a customer-level causal estimate that ignores this interference. Selection-bias correction requires support and identification assumptions, not simply another model name. [Recommendations as Treatments: Debiasing Learning and Evaluation](https://proceedings.mlr.press/v48/schnabel16.html)

### Test the contract that will actually execute

The campaign artifact should bind its audience, candidate generator, model, feature plan, contact budget, threshold, product constraints and fulfillment settings. `evaluate_campaign` must consume this exact artifact. The verifier rejects publication if the tested hash differs from the proposed hash, if the observation has become stale under the chosen clock policy, or if required financial and consent checks fail. This directly fixes the current preview/publication mismatch. [Local code and timing audit](harness-audit.md)

The bounded workflow is:

`observe → investigate → build dataset → fit/ablate → propose campaign → evaluate → revise or retain → validate → publish → operate → settle → review`.

The LLM decides whether to investigate availability or customer response, which training recipe to try, and how to revise an unsuccessful campaign. Deterministic code decides whether an artifact is legal and executes it. Every review has a call budget, a local trial budget and a stop condition. Failure to improve should preserve the current valid policy and produce an explicit rejected proposal, rather than trigger unlimited search. [Building Effective AI Agents — Anthropic](https://www.anthropic.com/engineering/building-effective-agents)

### Make PayPal central to the demonstrated reasoning

Consider a proposed demonstration, not a measured result: the analyst finds plenty of funded requests but poor capture completion in a category. The scientist determines that availability and lead-time features explain more of this failure than another outreach score. The strategist compares recommending available approved alternatives with replenishing stock, including modeled bank delay and PayPal supplier-settlement costs. The verifier accepts only a funded, deliverable, margin-compliant contract.

A resulting purchase follows authorization, complete-basket capture, supplier settlement, delivery and possibly refund. Those events are the next review's training and accounting evidence. PayPal's role is thus payment completion and feedback on economic outcomes, rather than a logo next to a sales counter. The current app models these flows; the optional Sandbox adapter mirrors one selected retained order and keeps its native receipt separate. A simulated gain or Sandbox receipt does not establish production PayPal profit. [Local code and timing audit](harness-audit.md)

## How to prove each component helps

The next comparison should answer three distinct questions: does the better learning pipeline help, does LLM-directed experimentation help, and does dividing that work among agents help? These cannot be answered by comparing a new team with an intentionally weak rule. The existing strong baseline remains an essential control. Google’s monitoring guidance also cautions that improved model metrics need separate business measurements. [Production ML systems: Monitoring pipelines  |  Machine Learning  |  Google](https://developers.google.com/machine-learning/crash-course/production-ml-systems/monitoring)

| Arm | What it can use | Contribution isolated |
|---|---|---|
| Strong fixed | Current forecasting, joint allocator and fixed outreach | Existing competent software |
| Numerical workbench | Same feature/model/campaign tools, chosen by a bounded deterministic search | Better ML and tool quality without an LLM |
| One planner | Same evidence, tools, model and total call/trial budget as the team | Value of model-directed experimentation |
| Three-agent team | Separate analyst, scientist and strategist with artifact handoffs | Additional value of specialization and coordination |

All arms must share the expanded economy version, initial state, seed-specific exogenous inputs, legal action space, decision dates, label cutoffs and settlement tail. The one-planner arm must receive equivalent information and the same total budget; depriving it of a tool or giving the team additional experiments would confound the conclusion. Development results can guide choices; fresh confirmation outcomes cannot be fed back into the search while retaining their held-out label.

Measure financial outcomes after settlement: retained purchases, retained payment volume, modeled PayPal contribution after AI cost, aggregate and per-merchant contribution, terminal cash, inventory and liabilities. Also report these per 100 shoppers. The enlarged market's raw totals are not evidence of smarter decisions. The present live result remains mixed: $9.13 more platform contribution with $22.38 less merchant contribution. [Local code and timing audit](harness-audit.md)

Measure model performance separately: funding and retention Brier/log loss, precision at the actual contact budget, calibration by category and signal age, and eligible-candidate coverage. ROC-AUC can be useful, but a ranking metric alone does not tell us whether a budgeted action is economically worthwhile. Chapelle evaluates calibrated likelihood because the estimated probability determines expected impression value; the same distinction matters when our scores drive spending decisions. [Modeling Delayed Feedback in Display Advertising](https://wnzhang.net/share/rtb-papers/delayed-feedback.pdf)

Measure harness behavior through concrete outcomes: how often an extra query identifies a different bottleneck, a feature ablation changes the selected model, a failed trial causes revision, a verifier blocks an untested proposal, or a restart resumes without duplicate work. Checkpointing makes these traces recoverable; it is not by itself proof of better recommendations. [docs/src/oss/langgraph/functional-api.mdx at main · langchain-ai/docs · GitHub](https://github.com/langchain-ai/docs/blob/main/src/oss/langgraph/functional-api.mdx)

The bounded implementation and evaluation plan starts with the logical decision clock and exact-contract gate. Next give the analyst targeted EDA and the scientist dataset/feature experiments, preserving training-serving parity. Then connect the strategist to a small development-trial tool and permit one revision. Finally compare the four arms. This sequence gives each increase in autonomy a measurable job. [MLE-STAR: A state-of-the-art machine learning engineering agent](https://research.google/blog/mle-star-a-state-of-the-art-machine-learning-engineering-agents/) [Production ML systems: Monitoring pipelines  |  Machine Learning  |  Google](https://developers.google.com/machine-learning/crash-course/production-ml-systems/monitoring)

For the first fresh pilot, pre-register four cases covering discovery, reactivation, low response and zero response. Run one planner and the team on each, with at most $0.25 per paid arm: a **$2 maximum reservation**, plus free local controls. Respect the application's existing tighter ledger cap as well as the user's $50 total ceiling. The research and timing diagnostic in this report added **zero paid model calls**. This proposed pilot is not yet run and its budget is not a claim of money already spent.

The advancement condition should require a positive mean change in retained purchases and modeled platform contribution, no aggregate merchant loss, no new unpaid liabilities, and an advantage over one planner that survives a later fresh panel. Report uncertainty and individual losses even if the pilot passes. Four cases can justify another bounded test, not a production claim. If the numerical workbench performs as well as the team, credit the ML and tools; if one planner matches the team, retain the simpler orchestration for that task.

**The next system should run and respond to experiments.** Correct clocks, outcome labels and exact campaign trials make the comparison meaningful. Multiple agents earn their place only if their investigations and revisions improve on the same tools in one planner. [Building Effective AI Agents — Anthropic](https://www.anthropic.com/engineering/building-effective-agents) [GitHub - google-research/harness2 · GitHub](https://github.com/google-research/harness2)
