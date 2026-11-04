# Market Metro: submission candidate, 4 November 2026

**Purpose:** help a commerce operator turn observed shopping demand into a tested campaign, fulfilled orders and reconciled payments. The AI team proposes; trusted code validates, measures and executes.

## The demo

1. Start with 12 merchants and 600 simulated shoppers. Show organic shopping, stock, payment events and the warehouse before any campaign.
2. At the first review, the analyst chooses what to investigate. Show its question and the actual query results.
3. The scientist chooses feature recipes and two local model experiments. Show held-out model metrics and the selected artifact.
4. The commerce manager proposes a specific audience/action, contact budget and supply configuration. It sees a separate development trial and can revise its proposal.
5. The deterministic publisher rejects malformed or unprofitable proposals, and selects the best eligible tested candidate. Show a rejection or revision as well as a publication; never imply every proposal succeeds.
6. Resume the market. Follow one shopper from recommendation to funded request, delivery and retained purchase. Compare all registered seeds, including losses, against fixed rules and one planner.
7. Open an existing native PayPal Sandbox receipt linked to its warehouse order. This verifies the payment integration; it is not additional simulator revenue or proof of real-world profit.

## Why PayPal matters

The team's objective is retained, fulfillable commerce, not clicks. Payment authorizations, fees, settlement timing, refunds and outstanding obligations affect which campaigns can produce useful orders. PayPal is the native sandbox payment adapter for selected orders and the modeled payment layer in the experimental economy. The sandbox does not expose PayPal's internal customer data or validate our economic assumptions.

The current local database contains completed sandbox purchases, saved-wallet verification, a completed partial refund and shipment-tracking verification. An invoice is unpaid and a subscription awaits consent. Payouts failed and reporting is blocked. These states must remain distinct; we do not claim every integration completed.

## What counts as a result

- **Modeled PayPal net after AI:** settled platform contribution less metered model usage. This includes payment costs and outreach; it is not payment volume or gross fees.
- **Merchant contribution:** change in merchant equity, including inventory and obligations. Show realized cash and inventory separately when discussing liquidity.
- **Commerce:** retained purchases, retained payment volume, recommendation-attributed purchases and fulfillment.
- **Agent evidence:** validated decisions, actual local fits, tested revisions, publications/rejections, call cost and traceable artifacts.
- **Generalization:** paired comparisons on registered fresh seeds. Model AUC and profitable development trials do not substitute for these outcomes.

The V2 study produced no financial lift. V2.1 adds strict contracts, matched-size development trials and deterministic selection across tested proposals.

### First fresh market — the recorded demonstration

Seed 41873101, discovery scenario, identical starting state, needs, consent and income:

| Outcome | Fixed | One planner | Three-role team |
|---|---:|---:|---:|
| Modeled PayPal net after AI | $4,178.98 | $4,178.95 | $4,267.03 |
| Merchant contribution | $48,753.01 | $48,753.01 | $49,840.30 |
| Retained purchases | 791 | 791 | 805 |

The team used intent-context features, selected a locally trained forest and tested an intent-assistance campaign. Its revision raised the contact ceiling from 36 to 60 shoppers/day. The trusted publisher admitted the better measured revision; the later review retained it. The single planner's proposals failed the development gate.

The **$88.05 net gain** reconciles to +$89.38 retail fees, +$49.26 supplier fees, −$47.95 processing, +$3.60 outreach savings, −$6.21 fee refunds and −$0.025926 AI cost. It is not merely outreach savings. Merchant contribution rose **$1,087.29**, with **14 more retained purchases**.

One illustrative shopper, BUYER-0525, received a model-ranked recommendation on displayed day 33, funded a $174 basket and received on-time delivery on day 35. That request was not captured by fixed rules. This is a post-hoc simulated example; all market-level outcomes still include displaced sales and losses. [Accounting and customer trace](commerce-expanded/harness-v2/v21-20261104-transport/first-market-proof.json).

[Open the recorded market](http://127.0.0.1:4173/studio.html?session=AUTONOMY-6e0392af093abb38). Press Replay and inspect the agent team at days 31 and 61. All 126 day frames and warehouse records were rebuilt with zero new model calls; financial metrics reproduce the recorded run exactly. [Replay verification](commerce-expanded/harness-v2/v21-20261104-transport/replay.json).

The shopper's **$34 merchant leg** was subsequently captured through the saved PayPal Sandbox wallet: capture `0JD4043540258600T`, fee **$1.46**, merchant proceeds **$32.54**, using fictitious funds. The **PayPal sandbox** view and `paypal_receipts` table link it to the simulated order. This sample does not add another sale to benchmark totals, and playback never repeats the payment. [Native receipt](commerce-expanded/harness-v2/v21-20261104-transport/native-receipt.json).

The [completed four-market pilot](commerce-expanded/harness-v2/v21-20261104-transport/README.md) averaged **+$26.22 PayPal net, +$218.73 merchant contribution and +3.5 retained purchases** versus fixed rules. Four of eight AI workflows fell back after errors, and the zero-response market harmed merchants. The recorded discovery example supplies all additional purchases; it does not establish repeatability or prove that multiple roles are necessary. Model usage for the full comparison was $0.128868, calculated from provider tokens rather than a cloud billing invoice. The improvement goal remains active.

## Submission boundary

The catalog and customer behavior are authored; the current demo uses AG Studio and makes no Channel3 calls. The UI is a local demo with saved checkpoints, not a deployed production commerce system. Keep the GitHub repository private until the user authorizes publication. A public submission, video upload and competition eligibility check are separate release steps.
