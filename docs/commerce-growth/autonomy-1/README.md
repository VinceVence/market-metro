# Autonomous intent and conversion team

**Current verified demo:** [workflow, model-quality results and completion audit](completion-1/README.md). The user chose autonomous workflow and model quality as the completion criteria, with profit reported separately. The fresh live run completed six real Gemini decisions, one local model fit and 58 feedback updates; Brier prediction error fell 6.8% on the same 247 issued recommendations. Financial gains and losses remain visible and are not completion gates under the clarification.

## Earlier implementation and financial studies


Latest: [seven fresh markets](validation-1/REPORT.md), [independent audit](validation-1/audit.json), and [graphs](validation-1/comparison.png). The team completed42 Gemini decisions,10 local fits and14 publications for$0.080027. Mean modeled platform net improved0.32%, but aggregate retailer contribution declined$10.67 per market; merchant and cash guards failed. Autonomy is demonstrated; the financial goal remains open. The live UI now supports the tested recipe choices. No new native PayPal calls occurred.

The user clarified that the primary deliverable is an autonomous commerce team: identify market gaps, train and evaluate local ML, publish campaigns, and adapt from observed economic signals.2x is a stretch target, not a prerequisite for implementing the workflow. The economy remains frozen and all earlier results remain intact.

## Latest live integration

The new controller is now connected to **New live run**, with background reviews, real local retraining, automatic publication, PayPal/payment lineage and the existing warehouse/Insights/Performance views. [Verified live run and comparison](live-1/README.md). Economic superiority remains unproven; the latest live team result was $797.59 versus $812.58 fixed after model cost.

## Implemented

- Market analyst, ML scientist and commerce manager application-agent roles.
- Real local logistic and random-forest training from7,010 observed historical contacts, including intent and context features omitted by the earlier coarse model.
- Whole-market model validation: coarse AUC 0.535; forest AUC 0.673. This is prediction quality, not campaign profit.
- Durable analysis, training, publication and outcome checkpoints. The controller automatically performs a later review using observed results. No development subagents.
- Local per-shopper model scoring, consent/budget checks and the frozen funded-order, supplier-settlement, delivery and refund executor.
- An existing-UI workflow view with actual agent handoffs, training results, an affordable-basket payment example, component-level modeled payment economics and the fixed/ML/team comparison.

## Fresh application-agent run

Seed 987401, discovery regime,100 shoppers,100 market days plus the unchanged settlement tail. Three arms use the same initial history, needs, funds and shocks. No model calls are used by the two comparators.

| Arm | Retained purchases | Exact recommended item purchases | Platform net after AI | Retailer contribution |
|---|---:|---:|---:|---:|
| strong_fixed | 127 | 67 | $694.47 | $7664.32 |
| fixed_workflow_with_intent_model | 129 | 54 | $678.07 | $7700.03 |
| autonomous_team | 116 | 52 | $608.91 | $6805.18 |

The team completed six fresh Gemini calls, one local training job and two publications without human intervention. All liabilities settled. Metered model usage cost **$0.008596**; recorded lifetime usage is **$3.521232**, below the unchanged$8 application cap and the user's$50 total ceiling. These are token-price estimates, not a billing invoice. No new native PayPal payment or APAC operation occurred.

**Operational autonomy worked; economic superiority did not.** The manager chose three daily contacts and three-day stock cover, compared with ten-contact capacity and seven-day cover in the incumbent. It did not receive a preview of missed opportunities or measured evidence for reducing stock. The analyst repeated model-quality results instead of identifying a distinct market opportunity. These are concrete decision/handoff gaps, not proof that more agents or a more expensive model are necessary.

## PayPal's role

The recommendation must become a funded, fulfillable order before it counts as revenue. Supplier payment timing changes stock arrival. Fees, processing, refunds and contact costs enter the team's economic feedback. A shopper example uses$92.81 of simulated authorized funds, selects an approved$64 alternative, releases the unused$28.81, and records delivery before its deadline. Modeled retail contribution after processing and outreach is$1.70. These amounts are not native Sandbox receipts or a claim about PayPal account-balance visibility.

The existing Sandbox integration can mirror selected orders using the saved test buyer and link the real provider capture to the warehouse. This benchmark disabled native calls. The UI clearly separates the modeled payment records from the existing native integration.

## Changes made after the run

The first run and its source snapshots are preserved. The current controller now separates role context: the analyst receives commercial/cohort evidence rather than the model leaderboard; the scientist receives model-validation context; the manager receives current-snapshot campaign coverage/value previews and the incumbent supply contract. A newly trained model is staged and only activates at publication; a keep decision cannot silently replace it.

These changes passed the local orchestration check but have **not** been credited with the first run's results, nor rerun with paid models yet. Prediction-based previews are not a substitute for measured campaign outcomes. That snapshot predates the live integration. New live run now uses the background autonomy controller; the original demo page remains an archive. A bounded campaign-impact experiment and stronger payment-value modeling remain work to do.

## Evidence

- [Architecture and responsibilities](ARCHITECTURE.md)
- [Frozen demonstration protocol](demo-1/protocol.json)
- [Actual decisions and training checkpoints](demo-1/team/checkpoints.json)
- [Full paired results](demo-1/results.json)
- [Training validation](training/model-report.json)
- [Portable inference check](training/parity-report.json)
- [UI screenshot](../../screenshots/autonomous-commerce-paypal-trace.png)

All seven fixed-arm training replays reproduced their original financial totals. JavaScript predictions matched128 sklearn outputs within floating-point tolerance. The local orchestration check exercised real training with an explicitly fake provider before the paid run. The actual paid run used fresh Gemini decisions and contains no provider fallback. This single run does not prove repeatable gains, production ROI or replacement of an entire human team.
