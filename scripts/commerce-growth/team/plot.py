import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
font_manager.fontManager.addfont('demo/assets/fonts/dm-sans-400.ttf')
r=json.loads(Path('demo/data/commerce-growth-team.json').read_text())
plt.rcParams.update({'font.family':'DM Sans','font.size':11,'figure.facecolor':'#152644','axes.facecolor':'#152644','text.color':'#e5eefb','axes.labelcolor':'#d1e0f4','xtick.color':'#d1e0f4','ytick.color':'#b1c5e0','axes.edgecolor':'#4a607d','axes.spines.top':False,'axes.spines.right':False})
fig,(a,b)=plt.subplots(1,2,figsize=(12,5.5),layout='constrained')
vals=[s['platformAfterModelUSD'] for s in r['summary']];labels=['No\noutreach','Strong\nfixed','Local\nmodel','One\nplanner','Agent\nteam'];colors=['#7186a5','#9db3d1','#4198b2','#548de7','#35b6fb']
a.bar(labels,vals,color=colors,width=.65)
for i,v in enumerate(vals):a.text(i,v+max(vals)*.035,f'${v:,.0f}',ha='center',fontsize=10)
target=2*r['fixed']['platformAfterModelUSD'];a.axhline(target,color='#ef9b98',ls='--',lw=1.3);a.text(.03,target+25,'2× target',transform=a.get_yaxis_transform(),color='#ef9b98');a.set(title='Settled modeled contribution',ylabel='USD per market after model cost',ylim=(0,target*1.13));a.grid(axis='y',alpha=.12);a.set_axisbelow(True)
d=[c['teamUSD']-c['fixedUSD'] for c in r['cases']];names=[c['regime'].replace('_',' ') for c in r['cases']];b.barh(names,d,color=['#35b6fb' if x>=0 else '#df9398' for x in d]);b.axvline(0,color='#a6bdd8',lw=.8);b.set(title='Team minus fixed · every unseen seed',xlabel='Paired difference (modeled USD)');b.invert_yaxis();b.grid(axis='x',alpha=.12);b.set_axisbelow(True)
fig.supxlabel(f"Seven unseen markets · {r['modelCalls']} fresh calls including pilot · ${r['newModelCostUSD']:.4f} token-metered estimate\nNo simulator changes or native payments. One seed per regime; no population-confidence claim.",fontsize=10,color='#b1c5e0')
fig.savefig('demo/data/commerce-growth-team.png',dpi=170);fig.savefig('docs/commerce-growth/team-1/unseen-comparison.pdf');plt.close(fig)
