"""Reproduce research figures; no network or model calls.
Run: MPLCONFIGDIR=.local/matplotlib .local/research-venv/bin/python scripts/plot-agent-research.py
Dependency: matplotlib==3.9.4. Published data and local artifacts stay separate.
"""
from pathlib import Path
import json, csv, textwrap, os
os.environ.setdefault("MPLCONFIGDIR", str(Path(".local/matplotlib").resolve()))
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"docs/figures/agent-research"
OUT.mkdir(parents=True,exist_ok=True)
for font in (ROOT/"demo/assets/fonts").glob("*.ttf"):
    font_manager.fontManager.addfont(str(font))
plt.rcParams.update({"font.family":"DM Sans","font.size":10,"svg.fonttype":"none","text.parse_math":False,
                     "axes.spines.top":False,"axes.spines.right":False,"axes.titleweight":"bold",
                     "figure.facecolor":"white","axes.facecolor":"white","text.color":"#172C43",
                     "axes.labelcolor":"#172C43","xtick.color":"#52657A","ytick.color":"#52657A"})
BLUE="#2572B4"; TEAL="#16847C"; GREY="#94A3B4"; AMBER="#BE7C28"; RED="#B34B4B"; INK="#172C43"
def save(fig,name):
    fig.savefig(OUT/(name+".svg"),bbox_inches="tight")
    fig.savefig(OUT/(name+".png"),dpi=180,bbox_inches="tight")
    plt.close(fig)
def clean(ax):
    ax.grid(axis="x",alpha=.17);ax.set_axisbelow(True);ax.spines["left"].set_visible(False);ax.spines["bottom"].set_color("#CCD5DF")
data=json.loads((ROOT/"docs/research-agent-system/benchmark-data.json").read_text())["sources"]
fig,axs=plt.subplots(2,2,figsize=(14,11))
fig.subplots_adjust(left=.20,right=.96,bottom=.14,top=.88,wspace=.8,hspace=.75)
fig.suptitle("What the research supports",x=.04,y=.98,ha="left",fontsize=23)
fig.text(.04,.94,"Published author results • different tasks and metrics • no Market Metro performance forecast",fontsize=11,color="#52657A")
a=axs[0,0];rows=data["mle_star"]["rows"];y=np.arange(len(rows))
a.barh(y,[r[1] for r in rows],xerr=[r[2] for r in rows],color=[GREY,BLUE,BLUE,TEAL,TEAL],height=.58,capsize=3)
a.set_yticks(y,[r[0] for r in rows]);a.invert_yaxis();a.set_xlim(0,60);a.set_xlabel("Any medal (%) · error bars: ±1 SEM")
a.set_title("A  MLE-STAR: a matched-model comparison",loc="left",pad=28,fontsize=12)
a.text(0,1.03,"Gemini 2.0 Flash · 22 tasks · 3 seeds · max 24h",transform=a.transAxes,fontsize=9)
for i,r in enumerate(rows): a.text(r[1]+r[2]+1,i,f"{r[1]:.1f}",va="center",fontsize=9)
clean(a)
a=axs[0,1];rows=data["ds_star"]["rows"];y=np.arange(len(rows))
a.barh(y,[r[1] for r in rows],color=[GREY,GREY,GREY,TEAL],height=.58)
a.set_yticks(y,[r[0] for r in rows]);a.invert_yaxis();a.set_xlim(0,60);a.set_xlabel("DABStep hard accuracy (%)")
a.set_title("B  DS-STAR: which components matter?",loc="left",pad=28,fontsize=12)
a.text(0,1.03,"Gemini 2.5 Pro · v4 · uncertainty not reported",transform=a.transAxes,fontsize=9)
for i,r in enumerate(rows): a.text(r[1]+1,i,f"{r[1]:.2f}",va="center",fontsize=9)
clean(a)
a=axs[1,0];rows=data["harness2"]["rows"];y=np.arange(len(rows))
a.errorbar([r[1] for r in rows],y-.1,xerr=[r[2] for r in rows],fmt="o",color=GREY,label="Base harness",capsize=3)
a.errorbar([r[3] for r in rows],y+.1,xerr=[r[4] for r in rows],fmt="o",color=BLUE,label="Harness², k=1",capsize=3)
a.set_yticks(y,[r[0] for r in rows]);a.invert_yaxis();a.set_xlim(50,90);a.set_xlabel("WorkBuddy macro-average score · ±1 SD")
a.set_title("C  Harness²: gains depend on the executor",loc="left",pad=28,fontsize=12)
a.text(0,1.03,"Same executor within each pair · 3 shuffled streams",transform=a.transAxes,fontsize=9)
a.legend(loc="lower left",bbox_to_anchor=(0,-.27),frameon=False,ncol=2,fontsize=9);clean(a)
a=axs[1,1];rows=data["jev_harness"]["rows"];y=np.arange(len(rows))
a.barh(y-.16,[r[1] for r in rows],height=.28,color=GREY,label="Isolated tool-choice accuracy")
a.barh(y+.16,[r[2] for r in rows],height=.28,color=TEAL,label="Whole-task success")
a.set_yticks(y,[r[0] for r in rows]);a.invert_yaxis();a.set_xlim(0,110);a.set_xlabel("Percent · distinct evaluation denominators")
a.set_title("D  JevAgentHarness: rankings can reverse",loc="left",pad=28,fontsize=12)
a.text(0,1.03,"BFCL versus shifted DecisionGym · not our tasks",transform=a.transAxes,fontsize=9)
for i,r in enumerate(rows):
    a.text(r[1]+1,i-.16,str(r[1]),va="center",fontsize=8)
    a.text(r[2]+1,i+.16,str(r[2]),va="center",fontsize=8)
