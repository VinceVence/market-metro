"""Current Market Metro architecture. Local drawing only; no provider or model calls."""
from pathlib import Path
from base64 import b64encode
from xml.sax.saxutils import escape
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.graphics import renderSVG, renderPDF
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import pypdfium2 as pdfium
from render_figures import Figure, C, OUT

ROOT = Path(__file__).resolve().parents[1]
for weight, name in [(400, 'DMSans'), (700, 'DMSans-Bold')]:
    pdfmetrics.registerFont(TTFont(name, str(ROOT / f'demo/assets/fonts/dm-sans-{weight}.ttf')))
C.update(ink='#203b4a', muted='#647d8b', line='#ccd8de',
         channel='#277667', channel_fill='#f0f7f3',
         emulator='#3f657b', emulator_fill='#f2f6f8',
         agent='#755891', agent_fill='#f5f2f8',
         paypal='#195c9b', paypal_fill='#eff5fb',
         gap='#a4682c', gap_fill='#fff4e6')


class Planes(Figure):
    def __init__(self):
        self.w, self.h = 1600, 1100
        self.d = Drawing(self.w, self.h)
        self.d.add(Rect(0, 0, self.w, self.h, fillColor=HexColor('#fcfdfb'), strokeColor=None))

    def text(self, x, y, text, size=16, color='ink', bold=False, anchor='start'):
        self.d.add(String(x, self.h-y, text, fontName='DMSans-Bold' if bold else 'DMSans',
                          fontSize=size, fillColor=HexColor(C.get(color, color)), textAnchor=anchor))

    def plane(self, x, y, w, h, title, subtitle, kind, state):
        self.rect(x, y, w, h, kind+'_fill', 'line', radius=12)
        self.rect(x, y, 6, h, kind, None, radius=3)
        self.text(x+28, y+39, title, 25, kind, True)
        self.text(x+w-24, y+37, state, 12, kind, True, 'end')
        self.text(x+28, y+67, subtitle, 15, 'muted')

    def node(self, x, y, w, h, title, body, kind, label=None):
        self.rect(x, y, w, h, 'white', 'line', radius=7)
        title_size=min(19,19*(w-34)/max(1,pdfmetrics.stringWidth(title,'DMSans-Bold',19)))
        self.text(x+17, y+31, title, title_size, kind, True)
        for i, line in enumerate(body):
            self.text(x+17, y+58+i*22, line, 15, 'muted')
        if label:
            self.text(x+17, y+h-13, label, 11, kind, True)


