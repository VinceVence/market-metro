# Market Metro submission demo

Record a **2 minute 50 second** walkthrough. Lead with retained purchases and merchant value, show the decisions that produced them, and finish with the three-way comparison. Use the completed fresh Gemini run for the main result. The merchant-feed benchmark and archived Sandbox receipt each have their own visible labels.

## Headline to put on screen

**16 more retained purchases · $1,024.86 more merchant contribution · +3.47% modeled PayPal net**

The comparator is fixed campaign rules in the same frozen simulated market. The PayPal increase is **$114.95 after inference cost**. Retained payment volume increased **$2,345**. The market contains 600 shoppers and 12 merchants and settles through day 126.

| Policy | Modeled PayPal net after AI | Merchant contribution | Retained purchases |
|---|---:|---:|---:|
| Fixed rules | $3,309.83 | $38,928.95 | 627 |
| Fresh planner | $3,391.08 | $39,494.31 | 642 |
| Fresh planner with ontology | **$3,424.78** | **$39,953.81** | **643** |

Keep the planner comparator visible. The ontology-assisted workflow adds **$33.70 PayPal net, $459.50 merchant contribution, $662 retained sales and one purchase** over the fresh planner. These are aggregate outcomes for one scenario. Both the model and campaign choices differ between planners. [Measured results and decisions](../demo/data/ontology-live-campaign.json)

## Recording sequence

