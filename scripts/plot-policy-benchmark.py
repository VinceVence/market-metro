"""Render measured Policy Lab results. No network, model or payment calls.
Run: .local/research-venv/bin/python scripts/plot-policy-benchmark.py
Uses the existing local matplotlib runtime; exports SVG, PNG and PDF.
"""
from pathlib import Path
import json
import os

ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault("MPLCONFIGDIR", str(ROOT / ".local/matplotlib"))
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager
import numpy as np

BASE = ROOT / "docs/policy-lab/benchmarks/v1"
OUT = ROOT / "docs/figures/policy-lab-benchmark-v1"
OUT.mkdir(parents=True, exist_ok=True)
data = json.loads((BASE / "result.json").read_text())
versions = json.loads((BASE / "versions.json").read_text())
for font in (ROOT / "demo/assets/fonts").glob("*.ttf"):
    font_manager.fontManager.addfont(str(font))
plt.rcParams.update({"font.family": "DM Sans", "font.size": 11, "svg.fonttype": "path",
    "axes.spines.top": False, "axes.spines.right": False, "axes.spines.left": False,
    "axes.edgecolor": "#D1DCD7", "figure.facecolor": "white", "axes.facecolor": "white",
    "text.color": "#24424D", "axes.labelcolor": "#24424D", "xtick.color": "#526E79",
    "ytick.color": "#526E79", "text.parse_math": False})
COLORS = {"recorded_v1": "#276B76", "rules_matched": "#B27936", "rules_fast": "#8A73A8"}
ORDER = ["recorded_v1", "rules_matched", "rules_fast"]
LABELS = {"recorded_v1": "Saved agent plan + refits", "rules_matched": "Rules · matched timing", "rules_fast": "Rules · immediate"}
SCENARIOS = {"steady": "Steady market", "rival_sale": "Rival sale", "budget_squeeze": "Budget squeeze", "supply_delay": "Stock delay", "returns_wave": "Return wave"}
SUMMARY = {r["policy"]: r for r in data["summaries"]}
FOOT = f"20 seed clusters × 5 fixed scenarios · 100 shoppers per world · simulator estimates\nFrozen benchmark {data['benchmarkHash'][:12]} · source data: cases.csv / result.json"

def save(fig, name, caption):
    for extension in ["svg", "png", "pdf"]:
        fig.savefig(OUT / f"{name}.{extension}", dpi=180, bbox_inches="tight")
    plt.close(fig)
    return {"name": name, "caption": caption, "files": {ext: f"/figures/policy-lab-benchmark-v1/{name}.{ext}" for ext in ["svg", "png", "pdf"]}}

def heading(fig, title, subtitle):
    fig.text(.04, .965, title, ha="left", va="top", fontsize=21, weight="bold")
    fig.text(.04, .90, subtitle, ha="left", va="top", fontsize=10.5, color="#526E79")

def clean(ax):
    ax.grid(axis="x", color="#DDE5E0", lw=.65)
    ax.set_axisbelow(True)
    ax.tick_params(axis="y", length=0)

def point(ax, metric, y, color, label=None):
    lo, hi, center = metric["low"], metric["high"], metric["mean"]
    ax.errorbar(center, y, xerr=[[center-lo], [hi-center]], fmt="o", color=color, capsize=3, lw=1.5, ms=5, label=label)

figures = []
fig, ax = plt.subplots(figsize=(12, 7.8))
fig.subplots_adjust(left=.21, right=.96, top=.79, bottom=.22)
heading(fig, "A · Does the policy add economic value?", "Paired difference versus no campaign, after allocated source-model cost · 95% seed-cluster bootstrap intervals")
groups = [("All five scenarios", {p: SUMMARY[p]["metrics"]["deltaPlatformUSD"] for p in ORDER})]
groups += [(SCENARIOS[r["scenario"]], {p["policy"]: p for p in r["policies"]}) for r in data["scenarioResults"]]
for y, (label, estimates) in enumerate(groups):
    for j, p in enumerate(ORDER):
        point(ax, estimates[p], y+(j-1)*.2, COLORS[p], LABELS[p] if y == 0 else None)
ax.axvline(0, color="#556F7B", ls="--", lw=1)
ax.set_yticks(range(len(groups)), [g[0] for g in groups]); ax.invert_yaxis()
ax.set_xlabel("Additional modeled platform contribution (USD / 100 shoppers)", labelpad=12)
clean(ax)
fig.legend(loc="lower left", bbox_to_anchor=(.20, .10), ncol=3, frameon=False, fontsize=10)
fig.text(.04, .025, FOOT, fontsize=9, color="#526E79")
figures.append(save(fig, "economic-impact", "Paired mean and 95% uncertainty by scenario. A positive mean alone does not pass the economic goal."))