def architecture():
    f=Planes()
    f.text(40, 39, 'MARKET METRO / CURRENT IMPLEMENTATION', 13, 'muted', True)
    f.text(40, 84, 'Four planes. One local commerce experiment.', 35, bold=True)
    f.text(40, 117, 'Cached Channel3 products feed the economy. Selected orders now produce verified, warehouse-linked PayPal Sandbox captures.', 18, 'muted')

    f.plane(40, 160, 700, 260, 'Channel3 plane', 'Product discovery and catalog ingestion', 'channel', 'IMPORTED + CACHED')
    f.node(68, 253, 185, 91, 'Search API', ['External provider', 'Product listings'], 'channel')
    f.node(292, 253, 200, 91, 'Catalog adapter', ['Local server', 'Normalize USD items'], 'channel')
    f.node(531, 253, 185, 91, 'Catalog cache', ['22 real products', 'Local JSON snapshot'], 'channel')
    f.line([(253, 298), (292, 298)], 'channel', 1.7, dash=True, arrow=True)
    f.line([(292, 298), (253, 298)], 'channel', 1.7, dash=True, arrow=True)
    f.line([(492, 298), (531, 298)], 'channel', 1.7, arrow=True)
    f.text(68, 380, 'Imported 21 Oct 2026. New seasons reuse the cache; no catalog calls.', 15, 'channel')
    f.text(68, 404, 'Fresh sync is currently off. No customer histories or warehouse from Channel3.', 14, 'muted')

    f.plane(840, 160, 700, 260, 'PayPal plane', 'Saved test wallet and bounded native captures for selected emulator orders', 'paypal', 'WALLET CONNECTED')
    f.node(868, 253, 185, 91, 'Saved test buyer', ['One-time consent', 'Private wallet token'], 'paypal')
    f.node(1092, 253, 200, 91, 'Sample adapter', ['Exact order + stable IDs', 'Capture and verify'], 'paypal')
    f.node(1331, 253, 185, 91, 'Sandbox API', ['External provider', 'Native capture records'], 'paypal')
    f.line([(1053, 298), (1092, 298)], 'paypal', 1.7, arrow=True)
    f.line([(1292, 298), (1331, 298)], 'paypal', 1.7, dash=True, arrow=True)
    f.line([(1331, 298), (1292, 298)], 'paypal', 1.7, dash=True, arrow=True)
    f.text(868, 380, 'Main season: 3 captures / $192.59 gross / $7.45 fees / $185.14 net.', 15, 'paypal')
    f.text(868, 404, 'Same wallet reused after restart and in another season. Sandbox test funds only.', 14, 'muted')

    f.rect(840, 447, 700, 52, 'paypal_fill', 'line', radius=6)
    f.text(858, 468, 'BRIDGE ACTIVE: SELECTED ORDER → CAPTURE → WAREHOUSE', 13, 'paypal', True)
    f.text(858, 488, 'At most 3 orders / $1,000 test funds per season; no repeated buyer checkout.', 14, 'paypal')

    f.plane(40, 525, 700, 465, 'Emulator plane', 'Seeded, synthetic economy; displayed by the 3D city', 'emulator', 'LOCAL + SIMULATED')
    f.node(440, 621, 270, 120, 'Economy engine', ['Customers, shops, inventory', 'Seed + scenario + daily behavior', 'Applies eligible coupons'], 'emulator')
    f.node(70, 621, 295, 120, 'Commerce events', ['Visits, orders, deliveries, returns', 'Transactions and modeled fees', 'Current field test: 423 purchases'], 'emulator')
    f.line([(440, 682), (365, 682)], 'emulator', 2, arrow=True)
    f.text(403, 669, 'events', 12, 'muted', anchor='middle')
    f.line([(217, 741), (217, 821)], 'emulator', 2, arrow=True)
    f.text(233, 785, 'persist', 13, 'muted')
    f.node(70, 821, 640, 122, 'Local SQLite warehouse',
           ['24 base tables + 11 views; includes native payment lineage',
            'orders · transactions · paypal_receipts · model_runs · team_decisions',
            'The 3D UI and inspectors read these saved frames and results.'], 'emulator')
    f.text(70, 972, 'Private simulator traits stay out of training features and public exports.', 14, 'muted')

    # Catalog content enters the economy; the native payment bridge samples its orders.
    f.line([(716, 298), (768, 298), (768, 649), (710, 649)], 'channel', 2.1, arrow=True)
    f.text(776, 444, 'catalog', 12, 'channel')
    f.text(776, 462, 'snapshot', 12, 'channel')

    f.plane(840, 525, 700, 465, 'Agent plane', 'Six scripted responsibilities; real local CPU model training', 'agent', 'NO LLM')
    f.node(870, 621, 270, 120, 'Campaign manager', ['Scores 0% / 5% / 10% offers', 'Budget, stock, contact, margin', 'Tracks issued / seen / redeemed'], 'agent')
    f.node(1210, 621, 300, 120, 'Business lead + coordinator', ['Chosen objective and budget', 'Trigger review; promote or keep', 'Retain the existing policy on failure'], 'agent')
    f.node(870, 821, 270, 122, 'Data engineer', ['Reads completed-day features', 'Enforces cutoff and holdout', 'No hidden customer traits'], 'agent')
    f.node(1210, 821, 300, 122, 'Scientist + experiment analyst', ['Fit logistic regression and a tree', 'Validate later-day performance', 'Measure holdout lift + uncertainty'], 'agent')
    f.line([(710, 880), (870, 880)], 'emulator', 2, arrow=True)
    f.text(790, 863, 'observed rows', 13, 'muted', anchor='middle')
    f.line([(1140, 880), (1210, 880)], 'agent', 2, arrow=True)
    f.text(1175, 865, 'features', 11, 'muted', anchor='middle')
    f.line([(1360, 821), (1360, 741)], 'agent', 2, arrow=True)
    f.text(1376, 785, 'evidence', 13, 'muted')
    f.line([(1210, 681), (1140, 681)], 'agent', 2, arrow=True)
    f.text(1175, 666, 'policy', 11, 'muted', anchor='middle')
    f.line([(870, 698), (710, 698)], 'agent', 2.2, arrow=True)
    f.text(790, 724, 'coupon actions', 13, 'agent', anchor='middle')
    f.text(870, 972, 'Artifacts, scores, decisions and experiment outcomes are saved back to SQLite.', 14, 'muted')

    f.line([(70, 682), (20, 682), (20, 475), (840, 475)], 'paypal', 1.7, arrow=True)
    f.text(210, 461, 'selected orders', 13, 'paypal')
    f.line([(1190, 447), (1190, 420)], 'paypal', 1.7, arrow=True)
    f.line([(1192, 344), (1192, 356), (1568, 356), (1568, 1008), (710, 1008), (710, 943)], 'paypal', 1.7, arrow=True)
    f.text(1135, 1002, 'adapter verifies and stores native receipts', 12, 'paypal', anchor='middle')

    f.line([(40, 1023), (96, 1023)], 'emulator', 2, arrow=True)
    f.text(109, 1028, 'Runs locally each season', 14, 'muted')
    f.line([(415, 1023), (471, 1023)], 'channel', 2, dash=True, arrow=True)
    f.text(484, 1028, 'External provider request / response; sandbox calls are bounded', 14, 'muted')
    f.text(40, 1064, 'Logical responsibilities, not four deployed services: one local Node server, SQLite, a Python worker, and two external providers.', 15, 'muted')
    f.text(40, 1088, 'Checked against code and local records on 22 Oct 2026. 4 native captures verified across 2 seasons. Our prototype, not PayPal or Channel3 internal architecture.', 13, 'muted')

    name='market-system-planes'
    svg=OUT/(name+'.svg');png=OUT/(name+'.png')
    renderSVG.drawToFile(f.d,str(svg))
    source=svg.read_text()
    font_css=''.join('@font-face{font-family:"'+font+'";src:url(data:font/ttf;base64,'+b64encode((ROOT/f'demo/assets/fonts/dm-sans-{weight}.ttf').read_bytes()).decode()+') format("truetype");}' for weight,font in [(400,'DMSans'),(700,'DMSans-Bold')])
    pos=source.index('>',source.index('<svg'))+1
    metadata='<title>Market Metro: emulator, PayPal, Channel3 and agent planes</title><desc>'+escape('Current implementation. Channel3 real catalog cache feeds a synthetic economy. Scripted local roles train models and apply offers. Selected emulator orders produce verified native PayPal Sandbox captures using a reusable test wallet.')+'</desc><style>'+font_css+'</style>'
    svg.write_text(source[:pos]+metadata+source[pos:])
    document=pdfium.PdfDocument(renderPDF.drawToString(f.d));page=document[0];bitmap=page.render(scale=1.5)
    bitmap.to_pil().save(png);bitmap.close();page.close();document.close()
    print(svg);print(png)


if __name__=='__main__':
    architecture()
