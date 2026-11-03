"""Render registered paired results; no smoothing or omitted losing markets."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

root = Path('docs/commerce-growth/roc-net-goal-1/net-revision-confirmation-1')
r = json.loads((root/'results.json').read_text())
rows = json.loads((root/'rows.json').read_text())['rows']
p = json.loads((root/'protocol.json').read_text())
n = len(p['cases'])
cost = r['costUSD']/n
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False,'axes.titleweight':'bold'})
fig, axes = plt.subplots(1, 3, figsize=(16, 5.2), gridspec_kw={'width_ratios':[1.1,.85,1.15]})
fig.patch.set_facecolor('#f6f9ff')
lookup = {(x['case'],x['arm']):x for x in rows}
d = [lookup[(c['id'],'revised')]['netAfterModelUSD']-lookup[(c['id'],'fixed')]['platformUSD'] for c in p['cases']]
labels = [c['regime'].replace('_',' ')+' '+str(c['panel']+1) for c in p['cases']]
axes[0].barh(np.arange(n), d, color=['#0070e0' if v>=0 else '#c04b5a' for v in d])
axes[0].set_yticks(np.arange(n),labels,fontsize=8)
axes[0].invert_yaxis(); axes[0].axvline(0,color='#172b4d',lw=.7)
axes[0].set_title('A  Every fresh market'); axes[0].set_xlabel('Modeled PayPal net − fixed (USD)')
arms = ['without_outreach','without_fulfillment']
effects = [np.mean([lookup[(c['id'],'revised')]['netAfterModelUSD']-lookup[(c['id'],a)]['platformUSD'] for c in p['cases']]) for a in arms]
axes[1].bar(np.arange(2),effects,color=['#003087','#009cde'])
axes[1].set_xticks(np.arange(2),['Broader needs\ninquiries','Complete-basket\ncoordination'])
axes[1].axhline(0,color='#172b4d',lw=.7); axes[1].set_title('B  Contribution of each change'); axes[1].set_ylabel('Full policy − component removed (USD / market)')
axes[1].margins(y=.18)
for i,v in enumerate(effects):axes[1].annotate(f'{v:+.2f}',(i,v),ha='center',va='bottom' if v>=0 else 'top',xytext=(0,4 if v>=0 else -4),textcoords='offset points')
components = ['retailFees','supplierFees','processing','outreach','refunds','other']
v = [np.mean([lookup[(c['id'],'revised')]['paymentBreakdown'][k]-lookup[(c['id'],'fixed')]['paymentBreakdown'][k] for c in p['cases']]) for k in components]
v.append(-cost)
axes[2].barh(np.arange(7),v,color=['#0070e0' if x>=0 else '#c04b5a' for x in v])
axes[2].set_yticks(np.arange(7),['Retail fees','Supplier fees','Processing','Outreach','Returned fees','Other','AI design cost'])
axes[2].invert_yaxis();axes[2].axvline(0,color='#172b4d',lw=.7)
axes[2].set_title('C  Where net changes');axes[2].set_xlabel('Contribution − fixed (USD / market)')
for ax in axes:ax.set_facecolor('#f6f9ff');ax.grid(axis='x' if ax!=axes[1] else 'y',alpha=.12);ax.set_axisbelow(True)
fig.suptitle('A frozen Gemini commerce plan · 14 unseen markets',fontsize=17,color='#003087',ha='left',x=.025)
fig.text(.025,.025,'100 shoppers • 100 market days + 26 clearing days • unchanged authored economy • zero native payments\nAblations measure decisions, not multi-agent superiority. Simulator money is not production PayPal profit.',fontsize=9,color='#43536c')
fig.tight_layout(rect=[.01,.12,.99,.92])
for ext in ('png','svg'):fig.savefig(root/f'net-contribution.{ext}',dpi=180,bbox_inches='tight')
fig.savefig('demo/data/commerce-net-revision.png',dpi=180,bbox_inches='tight')
print(json.dumps({'figure':str(root/'net-contribution.png'),'meanNetGain':float(np.mean(d)),'componentGains':dict(zip(arms,map(float,effects)))}))
