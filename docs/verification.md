# Local prototype verification

## Shared reader repair and Pro rerun — October 21, 2026

- **123 software tests pass.** The additional checks cover legacy-spend preservation across the model upgrade, non-200 accounting without retries, grounded allocation rows, partially informative old records, explicit cancellation and unknown quantities/status/business age.
- Live provider responses identify **`gemini-3.1-pro-preview`**. The reader probe passed, followed by the exact V2 case IDs, raw evidence, oracle, fixed routing, tool limits and repetition count: **40 formal trials**. The planner prompt is unchanged.
- **Both methods pass 20/20**, versus 6/20 each in V2. Both use **24 source queries**. No unsupported packet, unnecessary escalation, missing finding or harness stop occurs. Reader and model changed together; this is not an isolated model-size experiment or independent validation.
- All **20 paired inputs and shared extraction/quote/receipt sets match**. Batch billing reconciles once per unique receipt. All earlier ledger entries remain unchanged.
- V3's returned-token estimate is **$0.636276**, including the probe. Cumulative estimate is **$0.679692**. All 89 V3 requests returned usage; no rejected request, pending reservation, open circuit or active inference writer remains.
- The agent adds **$0.201226** equivalent model cost for the same outcome and source cost. Human review cost and actual PayPal benefit remain unmeasured. APAC was not modified, and the PayPal sandbox store still contains the original one order.
- [Results](llm-pilot-results-v3.md) · [Protocol](reader-pro-v3.md) · [Evaluator-only source-cost lower bound](llm-pilot-headroom-v3.json).

## Vertex adapter and spend guards — October 21, 2026

- **119 local tests pass.** Nine added checks cover durable reservations, run/lifetime admission limits, exclusive writers, uncertain network outcomes, project pinning, native-cap verification, thinking-token costs, extraction parity including failures, and rejected payment tools. No inference is performed by the test suite.
- Created the separate `supply-yard-pilot-261021` project and verified its **$10/month native Vertex spend cap**. The CLI additionally enforces $8 lifetime and $1 per run. [Setup receipt](gcp-pilot-setup.json) and [scope/limits](vertex-pilot.md).
- Live Gemini calls use raw authored documents and returned usage metadata. The browser cannot start paid inference; the main economy still runs its scripted scenario.
- The completed live comparison has **40 trials on 10 development cases**, two repetitions per method, with **20 matching input/semantic pairs**. Both methods passed six of 20; the adaptive method used 35 source checks versus 22. Shared reader failures and missing warnings remain failures. [Full results](llm-pilot-results.md).
- Returned-token estimate across all live attempts: **$0.043416**. Two definitive HTTP429 responses were explicitly reconciled to zero, preserving the audit and cumulative allowance. The ledger has no pending reservation or open circuit; inference has stopped. This is not a reconciled billing invoice.
- Initial provider-rate interruptions and malformed reader outputs are retained as failures. Full model performance belongs in the live pilot report, separate from these passing software checks. No production reserve change, PayPal payment or APAC mutation was made.

## Investigator benchmark infrastructure — October 21, 2026

- **110 tests pass**, including 14 new harness tests. The 48-case suite is frozen with source prices and a digest; 32 development and 16 family-holdout cases run in isolated environments.
- The default fixed workflow yields 41 supported ready packets, seven appropriate escalations, zero unsupported readiness and 60 source calls. Gather-all uses 240 calls for the same results; the cost-aware script uses 76. All prices are assumptions and no LLM is running.
- Tests reject guessed answers, unretrieved citations, wrong-order/payment tool requests, over-budget loops and timeout/malformed results. Unknown human/model cost is never converted to zero.
- Browser checks executed the suite and the two-call diagnostic. The latter exposes eight unnecessary escalations for the cost-aware script and 41 for blanket escalation, while the fixed workflow retains 41 supported cases. Browser error/warning logs were empty.
- [Benchmark documentation](benchmark.md) explains the fixture-normalized scope, author-known holdout limitation, API/CLI, orchestration boundaries and pending human-cost/model evaluation.

## Matched receipt-economy comparison — October 20, 2026

