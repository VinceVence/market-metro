"""Offline figures and browser index for the frozen trusted-workflow trials."""
from pathlib import Path
import json,os
ROOT=Path(__file__).resolve().parents[1]
os.environ.setdefault('MPLCONFIGDIR',str(ROOT/'.local/matplotlib'))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.patches import FancyBboxPatch,FancyArrowPatch
BASE=ROOT/'docs/policy-lab/benchmarks/v4-1'
OUT=ROOT/'docs/figures/trusted-workflow';OUT.mkdir(parents=True,exist_ok=True)
r=json.loads((BASE/'result.json').read_text());v4=json.loads((BASE.parent/'v4/result.json').read_text())
for f in (ROOT/'demo/assets/fonts').glob('*.ttf'):font_manager.fontManager.addfont(str(f))
plt.rcParams.update({'font.family':'DM Sans','font.size':11,'svg.fonttype':'path','text.parse_math':False,'axes.spines.top':False,'axes.spines.right':False,'axes.spines.left':False,'text.color':'#24424D','axes.labelcolor':'#24424D','xtick.color':'#526E79','ytick.color':'#526E79'})
figures=[]
def save(fig,name,caption):
    for ext in ['svg','png','pdf']:fig.savefig(OUT/f'{name}.{ext}',dpi=180,bbox_inches='tight')
    plt.close(fig);figures.append({'name':name,'caption':caption,**{ext:f'/figures/trusted-workflow/{name}.{ext}' for ext in ['svg','png','pdf']}})
def header(fig,title,subtitle):
    fig.text(.04,.96,title,fontsize=21,weight='bold',va='top');fig.text(.04,.88,subtitle,fontsize=10.5,va='top',color='#526E79')
fig,ax=plt.subplots(figsize=(12,6));fig.subplots_adjust(left=.31,right=.95,top=.72,bottom=.24)
header(fig,'A · Where the LLM adds measured value','Fresh confirmation set · 24 authored merchant requests · unchanged command parser and downstream workers')
for i,s in enumerate(r['summaries']):
    ax.barh(i,s['completed'],color=['#B27936','#276B76'][i],height=.5);ax.barh(i,24-s['completed'],left=s['completed'],color='#E8E8DE',height=.5)
    ax.text(s['completed']-.5,i,f"{s['completed']} / 24",ha='right',va='center',color='white',weight='bold')
ax.set_yticks([0,1],['Command parser + trusted workflow','Source-ID Gemini + trusted workflow']);ax.invert_yaxis();ax.set_xlim(0,24);ax.set_xticks([0,6,12,18,24]);ax.set_xlabel('Requests correctly interpreted and processed (including clarification)')
d=r['contrast']['completionDifference'];fig.text(.04,.06,f"Paired completion gain: {d['mean']*100:.1f} percentage points (95% bootstrap: {d['low']*100:.1f} to {d['high']*100:.1f})\n{r['contrast']['wins']} wins, {r['contrast']['losses']} losses; exact paired p={r['contrast']['twoSidedExactP']:.6f}. Authored cases do not estimate production accuracy.",fontsize=10,color='#526E79')
save(fig,'trusted-completion','Observed language-interface value. Both methods use the same validated data, local models and campaign-selection code.')

fig,axes=plt.subplots(1,2,figsize=(13,6.5));fig.subplots_adjust(left=.11,right=.96,top=.72,bottom=.28,wspace=.6)
header(fig,'B · Financial value remains a separate question','Modeled platform contribution after inference · 100 shoppers per market · 95% paired bootstrap intervals')
m=r['summaries'][1]['financial'];axes[0].errorbar(m['mean'],0,xerr=[[m['mean']-m['low']],[m['high']-m['mean']]],fmt='o',color='#276B76',capsize=4);axes[0].set_yticks([0],['Source-ID\nGemini']);axes[0].axvline(0,ls='--',color='#71867F');axes[0].set_xlim(-.00055,.00005);axes[0].set_title('Confirmation: versus no campaign',fontsize=11);axes[0].set_xlabel('USD per market');axes[0].ticklabel_format(axis='x',style='plain',useOffset=False);axes[0].grid(axis='x',alpha=.2)
m=v4['contrasts']['adaptiveFinancial'];axes[1].errorbar(m['mean'],0,xerr=[[m['mean']-m['low']],[m['high']-m['mean']]],fmt='o',color='#B27936',capsize=4);axes[1].set_yticks([0],['Extra Gemini\nplanner']);axes[1].axvline(0,ls='--',color='#71867F');axes[1].set_title('Earlier v4: versus the same reader + fixed workflow',fontsize=10);axes[1].set_xlabel('USD per market');axes[1].grid(axis='x',alpha=.2)
fig.text(.04,.07,'Separate frozen task sets; axes use different scales. The confirmation workflow chose no outreach.\nIts financial difference is inference cost. The extra planner was not promoted. These are synthetic outcomes, not PayPal ROI.',fontsize=10,color='#526E79')
save(fig,'trusted-financial','Better interpretation does not prove greater profit. The additional planning agent performed worse in the preserved v4 experiment.')

