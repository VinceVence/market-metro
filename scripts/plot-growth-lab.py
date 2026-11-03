"""Research figures from frozen saved results. No inference or network."""
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
r=json.loads((ROOT/'docs/agent-mesh/growth-lab/summary.json').read_text());OUT=ROOT/'docs/figures/agent-generalization';OUT.mkdir(parents=True,exist_ok=True)
def save(fig,name):
 for ext in ['png','svg','pdf']:fig.savefig(OUT/f'{name}.{ext}',bbox_inches='tight',dpi=180)
 plt.close(fig)
labels={'reward-recommend':'Reward regression','eligible-recommend':'Eligible-only regression','incremental-recommend':'Incremental recommendations','incremental-reactivate':'Incremental reactivation','incremental-coupon':'Incremental coupons','eligible-coupon':'Eligible-only coupons','numeric-selector':'Numerical experiment selector','organic':'No campaign','agent':'Agent experiment team'}
fig,ax=plt.subplots(figsize=(11,6));fig.subplots_adjust(left=.32,right=.97,top=.78,bottom=.22)
fig.text(.035,.95,'A · Broader targeting did not establish growth',fontsize=20,weight='bold');fig.text(.035,.88,'40 held-out markets · 8 seed clusters · 5 scenarios · frozen economics',fontsize=11,color='#526e79')
rows=r['numeric']
for i,row in enumerate(rows):
 s=row['platform'];ax.errorbar(s['mean'],i,xerr=[[s['mean']-s['low']],[s['high']-s['mean']]],fmt='o',color='#2c6673' if row['method'].startswith('incremental') else '#a28153',capsize=4)
ax.set_yticks(range(len(rows)),[labels[x['method']] for x in rows]);ax.invert_yaxis();ax.axvline(0,color='#70847a',ls='--');ax.grid(axis='x',alpha=.2);ax.set_xlabel('Modeled platform difference versus no campaign (USD / 100 shoppers)')
fig.text(.035,.05,'95% bootstrap intervals over seed clusters; scenarios share their seed. Campaign outcomes mature through day114.\nThese are learned-policy evaluations, not40 fresh LLM runs or actual PayPal profit.',fontsize=10,color='#526e79');save(fig,'targeting-methods')
fig,ax=plt.subplots(figsize=(10,5));fig.subplots_adjust(left=.32,right=.97,top=.73,bottom=.25)
fig.text(.035,.95,'B · The revised agents tested alternatives',fontsize=20,weight='bold');fig.text(.035,.86,'10 fresh cases · 2 independent seeds · same cases for all four comparisons',fontsize=11,color='#526e79')
rows=r['matchedSummary']
for i,row in enumerate(rows):ax.plot(row['platform']['mean'],i,'o',color='#2c6673' if row['method']=='agent' else '#a28153',markersize=9)
ax.set_yticks(range(len(rows)),[labels[x['method']] for x in rows]);ax.invert_yaxis();ax.axvline(0,color='#70847a',ls='--');ax.grid(axis='x',alpha=.2);ax.set_xlabel('Mean modeled platform difference after inference (USD)')
fig.text(.035,.055,'Agent workflow completed10/10 cases and revised its learner in every case.\nOnly2 independent seed clusters: no inferential confidence band is displayed. No campaign remains ahead.',fontsize=10,color='#526e79');save(fig,'agent-comparison')
fig,ax=plt.subplots(figsize=(10,5));fig.subplots_adjust(left=.27,right=.97,top=.74,bottom=.25)
fig.text(.035,.95,'C · External randomized-data check',fontsize=20,weight='bold');fig.text(.035,.86,'Hillstrom email experiment · 12,809 locked test customers · 25% contact limit',fontsize=11,color='#526e79')
external=r['external'];names=['no_email',external['bestFixedControl'],external['selected']]
for i,name in enumerate(names):
 s=external['test'][name];ax.errorbar(s['incrementalRevenueUSDPerCustomer'],i,xerr=[[s['incrementalRevenueUSDPerCustomer']-s['low95']],[s['high95']-s['incrementalRevenueUSDPerCustomer']]],fmt='o',color='#2c6673',capsize=4)
ax.set_yticks(range(3),['No email','Validation-selected fixed email','Validation-selected DR targeting']);ax.invert_yaxis();ax.axvline(0,color='#70847a',ls='--');ax.grid(axis='x',alpha=.2);ax.set_xlabel('Estimated incremental revenue per customer (USD)')
fig.text(.035,.05,'Paired doubly robust estimates;95% normal-approximation intervals conditional on trained policies.\nInterval crosses zero. Historical public email data; not PayPal customers, fees, profit or live deployment.',fontsize=10,color='#526e79');save(fig,'external-check')
print('Rendered three figures as PNG, SVG and PDF.')
