import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
font_manager.fontManager.addfont('demo/assets/fonts/dm-sans-400.ttf')
font_manager.fontManager.addfont('demo/assets/fonts/dm-sans-700.ttf')
r=json.loads(Path('demo/data/commerce-growth.json').read_text())
plt.rcParams.update({'font.family':'DM Sans','font.size':11,'figure.facecolor':'#152644','axes.facecolor':'#152644','text.color':'#e5eefb','axes.labelcolor':'#d1e0f4','xtick.color':'#d1e0f4','ytick.color':'#b1c5e0','axes.edgecolor':'#4a607d','axes.spines.top':False,'axes.spines.right':False})
fig,axes=plt.subplots(1,2,figsize=(11,5),layout='constrained')
data=[r['none'],r['fixed'],r['learned']];labels=['No outreach','Strongest fixed','Local learner'];colors=['#7b91b1','#338bff','#66bdd9']
for ax,key,title,ylabel in [(axes[0],'platformUSD','Settled platform contribution','Modeled USD per market'),(axes[1],'recommendationPurchases','Exact recommended item bought','Retained purchases per market')]:
 vals=[x['mean'][key] for x in data];ax.bar(labels,vals,color=colors,width=.6)
 for i,v in enumerate(vals):ax.text(i,v+max(vals)*.04,f'${v:,.2f}' if key=='platformUSD' else f'{v:.1f}',ha='center',weight='bold')
 ax.set(title=title,ylabel=ylabel,ylim=(0,max(vals)*1.28));ax.grid(axis='y',alpha=.13);ax.set_axisbelow(True);ax.tick_params(axis='x',labelsize=10)
fig.supxlabel('Seven equally weighted development regimes · authored simulation · identical needs, consent and funding\nNo fresh LLM decisions or native payments. The local learner did not beat the strongest fixed workflow.',fontsize=10,color='#b1c5e0')
fig.savefig('demo/data/commerce-growth.png',dpi=170);fig.savefig('docs/commerce-growth/development-1/comparison.pdf');plt.close(fig)