- **96 tests pass**, including eight new paired evidence tests. Exact orders, fees, shocks and keyed randomness match; worlds keep independent wallets and provider accounting. Full hold makes no source queries.
- Default result: **289 / 757 deliveries**, **$433.30 / $433.30 retained fees**, **$258.70 / $231.70 net contribution** for full hold / reviewed release. The **−$27** difference comes entirely from the assumed investigation cost; merchant-funded refund reductions are not counted as provider savings.
- Equal scripted-review control produces identical outcomes and exactly zero net difference. Zero review cost also produces zero direct provider benefit in the default hold-versus-review fixture. The initial-feed control uses the same reserve rule without source queries.
- Browser verification checked the complete three-shift replay and the displayed accounting against the deterministic result. Details and limitations are in [the comparison documentation](evidence-comparison.md).

## Receipt-linked evidence economy — October 20, 2026

- **88 tests pass:** the prior 78 plus ten evidence-economy checks. Three shifts complete at 12, 36 and 120 merchants with money and goods conserved. Investigators receive published source records; physical outcome counters do not alter their inputs.
- The main page reads the local saved receipt list only. It neither creates nor captures payments. The saved store still contains one native completed capture after the browser replay.
- Browser playtesting completed three shifts at 36 merchants, including automatic orders, restocking, vans, evidence generation, investigation and local reserve approval. Mara's first review recovered four extra proofs and showed **$96.30 held → $52 proposed hold**, with **$44.30** released. The adverse merchant's wrong-order proofs were rejected.
- After the authored $40 refund, Mara had $54.30 cash and $12 reserve. Complete matched scripted runs purchased **1 / 3 / 9 kits** next shift for full hold / initial feed / investigated evidence.
- Desktop at 1272 pixels and the narrow 572-pixel in-app preview were inspected. The playfield pans within its frame on narrow screens; the inspector stacks below it. Browser error/warning logs were empty after the full replay.

Model and limitations: [evidence economy](evidence-economy.md). Previews: [main review](screenshots/receipt-economy-review.png), [source evidence](screenshots/receipt-economy-evidence.png). These releases, holds and refunds are simulated; the native receipt proves only the original sandbox payment.

## Fixed versus agent paired replay — October 20, 2026

- **65 tests pass**, including 13 new paired/economic checks. Fixed-versus-fixed and coordinator-versus-coordinator controls produce exactly zero benefit with fees and churn enabled. The two worlds retain independent ledgers, identical potential demand and indexed random draws even after their active merchant populations differ.
- Fees reduce merchant available cash before procurement. Proportional fee-return handling is checked before refund coverage; processing costs are not charged to merchant cash twice. Churn follows settlement and prevents future captures. Paused requests, churn-lost volume and captured volume reconcile to the shared potential demand.
- The browser completed the three-shift default replay and matched the tested result: fixed net contribution **−$31,044.00**, agent contribution **−$26,834.75**, relative benefit **+$4,209.25**. Fees kept were $1,740 versus $1,608; remaining merchants were 21 versus 20. The UI explicitly states both policies remain loss-making.
- The full JSON export downloaded successfully and was parsed and checked against the exact benefit. A copy is retained as [the default paired trace](paired-default-trace.json), including all three input audits and both merchant ledgers.
- Changing assumed review expense to $50 per active merchant per shift reset both worlds, then produced **−$318.00** of agent benefit in the browser. The result correctly switched to the fixed reference being ahead. This tests the display of an adverse sensitivity, not a suggested model price.
- Shared pause/resume, automatic replay, merchant inspection and parameter reset were exercised. The initial matched capture showed $396 contribution on both sides while the headline correctly withheld a verdict until settlement.
- A 12-merchant, zero-fee, zero-processing-cost, zero-review-cost, zero-churn configuration was applied through the UI. One-shock stepping stopped after shift one, with $0 fees and all 12 merchants remaining on both sides. Defaults were then restored and the full paired replay completed again.
- Mobile at 390×844 stayed 390 pixels wide. Cards stack, and wide accounting tables scroll inside their own containers. Browser error/warning logs were empty during the default replay.

Previews: [default side-by-side result](screenshots/paired-comparison-default.png), [adverse review-cost sensitivity on mobile](screenshots/paired-mobile-high-review-cost.png). The normal viewport was restored after responsive checks.

Model definition and limits: [paired comparison](paired-comparison.md). The baseline, fee schedule, churn probabilities and expense assumptions are illustrative, not official PayPal policy or calibrated business measurements.

## Supply Yard / network economy — October 20, 2026

