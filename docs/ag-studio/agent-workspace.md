# Agent Studio: query, verify, publish

[Open the deployed workspace](https://market-metro-fifm2aalgq-uc.a.run.app/agent-studio.html).

This is the current integration between the commerce planner, the merchant ontology and AG Studio's Agent Framework. It investigates the recorded 12-merchant market through day 126. The economy, campaigns, trained models and benchmark outcomes are unchanged.

## One working investigation

Question: **Which merchants deserve a closer look because refunds are eroding sales?**

1. A fresh Gemini commerce planner reads the selected merchant scope and the original campaign's model/decision context. It chose **Circuit Corner, The Bundle Shop and Paper Lane** for their high refunded shares of sales.
2. AG Studio's built-in **`execute_query`** runs a projection with a merchant-ID filter against its actual configured data engine. It returns the three selected rows.
3. Native **`delegate_to`** hands the investigation to the Insight editor. Its verification tool compares every returned field with the original source and reconciles checkout parents with merchant-order portions.
4. The ontology certifies **114 shopper checkouts across 125 merchant orders**. The cohort has **$12,838 gross sales, $1,408 refunds and $11,430 retained sales**. Retained sales are not merchant profit.
5. A second fresh Gemini decision chooses the insight facts and dashboard views. The deterministic publication gate restricts facts to computed evidence and adds required ledger, checkout-grain and PayPal-proof coverage.
6. **`publish_verified_views`** applies the checked state using AG Studio's API; **`complete_task`** returns the result to the planner. Five native views were published.

The two Gemini calls cost **$0.001530** by metered-token estimation. The native query, guard and publication tools make no model calls. [Complete saved trace](../../demo/data/studio-investigation-demo.json).

The PayPal card shows the existing **$96 Sandbox capture**, **$3.56 fee** and **$92.44 merchant proceeds**. It is whole-market integration evidence and adds no purchase to the selected cohort. The reference +$114.96 modeled PayPal gain at the top of the workspace belongs to the original matched campaign, not this new investigation.

## What is actually agentic

| Component | Real responsibility |
|---|---|
| Commerce planner — Gemini | Chooses the merchant cohort and analytical focus from the allowed scope and observed numbers. |
| Native Studio query tool | Executes the scoped query against the Studio data engine. |
| Ontology verifier — deterministic | Checks source identity, merchant scope, exact values, checkout grain and financial definitions. |
| Insight editor — Gemini | Chooses supported insight IDs and useful views after verification. |
| Publication guard — deterministic | Requires grounded facts and approved mappings; adds essential evidence coverage. |
| Studio publisher | Changes dashboard state and completes the native agent handoff. It cannot change transactions, campaigns or payments. |

The custom runners use `createAiHarness`, typed tools, native delegation and task completion. This is not a screenshot reader or a claim that Studio's default built-in agents independently made the decisions. The supplied facts, proposed views, guard additions and native tool calls remain inspectable.

## Judge path

- **Investigate & build views:** a new Gemini investigation under the shared budget.
- **Replay a verified investigation:** reuses the saved Gemini choices but executes the native Studio query, source verification and publication again. It spends no new model tokens.
- **Two possible links:** the existing merchant-feed verifier detects an ambiguous relationship and holds before any model call or dashboard publication.
- **Tool calls & checkpoints:** inspect the evidence or download the full native handoff trace.
- **Arrange / Framework conversation:** use native layout tools or inspect the framework conversation.

The initial charts are an overview of the recorded source. The verified views replace them only after the query and gate pass. Earlier campaign decisions and training remain available in Intelligence.

## Cost and execution controls

The feature has one durable **$0.25 allowance**, stored in a private Cloud Storage object. A generation precondition reserves $0.03 before each model call, so simultaneous instances cannot independently reuse the budget. Completed calls release unused reservation using metered usage; uncertain calls retain the full reservation and are not automatically retried. A separate limit of 64 calls bounds the feature lifetime. Re-deploying never resets the allowance.

The existing hackathon spend ledger and the native payment restrictions are unchanged. Runtime identity receives only model prediction/quota-use permissions and object access to the dedicated investigation bucket. No API key or service-account private key is shipped. Cloud hosting/storage costs are separate from the inference allowance.

To provision this feature in the existing isolated project, run `python3 scripts/deployment/cloud-run.py configure_agent` using the documented operator Python environment, then package, build and deploy. The `configure_agent` command uses a create-only precondition for the budget object and cannot reset existing usage.

## Implementation and verification

- [Native framework runners](../../demo/studio/investigation-harness.mjs)
- [Agent workspace](../../demo/studio/agent-workspace.mjs), [professional layout](../../demo/studio/agent-workspace.css)
- [Cohort, ontology and publication contract](../../scripts/studio/investigation.mjs)
- [Managed inference and durable allowance](../../scripts/studio/investigation-provider.mjs)
- [Focused tests](../../tests/studio-investigation.test.mjs): split baskets, tampered query rows, ambiguous mappings, grounded views, retry/idempotency, budget bounds and frozen source fingerprints.

The UI retains the vendor's evaluation notices. No license bypass or paid subscription was introduced.

Primary API reference: [AG Studio custom runners](https://www.ag-grid.com/studio/javascript/ai-custom-runner/). The implementation was also checked against the installed AG Studio 3.0.0 types and exercised in its browser runtime.