fig, ax = plt.subplots(figsize=(12, 6.4))
fig.subplots_adjust(left=.10, right=.96, top=.78, bottom=.24)
heading(fig, "B · How value accumulates during the campaign", "Fully matured sale cohorts, reconstructed after day 114 · pointwise 95% seed-cluster intervals")
for curve in data["curves"]:
    p = curve["policy"]; x = [r["day"] for r in curve["points"]]
    ax.plot(x, [r["mean"] for r in curve["points"]], label=LABELS[p], color=COLORS[p], lw=2)
    ax.fill_between(x, [r["low"] for r in curve["points"]], [r["high"] for r in curve["points"]], color=COLORS[p], alpha=.11, lw=0)
ax.axhline(0, color="#556F7B", ls="--", lw=1)
for day in [39,64,93]: ax.axvline(day+1, color="#CBD5CF", ls=":", lw=1)
ax.set_xlabel("Shopping day · first 30 days reserved for history")
ax.set_ylabel("Cumulative difference vs no campaign (USD)")
ax.grid(alpha=.2); fig.legend(loc="upper left", bbox_to_anchor=(.09,.84), ncol=3, frameon=False, fontsize=10)
fig.text(.10, .12, "Dotted lines: saved plans become active on displayed days 40, 65, 94. Final review cost is allocated at the endpoint.\nThis is a retrospective outcome curve, not evidence available to agents during those days.", fontsize=9, color="#526E79")
fig.text(.04, .025, FOOT, fontsize=9, color="#526E79")
figures.append(save(fig, "cumulative-value", "Cumulative economic effect with pointwise uncertainty. Negative regions remain visible."))

fig, axes = plt.subplots(1,2,figsize=(13,6.2))
fig.subplots_adjust(left=.22, right=.96, top=.75, bottom=.25, wspace=.45)
heading(fig, "C · Merchant and shopper outcomes", "Same paired worlds · a fixed day 30 lapsed cohort · 95% seed-cluster bootstrap intervals")
for ax, field, title, xlabel in [(axes[0], "deltaMerchantUSD", "Merchant contribution", "Additional merchant contribution (USD)"), (axes[1], "deltaReactivated", "Customer reactivation", "Additional reactivated shoppers")]:
    for y,p in enumerate(ORDER): point(ax, SUMMARY[p]["metrics"][field], y, COLORS[p])
    ax.axvline(0, color="#556F7B", ls="--", lw=1); ax.set_ylim(-.6,2.6); ax.invert_yaxis()
    ax.set_yticks(range(3), [LABELS[p] for p in ORDER] if ax is axes[0] else ["", "", ""])
    ax.set_xlabel(xlabel); ax.set_title(title, loc="left", fontsize=13, weight="bold"); clean(ax)
    if ax is axes[1]:
        ax.set_xlim(-1,1); ax.set_xticks([-1,0,1]); ax.text(.03,.94,"Zero difference in all100 cases",transform=ax.transAxes,fontsize=9,color="#526E79")
fig.text(.04, .12, "Reactivation: had purchased before day 30, then inactive for ≥7 days, and bought again during days 31–100.\nCount differences are simulator effects; they do not identify which real customers were saved from churn.", fontsize=10, color="#526E79")
fig.text(.04, .025, FOOT, fontsize=9, color="#526E79")
figures.append(save(fig, "merchant-and-reactivation", "Merchant economics and incremental reactivation of a cohort fixed before campaign activation."))

audit=data["audit"]
fig, axes = plt.subplots(1,3,figsize=(14,6.3))
fig.subplots_adjust(left=.07,right=.96,top=.73,bottom=.30,wspace=.55)
heading(fig, "D · What the actual agent trace reveals", "One recorded Gemini run · structural errors, publication latency and model validation are separate measures")
a=axes[0]; y=np.arange(3); counts=audit["roleCounts"]
a.barh(y,[r["accepted"] for r in counts],color="#276B76",label="Structurally valid")
a.barh(y,[r["rejected"] for r in counts],left=[r["accepted"] for r in counts],color="#B27936",label="Rejected attempt")
a.set_yticks(y,["Growth", "Scientist", "Reviewer"]);a.invert_yaxis();a.set_xlabel("Actual model attempts");a.set_title("Typed-contract validity",loc="left",fontsize=12,weight="bold");clean(a)
a=axes[1]
for i,r in enumerate(audit["publicationDelays"]):
    a.plot([r["evidenceDay"],r["publishedDay"]],[i,i],color="#B27936",lw=3)
    a.scatter([r["evidenceDay"],r["publishedDay"]],[i,i],color=["#9BACA8","#276B76"],s=30,zorder=3)
    a.text((r["evidenceDay"]+r["publishedDay"])/2,i-.15,f"{r['delayDays']} days",ha="center",fontsize=9)
