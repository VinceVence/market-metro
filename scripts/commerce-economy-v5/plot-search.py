import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

base=Path('docs/commerce-economy-v5/search-1')
r=json.loads((base/'audited-report.json').read_text())
raw=json.loads((base/'results.json').read_text())
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False,'figure.facecolor':'#f4f8fc','axes.facecolor':'#f4f8fc','axes.titleweight':'bold'})
fig,axes=plt.subplots(1,2,figsize=(12,5.5),layout='constrained')
fig.suptitle('Market Metro · progress toward 2× modeled net\nFrozen v5.2 economics · validation only · target not reached',fontsize=14,weight='bold')
colors={'numerical':'#00a4ad','single':'#8e9eb8','multi':'#0070e0'}
labels={'numerical':'Numerical search','single':'Single-agent seeds','multi':'Team seeds'}
for arm,data in raw['arms'].items():
 running=[];best=1
 for row in data['rows']:
  if row['violation']<1e-6:best=max(best,row['ratio'])
  running.append(best)
 axes[0].plot(range(1,len(running)+1),running,color=colors[arm],label=labels[arm],linewidth=2)
axes[0].axhline(2,color='#b74d51',ls='--',lw=1.5,label='2× target');axes[0].set(xlabel='Local candidate evaluations (same 64 per arm)',ylabel='Best feasible training ratio',ylim=(.97,2.08),title='A   Incumbent-preserving search');axes[0].legend(frameon=False,loc='center left',fontsize=9);axes[0].grid(alpha=.15)
labels2=['Fixed rules','Numerical','Single + search','Team + search'];values=[r['fixed']['mean']['platformUSD']]+[r['arms'][a]['platformNetUSD'] for a in ['numerical','single','multi']]
axes[1].bar(labels2,values,color=['#62748c',colors['numerical'],colors['single'],colors['multi']],width=.65)
target=values[0]*2;axes[1].axhline(target,color='#b74d51',ls='--',lw=1.5);axes[1].text(.02,target+25,f'2× target: ${target:,.2f}',transform=axes[1].get_yaxis_transform(),color='#b74d51',fontsize=9)
for i,v in enumerate(values):axes[1].text(i,v+20,f'${v:,.2f}',ha='center',fontsize=10)
axes[1].set(ylabel='Mean modeled platform net (USD)',title='B   Six new validation markets',ylim=(0,target*1.12));axes[1].tick_params(axis='x',labelsize=9);axes[1].grid(axis='y',alpha=.15);axes[1].set_axisbelow(True)
fig.supxlabel(f"Six fresh model calls cost ${r['newModelCostUSD']:.6f}; subsequent search is local.\nValidation selected the plans. No final held-out markets opened; this does not establish production PayPal profit.",fontsize=9,color='#52637a')
fig.savefig(base/'progress.png',dpi=160);fig.savefig(base/'progress.pdf');plt.close(fig)
