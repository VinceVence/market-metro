# Autonomous commerce policy lab — POC scope

Approved direction: Avenue 1, 24 October 2026. Whole-hackathon spend ceiling: USD50, cumulative, not an instruction to spend it.

## Decision

Where should a PayPal-like platform allocate a limited joint promotional budget when merchants compete for the same buyers? Measure ecosystem outcomes and merchant economics instead of counting each attributed purchase as new business.

## First working slice

- Three fictional merchants carrying overlapping products from our cached Channel3 catalog; 100 seeded shoppers; 100 shopping days plus a 14-day outcome tail.
- The 14-day return window is an explicit POC assumption, not PayPal policy. No new shopping during the tail. Real-world deployment needs a validated outcome horizon; the research memo illustrated 30 days.
- First30 days collect randomized, logged actions. Day30,55,80 agent reviews use only observations available at their cutoff. Shopping continues while agents analyze.
- Three actual Gemini reasoning roles: growth investigator, experiment/learning scientist, outcome reviewer. They have separate prompts, bounded tools and checkpoint records. Three merchant policy actors independently compute acceptable offers using their own economics and stock. These merchant actors are numerical policies, not additional LLMs.
- A local contextual linear bandit learns from mature outcomes. A competent rules coordinator uses the same learner. A no-campaign world supplies an organic comparison. Initial state and exogenous draws match; subsequent orders may differ because actions change behavior.
- Actions: no outreach, full-price product recommendation, or bounded5%/10% offers. Discounts are modeled as80% merchant-funded and20% platform-funded, with reimbursements recorded separately. Integer-cent budget checks, merchant margin floors, stock limits and contact limits are enforced by code.
- Selected actual PayPal sandbox receipts map to emulator orders and are evidence for the reviewer. They never double simulated volume. No live charges, transaction-graph access, PayPal Rewards control or actual merchant onboarding is implied.

## Agent contract

Growth chooses which evidence to investigate and forms a hypothesis. The scientist chooses audience, admissible actions, exploration and training window. The reviewer can approve, narrow or reject the plan using independent financial and model evidence. Model fitting and deployment are separate checkpoints. Rejected or uncertain outputs do not become campaigns. Failed inference does not silently become scripted planning.

## Budget

Existing model ledger at scoping: USD0.859695, token-based accounting, not a billing invoice. Preserve its history. Keep the current USD8 local model cap, USD10 native Vertex monthly cap and USD0.25 per-run cap; all are below the new USD50 ceiling. No new cloud resources, GPU training, paid Channel3 refreshes or APAC changes. A future cap increase is unnecessary for this slice. Display recorded lifetime usage and the USD50 ceiling, distinguishing provider-estimated charges from unknown external expenses.

## Acceptance

1. A seeded run reaches100 shopping days and the14-day tail; all three branches reconcile and reproduce locally.
2. Real reasoning roles choose investigations and policies, with input/output evidence and provider usage saved.
3. Model artifacts are fitted on mature, past observations; no hidden traits, futures or control-world outcomes enter agent/model packets.
4. Merchant objections affect eligible actions; hard constraints hold regardless of model output.
5. The warehouse joins customer→action→campaign/model→order→transaction→refund→native receipt.
6. Same-learner rules and no-campaign branches appear side by side. A mesh loss or inconclusive result is reported honestly.
7. Desktop/mobile Policy Lab supports setup, day-by-day progress, agent office, customer trace, receipts, pause/resume, checkpoint inspection and exports. A local CLI replays the saved policy times and model artifacts without model/payment calls.
8. Tests cover temporal leakage, delayed rewards, budgets, deterministic replay, private-state boundaries, duplicate effects and provider failure. Run one bounded native/model demonstration and record actual costs and limitations.

## Deferred until evidence warrants it

Sequential RL, learned merchant opponents, harness self-editing, Jev routing, actual marketplace rollout and additional infrastructure. First profile and compare a small sequential learner locally; keep it only if delayed dynamics justify it. Winning a prize is an aspiration, not an acceptance test we control.

## Verified implementation

The first trial captured one native sandbox sample but stopped the agent team on an invalid plan. The corrected trial completed100 shopping days and14 follow-up days with3 fitted models,3 publications and12 total Gemini attempts, including bounded corrections and final outcome review. Its model estimate is USD0.008447; cumulative recorded model usage is USD0.869186. Both attempts and their errors are retained.

Automatic approval review rejected a second sandbox payment because the prior authorization covered one sample. Corrected runs default to no new native sample and can inspect the prior receipt as an explicitly labeled integration reference. No receipt is copied into a new run's orders or revenue.

The team did not outperform the controls in this seed. The final reviewer recommended stopping outreach. This verifies an autonomous experiment workflow, not marketing superiority or a winning-result guarantee. See the [trial report](runs/GARDEN-LAB-df43cd08499c0c0a/summary.md).
