# Autonomous live commerce integration

The existing **New live run** button now opens settings and starts the analyst → local training → commerce workflow in the frozen growth economy. Customers keep trading during model calls and training. The current valid policy stays active until the new model/campaign is published at a day boundary. The approved UI, original simulator and historical results remain intact.

[Open this completed run](http://127.0.0.1:4173/studio.html?session=AUTONOMY-272a791d4860b5ca). Replay starts at day1 and makes no paid model or native payment calls.

## Actual run

Seed987402, product-discovery regime,100 shoppers,100 market days and the unchanged26-day settlement tail. There were267 total customer checkouts including the shared warmup; comparative results below exclude warmup and include settlement.

| Outcome | Strong fixed | Autonomous team |
|---|---:|---:|
| Modeled platform contribution after model cost | $812.58 | $797.59 |
| Retailer contribution | $9,327.95 | $9,084.60 |
| Retained purchases |145|144|
| Retained payment volume | $19,550.00 | $18,955.00 |

The workflow completed, but the team did not beat fixed on this seed. The full profit-improvement goal remains unproven. This is one live, asynchronous demonstration, not a population benchmark. Background model latency affected publication timing; both arms had identical initial history, needs, consent and household funding.

- Six fresh Gemini decisions cost a token-metered estimate of **$0.009974**. Lifetime recorded model usage is **$3.531206**, below the unchanged$8 application cap and the user's$50 ceiling. No unsettled ledger entries.
- First review: days31–43; **35 checkouts continued**; publication on day44.
- Second review: days76–87; **27 checkouts continued**; publication on day88.
- First local forest:7,010 historical observations,2.8seconds.
- Second local forest:5,674 observations, including **111 matured outcomes from this run**,2.7seconds. Its validation set differs from the first job; do not interpret the two AUC values as a controlled improvement curve.
- Zero unpaid liabilities and zero native PayPal calls in this trial. Sandbox sampling was explicitly switched off before starting.

## PayPal and the warehouse

Observed product interest becomes a recommendation or reactivation inquiry. A responding shopper still needs existing authorized funds, a complete permitted basket and stock. Captures, supplier settlement, delivery and refunds are executed by trusted tools and return to the economic feedback.

The warehouse contains canonical customer baskets, merchant order legs, modeled transfers, funded contact responses, supplier invoices, model jobs and observed interest events. Merchant-leg gross/fees/refunds and inventory reconcile with the canonical economy.651 already-recorded search/browse events were backfilled into the warehouse read model; the economy and results did not change. Fixed-fallback contacts are distinguished from agent campaigns.

When enabled in run settings, the existing saved-buyer Sandbox adapter selects at most one retained **agent-campaign merchant order**, up to$100 in test funds, and links its actual receipt to the same order. No login or checkout consent is requested for every simulated shopper. A mirrored receipt is not a second sale. This live trial did not exercise the new native sample path; the payment adapter's existing idempotency/reconciliation checks passed locally.

## UI verification

- Run settings show the seed, scenario, model cap and optional Sandbox limit before starting.
- The market and agent office operate simultaneously; the screenshot captured shoppers buying while the second model trained.
- Insights shows the analyst's evidence and real training jobs. Warehouse exposes the corresponding base tables and views.
- Performance automatically compares this run with the original strong fixed workflow after settlement.
- Saved replay hides future decisions, receipts and the final comparison until their recorded time. New runs initialize a response-rate reference from observed contacts rather than leaving the drift trigger uninitialized.
- Uncertain paid calls are not silently repeated after a server restart; saved checkpoints remain inspectable.

## Verification and remaining work

Nine integration/regression checks passed, covering background trading, real local training, publication timing, warehouse reconciliation, API origin checks and the existing receipt/idempotency path. The affected live test passed again after the final data-projection changes. The live audit independently checked money/stock invariants, gross/fee/refund reconciliation, private-household-data exclusion and matched comparison inputs.

The next economic test should address a specific model limitation: contact scoring currently multiplies purchase probability by an average value for the contact kind. Equal-probability recommendations therefore cannot express different conditional basket values through that value term. Train and validate an expected payment-value model using the existing settled outcome labels, then compare it against fixed on fresh seeds. This is a hypothesis to test, not an explanation already proven to account for the observed loss.

[Audit and review timing](audit.json) · [Actual agent checkpoints](checkpoints.json) · [Observed trajectory](trajectory.json) · [Source snapshot](source-hashes.json) · [Interest projection audit](interest-projection-audit.json)

## Handoff correction after the live run

The recent-interest audience filter incorrectly removed needs inquiries, even when the commerce agent selected both action types. The filter now qualifies the shopper by observed interest and separately respects the chosen action types. A regression check covers this contract.

A no-cost diagnostic replay exactly reproduced the original live economics before applying the fix. Corrected execution of the recorded plans earned$0.82 more modeled platform contribution, but retailer contribution fell another$48.57. It remains below fixed. This is a known-seed execution diagnostic, not fresh agent decisions or new held-out performance; the actual live result above is unchanged.

[Diagnostic results](handoff-fix/results.json). The small effect does not establish that this bug explains the original performance gap.
