"""Three research-figure design options, all describing the same V2.3 system.

Imports the existing drawing primitives and snapshot. No provider calls.
Requires the existing PDF tools and Matplotlib's bundled STIX/DejaVu fonts.
"""
from pathlib import Path
from html import escape
import base64
import json

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.graphics import renderPDF
from svglib.svglib import svg2rlg
import pypdfium2
import render_planner_architecture as base

ROOT=base.ROOT
OUT=base.OUT/"mockups"
TMP=ROOT/".local/architecture-mockups"
PDF=ROOT/"output/pdf/market-metro-architecture-mockups.pdf"
W,H=2400,1580
FONT_ROOT=ROOT/".local/research-venv/lib/python3.9/site-packages/matplotlib/mpl-data/fonts/ttf"
if not FONT_ROOT.exists():
    import matplotlib
    FONT_ROOT=Path(matplotlib.get_data_path())/"fonts/ttf"
FONT_FILES={
    "PaperSerif":"STIXGeneral.ttf","PaperSerifBold":"STIXGeneralBol.ttf",
    "PaperItalic":"STIXGeneralItalic.ttf","PaperSans":"DejaVuSans.ttf",
    "PaperSansBold":"DejaVuSans-Bold.ttf","PaperMono":"DejaVuSansMono.ttf",
    "PaperMonoBold":"DejaVuSansMono-Bold.ttf",
}
for name,file in FONT_FILES.items():
    pdfmetrics.registerFont(TTFont(name,str(FONT_ROOT/file)))
PHOTO=base.OUT/"assets/environment-snapshot.png"
ERRORS=[]
INK="#222d39";MUTED="#596a7a";LINE="#b4bec9";BLUE="#3d6489"


class Paper(base.Figure):
    def __init__(self,code,title,subtitle,family="PaperSerif",accent=BLUE):
        self.body=[];self.fonts=set();self.family=family;self.accent=accent;self.code=code
        self.rect(0,0,W,H,"white",radius=0)
        self.text(60,49,"OPTION "+code+"  /  DESIGN MOCKUP",20,MUTED,bold=True)
        self.text(W-60,49,subtitle,20,MUTED,align="end")
        self.text(60,112,title,40,INK,bold=True,max_width=W-120)
        self.line(60,139,W-60,139,"#aeb8c2",1.4)

    def text(self,x,y,value,size=24,color=INK,bold=False,align="start",max_width=None,mono=False,italic=False):
        face=("PaperMonoBold" if bold else "PaperMono") if mono else "PaperItalic" if italic else self.family+("Bold" if bold else "")
        self.fonts.add(face)
        length=pdfmetrics.stringWidth(str(value),face,size)
        if max_width is not None and length>max_width:
            ERRORS.append(f"{self.code}: {value!r}: {length:.1f} > {max_width}")
        self.add(f'<text x="{x}" y="{y}" font-family="{face}" font-size="{size}" text-anchor="{align}" fill="{color}">{escape(str(value))}</text>')

    def lines(self,x,y,values,size=23,color=MUTED,gap=34,**kw):
        for i,v in enumerate(values):self.text(x,y+i*gap,v,size,color,**kw)

    def panel(self,x,y,w,h,label,fill="white",stroke=LINE,accent=None):
        self.rect(x,y,w,h,fill,stroke,radius=1,width=1.5)
        self.text(x+20,y+35,label,25,accent or INK,bold=True,max_width=w-40)

    def node(self,x,y,w,h,title,details=(),fill="white",stroke=LINE,mono=False):
        self.rect(x,y,w,h,fill,stroke,radius=3,width=1.5)
        self.text(x+20,y+37,title,26,INK,bold=True,max_width=w-40)
        self.lines(x+20,y+73,details,21,MUTED,gap=29,max_width=w-40,mono=mono)

    def agent(self,x,y,size=48,color=INK):
        self.add(f'<g transform="translate({x},{y}) scale({size/48})" stroke="{color}" stroke-width="1.7" fill="none"><rect x="8" y="8" width="32" height="32" rx="2"/><path d="M16 1 V8 M24 1 V8 M32 1 V8 M16 40 V47 M24 40 V47 M32 40 V47 M1 16 H8 M1 24 H8 M1 32 H8 M40 16 H47 M40 24 H47 M40 32 H47 M16 16 L31 18 L22 31Z"/><circle cx="16" cy="16" r="3" fill="white"/><circle cx="31" cy="18" r="3" fill="white"/><circle cx="22" cy="31" r="3" fill="white"/></g>')

    def checkpoint(self,x,y,name):
        self.add(f'<polygon points="{x},{y-11} {x+11},{y} {x},{y+11} {x-11},{y}" fill="white" stroke="{self.accent}" stroke-width="1.8"/>')
        self.text(x+21,y+6,name,18,self.accent,mono=True)

    def table(self,x,y,width,rows,size=21):
        for i,(left,right) in enumerate(rows):
            yy=y+i*37
            self.text(x,yy,left,size,INK)
            self.text(x+width,yy,right,size,INK,align="end",mono=True)
            self.line(x,yy+12,x+width,yy+12,"#d6dde4",.8)

    def caption(self,first,second):
        self.line(60,1483,W-60,1483,"#adb7c1",1)
        self.text(60,1521,first,23,INK,max_width=W-120)
        self.text(60,1556,second,20,MUTED,max_width=W-120)

    def save(self,name):
        css=[]
        for face in sorted(self.fonts):
            data=base64.b64encode((FONT_ROOT/FONT_FILES[face]).read_bytes()).decode()
            css.append(f"@font-face{{font-family:{face};src:url(data:font/ttf;base64,{data})}}")
        p=TMP/(name+".svg")
        p.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><title>Market Metro mockup {self.code}</title><style>{"".join(css)}</style>{"".join(self.body)}</svg>')
        return p


