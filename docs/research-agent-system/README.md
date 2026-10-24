# Agent-system research package

[Read the research report](report.md).

The proposed architecture combines a planner, selective specialist work, trajectory-calibrated routing, evidence dependency checks and durable effect execution. It is a research-backed design, not an implemented LLM mesh or a proven performance improvement.

- [Architecture](../figures/agent-research/architecture.svg)
- [Checkpoint and payment recovery](../figures/agent-research/checkpoint-recovery.svg)
- [Published benchmark comparisons](../figures/agent-research/published-benchmarks.svg)
- [Measured prototype evidence](../figures/agent-research/prototype-evidence.svg)
- [Benchmark protocol — not run](benchmark-protocol.json)
- [Published numeric data and provenance](benchmark-data.json)
- [Flat chart rows](benchmark-data.csv)

Each figure also has a PNG beside its SVG. Published results, existing local execution and proposed experiments are kept separate. The first campaign is documented in [the execution record](../campaign-workflow/first-run.json).

Reproduce the figures with Python 3.9+ and matplotlib 3.9.4:

~~~sh
MPLCONFIGDIR=.local/matplotlib .local/research-venv/bin/python scripts/plot-agent-research.py
~~~

The plotting script reads local JSON and makes no network/model calls. Local research dependencies are isolated under .local/research-venv and are ignored by Git. The research run used no subagents or paid model APIs. Chat and local computing costs were not metered.

The complete source vault and sequential research audit remain in research/runs/market-agent-routing-a477e1/. Research corpus indexing was partly rate-limited; no independent reproduction or exhaustive novelty proof is claimed.