| Time | Screen and action | What judges should see |
|---|---|---|
| 0:00–0:15 | Open [Fresh campaign comparison](http://127.0.0.1:4173/judge.html#livecampaign). Hold on the first results table. | The three policies and headline gains over fixed rules. Add a caption saying “One frozen simulated market · day 126 settlement”. |
| 0:15–0:35 | Open [Market](http://127.0.0.1:4173/judge.html#market), then [Evidence](http://127.0.0.1:4173/judge.html#evidence). | The visual economy, 600 shoppers, 12 merchants and demand available before the day-31 decision. This is the common starting state for the comparisons. |
| 0:35–0:58 | Open [Merchant feed verifier](http://127.0.0.1:4173/judge.html#ontology). Show a split checkout, switch to renamed fields, then the ambiguous-link example. | One checkout counted once, semantic mapping of unfamiliar headers and a hold on ambiguous evidence. Add “Separate 24-export test” and the 6/12 → 12/12 valid-feed result. |
| 0:58–1:35 | Return to [Fresh campaign comparison](http://127.0.0.1:4173/judge.html#livecampaign). Scroll to **Planner + ontology**. Expand **Choose ontology features**, then **Select a trained model**. | The actual 28-day training choice, eight requested features, 1,230 product-contact rows, model scores and selection. Briefly show the evidence supplied to Gemini. |
| 1:35–2:00 | Expand **Revise after the trial**, then **Verifier’s final decision**. | The initial no-response stress result, the LLM’s revision, and measured approval. Overlay “Stress-test PayPal delta −$36.63 → +$0.85” and “Contact ceiling 60 → 36 per day”. The revision also restored the existing supply settings. |
| 2:00–2:25 | Open [PayPal receipt](http://127.0.0.1:4173/judge.html#receipt). Expand **Match the provider receipt to the warehouse**. | A completed native $96 Sandbox capture, $3.56 fee and $92.44 test merchant proceeds, bound to one warehouse order. Caption “Archived judge-order integration proof · Sandbox test funds”. |
| 2:25–2:50 | Return to [Fresh campaign comparison](http://127.0.0.1:4173/judge.html#livecampaign), then show **Run your own simulation** in the [final walkthrough chapter](http://127.0.0.1:4173/judge.html#result). | All three results, 12 fresh model responses and $0.077443 estimated inference cost. End by showing where judges choose their seed and inspect Ontology graph and Agent workflow. |

Show recorded checkpoints without waiting for another model call. The core comparison actually used fresh Gemini decisions, local training and full settlement. Playback reads that evidence. The ontology’s merchant definitions and the financial publication checks execute deterministically. Seeded shopper behavior and financial outcomes are simulated.

## Voiceover

### 0:00–0:15

In the same simulated economy, Market Metro’s ontology-assisted planner produced sixteen more retained purchases, over a thousand dollars in additional merchant contribution, and three point four seven percent higher modeled PayPal net than fixed rules.

### 0:15–0:35

This market has six hundred shoppers and twelve merchants. Thirty days of activity give the planner observed demand, stock and payment history. On day thirty-one, it investigates that evidence and decides what campaign to test.

### 0:35–0:58

First, it needs trustworthy data. A checkout can split across merchants. Our ontology identifies the purchase, maps unfamiliar fields and holds ambiguous relationships. In a separate test, it accepted all twelve usable merchant feeds. Fixed mapping accepted six. Both held all twelve unsafe feeds.

### 0:58–1:35

Here are the actual Gemini decisions. It chose twenty-eight days of history and eight features covering interest, shopping history, price, stock and earlier responses. The training tool used product recommendations as the learning cases. Its eight-feature model scored worse, so Gemini kept the broader model. We can inspect the evidence, requested features and validation behind that decision.

### 1:35–2:00

The first campaign lost money in a no-response stress test. The planner read the results, restored the existing supply settings and reduced its daily contact ceiling from sixty to thirty-six. The financial verifier retested the proposal and approved it. The campaign then ran through purchases, deliveries and settlement.

### 2:00–2:25

PayPal is part of both execution and evaluation. Fees, processing, refunds and settlement affect the campaign’s measured outcome. Separately, this archived ninety-six-dollar order completed through PayPal Sandbox. Its capture matches the warehouse order, and its fee plus merchant proceeds reconcile exactly.

### 2:25–2:50

The finished campaign improved PayPal net, merchant contribution and retained purchases. Both planners used under eight cents in model calls. Now choose Run your own simulation. Change the seed, follow your market's associations in Ontology graph, and inspect the planning and verification in Agent workflow.

## Metric cards and exact scope

| Card | Exact claim and evidence | Placement |
|---|---|---|
| **+16 retained purchases** | 643 versus 627 in the fresh one-market comparison. [Results](../demo/data/ontology-live-campaign.json) | Main opening and closing |
| **+$1,024.86 merchant contribution** | Includes inventory value and obligations. [Results](../demo/data/ontology-live-campaign.json) | Main opening and closing |
| **+3.47% modeled PayPal net** | $3,424.777125 versus $3,309.83, including the ontology planner’s $0.042875 estimated inference cost. [Results](../demo/data/ontology-live-campaign.json) | Main opening and closing |
| **2× usable-feed coverage** | 12/12 valid synthetic exports versus 6/12. Both approaches held 12/12 unsafe exports. [Feed study](../demo/data/ontology-study.json) | Ontology segment |
| **12 real model responses, under $0.08** | $0.077443 across both fresh planners. Local CPU training has a separate compute cost. [Usage records](../demo/data/ontology-live-campaign.json) | Closing |
| **$96 native Sandbox capture** | Completed capture 2M324038C71499318 belongs to the archived original judge order. It contributes zero additional benchmark sales. [Receipt](../demo/data/judge-reactivation.json) | PayPal segment |
| **ROC AUC 0.827 → 0.852** | Separate local feature study on 4,865 common held-out contacts across four markets, with real local training and scripted tool choices. One market lost money. [Feature study](ontology/training/README.md) | Supporting submission text or questions |
| **96 merchants, 4,800 shoppers** | Separate eight-district deployment with a reused campaign. At full feed coverage, +103 retained purchases and +$624.95 modeled PayPal net over fixed. Median local scoring was 86.1 ms, with 109.0 ms p95 over 15 warm passes. [Scale study](merchant-capacity/README.md) | Optional extended demo |
| **384 live merchants, 19,200 shoppers** | One shared live market with fresh planner + ontology reviews. Through day 126, +532 retained purchases, +$3,310.75 modeled PayPal net and +$36,042.88 merchant contribution over same-size fixed rules. The successful run used $0.059695 in model calls. Proposal checks used 600-shopper proxy trials. [Live scale validation](commerce-metropolis/README.md) | Hands-on live-market follow-up |

The live eight-feature model was rejected. Present the live gain as the outcome of the ontology-assisted planning and verification workflow. Use the four-market feature study when discussing measured feature-selection improvement. Its 12-feature model and $71.81 aggregate gain have their own experiment boundary.

## Preparation and judge questions

1. Run the local app with the bundled evidence. Use the exact links above. Keep the results table and the requested-feature/model-selection sections ready to show.
2. Record at a readable desktop size. Expand only the active decision. Keep model inputs collapsed until the evidence moment.
3. Overlay the three headline metrics. Keep “Modeled outcomes · simulated shoppers” readable throughout the financial comparison. Use “Merchant contribution includes inventory” on the result frame.
4. Label the receipt segment as archived Sandbox execution. The fresh comparison’s simulated orders have their own IDs and transaction trace.
5. Reserve the four-market feature study, six-seed earlier planner study and merchant-scale view for questions or the submission description. Their evidence is complementary and must retain its scope.
6. Check the final exported video duration is below three minutes. The plan targets 2:50 to leave upload and title-card margin.

**What does the LLM actually decide?** Investigation focus, training window, feature recipe or explicit feature list, model preference, campaign settings and a revision after the trial. Local code fits models, scores shoppers and enforces the publication checks.

**What did the ontology add?** Better support for unfamiliar merchant schemas, explicit purchase grain, training-cohort definitions and admissible features. The live LLM rejected its weaker eight-feature candidate. The separate controlled feature study measured an improvement from a different selected feature set.

**Why does PayPal matter?** The objective uses retained payment volume and modeled net after fees, costs and refunds. A completed Sandbox capture demonstrates that a selected warehouse order can execute through PayPal and reconcile to the provider receipt.

**Is the financial gain production proof?** It measures a frozen synthetic economy. The single fresh comparison demonstrates the workflow and its outcome on the existing judge seed. Further data would be needed to estimate production lift.

**What is the agent architecture?** One real LLM planner, trusted analysis and training tools, an ontology layer, saved checkpoints and a deterministic financial verifier. The tested submission candidate uses this architecture.
