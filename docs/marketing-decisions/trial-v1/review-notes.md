# First-trial findings and audit

The assistant did not beat strong rules on the preregistered reviewed-merchant
objective. Before the assumed operating costs, the difference was **−$0.455**.
At the declared $0.10 per chat-reviewed case, the net difference was **−$1.655**.
These are sums of 12 case means, each using 16 paired futures, not production
money or 192 independent business cases.

There were nine matching action choices and three disagreements. Their actual
merchant outcomes were nearly identical. The all-merchant contribution was
$4.8225 higher for the assistant before operating costs because changing a
merchant's ranking can affect shared customers and budget. That secondary,
small improvement does not pass the frozen primary gate and is not evidence of
production benefit.

## The shared substantive mistake

In MD-02, both reviewers adopted the newly validated tree. It improved predictive
log loss and the shared static forecast suggested **+$58.39**. In the real
seven-day simulator replay, merchant contribution instead fell from **$447.31**
under KEEP_CURRENT to **$420.56** under model adoption: **−$26.75**. Its paired
replay interval was roughly **−$42.17 to −$11.34**.

Coupon execution traces carry `DECISION-MD-02-RECENT` and actual customer,
merchant, coupon and day identifiers. The selected model really changed coupon
execution; this was not a prose-only recommendation or a hand-assigned payoff.

The result exposes a shared limitation: better prediction loss and a static
forecast did not establish better campaign outcomes under budget, contact and
cross-merchant constraints. It does not establish which omitted mechanism caused
the full loss. That requires a separate, controlled ablation; no post-outcome
rules or recommendations were changed here.

## Formatting mistake caught by the interface

The assistant's first submission contained two references to `constraints` as an
evidence ID. That field is top-level, so the contract rejected the batch. The
attempt is retained in [validation.json](validation.json). Only those references
were removed; every recommendation and rationale stayed unchanged, and the
correction happened before scoring. Thus the trial has **one rejected submission
batch**, in addition to **one material economic harm signal for each approach**.
Both had zero executed budget/contact/holdout/stock/margin violations.

## Scope and limitations

- This is a first, developer-assisted decision review. The assistant knew the
  simulator and baseline code. It was not independently blinded, and it did not
  adaptively collect evidence or coordinate multiple autonomous agents.
- Complete public evidence, forecasts and candidate models were identical.
  Sealed hashes still match after evaluation. No recommendations were retuned.
- The historical offer table groups executed discounts after margin and stock
  checks. Those groups should not be read as unbiased randomized treatment-effect
  estimates. A future evaluation should log the original randomized assignment
  separately from whether an offer was actually issued.
- The pricing table is a sensitivity analysis, not an invoice. No new paid API
  calls were made. Current-chat account charges, token consumption, development
  effort, maintenance and electricity were not measured.
- The first action menu is intentionally narrow. Several choices were equivalent
  once existing guards and shared-budget limits applied. This is evidence about
  this decision interface, not every possible use of an LLM.

Keep the strong conventional workflow for now. Before considering paid agents,
improve and independently validate the shared campaign-value evaluation. The
next evaluation must use new cases; these revealed cases are development data.
