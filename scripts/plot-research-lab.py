"""Render v3 measured workflow results. No network, payment or model calls."""
from pathlib import Path
import json, os, csv
from collections import Counter
ROOT=Path(__file__).resolve().parents[1]
os.environ.setdefault("MPLCONFIGDIR",str(ROOT/".local/matplotlib"))
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.patches import FancyBboxPatch,FancyArrowPatch
import numpy as np
BASE=ROOT/"docs/policy-lab/benchmarks/v3"
OUT=ROOT/"docs/figures/research-workflow-v3"
OUT.mkdir(parents=True,exist_ok=True)
r=json.loads((BASE/"result.json").read_text())
audit=json.loads((BASE/"opportunity-results.json").read_text())
protocol=json.loads((BASE/"protocol.json").read_text())
for font in (ROOT/"demo/assets/fonts").glob("*.ttf"):font_manager.fontManager.addfont(str(font))
plt.rcParams.update({"font.family":"DM Sans","font.size":11,"svg.fonttype":"path","text.parse_math":False,"axes.spines.top":False,"axes.spines.right":False,"axes.spines.left":False,"figure.facecolor":"white","text.color":"#24424D","axes.labelcolor":"#24424D","xtick.color":"#526E79","ytick.color":"#526E79"})
labels={"fixed":"Fixed workflow + shared reader","automl":"Automated search + shared reader","research":"Gemini research + reviewer"}
colors={"fixed":"#B27936","automl":"#8A73A8","research":"#276B76"}
figures=[]
def header(fig,title,subtitle):
    fig.text(.04,.97,title,va="top",fontsize=21,weight="bold")
    fig.text(.04,.90,subtitle,va="top",fontsize=10.5,color="#526E79")
def save(fig,name,caption):
    for ext in ["svg","png","pdf"]:fig.savefig(OUT/f"{name}.{ext}",dpi=180,bbox_inches="tight")
    plt.close(fig);figures.append({"name":name,"caption":caption,"files":{ext:f"/figures/research-workflow-v3/{name}.{ext}" for ext in ["svg","png","pdf"]}})
fig,ax=plt.subplots(figsize=(12,6.5));fig.subplots_adjust(left=.33,right=.96,top=.77,bottom=.24)
header(fig,"A · Does autonomous research add financial value?","Paired difference versus no campaign, after allocated inference cost · 95% paired bootstrap intervals")
for i,s in enumerate(r["summary"]):
    m=s["metrics"]["deltaPlatformUSD"];ax.errorbar(m["mean"],i,xerr=[[m["mean"]-m["low"]],[m["high"]-m["mean"]]],fmt="o",capsize=4,lw=1.7,color=colors[s["method"]],ms=7)
ax.set_yticks(range(3),[labels[s["method"]] for s in r["summary"]]);ax.invert_yaxis();ax.axvline(0,color="#657C86",ls="--",lw=1);ax.grid(axis="x",alpha=.2)
ax.set_xlabel("Additional modeled platform contribution (USD / 100 shoppers)")
fig.text(.04,.06,"Six authored missions · same interpreter, data, workers and tool ceilings · final outcomes sealed during planning\nSimulation estimates, not production PayPal ROI. Local electricity, hardware and labor are unpriced.",fontsize=10,color="#526E79")
save(fig,"research-value","Actual held-out mission outcomes after model costs. Successful research execution is not evidence of profitable deployment.")

fig,axes=plt.subplots(1,2,figsize=(13,6.8));fig.subplots_adjust(left=.10,right=.96,top=.75,bottom=.25,wspace=.35)
header(fig,"B · What the research workflow actually executed","Live Gemini choices and real local tools · fixed and automated-search methods use the same interfaces")
methods=["fixed","automl","research"];x=np.arange(3)
for j,(field,color)in enumerate([("queries","#C29B58"),("models","#8A73A8"),("pilots","#619B8C")]):
    values=[np.mean([next(m for m in c["methods"] if m["method"]==method)["counts"][field] for c in r["cases"]]) for method in methods]
    axes[0].bar(x+(j-1)*.24,values,width=.22,color=color,label=field.capitalize())