def classic():
    f=Paper("A","A bounded agent within a frozen commerce system","STIX serif  /  Journal-style hierarchy")
    f.panel(60,195,640,640,"(a)  Environment plane")
    f.photo(PHOTO,80,259,600,360)
    f.text(82,655,"s_t  :  shoppers, stock, cash and obligations",24,italic=True,max_width=596)
    f.lines(82,696,["12 merchants; 600 simulated shoppers","Orders, deliveries and mature returns","Review barriers: displayed days 31 and 61"],22,gap=32,max_width=596)
    f.text(82,807,"Allowed projection: o_t = observe(s_t)",22,INK,italic=True)

    f.panel(850,195,1490,640,"(b)  Agent plane: proposals, experiments and admission")
    f.node(890,285,350,106,"Review state  H_t",["Prior trials and active contract"],fill="#f8f9fa")
    f.node(1390,275,500,127,"LLM agent",["Select query, features, models, campaign"],fill="#f2f5f8",stroke="#697c91")
    f.agent(1824,295,43,BLUE)
    f.node(2040,285,260,106,"Typed call",["name + args","evidenceId"],mono=True)
    f.arrow([(1240,338),(1390,338)],INK,2)
    f.arrow([(1890,338),(2040,338)],INK,2)
    f.arrow([(700,445),(780,445),(780,338),(890,338)],BLUE,2.4)
    f.text(779,417,"o_t",24,BLUE,align="middle",italic=True)

    f.node(890,490,410,140,"Inspect demand",["Signals, stock, contact funnel","Maturity-filtered outcomes"])
    f.node(1370,490,450,140,"Fit model candidates",["Two local model/feature recipes","Validation reports + modelHash"])
    f.logo("python",1734,507,28);f.logo("scikit-learn",1774,499,42)
    f.node(1890,490,410,140,"Evaluate campaign",["3 separate development worlds","Hash-bound trial receipt"])
    f.arrow([(2170,391),(2170,444),(1095,444),(1095,490)],INK,1.8)
    f.text(1540,433,"bounded tool execution",21,MUTED,align="middle",italic=True)
    f.arrow([(1300,558),(1370,558)],INK,1.8)
    f.arrow([(1820,558),(1890,558)],INK,1.8)
    f.arrow([(2300,558),(2320,558),(2320,250),(1640,250),(1640,275)],BLUE,2)
    f.text(1945,242,"measured feedback",19,BLUE,align="middle",italic=True)

    f.node(960,689,1340,104,"Deterministic admission gate",
           ["Typed fields + snapshot/model/trial identity + financial guards"],fill="#f4f5f5",stroke="#5f6c79")
    f.arrow([(2095,630),(2095,689)],INK,2)
    f.text(2270,779,"publish best eligible candidate; otherwise retain",21,BLUE,align="end",italic=True)
    f.arrow([(960,743),(760,743),(760,775),(700,775)],BLUE,2.4)
    f.text(776,810,"policy a_t",20,BLUE,align="middle",italic=True)

    f.panel(60,945,1080,330,"(c)  Data and evidence plane")
    f.logo("sqlite",88,1008,45)
    f.text(150,1038,"Warehouse + JSON artifact store",27,INK,bold=True)
    for x,title,lines in [(90,"Records",["orders / events / returns","merchant + customer IDs"]),
                          (440,"Artifacts",["trained models + reports","trial receipts + hashes"]),
                          (790,"State",["review checkpoints","model spend ledger"])]:
        f.text(x,1104,title,24,INK,bold=True)
        f.lines(x,1144,lines,21,gap=32,max_width=310)
    f.text(90,1241,"Observed evidence enters planning through bounded tools.",22,MUTED,italic=True)
    f.arrow([(380,835),(380,945)],INK,1.7)
    f.arrow([(1640,835),(1640,905),(1050,905),(1050,945)],INK,1.7)

    f.panel(1240,945,1100,330,"(d)  Native PayPal Sandbox boundary")
    f.logo("paypal",1270,1016,48)
    f.node(1350,1014,250,99,"Vaulted wallet",["Saved buyer consent"])
    f.node(1650,1014,285,99,"Orders / capture",["Selected generated order"])
    f.node(1985,1014,315,99,"Verify + reconcile",["IDs, amount, fee and net"])
    f.arrow([(1600,1063),(1650,1063)],BLUE,1.9,True)
    f.arrow([(1935,1063),(1985,1063)],INK,1.8)
    f.lines(1275,1174,["order_id  →  capture_id  →  warehouse lineage","Native receipts are linked samples; simulation revenue is counted once."],22,gap=40,max_width=1025)
    f.arrow([(1140,1112),(1240,1112)],BLUE,1.9,True)
    f.arrow([(1240,1225),(1140,1225)],INK,1.8)

    f.rect(60,1340,2280,98,"#f6f7f8","#8d9aa8",radius=0,width=1.4)
    f.text(88,1378,"SEALED CONFIRMATION",23,INK,bold=True)
    f.text(540,1378,"4 unseen seeds × {fixed rules, one agent, role-split team}",24,INK)
    f.text(88,1415,"Measure settled PayPal contribution, merchant contribution, retained purchases and AI cost. Final scores do not feed the agent.",22,MUTED,max_width=2220)
    f.caption("Figure 1. A hash-bound, checkpointed workflow separates LLM proposals from deterministic financial execution.",
              "Symbols name existing V2.3 artifacts and state. The environment image is an actual recorded run; all market economics are simulated.")
    return f.save("option-a-journal")


