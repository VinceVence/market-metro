# Market Metro: architecture by plane

The implemented V2.3 workflow, redrawn as a compact technical figure with neutral plane boundaries, vector technology marks and small technical symbols.

[Editable SVG](system-architecture.svg) · [PNG preview](system-architecture.png) · [Single-page vector PDF](../../../output/pdf/market-metro-planner-v23.pdf)

![System architecture](system-architecture.png)

| Plane | Responsibility |
|---|---|
| Environment | Seeded shoppers, merchants, orders, delivery and returns |
| Data | Projected observations plus the SQLite/AG Studio warehouse |
| Planner | Gemini chooses investigations, models and campaign revisions; checkpoints record decisions |
| Tools + execution | Local analysis, fitting, trials and guarded publication |
| PayPal Sandbox | Saved-wallet order/capture samples and verified receipt lineage |
| Evaluation | Separate fixed, planner and team worlds under matched seeds |

The planner reads projected state and JSON evidence, not arbitrary SQL. Native receipt records return to the warehouse; the recorded financial comparison does not use live PayPal transactions. Development trial results return to the planner, while final held-out comparison scores remain outside planning. Checkpoints support audit and replay; automatic crash recovery of uncertain provider calls is not claimed.

The diagram represents logical responsibilities in one local Node app with Python workers. The grouping follows architecture-documentation conventions; no AWS or Databricks infrastructure is implied. The catalog/economy are authored and frozen; Channel3 is not an active source. Sandbox receipts mirror selected existing orders and never add another simulated sale. Review dates pause while the tools run. Detail and measured outcomes remain in the [V2.3 report](../../commerce-expanded/harness-v2/v23-20261104/README.md).

## Reproduce and verify

[Drawing source](../../../scripts/render_planner_architecture.py) emits SVG with embedded DM Sans fonts, a selectable-text vector PDF, and a PNG rendered from that PDF. With Python 3.12 and artifact-only packages reportlab, svglib==1.5.1 and pypdfium2, run `python3 scripts/render_planner_architecture.py` from the project root. This environment used the bundled runtime plus `PYTHONPATH=.local/diagram-deps`; application dependencies were not changed.

The [manifest](manifest.json) records implementation/evidence hashes. The [export validation](validation.json) confirms one PDF page, embedded fonts and zero raster images inside the PDF. The PDF and PNG were visually inspected. No model calls, new benchmark runs or payment calls were made to create this diagram.

## Vector asset credits

PayPal's mark comes from paypalobjects.com. Gemini comes from Simple Icons. Google Cloud, Python, scikit-learn and SQLite come from Devicon. [Exact URLs and hashes](assets/sources.json), [Devicon MIT notice](assets/devicon-LICENSE.txt), and [Simple Icons CC0 text](assets/simple-icons-LICENSE.txt) accompany the assets. Trademarks remain with their owners. The small state, document, tool and checkpoint symbols are original SVG artwork.
