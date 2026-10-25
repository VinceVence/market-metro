"""Source-grounded logical interaction diagrams; no network or model calls."""
from pathlib import Path
import json,os,hashlib
ROOT=Path(__file__).resolve().parents[1]
os.environ.setdefault('MPLCONFIGDIR',str(ROOT/'.local/matplotlib'))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.patches import FancyBboxPatch,FancyArrowPatch
from matplotlib.backends.backend_pdf import PdfPages
OUT=ROOT/'docs/figures/architecture-planes';OUT.mkdir(parents=True,exist_ok=True)
DOC=ROOT/'docs/architecture-planes';DOC.mkdir(parents=True,exist_ok=True)
for f in (ROOT/'demo/assets/fonts').glob('*.ttf'):font_manager.fontManager.addfont(str(f))
plt.rcParams.update({'font.family':'DM Sans','svg.fonttype':'path','text.parse_math':False,'font.size':12,'text.color':'#24424D','figure.facecolor':'white'})
COLORS={'data':'#6E6594','market':'#427660','agent':'#276B83','guard':'#9B6A2C','paypal':'#205995','eval':'#526E79'}
figures=[];pdf=PdfPages(OUT/'market-metro-interactions.pdf')
def canvas(title,subtitle,size=(16,10)):
    fig,ax=plt.subplots(figsize=size);fig.subplots_adjust(left=.025,right=.975,top=.86,bottom=.10);ax.set_xlim(0,100);ax.set_ylim(0,100);ax.axis('off')
    fig.text(.035,.965,title,fontsize=24,weight='bold',va='top');fig.text(.035,.91,subtitle,fontsize=12,color='#526E79',va='top');return fig,ax
def box(ax,x,y,w,h,title,lines,kind='data',tag=None):
    color=COLORS[kind];ax.add_patch(FancyBboxPatch((x,y),w,h,boxstyle='round,pad=.35,rounding_size=.8',facecolor='#F5F8F6',edgecolor=color,lw=1.2))
    ax.text(x+1.3,y+h-2,title,va='top',fontsize=13,weight='bold',color=color)
    if tag:ax.text(x+w-1.1,y+1.7,tag,ha='right',va='bottom',fontsize=9,color=color)
    ax.text(x+1.3,y+h-7,'\n'.join(lines),va='top',fontsize=10.5,linespacing=1.65,color='#24424D')
def arrow(ax,a,b,label='',dashed=False,both=False,rad=0):
    ax.add_patch(FancyArrowPatch(a,b,arrowstyle='<->' if both else '-|>',mutation_scale=14,color='#78908E',lw=1.4,linestyle='--' if dashed else '-',connectionstyle=f'arc3,rad={rad}'))
    if label:ax.text((a[0]+b[0])/2,(a[1]+b[1])/2+2,label,ha='center',fontsize=9.5,color='#526E79',bbox={'facecolor':'white','edgecolor':'none','pad':1.5})
def route(ax,points,label='',at=None,dashed=False):
    xs,ys=zip(*points);ax.plot(xs,ys,color='#78908E',lw=1.4,ls='--' if dashed else '-');arrow(ax,points[-2],points[-1],dashed=dashed)
    if label:ax.text(*(at or points[1]),label,ha='center',fontsize=9.5,color='#526E79',bbox={'facecolor':'white','edgecolor':'none','pad':1.5})
def save(fig,name,caption):
    fig.text(.035,.025,caption,fontsize=10.5,color='#526E79',va='bottom');pdf.savefig(fig,bbox_inches='tight')
    for ext in ['png','svg','pdf']:fig.savefig(OUT/f'{name}.{ext}',dpi=180,bbox_inches='tight')
    svg=OUT/f'{name}.svg';svg.write_text('\n'.join(line.rstrip() for line in svg.read_text().splitlines())+'\n')
    plt.close(fig);figures.append({'name':name,'caption':caption,'files':{ext:f'docs/figures/architecture-planes/{name}.{ext}' for ext in ['png','svg','pdf']}})

