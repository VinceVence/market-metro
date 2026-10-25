"""Development-only learned-policy figures. No API calls."""
from pathlib import Path
import json, os
ROOT=Path(__file__).resolve().parents[1]
os.environ.setdefault('MPLCONFIGDIR',str(ROOT/'.local/matplotlib'))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
BASE=ROOT/'docs/policy-lab/benchmarks/v6';OUT=ROOT/'docs/figures/policy-learning';OUT.mkdir(parents=True,exist_ok=True)
q=json.loads((BASE/'q-validation-result.json').read_text());h=json.loads((BASE/'horizon-result.json').read_text())
for f in (ROOT/'demo/assets/fonts').glob('*.ttf'):font_manager.fontManager.addfont(str(f))
plt.rcParams.update({'font.family':'DM Sans','svg.fonttype':'path','text.parse_math':False,'font.size':11,
    'axes.spines.top':False,'axes.spines.right':False,'axes.spines.left':False,
    'text.color':'#24424D','axes.labelcolor':'#24424D','xtick.color':'#526E79','ytick.color':'#526E79'})
def save(fig,name):
    for ext in ['png','svg','pdf']:fig.savefig(OUT/f'{name}.{ext}',dpi=180,bbox_inches='tight')
    svg=OUT/f'{name}.svg';svg.write_text('\n'.join(s.rstrip() for s in svg.read_text().splitlines())+'\n');plt.close(fig)
def heading(fig,title,subtitle):
    fig.text(.035,.97,title,fontsize=21,weight='bold',va='top');fig.text(.035,.89,subtitle,fontsize=10.5,va='top',color='#526E79')

fig,axes=plt.subplots(1,2,figsize=(13,6.5));fig.subplots_adjust(left=.18,right=.97,top=.73,bottom=.27,wspace=.65)
heading(fig,'A · Does learning future value help?','Development check only · 80 markets / 16 seed clusters · zero LLM or cloud calls')
methods=[('myopic_trees64','Immediate reward'),('fqi_trees64','Fitted Q + history'),('fqi_no_history','Fitted Q, no history')]
for i,(method,name) in enumerate(methods):
    s=next(s['platform'] for s in q['stats'] if s['method']==method)
    axes[0].errorbar(s['mean'],i,xerr=[[s['mean']-s['low']],[s['high']-s['mean']]],fmt='o',color='#276B76' if method=='fqi_trees64' else '#9D7751',capsize=4)
axes[0].set_yticks(range(3),[name for _,name in methods]);axes[0].invert_yaxis();axes[0].set_title('Versus no outreach',fontsize=12);axes[0].set_xlabel('Modeled USD per market')
for i,(key,name) in enumerate([('sequentialVsMyopic','Future value vs immediate'),('historyVsNoHistory','History vs no history')]):
    s=q['contrasts'][key];axes[1].errorbar(s['mean'],i,xerr=[[s['mean']-s['low']],[s['high']-s['mean']]],fmt='o',color='#276B76',capsize=4)
axes[1].set_yticks([0,1],['Future value\nvs immediate','History\nvs no history']);axes[1].invert_yaxis();axes[1].set_title('Matched method ablations',fontsize=12);axes[1].set_xlabel('Paired modeled USD difference')
for ax in axes:ax.axvline(0,color='#71867F',ls='--');ax.grid(axis='x',alpha=.2)
fig.text(.035,.055,'95% intervals resample seed clusters. Both objective heads and hard execution constraints are shared.\nThese are development results, not confirmation. Numeric RL gains do not establish LLM or multi-agent advantage.',fontsize=10,color='#526E79')
save(fig,'sequential-learning')

fig,ax=plt.subplots(figsize=(12,6.5));fig.subplots_adjust(left=.12,right=.97,top=.73,bottom=.25)
heading(fig,'B · Early gains weaken with longer follow-up','160 new development markets / 32 seed clusters · policies and first 100-day histories held identical')
for offset,method,label,color in [(-4,'static','Static recent-buyer rule','#8A7B69'),(0,'constant','Learned day-specific mean','#B27F30'),(4,'fqi_trees64','Selected fitted Q','#276B76')]:
    stats=[next(s['platform'] for s in h['stats'] if s['method']==method and s['horizon']==day) for day in [100,200]]
    ax.errorbar([100+offset,200+offset],[s['mean'] for s in stats],yerr=[[s['mean']-s['low'] for s in stats],[s['high']-s['mean'] for s in stats]],fmt='o-',color=color,capsize=4,label=label)
ax.axhline(0,color='#71867F',ls='--');ax.set_xticks([100,200],['100 shopping days','200 shopping days']);ax.set_xlim(80,220);ax.set_ylabel('Modeled platform difference vs no outreach (USD)');ax.grid(axis='y',alpha=.2);ax.legend(frameon=False,fontsize=10)
fig.text(.035,.045,'No campaign continues after day 100. Each window includes a 14-day refund-observation tail.\nBoth policies use the same extended world; the original frozen benchmark is preserved.\nThe selected RL policy has no demonstrated durable gain. Neither panel measures actual PayPal profit.',fontsize=10,color='#526E79')
save(fig,'horizon-sensitivity')
print('Rendered sequential-learning ablations and longer-follow-up sensitivity.')