def methods():
    f=Paper("B","Market-to-agent loop with a controlled experiment sandbox","DejaVu Sans  /  Multi-panel ML methods figure",family="PaperSans",accent="#66528f")
    teal,lav,orange="#426e71","#6a558f","#9c704d"
    f.panel(60,190,690,700,"a   Environment + observation plane",fill="#f3f7f7",stroke="#8da8aa",accent=teal)
    f.photo(PHOTO,85,260,640,384)
    f.node(94,694,622,143,"Observation projection",["Signals • inventory • orders • mature outcomes","Read-only snapshot o_t"],fill="#fff",stroke="#8da8aa")
    f.text(94,870,"12 merchants  /  600 shoppers  /  saved Day 32",19,teal,max_width=622)

    f.panel(880,190,1460,700,"b   Agent plane",fill="#f6f3fa",stroke="#aa9bbd",accent=lav)
    f.node(920,275,340,151,"Context",["Snapshot + review history","Prior model / trial artifacts"],fill="#fff",stroke="#c5bbd4")
    f.node(1375,275,380,151,"LLM agent",["Design an experiment","Propose or revise a campaign"],fill="#e7def2",stroke=lav)
    f.agent(1688,294,42,lav)
    f.node(1870,275,430,151,"Typed proposal",["campaign + modelHash","context.snapshotHash"],fill="#fff",stroke="#c5bbd4",mono=True)
    f.arrow([(750,351),(920,351)],teal,2.5)
    f.text(832,330,"observe",19,teal,align="middle")
    f.arrow([(1260,351),(1375,351)],lav,2.4)
    f.arrow([(1755,351),(1870,351)],lav,2.4)

    f.add('<rect x="920" y="506" width="1380" height="322" fill="#fff" stroke="#a99dbb" stroke-width="1.5" stroke-dasharray="8 6"/>')
    f.text(944,542,"LOCAL EXPERIMENT SANDBOX",20,lav,bold=True)
    f.node(950,582,398,186,"1  Analyze",["Inspect demand and funnel","Choose window + feature view"],fill="#edf5f6",stroke="#a8c2c5")
    f.node(1414,582,398,186,"2  Train",["Fit M_1 and M_2 locally","Compare validation evidence"],fill="#faf1e7",stroke="#cbb69e")
    f.logo("python",1440,709,32);f.logo("scikit-learn",1482,701,47)
    f.node(1878,582,394,186,"3  Evaluate",["Matched development trials","Return measured E_t"],fill="#edf3ed",stroke="#a9bdac")
    f.arrow([(1348,675),(1414,675)],INK,2)
    f.arrow([(1812,675),(1878,675)],INK,2)
    f.arrow([(2085,426),(2085,479),(1149,479),(1149,506)],lav,2.2)
    f.text(1470,469,"typed calls",18,lav,align="middle")
    f.arrow([(2272,674),(2320,674),(2320,245),(1565,245),(1565,275)],teal,2.2)
    f.text(1960,237,"trial feedback",18,teal,align="middle")
    f.text(944,804,"Historical data + mature in-run labels; no hidden shopper state or active-market future.",19,MUTED,max_width=1320)

    f.panel(880,935,1460,160,"c   Deterministic publication plane",fill="#f8f1f0",stroke="#bfaaa5",accent="#855b53")
    for x,title in [(920,"Schema + scope"),(1370,"Artifact identity"),(1820,"Financial guards")]:
        f.text(x,1019,title,24,INK,bold=True)
    f.text(920,1061,"Admit the best eligible tested contract, or keep the incumbent policy.",22,MUTED)
    f.arrow([(2080,890),(2080,935)],INK,2)
    f.arrow([(880,1010),(795,1010),(795,820),(750,820)],teal,2.5)
    f.text(810,913,"act",19,teal,align="middle")

    f.panel(60,1180,1045,272,"d   Data plane",fill="#f3f5f8",stroke="#a4b2c3",accent="#4d6782")
    f.logo("sqlite",85,1252,47)
    f.text(151,1284,"Warehouse + checkpoint store",26,INK,bold=True)
    f.lines(92,1334,["Events / orders / returns  •  Models / reports / decision logs","Snapshot, model, contract and trial hashes preserve lineage."],21,gap=43,max_width=975)
    f.arrow([(400,890),(400,1180)],teal,2)
    f.text(422,1141,"record outcomes",19,teal)

    f.panel(1200,1180,1140,272,"e   PayPal Sandbox + receipt lineage",fill="#f0f5fb",stroke="#9ab0c9",accent=BLUE)
    f.logo("paypal",1228,1254,49)
    f.text(1310,1284,"Saved wallet",24,INK,bold=True)
    f.text(1645,1284,"Orders / capture",24,INK,bold=True)
    f.text(2020,1284,"Verified receipt",24,INK,bold=True)
    f.arrow([(1558,1276),(1620,1276)],BLUE,2,True)
    f.arrow([(1922,1276),(1994,1276)],BLUE,2)
    f.text(1228,1341,"Recorded native example: $64.00 gross  •  $2.48 fee  •  $61.52 proceeds",21,BLUE)
    f.text(1228,1397,"Fictitious funds; receipt linked to an existing simulated order.",21,MUTED)
    f.arrow([(1105,1290),(1200,1290)],BLUE,2,True)
    f.arrow([(1200,1410),(1105,1410)],INK,1.8)
    f.caption("Figure 1. The LLM agent chooses experiments; trusted workers fit, test, validate and execute the resulting contracts.",
              "Independent confirmation compares fixed, single-agent and role-split controls on four frozen unseen seeds; those final scores remain outside the loop.")
    return f.save("option-b-methods")


