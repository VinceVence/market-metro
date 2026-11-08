# Market Metro judge walkthrough

[Final recording plan and metric cards](demo-plan.md) · [Submission description draft](submission-draft.md)

**Default entry** — [Play the reactivation demo](http://127.0.0.1:4173/). One LLM planner proposes the campaign. A deterministic verifier tests both trained ranking models against settlement outcomes. The recorded walkthrough works with the project’s bundled data and zero new model calls or payments.

The current UI has three sections, **Market → Agent decisions → Impact**, and six saved stops. The result precedes the final receipt screen. The detailed evidence below explains the same recorded campaign.

## One run from observed demand to PayPal

1. **Market.** Seed `92111706` has 600 simulated shoppers and 12 synthetic merchants. Organic shopping supplies 30 days of observations before the review on displayed day 31.
2. **Evidence.** The planner observed 99 recent electronics interest signals and 85 furniture signals. Open funded requests included 6 electronics units and 35 furniture units. The current market had no mature campaign outcomes. Historical training data contained 7,010 simulated contacts and 457 retained purchases, 41 of which funded after the initial contact.
3. **Campaign.** In six recorded Gemini decisions, the planner chose category analysis, a 28-day market-feedback window, two model fits, and a ranked discovery campaign. Consenting shoppers could receive a product recommendation or a needs inquiry, up to 36 contacts per day. The original review cost $0.032325 in metered model usage.
4. **Verifier.** The planner preferred the two-stage response model. Across three development markets the same campaign averaged $26.65 in additional modeled PayPal net over fixed with that model and $30.97 with boosted trees. The boosted model also cleared the purchase and merchant checks. The verifier bound it to the published campaign.
5. **Shopper.** Shopper 179 last purchased on day 19. On day 35 the planner recommended a **Mobile Side Table**. The shopper funded and bought it for **$96** from **Form & Function**. It arrived on day 36 and was retained. That same request went unfilled with either fixed rules or the planner’s original ranking.
6. **PayPal.** The selected order was mirrored once to the connected PayPal Sandbox test store. Completed capture **`2M324038C71499318`** covered **$96.00** in test funds. The native fee was **$3.56** and test merchant proceeds were **$92.44**. The PayPal order’s custom ID matched warehouse order `GARDEN-AUTO-e26323c97cbcb456-SIM-CAPTURE-756-MERCHANT-7`. Playback reads this receipt. [Receipt chapter](http://127.0.0.1:4173/judge.html#receipt)
7. **Result.** Through settlement on day 126, fixed rules produced $3,309.83 in modeled PayPal net, $38,928.95 in merchant contribution and 627 retained purchases. The planner with the verifier produced $3,424.79, $39,953.81 and 643. The gains were **+$114.96, +$1,024.86 and +16 purchases**. Changing only the ranking added **+$21.04, +$325.12 and +2 purchases**. The Sandbox capture contributes no additional benchmark revenue.

We chose this seed after the six-market study because it was the one single-planner case where the verifier switched models. Within that run, the shopper illustration favors a returning buyer with a completed single-merchant order, including a check against both comparison policies. Across all six seeds the checked planner improved the three primary outcomes over fixed rules in six markets. The model switch added purchases on one seed. [Six-seed results](commerce-expanded/model-check/reactivation-fresh/README.md) · [Exact decision lock](commerce-expanded/model-check/reactivation-fresh/decisions.json) · [Bundled demo evidence](../demo/data/judge-reactivation.json)

The earlier three-role discovery demo and its separate $64 capture remain available with the historical study. [Earlier V2.3 result](commerce-expanded/harness-v2/v23-20261104/README.md) · [System architecture](figures/planner-v23/README.md)

## Let judges explore

The final walkthrough chapter links to **Try your own free simulation**. The settings offer fresh planning and a zero-call recorded policy on a new seed. Both use the frozen economy. The free option requires the local numerical engine and transparently reuses the reference model and campaign.

**Run settings → Size** also offers separately versioned shared markets of 96, 192 and 384 merchants, with 50 shoppers per merchant. These require fresh planning. All three validation runs settled through day 126. At 384 merchants, the combined workflow added 532 retained purchases and $3,310.75 modeled PayPal net versus same-size fixed rules. The live Performance view includes merchant outcomes, model cost, earlier attempts and the smaller proxy-trial scope. [Full live-market evidence](commerce-metropolis/README.md)

The workspace has two inspection tabs. **Ontology graph** displays clickable nodes and their real associations for the selected run, with pan and zoom. **Agent decisions** groups checkpoint evidence into data checks, analysis, training, campaign planning, verification and launch. Each tab keeps the run identity and observation day visible. For saved-policy runs, the source planning record has its own reference label.

After settlement, open **PayPal Sandbox** to inspect any native sample created for that run. Match its capture to the warehouse order and reconcile gross, fee and merchant proceeds. Requesting a native sample is optional and uses fictitious funds.

## Why PayPal matters

For the day-31 decision, choose **More evidence → Mapping hold example**. Show the two competing checkout keys and zero outreach. Apply the merchant’s confirmed mapping. The same rows now release 715 prior checkouts to the planner, which restores the recorded campaign and previews 36 contacts. The $96 shopper order comes later in the run. [Hold and resume the planner](http://127.0.0.1:4173/judge.html#planner).

In **More evidence → Training comparison**, show how the product ranker separates 1,230 product recommendations from 1,532 general inquiries. The new ranking changes four contact slots. A switch earned an extra $71.81 in modeled PayPal net and 16 retained purchases across four fresh simulated markets, including a loss on reactivation. [Open the model comparison](http://127.0.0.1:4173/judge.html#training) · [Financial controls and study scope](ontology/training/README.md)

For fresh LLM decisions, open **More evidence → Training comparison**. Fixed rules earned $3,309.83 modeled PayPal net, the planner $3,391.08, and the ontology-assisted planner $3,424.78 after their respective inference costs. Both planners completed six new Gemini decisions. Show the eight features the ontology planner requested, its weaker validation score, and its decision to retain the broader model. Its campaign revision passed the financial verifier. [Three-way campaign and decision log](http://127.0.0.1:4173/judge.html#livecampaign) · [One-market study and limits](ontology/live/README.md)

Select **More evidence → Verify a merchant feed**. The business definitions distinguish a shopper checkout, a seller’s portion and a Sandbox confirmation. Switch from **Recorded warehouse** to **Partner with renamed fields**, then **Two possible checkout links**. The verifier first recovers the same audited purchase count, then holds the ambiguous feed before publishing its totals. The earlier campaign and its financial comparison use their original evidence. [Merchant feed verifier](http://127.0.0.1:4173/judge.html#ontology) · [Held-out comparison](ontology/README.md)

For a short scale demonstration after the receipt, open **More evidence → Separate scale experiment**, choose four districts and twelve inventory feeds per district, then click **Run local ranking**. One trained model serves 48 simulated stores using four independent markets. With full stock visibility it sent 35% fewer product recommendations than fixed rules and produced 45 more retained purchases across all shopping. PayPal net rose $260.68 in the simulation. Keeping the same 2,400 shoppers and increasing participating sellers from 16 to 48 took recommendation sales from 12 to 36 distinct participating merchants. [Merchant scale and controls](merchant-scale/README.md)

Success is retained, fulfillable commerce rather than clicks. Payment authorizations, fees, settlement timing, refunds and outstanding obligations influence the campaigns and fulfillment configuration. The native Sandbox adapter proves selected payment execution and reconciliation; the simulated payment layer lets us compare policies without charging real shoppers.

The current local database contains completed native Sandbox purchases, saved-wallet verification, a completed partial refund and shipment-tracking verification. An invoice is unpaid and a subscription awaits consent. Payouts failed and reporting is blocked. These states stay distinct; the demo does not claim every integration completed.

## Measurement and claim boundaries

- **Modeled PayPal net after AI:** settled platform contribution minus metered model usage. Processing, refunds and outreach are included. It is not gross payment volume or actual PayPal profit.
- **Merchant contribution:** change in merchant equity, including inventory and obligations. Report cash and inventory separately; contribution is not all realized cash.
- **Commerce:** retained purchases and payment volume, recommendation-attributed purchases and fulfillment. An attributed purchase is not automatically incremental.
- **Workflow:** actual validated model decisions, local fits, tested revisions, publications/rejections and artifact lineage.
- **Comparison:** identical exogenous inputs, frozen economics, fresh registered seeds and the same tools/budgets for both AI approaches. The reactivation replication covers six seeds in one modeled regime. Financial results measure this simulated market.
- **Cost:** token-metered estimates, not a cloud invoice. Local CPU time is reported separately and is not billed model usage. Recorded usage belongs to its identified run; the configured budget remains bounded.

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
