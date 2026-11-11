# Market Metro — submission image gallery

Upload the **nine files in `upload/`**, in filename order. All are 3:2 JPG or PNG and individually below 5 MB. Figures are 2400 × 1600; original website captures are 1440 × 960. `preview.png` is a contact sheet for review, not an additional gallery item.

The style follows the user's research-paper reference: paired panels, clear directional flows, restrained semantic colors, vector icons, shared visual vocabulary and DM Sans. The reference's SpectRAG algorithm is not part of Market Metro.

## Recommended order and captions

| Image | Submission caption / alt text |
| --- | --- |
| `01-market-metro.png` | Market Metro — Agentic Commerce That Learns. A 12-merchant, 600-shopper market connects observed behavior, ontology-guided learning, verified campaigns and payment evidence. |
| `02-system-architecture.png` | Four planes connect the market, LLM planner and trusted tools, ontology-backed warehouse, and PayPal payment evidence. The verifier controls publication; checkpoints preserve the decision trail. |
| `03-ontology.png` | The ontology distinguishes shopper checkouts from merchant-order portions, checks units and timing, and holds ambiguous mappings. The demonstrated cohort reconciles 125 merchant orders to 114 unique checkouts. |
| `04-agent-framework.png` | AG Studio's native agent framework connects a commerce planner, scoped query, deterministic ontology verifier, LLM insight editor and checked dashboard publisher. One saved investigation used two model decisions and published five views. |
| `05-paypal-architecture.png` | Follow Shopper 179 from a recommendation to a $96 PayPal Sandbox purchase. The native receipt reconciles a $3.56 fee and $92.44 test-merchant proceeds. Matched campaign economics are reported separately. |
| `06-agent-studio.jpg` | Actual deployed Agent Studio after replaying a verified investigation: the planner's merchant cohort, ontology checks and source-backed insights are visible together. |
| `07-model-training.jpg` | Actual training dashboard: two locally fitted models, 2,762 training observations, 20 selected features, validation quality and the saved model registry. |
| `08-campaign-impact.jpg` | Actual matched campaign dashboard: +$114.96 modeled PayPal net after estimated AI cost, +$1,024.86 merchant contribution and 16 additional retained purchases versus fixed rules. |
| `09-ontology-explorer.jpg` | Actual interactive ontology explorer linking shoppers, contacts, checkout parents, merchant orders, payment evidence, training cases, models, campaigns and the verifier. |

## Evidence and boundaries

- Campaign figures come from [`demo/data/judge-reactivation.json`](../../demo/data/judge-reactivation.json): seed **92111706**, 100 market days plus settlement through day 126. PayPal net: **$3,309.83 fixed → $3,424.787675 planner**. Merchant contribution: **$38,928.95 → $39,953.81**. Retained purchases: **627 → 643**. Estimated original inference cost: **$0.032325**.
- These are controlled simulation results, not production ROI. Merchant contribution includes inventory valuation. This featured seed was selected to explain the verifier's model revision; it is not a standalone generalization claim.
- The campaign outcome belongs to **one planner plus verifier**. The separate two-role Studio investigation publishes dashboards; it does not create new campaign gains or execute payments.
- Studio counts and its **$0.001530 estimated inference cost** refer to saved investigation `INSIGHT-60d69504559ddfb4`. Source: [`demo/data/studio-investigation-demo.json`](../../demo/data/studio-investigation-demo.json) and [`docs/ag-studio/agent-workspace.md`](../../docs/ag-studio/agent-workspace.md).
- PayPal capture **2M324038C71499318** is a completed native **Sandbox** receipt for the existing selected $96 order. It uses test funds and never adds another simulated sale.
- All website captures are from the deployed application, captured at 1440 × 960. The original full captures are retained in `assets/`; Figure 05 uses a labeled crop of the actual receipt card. Vendor evaluation notices are not removed.
- No fresh model inference, checkout or paid call was made to create this gallery. The saved Studio replay executed its query and verification tools again.

## Source assets and rebuild

Editable SVG figures are in `masters/`. The renderer reuses existing project DM Sans fonts, the Market Metro mark, PayPal vector and Lucide icons. Original vector attribution is in [`docs/presentations/ontology-paypal/vectors/sources.json`](../../docs/presentations/ontology-paypal/vectors/sources.json) and [`docs/figures/planner-v23/assets/sources.json`](../../docs/figures/planner-v23/assets/sources.json).

Run from the repository root with the existing local diagram environment:

```sh
node submission-media/gallery/build.mjs
```

It uses the already installed `@resvg/resvg-js` in `.local/diagram-tools/`. It does not change application files, deploy anything, or make network requests. `manifest.json` records upload file sizes and the underlying campaign evidence.

## App links

- [Judge walkthrough](https://market-metro-fifm2aalgq-uc.a.run.app/)
- [Agent Studio](https://market-metro-fifm2aalgq-uc.a.run.app/agent-studio.html)
- [Model training](https://market-metro-fifm2aalgq-uc.a.run.app/analytics.html?run=judge-demo&view=models)
- [Campaign impact](https://market-metro-fifm2aalgq-uc.a.run.app/analytics.html?run=judge-demo&view=profits)
- [Ontology explorer](https://market-metro-fifm2aalgq-uc.a.run.app/analytics.html?run=judge-demo&view=ontology)
- [PayPal receipt](https://market-metro-fifm2aalgq-uc.a.run.app/analytics.html?run=judge-demo&view=payments)
