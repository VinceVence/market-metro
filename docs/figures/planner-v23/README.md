# Market Metro: agent and environment workflow

**Selected design:** C’s structure, B’s colors, DM Sans, and plain-language labels. The final diagram uses the actual recorded environment, a six-step decision flow with saved checkpoints, illustrated tools, warehouse records, and PayPal receipt handling. [Original mockups](mockups/README.md) remain available as design history.

[Editable SVG](system-architecture.svg) · [PNG preview](system-architecture.png) · [PDF](../../../output/pdf/market-metro-planner-v23.pdf)

![Agent and environment workflow](system-architecture.png)

| Panel | What it explains |
|---|---|
| Market environment | Shoppers, merchants, orders and the real saved app snapshot |
| LLM agent | Explore, prepare, try models, compare, plan and refine; save every decision |
| Data | Purchase records plus saved models, campaign plans and decisions |
| Tools and sandbox | Analyze data, test campaigns, check outcomes and launch eligible plans |
| PayPal and review | Record selected Sandbox payments and compare final market outcomes |

The activity, test-result and campaign-update arrows show the feedback loop. Local development trial results return to the planner; final held-out benchmark scores do not. The experiment sandbox is a bounded numerical test workflow, not a claim of OS-level isolation. The planner consumes projected state and JSON evidence; the diagram does not imply unrestricted LLM SQL writes or payment authority.

## Actual environment and payment evidence

[Capture provenance](assets/environment-snapshot.json) records the saved session URL, displayed day, viewport and screenshot hash. The capture used only GET requests in an isolated browser and blocked API writes. It starts no new simulation, LLM job or payment. The city image is the application's rendered canvas, not generated artwork. The captured session is the recorded team-mode V2.3 replay; planner and team modes share the illustrated harness.

[Diagram evidence](assets/diagram-evidence.json) contains three real rows from the local synthetic warehouse and the archived native receipt fields. Highlighted order #708 / merchant M10 is the $64 merchant leg mirrored to PayPal Sandbox. Its fee is $2.48 and proceeds are $61.52. These are fictitious test funds; the native receipt is not extra simulator revenue. [Study and receipt evidence](../../commerce-expanded/harness-v2/v23-20261104/README.md).

The warehouse stores simulation events and native receipt lineage separately. The authored catalog/economy remain frozen; Channel3 is not active. Checkpoints support audit/replay, without claiming automatic recovery of uncertain provider calls.

## Export and reproduce

The SVG and PDF embed the authentic raster scene screenshot. Labels, logos, arrows, tables and workflow components remain vector-based. The [export validation](validation.json) records the expected image and embedded fonts; the final page was visually inspected.

[Drawing source](../../../scripts/render_planner_architecture.py) uses the committed screenshot and evidence files. With Python 3.12 and artifact-only packages reportlab, svglib==1.5.1 and pypdfium2, run `python3 scripts/render_planner_architecture.py` from the project root. This environment used the bundled runtime plus `PYTHONPATH=.local/diagram-deps`. Application dependencies were not changed. The [manifest](manifest.json) records the source hashes and captured scene identity.

## Asset credits

PayPal's mark comes from paypalobjects.com. Google Cloud, Python, scikit-learn and SQLite come from Devicon. The retained asset bundle also includes a Simple Icons Gemini mark used in earlier designs; the selected diagram uses a generic LLM-agent symbol. [URLs and hashes](assets/sources.json), [Devicon MIT notice](assets/devicon-LICENSE.txt), and [Simple Icons CC0 text](assets/simple-icons-LICENSE.txt) accompany the assets. Trademarks remain with their owners. The environment is a screenshot of the project's own renderer; technical symbols are original vector artwork.