fig,ax=plt.subplots(figsize=(14,9));fig.subplots_adjust(left=.03,right=.98,top=.83,bottom=.07);ax.set_xlim(0,100);ax.set_ylim(0,100);ax.axis('off')
header(fig,'C · Bounded reasoning, predictable execution','Each node records inputs, outputs, checks and effect identity. Persistence does not replace validation.')
def box(x,y,w,h,title,body,color='#276B76'):
    ax.add_patch(FancyBboxPatch((x,y),w,h,boxstyle='round,pad=.4,rounding_size=.8',facecolor='#F4F8F5',edgecolor=color,lw=1.2));ax.text(x+1.4,y+h-2,title,va='top',weight='bold',fontsize=11,color=color);ax.text(x+1.4,y+h-7,body,va='top',fontsize=9,linespacing=1.5,color='#34545C')
def arrow(a,b,label=''):
    ax.add_patch(FancyArrowPatch(a,b,arrowstyle='-|>',mutation_scale=13,color='#7D948D',lw=1.4))
    if label:ax.text((a[0]+b[0])/2,(a[1]+b[1])/2+2,label,ha='center',fontsize=8,backgroundcolor='white')
box(2,76,28,21,'Merchant request','Plain language and current constraints\nCode assigns immutable source IDs')
box(36,76,28,21,'Gemini goal planner','Select objective and source references\nNo SQL or payment instructions')
box(70,76,28,21,'Authority checks','Bind values to original source text\nMissing / unsupported → clarify','#B27936')
arrow((30,86),(36,86));arrow((64,86),(70,86))
box(2,41,28,23,'Channel3 + emulator','Cached catalog → seeded shopping\nObserved snapshot ends at day 45\nPrivate traits and future stay hidden')
box(36,41,28,23,'Trusted data / model workers','Fixed grain, units and cohort semantics\nFour real local model fits\nMature labels and temporal validation')
box(70,41,28,23,'Checked experiments','Same two pilots for both workflows\nIndependent development seeds\nCommit a bounded probe or observe')
arrow((84,76),(84,64));arrow((30,52),(36,52));arrow((64,52),(70,52))
box(2,5,28,23,'Existing PayPal plane','Sandbox adapters and stored receipts\nNo native payment in this benchmark\nFees and returns here are modeled')
box(36,5,28,23,'Durable checkpoints','Atomic local records and input hashes\nReuse completed work on resume\nUnknown paid result stops for inspection')
box(70,5,28,23,'Sealed evaluation','Unseen future after commitment\nCustomer traces, costs and outcomes\nSame simulator and no-campaign control')
arrow((84,41),(84,28));arrow((50,41),(50,28));arrow((64,16),(70,16))
fig.text(.04,.025,'One semantic model call is the default. Additional planning remains experimental after an adverse matched comparison.',fontsize=10,color='#526E79')
save(fig,'trusted-architecture','Implemented source-bound workflow. LangGraph-style durability and Anthropic-style workflow decomposition are engineering patterns, not novelty claims.')

for c in r['cases']:
    req=json.loads((BASE/'missions'/c['id']/'requests/shared-reader.json').read_text());c['sourceBinding']={'sourceIds':req.get('response',{}).get('args',{}).get('sourceIds',{}),'units':req['packet'].get('sourceUnits',[])}
# The browser needs summaries, not duplicated coefficient/inverse matrices from
# both methods. Full immutable artifacts remain in each linked mission record.
public_cases=[]
for c in r['cases']:
    m=next(x for x in c['methods'] if x['method']=='reader');nodes=[]
    for n in m['state']['nodes']:
        shown=dict(n)
        if n['name']=='models_compared':shown['output']={k:{'summary':v['summary']} for k,v in n['output'].items()}
        nodes.append(shown)
    view={k:m[k] for k in ['method','policy','grade','deltaPlatformUSD','deltaMerchantUSD']}
    view['state']={'nodes':nodes};view['score']={k:m['score'][k] for k in ['purchases','offers','recommendations','trace']}
    public_cases.append({**{k:c[k] for k in ['id','taskId','family','scenario','brief','requests','costUSD','sourceBinding']},'methods':[view]})
index={**{k:r[k] for k in ['version','generatedAt','protocolHash','summaries','contrast','costs','integrity','limitations']},'cases':public_cases,'figures':figures,'v4':{'adaptiveFinancial':v4['contrasts']['adaptiveFinancial'],'summaries':v4['summaries']}}
(BASE/'index.json').write_text(json.dumps(index,indent=2)+'\n')
print('Rendered three figures and the trusted workflow browser index.')