a.legend(loc="lower left",bbox_to_anchor=(0,-.38),frameon=False,fontsize=9);clean(a)
fig.text(.04,.035,"Sources: MLE-STAR, NeurIPS 2025, Table 4; DS-STAR v4, Table 4; Harness², Table 1;\nJevAgentHarness v1, Figure 4b. Full URLs, settings and numeric rows: benchmark-data.json.",fontsize=9,color="#52657A")
save(fig,"published-benchmarks")

def canvas(title,subtitle,h=9):
    fig,ax=plt.subplots(figsize=(14,h));ax.set_xlim(0,100);ax.set_ylim(0,100);ax.axis("off")
    fig.subplots_adjust(left=.03,right=.97,bottom=.06,top=.90)
    fig.suptitle(title,x=.04,y=.98,ha="left",fontsize=23)
    fig.text(.04,.93,subtitle,fontsize=11,color="#52657A")
    return fig,ax
def box(ax,x,y,w,h,title,body="",color=BLUE,fill="#F3F7FB",fs=11):
    ax.add_patch(FancyBboxPatch((x,y),w,h,boxstyle="round,pad=.45,rounding_size=.7",linewidth=1.2,edgecolor=color,facecolor=fill,zorder=3))
    ax.text(x+1.5,y+h-2,title,va="top",weight="bold",fontsize=fs,color=color,zorder=4)
    if body: ax.text(x+1.5,y+h-6,body,va="top",fontsize=9.5,color=INK,linespacing=1.5,zorder=4)
def arrow(ax,a,b,color="#72869A",label="",rad=0):
    ax.add_patch(FancyArrowPatch(a,b,arrowstyle="-|>",mutation_scale=13,linewidth=1.4,color=color,connectionstyle=f"arc3,rad={rad}",zorder=2))
    if label: ax.text((a[0]+b[0])/2,(a[1]+b[1])/2+1,label,ha="center",fontsize=8,color=color,backgroundcolor="white",zorder=5)

