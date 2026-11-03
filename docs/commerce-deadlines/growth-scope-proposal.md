# Approved scope: reaching additional qualified demand

**Approved by the user on November 1, 2026: “Add the separate customer-growth scenario.” Implemented separately in `scripts/commerce-growth/`, with a frozen contract and matched baseline results in `docs/commerce-growth/`. The 2× goal remains unmet.**

The current deadline case allocates requests already submitted to the market. Its conservative financial ceiling is1.576× the strongest fixed workflow under the registered safeguards. More model calls cannot make that case pass its2× gate.

The approved continuation returns to the original marketing purpose: reach qualified customers through consented outreach. The implemented first version reveals needs from a finite pre-generated pool. It does not create new repeat-purchase needs or change shopper funding. The earlier proposal and its pre-implementation audits are retained below for provenance.

## Proposed mechanism

Pre-generate a finite opportunity pool independently of every policy. It would contain household needs currently directed outside the platform, their timing, acceptable products and budgets. Outreach may reveal an existing opportunity; it may not invent a purchase, add money, override consent or exceed the household's existing funded capacity. Any repeat-purchase action would require explicit simulated consent and a genuine eligible consumption need. It would not create arbitrary recurring purchases of durable goods.

Participation/response and opportunity availability would be authored assumptions, clearly labelled and fixed before testing. Include zero-response, low-response and already-well-served controls. Do not introduce an agent-name bonus, weaken a fixed policy, select favorable seeds, drop failed cases or adjust response parameters after seeing test results.

Every comparator gets the same audience, budgets, observations, outreach options, price/stock data and payment tools. Include budget-aware targeted fixed rules, a competent local numerical/learning controller, one LLM planner and the specialist workflow. Preserve all earlier versions as separate evidence.

## Stop-before-spend gates

1. Freeze the opportunity, funding and action contract before policy development.
2. Calculate an optimistic financial ceiling. If it is below2×, do not spend on LLM trials.
3. Demonstrate feasible headroom using a planner that only sees allowed observations. An oracle bound alone is not sufficient.
4. Only then test fresh agent decisions, with matching budgets and independent markets. Preserve each merchant's contribution and report customer outcomes, costs and failures.

This proposal does not guarantee2×, actual PayPal ROI or a hackathon win. It gives the agents a revenue-producing action outside rearranging the existing funded queue. Alternatively, the user may explicitly pause the2× search and review the existing working workflow.

## Funding audit completed before any implementation

The evaluator-only audit in `reachability-envelope-1/` retains the existing total household funds, product-price envelopes, maximum purchase count and financial safeguards. It optimistically relaxes which household can satisfy each need and when its funds are available, as well as inventory, transport and merchant-financing constraints. This is a necessary opportunity envelope, **not permission to pool buyer money or a claim that those purchases have consent**. It does not modify the simulator or expose future information to an actor.

| Proposal envelope | Ceiling / old fixed | Largest new fixed mean compatible with 2× |
|---|---:|---:|
| Reach existing household funds at posted prices | 2.175× | $1,351.85 |
| Same, with bounded price flexibility | 2.286× | $1,421.02 |

The existing fixed mean is $1,243.07. At posted prices, only an 8.75% increase in the new fixed comparator would exhaust this optimistic headroom. With price flexibility, the threshold is 14.32%. These thresholds depend on keeping the same household-resource envelope, purchase-count limit and original counterparty floors/inventory cap. A different growth contract needs its own bound.

This is not evidence of a 2× architecture. A revised fixed workflow receives all new discovery, outreach and pricing actions. It may capture most or all of the apparent opportunity. Independently checked dual certificates establish the saved relaxation ceilings; they do not establish feasible real-world or simulated policies. No LLM or native payment calls were made.

## Concrete architecture to test if the scope is accepted

Use a **budgeted discovery team with shared execution tools**. The discovery role decides which existing need is worth investigating; the demand role chooses which observed signals support a forecast; the commerce role proposes a feasible offer; and the settlement/supply role coordinates inventory and payment timing. The verifier owns the publication gate. Do not let every specialist call a model on every shopper or day.

Each proposal must identify an observed evidence packet, a specific tool check, the decision that check may change, and a maximum contact/search cost. The coordinator can stop when another check cannot plausibly change the action. Hypothetical future forecasts remain separate from actual customer consent, cash and inventory. The rolling-horizon tool already implemented in `horizon.mjs` can execute an approved contract; it cannot create demand or waive constraints.

The opportunity pool must be finite and fixed independently of policy. A need can become known through an ordinary visit, a shopper's response or an eligible consented reminder. Contact cannot invent money, purchase intent, a deadline extension or permission to charge. The same parser, recommendation models, typed actions, contact limits and observed histories must be available to every comparator. Strong fixed rules should include budget-aware prioritization, recency/frequency targeting and stock-aware suppression; a local learned policy must also be measured.

Before paid agents run, first measure those new baselines. If their contribution passes the applicable $1,351.85/$1,421.02 ceiling threshold, stop the 2× experiment under this contract. If they do not, a feasible observed-only numerical policy still has to demonstrate sufficient headroom while preserving each counterparty. Only then is a matched single-agent/team trial justified. A larger optimistic bound is not enough to authorize model spending.

The customer-growth behavior is now implemented as a separate version. Its exact contract differs from the earlier opportunity envelope, so its new audited ceiling and rebuilt baselines govern advancement. The original deadline world, original baselines and all negative results remain unchanged.