def protocol():
    f=Paper("C","Evidence-to-action protocol with typed checkpoints","STIX + monospace  /  Systems-protocol figure")
    f.panel(60,190,650,518,"(a)  Frozen environment")
    f.photo(PHOTO,80,252,610,366)
    f.text(84,660,"Emit observations; apply only admitted actions.",24,INK,italic=True,max_width=600)
    f.text(84,691,"Reviews pause dates at displayed days 31 and 61.",21,MUTED,max_width=600)

    f.panel(835,190,1505,518,"(b)  LLM agent: six bounded decision stages")
    f.agent(866,258,51,BLUE)
    f.text(944,296,"LLM agent",34,INK,bold=True)
    f.text(2310,293,"Generalist or sequential role briefs",22,MUTED,align="end")
    names=["QUERY","DATASET","EXPERIMENTS","MODEL","CAMPAIGN","REVISION"]
    for i,name in enumerate(names):
        x=870+i*242
        f.rect(x,355,210,70,"#f5f7f9","#8b9daf",radius=0,width=1.5)
        f.text(x+105,397,name,18,INK,bold=True,align="middle",mono=True,max_width=192)
        if i<5:f.arrow([(x+210,390),(x+242,390)],INK,1.7)
        f.checkpoint(x+105,462,"c"+str(i))
    f.text(870,522,"Tool declarations constrain each stage; evidenceId binds the supplied input.",25,INK,max_width=1430)
    f.text(870,565,"12 decision stages / run  •  max 14 provider attempts  •  $0.19 run cap",24,MUTED)
    f.line(870,599,2300,599,"#c1ccd6",1.2)
    f.text(870,642,"H_t = previous reviews + active policy + measured artifacts",23,BLUE,mono=True,max_width=1430)
    f.text(870,681,"Context is explicit application state, not an unrestricted continuing chat.",22,MUTED,italic=True)
    f.arrow([(710,340),(835,340)],BLUE,2.4)
    f.text(772,319,"o_t",24,BLUE,align="middle",italic=True)

    f.panel(60,780,650,647,"(c)  Data plane: records and contracts")
    f.logo("sqlite",86,846,38)
    f.text(142,875,"Warehouse / JSON artifacts",26,INK,bold=True)
    f.text(86,935,"Observation packet",22,BLUE,bold=True)
    f.lines(86,977,["day, marketProfile","snapshotHash","observed signals + mature labels"],20,INK,gap=34,mono=True,max_width=595)
    f.line(86,1084,680,1084,"#bec9d4",1)
    f.text(86,1125,"Compiled campaign",22,BLUE,bold=True)
    f.lines(86,1166,["campaign: {kind, contactsPer100,","  forecast, coverDays, ...}","modelHash","context: {day, snapshotHash, ...}"],20,INK,gap=34,mono=True,max_width=595)
    f.text(86,1354,"Persist models, decisions and spend.",22,MUTED,italic=True)
    f.text(86,1393,"Native receipts join existing order IDs.",22,MUTED,italic=True)
    f.arrow([(360,708),(360,780)],INK,2)

    f.panel(835,780,1505,347,"(d)  Trusted workers and admission")
    f.node(870,850,390,121,"Inspect + fit",["Data windows and local models","Validation metrics + modelHash"])
    f.logo("python",1175,868,25);f.logo("scikit-learn",1210,861,37)
    f.node(1350,850,410,121,"Evaluate",["3 development market clones","Measured trial receipt E_t"])
    f.node(1855,850,445,121,"Validate + select",["Schema / identity / economics","Publish best eligible contract"])
    f.arrow([(1260,910),(1350,910)],INK,2)
    f.arrow([(1760,910),(1855,910)],INK,2)
    f.arrow([(1560,708),(1560,780)],BLUE,2.2)
    f.arrow([(2300,850),(2320,850),(2320,746),(2170,746),(2170,708)],BLUE,2.1)
    f.text(2199,738,"feedback",19,BLUE)
    f.rect(870,1010,1430,77,"#f4f6f8","#9babbc",radius=0,width=1.2)
    f.text(894,1040,"Receipt identity: contractHash + modelHash + trialHash",21,INK,mono=True,max_width=1370)
    f.text(894,1073,"Same review context; verified measurements; no unpaid liabilities.",22,MUTED)
    f.arrow([(2300,942),(2365,942),(2365,1154),(744,1154),(744,666),(710,666)],BLUE,2)
    f.text(1355,1146,"admitted policy; otherwise retain incumbent",21,BLUE,align="middle",italic=True)

    f.panel(835,1200,1505,227,"(e)  PayPal execution and independent evaluation")
    f.logo("paypal",864,1274,43)
    f.text(930,1300,"Vault → Orders/capture → verified receipt",26,INK,bold=True,max_width=785)
    f.text(870,1350,"Selected-order mirror; native amounts remain separate.",23,MUTED)
    f.line(1725,1256,1725,1398,"#b7c2cc",1.3)
    f.text(1760,1294,"SEALED BENCHMARK",22,INK,bold=True)
    f.lines(1760,1333,["4 seeds × fixed / agent / team","Net, purchases, cost, merchant effect"],21,MUTED,gap=35,max_width=540)
    f.arrow([(710,1320),(835,1320)],BLUE,2,True)
    f.caption("Figure 1. Typed contracts and checkpoints make model-driven choices replayable and constrain their execution.",
              "Checkpoint markers denote recorded stages, not automatic crash-resume guarantees. The diagram uses current V2.3 interfaces and an actual saved environment.")
    return f.save("option-c-protocol")