fig,ax=canvas("Market Metro · proposed agent architecture","Research-backed design • existing checkpoint runner retained • classifier and specialists are proposed",10)
box(ax,2,80,29,16,"CHANNEL3 PLANE","Cached product catalog\nExternal product IDs and provenance",BLUE)
box(ax,36,80,29,16,"EMULATOR PLANE","Seeded shoppers, stock, shocks\nCoupons, orders and simulated refunds",TEAL,"#F0F8F5")
box(ax,70,80,28,16,"PAYPAL PLANE","Selected sandbox order captures\nActual receipt status, fees and IDs","#7355A5","#F7F4FB")
for x in [16,50,84]: arrow(ax,(x,80),(x,74))
box(ax,2,61,96,13,"VERSIONED EVIDENCE + TWO CLOCKS","Catalog/schema → dataset → features → model → campaign; event time and provider time stay distinct",BLUE)
ax.text(2,56,"AGENT PLANE  /  bounded reasoning at checkpoints, never one LLM call per shopper",weight="bold",fontsize=10)
box(ax,2,41,22,12,"1. Eligibility","Freshness + budget + scope",INK)
box(ax,28,41,22,12,"2. Typed router","Inspect / train / revise / wait",BLUE)
box(ax,54,41,20,12,"3. Planner","Owns plan and next step",BLUE)
box(ax,78,41,20,12,"4. Verifier","Evidence + executed checks",TEAL,"#F0F8F5")
for a,b in [(24,28),(50,54),(74,78)]: arrow(ax,(a,47),(b,47))
arrow(ax,(13,61),(13,53))
box(ax,13,22,22,12,"Analyst","Questions, joins, diagnosis",BLUE)
box(ax,39,22,22,12,"Model engineer","Ablate → train → qualify",BLUE)
box(ax,65,22,22,12,"Campaign designer","Targets, coupons, experiment",BLUE,fs=10)
arrow(ax,(64,41),(64,37));arrow(ax,(64,37),(24,34));arrow(ax,(64,37),(50,34));arrow(ax,(64,37),(76,34))
box(ax,2,2,47,13,"DETERMINISTIC EFFECT EXECUTOR","Persists IDs → dispatches → reconciles\nLocal tools / coupon delivery / selected PayPal samples",TEAL,"#F0F8F5",fs=10)
box(ax,54,2,44,13,"OFFLINE HARNESS IMPROVEMENT","Propose → probe → compose → regression gate\nCannot edit permissions, holdouts or payment rules",AMBER,"#FFF9EE",fs=10)
ax.text(50,19,"Specialists return artifacts to the planner and verifier",ha="center",fontsize=9,color=BLUE)
ax.plot([94,94,25],[41,17,17],color="#72869A",linewidth=1.4,zorder=2)
arrow(ax,(25,17),(25,15))
ax.text(94,35,"validated effects",rotation=90,ha="right",va="center",fontsize=8,color=TEAL,backgroundcolor="white")
fig.text(.04,.015,"Proposed flow, not an implemented multi-agent deployment. Borrowed mechanisms: DS-STAR, MLE-STAR, JevAgentHarness, Harness², TRACE/EA-Graph.",fontsize=8.5,color="#52657A")
save(fig,"architecture")

fig,ax=canvas("Resume the work · preserve the effects","Proposed dependency-aware recovery • checkpoint persistence alone cannot establish evidence freshness",9)
box(ax,2,76,27,18,"1. Observe and pin","Dataset + schema + catalog hashes\nWindow, cutoff, objective, budget",BLUE)
box(ax,36,76,27,18,"2. Analyze and qualify","Query outputs + model validation\nArtifact dependencies recorded",BLUE)
box(ax,70,76,28,18,"3. Commit a campaign","Revision + eligible cohort + offer\nHard checks before activation",TEAL,"#F0F8F5")
arrow(ax,(29,85),(36,85));arrow(ax,(63,85),(70,85))
box(ax,2,47,27,18,"Change or restart","Compare stored dependencies\nMark affected artifacts stale",AMBER,"#FFF9EE")
box(ax,36,47,27,18,"Repair only affected work","Planner selects the missing check\nRevalidate before continuation",BLUE)
box(ax,70,47,28,18,"Record intended effect","Stable ID + exact payload + key\nCoupon or selected native order",TEAL,"#F0F8F5")
arrow(ax,(15,76),(15,65));arrow(ax,(29,56),(36,56));arrow(ax,(49,65),(49,76),label="new evidence")
arrow(ax,(84,76),(84,65))
box(ax,2,14,27,19,"Immutable history","Issued coupons stay issued\nCaptured payments stay captured\nNever erase them on replanning",INK)
box(ax,36,14,27,19,"Verified receipt","Match ID, amount and currency\nAppend provider observation",TEAL,"#F0F8F5")
box(ax,70,14,28,19,"Dispatch / unknown result","Success → verify\nTimeout → reconcile same identity\nNo fresh key to hide uncertainty",AMBER,"#FFF9EE")
arrow(ax,(84,47),(84,33));arrow(ax,(70,23),(63,23));arrow(ax,(36,23),(29,23))
fig.text(.04,.015,"PayPal deduplication applies to supported endpoints within their key-retention period. Unknown outcomes may require reconciliation; this is not a universal exactly-once claim.",fontsize=9,color="#52657A")
save(fig,"checkpoint-recovery")

