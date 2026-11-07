# Market Metro architecture presentation

Seven editable slides connect the implemented ontology, LLM planner, deterministic tools, verifier and PayPal integration to measured demo results. The two architecture views use open spacing, shorter labels and a consistent vector icon set. The numerical slides and underlying evidence are unchanged. The diagrams extend the selected DM Sans, C-layout/B-palette design in [the existing architecture](../../figures/planner-v23/README.md).

[Presentation](market-metro-ontology-paypal.pptx)

## The two architecture views

[Revised system architecture](slide-02.png) preserves the existing A–E planes and inserts the ontology between warehouse records and the planner's evidence and training tools. The checked campaign returns from the verifier to the environment. A separate path links selected orders to native Sandbox receipts.

[PayPal-centered architecture](slide-04.png) shows native payment execution, payment economics in the simulation, merchant outcomes and receipt reconciliation. Solid blue arrows identify the native test-order path. Dashed arrows show analysis. The figures label the modeled outcomes and native receipt separately.

## Slide sequence

| Slide | Purpose |
|---|---|
| 1 | Lead with the 384-merchant run and its measured gains |
| 2 | Explain environment, ontology, agent, tools, warehouse and PayPal interactions |
| 3 | Map each existing plane to its revised responsibility and judge view |
| 4 | Show PayPal at the center of execution and financial evaluation |
| 5 | Trace the real day-31 training and campaign decisions, then the day-61 hold |
| 6 | Compare fixed rules, a fresh planner and a fresh planner with ontology |
| 7 | Show all three live sizes, including the negative 96-merchant result |

Every slide includes source paths and presentation guidance in its speaker notes. The current submission is one LLM planner with deterministic tools and a verifier. The diagram does not relabel these tools as independent LLM agents.

## Mapping to the implementation

| Existing plane | Implementation | What the ontology adds |
|---|---|---|
| A — Market environment | [engine](../../../scripts/commerce-metropolis/engine.mjs), [environment](../../../scripts/commerce-metropolis/environment.mjs), [kernel](../../../scripts/commerce-metropolis/kernel.mjs) | Uses the same authored economy within each paired comparison |
| C — Data plane | [warehouse](../../../scripts/commerce-metropolis/warehouse.mjs), [feed verifier](../../../scripts/commerce-metropolis/feed-verifier.mjs), [feed gate](../../../scripts/commerce-metropolis/feed-gate.mjs) | Checkout and merchant-order identity, monetary units, conservation and ambiguity checks |
| B — LLM agent | [controller](../../../scripts/commerce-metropolis/harness/controller.mjs), [training adviser](../../../scripts/ontology/planner-training.mjs) | Lets the LLM choose an admissible target, cohort and exact feature list |
| D — Local tools and experiment sandbox | [tools](../../../scripts/commerce-metropolis/harness/tools.mjs), [trials](../../../scripts/commerce-metropolis/harness/trials.mjs), [model check](../../../scripts/commerce-metropolis/harness/model-check.mjs), [contracts](../../../scripts/commerce-metropolis/harness/contracts.mjs) | Validates training semantics, measures candidate models, and binds the approved model and campaign to execution |
| E — PayPal and review | [Sandbox adapter](../../../scripts/paypal-sandbox.mjs), [commerce adapter](../../../scripts/paypal-commerce.mjs), [live orchestration](../../../scripts/commerce-growth/autonomy/live.mjs) | Preserves receipt-to-order lineage and avoids counting split merchant legs as additional checkouts |

The ontology is a project-owned verifier inspired by NVIDIA's work. It is not a running NVIDIA package. The current catalog is authored; the deck does not imply active Channel3 ingestion.

## Evidence and boundaries

**384 merchants / 19,200 shoppers.** The fresh planner with ontology produced $103,422.70 modeled PayPal net after estimated model cost versus $100,111.95 for fixed rules. Merchant contribution rose by $36,042.88, retained purchases by 532 and retained sales volume by $78,636. Model inference was estimated at $0.059695. [Full live results](../../../demo/data/metropolis-live-results.json)