a.set_yticks(range(3),["Review 1","Review 2","Review 3"]);a.set_ylim(2.5,-.5);a.set_xlabel("Simulator clock (completed days)");a.set_title("Evidence → publication",loc="left",fontsize=12,weight="bold");clean(a)
a=axes[2]; fits=audit["localFits"]
a.plot([r["cutoff_day"] for r in fits],[r["mse"] for r in fits],"o-",color="#276B76",label="Ridge bandit")
a.plot([r["cutoff_day"] for r in fits],[r["baseline_mse"] for r in fits],"s--",color="#B27936",label="Constant mean")
a.set_xlabel("Training evidence cutoff day");a.set_ylabel("Validation MSE · lower is better");a.set_title("Prediction quality",loc="left",fontsize=12,weight="bold");a.grid(alpha=.2)
handles0,labels0=axes[0].get_legend_handles_labels()
handles2,labels2=axes[2].get_legend_handles_labels()
fig.legend(handles0+handles2,labels0+labels2,loc="lower center",bbox_to_anchor=(.5,.17),ncol=4,frameon=False,fontsize=9)
fig.text(.04,.095,f"{audit['attempts']} model attempts · {audit['rejectedAttempts']} structurally rejected · ${audit['costUSD']:.6f} recorded token estimate\nFour non-exhaustive manual semantic findings remain visible. Contract acceptance is not factual accuracy; MSE is not campaign lift.",fontsize=10,color="#526E79")
fig.text(.04,.025,f"Source: {audit['sourceRunId']} · no new model calls in the evaluation suite",fontsize=9,color="#526E79")
figures.append(save(fig, "agent-reliability", "Original live-agent evidence. Factual mistakes are annotated separately from structural guard tests."))

fig,ax=plt.subplots(figsize=(10,5.7))
fig.subplots_adjust(left=.12,right=.94,top=.73,bottom=.27)
heading(fig,"E · Policy version progress","Comparable version history · measured estimates only · no invented improvement trend")
for i,r in enumerate(versions):
    ax.errorbar(i,r["mean"],yerr=[[r["mean"]-r["low"]],[r["high"]-r["mean"]]],fmt="o",color="#276B76",capsize=6,ms=8,lw=2)
ax.axhline(0,color="#556F7B",ls="--",lw=1)
ax.set_xlim(-.6,max(.6,len(versions)-.4));ax.set_xticks(range(len(versions)),[r["version"]+" · saved-plan transfer" for r in versions])
ax.set_ylabel("Difference vs no campaign (USD)");ax.grid(axis="y",alpha=.2)
fig.text(.12,.14,"Only one policy version has been evaluated. A trend requires another version on a compatible protocol.\nFuture tuning may use this suite for regression; confirmatory claims require new held-out seeds.",fontsize=10,color="#526E79")
fig.text(.04,.025,FOOT,fontsize=9,color="#526E79")
figures.append(save(fig,"version-progress","One measured version, with uncertainty. The chart does not imply an improvement that has not been tested."))
(BASE/"figures.json").write_text(json.dumps(figures,indent=2)+"\n")
public = {k:v for k,v in data.items() if k != "rows"}
organic = [r for r in data["rows"] if r["policy"] == "organic"]
public["cohortDiagnostic"] = {"cases": len(organic), "allLapsedReturnedWithoutCampaign": all(r["reactivatedCustomers"] == r["cohortLapsed"] for r in organic),
    "interpretation": "Every baseline lapsed shopper returned within 70 days without outreach. This horizon has a ceiling effect; zero reactivation lift does not validate a realistic churn model."}
public["figures"] = figures
public["versions"] = versions
(BASE/"index.json").write_text(json.dumps(public,indent=2)+"\n")
print(f"Rendered {len(figures)} research figures as SVG, PNG and PDF.")