- **52 tests pass:** the original 42 checks remain, plus ten network checks. These cover 12-, 36- and 120-merchant runs across all three shocks; independent wallets; supplier inventory reconciliation; read-only counterfactuals; human approval; stale stock; repeated execution; persisted payment pauses; future reserve rates; pause/resume; and the distinction between expected and realized synthetic coverage.
- The default first-shift policies are computed from the same inputs. Commerce releases $940 across eight merchants; Coordinator releases $900 across 18, purchases the same 204 kits, and reduces merchants below half demand from ten to six. Both add $1,020 of all-fail exposure over Risk’s hold policy. This is an explicit remaining disagreement, not an asserted universal win.
- Browser playtesting verified the sequential debate, manual next-argument controls while paused, policy selection, comparison, reviewer execution and a fleet of consolidated delivery vans. The first selected branch delivered 178/396 kits with $7,780 of synthetic provider coverage, distinct from the $7,926 expectation.
- The six payment pauses persisted into shift two: 96 requested units were not charged, leaving 354 paid units. Commerce’s freight-shock proposal exceeded the configured failure-exposure limit and could not be applied; the revised policy executed. The third shift inherited three pauses and left 63 requested units uncharged.
- The full browser run finished all three shifts with 178/396, 106/354 and 141/531 kits delivered respectively. Browser error/warning logs were empty. At the 120-merchant size, the individual inspector exposed all 120 wallet options, including M120 / Pine Works 10. The viewport was restored and the preview reset to the default 36-merchant opening.
- Desktop at 1440×1000 and mobile at 390×844 were inspected. Mobile document width stayed 390 pixels; the 780-pixel playfield scrolls within its frame. The original single-merchant experience remains at `/case.html`.

Previews: [agent revision](screenshots/network-agent-debate.png), [policy review](screenshots/network-policy-review.png), [fleet](screenshots/network-fleet.png), [three-shift result](screenshots/network-three-shifts.png), [mobile](screenshots/network-mobile.png). All provider authority, coverage rules, probabilities, demand and operating costs remain explicit authored assumptions; no native PayPal or LLM calls are made.

## Supply Yard / visual supply flow — October 20, 2026

- **42 tests pass.** The request replay does not create new orders or charge buyers again. Replacement inventory is conserved across pickup, van cargo, packing and individual office receipts. Purchase does not mark orders delivered. Pause freezes the sequence, and each stop emits its receipt once.
- The browser flow was checked from office request slips to merchant restock failure, three scripted agent checks, reviewer approval, funded pickup, packing and delivery to both offices. The selected success branch ended with four kits delivered, $140 in reserve and $0 provider coverage. The expected-loss illustration stayed labeled while delivery was in progress.
- A self-approval attempt was blocked with the reserve still at $200. In the no-stock case, the release control was disabled; keeping the reserve dispatched no delivery. Refunds stayed pending with $0 refunded until reconciliation, then showed $1,000 refunded and $700 assumed PayPal coverage.
- Desktop 1280×900 and mobile 375×812 were inspected. The new five-step progress strip fits the phone width; document width remains 375 pixels while the playfield pans within its frame. No new dashboard was added.
- The canvas description exposes office receipts, unallocated stock, pickup stock, van cargo, packing stock and the reserve. Stage changes have a live announcement. All LLM and PayPal actions remain local simulations.
- Browser error and warning logs were empty during the playthrough.

Previews: [office requests](screenshots/supply-yard-requests.png), [agent recommendation](screenshots/supply-yard-flow-review.png), [completed delivery](screenshots/supply-yard-flow-delivery.png), [mobile flow](screenshots/supply-yard-flow-mobile.png).

## Supply Yard / initial visual version

- **40 checks pass**, including all existing reserve/payment safeguards and new office-stock conservation and replenishment checks.
- The active renderer uses new warehouse, packing, office, worker and van artwork. No Mint Town scenery or resident-sprite module is imported.
- Desktop at 1280×900 and mobile at 375×812 were checked. The mobile document stayed at 375 pixels wide; the footer stayed below the inspector. The normal viewport was restored afterward.
- Clicking an office opens its stock and paid-replenishment detail. The stock description is also exposed through the canvas's accessible label.
- Browser playthrough reached the reviewed release and successful replenishment: backup stock became zero, both offices received two kits, and the reserve became $140 with $0 provider coverage in the selected success branch.
- The pending-refund branch stayed unresolved until reconciliation, then showed $860 coverage under the authored failed-recovery assumption. Changing pause state preserved the user's selected payment branch.
- Browser error/warning logs were empty. No LLM or native PayPal calls were made.

