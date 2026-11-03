from pathlib import Path
import os,json
ROOT=Path(__file__).resolve().parents[1]
os.environ.setdefault('MPLCONFIGDIR',str(ROOT/'.local/matplotlib'))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
for f in (ROOT/'demo/assets/fonts').glob('*.ttf'):font_manager.fontManager.addfont(str(f))
plt.rcParams.update({'font.family':'DM Sans','svg.fonttype':'path','text.parse_math':False,'font.size':11,'axes.spines.top':False,'axes.spines.right':False,'axes.spines.left':False,'text.color':'#24424d','axes.labelcolor':'#24424d','xtick.color':'#526e79','ytick.color':'#526e79'})
r=json.loads((ROOT/'docs/agent-mesh/focused-recovery/report.json').read_text())
OUT=ROOT/'docs/figures/focused-recovery';OUT.mkdir(parents=True,exist_ok=True)
fig,(a,b)=plt.subplots(2,1,figsize=(11.6,9),gridspec_kw={'height_ratios':[1,1.3]})
fig.subplots_adjust(left=.27,right=.96,top=.81,bottom=.16,hspace=.62)
fig.text(.035,.96,'Less waste. Durable growth is still unproven.',fontsize=23,weight='bold')
fig.text(.035,.91,'60 fresh paired markets · 12 seed clusters · five scenarios · original closed economy',fontsize=11,color='#526e79')
labels=['No campaign','Broad recovery outreach','Exposure + lapse targeting'];colors=['#70827b','#a47d54','#2c6673']
for i,p in enumerate(r['policies']):
 s=p['platform'];a.errorbar(s['mean'],i,xerr=[[s['mean']-s['low']],[s['high']-s['mean']]],fmt='o',color=colors[i],capsize=5,markersize=7)
 a.text(s['high']+.13,i,f"{s['mean']:+.2f}",va='center',fontsize=11)
a.set_yticks(range(3),labels);a.invert_yaxis();a.axvline(0,color='#9ca9a0',ls='--');a.grid(axis='x',alpha=.2);a.set_xlim(min(p['platform']['low'] for p in r['policies'])-1,1.2)
a.set_xlabel('Mean modeled platform change vs no campaign (USD / 100 shoppers)')
a.set_title('A  ·  400-day result, including $0.10 candidate inference allowance',loc='left',fontsize=11,pad=15)
for p,color,label in zip(r['policies'],colors,labels):
 if p['id']=='organic':continue
 b.plot([t['day'] for t in r['trajectory']],[t[p['id']] for t in r['trajectory']],label=label,color=color,lw=2)
b.axhline(0,color='#9ca9a0',ls='--');b.axvspan(200,400,color='#e7eee6',alpha=.6);b.axvline(200,color='#819589',ls=':',lw=1)
b.text(210,b.get_ylim()[1]*.8,'No new outreach',fontsize=10,color='#526e79')
b.set_xlim(30,400);b.set_xlabel('Shopping day · outcomes attributed to purchase day after refund maturity');b.set_ylabel('Mean cumulative change (USD)');b.grid(axis='y',alpha=.18);b.legend(frameon=False,fontsize=10,loc='lower left')
b.set_title('B  ·  Follow the money after the campaign stops',loc='left',fontsize=11,pad=14)
fig.text(.035,.045,'95% seed-cluster bootstrap intervals in panel A. Panel B shows means, not uncertainty bands.\nThe candidate was fixed before this exploratory confirmation. Its original development confidence gate failed.\nNo new model calls for this validation; execution is deterministic. Simulated financial value, not real PayPal profit.',fontsize=10,color='#526e79')
for ext in ['png','svg','pdf']:fig.savefig(OUT/f'confirmation.{ext}',dpi=180,bbox_inches='tight')
plt.close(fig)
print(OUT/'confirmation.png')
