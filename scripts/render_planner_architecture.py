"""Draw the implemented V2.3 workflow beside an actual recorded environment capture.

Uses local evidence only. No model, payment, or other runtime API calls.
Artifact-only dependencies: reportlab, svglib, pypdfium2.
"""
from pathlib import Path
from html import escape
import base64
import hashlib
import json
import math
import re
import xml.etree.ElementTree as ET

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.graphics import renderPDF
from svglib.svglib import svg2rlg
import pypdfium2

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/figures/planner-v23"
STUDY = ROOT / "docs/commerce-expanded/harness-v2/v23-20261104"
PDF = ROOT / "output/pdf/market-metro-planner-v23.pdf"
W, H = 2400, 1580
NAVY, BLUE, PURPLE, GREEN = "#102f49", "#0070e0", "#7955be", "#087f71"
MUTED, LINE, RED = "#566d81", "#d7e1ea", "#b23f49"
FONT = ROOT / "demo/assets/fonts"
for name, weight in [("DMSans", 400), ("DMSans-Bold", 700)]:
    pdfmetrics.registerFont(TTFont(name, str(FONT / f"dm-sans-{weight}.ttf")))
pdfmetrics.registerFontFamily("DMSans", normal="DMSans", bold="DMSans-Bold")
result = json.loads((STUDY / "results.json").read_text())
assert result["status"] == "COMPLETED"
TEXT_ERRORS = []


class Figure:
    def __init__(self, title, subtitle="", number="1"):
        self.body = []
        self.rect(0,0,W,H,"#ffffff",radius=0)
        self.text(60,60,title,36,"#253346",bold=True,max_width=W-260)
        self.text(W-60,58,"V2.3",18,MUTED,align="end")
        self.line(60,93,W-60,93,"#d0d6dc",1)

    def add(self, value):
        self.body.append(value)

    def rect(self, x, y, w, h, fill="white", stroke="none", radius=15, width=2):
        self.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="{fill}" stroke="{stroke}" stroke-width="{width}"/>')

    def text(self, x, y, value, size=24, color=NAVY, bold=False, align="start", max_width=None):
        family = "DMSans-Bold" if bold else "DMSans"
        measured = pdfmetrics.stringWidth(str(value), family, size)
        if max_width is not None and measured > max_width:
            TEXT_ERRORS.append(f"Text exceeds width: {value!r} ({measured:.1f} > {max_width})")
        self.add(f'<text x="{x}" y="{y}" font-family="{family}" font-size="{size}" text-anchor="{align}" fill="{color}">{escape(str(value))}</text>')

    def line(self, x1, y1, x2, y2, color=LINE, width=2):
        self.add(f'<path d="M{x1},{y1} L{x2},{y2}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round"/>')

    def arrow(self, points, color=BLUE, width=4, dashed=False):
        coords = " ".join(f"{x},{y}" for x,y in points)
        dash = ' stroke-dasharray="10 8"' if dashed else ""
        self.add(f'<polyline points="{coords}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"{dash}/>')
        x,y = points[-1]; px,py = points[-2]
        angle = math.atan2(y-py, x-px)
        corners = [(x,y)] + [(x-9*math.cos(angle)+s*4*math.sin(angle), y-9*math.sin(angle)-s*4*math.cos(angle)) for s in [1,-1]]
        self.add(f'<polygon points="{" ".join(f"{a},{b}" for a,b in corners)}" fill="{color}"/>')

    def logo(self, name, x, y, size, color=None):
        raw = (OUT / "assets" / (name+".svg")).read_text()
        node = ET.fromstring(raw)
        box = [float(v) for v in node.attrib["viewBox"].split()]
        inner = re.sub(r"^.*?<svg\b[^>]*>", "", raw, count=1, flags=re.S)
        inner = re.sub(r"</svg>\s*$", "", inner)
        inner = re.sub(r"<title>.*?</title>", "", inner, flags=re.S)
        fill = color or node.attrib.get("fill", "#000000")
        self.add(f'<g transform="translate({x},{y}) scale({size/box[2]})" fill="{fill}">{inner}</g>')

    def photo(self, path, x, y, w, h):
        data=base64.b64encode(path.read_bytes()).decode()
        self.add(f'<image x="{x}" y="{y}" width="{w}" height="{h}" preserveAspectRatio="xMidYMid meet" xlink:href="data:image/png;base64,{data}"/>')

    def save(self, name):
        css = []
        for family,weight in [("DMSans",400),("DMSans-Bold",700)]:
            data=base64.b64encode((FONT/f"dm-sans-{weight}.ttf").read_bytes()).decode()
            css.append(f"@font-face{{font-family:{family};src:url(data:font/ttf;base64,{data})}}")
        path=OUT/(name+".svg")
        path.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img"><title>Market Metro V2.3: {escape(name)}</title><style>{"".join(css)}</style>{"".join(self.body)}</svg>')
        return path