Previews: [supply operation](screenshots/supply-yard.png), [reserve review](screenshots/supply-yard-review.png), [delivery](screenshots/supply-yard-delivery.png), [mobile](screenshots/supply-yard-mobile.png).

## Harbor Town / previous visual version

Verified October 19, 2026, with the Game Studio playtest workflow. This is a scripted local economy; no LLM or native PayPal calls were made.

- **38 tests pass:** 21 Harbor Town checks plus 17 checks for the preserved original lab. The new checks cover the captured-payment case, $700/$129 expected-loss comparison, $860 failure branch, separate future contribution, recommendation reversal, financial conservation, stock ownership, pause/reset, 400 street routes, pending refunds, scoped reviewer authority and stale approvals.
- Browser playthrough verified HOLD before investigation and RELEASE $60 after the three scripted evidence checks.
- Changing the success assumption to 10% changed the visible recommendation to KEEP and modeled net benefit to −$73. A separate test rejects release even when invented future contribution makes net benefit positive while expected refund loss worsens.
- The successful-delivery branch showed $160 supplier spend, $140 remaining reserve, $0 refunds and $0 provider coverage. The already-captured orders were not charged again.
- The failed-replacement branch showed $1,000 refunded and $860 of assumed PayPal coverage, with the extra downside clearly displayed.
- Agent self-approval was rejected. A stock reservation by Jun after approval caused execution to stop with $300 merchant funds still intact, including the $200 reserve. A second investigation correctly retained the reserve.
- The retained-reserve pending-refund path showed no completed payment until reconciliation, then $700 of assumed PayPal coverage.
- Clicking Jun's actual canvas sprite selected his inspector. Character buttons, pause/resume, restart, comparison dialogs and mobile character-centered panning worked.
- Desktop at 1280×900 and mobile at 375×812 were visually checked. Mobile page width remained 375 pixels while the larger town panned within its own frame. The mobile inspector/footer overlap found during review was fixed.
- Browser error/warning logs were empty after the successful playthrough. All local scripts, fonts, stylesheet and the preserved `/lab.html` returned HTTP 200.

Artifacts: [town](screenshots/harbor-town.png), [PayPal comparison](screenshots/paypal-comparison.png), [successful delivery](screenshots/delivery-success.png), [mobile layout](screenshots/harbor-mobile.png), [six case calculations](harbor-case-results.json).

These are deterministic and visual checks, not calibrated economic validation, production security testing or evidence of an LLM advantage.

## Original decision lab / earlier version

Verified October 19, 2026. Scope: deterministic local demo and its browser presentation. No model, Sandbox, production, economic-performance, or security certification is implied.

- `npm test`: **17 passed, 0 failed**. Coverage includes all seven cases, money conservation, insufficient evidence, reviewer authority, stale approval, stock ownership, pending payment reconciliation, duplicate request identity, and refund versus void eligibility.
- `node --check demo/app.mjs` and `node --check scripts/serve.mjs`: passed.
- Local server returned HTTP 200 for the page, scripts, stylesheet and all four architecture SVGs. It returned 404 for a research-vault path and 403 for a tested encoded parent-directory path.
- Browser walkthrough: base case completed through reviewer approval, pending capture, and reconciliation. The pending capture initially left completed gross captures at $240; reconciliation brought that amount to $320, with available cash still $0.
- Browser boundary check: agent self-approval was rejected and logged.
- Browser abstention check: missing prior-sale obligations produced “Request more evidence” with release disabled.
- Browser race check: a new Merchant B reservation invalidated the approved dossier before funds moved. The displayed available cash remained $100 and reserve $200; reinvestigation recommended keeping the reserve.
- All four SVGs loaded in the Architecture view. SVG-derived PDF/PNG exports were visually inspected for labels, bounds, and legibility.
- A narrow in-app viewport also displayed the responsive stacked layout; a complete mobile-device accessibility pass was not performed.

The [saved preview](figures/demo-preview.png) shows the comparison stage. [Local case results](local-check-results.json) record reproducible mechanics for all seven cases. Those outputs are not agent benchmarks or measurements of provider benefit.
