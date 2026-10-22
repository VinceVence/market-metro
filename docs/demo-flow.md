# Aftershock: the first demo flow

**Earlier prototype:** this is the original authorization-based walkthrough, retained at `/lab.html`. The current homepage is [Harbor Town](harbor-town.md), with merchant sprites, evidence-seeking investigators and an already-captured $1,000 cohort that makes PayPal's refund exposure explicit.

The audience plays a PayPal merchant-reserve reviewer. The question is concrete: **should this merchant receive a capped $60 reduction of its existing minimum reserve after a supplier failure?** The tool may recommend release, keeping the reserve, or gathering more evidence.

The current runnable implementation is a local simulation with scripted agent traces. The following flow doubles as the storyboard for the real agent and Sandbox integration. No scripted text should be presented as a model's actual reasoning or a real PayPal response.

## Opening world

Merchant A sells four items at $80 each. The customer payments are already authorized, but none has been captured. The merchant has $100 available and a $200 minimum reserve from earlier simulated captured sales. Suppliers S1 and S2 serve the market; merchants B and C show the surrounding economy. The current engine executes Merchant A's case and honors B's reservation when present; it does not yet simulate a full endogenous market for B and C.

The original supplier fails. S2 offers four replacement units for a **non-splittable $160 upfront payment**. The offer promises arrival within two days, inside the original six-day customer promise. A $60 release would produce $160 available and leave $140 reserved.

Prior-sale refund obligations are authored as $80–$120 over a 30-day horizon. The demonstration rule requires the remaining reserve to cover the known upper bound plus a $20 cushion, with a maximum release of $60. **Those numbers are scenario design, not PayPal's policy or a loss estimate.**

## Seven stages

| Stage | What the viewer sees | Meaningful choice or action | Authority |
| --- | --- | --- | --- |
| Economy | Orders, merchant balances, suppliers | Understand the initial constraints | Deterministic environment |
| Shock | Original supplier cannot deliver | Merchant seeks an alternative supplier | Scripted merchant actor |
| Investigate | Quote, stock, promise, obligations | Choose evidence to check; resolve missing or inconsistent terms | Economic investigator roles; scripted today |
| Compare | Keep versus release, plus supplier-failure stress | Distinguish a financing constraint from a capacity constraint | Agent chooses experiments; code computes outcomes |
| Review | Evidence-linked recommendation and policy checks | Approve the bounded action or retain reserve | Simulated human reviewer |
| Execute | Current stock rechecked; local release/purchase; capture or void | Reject stale approval; permit only eligible operations | Deterministic gate; local payment simulator |
| Observe | Receipts, pending outcomes, separate logistics, open liabilities | Reconcile status and carry unresolved risk forward | Provider authority in target design; local fixtures today |

The first demo should visibly show an agent's **tool choice and evidence output**, not generated internal chain-of-thought. The real model implementation should log concise investigation summaries, citations, selected experiments, and uncertainty.

## A three-minute narration plan

| Time | Action | Narration |
| --- | --- | --- |
| 0:00–0:20 | Show the initial economy | “A reserve protects against losses. But what if it also prevents a viable merchant from fulfilling orders?” |
| 0:20–0:40 | Inject the failure | “Four authorized orders do not fund a replacement. This supplier needs $160 upfront; the merchant only has $100 available.” |
| 0:40–1:10 | Investigate; open traces | “The investigator checks the actual batch terms and current stock. The economist asks whether cash is the constraint. The challenger checks the obligations that the reserve still protects.” |
| 1:10–1:35 | Compare branches | “The same world can recover four orders with a $60 release if supply succeeds. But the reserve falls to $140, and a failed replacement can still waste the supplier payment.” |
| 1:35–1:55 | Try agent self-approval; then reviewer approval | “The agent cannot authorize itself. The reviewer owns the reserve decision, with the amount and evidence version attached.” |
| 1:55–2:20 | Execute with a pending capture; reconcile | “A pending payment is not completed money. In the final integration, PayPal's actual response determines the payment state.” |
| 2:20–2:45 | Show a stock-race replay or no-stock case | “If another merchant reserved the batch, money cannot fix the problem. The system must revise the recommendation and reject stale authority.” |
| 2:45–2:55 | End on architecture/value | “We are testing whether economic investigation improves reserve decisions and review effort while respecting payment authority.” |

For the current local demo, say “local payment fixture” aloud. Only change that narration after authenticated Sandbox operations and model tool traces have been verified. The final video must show the actual working build.

## Cases that prevent a guaranteed success story

| Case | Expected behavior in this prototype | What it tests |
| --- | --- | --- |
| Cash constrained, feasible supply | Recommend a reviewed $60 release under authored constraints | Financing mechanism |
| No replacement stock | Keep reserve; cancel uncaptured orders | Cash does not create stock |
| Already enough available cash | Keep reserve; purchase using existing cash | Avoid unnecessary intervention |
| Expired quote | Request more evidence; release unavailable | Evidence validity |
| Missing prior obligations | Request more evidence; release unavailable | Appropriate abstention |
| Another merchant reserved stock | Keep reserve; honor the reservation | Avoid displacement and double allocation |
| Upper prior exposure is $180 | Keep reserve; proposed release fails the protection floor | Benefit cannot override a financial constraint |

The reviewer can retain the reserve even in the favorable case. A separate action injects a stock race after approval. The execution attempt then invalidates the approval and returns to investigation without moving money.

## How the economy generates usable data

Each run records its scenario and policy version, observed quote terms, stock owner, balances, orders, scripted tool selections, comparison results, reviewer action, rejected actions, local receipt identities and final state. The JSON export carries the 30-day horizon, pending payments, still-open prior obligations, and newly captured orders that remain within the return window.

The engine does not forecast actual merchant behavior, run to the end of that 30-day window, or prove savings. It deliberately labels the terminal state incomplete for liability assessment. Production value requires representative data and a complete outcome horizon.

## Next live demonstration increment

1. Give an actual investigator conflicting quote documents and a tool to request current stock. Require citations to evidence IDs.
2. Let the economist choose a controlled experiment from an allowlist rather than returning a fixed script.
3. Have the challenger identify a deliberately withheld liability statement or changed reservation.
4. Keep numerical calculations and transaction authorization in deterministic server code.
5. Use owned Sandbox accounts for a real approved order and authorization, then capture/void/refund and reconcile actual provider state.

Supplier counterparties can be normal APIs or human-approved structured offers. The design does not require real merchants or suppliers to adopt their own AI agents.
