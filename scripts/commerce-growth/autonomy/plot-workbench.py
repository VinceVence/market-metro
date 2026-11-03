import json,sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

root=Path(sys.argv[1]); r=json.loads((root/'results.json').read_text())
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False})
fig,ax=plt.subplots(1,2,figsize=(12,5),gridspec_kw={'width_ratios':[1.4,1]})
names=['Dataset contract','Trained model','Campaign selection','Whole team vs one planner']
keys=['without_demand_analysis','without_model_training','without_campaign_selection','single']
for i,key in enumerate(keys):
 d=r['differences'][key]; values=np.asarray(d['pairedDeltaUSD']); color='#1670c5' if d['platformUSD']>0 else '#b04d55'
 ax[0].scatter(values,np.repeat(i,len(values)),color=color,alpha=.45,s=30)
 ax[0].scatter([d['platformUSD']],[i],color=color,s=90,marker='D',zorder=3)
ax[0].axvline(0,color='#6c7d8b',linewidth=.8);ax[0].set_yticks(range(4),names);ax[0].invert_yaxis();ax[0].set_xlabel('Modeled payment contribution difference ($ / market)')
ax[0].set_title('Contribution of each selected output\nDots: seven markets · diamonds: mean',loc='left',fontweight='bold')
keys=['numerical','single','team','without_demand_analysis']; labels=['Existing forest','One planner model','Team model','No analyst features']
values=[r['quality'][k]['brier'] for k in keys]
ax[1].barh(labels,values,color=['#92a4b4','#72a5dc','#1668ac','#b8c9d9']);ax[1].invert_yaxis();ax[1].set_xlim(0,max(values)*1.25)
for i,v in enumerate(values):ax[1].text(v+.0005,i,f'{v:.4f}',va='center')
ax[1].set_xlabel('Brier prediction error (lower is better)');ax[1].set_title('Frozen classifiers, identical contacts\n'+str(r['quality']['team']['observations'])+' observations after settlement',loc='left',fontweight='bold')
fig.suptitle('Market Metro · demand, model and campaign workbench',fontsize=14,fontweight='bold',x=.05,ha='left')
fig.text(.05,.02,'Frozen synthetic economy. Component removals keep downstream decisions fixed. One design per approach; no claim of production ROI.',fontsize=9,color='#40566b')
fig.tight_layout(rect=(0,.06,1,.92))
for ext in ['png','svg']:fig.savefig(root/f'role-contributions.{ext}',dpi=180,bbox_inches='tight')
