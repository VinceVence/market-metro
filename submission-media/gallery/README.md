# Market Metro — submission image gallery

Upload the **nine PNG files in `upload/`**, in filename order. Every image is **2400 × 1600 (3:2)** and individually below 5 MB. `preview.png` is a contact sheet for review, not an additional gallery item. The four former JPEG upload files have been replaced by framed PNG evidence panels.

## Sharper media revision

Fresh **3000 × 2000** source captures render the actual app at **2.5×** a 1200 × 800 layout. The new gallery uses focused crops, a larger environment image, vector headlines and source-backed result annotations. The source UI is not reconstructed or AI-generated. The browser supplies JPEG captures; PNG export prevents another lossy JPEG encoding step. These are not claimed to be lossless source screenshots.

The clean environment is captured with the app's existing presentation camera. It adds no economic events. The models image combines two labeled native crops: validation charts and the training registry. The ontology image uses the real graph's zoom controls and selects the checkout node.

The five figures use the requested **black-and-white research-paper treatment** for typography, panels, arrows and charts: square panels, thin outlines, solid/dashed flows, double-bordered verification gates, hatched baseline bars and restrained DM Sans typography. **Logos and environment/app images retain their original colors.** Original full app screenshots remain unchanged. The reference's SpectRAG algorithm is not part of Market Metro.

- `market-metro-diagrams-bw.zip`: the five research figures, with black-and-white linework and original-color logos and imagery.
- `market-metro-gallery.zip`: all nine revised upload PNGs.

## Recommended order and captions

| Image | Submission caption / alt text |
| --- | --- |
| `01-market-metro.png` | Market Metro — Agentic Commerce That Learns. A 12-merchant, 600-shopper market connects observed behavior, ontology-guided learning, verified campaigns and payment evidence. |
| `02-system-architecture.png` | Four planes connect the market, LLM planner and trusted tools, ontology-backed warehouse, and PayPal payment evidence. The verifier controls publication; checkpoints preserve the decision trail. |
| `03-ontology.png` | The ontology distinguishes shopper checkouts from merchant-order portions, checks units and timing, and holds ambiguous mappings. The demonstrated cohort reconciles 125 merchant orders to 114 unique checkouts. |
| `04-agent-framework.png` | AG Studio's native agent framework connects a commerce planner, scoped query, deterministic ontology verifier, LLM insight editor and checked dashboard publisher. One saved investigation used two model decisions and published five views. |
| `05-paypal-architecture.png` | Follow Shopper 179 from a recommendation to a $96 PayPal Sandbox purchase. The native receipt reconciles a $3.56 fee and $92.44 test-merchant proceeds. Matched campaign economics are reported separately. |
| `06-agent-studio.png` | Actual Agent Studio after replaying a verified investigation: the planner's merchant cohort, ontology checks and source-backed insights are visible together. Two recorded LLM roles drive six native tool calls and five published views. |
| `07-model-training.png` | Actual training dashboard: two locally fitted models, 2,762 training observations, 20 selected features, validation quality and the saved model registry. |
| `08-campaign-impact.png` | Actual matched campaign dashboard: +$114.96 modeled PayPal net after estimated AI cost, +$1,024.86 merchant contribution and 16 additional retained purchases versus fixed rules. |
| `09-ontology-explorer.png` | Actual ontology explorer: 1,384 unique checkouts, 1,922 merchant orders and 538 split checkouts across whole-market history through day 126, including warmup. |

## Evidence and boundaries

- Campaign figures come from [`demo/data/judge-reactivation.json`](../../demo/data/judge-reactivation.json): seed **92111706**, 100 market days plus settlement through day 126. PayPal net: **$3,309.83 fixed → $3,424.787675 planner**. Merchant contribution: **$38,928.95 → $39,953.81**. Retained purchases: **627 → 643**. Estimated original inference cost: **$0.032325**.
- These are controlled simulation results, not production ROI. Merchant contribution includes inventory valuation. This featured seed was selected to explain the verifier's model revision; it is not a standalone generalization claim.
- The campaign outcome belongs to **one planner plus verifier**. The separate two-role Studio investigation publishes dashboards; it does not create new campaign gains or execute payments.
- Studio counts and its **$0.001530 estimated inference cost** refer to saved investigation `INSIGHT-60d69504559ddfb4`. Source: [`demo/data/studio-investigation-demo.json`](../../demo/data/studio-investigation-demo.json) and [`docs/ag-studio/agent-workspace.md`](../../docs/ag-studio/agent-workspace.md).
- PayPal capture **2M324038C71499318** is a completed native **Sandbox** receipt for the existing selected $96 order. It uses test funds and never adds another simulated sale.
- The refreshed website captures use a local copy of the same app code and saved data as the deployed application. `assets/hires/` retains the unmodified 3000 × 2000 browser captures; earlier source captures remain in `assets/`. Figures 05–09 use labeled crops. Evaluation status is disclosed in the gallery captions; no vendor watermark or licence mechanism was disabled.
- No fresh model inference, checkout or paid call was made to create this gallery. The saved Studio replay executed its query and verification tools again.

## Source assets and rebuild

Editable SVG figures are in `masters/`. The renderer reuses existing project DM Sans fonts, the Market Metro mark, PayPal vector and Lucide icons. Original vector attribution is in [`docs/presentations/ontology-paypal/vectors/sources.json`](../../docs/presentations/ontology-paypal/vectors/sources.json) and [`docs/figures/planner-v23/assets/sources.json`](../../docs/figures/planner-v23/assets/sources.json).

Run from the repository root with the existing local diagram environment:

```sh
node submission-media/gallery/build.mjs
```

It uses the already installed `@resvg/resvg-js` in `.local/diagram-tools/`. It does not change application files, deploy anything, or make network requests. `manifest.json` records upload file sizes and the underlying campaign evidence.

To refresh the source images, run `node submission-media/gallery/capture.mjs` and open `http://127.0.0.1:4174/__capture?view=market`. Supported views are `market`, `environment`, `landing`, `agents`, `models`, `impact`, `ontology` and `paypal`. Capture at 3000 × 2000. The local media viewport embeds the unmodified app at 2.5×. It blocks model, payment and simulation writes and permits only verification of saved investigation evidence with the model provider disabled. Close first-visit tutorials and use **Replay a verified investigation**, not the fresh-investigation action.

## App links

- [Judge walkthrough](https://market-metro-fifm2aalgq-uc.a.run.app/)
- [Agent Studio](https://market-metro-fifm2aalgq-uc.a.run.app/agent-studio.html)
- [Model training](https://market-metro-fifm2aalgq-uc.a.run.app/analytics.html?run=judge-demo&view=models)
- [Campaign impact](https://market-metro-fifm2aalgq-uc.a.run.app/analytics.html?run=judge-demo&view=profits)
- [Ontology explorer](https://market-metro-fifm2aalgq-uc.a.run.app/analytics.html?run=judge-demo&view=ontology)
- [PayPal receipt](https://market-metro-fifm2aalgq-uc.a.run.app/analytics.html?run=judge-demo&view=payments)
