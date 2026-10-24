# Market Metro judge demo

The main city UI stays in place. **Run demo** opens a separate modal with the market on the left and the campaign office on the right, synchronized to one workflow's saved evidence.

## Presenting a campaign

1. Select **Replay current campaign · free** to present recorded decisions without inference or payment calls. A `judgeDemo=WF-...` deep link also opens read-only playback.
2. **Guided story** shows two opening shopping days, explicitly skips days 3–27, then shows day 28 and the team analysis. The full 28-day history still trained the model. Select **Every day** to watch all recorded days; the day slider can also open a skipped day.
3. **Pause at decisions** is on by default. Read **What it knew → Gemini chose → What happened**, then press **Continue story**. The team work log shows dated decisions and lets you revisit them. The same plain-language account appears in the full workflow; **Original decision and saved evidence** retains the original rationale and technical record. Continuous playback is available by unchecking the pause option.
4. Gold money sprites correspond to simulated purchase rows. Tickets correspond to issued coupons; an unseen coupon is explicitly labeled. Individual shoppers may buy without an offer, redeem one, or ignore it.
5. At the payment checkpoint, a verified same-run sandbox receipt shows the capture ID, amount, fee and net. **See the warehouse link** opens `v_paypal_order_lineage`. **Full trace** opens the existing campaign room.

**New live run** opens the setup screen. **Run one seed · max $0.25** starts one seed-314, 300-shopper campaign with a $300 virtual coupon budget, a rival-sale shock and at most one native sandbox sample. Closing or pausing a live campaign pauses the planner after any in-flight action. Its checkpoints can resume; a saved request ID prevents a lost response from duplicating the launch.

## What actually runs

| Surface | Implementation and boundary |
| --- | --- |
| Coordinator | Gemini 3.1 Flash-Lite selects the next tool and its arguments from observed evidence. The decision is saved before execution. |
| Insights / data exchange | Local analysis, warehouse queries and seeded environment generation, invoked by the planner. |
| Model lab | Real local model training, temporal validation and deterministic promotion gates. |
| Campaign studio | Planner-selected campaign parameters; local offer scoring plus stock, margin, budget, consent and contact guards. |
| Measurement | Local experiment and economics calculations. A simulated result is not evidence of production ROI. |
| Channel3 | Cached API product IDs, titles, prices and images. It supplies neither customer behavior nor inventory, model scores or coupon eligibility. |
| PayPal | One saved test buyer and test store. Selected emulator orders produce native Sandbox captures with fictitious funds; other orders remain simulated. |

Office roles are local responsibilities coordinated by **one LLM**, not six independently reasoning agents. Animation is a presentation of durable records, not a second simulation. Daily totals include all recorded shoppers; the scene shows representative shoppers and sampled events. Playback reveals a receipt only after its payment checkpoint and never attaches another run's receipt.

**Store names** is a shared preference in the main market and demo. Names are hidden by default; hovering a building shows its name, stock and sales. Turning the option on restores the persistent name labels. The PayPal landmark remains labeled.

Read stops pause the presentation, allowing a live planner to continue in the background. The explicit Pause/Close controls retain their existing behavior of pausing a live planner. Presentation explanations are deterministic summaries of saved inputs and results, not fresh Gemini output. Trend and coupon-opportunity descriptions remain observational; later checkpoint results cannot leak into an earlier decision's explanation.

## Verification

The targeted suite covers planner guards and budget/restart accounting, checkpoint retries, receipt joins, read-only replay, as-of daily data, city geometry and shopper movement:

```sh
node --test tests/judge-demo.test.mjs tests/autonomous-planner.test.mjs tests/campaign-workflow.test.mjs tests/city-art.test.mjs tests/tycoon-motion.test.mjs
```

The initial 19 tests passed. After adding conservative timeout review, all 16 workflow/planner/replay tests and all 21 planner/Vertex checks passed; these sets overlap. Test providers use local fakes. The frontend was also exercised in the in-app browser at desktop and narrow widths. Replaying the previous saved campaign left the shared model ledger unchanged.

## Authorized live run: 23 October 2026

Workflow **WF-5cf8d8113a1fa883** completed on day 44. Open `/?run=GARDEN-WF-5cf8d8113a1fa883&judgeDemo=WF-5cf8d8113a1fa883` for its free replay. [Machine-readable results](judge-demo-result.json) preserve decisions, model summaries, costs and receipt lineage.

Gemini selected logistic and tree candidates trained on 28 observed days, then used the promoted logistic model. It chose six merchants, 5%/10% offers and a $5 expected-contribution floor. At the rival-sale shock it requested a fresh analysis, then kept the existing model and coupon plan. **It did not retrain after the shock.** Its claim that the existing model might "adapt" should be read critically: only its input features and scores can change without another training job.

The 14 campaign days produced **216 simulated purchases**, **20 issued coupons**, **5 redemptions**, $55.30 in virtual outreach/discount costs and $6,881.69 in modeled merchant contribution. These are descriptive results. The repeat-purchase difference was +12.8 percentage points, with an interval from −3.48 to +29.08 points; retention benefit is not established.

One selected coupon purchase was captured with fictitious PayPal funds:

| Link | Recorded value |
| --- | --- |
| Product | Logitech Casa Pop-Up Desk Wireless Keyboard and Stand Kit |
| Channel3 ID | `P1Bum1N` |
| Fictional merchant | Oak & Ink / `M002` |
| Simulated customer | `U0168` |
| Coupon / order | `CP41483` / `O41490` within this run |
| Discount | 10% |
| PayPal order | `487813296V133983N` |
| PayPal capture | `8LM78843GX845714T` |
| Captured / provider fee / net | $170.09 / $6.08 / $164.01 |

The warehouse retains separate simulation and provider dates and modeled versus actual sandbox fees. The saved buyer completed this capture without another checkout login.

**Costs and failures:** 17 provider attempts, $0.023960 in metered-token cost estimates, plus a $0.030000 full reservation for one timed-out inference whose usage is unknown. Conservative accounted spend is **$0.053960**, below $0.25; this is not a billing invoice. The timeout required operator review before continuing the same checkpoint. `review-planner-timeout.mjs` verifies that no action, request or checkpoint escaped the failed call, backs up the original ledger, and counts the entire reservation against the unchanged caps. It never clears costs or treats unknown usage as free.

A separate request to capture too many orders was rejected before PayPal execution. Gemini corrected it to the delegated one order. Both failures remain in the audit. This demonstrates recovery and enforced action limits, not a flawless unattended run or proven agent superiority.