fig,ax=canvas('A · Market Metro: planes and responsibilities','Logical components inside one local app, plus external providers · Snapshot: 25 October 2026')
box(ax,2,78,22,18,'1  Channel3 plane',['Cached product listings','IDs, titles and prices','No customer warehouse'],'data','EXTERNAL DATA')
box(ax,30,78,30,18,'2  Market Metro monitor',['Seeded shoppers and merchants','Demand, stock, orders and returns','Common observed market stream'],'market','SIMULATED')
box(ax,68,78,30,18,'3  Data plane',['Live app: SQLite tables and views','v5: snapshots and JSON records','Only observed, dated evidence'],'data','LOCAL STORAGE')
arrow(ax,(24,86),(30,86),'listings');arrow(ax,(60,86),(68,86),'events')
box(ax,2,43,28,23,'4  Analytics and models',['Trusted metrics and cohort definitions','Offline model + candidate registry','Development results, with uncertainty'],'data','CODE + LOCAL ML')
box(ax,36,43,28,23,'5  Agent / controller plane',['Gemini on Vertex chooses a campaign','Code baselines see the same evidence','Select, keep, revise or observe'],'agent','1 MARKETING LLM')
box(ax,70,43,28,23,'6  Governance plane',['Allowed candidates and money limits','Checkpoint before effects','Compile the validated campaign'],'guard','DETERMINISTIC CODE')
route(ax,[(83,78),(83,72),(16,72),(16,66)],'snapshot + model evidence',at=(48,73))
arrow(ax,(30,54),(36,54),'packet');arrow(ax,(64,54),(70,54),'choice')
box(ax,2,6,28,25,'PayPal integration plane',['Separate live-app commerce planner','Guarded sandbox API adapters','Provider readback → receipt records','Not invoked by the v5 benchmark'],'paypal','EXISTING LIVE-APP PATH')
box(ax,36,6,28,25,'7  Market Metro execution',['v5: separate matched policy worlds','Campaign → shopper action → order','Shopping continues with no outreach','Live app also supports payment samples'],'market','SIMULATED EFFECTS')
box(ax,70,6,28,25,'8  Evaluation plane',['Wait for the refund outcome window','Compare full-market contribution','Deduct campaign and model costs','Retain losses and failed decisions'],'eval','SEALED UNTIL SCORING')
route(ax,[(84,43),(84,37),(50,37),(50,31)],'publish next simulated day',at=(66,38))
arrow(ax,(64,18),(70,18),'outcomes');arrow(ax,(30,18),(36,18),'sample / receipt',dashed=True,both=True)
save(fig,'system-planes','Solid arrows: v5 benchmark flow. Dashed connection: existing live-app sandbox samples, outside the v5 trial.\nChannel3 is a catalog source. Native receipts are linked samples, not extra simulated sales. Planes are responsibilities, not independent microservices.')

fig,ax=canvas('B · Evaluation: equal inputs, separate outcomes','v5 validation complete: 80 cases · economic gates not met · independent confirmation not run',size=(16,10.5))
box(ax,2,78,29,19,'Locked experiment',['Same seeds, catalog and assumptions','100 shoppers · 3 merchants','Reviews after days 30, 55 and 80'],'market')
box(ax,36,78,28,19,'Shared observed evidence',['No-outreach monitor snapshots','Same candidate / model evidence','No hidden traits or future results'],'data')
box(ax,70,78,28,19,'Durable control record',['Evidence hash and model response','Chosen policy, guard result and cost','Publish after one simulated day'],'guard')
arrow(ax,(31,87),(36,87));arrow(ax,(64,87),(70,87))
branches=[('Fresh Gemini','3 new model decisions',2),('Strong rules','4 candidate-selection variants',27),('Original rules','Unchanged rule logic',52),('First choice / none','Revision and no-outreach controls',77)]
for title,body,x in branches:box(ax,x,44,21,21,title,[body,'Own matched market world','Same exogenous random draws'],'agent' if title=='Fresh Gemini' else 'market')
route(ax,[(50,78),(50,71),(12.5,71),(12.5,65)])
for x in [37.5,62.5,87.5]:route(ax,[(50,71),(x,71),(x,65)])
box(ax,17,14,66,20,'Independent scoring after day 114',['Retained fees − processing − outreach − subsidy − model inference cost','LLM minus no campaign; LLM minus strongest preselected code baseline','LLM revisions minus repeating its first choice; merchant effects and violations'],'eval')
for x in [12.5,37.5,62.5,87.5]:route(ax,[(x,44),(x,39),(50,39),(50,34)])
ax.text(50,2,'80 validation cases complete → gates not met → confirmation remains unopened',ha='center',fontsize=12,weight='bold',color='#24424D')
save(fig,'evaluation-design','Future evaluation outcomes do not feed back into the agent. Its revisions use shared observed market data and its previous choices.\nConfidence intervals resample seed clusters, not individual shoppers. A win requires positive mean/uncertainty gates, not a selected successful seed.')

