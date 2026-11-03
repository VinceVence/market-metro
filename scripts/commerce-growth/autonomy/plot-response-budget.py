"""Show all shadow outcomes and reconcile the modeled net change."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

d=json.loads(Path('demo/data/commerce-response-budget-shadow.json').read_text())
r=d['report'];delta=r['differences']['baseline_v1'];pairs=delta['pairs'];a=r['means']['selected'];b=r['means']['baseline_v1']
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False})
fig,axes=plt.subplots(1,3,figsize=(15,6.7),gridspec_kw={'width_ratios':[1.1,1,.85]})
bg='#f6f9ff';fig.patch.set_facecolor(bg)
axes[0].barh(np.arange(len(pairs)),[p['net'] for p in pairs],color=['#0070e0' if p['net']>0 else '#b95563' for p in pairs])
axes[0].set_yticks(np.arange(len(pairs)),[p['regime'].replace('_',' ')+f" {p['panel']+1}" for p in pairs],fontsize=8)
axes[0].invert_yaxis();axes[0].set_xlabel('Candidate − v1 net after AI (USD)');axes[0].set_title('A  Every held-out market',loc='left',weight='bold')
keys=['outreach','retailFees','supplierFees','processing','refunds'];labels=['Outreach expense','Retail fees','Supplier fees','Processing','Returned fees','AI/design cost']
v=[a['paymentBreakdown'][k]-b['paymentBreakdown'][k] for k in keys]+[-r['additionalDesignCostUSD']/r['confirmationMarkets']]
axes[1].barh(range(len(v)),v,color=['#0070e0' if x>0 else '#b95563' for x in v]);axes[1].set_yticks(range(len(v)),labels);axes[1].invert_yaxis();axes[1].set_xlabel('Mean contribution change (USD)');axes[1].set_title('B  Source of the net change',loc='left',weight='bold');axes[1].margins(x=.3)
for i,x in enumerate(v):axes[1].annotate(f'{x:+.3f}',(x,i),xytext=(5 if x>=0 else -5,0),textcoords='offset points',ha='left' if x>=0 else 'right',va='center',fontsize=8)
metrics=['netAfterModelUSD','retailerUSD','terminalCashUSD'];pct=[100*(a[k]/b[k]-1) for k in metrics]
axes[2].barh(range(3),pct,color=['#0070e0' if x>0 else '#b95563' for x in pct]);axes[2].set_yticks(range(3),['PayPal net','Retailers','Partner cash']);axes[2].invert_yaxis();axes[2].set_xlabel('Change versus v1 (%)');axes[2].set_title('C  Partner tradeoff',loc='left',weight='bold');axes[2].margins(x=.35)
for i,x in enumerate(pct):axes[2].annotate(f'{x:+.3f}%',(x,i),xytext=(5 if x>=0 else -5,0),textcoords='offset points',ha='left' if x>=0 else 'right',va='center',fontsize=8)
for ax in axes:ax.set_facecolor(bg);ax.axvline(0,color='#243750',linewidth=.8);ax.grid(axis='x',alpha=.14);ax.set_axisbelow(True)
fig.suptitle('Outreach budget control · measured gain, unresolved tradeoff',x=.02,ha='left',fontsize=17,weight='bold',color='#003087')
fig.text(.02,.04,f"Mean PayPal gain: ${delta['meanNetUSD']:+.2f}/market;95% paired interval [{delta['interval']['low']:+.2f}, {delta['interval']['high']:+.2f}].\nRetailers: ${delta['meanRetailerUSD']:+.2f}/market; purchases unchanged.14 fixed markets, with original economy and policy frozen.\nSecondary shadow test of a pre-defined candidate. The agent retained v1 for release. Synthetic economics, not production PayPal profit.",fontsize=9,color='#43536c')
fig.tight_layout(rect=[0,.18,1,.94]);out=Path('docs/figures/response-budget');out.mkdir(parents=True,exist_ok=True)
for ext in ['png','svg']:fig.savefig(out/f'shadow-result.{ext}',dpi=180,bbox_inches='tight')
print(json.dumps({'meanNetChange':delta['meanNetUSD'],'ledgerSum':sum(v),'figure':str(out/'shadow-result.png')}))
