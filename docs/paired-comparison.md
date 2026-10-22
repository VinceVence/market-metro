# Fixed policy versus the scripted agent team

The side-by-side replay is available at `/comparison.html`, linked from Supply Yard’s main navigation. It runs the existing economy engine in two independent worlds with matched starting merchants, cash, reserves, potential demand, supplier capacity, prices, delivery assumptions and keyed outcome draws. The original single-world walkthrough retains its zero-fee, no-churn fixture for continuity.

## The precommitted policies

The fixed reference keeps a 20% reserve, makes no discretionary reserve releases, and accepts future payments from merchants who remain. It is an illustrative benchmark, not PayPal’s documented production policy. It does not use the old Risk proposal, which also changed reserve rates and paused payment channels.

The agent side applies the existing scripted coordinator after every shock. It can release reserves, change future reserve rates and pause or reopen payments, subject to the same existing downside gate. The coordinator heuristic has not been retuned against the reported net-benefit result. A comparison start preauthorizes these two local policies; there are no model or native PayPal calls.

## Matched inputs and independent state

Both sides use the same three-shift shock schedule, copied stock pools, fixed FIFO merchant order queue, merchant expenses and potential unit demand. Delivery and departure draws are pure functions of scenario seed, merchant ID, shift and event channel. Neither skipped captures nor earlier departures change the other side’s random sequence. Different delivery probabilities under different supplier allocations can produce different outcomes from the same latent draw.

Fee, processing, churn and agent-cost assumptions are shared. Incremental agent review cost applies only when the agent policy executes. Changing assumptions requires resetting both worlds; current outcomes cannot be relabeled with new settings. The export records the settings, policies, shared shock audit, both full ledgers, merchant departure assessments, round results and the exact net-benefit decomposition.

Two identical-policy controls are tested: fixed versus fixed and coordinator versus coordinator. Both yield exactly zero paired benefit, including fees, costs and churn. This checks implementation parity, not validity of the economic assumptions.

## Fee accounting

The default illustrative fee is 3% of captured gross payments. Fees are deducted from merchant available cash before procurement, so they can change fulfillment; they are not just added to an end-of-run score. Reserve percentages are applied to gross payments. Processing cost is a separate assumed provider expense of 1% of captured volume, retained after refunds.

By default, original payment fees are retained when customers are refunded. The optional fee-return setting credits the proportional fee to the merchant before calculating the uncovered refund. Credits are applied once and reduce fee revenue. There is no fixed per-transaction fee because this simulator aggregates office payments into merchant batches.

The default assumed agent-review expense is $0.25 per active merchant per shift, including paused merchants who are reviewed. It is a hypothetical cost input, not an incurred API bill. It is zero for the fixed rule.

The global merchant-money identity is:

`cash + reserves + operating spend + supplier spend + customer refunds + collected fees − returned fees + merchant withdrawals = captured payments + provider refund coverage`.

Processing and review expenses belong to the provider’s contribution calculation and are not deducted from merchant cash a second time. Reserve releases are transfers of merchant-owned funds, not provider costs. Total customer refunds are not subtracted again from PayPal contribution: only the portion funded by the provider is its expense.

## Churn and the observation horizon

At default 1× sensitivity, a merchant’s departure chance after settlement is:

`2% + 20% × unfulfilled paid share + 15% if payments were paused this shift or are announced paused next shift + 10% × reserve pressure`.

Reserve pressure is zero at 20% held and reaches one at 40%, clamped to that range. Multiply by the selected sensitivity and cap the probability at 100%. A merchant with no captured orders has no service-failure component. These are authored stress-test probabilities, not calibrated churn rates.

A departure occurs only after that merchant’s current deliveries and refunds settle. Remaining merchant-owned balances are withdrawn, and the merchant generates no further captures, fee revenue or review cost during this replay. Potential demand remains matched and is recorded as lost-to-churn volume. That is separate from requests declined while an active merchant’s payment channel is paused.

Churn’s within-horizon financial effect is already reflected in later volume, fees, costs and refunds. No lifetime-value penalty or terminal bonus is added. Departures after shift three change the retention count; their financial effects beyond the three-shift horizon are excluded.

## Default result

Seed 773; 36 merchants per world; 3% fee; 1% processing cost; retained original fees; $0.25 assumed review expense; 1× authored churn.

| Metric | Fixed reference | Agent team |
|---|---:|---:|
| Captured volume | $58,000.00 | $53,600.00 |
| Fees kept | $1,740.00 | $1,608.00 |
| Processing cost | $580.00 | $536.00 |
| Provider refund coverage | $32,204.00 | $27,884.00 |
| Agent review expense | $0.00 | $22.75 |
| Net contribution | −$31,044.00 | −$26,834.75 |
| Merchants remaining | 21 | 20 |
| Kits delivered | 270 | 317 |

Agent net benefit is **$4,209.25**, composed of **$4,320.00 less coverage + $44.00 less processing − $132.00 fewer fees − $22.75 review cost**. Both worlds remain loss-making, and the agent side ends with one fewer merchant. These facts are displayed together.

Raising the assumed agent expense to $50 per active merchant per shift reverses this particular result to **−$318.00** of agent benefit, without changing deliveries or departures. This is a sensitivity illustration, not a suggested model price.

## UI and verification

Both economies run in lockstep under shared play, pause, speed and step controls. The net-benefit verdict is withheld until both worlds settle the same shock. Each merchant has an accessible sprite, with open, paused and departed states; selecting one shows both versions of that merchant. Side-by-side contribution statements, a signed difference table, cumulative per-shock results and a JSON export expose the full accounting.

The test suite covers identical-policy controls, fee deductions and returns, churn after settlement, lost future captures, paired draw parity after population divergence, locked assumptions, duplicate starts, pause, an adverse cost sensitivity, zero churn and a 120-merchant replay. No claim of production ROI, calibrated forecasting, or an LLM advantage follows from these tests.
