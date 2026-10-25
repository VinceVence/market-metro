# Integrated marketing agent team

[Open the completed pilot](http://127.0.0.1:4173/mesh.html?policyLab=GARDEN-LAB-81396892c0cc6928) · [Start a new team run](http://127.0.0.1:4173/mesh.html)

**Integration works; financial advantage is not demonstrated.** The fresh pilot completed 100 shopping days plus a 14-day outcome tail with ten actual Gemini requests and no workflow errors. It used two real local model fits and three campaign reviews. Sequential-RL research models are not used by this demo.

| Role | Actual responsibility |
| --- | --- |
| Growth investigator | Selects a warehouse evidence cut and proposes a falsifiable market hypothesis. |
| Experiment scientist | Chooses campaign type, audience, merchants, discount ceiling, training window, exploration and whether to refit. |
| Outcome reviewer | Independently approves, narrows or rejects the proposed settings using model and financial evidence. The proposer's persuasive rationale is excluded. |
| Code workers | Query observed data, fit local regressions, enforce budgets/margins/contact limits, persist checkpoints and compute outcomes. |

Channel3 supplied three real cached listings, copied into nine catalog rows across three simulated merchants. Purchases, inventory, costs and customers are simulated. The reviewer received a previously verified PayPal Sandbox reference, explicitly excluded from current sales. **No new native payment was issued.** Existing sandbox adapters remain available through the separate explicit sample control.

## Recorded handoffs

- Day 30: investigator chose `offer_response`; scientist proposed `mixed`, 10% ceiling, all audience; reviewer chose `narrow`; code published on day 40. 168 purchases occurred while the team worked.
- Day 55: investigator chose `offer_response`; scientist proposed `mixed`, 10% ceiling, all audience; reviewer chose `approve`; code published on day 64. 169 purchases occurred while the team worked.
- Day 80: investigator chose `offer_response`; scientist proposed `mixed`, 5% ceiling, all audience; reviewer chose `approve`; code published on day 88. 134 purchases occurred while the team worked.

At the first review, the reviewer changed the proposal from a 10% ceiling and 10% exploration to a 5% ceiling and 5% exploration. At day 80 the scientist reused the existing model. These were actual model outputs, not scripted decisions.

## Completed single-seed comparison

| Policy | Purchases | Coupons / redeemed | Recommendations | Modeled platform after inference | Difference vs no campaign |
| --- | ---: | ---: | ---: | ---: | ---: |
| mesh | 1206 | 372 / 35 | 528 | $1501.09 | $-18.71 |
| rules | 1201 | 197 / 23 | 324 | $1503.79 | $-16.01 |
| organic | 1193 | 0 / 0 | 0 | $1519.80 | $0.00 |

The team lost $2.70 versus the existing rules and $18.71 versus no campaign. The final reviewer recommended `stop_outreach`. It issued no new campaign or payment.

Model usage cost $0.01 when rounded to cents; the exact metered-token estimate is **$0.006599**, below the $0.25 run guard. This is not a billing invoice. All simulator accounting is unchanged; fees, processing, subsidy and return terms remain stated assumptions. Local compute is unpriced.

The live comparison shares initial seed, catalog and shocks. Each branch observes its own resulting history, and actual model latency affects publication. The existing rules remain frozen. This is an integration pilot, **not** the identical-evidence, strong-baseline multi-seed benchmark required for a general superiority claim.

## Concrete weaknesses retained in the record

- The day-55 investigator described 134 purchases versus 119 as a decline. That arithmetic claim is wrong.
- The first scientist talked about increasing Willow Goods' offer flexibility by changing the global ceiling. The merchant's own 5% cap remained enforced by code; a global 10% ceiling could not override it.
- The proposals relied on observed conversion/reward associations without demonstrating incremental platform profit. Prediction MSE did not establish campaign value.
- Publication occurred 8–10 simulated days after each evidence cutoff. The demo retains that latency rather than pretending an immediate decision.

The next refinement needs checked economic facts, appropriate counterfactual evidence and pre-publication evidence revalidation. More agents alone is not a demonstrated remedy.

## Implementation and checks

The adapter reuses the frozen three-role runner and adds after-inference economics, a truthful handoff view, a final promotion guard and serialized final review. Original benchmark sources remain unchanged. The separate RL and earlier LLM experiments remain archived.

[Verification](verification.json) · [Full decisions and outputs](pilot-result.json) · [Pilot protocol](pilot-protocol.json) · [UI checks](ui-validation.json)