axes[0].set_xticks(x,["Fixed","Search","Research"]);axes[0].set_ylabel("Mean tool usage per mission");axes[0].legend(frameon=False,fontsize=9);axes[0].grid(axis="y",alpha=.2)
for j,method in enumerate(methods):
    values=[next(m for m in c["methods"] if m["method"]==method)["toolCalls"] for c in r["cases"]]
    axes[1].plot(range(1,len(values)+1),values,"o-",label=labels[method],color=colors[method])
axes[1].set_xlabel("Mission");axes[1].set_ylabel("Recorded tool decisions, including failures");axes[1].grid(alpha=.2)
axes[1].legend(frameon=False,fontsize=9,loc="upper left",bbox_to_anchor=(0,-.20))
fig.text(.04,.06,f"{r['costs']['modelCalls']} actual evaluation requests · ${r['costs']['actualModelUSD']:.6f} provider-token estimate\nQueries include failed attempts; models and pilots count completed work. Shared reader is billed once.",fontsize=10,color="#526E79")
save(fig,"research-work","Querying, model fitting and pilots actually executed. Counts describe work, not economic benefit or semantic accuracy.")

fig,ax=plt.subplots(figsize=(12,6.5));fig.subplots_adjust(left=.32,right=.96,top=.76,bottom=.25)
header(fig,"C · The free opportunity audit","72 fixed policy configurations · 1,195 local rollouts · zero model calls")
items=[("Selected on development",audit["bestDevelopment"],"#276B76"),("Selected policy on 50 new cases",audit["confirmation"],"#619B8C"),("Hindsight selection on development",audit["hindsightEnvelope"],"#B27936")]
for i,(label,m,color)in enumerate(items):ax.errorbar(m["mean"],i,xerr=[[m["mean"]-m["low"]],[m["high"]-m["mean"]]],fmt="o",color=color,capsize=4,lw=1.8,ms=7)
ax.set_yticks(range(3),[x[0] for x in items]);ax.invert_yaxis();ax.axvline(0,color="#657C86",ls="--",lw=1);ax.grid(axis="x",alpha=.2);ax.set_xlabel("Difference versus no campaign (USD)")
fig.text(.04,.06,"The general winner produced no outreach and no gain. Hindsight selects after seeing each outcome; it is not deployable.\nThis is not a mathematical upper bound. Untested policies and real-world calibration remain unknown.",fontsize=10,color="#526E79")
save(fig,"research-opportunity","A development search and an independent confirmation gate expose limited economic headroom without changing the world to favor an LLM.")

fig,ax=plt.subplots(figsize=(14,10));fig.subplots_adjust(left=.03,right=.98,top=.88,bottom=.05);ax.set_xlim(0,100);ax.set_ylim(0,100);ax.axis('off')
header(fig,"D · Implemented research architecture","Frozen economy and payment assumptions · adaptive tool selection · checkpointed effects · sealed evaluation")
def box(x,y,w,h,title,body,color="#276B76"):
    ax.add_patch(FancyBboxPatch((x,y),w,h,boxstyle="round,pad=.4,rounding_size=.8",facecolor="#F4F8F5",edgecolor=color,lw=1.2))
    ax.text(x+1.3,y+h-1.8,title,va='top',fontsize=11,weight='bold',color=color)
    ax.text(x+1.3,y+h-6,body,va='top',fontsize=9,linespacing=1.5,color="#34545C")
def arrow(a,b,label=""):
    ax.add_patch(FancyArrowPatch(a,b,arrowstyle='-|>',mutation_scale=13,color="#78928B",lw=1.4))
    if label:ax.text((a[0]+b[0])/2,(a[1]+b[1])/2+1,label,ha='center',fontsize=8,backgroundcolor='white',color="#526E79")
