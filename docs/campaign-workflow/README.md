# Checkpointed campaign workflow

A workflow can be owned by the assistant in the current chat, a disclosed scripted
demo, or the app-owned Gemini planner. Each submits structured tool requests with
rationale and checkpoint references.
The local Node server executes those requests, fits CPU models, enforces campaign
constraints and persists the result. The optional [autonomous Gemini runner](autonomous-gemini.md)
uses a shared spend ledger with a $0.25 per-campaign cap.

Open `/workflow.html` to inspect the completed campaign, its 19 checkpoints and
every shopper. Use the filters for redeemed coupons, coupons without purchases,
holdouts and native receipts. Every shopper has 14 campaign days plus two follow-up
days, including exclusions and model-estimated purchase probabilities. A selected
shopper links its coupon, order and native sandbox receipt where one was sampled.

## First completed run

- Workflow: `WF-26c901ed73bed8b1`; market: `GARDEN-WF-26c901ed73bed8b1`.
- 28 observed history days; 6,300 fitting rows and 2,100 later validation rows.
- Logistic regression log loss 0.2224; offer-rate baseline 0.2635; tree 0.2696.
- Five merchants selected after investigating prices, margins and observed response.
- 300 shoppers; 4,800 decision records; 74 coupons sent to 58 shoppers; 17 redemptions.
- 222 campaign-window purchases; $17,319.15 simulated sales and $6,810.49 modeled
  contribution. Discounts and outreach used $69.78 of the $300 virtual budget.
- Three native sandbox captures: $139.28 gross, $5.63 reported fees, $133.65 net.
  These are samples of existing orders and are not added to simulated sales.
- Baseline-active repeat-purchase difference +15.2 percentage points; approximate
  interval −1.0 to +31.4 points. Lift is inconclusive, and no individual purchase
  is claimed to have been caused by an offer.
- Zero new paid model calls, real-money charges or Channel3 searches. Cached
  Channel3 products were used; customer behavior, stock and commerce are synthetic.

[Full first-run evidence](first-run.json) records the actual plans, checkpoints,
market-change review, model outputs, evaluations and receipt lineage.

## Planner interface

The [rival-sale chat-planner trial](chat-planner-shock.md) records a later live
review with daily diagnostics, a bounded challenger fit and an evidence-based
decision to reject promotion. It preserves the original UI and scripted run.

- `POST /api/workflows`: create a bounded mission with a stable request ID.
- `GET /api/workflows/:id`: read context, revision/hash, checkpoints and tool catalog.
- `POST /api/workflows/:id/step`: submit `requestId`, `expectedRevision`,
  `contextHash`, `action`, `parameters`, `rationale`, `evidenceIds` and
  `actor: "assistant_in_current_chat"`.
- `GET /api/workflows/:id/customers`: every shopper's campaign summary.
- `GET /api/workflows/:id/trace?customer=...`: individual predictions, decisions,
  coupon exposure, visits, purchases, refunds and native receipt links.
- `GET /api/workflows/:id/export`: public workflow context, roster and warehouse.

Mutation requests use the same local-origin, JSON and `X-Supply-Yard: sandbox`
contract as existing simulation controls. Credentials and wallet tokens remain
server-side. No arbitrary Python, SQL or external tool execution is accepted.

Tools cover history, analysis, training, campaign drafting, launch, advance,
review, follow-up, native samples, evaluation and completion. Analysis selects
windows and approved cuts; training selects 14/21/28-day windows and logistic/tree
candidates. A trained candidate must pass validation before a campaign can use it.
The `daily` and `model_health` analysis cuts inspect completed days and saved
pre-action probabilities, and report rival-exposure coverage under the existing
seven-day validation split. They do not expose hidden simulator traits.
Model fitting does not silently replace an already active model. The planner can
keep that model or validate and launch a revised plan without extending the budget.

## Checkpoints and recovery

Completed requests return their saved results when replayed. Changing parameters
under the same request ID fails. Local day effects and checkpoint completion commit
in one SQLite transaction. An interrupted local fit can recompute before commit;
a completed fit is reused. The server serializes workflow mutations in one process.

A changed observed rival-promotion indicator stops a multi-day advance and requires
a planner review. In the first run, the assistant expanded an insufficient analysis
window, recognized only one day of post-change evidence and continued the bounded
campaign rather than fit an unstable replacement.

Native sample requests persist their selected order IDs. Existing PayPal
idempotency keys and provider readback handle payment recovery. Receipt retries
cannot choose replacement orders or alter amounts. Tests simulate a lost provider
response and recovery across restart without creating a second payment. The actual
completed training, day-advance, native-sample and completion checkpoints were also
replayed after restart with unchanged model count, day, outcomes and capture IDs.

Four tables extend the existing warehouse: `agent_workflows`, `agent_checkpoints`,
`campaign_plans` and `campaign_customer_decisions`. The warehouse now has 30 public
base tables and 11 views. Private simulator state and payment keys remain excluded
from exports. The previous decision-only benchmark remains historical evidence;
it did not test this end-to-end orchestration objective.

The `planner_sessions` and `planner_turns` tables add durable autonomous status, model proposals and metered provider receipts.
