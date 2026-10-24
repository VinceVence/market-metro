"""Export fresh Gemini benchmark figures using only saved results."""
from pathlib import Path
import json, os
ROOT=Path(__file__).resolve().parents[1]
os.environ.setdefault("MPLCONFIGDIR",str(ROOT/".local/matplotlib"))
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager
import numpy as np
BASE=ROOT/"docs/policy-lab/benchmarks/v2"
OUT=ROOT/"docs/figures/policy-lab-benchmark-v2"
OUT.mkdir(parents=True,exist_ok=True)
r=json.loads((BASE/"result.json").read_text())
p=json.loads((BASE/"protocol.json").read_text())
for f in (ROOT/"demo/assets/fonts").glob("*.ttf"):font_manager.fontManager.addfont(str(f))
plt.rcParams.update({"font.family":"DM Sans","font.size":11,"svg.fonttype":"path","text.parse_math":False,
    "axes.spines.top":False,"axes.spines.right":False,"axes.spines.left":False,"figure.facecolor":"white",
    "text.color":"#24424D","axes.labelcolor":"#24424D","xtick.color":"#526E79","ytick.color":"#526E79"})
order=["fresh_gemini","conservative_code","rules_matched","rules_fast"]
colors={"fresh_gemini":"#276B76","conservative_code":"#619B68","rules_matched":"#B27936","rules_fast":"#8A73A8"}
labels={"fresh_gemini":"Fresh Gemini team","conservative_code":"Conservative code · no LLM","rules_matched":"Original rules · matched latency","rules_fast":"Original rules · immediate"}
summary={s["policy"]:s["metrics"] for s in r["summaries"]}
foot=f"Fresh decisions · {r['completedCases']} paired cases · {r['seedCount']} seed clusters × 5 fixed scenarios\nFrozen simulator · actual model-token cost included · synthetic outcomes, not production PayPal ROI"
figures=[]
def save(fig,name,caption):
    for ext in ["png","svg","pdf"]:fig.savefig(OUT/f"{name}.{ext}",dpi=180,bbox_inches="tight")
    plt.close(fig)
    figures.append({"name":name,"caption":caption,"files":{ext:f"/figures/policy-lab-benchmark-v2/{name}.{ext}" for ext in ["png","svg","pdf"]}})
def head(fig,title,sub):
    fig.text(.04,.97,title,va="top",fontsize=21,weight="bold")
    fig.text(.04,.90,sub,va="top",fontsize=10.5,color="#526E79")
def points(ax,metric,y,color):
    ax.errorbar(metric["mean"],y,xerr=[[metric["mean"]-metric["low"]],[metric["high"]-metric["mean"]]],fmt="o",color=color,lw=1.8,capsize=4,ms=6)

fig,ax=plt.subplots(figsize=(12,6.8));fig.subplots_adjust(left=.31,right=.96,top=.76,bottom=.23)
head(fig,"A · Fresh decisions: does PayPal benefit?","Mean difference versus no campaign · 95% paired seed-cluster bootstrap intervals")
for y,policy in enumerate(order):points(ax,summary[policy]["deltaPlatformUSD"],y,colors[policy])
ax.axvline(0,color="#526E79",ls="--",lw=1);ax.set_yticks(range(4),[labels[x] for x in order]);ax.invert_yaxis();ax.grid(axis="x",alpha=.2)
ax.set_xlabel("Additional modeled platform contribution (USD / 100 shoppers)")
fig.text(.04,.04,foot,fontsize=10,color="#526E79")
save(fig,"fresh-economic-impact","Fresh Gemini decisions compared with unchanged rules, conservative code and no campaign. Includes actual model cost.")

fig,ax=plt.subplots(figsize=(12,6.8));fig.subplots_adjust(left=.30,right=.96,top=.76,bottom=.23)
head(fig,"B · What does Gemini add beyond code?","Same market and shocks · paired differences · 95% seed-cluster intervals")
comparisons=[("No campaign","deltaPlatformUSD"),("Original rules · matched latency","deltaVsRulesUSD"),("Original rules · immediate","deltaVsImmediateRulesUSD"),("Conservative code · no LLM","deltaVsCodeUSD")]
for y,(_,key)in enumerate(comparisons):points(ax,summary["fresh_gemini"][key],y,colors["fresh_gemini"])
ax.axvline(0,color="#526E79",ls="--",lw=1);ax.set_yticks(range(4),[x[0] for x in comparisons]);ax.invert_yaxis();ax.grid(axis="x",alpha=.2)
ax.set_xlabel("Fresh Gemini contribution minus comparator (USD)")
fig.text(.04,.04,foot,fontsize=10,color="#526E79")
save(fig,"fresh-versus-code","Positive values favor Gemini; negative values favor the named comparator. This does not isolate three agents versus one LLM.")

