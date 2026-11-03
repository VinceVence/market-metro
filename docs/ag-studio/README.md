# Market Metro + AG Studio

Implemented October 26, 2026. This is the current sponsor transition. The town remains the visual economy; AG Studio is the agent-created review workspace over its warehouse.

**October 30 update:** [Game-office UI and handoff evaluation](office-evaluation.md) — themed charts and office sprites, exact metric references, public operating context, deterministic evidence-view coverage, and three fresh Gemini review trials with a documented correction round. All costs and initial interpretation failures are retained.

## Run the demo

```sh
npm ci
npm run demo:owned
npm run dev
```

Open `/behavior-lab.html`. It starts at Day 1. Advance the timeline to Day 60 and click **AG Studio**. The link carries the run and observation cutoff. The Studio page can also open directly at `/studio.html` (default Day 60).

**Ask the analyst → Review campaign performance** runs one Gemini analyst call, followed by one Gemini designer call. Studio's own Agent Framework performs the `delegate_to` handoff and `complete_task` return. The toolbar supports editable native layouts, undo and save. The expandable decision record and exact JSON checkpoints remain available after reload. Loading a dashboard or changing days does not call a model.

The checked-in campaign approval allows local regeneration without GCP. The active ranker uses JavaScript counts/affinities, fitted afresh on each run. Older scikit-learn workflows still need their separately documented Python environment. To ask Studio a new question, the existing isolated Vertex configuration under `.local/gcp/` must be present; missing credentials produce a saved failure rather than silently using a scripted answer.

## Implemented flow

1. **Authored economy:** 16 fictional products, 3 merchants, seeded shoppers, observed purchases, contact costs and delayed returns. No Channel3 API call or imported product attribute enters V4.
2. **Campaign workflow:** a fresh Gemini campaign scientist and reviewer chose `personalized` from day-30 observed evidence. Deterministic workers execute that recorded program and fit/validate local rankers every 14 campaign days. Replays do not pretend these are new LLM decisions.
3. **Warehouse snapshot tool:** reads one `GARDEN-OWN-*` run through the selected day. It excludes future simulated refunds, private shopper needs/preferences, lifecycle truth, outside spending and comparison-branch outcomes. It hashes the complete permitted evidence.
4. **Studio analyst:** chooses a focus and tentative hypothesis from compact checked facts. It does not receive unrestricted SQL, all historical project files, credentials, or payment tools.
5. **Studio designer:** independently chooses 3–6 widgets from a fixed catalogue. The native framework carries the completed analyst checkpoint to the designer.
6. **Trusted application tool:** validates the proposal's snapshot, compiles AG Studio state, verifies that the SDK accepted every widget, saves an immutable layout version and rolls back on a save failure. It cannot edit economic records or make PayPal payments.
7. **PayPal evidence widget:** shows native capture counts for that exact run. Modeled fees and simulated orders are separate. The current authored run has zero native captures; previously verified receipts belong to their explicitly labeled older runs. Existing saved-wallet integration remains available in the main warehouse UI.

The actual dependency is `ag-studio@3.0.0`, including AG Grid Enterprise and AG Charts Enterprise. This is not a hand-built table wearing a sponsor logo. The vanilla JavaScript distribution avoids a town/React rewrite.

## Verified local result

Run `GARDEN-OWN-80d2f837a852e71c`, seed 150001, preference shift:

| Item | Recorded result |
| --- | --- |
| Generated orders, including shared warmup | 1,328 |
| Locally fitted ranker versions | 8 |
| Day-60 snapshot | 339 orders, 3 model fits, $23,402 retained simulated sales |
| Fresh Studio analyst choice | Inspect merchant sales balance, refunds and outreach efficiency |
| Designer output | Sales KPI, merchant comparison, refunds, campaign costs, PayPal evidence, model validation |
| Native PayPal payments created during transition | 0 |

The saved campaign program had 1,191 post-history purchases, versus 1,138 for strong rules and 1,027 with no campaign. Modeled platform contribution after campaign model cost was **$156.00 above no campaign** and **$34.13 above strong rules**. These are one-seed simulator outcomes, not measured real PayPal profit or evidence that LLMs generally outperform rules. The historical V3 48-market results do not transfer to this catalog.

Provider-token costs recorded in the spend ledger:

| Work | USD |
| --- | ---: |
| Fresh authored-catalog campaign planner and reviewer | 0.022338 |
| Studio analyst | 0.001188 |
| Studio designer | 0.001401 |
| This transition total | **0.024927** |
| Existing lifetime ledger after this transition | **2.771954** |

These are metered-token cost calculations, not a reconciled GCP billing statement. Each Studio pair shares one $0.25 reservation envelope. Existing stricter lifetime spend guards remain below the user's $50 ceiling. No APAC resources were changed.

## Validation and recovery

`npm run test:studio` covers provenance rejection, the zero-response economic control, hidden-data and chronological boundaries, shared evidence/budget identity, idempotency, concurrent duplicate suppression, saved failures, invalid widget rejection, stale evidence and unchanged transaction tables. Additional market, saved-wallet and PayPal tests check existing payment boundaries. Tests inject a fake provider and spend nothing.

Browser verification exercised the real native analyst-to-designer handoff, SDK widget application, persisted state across reload, and Day 30 → Day 60 switching. A readiness bug discovered in that check was fixed: initial layout persistence now waits for Studio initialization instead of saving its empty bootstrap state.

Checkpoints live in `studio_agent_steps`, `studio_reports` and `studio_report_versions` in the local SQLite database. The browser uses the same-origin `/api/market/studio/*` routes. Failed/uncertain model attempts never automatically retry with a new bill; inspect their records first. Unknown designer widgets are rejected. Snapshot mismatches block application.

The agent runtime has two LLM stages with deterministic ordering and bounded tools. It is a practical multi-role workflow, not an unconstrained autonomous swarm. Studio agents build evidence views; they do not themselves publish campaigns. The economy's recorded campaign plan remains a separate upstream workflow.

## License and submission boundary

AG's [JavaScript installation documentation](https://www.ag-grid.com/studio/javascript/installation/) permits local evaluation without a license key; vendor watermark/warnings remain intact. Hosted judging or use beyond the evaluation terms needs a suitable trial/commercial license. Obtain that before publishing; do not bypass the license check. Our repository's MIT license does not relicense AG's proprietary dependency.

The sponsor focus is real Studio customization and its [Agent Framework](https://www.ag-grid.com/studio/javascript/ai-agents/): native grids/charts, our custom payment-evidence widget, the theme, saved layouts and actual delegation. See [custom runners](https://www.ag-grid.com/studio/javascript/ai-custom-runner/) and the [sponsor brief](https://paypalaihackathon.devpost.com/details/ag-grid).

Remaining work for a submission: appropriate evaluation license coverage, judge-ready hosted setup, broader validation on the new catalog if making performance claims, and an explicit demo of a newly selected native sandbox receipt if needed. The transition does not relabel old receipts or old benchmarks as new evidence.
