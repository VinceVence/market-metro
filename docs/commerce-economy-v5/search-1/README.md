# Current progress toward2× modeled net

**Goal active; target not reached.** This follow-up preserves the v4 engine and approved UI, and evaluates a separately versioned business-action economy.

The frozen v5.2 environment includes merchant pricing, cash-constrained procurement, explicit replenishment consent and two distinct supplier-payment stages. No native PayPal operations were performed in these experiments.

## Latest comparison

All arms received the same64 local candidate budget, twelve previously opened training markets, and six new validation markets. The LLM arms each used three fresh Gemini3.1 Pro calls before the search. The team and single-agent output are research-time proposals; the subsequent optimizer executes locally.

| Approach | Mean modeled platform net | Ratio to fixed | Aggregate partner contribution | Purchases of exact recommendation |
|---|---:|---:|---:|---:|
| Fixed rules | $723.82 |1.000× | $15887.95 | 4.17 |
| Numerical search | $758.51 | 1.048× | $15979.49 | 1.83 |
| Single-agent-seeded search | $723.75 | 1.000× | $15887.95 | 4.17 |
| Team-seeded search | $935.02 | 1.292× | $16196.95 | 4.17 |

Total new model cost: **$0.140734 across6 calls**. Recorded lifetime cost: **$3.362341**. Local search made no further paid calls. Costs are metered-token list-price estimates, not a billing invoice.

## What the team contributed

The Demand Scientist proposed inventory/fit alternatives. The Merchant Economist proposed asymmetric prices and supplier-payment choices. The Lifecycle/Treasury Strategist proposed new campaigns and subscription offers. Numerical validation rejected every fully changed three-component plan. A component audit found that retaining the earlier campaign was better than the new lifecycle proposals. The revised harness therefore preserves incumbent components and searches from the proposed alternatives.

The selected team-seeded controller uses prices [0,-10,10]%, auto merchant payment routing and paypal supplier payment routing. It retains the weekly-featured campaign and uses observed-cadence replenishment.
It increases modeled platform net by $211.20, aggregate partner contribution by $309.00, and terminal partner cash by $297.50 per validation market. Recommendation purchases remain unchanged; the gain comes from the combined commercial policy, not a demonstrated improvement in recommendation conversion.

## What this does not prove

- One construction sample per LLM condition.
- Search perturbation streams were keyed by arm; a repeat with common streams is needed before attributing differences solely to agent specialization.
- Validation was used to select among four candidates; this is not a final test.
- All economic and behavioral parameters are authored simulation assumptions.
- Recommendation-attributed purchases did not increase in the selected team plan.
- Aggregate partner contribution improved; this does not imply every counterparty individually gained.

No new final held-out markets were opened because the registered2× advancement gate was not met. Do not present this result as2×, production PayPal profit, or proof that every specialist is necessary.

## Preserved failures

- v4 private-information and observed-only probes did not approach2×. The private greedy probe was a diagnostic, not an upper bound or valid agent.
- The early v5 pricing trial was invalidated when outside-retailer prices were found to share a merchant price reference. That bug was corrected and its results were retained with an invalidation label.
- Forced fast supplier payments raised fees but lowered partner contribution. Neither the100-day nor365-day development probe passed the goal.
- Smaller replenishment assortments reduced purchases and contribution.
- The first six fresh v5 model calls produced no fully composed plan that passed every financial guard.

The predeclared validation incumbent fallback is now included for every arm. Raw results.json remains unchanged. This only changes the single-agent selection back to the incumbent.

## Next experiment

Keep the economic simulator frozen. Improve the policy/harness using the strongest feasible incumbent and measured failure attribution. Use common search perturbation streams and additional independent construction repetitions for an architecture claim. A richer observed-state policy or exposure-aware recommendation model is permissible; changing customer demand, fees or financial guards to manufacture2× is not.

![Measured progress](progress.png)