options={"observe":0,"recommend_selective":1,"reactivate_short":2,"recommend_short":3,"coupon_probe":4}
matrix=np.full((len(r["cases"]),3),5)
for i,case in enumerate(r["cases"]):
    for j,review in enumerate(case["reviews"]):
        d=review.get("decisions")
        if j<3 and d and review["publicationStatus"]=="PUBLISHED":matrix[i,j]=0 if d["reviewer"]["decision"]=="reject" else options[d["scientist"]["policyId"]]
fig,ax=plt.subplots(figsize=(10,11));fig.subplots_adjust(left=.27,right=.84,top=.83,bottom=.17)
head(fig,"C · Every fresh campaign decision","Final published choice per review · failures remain visible")
cmap=matplotlib.colors.ListedColormap(["#DFE6E1","#276B76","#619B68","#B27936","#8A73A8","#B85D4A"])
ax.imshow(matrix,cmap=cmap,vmin=-.5,vmax=5.5,aspect="auto")
ax.set_xticks(range(3),["After day30","After day55","After day80"])
ax.set_yticks(range(len(r["cases"])),[f"{c['seed']} · {c['scenario'].replace('_',' ')}" for c in r["cases"]],fontsize=8)
ax.tick_params(length=0);ax.set_xlabel("Pinned evidence cutoff; publication occurs after inference")
legend=[matplotlib.patches.Patch(color=cmap(i),label=x) for i,x in enumerate(["Observe","Selective recommendation","Lapsed-shopper pilot","Broader short pilot","Coupon pilot","Failed review"])]
fig.legend(handles=legend,loc="lower center",bbox_to_anchor=(.53,.075),ncol=3,frameon=False,fontsize=9)
fig.text(.04,.02,foot,fontsize=9,color="#526E79")
save(fig,"fresh-decisions","Every case and review, including rejection or failure. Decisions are newly generated by Gemini from pinned observed evidence.")

fig,axes=plt.subplots(1,2,figsize=(13,6.7));fig.subplots_adjust(left=.09,right=.96,top=.76,bottom=.24,wspace=.30)
head(fig,"D · Actual inference cost and publication delay","All attempts count toward cost; publication-delay boxes include successful publications only")
axes[0].bar(range(1,len(r["cases"])+1),[c["modelCostUSD"] for c in r["cases"]],color="#276B76")
axes[0].set_xlabel("Fresh case (predeclared order)");axes[0].set_ylabel("Provider-token cost estimate (USD)");axes[0].grid(axis="y",alpha=.2)
delays=[[rev["publishedDay"]-rev["cutoff"] for c in r["cases"] for rev in c["reviews"] if rev["cutoff"]==d and rev["publicationStatus"]=="PUBLISHED"] for d in [30,55,80]]
axes[1].boxplot(delays,tick_labels=["Day30","Day55","Day80"],showmeans=True)
axes[1].set_ylabel("Simulated days until publication");axes[1].set_xlabel("Evidence cutoff");axes[1].grid(axis="y",alpha=.2)
fig.text(.04,.11,f"{r['costs']['newModelCalls']} evaluation calls · ${r['costs']['newModelUSD']:.6f} recorded evaluation cost\nDevelopment pilots included in suite total: ${r['costs']['suiteUSD']:.6f}. Local CPU, electricity and labor are unpriced.",fontsize=10,color="#526E79")
fig.text(.04,.025,foot,fontsize=9,color="#526E79")
save(fig,"fresh-cost-latency","Measured costs and publication delays, with failed development pilots separately included in suite spending.")

public={k:v for k,v in r.items() if k not in ["rows","cases"]}
public["figures"]=figures
public["cases"]=[]
for c in r["cases"]:
    item={k:v for k,v in c.items() if k!="branches"}
    branch=next(b for b in c["branches"] if b["policy"]=="fresh_gemini")
    item["score"]={k:branch[k] for k in ["purchases","offers","recommendations","redemptions","deltaPlatformUSD","deltaVsRulesUSD","deltaVsCodeUSD","fits","publications"]}
    public["cases"].append(item)
