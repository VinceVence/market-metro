"""Report all development variants, including the failed merchant guard."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

root=Path('docs/commerce-growth/autonomy-1')
paths=['funding-probe-1','shared-contribution-probe-1','merchant-routing-probe-1']
reports=[json.loads((root/p/'results.json').read_text()) for p in paths]
rows=[r['summary'][0] for r in reports];fixed=reports[0]['baseline']
labels=['Funding feedback','Contribution model','Contribution + routing']
out=root/'merchant-gap-audit-1'
def money(n):return f'${n:,.2f}'
table='\n'.join(f"| {label} | {money(row['mean']['platformUSD'])} | {money(row['mean']['retailerUSD'])} | {money(row['mean']['terminalCashUSD'])} | {money(row['mean']['terminalInventoryUSD'])} | {' / '.join(money(v) for v in row['merchantDeltas'].values())} |" for label,row in zip(labels,rows))
text=f'''# Merchant-value development study

All three variants use the same seven previously used development markets. No unseen seed was opened, no application LLM decision was made and no native PayPal call occurred. These are local numerical model/controller experiments, not a new agent-performance result.

## Why the live campaign lost retailer contribution

An exact fixed-policy replay reproduced the live comparator. The team generated two more orders, $10 more captured revenue, $8 more refunds, $7 more delivery expense, $4.30 more consumed product cost, $1.03 more net payment fees and $0.43 more inventory holding cost. Together these explain the $10.76 retailer decline. Split-basket count was unchanged. The principal gap was the value of the added/replaced order mix, not an unexplained payment fee.

The underlying accounting is in [results.json](results.json). This is an explanatory replay of a spent seed; it is not a fresh validation run.

## A more appropriate prediction target

The response forest remains the same. An additional local value forest estimates payment contribution plus retailer order contribution, conditional on a retained purchase. Failure values include observed refund/product losses and outreach costs. The sum counts payment fees once: they enter platform contribution and leave retailer contribution. Inventory holding, supplier outcomes and displaced future purchases remain outside the per-contact label and are still assessed in full-world evaluation.

The training data contains 7,010 observed contacts and 457 retained purchases. Whole-development-market validation selected the forest; shared-value RMSE was 2194.04 cents versus 2229.49 for the coarse predictor. The JS export matched 128 Python predictions within 0.0000001 cents. This is predictive model-selection evidence, not proof of profit or causal uplift.

## Every variant

Strong fixed reference: platform {money(fixed['platformUSD'])}, retailers {money(fixed['retailerUSD'])}, partner cash {money(fixed['terminalCashUSD'])}, inventory {money(fixed['terminalInventoryUSD'])} per market.

| Variant | Platform net | Retailer contribution | Closing partner cash | Closing inventory | Merchant0 /1 /2 change vs fixed |
|---|---:|---:|---:|---:|---|
{table}

All variants preserve aggregate retailer contribution, supplier contribution and cash on these development means, stay within the inventory allowance, and end with no unpaid liabilities. **Every variant still fails at least one individual merchant guard.** Exact recommended-item purchases also remain below the fixed reference. No variant is promoted as a proven winner.

## What the allocation experiment guarantees—and what it does not

The secondary numerical tool starts from the reference allocator's chosen baskets on the **current observed state**. It may only substitute merchants for identical catalogue items and quantities, with unchanged buyer gross, payment fee and processing expense. It requires at least the reference aggregate immediate merchant order contribution. It then maximizes the least merchant's cumulative order contribution relative to its observed warmup contribution. A failed check falls back to the reference allocation.

Across the seven markets it changed 56 of 249 eligible allocation decisions, with zero fallback failures. The immediate contribution checks passed. **That did not preserve each merchant over the full horizon:** merchant0 ended down $238.72 per market. Stock, cash and subsequent allocations evolve after each decision; a local protection is not a terminal economic guarantee. The application team has not been given this routing tool as a default.

## Status and artifacts

The working live intent/conversion team and its measured prediction improvement remain intact. Financial completion is still unproven. The user subsequently chose autonomous workflow and model quality as the demo completion criteria, with profit reported separately. These financial measurements and failed individual guards remain unchanged.

- [Contribution-model training](../shared-value-training-1/model-report.json)
- [Export parity](../shared-value-training-1/js-parity.json)
- [Contribution-only full results](../shared-contribution-probe-1/results.json)
- [Routing full results](../merchant-routing-probe-1/results.json)
- [Current live team](../adaptation-live-1/README.md)

![All development variants](development-comparison.png)
'''
(out/'README.md').write_text(text)
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False})
fig,axes=plt.subplots(1,3,figsize=(16,5),layout='constrained')
xlabels=['Fixed','Feedback','Value','Value +\nrouting'];colors=['#899db8','#447db8','#0070e0','#003087']
for ax,key,title in zip(axes[:2],['platformUSD','retailerUSD'],['Modeled platform contribution','Aggregate retailer contribution']):
 bars=ax.bar(xlabels,[fixed[key]]+[r['mean'][key] for r in rows],color=colors);ax.bar_label(bars,fmt='$%.0f',padding=3);ax.set(title=title,ylabel='Mean USD per development market');ax.margins(y=.15)
for i,row in enumerate(rows):
 axes[2].bar([j+(i-1)*.25 for j in range(3)],list(row['merchantDeltas'].values()),width=.24,label=labels[i],color=colors[i+1])
axes[2].set_xticks(range(3),['Merchant0','Merchant1','Merchant2']);axes[2].axhline(0,color='#56667b',lw=.8);axes[2].set(title='Individual changes still matter',ylabel='Mean change vs fixed (USD)');axes[2].legend(fontsize=8)
for ax in axes:ax.grid(axis='y',alpha=.15);ax.set_axisbelow(True)
fig.suptitle('Merchant-aware learning and allocation · development evidence',fontsize=15)
fig.supxlabel('Seven known markets · same frozen economy and fixed reference · zero new LLM or native payment calls\nAggregate improvement does not erase individual losses. These are numerical prototypes, not fresh agent trials.',fontsize=10)
fig.savefig(out/'development-comparison.png',dpi=160);fig.savefig(out/'development-comparison.svg');plt.close(fig)
print(json.dumps({'report':str(out/'README.md'),'variants':len(rows),'allIndividualGuardsPassed':False}))
