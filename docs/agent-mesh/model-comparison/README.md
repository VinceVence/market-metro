# Fresh campaign decisions: Flash-Lite versus Pro

[Open the comparison](http://127.0.0.1:4173/model-comparison.html) · [Compact results](summary.json) · [Verification](verification.json) · [Full final record](final-result.json)

**Pro improved loss control, but did not create a profitable campaign.** This is one known development seed104001 with the rival-sale scenario. The analyst handoff and warehouse evidence were fixed at days30,55,80. Both campaign scientists received byte-identical system/packet/tool inputs, verified by hashes. Both reviewers received the same underlying observations, their own team's proposal and its local model results. All treatment policies used the same seven-day/$5 joint-promotion harness and a controlled one-day publication delay. The simulator and accounting hashes are unchanged.

Both models used MEDIUM reasoning. Flash-Lite had its existing2048-output-token limit; Pro had4096. Six fresh model outputs were generated per arm. Local fits used only the shared mature source rows, following each agent's requested training window. Final100-day outcomes plus14-day returns were evaluated after decisions had been recorded. This is controlled replay on fixed observations, not a new live closed-loop market or an independent multi-seed result.

| Policy | Modeled platform change vs no campaign, after new inference | Merchant change | Purchases | Coupons / redeemed |
| --- | ---: | ---: | ---: | ---: |
| Flash-Lite | −$6.338210 | −$6.82 | 1193 | 7 / 3 |
| Pro strategist + reviewer | **−$0.218386** | +$9.34 | 1194 | 14 / 1 |
| Rules + same harness | −$2.11 | +$15.41 | 1193 | 0 / 0 |
| Fixed full-price recommendations, all | −$8.60 | −$30.31 | 1189 | 0 / 0 |
| Fixed full-price recommendations, lapsed | −$2.11 | +$15.41 | 1193 | 0 / 0 |
| No campaign | $0.00 | $0.00 | 1193 | 0 / 0 |

Pro preserved **$6.119824** more modeled platform contribution than Flash-Lite and **$1.891614** more than the matched rules. It rejected the early campaign, observed at day55, then retrained and deployed a Willow Goods coupon at day80. The campaign added one purchase and$9.34 modeled merchant contribution, but platform contribution remained$0.09 below no campaign before inference. The historical shared investigator cost$0.003519; it was not called again. Allocating that sunk cost to both model teams reduces each displayed platform result equally. Local CPU time is unpriced. None of these values is actual PayPal profit.

## What actually changed

- Day30: both scientists proposed5% coupons for Willow Goods and Corner Supply. Flash-Lite approved its pilot. Pro's reviewer rejected its pilot because the fitted model had prediction MSE0.3625 versus0.3418 for a constant predictor.
- Day55: Flash-Lite chose full-price recommendations. Pro chose observation and its reviewer agreed, citing weak model evidence and the competing merchant's sale.
- Day80: both scientists proposed a Willow Goods coupon. Pro retrained its model and its reviewer approved deployment. The final saved review was completed separately after a conservative reservation guard blocked admission; its prompt and inputs were unchanged.

These are recorded model decisions, not scripted substitutions. The initial replay dropped the day80 fitted artifact during budget-resume handling and wrongly simulated no outreach. The corrected replay restores the exact model from saved mature rows, matches every metric the reviewer saw, and retains the superseded record. A new invariant prevents active campaigns without a model. However, a simple MSE threshold can plausibly reproduce the Pro reviewer's main objection. This experiment **does not establish unique multi-agent value**, positive campaign lift, or repeatable superiority. The scientific task remains: demonstrate a useful intervention with evidence that supports it, not merely reward more elaborate explanations.

## Cost and provider recovery

Actual metered-token estimate for new generation: **$0.136596** ($0.008210 Lite +$0.128386 Pro),12 generated decisions. Not a billing invoice. Lifetime recorded estimate after this trial:$2.189635. No pending reservation or open circuit remained.

Standard `gemini-3.1-pro-preview` returned two definitive, uncharged HTTP429 responses. The official `gemini-3.1-pro-preview-customtools` endpoint succeeded. Google documents this alternative and states the same Pro pricing; its task behavior may differ from the standard endpoint. Actual endpoint/model versions are retained in every provider receipt. [Google model documentation](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-1-pro), [Google pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing).

The total trial cap remained$0.50. After Pro had spent$0.110102, the fixed$0.15 pre-call reservation blocked its final review under the initial$0.25 per-arm admission envelope. Unused Lite allowance was reallocated to a$0.30 Pro admission envelope for exactly that saved review. Actual Pro cost still finished below$0.25. App campaign defaults remain$0.25; no cloud budget was increased. All original failed attempts, budget admission and recovery artifacts remain separate.

The UI exposes an explicit Pro planner/reviewer option while preserving the cheap default. It shows the provider model version in checkpoints. No new payment was issued, no APAC resource was touched, and no subagents were used. Channel3 supplied the cached products; PayPal transaction accounting remains simulated in this comparison, with prior sandbox receipts available separately in the main demo.