run=json.loads((ROOT/"docs/campaign-workflow/first-run.json").read_text())
e=run["evaluation"];exp=e["baselineActiveExperiment"]
fig,(a,b)=plt.subplots(1,2,figsize=(13.5,6.5))
fig.subplots_adjust(left=.10,right=.95,top=.76,bottom=.22,wspace=.48)
fig.suptitle("What our prototype has actually demonstrated",x=.04,y=.96,ha="left",fontsize=22)
fig.text(.04,.88,"One assistant-planned campaign • local CPU training • no app-hosted LLM or paid model API calls",fontsize=11,color="#52657A")
labels=["Decision records","Shoppers traced","Coupons sent","Coupon redemptions","Native sandbox captures"]
values=[e["decisions"],e["customers"],e["coupons"],e["redemptions"],len(e["nativePayments"])]
a.axis("off")
for i,(label,value) in enumerate(zip(labels,values)):
    y=.95-i*.19
    a.text(0,y,f"{value:,}",fontsize=25,weight="bold",color=TEAL,va="top")
    a.text(.48,y-.02,label,fontsize=12,va="top")
b.axvline(0,color=GREY,linewidth=1.2)
delta=exp["difference"]*100;lo=exp["ciLow"]*100;hi=exp["ciHigh"]*100
b.errorbar([delta],[0],xerr=[[delta-lo],[hi-delta]],fmt="o",color=BLUE,markersize=9,capsize=7,linewidth=2)
b.set_xlim(-10,40);b.set_ylim(-.5,.7);b.set_yticks([])
b.set_xlabel("Repeat-purchase difference (percentage points)")
b.set_title("Campaign lift remains inconclusive",loc="left",fontsize=13)
b.text(delta,.18,f"+{delta:.1f} pp",ha="center",fontsize=16,weight="bold")
b.text(.02,.08,"Targetable: 79 / 125 · holdout: 24 / 50\nApproximate 95% interval: −1.0 to +31.4 pp",transform=b.transAxes,fontsize=10)
clean(b)
fig.text(.04,.095,"The 222 campaign purchases are synthetic. Only 3 selected orders have native sandbox receipts ($139.28 gross; $5.63 fees).\nThe records establish workflow execution and receipt lineage—not incremental PayPal profit, generalization or individually prevented churn.",fontsize=10,color="#52657A")
fig.text(.04,.025,"Source: docs/campaign-workflow/first-run.json · WF-26c901ed73bed8b1 · simulated outcomes and provider receipts kept separate.",fontsize=9,color="#52657A")
save(fig,"prototype-evidence")
# Machine-readable flat rows for reuse; no spreadsheet formulas or hidden recalculation.
with (ROOT/"docs/research-agent-system/benchmark-data.csv").open("w",newline="") as f:
    w=csv.writer(f);w.writerow(["study","configuration","values_in_source_column_order","source","source_location","setting","uncertainty"])
    for name,study in data.items():
        for row in study["rows"]: w.writerow([name,row[0],json.dumps(row[1:]),study["url"],study["table"],study["setting"],study["uncertainty"]])
print("Rendered 4 SVG + 4 PNG figures; numeric inputs preserved.")

