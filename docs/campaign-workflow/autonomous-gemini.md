# App-owned Gemini campaign planner

The existing Market Metro UI now offers **New season → Workflow → Gemini 3.1
Flash-Lite**. The local server owns the loop; this chat does not select its steps.
The campaign room shows model attribution, status, metered-token cost, decisions
and shopper traces. Pause/resume controls preserve the same workflow and budget.

## Execution

1. Create a mission using the existing population, seed, objective and virtual
   coupon-budget fields. Autonomous campaigns last at most fourteen live days
   after twenty-eight learning days, followed by two delivery/refund days.
2. Send the current phase, permitted tools and compact observed evidence to
   `gemini-3.1-flash-lite` in `supply-yard-pilot-261021`.
3. Save the model proposal, structured arguments, public rationale and provider
   token receipt before executing any action.
4. Validate the action and evidence references through the existing workflow.
   Run local analysis/training, guarded coupons or the delegated sandbox sample.
5. Save the resulting checkpoint and let the model choose the next action.

The coordinator is one hosted model. Simulation workers, numerical model fitting,
coupon eligibility, margin checks, payment reconciliation and model-promotion
rules are ordinary code. Shop names and product listings are untrusted data.
Private shopper traits, future outcomes, account secrets and wallet tokens do not
enter the prompt. No external search or arbitrary code execution is exposed.

## Spending and configuration

The existing ignored `.local/gcp/config.json` and authorized ADC are reused by
`scripts/vertex-token.py`. Tokens are refreshed in memory. This does not deploy
cloud resources or change APAC configuration, files, credentials or billing.

The runner verifies the existing project-specific $10 monthly native Vertex cap
before inference, then acquires the shared `.local/gcp/model-spend.json` writer
lock. Historical receipts are never reset or repriced. The new `flash_lite`
profile keeps the existing $8 cumulative application limit and adds a **$0.25
per-campaign** limit with the workflow ID as stable spending identity.

Each request reserves $0.03 before sending. This exceeds the text-only envelope
at pinned prices: at most 32,768 serialized request bytes, 2,048 generated tokens,
one candidate and minimal thinking. Usage includes returned thinking tokens;
cache discounts are conservatively ignored. A request is refused if its full
reservation would exceed either cap. Up to thirty-two provider attempts and two
local training requests are permitted per campaign, including failed attempts.
No automatic model upgrade occurs.

Prices pinned on October 23, 2026: $0.25 per million text input tokens and $1.50
per million output/thinking tokens. The price pin expires November 12, 2026.
Cost displayed in the app is provider token usage multiplied by these prices,
not a final Cloud Billing invoice. Local hardware cost is not priced as zero.
Native enforcement can lag, so the local reservation gate is still required.

## Recovery

`planner_sessions` stores status and the fixed allowance; `planner_turns` stores
the prompt, proposal, action and token receipt. A saved proposal is executed or
replayed before any new model request. Tool request IDs, revision hashes and
existing transactional checkpoints prevent duplicate day effects.

Invalid output gets one bounded repair. Two consecutive invalid decisions, a
provider rejection, unknown provider outcome, expired pricing or a spend limit
pause execution. Unknown in-flight inference is never blindly repeated. Do not
delete the ledger or its lock to bypass a stopped session.

The server resumes sessions that were marked running on startup. A graceful
server stop pauses them; use the campaign room's **Resume planner** control to
continue. The server and this machine must remain running during execution.

## First live run

Workflow `WF-3841a3b9de44d863`, seed 314, 300 shoppers, $300 virtual coupon budget,
rival-sale scenario and **zero new PayPal samples**. The existing receipts stay
with their original runs.

The initial argument-string interface returned numeric windows as strings on
two calls. Both failed attempts and their charges remain in the same run. The
interface was repaired to use native function calling with required typed arguments;
the workflow was resumed without changing its model, dollar cap, seed or history.
A later unchanged-day analysis loop hit the input-size guard. Recovery added a
two-analysis-per-observed-day limit, concise evidence packets and read-only coupon
exclusion counts. The internal attempt allowance increased from 20 to 32 while
the $0.25 spending cap and every earlier charge remained unchanged.
This is an integration pilot with a disclosed developer repair, not a clean
unattended reliability benchmark.

## Measured result

The run completed with 27 completed tool checkpoints, two retained failed tool
checkpoints, and 30 planner turns (26 executed proposals and four failed turns).
Twenty-nine actual model calls used 208,511 input tokens, 3,910 output tokens and
zero reported thinking tokens. Including every failed and repeated call, the
ledger charge estimate is **$0.058004** against the **$0.25** cap. The previous 233
ledger entries are byte-for-value unchanged; cumulative estimated spending is
$0.737696, with no pending charges. Replaying completion or resuming a completed
run produced no new inference calls.

Gemini chose four merchants, 10% offers, a seven-day recency floor and a $5 modeled
gain floor. It trained the initial logistic/tree candidates, then requested one
logistic challenger after observing the rival-sale shock. That challenger's loss
was 0.1759629 vs the incumbent's 0.1766564, an improvement below the existing 0.001
promotion gate. Gemini retained the original model and campaign.

| Campaign-window measure | Gemini campaign | Earlier scripted campaign |
| --- | ---: | ---: |
| Purchases | 215 | 222 |
| Coupons issued / redeemed | 19 / 5 | 74 / 17 |
| Virtual discounts + outreach | $65.28 | $69.78 |
| Modeled merchant contribution, before API cost | $6,833.16 | $6,810.49 |
| Baseline-active treatment shoppers who purchased | 76 / 125 | 79 / 125 |

This single-seed result has fewer repeat buyers under Gemini, despite $22.67 more
modeled contribution. Retention difference versus its randomized holdout was
12.8 percentage points, with an approximate interval of -3.5 to +29.1 points.
Neither retention benefit nor general planner superiority is established.

The model's copy incorrectly described a coupon as valid for fourteen days,
although execution enforces same-day expiry. Some rationales implied that the
fixed model learns between fits, and described the outcome as effective without
supporting causal evidence. These are recorded quality failures; a semantic copy
and claim check is still needed. The paid first run was completed only after the
disclosed developer repairs and resumes, so it is not a clean unattended pass.

[Full decisions, token receipts, outcomes and verification](autonomous-gemini-result.json).

Sources: [model](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-1-flash-lite),
[pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing),
[thinking controls](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/start/get-started-with-gemini-3).
