import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

r=json.loads(Path('demo/data/commerce-economy-v5.json').read_text())
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False,'figure.facecolor':'#f4f8fc','axes.facecolor':'#f4f8fc','axes.titleweight':'bold'})
fig,ax=plt.subplots(1,3,figsize=(14,5.4),layout='constrained')
fig.suptitle('Market Metro · business-action controller\nSix paired validation markets · 2× target not reached',fontsize=15,weight='bold')
v=[r['fixed']['platformNetUSD'],r['candidate']['platformNetUSD']]
ax[0].bar(['Fixed business\n+ common learner','Joint\ncontroller'],v,color=['#8295b0','#0070e0'],width=.58)
for i,x in enumerate(v): ax[0].text(i,x+25,f'${x:,.2f}',ha='center')
ax[0].axhline(v[0]*2,ls='--',color='#b14e52',label='2× target');ax[0].legend(frameon=False,loc='upper left')
ax[0].set(title='A   Modeled platform net',ylabel='USD per 100-shopper market',ylim=(0,v[0]*2.28))
keys=['retailerUSD','wholesalerUSD','manufacturerUSD'];values=[r['differences'][k] for k in keys]
ax[1].barh(['Retailers','Wholesaler','Manufacturer'],values,color=['#008d8b' if x>=0 else '#bb5b62' for x in values]);ax[1].axvline(0,color='#8998ae',lw=1)
for i,x in enumerate(values):ax[1].text(x+(25 if x>=0 else -25),i,f'{x:+,.0f}',ha='left' if x>=0 else 'right',va='center')
ax[1].invert_yaxis();ax[1].set(title='B   Partner contribution change',xlabel='USD vs matched comparator',xlim=(min(values)-260,max(values)+300))
for i,c in enumerate(r['cases']):ax[2].scatter(c['platformDeltaUSD'],i,color='#0070e0',s=40)
ax[2].set_yticks(range(len(r['cases'])),[c['scenario'].replace('_',' ') for c in r['cases']]);ax[2].invert_yaxis();ax[2].axvline(0,color='#8998ae',lw=1)
ax[2].set(title='C   Every validation market',xlabel='Platform net change (USD)',xlim=(-25,max(c['platformDeltaUSD'] for c in r['cases'])*1.15))
for a in ax:a.grid(axis='y' if a==ax[0] else 'x',alpha=.15);a.set_axisbelow(True)
fig.supxlabel(f"Authored assumptions; no production ROI claim. Aggregate partner profit and individual supplier checks remain unresolved.\n{r['newModelCalls']} Gemini design/revision calls cost ${r['newModelCostUSD']:.6f}; model training and search were local.",fontsize=9,color='#52637a')
fig.savefig('demo/data/commerce-economy-v5.png',dpi=170);fig.savefig('docs/commerce-economy-v5/comparison-latest.pdf');plt.close(fig)
