# Customer-growth scenario

Approved November 1, 2026. The separate version is implemented and locally evaluated. **The 2× agent-performance target is still unproven.** Existing deadline, commerce and campaign engines and their results remain available.

## What the environment does

It generates a finite pool of household needs before any policy acts. Needs have an owner, arrival date, acceptable products, quantity, budget and delivery deadline. Some are submitted to the marketplace naturally. Others remain outside it until a shopper responds to permitted outreach. An undiscovered need can eventually be purchased outside the platform using that shopper's own funds, or expire unfunded.

Every strategy receives the same opportunity pool, consent schedule, initial wallets, income, household expenses, products and fulfillment rules. The extension does not create extra shopper money, move money between shoppers, force responses or manufacture recurring demand. All needs are naturally visible during the common 30-day warmup; the different discovery regimes begin afterward.

Contact requires current marketing consent. It costs 5 modeled cents, paid from existing platform cash, with a ten-contact daily limit, seven-day per-customer gap and $50 modeled campaign budget. These are declared simulation assumptions, **not API charges or measured PayPal customer behavior**. A response reveals a conditional request; its budget is separately authorized from existing buyer funds. Inventory, merchant margins and delivery feasibility still gate the purchase. Contact itself is never counted as revenue.

The seven equally weighted regimes include ordinary demand, discovery, reactivation, changing preferences, low response, zero response and an already-well-served market. All response/signal parameters are authored and uncalibrated. Exact values were saved in `contract.json` before the development benchmark.

The kernel is a versioned copy of the original ledger/fulfillment code with request-admission hooks. The original engine is unchanged. Source hashes and snapshots are stored with the benchmark so later controller work cannot silently change this economy.

## Actual comparisons

All 42 runs completed with identical initial states, opportunity and consent hashes, and income within each market. No unpaid liabilities remained after the 26-day clearing tail. The comparisons use fixed-fast fulfillment in common, isolating outreach selection.

| Mean per market | No outreach | Strongest tested fixed | Local response learner |
|---|---:|---:|---:|
| Modeled platform net | $483.15 | $604.05 | $510.39 |
| Retailer contribution | $5,785.29 | $7,268.92 | $6,148.68 |
| Exact recommended item purchases | 0 | 15.86 | 1.57 |
| Outreach cost | $0 | $7.34 | $3.71 |

Stock-aware recommendations improved modeled platform contribution by **25.0% over no outreach**. That is fixed-workflow evidence, not a multi-agent win. The local learner reached only **0.845× the strongest fixed result** and failed the promotion gates. It predicts funded contact responses using contextual Beta-Bernoulli counts; it is not an LLM or a causal uplift model. Sparse priors and cold-customer targeting performed poorly in this first version.

There were no fresh LLM calls, native PayPal calls or held-out test openings. This stage did not spend additional cloud money. Attributed recommendation purchases are tracked separately from aggregate paired policy differences; an attributed purchase is not by itself proof of individual causal lift.

## One recorded customer

In the discovery case, `BUYER-0015` consented to a 5-cent modeled outreach contact on day 30. The response revealed a pre-existing furniture-and-stationery need with a $234.97 declared budget. Only $173.64 was actually available to authorize.

The ordinary commerce tools assembled a $159 basket within those funds, captured it on day 31, returned the unused authorization and delivered on day 32, before the day-37 deadline. The modeled retail fee was $6.04 and processing expense $2.11. This is a local simulated receipt; no native Sandbox capture was made. `development-1/example.json` includes the observed decision, response, authorization, selected basket, delivery and ledger entries.

## Financial headroom and the next gate

The new consent/response-aware optimistic ceiling is **2.360× the rebuilt fixed reference** under this exact cohort, action interface and retained safeguards. A separate arithmetic verifier checks the dual certificate, and the actual fixed trajectories fit the relaxation. The evaluator has private future knowledge and relaxes operational constraints, so this number is **not an achieved policy score**.

A separate diagnostic using hidden current needs and response outcomes, while retaining the ordinary fixed fulfillment workflow, earned **1.289× fixed**. It is neither deployable nor an upper bound. It indicates that contact selection alone has not demonstrated the required headroom. This private information is never supplied to the application controller or an LLM.

The next legitimate task is to improve an observed-only controller and its coordination with fulfillment while keeping this engine frozen. A new candidate must preserve retailer and supplier contribution and demonstrate sufficient economic headroom before fresh agent spending. Additional strong fulfillment comparisons and untouched markets are required before any 2× claim. The full target is unchanged; this environment is not a substitute for proving it.

## Reproduce and inspect

```sh
node --test tests/commerce-growth.test.mjs
node scripts/commerce-growth/benchmark.mjs
node scripts/commerce-growth/prepare-bound.mjs
.local/marketing-venv/bin/python scripts/commerce-deadlines/financial-bound.py --root docs/commerce-growth/headroom-bound-1
python3 scripts/commerce-deadlines/verify-certificate.py docs/commerce-growth/headroom-bound-1
```

Benchmark and bound preparation refuse to overwrite existing experiment directories. The saved source snapshots are the reproduction record; use a fresh checkout/output namespace for reruns rather than deleting prior evidence.

The preserved Performance UI exposes **Customer growth · separate scenario**, its comparative figure, per-regime results and customer trace. The data download contains only observed traces and aggregate evaluation results; private future-need and response artifacts stay in the evaluator directory.

The implementation follows the completed Hyperresearch design in `research/notes/final_report_commerce-net-headroom-0335d1.md`: common tools, bounded actions, checkpointed execution, retained failures and matched baselines. This is not a new literature-review or global novelty claim.