def main():
    OUT.mkdir(parents=True,exist_ok=True);TMP.mkdir(parents=True,exist_ok=True);PDF.parent.mkdir(parents=True,exist_ok=True)
    paths=[classic(),methods(),protocol()]
    if ERRORS:raise ValueError("\n".join(ERRORS))
    pdf=canvas.Canvas(str(PDF),pagesize=(W/2,H/2),pageCompression=1)
    pdf.setTitle("Market Metro - architecture design options A, B and C")
    for p in paths:
        drawing=svg2rlg(str(p));assert drawing is not None
        pdf.saveState();pdf.scale(.5,.5);renderPDF.draw(drawing,pdf,0,0);pdf.restoreState();pdf.showPage()
    pdf.save();document=pypdfium2.PdfDocument(str(PDF))
    for i,p in enumerate(paths):
        page=document[i];page.render(scale=2).to_pil().save(OUT/(p.stem+".png"));page.close()
    document.close()
    manifest={"status":"DESIGN_OPTIONS_AWAITING_USER_SELECTION","version":"commerce-harness-v2.3",
              "styles":{"A":"STIX serif / journal overview","B":"DejaVu Sans / ML methods","C":"STIX + monospace / typed protocol"},
              "photo":base.snapshot_manifest(),"canonicalLabel":"LLM agent","newModelCalls":0,"newPayments":0,
              "scope":"Alternative presentations of existing implementation; none introduces a new agent, tool or evaluation result."}
    (OUT/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
    print(json.dumps({"previews":[str(OUT/(p.stem+".png")) for p in paths],"pdf":str(PDF)}))


if __name__=="__main__":
    main()
