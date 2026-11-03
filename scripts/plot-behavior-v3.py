from pathlib import Path
import json,os
ROOT=Path(__file__).resolve().parents[1]
os.environ.setdefault('MPLCONFIGDIR',str(ROOT/'.local/matplotlib'))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
for f in (ROOT/'demo/assets/fonts').glob('*.ttf'):font_manager.fontManager.addfont(str(f))
plt.rcParams.update({'font.family':'DM Sans','svg.fonttype':'path','text.parse_math':False,'font.size':11,'axes.spines.top':False,'axes.spines.right':False,'axes.spines.left':False,'text.color':'#24424d','axes.labelcolor':'#24424d','xtick.color':'#526e79','ytick.color':'#526e79'})
r=json.loads((ROOT/'docs/behavior-v3/report.json').read_text());OUT=ROOT/'docs/figures/behavior-v3';OUT.mkdir(parents=True,exist_ok=True)
labels={'none':'No campaign','legacy_weekly':'Earlier high-value weekly policy','strong_rules':'Rules + same fitted ranker','personalized':'Personalized recommendations','reactivate':'Reactivation coupons','portfolio':'Discovery + reactivation'}
fig,ax=plt.subplots(figsize=(12,6.7));fig.subplots_adjust(left=.34,right=.95,top=.74,bottom=.23)
fig.text(.035,.95,'Campaign policies in the corrected behavior model',fontsize=21,weight='bold')
fig.text(.035,.88,'48 fresh markets · 8 seed clusters · 6 scenarios · 100 shoppers per market',fontsize=11,color='#526e79')
fig.text(.035,.82,'NEW V3 assumptions; these values are not comparable to the previous simulator’s losses.',fontsize=11,color='#8b6336')
for i,p in enumerate(r['allPolicies']):
 s=p['durable'];cost=r['cost']['allocatedPerMarketUSD'] if p['policy']==r['selectedPolicy'] else 0
 ax.errorbar(s['mean']-cost,i,xerr=[[s['mean']-s['low']],[s['high']-s['mean']]],fmt='o',capsize=5,color='#287d62' if p['policy']==r['selectedPolicy'] else '#81979a',markersize=7)
 ax.text(s['high']-cost+6,i,f"${s['mean']-cost:,.2f}",va='center',fontsize=10)
ax.set_yticks(range(len(r['allPolicies'])),[labels[p['policy']] for p in r['allPolicies']]);ax.invert_yaxis();ax.axvline(0,color='#93a59b',ls='--');ax.grid(axis='x',alpha=.18);ax.set_xlim(-12,300);ax.set_xlabel('Modeled platform difference vs no campaign through day 230 (USD)')
fig.text(.035,.065,'95% percentile bootstrap over seed clusters. Full refund tail included. Campaigns run on days 31–130.\nTwo fresh Gemini decisions selected the program before these deterministic executions. The same selected\nprogram without an LLM produces the same commerce at lower inference cost. This is not actual PayPal profit.',fontsize=10,color='#526e79')
for ext in ['png','svg','pdf']:fig.savefig(OUT/f'policies.{ext}',dpi=180,bbox_inches='tight')
plt.close(fig)
fig,ax=plt.subplots(figsize=(10,5.7));fig.subplots_adjust(left=.1,right=.96,top=.75,bottom=.27)
for i,response in enumerate([.5,0]):
 ys=[x['deltaUSD'] for x in r['sensitivity'] if x['response']==response]
 ax.scatter([i]*len(ys),ys,color='#3d8293' if response else '#b38248',s=50)
 ax.plot([i-.18,i+.18],[sum(ys)/len(ys)]*2,color='#24424d',lw=2)
ax.axhline(0,color='#93a59b',ls='--');ax.set_xticks([0,1],['Half campaign response','Zero campaign response']);ax.set_xlim(-.6,1.6);ax.set_ylabel('Platform difference vs no campaign (USD)');ax.grid(axis='y',alpha=.18)
fig.text(.035,.95,'The simulator does not reward every campaign',fontsize=21,weight='bold');fig.text(.035,.86,'Sensitivity checks · four markets per condition · two seeds · descriptive results',fontsize=11,color='#526e79')
fig.text(.035,.06,'Zero response preserves purchases and customer states exactly; only outreach and model cost remain.\nThe half-response check is not a real-world calibration or an independent broad population benchmark.',fontsize=10,color='#526e79')
for ext in ['png','svg','pdf']:fig.savefig(OUT/f'controls.{ext}',dpi=180,bbox_inches='tight')
plt.close(fig)
print(OUT)
