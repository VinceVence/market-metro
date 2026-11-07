# Market Metro: Agentic Commerce That Learns

## Elevator pitch

An autonomous commerce planner that turns verified merchant data into trained models, tested campaigns and traceable PayPal payments.

## What it does

Market Metro is a commerce simulation and experimentation environment for merchant operations. Shoppers browse, respond to recommendations, submit requests, purchase and return goods. Merchants manage inventory and fulfillment. The resulting data gives an LLM planner a concrete business question and a measurable environment in which to test its answer.

The planner investigates demand, chooses training data and features, fits local prediction models, proposes campaigns and revises them after financial trials. A deterministic verifier publishes only an eligible tested model and campaign. The workflow records the inputs, model choices, evidence, trial results and publication decision.

An ontology-inspired layer connects business meanings to the available data. It distinguishes a shopper checkout from its merchant portions, binds declared relationships in unfamiliar feeds and holds ambiguous mappings. It also defines eligible training cases and which features are observable before contacting a shopper. General inquiries and product recommendations have different training requirements.

## PayPal integration

PayPal is the payment execution and reconciliation layer. The project has completed a native Sandbox capture for a selected simulated warehouse order. The recorded $96 capture has a $3.56 native fee and $92.44 in test merchant proceeds. Its custom ID matches the warehouse order.

In the economy, retained payment volume, modeled processing costs, refunds, outreach costs and settlement influence the campaign comparison. This lets the planner evaluate commercial outcomes beyond clicks. The native Sandbox transaction proves the integration, while the simulated payment layer supports reproducible comparisons. Sandbox uses test funds.

## Measured result

We ran fixed rules, a fresh Gemini planner and a fresh Gemini planner with ontology on the same frozen market of 600 shoppers and 12 merchants. Both planners received the same day-30 observations, six decisions and the same financial verifier. They made 12 fresh model calls in total. Campaigns ran through day 126 settlement.

| Policy | Modeled PayPal net after AI | Merchant contribution | Retained purchases |
|---|---:|---:|---:|
| Fixed rules | $3,309.83 | $38,928.95 | 627 |
| Fresh planner | $3,391.08 | $39,494.31 | 642 |
| Fresh planner with ontology | **$3,424.78** | **$39,953.81** | **643** |

The ontology-assisted workflow improved modeled PayPal net by **3.47%**, merchant contribution by **$1,024.86**, and retained purchases by **16** over fixed rules. Compared with the fresh planner, its gains were **$33.70**, **$459.50** and **one purchase**. Combined inference usage was an estimated **$0.077443**. Merchant contribution includes inventory value. The results describe one simulated scenario.

The live planner requested eight ontology-validated features, trained that candidate and rejected it when it performed worse. It published the broader model with a revised campaign. The result demonstrates an auditable experiment and campaign workflow. The four-market local feature study separately measured ROC AUC improving from 0.827 to 0.852 and $71.81 additional modeled PayPal net in aggregate, with one negative market.

## Ontology verification

On 24 held-out synthetic merchant exports, the ontology verifier correctly accepted all 12 usable feeds. Fixed mapping accepted six. Both held all 12 unsafe exports. The verifier reconciles split baskets and archived provider evidence without counting a Sandbox confirmation as another sale.

The ontology follows ideas from NVIDIA Auto Ontology. This project implements its own reviewed commerce definitions, relationship checks and training tools. The fresh planner chooses within those definitions.

## Tools used

- **Gemini on Vertex AI** makes fresh planning decisions. Flash-Lite handles the first five decisions and Pro handles the final campaign review. A durable spend ledger enforces call reservations and limits.
- **Python and scikit-learn** fit and validate local predictive models. The LLM receives the numerical results before selecting a candidate.
- **Node.js, SQLite and Three.js** support the application, transaction warehouse and visual economy.
- **PayPal Sandbox APIs** execute selected payments and return native receipts that reconcile to warehouse orders.
- **AG Studio** powers the Intelligence workspace with native grids, charts, sortable grids, layout editing and a custom PayPal evidence widget. It displays market trends, model training, LLM usage and settled financial comparisons. Review checkpoints and the ontology graph link these views to recorded decisions. The older reports workspace also contains the analyst/designer agent harness.
- **Project-owned ontology and verifier code** validates data meanings, feature eligibility, typed tool inputs and financial publication rules.

The catalog, shoppers and demand are authored simulation data. The current candidate uses the authored catalog and its local warehouse.

## How judges can try it

The repository includes a recorded walkthrough, original model decisions, measured results, native Sandbox receipt evidence and setup instructions. After installing the documented Node dependencies, start the app with `npm run dev -- --no-recover`. Open the judge page and choose **Compare the fresh Gemini campaigns**.

The recorded demo replays completed decisions and needs zero new paid calls. A separate live workflow can make new planner decisions when the isolated model project is configured. The ontology feature comparison, receipt verification and experiment records are available from the demo.

## Release fields

- Attach the final public video using the [2:50 recording plan](demo-plan.md).
- Publish the approved repository with its MIT license and runnable instructions. GitHub is currently private by user request.
- Use clear local setup as the runnable-demo entry, or provide a verified hosted URL.
- Confirm appropriate AG Studio license coverage for any hosted sponsor demonstration.
- Copy this description into the submission form and replace release fields with final repository, video and demo links.

[Fresh decision evidence](../demo/data/ontology-live-campaign.json) · [Live comparison method](ontology/live/README.md) · [Ontology verification](ontology/README.md) · [Feature study](ontology/training/README.md) · [PayPal receipt](../demo/data/judge-reactivation.json)
