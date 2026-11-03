# Focused recovery: better than broad outreach, still not profitable

The confirmed improvement is **smaller losses**, not durable positive PayPal profit. The app therefore blocks scale-up.

| Mean result per100 simulated shoppers | Broad recovery | Exposure + lapse targeting |
|---|---:|---:|
| Extra retained fee margin after returns/processing | $4.31 | $0.41 |
| Outreach cost | $9.09 | $1.58 |
| Prospective model allowance | $0 | $0.10 |
| Net platform difference vs no campaign | **−$4.78** | **−$1.27** |
| Merchant contribution difference vs no campaign | +$36.65 | −$2.27 |

The paired improvement over broad outreach is **+$3.5063**, with a95% seed-cluster interval of **[+$2.1380,+$4.8405]**. This is a73.4% reduction in average loss. Against no campaign, the targeted policy's95% interval is **[−$1.9721,−$0.5155]**. Merchant contribution has an interval spanning zero. It fails the release gate.

## What changed

The former recovery program contacted everyone when a merchant's mature return rate became elevated. The new candidate requires the customer's **last observed purchase to be from that merchant** and **at least seven days since their last purchase**. Recommendations go to safer merchants. This avoids contacting unaffected shoppers. It uses observed partner data and cached Channel3 product prices, with no hidden customer traits or future refunds.

The policy context adapter adds this audience condition without changing the original choice, price, income, fee, processing, return, inventory or fatigue equations. Row-for-row parity against the original engine is tested, including an active recommendation policy. Each policy has the same$50 virtual budget and campaign authority on zero-based days30–199. Shopping continues through day399, followed by14 days for refunds. The campaign window is longer than earlier70-day studies; those historical results are not substituted into this comparison.

## Selection and confirmation

Fifteen development markets used three seeds and five scenarios. No candidate passed the original development confidence gate, so its rollout selection remained organic. The chat assistant then predeclared a separate, bounded **exploratory confirmation** of the best mean candidate with nonnegative mean merchant contribution. It did not relax the deployment gate.

The candidate and code were fixed in `candidate-validation-protocol.json` before evaluating60 fresh markets:12 previously unused seeds × five scenarios. Every policy sees the same seed, exogenous shocks and catalog; each observes its own resulting history. No tuning followed the confirmation results. Scenarios: steady demand, a rival sale, household budget pressure, stock disruption and elevated returns. Refund outcomes are fully mature. There are no accounting, eligibility, inventory, budget or maturity violations.

The estimate averages scenarios within a seed, then averages seed clusters; intervals bootstrap the12 clusters. Shopper rows are not treated as independent experiments. No-campaign is the primary economic reference; beating broad outreach alone does not establish profitability.

## Agents, cost and integration

This candidate was proposed in chat and executed deterministically. **There were no fresh Gemini calls for these60 markets.** The$0.10 per-market inference allowance is conservative prospective accounting, not actual spending. The earlier recurring/recovery approvals in this iteration cost$0.193992; the recorded project ledger totals$2.705993. No native PayPal payment or APAC operation was performed.

`durableReleaseGate` now requires exact policy identity, independent selection-before-test evidence, at least eight seed clusters/three scenarios, at least100 days of post-campaign shopping, mature valid accounting, a positive platform lower bound after costs, and a nonnegative merchant lower bound. The live mesh supplies this limitation to the closing reviewer and rejects unsupported rollout retention even if one short market has higher fees. Bounded pilots remain possible; this is not a production payments gate.

Channel3 supplies real cached listings. All shopper behavior, transactions, costs and merchant outcomes here are simulated. Prior Sandbox receipts remain separate integration references. No real PayPal financial benefit is established.

## Reproduce and inspect

```sh
node --test tests/open-market.test.mjs tests/focused-recovery.test.mjs tests/agent-mesh-harness.test.mjs tests/agent-mesh.test.mjs
node scripts/focused-recovery/benchmark.mjs
node scripts/focused-recovery/validate-candidate.mjs
node scripts/focused-recovery/report.mjs
.local/research-venv/bin/python scripts/plot-focused-recovery.py
```

These commands use local CPU and cached catalog data; none makes an LLM or payment call. Existing cases are reused only when their protocol hashes match. Open `/campaign-improvements.html` for the interactive explanation and research figure. Raw results and all losses are downloadable there.

The research basis remains the completed solo report at `research/notes/final_report_market-agent-generalization-63c7b1.md`: separate development/confirmation, mature causal outcomes, strong controls, and code-owned execution boundaries. The separate open-market hypothesis failed development and was not used to generate this result.