fig,ax=canvas('C · One recorded review: facts → decision → effect → score','Development example: CAMP5-pilot-2fcb4d2284fa390e · illustrative, not confirmatory evidence',size=(16,9))
items=[(2,68,'1  Day-80 snapshot',['Purchases: 91 vs 100','Premium purchases: 19 vs 25','Mature returns: 4/68 and 4/63'],'data','CODE'),(36,68,'2  Campaign planner',['Gemini selects observe','Cites demand, premium mix,','returns and available inventory'],'agent','LLM'),(70,68,'3  Validate and save',['Candidate ID exists','Evidence hash matches','No native payment authority'],'guard','CODE'),(70,27,'4  Publish at day 81',['No third campaign is launched','Ordinary shoppers keep buying','Earlier campaign effects remain'],'market','SIMULATION'),(36,27,'5  Observe through day 114',['100 shopping days finish','14-day return tail matures','All campaign and model costs kept'],'eval','CODE'),(2,27,'6  Compare this full run',['LLM: +$1.791 vs no campaign','Repeat first plan: +$0.367','Revisions: +$1.424 after costs'],'eval','POST-RUN RESULT')]
for x,y,title,body,kind,tag in items:box(ax,x,y,28,24,title,body,kind,tag)
arrow(ax,(30,80),(36,80));arrow(ax,(64,80),(70,80));arrow(ax,(84,68),(84,51));arrow(ax,(70,39),(64,39));arrow(ax,(36,39),(30,39))
ax.text(50,10,'235 recommendations across the run · 0 coupons · 935 purchases · $0.008885 model cost',ha='center',fontsize=12,color='#24424D')
save(fig,'recorded-review','This is one development market. The full-run gain must not be attributed solely to the day-80 decision.\nThe first-choice control shares the earlier choices but repeats the initial campaign; its cheaper one-call cost is included. Repeatable gains remain unproven.')

fig,ax=canvas('D · Where PayPal is used in the live application','Recorded sandbox service evidence from 24 October 2026 · separate from the new policy benchmark',size=(16,9))
box(ax,2,66,27,25,'Market Metro + warehouse',['Observed simulated purchase','Customer / order / product IDs','Channel3 product lineage','Explicit authored business request'],'market')
box(ax,36,66,28,25,'PayPal operations planner',['Separate Gemini role in live app','Selects a permitted typed action','Can inspect provider outcomes','Does not invent amounts or recipients'],'agent','LLM')
box(ax,71,66,27,25,'Server-side action guard',['Saved consent and test-store mapping','Amount caps and stable request IDs','Persist before provider effects','Unknown result → reconcile, not repeat'],'guard','CODE')
arrow(ax,(29,79),(36,79),'evidence');arrow(ax,(64,79),(71,79),'action')
box(ax,71,16,27,31,'PayPal Sandbox APIs',['Wallet / Vault and Checkout','Refunds and Shipment Tracking','Invoices: unpaid record','Subscriptions: approval-pending offer','Payouts: insufficient test funds','Transaction Search: permission denied'],'paypal','RECORDED STATES')
box(ax,36,16,28,31,'Verified native records',['Authenticated provider readback','Order / capture / operation IDs','Provider fee, net amount and status','paypal_receipts / paypal_operations','paypal_money_events'],'data','CODE + SQLITE')
box(ax,2,16,27,31,'Evidence and accounting',['Join receipt to original order','Keep simulated and native dates apart','Do not count sample as a second sale','Provider fee is observed; processing','cost and platform profit are not'],'eval')
arrow(ax,(84,66),(84,47),'API request');arrow(ax,(71,31),(64,31),'readback');arrow(ax,(36,31),(29,31),'lineage')
save(fig,'paypal-live-path','Six service workflows have recorded sandbox readback; unpaid invoices and unactivated subscription offers are not sales.\nNo production funds, no webhook integration claim, and no new native payment in v5. API integration evidence does not prove PayPal profit.')

pdf.close()
sources=['scripts/campaign-controller/runtime.mjs','scripts/campaign-controller/evidence.mjs','scripts/campaign-controller/benchmark.mjs','scripts/campaign-controller/agent.mjs','scripts/paypal-commerce.mjs','scripts/market-store.mjs','docs/paypal-services.md']
manifest={'asOf':'2026-10-25','scope':'Logical app planes, v5 experiment boundaries and one recorded development example. Full 80-case validation completed; economic gates not passed; confirmation not run.','sourceHashes':{p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in sources},'figures':figures,'combinedPDF':'docs/figures/architecture-planes/market-metro-interactions.pdf'}
(DOC/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Rendered four source-grounded figures and one combined PDF.')