def architecture():
    f=Figure("Market Metro: from shopper activity to tested campaigns")
    ink="#253346"; muted="#596d7e"; teal="#426e71"; lav="#6a558f"; blue="#4d6782"; edge="#8392a2"
    evidence=json.loads((OUT/"assets/diagram-evidence.json").read_text())
    themes={
        "world":("#f3f7f7","#8da8aa",teal),
        "agent":("#f6f3fa","#aa9bbd",lav),
        "data":("#f3f5f8","#a4b2c3",blue),
        "tools":("#f6f3fa","#aa9bbd",lav),
        "payment":("#f0f5fb","#9ab0c9","#3d6489"),
    }

    def plane(x,y,w,h,title,kind):
        fill,stroke,color=themes[kind]
        f.rect(x,y,w,h,fill,stroke,radius=4,width=1.5)
        f.text(x+22,y+37,title,26,color,True,max_width=w-44)

    def icon(kind,x,y,size=34,color=ink):
        shapes={
            "explore":'<circle cx="13" cy="13" r="9"/><path d="M20 20 L30 30 M6 15 L10 11 L14 14 L19 7"/>',
            "data":'<rect x="2" y="3" width="28" height="26" rx="2"/><path d="M2 11 H30 M11 11 V29 M21 11 V29 M2 20 H30"/>',
            "models":'<circle cx="16" cy="5" r="3"/><circle cx="6" cy="23" r="4"/><circle cx="26" cy="23" r="4"/><path d="M16 8 V13 M6 19 V13 H26 V19"/>',
            "compare":'<path d="M2 29 H31 M7 25 V15 H13 V25 M20 25 V6 H26 V25"/><path d="M5 5 H12 M9 2 L12 5 L9 8"/>',
            "campaign":'<path d="M4 12 H12 L28 4 V27 L12 20 H4Z M8 20 L11 30 H17 L14 21 M28 11 L32 9 M28 20 L32 22"/>',
            "refine":'<path d="M27 11 A12 12 0 0 0 6 6 L3 10 M3 3 V10 H10 M5 21 A12 12 0 0 0 26 26 L29 22 M22 22 H29 V29"/>',
            "agent":'<rect x="7" y="7" width="18" height="18" rx="2"/><path d="M10 1 V7 M16 1 V7 M22 1 V7 M10 25 V31 M16 25 V31 M22 25 V31 M1 10 H7 M1 16 H7 M1 22 H7 M25 10 H31 M25 16 H31 M25 22 H31 M11 12 L21 13 L15 21Z"/><circle cx="11" cy="12" r="2" fill="white"/><circle cx="21" cy="13" r="2" fill="white"/><circle cx="15" cy="21" r="2" fill="white"/>',
            "file":'<path d="M6 2 H23 L29 8 V30 H6Z M23 2 V8 H29 M11 14 H23 M11 19 H23 M11 24 H19"/>',
            "history":'<path d="M4 11 A13 13 0 1 1 4 24 M1 4 V12 H9 M16 7 V17 L22 20"/>',
            "check":'<path d="M16 2 L29 7 V17 Q29 25 16 31 Q3 25 3 17 V7Z M9 16 L14 21 L24 11"/>',
            "trial":'<rect x="2" y="3" width="10" height="9"/><rect x="20" y="3" width="10" height="9"/><path d="M7 12 V19 H25 V12 M16 19 V26 M12 26 L15 29 L22 23"/>',
            "budget":'<rect x="2" y="8" width="28" height="21" rx="2"/><path d="M4 8 L25 2 V8"/><rect x="21" y="15" width="11" height="8" rx="1"/><circle cx="25" cy="19" r="1"/>',
            "stock":'<path d="M2 9 L16 2 L30 9 L16 16Z M2 9 V24 L16 31 L30 24 V9 M16 16 V31 M8 6 L23 13"/>',
            "merchant":'<path d="M4 12 V29 H28 V12 M1 12 L5 3 H27 L31 12 M1 12 Q5 18 9 12 Q13 18 17 12 Q21 18 25 12 Q29 18 31 12 M10 29 V21 H19 V29"/>',
            "receipt":'<path d="M5 2 L9 5 L13 2 L17 5 L21 2 L25 5 L29 2 V30 L25 27 L21 30 L17 27 L13 30 L9 27 L5 30Z M10 11 H24 M10 16 H24 M10 21 H19"/>',
        }
        f.add(f'<g transform="translate({x},{y}) scale({size/32})" fill="none" stroke="{color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">{shapes[kind]}</g>')

    def card(x,y,w,h,title,lines,fill,stroke):
        f.rect(x,y,w,h,fill,stroke,radius=4,width=1.4)
        f.text(x+20,y+38,title,25,ink,True,max_width=w-100)
        for i,line in enumerate(lines):
            f.text(x+20,y+77+i*31,line,21,muted,max_width=w-40)

    plane(60,190,650,518,"A. Market environment","world")
    f.text(681,226,"Saved Day 32",18,teal,align="end")
    f.photo(OUT/"assets/environment-snapshot.png",80,252,610,366)
    f.text(84,657,"Shoppers browse, buy and receive orders.",23,ink,max_width=600)
    f.text(84,691,"12 stores · 600 shoppers · paused during reviews",20,muted,max_width=600)

    plane(835,190,1505,518,"B. How the LLM agent decides","agent")
    icon("agent",868,262,48,lav)
    f.text(939,299,"LLM agent",34,ink,True)
    f.logo("google-cloud",2165,266,29)
    f.text(2210,289,"Vertex AI",20,muted)
    f.text(870,335,"Uses market evidence to plan and improve campaigns.",22,muted)
    steps=[
        ("Explore","Find a sales gap","explore","#edf5f6","#a8c2c5",teal),
        ("Prepare","Choose useful data","data","#f3f5f8","#a4b2c3",blue),
        ("Try models","Request local training","models","#faf1e7","#cbb69e","#9c704d"),
        ("Compare","Choose a model","compare","#edf3ed","#a9bdac","#58775e"),
        ("Plan","Propose a campaign","campaign","#e7def2","#aa9bbd",lav),
        ("Refine","Use trial results","refine","#f0eaf6","#aa9bbd",lav),
    ]
    for i,(title,detail,glyph,fill,stroke,color) in enumerate(steps):
        x=870+i*242
        f.rect(x,368,210,135,fill,stroke,radius=4,width=1.3)
        icon(glyph,x+88,383,34,color)
        f.text(x+105,450,title,22,ink,True,align="middle",max_width=190)
        f.text(x+105,482,detail,17,muted,align="middle",max_width=192)
        if i<5:f.arrow([(x+210,435),(x+242,435)],edge,1.8)
        f.line(x+105,503,x+105,522,"#b4a7c7",1.3)
        f.add(f'<circle cx="{x+105}" cy="535" r="12" fill="white" stroke="{lav}" stroke-width="1.5"/><path d="M{x+99} 535 L{x+103} 539 L{x+112} 530" fill="none" stroke="{lav}" stroke-width="1.8"/>')
        f.text(x+105,570,"Saved",16,lav,align="middle")
    f.text(870,606,"Each decision is saved with the evidence behind it.",22,ink)
    f.line(870,626,2300,626,"#c9bed7",1.2)
    for x,label,glyph in [(870,"Market activity","explore"),(1335,"Earlier tests","trial"),(1810,"Current campaign","campaign")]:
        icon(glyph,x,651,29,lav)
        f.text(x+44,675,label,23,muted)
    f.arrow([(710,340),(835,340)],teal,2.4)
    f.text(772,319,"activity",19,teal,align="middle")

    plane(60,780,650,647,"C. Data plane: what gets saved","data")
    f.logo("sqlite",87,842,42)
    f.text(150,875,"Market records",27,ink,True)
    f.text(150,907,"AG Studio / SQLite",18,muted)
    f.text(87,943,"Orders, purchases and returns",22,muted)
    for x,label,align in [(88,"Order","start"),(277,"Merchant","start"),(659,"USD","end")]:
        f.text(x,981,label,18,muted,True,align=align)
    f.line(88,996,660,996,"#c4cfda",1.1)
    for i,row in enumerate(evidence["orders"]):
        yy=1034+i*49
        if i==0:f.rect(80,yy-28,588,39,"#e5edf8",radius=2)
        order=row["order_id"].split("-SIM-CAPTURE-")[1].split("-MERCHANT-")[0]
        merchant=row["shortMerchant"].replace("MERCHANT-","M")
        f.text(88,yy,"#"+order,21,ink,bold=i==0)
        f.text(277,yy,merchant,21,ink)
        f.text(659,yy,"$"+format(row["total_cents"]/100,".2f"),21,blue if i==0 else ink,bold=i==0,align="end")
    f.line(88,1163,660,1163,"#c4cfda",1.1)
    f.text(87,1200,"Saved work",23,blue,True)
    for x,label,glyph in [(174,"Models","models"),(381,"Plans","campaign"),(584,"Decisions","history")]:
        icon(glyph,x-20,1231,40,blue)
        f.text(x,1300,label,22,ink,True,align="middle")
    f.text(87,1367,"Every campaign links back to its evidence.",21,muted,max_width=585)
    f.text(87,1401,"Receipts link to the same order.",21,muted,max_width=585)
    f.arrow([(360,708),(360,780)],teal,2)
    f.text(382,750,"records",18,teal)

    plane(835,780,1505,347,"D. Local tools and experiment sandbox","tools")
    card(870,850,390,121,"Learn from data",
         ["Analyze demand and train models","Compare prediction quality"],"#edf5f6","#a8c2c5")
    f.logo("python",1175,866,26);f.logo("scikit-learn",1210,858,38)
    card(1350,850,410,121,"Try the campaign",
         ["Replay separate test markets","Compare purchases and net value"],"#faf1e7","#cbb69e")
    icon("trial",1704,866,34,"#9c704d")
    card(1855,850,445,121,"Check and launch",
         ["Check costs, stock and merchant impact","Keep the current plan if checks fail"],"#edf3ed","#a9bdac")
    icon("check",2243,865,35,"#58775e")
    f.arrow([(1260,910),(1350,910)],edge,2)
    f.arrow([(1760,910),(1855,910)],edge,2)
    f.arrow([(1560,708),(1560,780)],lav,2.2)
    f.text(1582,750,"run tests",18,lav)
    f.arrow([(2300,850),(2320,850),(2320,746),(2170,746),(2170,708)],teal,2.1)
    f.text(2192,738,"test results",18,teal)
    f.rect(870,1010,1430,77,"#f8f1f0","#bfaaa5",radius=3,width=1.2)
    f.text(894,1044,"Before launch",22,"#855b53",True)
    for x,label,glyph in [(1170,"Budget","budget"),(1460,"Stock","stock"),(1770,"Merchant impact","merchant")]:
        icon(glyph,x,1022,28,"#855b53")
        f.text(x+40,1045,label,22,ink)
    f.text(894,1077,"The plan that was tested is the plan that runs.",22,muted)
    f.arrow([(2300,942),(2365,942),(2365,1154),(744,1154),(744,666),(710,666)],teal,2)
    f.text(1355,1146,"Apply the campaign to the market",21,teal,align="middle")

    plane(835,1200,1505,227,"E. PayPal Sandbox and performance review","payment")
    f.logo("paypal",866,1275,48)
    for x,label,glyph in [(957,"Saved buyer","budget"),(1223,"Test payment","merchant"),(1502,"Receipt","receipt")]:
        icon(glyph,x,1273,32,blue)
        f.text(x+46,1300,label,22,ink,True)
    f.arrow([(1164,1290),(1211,1290)],blue,1.8,True)
    f.arrow([(1454,1290),(1490,1290)],blue,1.8)
    f.text(870,1351,"A selected market order gets a verified Sandbox receipt.",22,muted,max_width=820)
    f.text(870,1393,"Test funds only. The receipt returns to the same order.",21,muted,max_width=820)
    f.line(1725,1256,1725,1398,"#b7c2cc",1.3)
    icon("compare",1760,1268,28,blue)
    f.text(1803,1294,"Measure the results",23,ink,True)
    f.text(1760,1332,"Fixed rules / one agent / team",21,muted)
    f.text(1760,1367,"Sales, PayPal net, merchant value, AI cost",20,muted,max_width=540)
    f.text(1760,1401,"Final scores never feed the agent.",20,muted)
    f.arrow([(710,1320),(835,1320)],blue,2,True)
    f.text(772,1300,"sample",18,blue,align="middle")
    f.arrow([(835,1395),(710,1395)],edge,1.8)
    f.text(772,1421,"receipt",16,muted,align="middle")

    f.line(60,1483,W-60,1483,"#b8c3cf",1)
    f.text(60,1521,"The agent chooses what to investigate and test. Local tools measure the outcome and control what changes in the market.",23,ink,max_width=W-120)
    f.text(60,1556,"Actual saved environment · simulated shoppers and economy · selected PayPal Sandbox receipts",20,muted,max_width=2100)
    f.text(W-60,1556,"4 NOV 2026",18,muted,align="end")
    return f.save("system-architecture")

