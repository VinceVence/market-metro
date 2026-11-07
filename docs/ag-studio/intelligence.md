# Commerce intelligence workspace

Open [the archived judge workspace](http://127.0.0.1:4173/analytics.html?run=recorded-demo). It uses the completed 384-merchant / 19,200-shopper run and needs no model credentials, native payment calls or private database. The source selector also opens current local warehouse runs. Archived and current records are labeled separately.

## Navigation tutorial

A first-visit tutorial explains the market, planner decisions, model checks, PayPal evidence and ontology. **Tutorial** or the **?** rail button reopens the guide. **Skip tour**, **Finish tour** and Escape dismiss it. The highlighted targets follow the selected view. It never starts a simulation, trains a model or executes a payment.

The bright Intelligence button in the left rail opens the workspace for the same selected run. **Agent & tools** is expanded by default in the market sidebar and can still be collapsed. The judge walkthrough pauses while its tutorial is open and resumes its previous playback state when the tutorial closes.

Use `/analytics.html?run=recorded-demo&tutorial=1` or `/judge.html?tutorial=1` to force the tutorial for a recording. The first-visit preference is stored locally in the browser.

## What the judge can inspect

| Sidebar | Native AG views and interaction |
|---|---|
| PayPal | Native Sandbox receipt example, selected-run capture count and modeled payment economics kept separate |
| Overview | Captured-volume line chart, category-spending bars and merchant grid |
| Market trends | Browsing/search trends, checkout counts and category demand |
| Net profits | Full-size fixed-versus-planner payment and merchant outcomes |
| Model training | Actual model fits, comparable recommendation-contact AUROC, log loss, training time and feature registry; older recommenders retain Recall@3 |
| Agent decisions | Day-31/day-61 review graph, stage filters, exact checkpoint selector, evidence dialog and AG Grid decision ledger |
| LLM observability | Provider models, input/output/thinking tokens, latency, per-call cost and status |
| Judges & verification | Local trial gains, failed checks and publication verdicts. The current harness has zero independent LLM judges |
| Lifecycle | Recorded order states, custom PayPal evidence widget and native receipt reconciliation |
| Merchant ontology | Interactive run-specific associations, verified checkout grain, merchant legs, models and features |

**Arrange** enables AG Studio's native layout editor. Review-stage controls filter the decision ledger; native grid headers sort records. **Export** downloads the source data for inspection. Layout edits are temporary when switching dashboards and never alter economic records.

The custom PayPal widget is registered with `agStudio.createWidgets`. Tables and charts use AG Studio's native grid/chart widgets. The decision and ontology graphs are application components connected to the same recorded run; they are not claimed as native AG Charts types.

## Accounting and evidence

The 384-store snapshot contains 44,772 checkout parents, 62,434 merchant-order portions, four local fits, twelve provider-backed LLM decisions, seven local campaign trials and fifty recorded gate checks. Activity totals include warmup. Final matched settlement results use the campaign accounting window and include AI cost. These scopes are deliberately labeled separately.

`intelligenceSnapshot` queries parent checkouts directly and aggregates merchant orders separately. It never joins an order total to multiple item rows when summing money. Models use recommendation-contact validation metrics where available; pooled AUROC is not silently compared with product-only AUROC. Missing metrics remain missing.

The largest run's native receipt count is zero. The separate 12-merchant judge run contains the archived $96 capture. Opening the dashboard does not create a new receipt or treat an old receipt as a new sale.

`demo/data/intelligence-demo.json` is an archived export from `GARDEN-AUTO-d8f8e3695c9118cb`, using the same adapter as live records. Its evidence links to `demo/data/metropolis-live-results.json`. Workspace paths in recorded tool outputs are replaced with `[workspace]/`. The export contains simulated records and existing model usage, with no provider credentials.

## Implementation

- [Read-only data adapter](../../scripts/studio/intelligence.mjs)
- [Dashboard and typed widget mappings](../../demo/studio/intelligence.mjs)
- [Dashboard layout](../../demo/analytics.html), [styles](../../demo/studio/intelligence.css)
- [Shared light controls](../../demo/light.css), [AG theme](../../demo/studio/theme.mjs)
- [Existing custom PayPal widget](../../demo/studio/widgets.mjs)
- [Interactive ontology and evidence inspector](../../demo/commerce/run-inspector.mjs)
- [Focused accounting/cohort regression](../../tests/intelligence.test.mjs)

The older analyst → designer → checked publication harness remains in [agents.mjs](../../demo/studio/agents.mjs) and `/reports.html`, with its original authored-run contract. The new Intelligence dashboard reads saved commerce decisions; it does not claim a new LLM chose its default dashboard layout. Connecting that AG Studio agent harness to the new run schema is a remaining sponsor-demo opportunity.

## Verification

Focused tests cover parent-checkout counting, immunity to repeated item rows, refund totals, model-cohort selection, provider costs and read-only execution. Existing Studio and ontology checks are retained. No new model calls or payments were made for the UI update.

The blue navigation sidebar is shared with the market and judge walkthrough. Judge launch links start recorded playback, with a visible progress indicator. The market renderer maps each 32-store district to local positions while preserving global merchant IDs and numbering. Previous/next controls and the searchable full-store directory reach every store through 384.