public["protocol"]=p
fresh_worlds=[b for b in r["rows"] if b["policy"]=="fresh_gemini"]
reviews=[review for case in r["cases"] for review in case["reviews"]]
public["behavior"]={"recommendations":sum(b["recommendations"] for b in fresh_worlds),"coupons":sum(b["offers"] for b in fresh_worlds),
    "redemptions":sum(b["redemptions"] for b in fresh_worlds),"zeroOutreachCases":sum(b["recommendations"]+b["offers"]==0 for b in fresh_worlds),
    "localFits":sum(len(b["fits"]) for b in fresh_worlds),"reviews":len(reviews),"publishedReviews":sum(review["publicationStatus"]=="PUBLISHED" for review in reviews)}
public["semanticFindings"]=[]
first_case=r["cases"][0]
for review in first_case["reviews"]:
    analyst=(review.get("decisions") or {}).get("analyst")
    if analyst and "strong organic demand" in analyst["rationale"]:
        public["semanticFindings"].append({"caseId":first_case["caseId"],"cutoff":review["cutoff"],"role":"analyst",
            "quote":analyst["rationale"],"finding":"The observed increase is real, but attributing it to organic demand is unsupported without a causal comparison. Numeric validation does not validate this explanation.",
            "method":"Manual, non-exhaustive review of the first completed case; not an accuracy-rate estimate."})
        break
(BASE/"index.json").write_text(json.dumps(public,indent=2)+"\n")
cols=["seed","scenario","policy","purchases","platformProxyCents","allocatedModelUSD","deltaPlatformUSD","deltaVsRulesUSD","merchantContributionCents","deltaMerchantUSD","retainedCents","deltaVolumeUSD","offers","recommendations","redemptions"]
import csv
with(BASE/"cases.csv").open("w",newline="")as f:
    writer=csv.DictWriter(f,fieldnames=cols,extrasaction="ignore");writer.writeheader();writer.writerows(r["rows"])