**One seed at each size.** Fresh policies differ across sizes, so the size ladder combines population and policy effects. The 96-merchant run increased modeled PayPal net by $23.63 but reduced merchant contribution by $480.29. The comparison is not a claim of consistent gains on unseen seeds.

**Proxy versus full-market evaluation.** Before publishing, proposals are screened on three separate 12-merchant / 600-shopper development markets. The final financial comparison runs the whole selected shared market against the same-size fixed policy. Proxy approval does not guarantee improvement at every live size.

**Real model training.** At day 31, the 384-store planner selected eight features and a product-contact cohort. Its recommendation-contact AUC was 0.7620 versus 0.7503 for the broader candidate. The ontology model was deployed after campaign revision. At day 61, proposed changes failed the incumbent guards and the prior campaign remained active. The automatic component trials belong to the harness; the subsequent campaign revision is the LLM's recorded choice.

**Separate three-way campaign.** The 12-merchant trial recorded modeled PayPal net of $3,309.83 for fixed, $3,391.08 for the planner and $3,424.78 for planner with ontology. Because both LLM arms make fresh decisions, this is an end-to-end system comparison, not an isolated causal estimate of ontology. The narrower eight-feature candidate was rejected in that smaller trial. [Three-way evidence](../../../demo/data/ontology-live-campaign.json)

**Native Sandbox evidence.** The archived $96 capture `2M324038C71499318` has a $3.56 provider fee and $92.44 test merchant proceeds. It belongs to the separate original 12-store judge run and uses fictitious funds. The new scale runs made zero native payments. Merchant proceeds are not PayPal profit. [Receipt](../../../demo/data/judge-reactivation.json)

**Meaning of net.** Modeled PayPal net is the platform account change after authored fees, processing, outreach and settled obligations, with model inference cost deducted. Merchant contribution includes inventory and pipeline valuation. These are simulator accounting measures, not PayPal's reported corporate profit or production ROI.

**Ontology benchmark.** Of 12 valid held-out synthetic feeds, ontology certified 12 and fixed mapping certified six. Both held all 12 unsafe feeds. The doubled coverage refers only to this authored feed study. [Feed benchmark](../../../demo/data/ontology-study.json)

[Evidence hashes](evidence.json) pin the source artifacts used to prepare the deck.

## Judge navigation

Open the saved 384-store run at `studio.html?session=AUTONOMY-d8f8e3695c9118cb&view=market&judge=1`. Change `view` to `ontology`, `workflow`, then `performance`. The original native receipt appears in `judge.html#result`.

The saved environment screenshot used in slide 2 comes from an earlier recorded view of the same renderer. It illustrates the environment plane, not a simultaneous rendering of all 384 stores. Lucide supplies the [semantic vector icons](vectors/sources.json), with the [original license](vectors/LICENSE). Original SVG paths are retained, with diagram colors and a consistent stroke weight. Brand logos retain their original artwork. The screenshot’s [capture provenance](../../figures/planner-v23/assets/environment-snapshot.json) and [logo credits](../../figures/planner-v23/assets/sources.json) remain with the original assets.

## Rebuild

The [drawing source](build.mjs) uses `@oai/artifact-tool` and `@napi-rs/canvas`, the bundled presentation runtime and the committed DM Sans fonts. It does not change application dependencies or run any model, payment or simulation calls.

Run from the repository root with the presentation runtime's Node executable and modules. Copy `build.mjs` into `.local/architecture-deck/`, link that directory's `node_modules` to the bundled modules, then run the copy. It creates native editable diagram objects and tables, speaker notes, PNG previews and a private draft PPTX. Validate the draft with the presentation skill's `finalizePresentation` before replacing the distributed deck. Output is 1600 × 900, with seven slides and native data tables on slides 6 and 7.
