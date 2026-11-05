# Does the reactivation gain repeat?

The earlier reactivation example added $84.03 in simulated PayPal net, $954.40 in merchant contribution and 11 retained purchases when the verifier changed the team's ranking model. This follow-up asks how often that happens when both the shoppers and the Gemini decisions are fresh. [Original comparison](../README.md)

**Campaigns beat fixed rules repeatedly. The extra model check produced occasional gains.** The checked single planner improved all three outcomes on six of six seeds. The team improved all three on five. Between the two checked workflows, the single planner earned $173.79 more for PayPal and $1,827.03 more for merchants, with 34 more retained purchases. The team earned more for PayPal on three seeds and improved all three outcomes over the single planner on one. [Interactive scorecard](http://127.0.0.1:4173/studio.html?view=performance&evaluation=reactivation-fresh)

| Paired comparison, totals over six markets | Change in PayPal net after AI | Change in merchant contribution | Change in retained purchases | Seeds up on all three |
|---|---:|---:|---:|---:|
| One planner with verifier vs fixed | +$809.18 | +$8,341.39 | +135 | 6/6 |
| Team with verifier vs fixed | +$635.39 | +$6,514.36 | +101 | 5/6 |
| Team with verifier vs one planner with verifier | −$173.79 | −$1,827.03 | −34 | 1/6 |
| Same single-planner decisions, adding the verifier | +$21.04 | +$325.12 | +2 | 1/6 |
| Same team decisions, adding the verifier | +$35.57 | +$195.48 | +3 | 1/6 |

The team verifier allowed one previously ineligible campaign to run and switched another campaign's ranking model. On the first seed this added $4.92 to PayPal net and $43.90 to merchants with the same number of retained purchases. On the second it added $30.65, $151.58 and three retained purchases. It kept the original team decision on four seeds. The single planner's verifier changed one ranking and added two purchases. The median incremental PayPal gain from the verifier was zero for each arm.

**One market explains much of the planner–team gap.** Both chose the same six-contact limit per 100 shoppers and the same supply settings on seed 92111701. The single planner chose to follow up on shopping interest, with availability for general inquiries. Its campaign added 29 retained purchases over fixed. The team chose product recommendations only. The verifier cleared its alternative ranking for publication, and its campaign added zero purchases over fixed. The two arms also used different ranking models. This comparison measures the combined campaign and model choice.

| Seed | Planner PayPal vs fixed | Team PayPal vs fixed | Team vs planner PayPal | Team vs planner merchants | Team vs planner purchases |
|---|---:|---:|---:|---:|---:|
| 92111701 | +$168.06 | +$4.88 | −$163.18 | −$1,860.07 | −29 |
| 92111702 | +$178.33 | +$149.48 | −$28.85 | −$307.63 | −6 |
| 92111703 | +$128.15 | +$138.70 | +$10.55 | +$151.45 | −3 |
| 92111704 | +$97.16 | +$105.53 | +$8.37 | +$158.81 | 0 |
| 92111705 | +$122.52 | +$100.38 | −$22.14 | −$230.43 | −3 |
| 92111706 | +$114.96 | +$136.42 | +$21.46 | +$260.84 | +7 |

All twelve reviews completed, with 72 distinct Gemini responses, 24 local fits and zero unpaid liabilities. Metered token costs were $0.228715 for the single planner and $0.227756 for the team. Total study usage was **$0.456471**, bringing the project ledger to **$7.277499**. There were zero native payments.

## How we tested it

We registered six reactivation seeds before the first paid call. After 30 days of organic shopping, one planner and the three-role team independently saw the same market snapshot. Both got six decisions, two local model experiments, the same campaign options and the same financial verifier. The first five Gemini decisions used Flash-Lite. The campaign revision used Pro. Which arm went first alternated by seed. All twelve campaigns were locked before the evaluator saw any shopper's subsequent purchases.

On each seed we ran strong fixed rules and scored each arm twice. One version used the agent's original choice and the other used the verifier's choice. Both versions of an arm carried exactly the same model cost. Each campaign stayed in place from displayed day 31 through market close, followed by settlement. This matches the earlier first-review experiment. A repeat required gains in PayPal net after AI, merchant contribution and retained purchases together on at least four seeds, plus positive totals on all three.

The original future needs, consent, income, opening balances and review snapshot matched within each seed. PayPal net includes modeled fees and costs. Merchant contribution includes inventory at its modeled value. A retained purchase is a checkout kept after the refund window. These comparisons use simulated money.

## Reproduce the comparison

After the [local setup](../../../../README.md), run the scorer from the project root. It verifies the locked decisions, loads or locally refits the exact models, checks each artifact hash and writes an independent report under `.local/reactivation-fresh-r1/`. It makes zero model or payment calls.

```sh
node scripts/commerce-expanded/harness-v2/score-reactivation.mjs
```

[Registered protocol](protocol.json) · [Fresh decisions, provider receipts and model choices](decisions.json) · [All paired financial results](../../../../demo/data/commerce-reactivation-fresh.json)
