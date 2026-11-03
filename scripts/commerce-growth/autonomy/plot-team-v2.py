"""Plot every paired market and conditional output ablation, including losses."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

data=json.loads(Path('demo/data/commerce-baseline-challenger.json').read_text())
r=data['results'];cases=data['protocol']['confirmation'];rows=data['rows'];n=len(cases)
lookup={(x['case'],x['arm']):x for x in rows}
delta=lambda arm: np.array([lookup[(c['id'],arm)]['netAfterModelUSD']-lookup[(c['id'],'baseline_v1')]['netAfterModelUSD'] for c in cases])
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False,'axes.titleweight':'bold'})
fig,axes=plt.subplots(1,3,figsize=(16,5.5),gridspec_kw={'width_ratios':[1.2,1,.85]})
bg='#f6f9ff';fig.patch.set_facecolor(bg)
y=np.arange(n)
axes[0].scatter(delta('single'),y+.12,label='One planner',color='#009cde',marker='o',s=28)
axes[0].scatter(delta('team'),y-.12,label='Team',color='#003087',marker='D',s=28)
axes[0].set_yticks(y,[c['regime'].replace('_',' ')+' '+str(c['panel']+1) for c in cases],fontsize=8)
axes[0].invert_yaxis();axes[0].axvline(0,color='#172b4d',lw=.7);axes[0].legend(loc='best',fontsize=8)
axes[0].set_title('A  Every unseen market');axes[0].set_xlabel('PayPal net − locked v1 (USD)')
arms=['without_scientist','without_campaign','without_payments'];values=[r['differences'][a]['meanNetUSD'] for a in arms]
axes[1].barh(np.arange(3),values,color=['#0070e0' if v>=0 else '#c04b5a' for v in values])
errors=np.array([[values[i]-r['differences'][a]['interval']['low'] for i,a in enumerate(arms)],[r['differences'][a]['interval']['high']-values[i] for i,a in enumerate(arms)]])
axes[1].errorbar(values,np.arange(3),xerr=errors,fmt='none',ecolor='#43536c',capsize=4,lw=1)
axes[1].set_yticks(np.arange(3),['Scientist model','Campaign choice','Payment execution']);axes[1].invert_yaxis();axes[1].axvline(0,color='#172b4d',lw=.7)
axes[1].set_title('B  Contribution of each output');axes[1].set_xlabel('Full team − output restored to v1 (USD)');axes[1].margins(x=.4)
for i,v in enumerate(values):axes[1].annotate(f'{v:+.3f}',(v,i),xytext=(5 if v>=0 else -5,0),textcoords='offset points',va='center',ha='left' if v>=0 else 'right')
metrics=['netAfterModelUSD','retailerUSD','terminalCashUSD'];names=['PayPal net','Retailers','Partner cash'];base=r['summary']['baseline_v1'];team=r['summary']['team']
pct=[100*(team[k]/base[k]-1) for k in metrics]
axes[2].barh(np.arange(3),pct,color=['#0070e0' if v>=0 else '#c04b5a' for v in pct]);axes[2].set_yticks(np.arange(3),names);axes[2].invert_yaxis();axes[2].axvline(0,color='#172b4d',lw=.7)
axes[2].set_title('C  Financial change');axes[2].set_xlabel('Team vs locked v1 (%)');axes[2].margins(x=.35)
for i,v in enumerate(pct):axes[2].annotate(f'{v:+.3f}%',(v,i),xytext=(5 if v>=0 else -5,0),textcoords='offset points',va='center',ha='left' if v>=0 else 'right')
for ax in axes:ax.set_facecolor(bg);ax.grid(axis='x',alpha=.12);ax.set_axisbelow(True)
fig.suptitle('Fresh agent proposals · shadow test in the locked economy',fontsize=17,color='#003087',ha='left',x=.025)
fig.text(.025,.025,f"{n} unseen markets • {data['protocol']['equalBudget']['callsPerDesign']} decisions and 2 local model fits per approach • matched tools and caps\nB:95% paired-bootstrap intervals; other outputs and AI cost fixed. One design lineage; simulation economics, not production PayPal ROI.",fontsize=9,color='#43536c')
fig.tight_layout(rect=[.01,.12,.99,.92])
root=Path(data['studyDirectory'])
for ext in ['png','svg']:fig.savefig(root/f'agent-contributions.{ext}',dpi=180,bbox_inches='tight')
fig.savefig('demo/data/commerce-baseline-challenger.png',dpi=180,bbox_inches='tight')
print(json.dumps({'teamNetDeltaUSD':float(delta('team').mean()),'singleNetDeltaUSD':float(delta('single').mean()),'outputs':dict(zip(arms,values))}))