def snapshot_manifest():
    p=OUT/"assets/environment-snapshot.png"
    metadata=json.loads((OUT/"assets/environment-snapshot.json").read_text())
    assert hashlib.sha256(p.read_bytes()).hexdigest()==metadata["sha256"]
    return {"file":str(p.relative_to(ROOT)),"sha256":metadata["sha256"],"session":metadata["recordedSession"],"day":metadata["displayedDay"]}

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    PDF.parent.mkdir(parents=True,exist_ok=True)
    svgs=[architecture()]
    if TEXT_ERRORS:
        raise ValueError("\n".join(TEXT_ERRORS))
    pdf=canvas.Canvas(str(PDF),pagesize=(W/2,H/2),pageCompression=1)
    pdf.setTitle("Market Metro - planner system architecture")
    pdf.setAuthor("Market Metro")
    for path in svgs:
        drawing=svg2rlg(str(path))
        assert drawing is not None
        pdf.saveState();pdf.scale(.5,.5)
        renderPDF.draw(drawing,pdf,0,0);pdf.restoreState();pdf.showPage()
    pdf.save()
    document=pypdfium2.PdfDocument(str(PDF))
    for i,path in enumerate(svgs):
        page=document[i]
        page.render(scale=2).to_pil().save(path.with_suffix(".png"))
        page.close()
    document.close()
    sources=["scripts/commerce-expanded/harness-v2/controller.mjs","scripts/commerce-expanded/harness-v2/tools.mjs",
             "scripts/commerce-expanded/harness-v2/trials.mjs","scripts/commerce-expanded/runner.mjs",
             "scripts/commerce-growth/autonomy/live.mjs","scripts/market-store.mjs","scripts/market-service.mjs",
             "scripts/agent-mesh/model-client.mjs",str((STUDY/"results.json").relative_to(ROOT)),
             str((STUDY/"protocol.json").relative_to(ROOT)),str((STUDY/"native-receipt.json").relative_to(ROOT)),str((OUT/"assets/diagram-evidence.json").relative_to(ROOT)),str((OUT/"assets/environment-snapshot.json").relative_to(ROOT))]
    manifest={"asOf":"2026-11-04","version":result["version"],"sourceHashes":{p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in sources},
              "figures":[str(p.relative_to(ROOT)) for p in svgs],"pdf":str(PDF.relative_to(ROOT)),
              "scope":"User-selected C layout, B palette and DM Sans, with plain-language steps and actual environment/payment evidence. Final benchmark scores remain outside planning.",
              "newModelCalls":0,"newPayments":0,"snapshot":snapshot_manifest(),"design":{"layout":"C","palette":"B","font":"DM Sans","language":"plain","agentLabel":"LLM agent","status":"USER_SELECTED"}}
    (OUT/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
    print(json.dumps({"figures":[str(p) for p in svgs],"pdf":str(PDF)}))


if __name__=="__main__":
    main()
