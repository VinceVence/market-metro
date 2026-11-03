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
r=json.loads((ROOT/'docs/agent-mesh/aggressive-policy/summary.json').read_text());OUT=ROOT/'docs/figures/aggressive-policy';OUT.mkdir(parents=True,exist_ok=True)
def save(fig,name):
 for ext in ['png','svg','pdf']:fig.savefig(OUT/f'{name}.{ext}',dpi=180,bbox_inches='tight')
 plt.close(fig)
labels={'organic':'No campaign','broad-full-price':'Broad full-price outreach','high-value':'High-value products','high-value-loyal':'High value + familiarity','high-value-weekly':'High value + weekly timing','return-aware':'Return-aware broad outreach','high-value-return-aware':'High value + return routing','high-value-weekly-return-aware':'Selected program · before inference'}
fig,ax=plt.subplots(figsize=(12,7));fig.subplots_adjust(left=.36,right=.97,top=.78,bottom=.22)
fig.text(.035,.95,'A · A positive average on fresh markets',fontsize=21,weight='bold');fig.text(.035,.88,'80 markets · 16 unused seeds · five scenarios · same$50 virtual authority for all policies',fontsize=11,color='#526e79')
rows=[(labels[s['policy']],s['platform']) for s in r['allPolicies']]+[('Agent-selected program · after cost',r['stats']['platform'])]
for i,(label,s) in enumerate(rows):ax.errorbar(s['mean'],i,xerr=[[s['mean']-s['low']],[s['high']-s['mean']]],fmt='o',color='#287f63' if i==len(rows)-1 else '#8b826e',capsize=4)
ax.set_yticks(range(len(rows)),[x[0] for x in rows]);ax.invert_yaxis();ax.axvline(0,color='#697e74',ls='--');ax.grid(axis='x',alpha=.2);ax.set_xlabel('Mean modeled platform difference vs no campaign (USD / 100 shoppers)')
fig.text(.035,.055,'95% seed-cluster bootstrap intervals. The policy was selected on separate development data.\nAgent selection was generated in3 fresh trials, not80. Numerical execution drives the commerce outcome.\nEconomic equations are unchanged; the policy window and virtual budget are larger than the previous pilot.',fontsize=10,color='#526e79');save(fig,'policy-confirmation')
fig,ax=plt.subplots(figsize=(10,5.7));fig.subplots_adjust(left=.1,right=.97,top=.75,bottom=.24)
b=r['financialBridge'];vals=[b['incrementalMarginBeforeOutreachUSD'],-b['outreachUSD'],-b['allocatedModelUSD'],b['netUSD']];starts=[0,vals[0],vals[0]+vals[1],0]
for i,(v,start) in enumerate(zip(vals,starts)):
 ax.bar(i,abs(v),bottom=start if v>=0 else start+v,color='#287f63' if v>=0 else '#b38650',width=.58)
 ax.text(i,(start+v if v>=0 else start)+.35,('$' if v>=0 else '−$')+f'{abs(v):.2f}',ha='center',fontsize=13,weight='bold')
ax.set_xticks(range(4),['Extra margin after\nprocessing + returns','Outreach cost','Conservative\ninference allowance','Net platform gain']);ax.set_ylabel('USD per100 simulated shoppers');ax.axhline(0,color='#697e74');ax.set_ylim(0,19);ax.grid(axis='y',alpha=.18)
fig.text(.035,.95,'B · Where the gain comes from',fontsize=21,weight='bold');fig.text(.035,.87,'Full-price recommendations · zero campaign discount subsidies',fontsize=11,color='#526e79');fig.text(.035,.05,'Modeled platform accounting, not actual PayPal profit. Average retained volume rises$722.37;\nmerchant contribution rises$330.66.54/80 markets gain; worst platform case is−$13.11 after inference.',fontsize=10,color='#526e79');save(fig,'financial-bridge')
print('Rendered confirmation and financial bridge.')
