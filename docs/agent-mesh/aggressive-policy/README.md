# Recurring high-value campaign: short-horizon gain did not persist

**Durability update:** With the same policy stopped after day99 and ordinary shopping continued to day199, mean platform value fell to **−$5.331612** (95% interval−$7.927850 to−$2.785309). First100-day outcomes matched exactly and no outreach occurred after day99. The100-day positive result below remains valid for that window, but does not establish sustained gain.

[Watch the campaign](http://127.0.0.1:4173/aggressive-demo.html) · [80-market evaluation](http://127.0.0.1:4173/aggressive-results.html) · [Verification](verification.json)

**A positive modeled result, after inference cost, survived independent evaluation.** The policy was selected on20 development markets, then evaluated on80 fresh markets:16 unused seeds × five scenarios. Three fresh Gemini strategist/reviewer trials chose the same program using only development evidence. No final outcomes were supplied to them.

| Mean difference versus no campaign | Result |95% seed-cluster interval |
| --- | ---: | --- |
| Platform contribution after conservative inference cost | **+$5.431888** | +$2.015066 to +$9.204979 |
| Merchant contribution | **+$330.6595** | +$272.973994 to +$394.642353 |
| Retained payment volume | **+$722.370875** | +$579.992444 to +$879.1564 |

Amounts are per100 simulated shoppers over the campaign period, with all returns observed through day114. Platform gains occurred in54/80 markets; worst case was **−$13.110362**. Mean platform growth was **0.3829%**, not10%. All80 markets had positive merchant contribution and retained-volume differences in this test. None of these quantities is actual PayPal profit or production ROI.

## Why earlier versions lost

The prior agent study lost about$1.49 per market: roughly$1.05 outreach,$0.19 subsidy,$0.03 inference, plus$0.22 lower margin even before marketing costs. Its campaigns did not create enough retained value. More broadly contacting shoppers was not the remedy: under the expanded authority, broad full-price outreach still averaged−$4.319125.

The old action space concentrated on isolated seven-day/$5 experiments. The new policy can run through days30–99 with a **$50 virtual budget**, shared by every competing policy. It adds recurring timing and catalog-price targeting. Economic equations, response behavior, fees, wallets, seven-day contact restrictions, stock and merchant margin constraints are unchanged. Earlier results remain intact; this is a new policy class and authorization envelope, not a direct same-task comparison with the old short-pilot results.

## What the policy does

1. Recommends higher-value catalog products at full price. In this catalog,$31.99 items are excluded and the$89 Starter Bundles product qualifies.
2. Runs during the first two days of the virtual week. This uses the simulator's existing fixed weekly budget cycle; it is not evidence about real customer paydays.
3. Prefers the observed previous merchant when prices tie.
4. Stops recommending a merchant after at least20 matured observed orders when a Beta(1,19)-smoothed return estimate exceeds10%.
5. Continues ordinary shopping on quiet days. No coupons or campaign discount subsidies are used.

The strategy definitions are **transparent authored numerical policies**. Their validation and selection are data-driven. Gemini chose and approved the policy; code executes the recurring schedule and financial constraints. The underlying program can run without an LLM. This result does not establish an exclusive LLM advantage over a numerical optimizer.

The selected program without inference cost averages+$5.47225. A simpler high-value weekly policy averages+$5.118625. After the conservative inference allowance, the selected program's paired mean advantage over that simpler policy is+$0.313263. The same selected program executed entirely numerically avoids the inference cost and produces the same commerce outcome.

## Financial bridge

The average change is **+$15.56225 in margin after processing and returns**, minus **$10.09 outreach**, minus **$0 discount subsidy**, minus **$0.040362 inference allowance**, leaving **+$5.431888**. The inference allowance is the largest observed cost of a fresh two-call agent approval and is charged in full to each alternative world. Only three real approval trials were generated;80 evaluations do not imply80 fresh LLM plans.

## Concrete warehouse-backed demo

The demo uses seed112001 with delayed returns, selected before its result was inspected. Its approved policy achieved **+$21.661702 modeled platform contribution** and **+$488.17 merchant contribution** versus its no-campaign twin. It generated1144 campaign-period purchases versus1136 without a campaign, with478 full-price recommendations and zero campaign coupons.

The main local warehouse now contains **1641 orders and1641 transactions**, including497 warmup orders, under run`GARDEN-LAB-d7c87661b441b28b`. Orders, products, customers, deliveries, refunds, campaign spend and policy-action views retain their ordinary foreign-key relationships. Recorded Pro decisions and code schedule changes are checkpointed. Warehouse totals exactly match independent simulator execution; all7000 campaign-period action outcomes matured in every branch.

The highlighted purchase is Tala04 buying the cached Channel3 Starter Bundles listing for$89 at Willow Goods. It is an attributed simulated recommendation purchase, not individual proof of incrementality. On day84 (zero-based), observed mature-return risk crossed the approved threshold for Oak & Ink and the program routed recommendations to the other merchants. The full paired outcome includes future wallet, fatigue and refund consequences.

A previously verified PayPal Sandbox receipt is displayed separately as an integration reference. No new native payment or checkout was made. Playback makes no LLM calls. The main “Run demo” action now opens this campaign, while the previous negative studies remain accessible.

## Cost, checks and limitations

- Six generated model decisions across three fresh Pro strategist/reviewer trials.
- New metered-token estimate **$0.117138**; cumulative recorded estimate **$2.629139**. Not billing invoices.
- No APAC resource change, subagent delegation or new PayPal payment.
- Frozen simulator/accounting/catalog hashes match; zero evaluator invariant violations; warehouse parity verified.
- The first warehouse materialization hit a foreign-key check because an authored rule was incorrectly assigned a fitted-model ID. It resumed from the last atomic day after recording the program as a policy rather than a trained model. No transaction history was discarded or duplicated.
- Positive average does not mean every market wins. The result is conditional on the authored simulator, its weekly budget cycle and five equally weighted scenarios.

Files: [protocol](protocol.json), [development results](development.json), [evaluation](evaluation.json), [actual agent choices](agent-choices.json), [demo](demo.json), [financial bridge](../../figures/aggressive-policy/financial-bridge.pdf), [policy confirmation](../../figures/aggressive-policy/policy-confirmation.pdf).
