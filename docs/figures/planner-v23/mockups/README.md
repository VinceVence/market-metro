# Architecture mockups: design history

These are three alternative presentations of the implemented V2.3 workflow. All use **LLM agent**, retain the actual saved environment capture and distinguish LLM choices, numerical workers, admission checks, native Sandbox receipts and independent evaluation. **Selection confirmed:** C’s layout, B’s palette, DM Sans, clearer wording and additional vector icons. [Final diagram](../README.md).

| Option | Typography | Emphasis |
|---|---|---|
| [A — Journal overview](option-a-journal.png) | STIX serif, including italic notation | Traditional paper hierarchy, explicit state and evidence flow |
| [B — ML methods figure](option-b-methods.png) | DejaVu Sans with restrained color | Context, typed proposals, local experiments and publication |
| [C — Protocol figure](option-c-protocol.png) | STIX with DejaVu monospace | Six decision stages, checkpoint handoffs and contract fields |

[Three-page PDF](../../../../output/pdf/market-metro-architecture-mockups.pdf)

## What the technical labels mean

The symbols name existing artifacts: s_t is market state, o_t is an allowed observation, H_t is review history/context, M_1 and M_2 are fitted alternatives, and E_t is measured trial evidence. They do not introduce a new learning algorithm. The c0–c5 markers illustrate recorded decision stages; they are not literal persisted checkpoint IDs or a promise of automatic crash resume.

The contract snippets are abbreviated for the figure. Actual validation is in contracts.mjs; training and scoring are in tools.mjs; trial receipts and publication are in trials.mjs. The receipt hashes bind content/context and are not external cryptographic signatures. Agent-visible development trials remain distinct from the four held-out evaluation markets.

The generic agent label changes presentation only. The current model backend is still Gemini on Vertex AI. No new model calls, payment calls, benchmark runs or runtime capabilities were added for these mockups.

## Reproduce

[Drawing source](../../../../scripts/render_architecture_mockups.py) reuses the main figure's primitives, logos and saved capture. Run with the existing PDF dependencies plus Matplotlib's bundled fonts. This environment uses the bundled Python with PYTHONPATH=.local/diagram-deps. Intermediate editable SVGs are written to .local/architecture-mockups; final PNGs and the PDF are the review deliverables.

STIX and DejaVu fonts are distributed with Matplotlib. Their notices are included as [STIX](LICENSE_STIX.txt) and [DejaVu](LICENSE_DEJAVU.txt). Brand/source notices and capture provenance remain in the parent figure directory.
