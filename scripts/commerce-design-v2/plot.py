import json
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

r=json.loads(Path('demo/data/commerce-design-v2.json').read_text())
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False,'axes.titleweight':'bold','figure.facecolor':'#f5f8fc','axes.facecolor':'#f5f8fc'})
arms=['none','fixed','numerical','single','multi']; labels=['No campaign','Fixed','Numerical','One agent','Agent team']; colors=['#8995a8','#62748c','#00a5b5','#7794dc','#0070e0']
fig,ax=plt.subplots(2,2,figsize=(12.8,8.0),layout='constrained')
fig.suptitle('Market Metro · held-out campaign design pilot\nFrozen simulator · 12 unseen markets · 3 design blocks · synthetic economics',fontsize=14,weight='bold')
for a,key,title,ylabel in [(ax[0,0],'platformNetUSD','A   Modeled platform net','USD per 100-shopper market'),(ax[0,1],'recommendationPurchases','B   Purchases of the exact recommendation','Purchases per market'),(ax[1,0],'skuRecall3','C   Offline product ranking','Canonical SKU Recall@3 (%)')]:
 values=[(r['arms'][x][key] or 0)*(100 if key=='skuRecall3' else 1) for x in arms]
 a.bar(labels,values,color=colors,width=.65); a.set_title(title,loc='left',pad=12);a.set_ylabel(ylabel);a.grid(axis='y',alpha=.16);a.set_axisbelow(True);a.set_ylim(0,max(values)*1.25)
 for i,v in enumerate(values): a.text(i,v+max(values)*.03,('N/A' if key=='skuRecall3' and i==0 else f'{v:.1f}'),ha='center',fontsize=9)
a=ax[1,1];a.axhline(0,color='#62748c',lw=1);c=r['cases'];d=[x['arms']['multi']['platformNetUSD']-x['arms']['fixed']['platformNetUSD'] for x in c]
a.bar(range(len(c)),d,color=['#0070e0' if x>=0 else '#c65758' for x in d]);
for i,v in enumerate(d): a.text(i,v+(2 if v>=0 else -2),f'{v:+.1f}',ha='center',va='bottom' if v>=0 else 'top',fontsize=7)
a.set_xticks(range(len(c)),[str(x['seed']) for x in c],rotation=45,ha='right',fontsize=8);a.set_title('D   Team minus fixed, every test market',loc='left',pad=12);a.set_ylabel('Modeled platform net difference (USD)');a.grid(axis='y',alpha=.16);a.set_axisbelow(True)
fig.supxlabel(f"New LLM usage ${r['modelCostUSD']:.4f} / {r['providerCalls']} calls. Design cost allocated only across executed test markets.\nRanking labels are future no-campaign purchases. Recommendation attribution is not itself causal lift.",fontsize=9,color='#52637a')
fig.savefig('demo/data/commerce-design-v2.png',dpi=180);fig.savefig('docs/commerce-design-v2/results.pdf');plt.close(fig)