fresh=summary["fresh_gemini"]
def money(value):return f"${value:+.4f}"
table="\n".join(f"| {labels[policy]} | {money(summary[policy]['deltaPlatformUSD']['mean'])} | {money(summary[policy]['deltaPlatformUSD']['low'])} to {money(summary[policy]['deltaPlatformUSD']['high'])} | {money(summary[policy]['deltaMerchantUSD']['mean'])} |" for policy in order)
report=f"""# Fresh Gemini policy benchmark v2

The simulator and original rules remained frozen. This evaluation generated new Gemini decisions from each case's observed evidence; it does not replay saved campaign choices.

[Open the benchmark](http://127.0.0.1:4173/?run=GARDEN-LAB-df43cd08499c0c0a&policyLab=GARDEN-LAB-df43cd08499c0c0a&policyView=benchmarks)

## Result

{r['completedCases']} paired cases: {r['seedCount']} new seed clusters × five fixed scenarios, with five policy branches per case. Each world has 100 shoppers, 30 history days, 70 campaign days and a 14-day return tail.

| Policy | Mean platform difference vs no campaign | 95% seed-cluster interval | Mean merchant difference |
|---|---:|---:|---:|
{table}

Fresh Gemini versus original immediate rules: {money(fresh['deltaVsImmediateRulesUSD']['mean'])}, interval {money(fresh['deltaVsImmediateRulesUSD']['low'])} to {money(fresh['deltaVsImmediateRulesUSD']['high'])}.

Fresh Gemini versus the conservative code-only policy: {money(fresh['deltaVsCodeUSD']['mean'])}, interval {money(fresh['deltaVsCodeUSD']['low'])} to {money(fresh['deltaVsCodeUSD']['high'])}. Improvement over an unnecessarily expensive campaign does not establish an LLM advantage. The no-campaign control remains the economic reference.

These are **modeled platform contribution** differences after actual recorded model cost, not real PayPal profit. Six seed clusters form a small pilot; intervals do not cover uncertainty in the authored economic model or repeated fresh LLM draws. Scenario breakdowns are exploratory, with no multiplicity correction. Agent-count advantage against a single LLM planner was not tested.

V2 is implemented as a separate evaluation runner and exposed in the Benchmarks tab. The existing live-demo runner is preserved; this benchmark does not silently promote an unproven policy to the New experiment flow.

## Policy changes

- Campaigns expire after three or seven days rather than running indefinitely between reviews.
- Random post-history offer exploration is zero. Conservative policies apply an explicit predicted-reward penalty; it is not a causal confidence interval.
- Gemini selects an evidence focus, policy, merchants, training window and refit/reuse decision. A separately prompted Gemini reviewer approves or rejects the proposal.
- Separate observe and active-campaign tools prevent an active campaign from being published without a model. Numeric purchase facts and evidence IDs are checked against the exact snapshot.
- All local training uses the unchanged seven features and only mature past outcomes. No hidden customer traits, future scenario labels or other-world outcomes enter the planner's packet.

Development inspected 17 local policy variants on the pre-existing three development seeds. The selected cautious recommendation policy had only a small positive development mean; that is selection-biased preliminary evidence, not a result for the evaluation seeds. A common-support training variant was abandoned after insufficient mature data and was not deployed.

## Matched controls and timing

Original rules use the unchanged `rulesPlan` and learner. The immediate branch acts after days30,55,80; the matched branch publishes when the fresh team finishes. The no-LLM conservative control uses the selected three-day policy and matched publication timing. The no-campaign branch observes without outreach after history collection.

All branches advance together every1.5 seconds while Gemini reasons. Outside inference the runner advances locally without waiting. This measures actual publication delay in the accelerated simulator; it is not a production latency forecast. Each completed review saves its publication day and model, so recovery uses the same timing. An interrupted review without a completion record stops for inspection rather than silently moving its publication earlier.

The version1 saved-plan results are historical context, not a same-seed comparison. World mechanics, merchant constraints, catalog, costs and reward definitions are pinned to the original hashes in [protocol.json](protocol.json). Policy code is separately frozen before the new evaluation seeds are run.

## Spending and reliability

- Evaluation: {r['costs']['newModelCalls']} actual requests; ${r['costs']['newModelUSD']:.6f} provider-token cost estimate.
- Entire v2 suite including all development pilots: ${r['costs']['suiteUSD']:.6f}, under the $1 suite ceiling.
- Recorded lifetime model spend: ${r['costs']['lifetimeUSD']:.6f}, below the user's $50 ceiling. The stricter $8 local lifetime and $0.25 per-case limits remain unchanged.
- {r['invalidAttempts']} validation-rejected evaluation attempts; {r['failedReviews']} failed evaluation reviews retained in outcomes.
- Actual effects: {public['behavior']['recommendations']} recommendations, {public['behavior']['coupons']} coupons, {public['behavior']['redemptions']} redemptions and {public['behavior']['localFits']} local fits. {public['behavior']['zeroOutreachCases']} cases produced no outreach at all. Choosing a campaign plan is not the same as actually delivering an offer.
- No new payment API calls or APAC changes. Local electricity, hardware depreciation and operator labor are unpriced, not asserted to be free.
- Development retained one provider-schema failure and one model-action validation failure, followed by a successful pilot. Their calls and costs remain in the ledger and `pilot/` artifacts.

Costs are estimates from provider-reported tokens, not final billing invoices. All failed and corrected attempts are included. Numeric/schema validation does not guarantee that every natural-language justification is correct; inspect the per-case decision log.

Manual review of the first completed case found an unsupported attribution to "strong organic demand": the purchase increase was observed, but the agent had no control-world comparison to establish its cause. This non-exhaustive finding is surfaced in the UI and is not presented as a measured semantic accuracy rate.

## Reproduce and inspect

`node scripts/policy-lab/fresh-benchmark.mjs --run` resumes this exact frozen suite. Completed case results are reused; unknown in-flight paid calls are not retried. Do not change policy files and rerun the same holdout as if untouched. A new version requires a new protocol and new confirmatory seeds after tuning.

`.local/research-venv/bin/python scripts/plot-fresh-policy.py` rebuilds figures and the browser index without new model or payment calls.

[Full results](result.json) · [Per-world CSV](cases.csv) · [Frozen protocol](protocol.json)

Research figures are in `docs/figures/policy-lab-benchmark-v2/`, each as PNG, SVG and PDF. Per-case model requests, outputs, usage and published model artifacts remain under `cases/`. The app's Fresh decision log explains each agent's known facts and public justification.
"""
(BASE/"README.md").write_text(report)
print(f"Rendered {len(figures)} fresh-benchmark figures and public index.")
