# EDA, trends and grounded recommendations

The economic workflow now supports an analyst's investigation, not just model fitting or threshold selection. **The frozen customer economy, original v1 snapshot and published14-market result are unchanged.** These capabilities are available in the research workflow/CLI and its saved demo view; the existing live-market controller is not automatically replaced.

[Open the analysis demo](http://127.0.0.1:4173/studio.html?view=economic&economicView=analysis). The financial-confirmation tab still shows the original measured result. Replaying either tab makes no model or payment calls.

## The additional capabilities

| Tool | Work it performs | Planner decision |
|---|---|---|
| Inspect baseline | Reads the actual v1 program, model and campaign artifacts | Establish what a proposed change would alter |
| Explore market | EDA by category, merchant or current customer segment; revenue, purchases, interest, replies, mature outcomes, inventory and cash; missing/duplicate/future-row checks | Choose the question, dimension and7/14/28-day window |
| Analyze market trends | Compares equal windows using daily interested shoppers, searches, discovered needs and captured units; flags low counts, missing history and warmup boundaries | Interpret divergent interest and purchase trends |
| Build recommendations | Reuses the existing trained purchase/value model; supports latest interest, multiple recent interests, or bounded trend weighting; filters segment and category | Select an audience, product scope and ranking strategy |
| Recommendation reachability | On an empty shortlist, compares currently reachable positive-value opportunities across new, active and lapsed shoppers | Revise a hypothesis that cannot act now |
| Preview and historical trial | Binds the exact recommendation artifact to an expiring campaign; recalculates eligibility/ranking each day; measures a separate completed market | Test before queuing further research |

The LLM chooses questions and recipes. Local tools compute the statistics, forecasts, prediction scores, budget checks and payment accounting. No arbitrary SQL, generated code, new shopper funds or invented external economic indicators are available.

## Actual example

At day60, the planner inspected121 previous captures,316 observed interest signals and300 contacts. Its14-day EDA contained25 captures totaling$3,751. Current segment labels use observed purchase recency; they are not randomized or historical-at-contact cohorts.

Fresh Gemini calls selected customer-segment EDA, category EDA and a14-day trend comparison. Electronics captured units rose9→14 with roughly stable interest. Furniture interested shopper-days fell23→18. The initial planner selected active shoppers and Electronics, but that combination had **zero currently eligible positive-value recommendations**.

The initial campaign was still shadow-tested under the earlier harness. It activated onfive days in a different completed historical market, sentthree recommendations, receivedzero replies and generatedzero attributed retained purchases. Compared with v1, modeled PayPal net changed+$0.08 before AI, retailer contribution−$6.07, partner cash−$8.77 and retained retail volume−$12. The merchant safeguards rejected it. Those outcomes are retained; they do not validate the new approach.

A subsequent fresh Gemini recommendation revision received the same observed EDA/trends plus a trusted current-reachability table. It chose **multiple recent interests, lapsed shoppers, Stationery**:

| Shopper | Product | Interest age | Available stock | Purchase-model score | Predicted PayPal contribution |
|---|---|---:|---:|---:|---:|
| BUYER-0001 | Writing Pad Set | 7 days | 5 | 14.4% | $0.4972 |
| BUYER-0046 | Marker and Label Set | 6 days | 2 | 8.9% | $0.2891 |

Gemini's saved reason: “The previous active/Electronics recipe yielded no eligible shoppers. The opportunity table shows the lapsed segment has 2 reachable shoppers for Stationery using the multiple_interests mode, and trend analysis confirms Stationery has roughly stable interest, unlike Furniture which is falling.”

This revised shortlist is **read-only and financially untested**. Its scores are observational model predictions, not incremental sales or realized profit. It has not been sent to shoppers, promoted to the live controller, or counted in the prior14-seed result.

## Harness improvements and observed limitations

- Empty shortlists now return reachable alternatives. Current campaign preview rejects an empty recommendation artifact instead of allowing it to displace existing outreach.
- Recommendation recipes are bound to the snapshot, model hash and cited evidence. Other-market execution uses the recipe on that market's own observations, not copied customer IDs.
- Trend-aware recipes now explicitly carry a7/14/28-day window that must match a cited trend analysis. The archived first pilot used a7-day default after inspecting14-day trends; it is preserved as an earlier implementation. Current version6 binding was validated locally; it was not retroactively relabeled as the tested behavior.
- Observed signal history is exposed separately for EDA. The original bounded signal view and frozen economy remain intact. Future rows are excluded; absent merchant-level browsing attribution stays null rather than being invented.
- Mature purchase labels wait for the full26-day deadline/return horizon. Recent unresolved contacts are not labeled failures.
- Trend labels are descriptive. A1.25× interest ratio is not a significance test, latent-demand estimate or causal marketing effect. Sparse/incomplete comparisons get no trend weight.
- Existing consent, contact gaps, positive joint value, inventory/inbound and budget checks remain. Recommendation score improvements alone cannot pass the financial gate.

The first provider attempt returned an unsupported multi-tool response and cost$0.007962. The explicit one-tool contract corrected that. In the next run, four successful analysis calls were checkpointed before the request-size guard blocked an oversized context **without a provider request**. Exact tables were encoded as columns/values; the payload fell from27,258 to14,981 bytes. The same completed work and billing run resumed without repeating those calls or raising caps. Original source, failed checkpoint and the context-repair audit remain available.

The displayed workflow includes10 actual provider calls: nine in the resumed review and one recommendation revision. Its11 model attempts include the preflight-blocked attempt. No new forecast was fitted in this example: the existing local ranking model was reused. The demand-fit tool remains available when the planner needs it.

## Cost and verification

Completed review plus recommendation revision: **$0.142526**. Including the initial adapter failure: **$0.150488**. Recorded project model usage: **$4.868804/$50**. These are token-metered estimates, not billing invoices. No native PayPal calls, APAC changes or development subagents.

Focused checks cover future-row exclusion, aggregate reconciliation, sparse/truncated windows, multiple-interest candidate expansion, consent/budget constraints, evidence/recipe tampering, grounded trend windows, empty-cohort rejection, exact context packing, frozen-world identity and settled liabilities. The legacy controller parity check remains green.

```sh
# A new bounded analytical review, with at most$0.30 and12 model attempts.
npm run workflow:economic -- --run-llm --analysis --run-id my-analysis

# Recovery requires the same snapshot and source hashes.
npm run workflow:economic -- --run-llm --analysis --run-id my-analysis --resume

# One read-only recipe revision, only for a completed empty-shortlist run.
node scripts/commerce-growth/autonomy/revise-recommendation.mjs --run-llm my-analysis
```

Artifacts: [original analysis checkpoints](../economic-workflows/EDA-TRENDS-2/checkpoints.json), [context-repair audit](../economic-workflows/EDA-TRENDS-2/context-repair.json), [historical trial](../economic-workflows/EDA-TRENDS-2/historical-trial.json), [actual recommendation revision](../economic-workflows/EDA-TRENDS-2/recommendation-revision/decision.json), [initial adapter failure](../economic-workflows/EDA-TRENDS-1/summary.json).
