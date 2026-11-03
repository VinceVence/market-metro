"""Export the complete confirmation result, including losses, without fitting."""
import json
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

root = Path("docs/commerce-growth/economic-final-1")
report = json.loads((root / "results.json").read_text())
pairs = report["differences"]["fixed"]["paired"]
colors = ["#63738b", "#003087", "#0070e0", "#a86e31"]
arms = ["fixed", "baseline_v1", "workflow", "unreviewed_proposal"]
labels = ["Strong fixed", "Locked v1", "Reviewed workflow", "First proposal"]
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10,
                     "axes.spines.top": False, "axes.spines.right": False})
fig, axes = plt.subplots(1, 2, figsize=(13.5, 7), gridspec_kw={"width_ratios": [1, 1.25]})
fig.patch.set_facecolor("#f6f9ff")
values = [report["summary"][a]["netAfterModelUSD"] for a in arms]
axes[0].barh(range(4), values, color=colors, height=.58)
axes[0].set_yticks(range(4), labels)
axes[0].invert_yaxis()
axes[0].set_xlim(0, max(values) * 1.18)
for i, v in enumerate(values):
    axes[0].text(v + max(values) * .015, i, f"${v:,.2f}", va="center")
axes[0].set_title("A  Same 14 markets", loc="left", weight="bold")
axes[0].set_xlabel("Mean settled PayPal contribution after AI cost (USD)")
y = np.arange(len(pairs))
axes[1].barh(y, [p["net"] for p in pairs], color=["#0070e0" if p["net"] >= 0 else "#b95563" for p in pairs])
axes[1].set_yticks(y, [p["regime"].replace("_", " ") + f" {p['panel']+1}" for p in pairs], fontsize=8)
axes[1].invert_yaxis()
axes[1].axvline(0, color="#243750", linewidth=.8)
axes[1].set_title("B  Every fresh market", loc="left", weight="bold")
axes[1].set_xlabel("Reviewed workflow − strong fixed (USD)")
for ax in axes:
    ax.set_facecolor("#f6f9ff")
    ax.grid(axis="x", alpha=.14)
    ax.set_axisbelow(True)
d = report["differences"]["fixed"]
fig.suptitle("PayPal commerce workflow · frozen-economy confirmation", x=.02, ha="left", fontsize=17, weight="bold", color="#003087")
fig.text(.02, .055, f"Workflow − fixed: ${d['meanNetUSD']:+.2f}/market; 95% paired bootstrap [{d['interval']['low']:+.2f}, {d['interval']['high']:+.2f}].\n"
         f"Decision: {report['selected']['candidate_id']}. Fresh workflow calls: {report['providerCalls']} (${report['modelCostUSD']:.6f}).\n"
         "Synthetic economics, not production PayPal ROI. First-proposal control is the same planner before historical review.", fontsize=9, color="#43536c")
fig.tight_layout(rect=[0, .17, 1, .94])
out = Path("docs/figures/economic-workflow")
out.mkdir(parents=True, exist_ok=True)
for extension in ["png", "svg"]:
    fig.savefig(out / f"final-net.{extension}", dpi=180, bbox_inches="tight")
print(json.dumps({"figure": str(out / "final-net.png"), "markets": len(pairs)}))
