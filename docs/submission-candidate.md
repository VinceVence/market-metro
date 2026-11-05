# Market Metro: submission candidate, 4 November 2026

**Purpose:** turn observed shopper demand into a tested campaign, fulfilled orders and reconciled payments. The AI team proposes investigations and experiments; trusted code validates, measures and executes.

**V2.3 is complete and replayable.** Across four registered unseen markets, the team added **$152.37 modeled PayPal net after AI, $1,669.35 merchant contribution and 17 retained purchases** versus fixed rules. All eight AI workflows completed. One planner performed better overall; the study supports the workflow, not multi-agent financial superiority. [Full comparison](commerce-expanded/harness-v2/v23-20261104/README.md) · [Implementation](commerce-expanded/harness-v2/typed-execution.md).

## What each role actually does

For the reactivation claim, lead with the fresh comparison. A single planner using the same verifier added $809.18 in modeled PayPal net, $8,341.39 in merchant contribution and 135 retained purchases over fixed rules. It improved all three on each of six seeds. The three-role team beat fixed on all three in five markets. Its verifier added three purchases in total over its own original choices. [Fresh reactivation scorecard](http://127.0.0.1:4173/studio.html?view=performance&evaluation=reactivation-fresh)

[Compare the agent's two ranking models](http://127.0.0.1:4173/studio.html?view=performance&evaluation=model-check). Select **Reactivation** to see the campaign proposal, what the verifier measured and what a different ranking earned on fresh shoppers. The model comparison uses saved agent decisions. To show the payment integration, open [the recorded $64 PayPal Sandbox capture](http://127.0.0.1:4173/studio.html?session=AUTONOMY-85115305aa04828f&view=payments) from the earlier end-to-end campaign.

[System architecture by plane](figures/planner-v23/README.md) shows the actual recorded environment beside the agent workflow, with editable SVG, PNG preview and a single-page PDF.

| Role | Observed input | Decision | Executed by trusted code |
|---|---|---|---|
| Market analyst | Prior shopping, product interest, inventory and payment funnel | Which bottleneck to investigate; feature recipe and history window | Read-only demand analysis and a bounded dataset |
| ML scientist | Analysis and completed historical outcomes | Two model experiments and which trained artifact to propose | Local fitting, whole-market validation, model hashes |
| Commerce manager | Model reports, merchant/payment economics and previous trials | Campaign type, audience, contact allowance, supply settings; one revision or stop | Frozen development trials and measured component comparisons |
| Publisher | Exact contracts and validated trial receipts | Deterministic publish or retain | Select the best eligible tested proposal; enforce consent, spending and fulfillment constraints |

The first three roles make fresh Gemini tool calls. The publisher is software, not a fourth LLM. A single-planner comparator receives the same tools, evidence, model schedule and decision budget. A team win must be measured; the role labels alone do not establish one.

SKU recommendations use the scientist's fitted classifier. General needs inquiries use their own response/value model: prior replies adjust response estimates, while settled outcomes update expected payment and merchant value. The inquiry head is common to both AI approaches. Its contribution must not be credited to multi-agent prompting alone.

## Three-minute demonstration

1. **0:00–0:25 — Market.** Start at day 1 with 12 merchants and 600 simulated shoppers. Show organic purchases and the warehouse before campaigns.
2. **0:25–0:55 — Review.** Jump to displayed day 31. The economic date pauses. Show the analyst's question, actual observations and scientist's two model reports.
3. **0:55–1:30 — Experiment.** Show the manager's campaign and its trial. Compare the supply-preserved alternative. The controller publishes only an exact tested contract that passes the checks; a rationale alone cannot approve anything.
4. **1:30–2:00 — Commerce.** Resume days. Follow a shopper from outreach to a funded request, delivery and retained purchase. Show the second review at day 61 retaining or revising the campaign.
5. **2:00–2:30 — PayPal.** Open a native Sandbox receipt linked to its warehouse order. Distinguish the provider's receipt and fee from simulated accounting.
6. **2:30–2:55 — Evidence.** Show every registered market, fixed rules, one planner and the team, including losses and model cost. End with what improved and what remains unproven.

### Recorded submission walkthrough

[Open the V2.3 recorded market](http://127.0.0.1:4173/studio.html?session=AUTONOMY-85115305aa04828f). Playback re-executes saved choices through all 126 day frames with **zero new model calls or payments**. A clean clone can build it with `node scripts/commerce-expanded/harness-v2/replay.mjs`; the script prints the local session URL.

At displayed day 32, shopper **BUYER-0507** received an office-bundle recommendation, funded a **$64** order and received delivery on day 34. The fixed control did not capture that request. Its native Sandbox capture is **7KU53634N57929458**, with a **$2.48 fee** and **$61.52 merchant proceeds**, using fictitious funds. The adapter mirrors one synthetic merchant leg to our saved Sandbox test store; it does not onboard twelve real merchants. The local PayPal view and `paypal_receipts` table link the provider receipt to the generated order. [Native receipt](commerce-expanded/harness-v2/v23-20261104/native-receipt.json) · [Full accounting and shopper trace](commerce-expanded/harness-v2/v23-20261104/first-market-proof.json).

The discovery campaign added $84.30 modeled PayPal net, $981.16 merchant contribution and seven retained purchases. Only $3.70 of its net bridge was outreach savings: payment fees, processing and refund differences account for the rest, minus $0.048424 AI cost.

The example was selected after the run to explain the flow. All aggregate results still include displaced purchases and losses. A clean clone has the archived receipt evidence but no saved buyer or native receipt in its local database; it must not pretend to have made a new payment. The [prior V2.2 replay and receipt](commerce-expanded/harness-v2/v22-20261104/README.md) remain archived.

## Why PayPal matters

Success is retained, fulfillable commerce rather than clicks. Payment authorizations, fees, settlement timing, refunds and outstanding obligations influence the campaigns and fulfillment configuration. The native Sandbox adapter proves selected payment execution and reconciliation; the simulated payment layer lets us compare policies without charging real shoppers.

The current local database contains completed native Sandbox purchases, saved-wallet verification, a completed partial refund and shipment-tracking verification. An invoice is unpaid and a subscription awaits consent. Payouts failed and reporting is blocked. These states stay distinct; the demo does not claim every integration completed.

## Measurement and claim boundaries

- **Modeled PayPal net after AI:** settled platform contribution minus metered model usage. Processing, refunds and outreach are included. It is not gross payment volume or actual PayPal profit.
- **Merchant contribution:** change in merchant equity, including inventory and obligations. Report cash and inventory separately; contribution is not all realized cash.
- **Commerce:** retained purchases and payment volume, recommendation-attributed purchases and fulfillment. An attributed purchase is not automatically incremental.
- **Workflow:** actual validated model decisions, local fits, tested revisions, publications/rejections and artifact lineage.
- **Comparison:** identical exogenous inputs, frozen economics, fresh registered seeds and the same tools/budgets for both AI approaches. Four markets are a small pilot; model AUC and development gains are not evidence of production lift.
- **Cost:** token-metered estimates, not a cloud invoice. Local CPU time is reported separately and is not billed model usage. The $8 model ledger remains below the user's $50 ceiling.

Natural-language rationales remain visible as agent explanations, not verified facts. For example, an inquiry-classifier AUC below 0.5 does not become strong evidence merely because the agent describes it positively. The separate inquiry value head and downstream financial trials must be evaluated on their own outcomes.

## Preserved earlier results

| Study | Team mean PayPal gain vs fixed | Merchant gain | Important limit |
|---|---:|---:|---|
| [Original V2](commerce-expanded/harness-v2/README.md#original-v2-comparison--preserved) | No gain | $0 | All proposals retained fixed rules |
| [V2.1](commerce-expanded/harness-v2/v21-20261104-transport/README.md) | $26.22 | $218.73 | Four of eight AI workflows failed |
| [V2.2](commerce-expanded/harness-v2/v22-20261104/README.md) | $55.30 | $704.07 | Two of eight AI workflows failed |
| [V2.2.1](commerce-expanded/harness-v2/v221-20261104/README.md) | $5.16 | $121.21 | All completed; one planner performed better |

These are different seed cohorts, not a controlled learning curve. Preserve every result; do not compare their mean gains as proof that each code version improved.

## Release boundary

The catalog and customer behavior are authored. The current demo uses AG Studio and makes no Channel3 calls. PayPal Sandbox supplies test receipts, not PayPal's internal consumer data, and does not validate the simulator's economics. AG Studio is in local evaluation mode; hosted judging needs suitable license coverage.

This is a local submission candidate. Keep GitHub private as requested. Public release, video upload and competition eligibility checks are separate release steps. No winning outcome or real-world ROI is guaranteed.
