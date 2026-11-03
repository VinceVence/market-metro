"""Descriptive results on all seven registered markets; no population CI."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

root=Path('docs/commerce-growth/autonomy-1/validation-1')
r=json.loads((root/'results.json').read_text())
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False,'savefig.facecolor':'white'})
fig,axs=plt.subplots(1,3,figsize=(16,5),layout='constrained')
arms=['strong_fixed','static_learned_routing','autonomous_team']
bars=axs[0].bar(['Strong\nfixed','Static\nML','Agent\nteam'],[r['means'][a]['netAfterModelUSD'] for a in arms],color=['#8a9eb9','#3673b6','#0070e0'])
axs[0].bar_label(bars,fmt='$%.2f',padding=4)
axs[0].set(title='Settled modeled platform net',ylabel='Mean USD per market after AI cost')
axs[0].set_ylim(0,max(b.get_height() for b in bars)*1.15)
delta=[c['deltaUSD'] for c in r['cases']]
axs[1].barh([c['regime'].replace('_',' ') for c in r['cases']],delta,color=['#0070e0' if d>=0 else '#c04c57' for d in delta])
axs[1].axvline(0,color='#607087',lw=.8);axs[1].invert_yaxis()
axs[1].set(title='Every registered unseen seed',xlabel='Team minus fixed (modeled USD)')
f=r['means']['strong_fixed'];t=r['means']['autonomous_team']
components=[t['retailPaymentNetUSD']-f['retailPaymentNetUSD'],t['supplierPaymentNetUSD']-f['supplierPaymentNetUSD'],f['outreachCostUSD']-t['outreachCostUSD'],-r['spend']['costUSD']/7]
bars=axs[2].bar(['Retail\npayments','Supplier\npayments','Outreach\nsaving','AI\ncost'],components,color=['#0070e0' if d>=0 else '#c04c57' for d in components])
axs[2].bar_label(bars,fmt='$%.3f',padding=3);axs[2].axhline(0,color='#607087',lw=.8)
axs[2].set(title='Where the net difference comes from',ylabel='Mean change (modeled USD)')
for a in axs:a.grid(axis='x' if a==axs[1] else 'y',alpha=.14);a.set_axisbelow(True)
fig.suptitle('Autonomous commerce · frozen simulation · fresh Gemini decisions',fontsize=16)
fig.supxlabel(f"Seven new seeds, one per authored regime · {r['modelCalls']} calls · ${r['spend']['costUSD']:.6f} metered estimate\nObserved synthetic outcomes, not actual PayPal profit. Virtual time holds during offline reviews; live timing is separate.",fontsize=10)
fig.savefig(root/'comparison.png',dpi=180);fig.savefig(root/'comparison.svg');plt.close(fig)
