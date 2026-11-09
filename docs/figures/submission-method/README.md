# Submission architecture figure

[PNG for the writeup](system-comparison.png) · [Editable vector master](system-comparison.svg)

The user's supplied paper figure guided the presentation: paired panels, a shared input boundary, a compact relationship graph, restrained colors, directional arrows and one legend. No SpectRAG retrieval or spectral-diffusion technique is claimed or implemented by this figure.

**Figure caption.** Market Metro compares a fixed campaign policy with an ontology-guided planner operating on the same observation boundary. The ontology describes identity, entity grain, time availability and training targets. One LLM chooses typed actions; local tools fit models and evaluate campaigns. Trial feedback may trigger a revision. A deterministic verifier controls publication, binding the tested campaign and model or retaining the incumbent. Checkpoints and financial outcomes remain inspectable. Selected saved orders have a separate native PayPal Sandbox path; the $96 capture is not counted as a second sale.

## Implementation mapping

| Figure element | Source of truth |
|---|---|
| Market / warehouse | `scripts/commerce-metropolis/engine.mjs`, `environment.mjs`, `warehouse.mjs` |
| Fixed reference policy | `scripts/commerce-metropolis/harness/tools.mjs` (`fixedOutreach`) |
| Feed identity and conservation | `scripts/commerce-metropolis/feed-verifier.mjs`, `feed-gate.mjs` |
| Ontology training semantics | `scripts/ontology/training.mjs`, `planner-training.mjs` |
| LLM decisions and checkpoints | `scripts/commerce-metropolis/harness/controller.mjs` |
| Model fitting, typed actions | `scripts/commerce-metropolis/harness/tools.mjs`, `contracts.mjs` |
| Trial feedback and publication | `scripts/commerce-metropolis/harness/trials.mjs`, `model-check.mjs` |
| Sandbox execution / receipt | `scripts/paypal-sandbox.mjs`, `scripts/paypal-commerce.mjs`, `demo/data/judge-reactivation.json` |
| Judge inspection | `demo/studio/intelligence.mjs`, `demo/data/judge-intelligence.json` |

The graph is a conceptual relationship subset, not a query plan. The environment thumbnail represents the existing renderer. Candidate screening uses separate development markets; final policy comparisons use paired inputs. The diagram explains control and data flow, not universal superiority, independent multi-agent reasoning, or production ROI. Runtime catalog data is authored; this figure does not imply active Channel3 ingestion or a running NVIDIA package.

The original $96 receipt has a $3.56 fee and $92.44 test merchant proceeds. The broader modeling studies and scale runs are separate evidence. The writeup's tables retain their original scope and limitations.

## Rebuild

From the repository root:

```sh
npm install --prefix .local/diagram-tools --cache .local/npm-cache --no-audit --no-fund @resvg/resvg-js@2.6.2
node docs/figures/submission-method/build.mjs
```

The PNG is 2400 × 1440. The SVG embeds its images and icons; DM Sans fonts are supplied to the rasterizer from the repository. Existing Lucide icons retain the notices in `docs/presentations/ontology-paypal/vectors/`. PayPal's brand mark and the environment thumbnail use the provenance in `docs/figures/planner-v23/assets/sources.json`.
