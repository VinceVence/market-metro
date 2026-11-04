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
W, H = 2400, 1470
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
    f=Figure("Market Metro: the agent–environment workflow")
    ink,edge,accent="#253346","#7f8d9b","#315e8c"
    snapshot=json.loads((OUT/"assets/environment-snapshot.json").read_text())
    evidence=json.loads((OUT/"assets/diagram-evidence.json").read_text())

    def plane(x,y,w,h,letter,title):
        f.rect(x,y,w,h,"#fafbfc","#b4c0cd",radius=6,width=1.5)
        f.text(x+26,y+44,letter+". "+title,26,ink,True,max_width=w-52)

    def chip(x,y,w,label):
        f.rect(x,y,w,37,"#edf2f7",radius=4)
        f.text(x+w/2,y+25,label,18,MUTED,align="middle",max_width=w-12)

    def glyph(kind,x,y,size=36,color=ink):
        marks={
          "trend":'<path d="M3 3 V29 H31 M7 23 L13 16 L19 19 L29 7"/><circle cx="13" cy="16" r="1.5"/><circle cx="29" cy="7" r="1.5"/>',
          "trial":'<rect x="2" y="3" width="10" height="9"/><rect x="20" y="3" width="10" height="9"/><path d="M7 12 V19 H25 V12 M16 19 V25"/><path d="M11 25 L15 29 L23 22"/>',
          "gate":'<path d="M16 2 L30 16 L16 30 L2 16Z M9 16 L14 21 L23 11"/>',
          "file":'<path d="M6 2 H23 L29 8 V30 H6Z M23 2 V8 H29 M11 14 H23 M11 19 H23 M11 24 H19"/>',
          "wallet":'<rect x="2" y="8" width="28" height="21" rx="2"/><path d="M4 8 L25 2 V8"/><rect x="21" y="15" width="11" height="8" rx="1"/><circle cx="25" cy="19" r="1"/>',
          "api":'<rect x="2" y="3" width="28" height="26" rx="2"/><path d="M12 11 L7 16 L12 21 M20 11 L25 16 L20 21"/>'
        }
        f.add(f'<g transform="translate({x},{y}) scale({size/32})" fill="none" stroke="{color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">{marks[kind]}</g>')

    def numbered(x,y,n,label,color=accent):
        f.add(f'<circle cx="{x}" cy="{y}" r="16" fill="{color}"/>')
        f.text(x,y+6,str(n),18,"white",True,align="middle")
        f.text(x,y+45,label,21,color,True,align="middle")

    plane(60,140,1040,760,"A","Environment plane")
    f.text(1072,184,"Market Metro",21,MUTED,align="end")
    f.rect(85,235,990,593,"#102541",radius=3)
    f.photo(OUT/"assets/environment-snapshot.png",85,235,990,593)
    chip(87,848,260,"12 merchants")
    chip(362,848,260,"600 simulated shoppers")
    chip(637,848,436,"Actual saved-run snapshot · "+snapshot["displayedDay"])

    plane(1310,140,1030,760,"B","Agent plane")
    f.text(2312,184,"LLM + trusted local tools",21,MUTED,align="end")
    f.rect(1570,250,530,126,"#ffffff","#aeb9c6",radius=8,width=1.5)
    f.logo("gemini",1593,278,53,"#3f5d88")
    f.text(1668,303,"LLM agent",29,ink,True)
    f.text(1668,344,"Choose experiments and campaigns",20,MUTED,max_width=400)
    f.logo("google-cloud",2050,277,29)

    f.add('<rect x="1340" y="440" width="970" height="370" rx="6" fill="#f3f6fa" stroke="#a8b7c6" stroke-width="1.5" stroke-dasharray="7 5"/>')
    f.text(1830,471,"EXPERIMENT SANDBOX",18,MUTED,True,align="middle")
    f.arrow([(1720,376),(1720,440)],accent,2.5)
    f.text(1702,414,"tool calls",18,accent,align="end")
    f.arrow([(1980,440),(1980,376)],accent,2.5)
    f.text(2002,414,"results",18,accent)

    for x in [1370,1685,2000]:
        f.rect(x,505,280,116,"white","#c0cbd6",radius=5,width=1.2)
    glyph("trend",1392,530,39)
    f.text(1452,548,"Analyze",25,ink,True)
    f.text(1452,585,"Observed demand",19,MUTED)
    f.logo("python",1705,530,34);f.logo("scikit-learn",1746,524,49)
    f.text(1810,548,"Train",25,ink,True)
    f.text(1711,585,"Fit local models",19,MUTED)
    glyph("trial",2022,528,40)
    f.text(2081,548,"Evaluate",25,ink,True)
    f.text(2081,585,"Paired policy trials",19,MUTED,max_width=200)
    f.arrow([(1650,563),(1685,563)],edge,1.5)
    f.arrow([(1965,563),(2000,563)],edge,1.5)
    f.arrow([(2140,621),(2140,682)],edge,2)
    f.rect(1390,682,870,76,"#ffffff","#aebbc8",radius=5,width=1.4)
    glyph("gate",1413,704,34,accent)
    f.text(1471,729,"Validate → publish or retain",27,ink,True)
    f.text(2236,729,"trusted code",19,MUTED,align="end")
    f.text(1830,788,"Test candidate policies before changing the live market.",19,MUTED,align="middle")
    f.text(1340,858,"Development trials feed the planner; final benchmarks stay separate.",19,MUTED,max_width=950)

    f.arrow([(1100,330),(1310,330),(1570,330)],accent,3)
    numbered(1205,266,1,"Observe")
    f.arrow([(1390,720),(1310,720),(1100,720)],accent,3)
    numbered(1205,656,2,"Campaign")

    plane(60,1030,1040,330,"C","Data plane")
    f.logo("sqlite",89,1113,40)
    f.text(145,1144,"Warehouse",24,ink,True)
    f.text(145,1175,"AG Studio",18,MUTED)
    tx=340
    for x,title,align in [(tx,"Order","start"),(tx+175,"Merchant","start"),(tx+445,"USD","end")]:
        f.text(x,1128,title,18,MUTED,True,align=align)
    f.line(tx,1144,tx+470,1144,"#ccd5df",1)
    for i,row in enumerate(evidence["orders"]):
        y=1184+i*57
        if i==0:f.rect(tx-10,y-29,490,42,"#e9f1fa",radius=3)
        order=row["order_id"].split("-SIM-CAPTURE-")[1].split("-MERCHANT-")[0]
        merchant=row["shortMerchant"].replace("MERCHANT-","M")
        f.text(tx,y,"#"+order,21,ink,True if i==0 else False)
        f.text(tx+175,y,merchant,21,ink)
        f.text(tx+445,y,"$"+format(row["total_cents"]/100,".2f"),21,accent if i==0 else ink,True if i==0 else False,align="end")
    f.line(850,1110,850,1315,"#d1dae3",1)
    glyph("file",914,1115,45)
    f.text(969,1148,"Artifacts",23,ink,True)
    f.text(900,1200,"Models",21,MUTED)
    f.text(900,1240,"Checkpoints",21,MUTED)
    f.text(900,1280,"Decision logs",21,MUTED)

    f.arrow([(520,900),(520,1030)],edge,2.5)
    f.text(545,975,"orders + outcomes",20,MUTED)
    f.arrow([(1810,900),(1810,959),(960,959),(960,1030)],edge,2.5)
    f.text(1430,947,"models + checkpoints",20,MUTED,align="middle")

    plane(1310,1030,1030,330,"D","PayPal Sandbox plane")
    f.logo("paypal",1342,1125,72)
    glyph("wallet",1471,1127,34)
    f.text(1525,1153,"Saved wallet",23,ink,True)
    f.arrow([(1630,1170),(1630,1204)],accent,2,dashed=True)
    glyph("api",1471,1213,35)
    f.text(1525,1241,"Orders + capture",23,ink,True)
    f.arrow([(1768,1230),(1928,1230)],accent,2.5)
    f.text(1435,1317,"One selected order · fictitious funds",19,MUTED)

    r=evidence["receipt"]
    f.rect(1940,1097,360,231,"white","#b9c5d1",radius=4,width=1.3)
    f.text(1961,1130,"VERIFIED RECEIPT",20,accent,True)
    f.line(1960,1145,2280,1145,"#d6dee6",1)
    for y,label,key in [(1184,"Amount","gross_cents"),(1232,"Fee","fee_cents"),(1280,"Net","net_cents")]:
        f.text(1961,y,label,21,MUTED)
        f.text(2278,y,"$"+format(r[key]/100,".2f"),24,ink,True,align="end")

    f.arrow([(1100,1186),(1310,1186)],accent,2.5,dashed=True)
    f.text(1205,1161,"selected order",18,accent,align="middle")
    f.arrow([(1310,1290),(1100,1290)],edge,2.5)
    f.text(1205,1321,"verified receipt",18,MUTED,align="middle")

    f.text(60,1420,"Actual recorded environment. Vector workflow and logos. Native receipts are linked samples, not extra simulated sales.",20,MUTED,max_width=2110)
    f.text(2340,1420,"4 NOV 2026",18,MUTED,align="end")
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
              "scope":"Actual environment snapshot beside the LLM/tool plane, with a nested experiment sandbox and data/PayPal planes below. Final held-out benchmarks remain outside planner feedback.",
              "newModelCalls":0,"newPayments":0,"snapshot":snapshot_manifest()}
    (OUT/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
    print(json.dumps({"figures":[str(p) for p in svgs],"pdf":str(PDF)}))


if __name__=="__main__":
    main()