box(2,79,28,17,"Channel3 catalog","Cached product IDs and prices\nNo private merchant warehouse")
box(36,79,28,17,"Frozen emulator","Observed snapshot at day 45\nShopping and refunds in code")
box(70,79,28,17,"Existing PayPal plane","Live-app sandbox workflows\nNo native payments in this lab")
arrow((30,87),(36,87))
box(2,54,28,17,"Shared brief reader","One Gemini interpretation\nSame contract for all methods")
box(36,54,28,17,"Research lead · Gemini","Choose SQL, features and pilots\nRepair errors or stop")
box(70,54,28,17,"Code-only comparators","Fixed workflow and bounded\nautomated model comparison","#8A73A8")
arrow((50,79),(50,71),'observed data');arrow((30,62),(36,62),'constraints')
box(2,27,28,18,"Read-only SQL worker","SQLite authorizer + timeout\nNo future rows or filesystem")
box(36,27,28,18,"Local model worker","Generated linear expressions\nMature labels; temporal check")
box(70,27,28,18,"Development pilot worker","Three paired simulation replicas\nSeparate permitted feedback")
arrow((50,54),(16,45));arrow((50,54),(50,45));arrow((50,54),(84,45));arrow((84,54),(84,45))
arrow((76,45),(60,54),'pilot feedback')
box(2,2,28,16,"Checkpoint ledger","Requests, errors and artifacts\nCosts and stable effect identities")
box(36,2,28,16,"Reviewer + hard guards","Gemini may veto; cannot expand\nCode owns money and limits")
box(70,2,28,16,"Sealed final evaluation","Held-out future → JSON/CSV\nShared UI, traces and figures")
arrow((50,27),(50,18));arrow((64,10),(70,10));arrow((30,10),(36,10))
fig.text(.04,.012,"Linear recipes compile to the unchanged seven-input policy interface. Pilot feedback is simulated; it is not a live-customer RCT.",fontsize=9,color="#526E79")
save(fig,"research-architecture","Implemented tools and authority boundaries. The prior PayPal Sandbox integration stays in the live app; research cannot issue payments.")

failures=Counter(j['output']['error'] for c in r['cases'] for m in c['methods'] if m['method']=='research' for j in m['journal'] if j['status']=='FAILED')
error_labels={'no such column: merchant_index':'invalid column queries','READ_ONLY_SELECT_REQUIRED':'unsupported schema queries','CITE_PILOT_MEAN_IN_USD_WITHIN_HALF_A_CENT':'incorrect pilot amount submissions'}
diagnostics={'failedTools':sum(failures.values()),'failureCategories':[{'code':code,'label':error_labels.get(code,code),'count':count} for code,count in failures.items()],'semanticAudit':json.loads((BASE/'semantic-audit.json').read_text())}
public={**r,"diagnostics":diagnostics,"figures":figures,"labels":labels,"opportunity":{k:audit[k] for k in ['configurations','rollouts','bestDevelopment','confirmation','hindsightEnvelope','caveats']}}
(BASE/"index.json").write_text(json.dumps(public,indent=2)+"\n")
with(BASE/"cases.csv").open('w',newline='')as f:
    fields=['mission','method','complete','tools','queries','models','pilots','delta_platform_usd','allocated_model_usd'];writer=csv.DictWriter(f,fieldnames=fields);writer.writeheader()
    for case in r['cases']:
        for m in case['methods']:writer.writerow(dict(mission=case['taskId'],method=m['method'],complete=m['completed'],tools=m['toolCalls'],queries=m['counts']['queries'],models=m['counts']['models'],pilots=m['counts']['pilots'],delta_platform_usd=m['deltaPlatformUSD'],allocated_model_usd=m['allocatedModelUSD']))
print('Rendered 4 research figures and public workspace index.')
