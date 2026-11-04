"""Draw the implemented V2.3 planner architecture as documentation-style planes.

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
W, H = 1800, 1000
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
        self.text(50,53,title,30,"#172333",bold=True,max_width=W-260)
        self.text(W-50,51,"V2.3",16,MUTED,align="end")
        self.line(50,77,W-50,77,"#d0d6dc",1)

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

    def save(self, name):
        css = []
        for family,weight in [("DMSans",400),("DMSans-Bold",700)]:
            data=base64.b64encode((FONT/f"dm-sans-{weight}.ttf").read_bytes()).decode()
            css.append(f"@font-face{{font-family:{family};src:url(data:font/ttf;base64,{data})}}")
        path=OUT/(name+".svg")
        path.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img"><title>Market Metro V2.3: {escape(name)}</title><style>{"".join(css)}</style>{"".join(self.body)}</svg>')
        return path


def architecture():
    f=Figure("Market Metro: planner–environment architecture")
    ink,edge,accent="#253346","#74818e","#315e8c"

    def plane(x,y,w,h,letter,title):
        f.rect(x,y,w,h,"#fafbfc","#aeb8c2",radius=1,width=1.4)
        f.text(x+16,y+27,letter+". "+title,18,ink,True,max_width=w-32)

    def glyph(kind,x,y,size=26):
        marks={
          "state":'<rect x="2" y="3" width="28" height="26" rx="1"/><path d="M2 11 H30 M11 11 V29 M21 11 V29 M2 20 H30"/>',
          "events":'<path d="M4 4 H23 L29 10 V29 H4Z M23 4 V10 H29 M9 15 H23 M9 20 H23 M9 25 H18"/>',
          "ledger":'<path d="M3 5 H14 Q16 5 16 8 Q16 5 19 5 H29 V28 H19 Q16 28 16 30 Q16 28 13 28 H3Z M16 8 V28 M7 11 H12 M7 17 H12 M21 11 H25 M21 17 H25"/>',
          "query":'<rect x="3" y="3" width="19" height="24"/><path d="M7 9 H17 M7 14 H15"/><circle cx="21" cy="21" r="7"/><path d="M26 26 L31 31"/>',
          "analysis":'<path d="M3 3 V29 H31 M8 25 V18 H13 V25 M18 25 V12 H23 V25 M27 25 V6 H31"/>',
          "trial":'<rect x="3" y="3" width="10" height="10"/><rect x="19" y="3" width="10" height="10"/><path d="M8 13 V20 H24 V13 M16 20 V26"/><path d="M11 26 L15 30 L23 23"/>',
          "gate":'<path d="M16 2 L30 16 L16 30 L2 16Z M9 16 L14 21 L23 11"/>',
          "file":'<path d="M6 2 H23 L29 8 V30 H6Z M23 2 V8 H29 M11 14 H23 M11 19 H23 M11 24 H19"/>',
          "wallet":'<rect x="2" y="8" width="28" height="21" rx="2"/><path d="M4 8 L25 2 V8"/><rect x="21" y="15" width="11" height="8" rx="1"/><circle cx="25" cy="19" r="1"/>',
        }
        f.add(f'<g transform="translate({x},{y}) scale({size/32})" fill="none" stroke="{ink}" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">{marks[kind]}</g>')

    def module(x,y,w,h,title,icon=None,logo=None,size=20):
        f.rect(x,y,w,h,"#ffffff","#b8c2cc",radius=2,width=1.3)
        if logo:f.logo(logo,x+14,y+(h-28)/2,28)
        elif icon:glyph(icon,x+14,y+(h-28)/2,28)
        f.text(x+56,y+h/2+7,title,size,ink,bold=True,max_width=w-70)

    plane(50,115,1700,145,"A","Environment plane")
    module(100,168,360,62,"Seeded market state",icon="state")
    module(665,168,400,62,"Orders and fulfillment",icon="events")
    module(1270,168,430,62,"Modeled payment ledger",icon="ledger")
    f.arrow([(460,199),(665,199)],edge,2)
    f.arrow([(1065,199),(1270,199)],edge,2)

    plane(50,320,480,250,"B","Data plane")
    module(75,390,430,65,"Observed state",icon="query")
    module(75,475,430,65,"Warehouse / AG Studio",logo="sqlite")
    f.arrow([(225,260),(225,320)],edge,2)
    f.text(245,298,"events",15,MUTED)

    plane(610,320,500,250,"C","Planner plane")
    module(660,390,400,65,"Gemini planner",logo="gemini")
    f.logo("google-cloud",1019,409,23)
    module(660,490,400,50,"Review history / checkpoints",icon="file",size=18)
    f.arrow([(780,455),(780,490)],edge,1.8)
    f.arrow([(505,423),(660,423)],edge,2)
    f.text(569,406,"snapshot",15,MUTED,align="middle")

    plane(1200,320,550,250,"D","Tools and execution plane")
    module(1225,390,140,65,"Analyze",icon="analysis",size=18)
    f.rect(1380,390,160,65,"#fff","#b8c2cc",radius=2,width=1.3)
    f.logo("python",1392,410,23)
    f.logo("scikit-learn",1420,404,35)
    f.text(1467,429,"Train",19,ink,True)
    module(1555,390,170,65,"Test",icon="trial",size=19)
    module(1225,485,500,55,"Validate → publish / retain",icon="gate",size=19)
    f.arrow([(1365,422),(1380,422)],edge,1.5)
    f.arrow([(1540,422),(1555,422)],edge,1.5)
    f.arrow([(1640,455),(1640,485)],edge,1.6)
    f.arrow([(1060,423),(1200,423)],accent,2.2)
    f.text(1155,406,"proposal",15,accent,align="middle")
    f.arrow([(1200,530),(1085,530),(1085,471),(880,471),(880,455)],accent,2.2)
    f.text(1155,552,"tool results",15,accent,align="middle")
    f.arrow([(1725,512),(1737,512),(1737,289),(900,289),(900,260)],accent,2)
    f.text(1315,280,"admitted policy",15,accent,align="middle")

    plane(50,650,1060,250,"E","PayPal Sandbox plane")
    f.logo("paypal",1039,666,30)
    module(100,744,240,72,"Wallet token",icon="wallet",size=19)
    module(410,744,270,72,"Orders / capture",icon="events",size=19)
    module(750,744,300,72,"Receipt verification",icon="file",size=19)
    f.arrow([(340,780),(410,780)],accent,2,dashed=True)
    f.arrow([(680,780),(750,780)],edge,2)
    f.arrow([(225,540),(225,610),(545,610),(545,744)],accent,2,dashed=True)
    f.text(373,632,"selected order",15,accent,align="middle")
    f.arrow([(1050,780),(1080,780),(1080,600),(430,600),(430,540)],edge,2)
    f.text(915,592,"receipt",15,MUTED)

    plane(1200,650,550,250,"F","Evaluation plane")
    for x,title in [(1225,"Fixed"),(1394,"Planner"),(1563,"Team")]:
        f.rect(x,727,142,48,"white","#b8c2cc",radius=2,width=1.3)
        f.text(x+71,758,title,19,ink,True,align="middle")
    f.line(1296,775,1296,798,edge,1.5)
    f.line(1296,798,1634,798,edge,1.5)
    f.line(1634,775,1634,798,edge,1.5)
    f.arrow([(1465,775),(1465,821)],edge,1.8)
    module(1225,822,480,53,"Matched-seed comparison",icon="analysis",size=19)
    f.arrow([(1750,199),(1777,199),(1777,777),(1750,777)],edge,1.8)

    for x,title,color,dashed in [(52,"Observed data / execution",edge,False),(600,"Planner–tool interaction",accent,False),(1150,"Native Sandbox sample",accent,True)]:
        f.arrow([(x,953),(x+37,953)],color,1.8,dashed=dashed)
        f.text(x+53,958,title,16,MUTED)
    f.text(1750,958,"4 NOV 2026",14,MUTED,align="end")
    return f.save("system-architecture")

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
             str((STUDY/"protocol.json").relative_to(ROOT))]
    manifest={"asOf":"2026-11-04","version":result["version"],"sourceHashes":{p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in sources},
              "figures":[str(p.relative_to(ROOT)) for p in svgs],"pdf":str(PDF.relative_to(ROOT)),
              "scope":"Implemented environment, data, planner, tool/execution, PayPal Sandbox and evaluation planes. Logical responsibilities, not independently deployed services.",
              "newModelCalls":0,"newPayments":0}
    (OUT/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
    print(json.dumps({"figures":[str(p) for p in svgs],"pdf":str(PDF)}))


if __name__=="__main__":
    main()
