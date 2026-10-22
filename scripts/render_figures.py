"""Render the architecture figures as editable SVG, vector PDF, and 2x PNG.

Dependencies: reportlab and pypdfium2 (available in the desktop bundled Python).
No data or model call is performed. Every quantitative mark is an authored input.
"""
from pathlib import Path
from math import atan2, cos, sin
from reportlab.graphics.shapes import Drawing, Rect, Line, String, Polygon, PolyLine
from reportlab.graphics import renderSVG, renderPDF
from reportlab.lib.colors import HexColor, Color
import pypdfium2 as pdfium

OUT = Path(__file__).resolve().parents[1] / 'docs' / 'figures'
OUT.mkdir(parents=True, exist_ok=True)
C = {
    'ink': '#172b42', 'muted': '#576779', 'line': '#cbd6df', 'code': '#566578',
    'agent': '#086f68', 'agent_fill': '#eaf6f2', 'code_fill': '#f4f6f9',
    'human': '#91500b', 'human_fill': '#fff5e7', 'paypal': '#003087',
    'paypal_fill': '#edf2fa', 'red': '#a6333c', 'white': '#ffffff'
}


class Figure:
    def __init__(self, width, height, title, subtitle):
        self.w, self.h = width, height
        self.d = Drawing(width, height)
        self.d.add(Rect(0, 0, width, height, fillColor=HexColor(C['white']), strokeColor=None))
        self.text(38, 36, 'AFTERSHOCK / SYSTEMS RESEARCH', 10, 'muted', bold=True)
        self.text(38, 71, title, 26, bold=True)
        self.text(38, 97, subtitle, 12, 'muted')
        self.line([(38, 117), (width - 38, 117)], 'line', 1)

    def text(self, x, y, text, size=12, color='ink', bold=False, anchor='start'):
        self.d.add(String(x, self.h - y, text, fontName='Helvetica-Bold' if bold else 'Helvetica',
                          fontSize=size, fillColor=HexColor(C.get(color, color)), textAnchor=anchor))

    def rect(self, x, y, w, h, fill='white', stroke='line', dash=False, radius=6, width=1):
        self.d.add(Rect(x, self.h - y - h, w, h, rx=radius, ry=radius,
                        fillColor=HexColor(C.get(fill, fill)), strokeColor=HexColor(C.get(stroke, stroke)) if stroke else None,
                        strokeWidth=width, strokeDashArray=[5, 4] if dash else None))

    def line(self, points, color='code', width=1.4, dash=False, arrow=False):
        self.d.add(PolyLine([v for x, y in points for v in (x, self.h - y)],
                           strokeColor=HexColor(C.get(color, color)), strokeWidth=width,
                           strokeDashArray=[5, 4] if dash else None, fillColor=None))
        if arrow:
            x, y = points[-1]; px, py = points[-2]
            a = atan2(y - py, x - px); length, spread = 8, 0.48
            verts = [(x, y), (x - length * cos(a - spread), y - length * sin(a - spread)),
                     (x - length * cos(a + spread), y - length * sin(a + spread))]
            self.d.add(Polygon([v for xx, yy in verts for v in (xx, self.h - yy)],
                               fillColor=HexColor(C.get(color, color)), strokeColor=None))

    def box(self, x, y, w, h, title, lines, kind='code', dash=False, small=None):
        self.rect(x, y, w, h, f'{kind}_fill', kind, dash)
        self.rect(x + 13, y + 15, 4, h - 30, kind, None, radius=2)
        self.text(x + 28, y + 28, title, 14, bold=True)
        for i, line in enumerate(lines):
            self.text(x + 28, y + 51 + i * 18, line, 11.5, 'muted')
        if small: self.text(x + 28, y + h - 15, small, 9.5, kind, bold=True)

    def footer(self, text, y=None):
        y = y or self.h - 40
        self.line([(38, y - 20), (self.w - 38, y - 20)], 'line', 1)
        self.text(38, y, text, 10, 'muted')
        self.text(38, y + 16, 'Research basis: completed Aftershock report, 19 October 2026. Not an official PayPal design.', 9, 'muted')

    def save(self, name, description):
        svg = OUT / f'{name}.svg'; pdf = OUT / f'{name}.pdf'; png = OUT / f'{name}.png'
        renderSVG.drawToFile(self.d, str(svg))
        source = svg.read_text()
        pos = source.index('>', source.index('<svg')) + 1
        source = source[:pos] + f'<title>{description}</title><desc>Authored proposed architecture or illustrative scenario. See the companion system design for scope and limitations.</desc>' + source[pos:]
        svg.write_text(source)
        renderPDF.drawToFile(self.d, str(pdf))
        document = pdfium.PdfDocument(str(pdf))
        page = document[0]; bitmap = page.render(scale=2)
        bitmap.to_pil().save(png)
        bitmap.close(); page.close(); document.close()
        print(name)


def architecture():
    f = Figure(1400, 1050, '1. Decision support with explicit authority boundaries',
               'Proposed target architecture. The current prototype implements local mechanics and scripted role traces.')
    f.box(40, 165, 330, 120, 'Simulated commerce environment',
          ['Customers, merchants, suppliers', 'Cash, inventory, quotes, promises', 'A supply shock changes feasible actions'])
    f.box(490, 165, 400, 120, 'Versioned observation journal',
          ['Cash statement, order states, quote terms', 'Evidence timestamps and reservation owner', 'Only permitted observations reach agents'])
    f.box(1020, 165, 340, 120, 'Evaluator-only state',
          ['Hidden outcomes and injected causes', 'Held-out scenarios and liability horizon', 'Never exposed as agent evidence'])
    f.line([(370, 224), (490, 224)], arrow=True)
    f.text(425, 210, 'events', 10, 'muted', anchor='middle')
    f.line([(890, 224), (1020, 224)], arrow=True, dash=True)
    f.text(955, 210, 'evaluation log', 10, 'muted', anchor='middle')

    f.rect(40, 340, 850, 220, 'white', 'agent', dash=True)
    f.text(62, 369, 'ECONOMIC INVESTIGATION TEAM', 11, 'agent', bold=True)
    f.text(62, 390, 'Scripted today. Proposed model roles choose questions, tools, experiments and abstentions.', 11, 'muted')
    f.box(62, 410, 250, 125, 'Evidence investigator', ['Resolve conflicting terms', 'Request missing obligations', 'Cite observed records'], 'agent')
    f.box(337, 410, 250, 125, 'Experimental economist', ['Select matched interventions', 'Separate cash from capacity', 'Interpret adverse branches'], 'agent')
    f.box(612, 410, 255, 125, 'Challenging reviewer', ['Search for counterexamples', 'Check displaced merchants', 'Recommend or abstain'], 'agent')
    f.line([(690, 285), (690, 340)], 'agent', arrow=True)
    f.text(705, 318, 'read-only evidence', 10, 'agent')
    f.box(1020, 365, 340, 175, 'Deterministic experiment runner',
          ['Clone the same initial world', 'Enforce money and stock conservation', 'Run keep / release / adverse branches', 'Return outcomes and open liabilities'], small='NO LLM ARITHMETIC OR AUTHORITY')
    f.line([(890, 420), (1020, 420)], 'agent', arrow=True)
    f.text(955, 407, 'bounded test plan', 10, 'agent', anchor='middle')
    f.line([(1020, 490), (890, 490)], arrow=True)
    f.text(955, 477, 'branch results', 10, 'muted', anchor='middle')

    f.box(40, 650, 330, 120, 'Human reserve reviewer',
          ['Read evidence, uncertainty and alternatives', 'Approve a capped change or retain reserve', 'Reviewer role is simulated in this build'], 'human')
    f.box(490, 650, 400, 120, 'Deterministic execution gate',
          ['Check reviewer, amount, policy and evidence version', 'Recheck current stock and payment eligibility', 'Reject changed evidence or reused authority'])
    f.box(1020, 650, 340, 120, 'Minimum-reserve simulator',
          ['Reclassify existing merchant-owned funds', 'Reserve decreases; available cash increases', 'No public reserve-override API identified'])
    f.line([(190, 560), (190, 650)], 'agent', arrow=True)
    f.text(205, 610, 'decision dossier', 10, 'agent')
    f.line([(370, 710), (490, 710)], 'human', arrow=True)
    f.text(430, 697, 'scoped approval', 10, 'human', anchor='middle')
    f.line([(890, 710), (1020, 710)], arrow=True)
    f.text(955, 695, 'local reserve action', 10, 'muted', anchor='middle')

    f.box(490, 840, 400, 115, 'Server-side PayPal adapter',
          ['Allowlisted operations, scoped IDs and amounts', 'Persist request identity and actual provider results'], 'paypal', dash=True, small='PROPOSED / LOCAL PAYMENT STUB TODAY')
    f.box(1020, 840, 340, 115, 'PayPal Sandbox',
          ['Approve / authorize / capture / void / refund', 'Authoritative payment response + reconciliation'], 'paypal', dash=True, small='PROPOSED / NO NATIVE CALLS IN THIS BUILD')
    f.line([(690, 770), (690, 840)], 'paypal', arrow=True)
    f.text(706, 808, 'eligible payment intent', 10, 'paypal')
    f.line([(890, 880), (1020, 880)], 'paypal', arrow=True, dash=True)
    f.text(955, 866, 'API request', 10, 'paypal', anchor='middle')
    f.line([(1020, 925), (890, 925)], 'paypal', arrow=True, dash=True)
    f.text(955, 914, 'actual status', 10, 'paypal', anchor='middle')
    f.text(40, 845, 'GOVERNANCE KEY', 10, 'muted', bold=True)
    for i, (kind, text) in enumerate([('agent', 'Agent: proposes and investigates'), ('human', 'Human: authorizes reserve decisions'), ('code', 'Code: validates and mutates local state'), ('paypal', 'PayPal: owns native payment states')]):
        f.rect(40, 865 + i * 22, 9, 9, kind, None, radius=1)
        f.text(59, 874 + i * 22, text, 10, 'muted')
    f.footer('Provider responses and local ledger events return to the observation journal. Client-side demo checks are not production access controls.')
    f.save('01-system-architecture', 'Aftershock system architecture and authority boundaries')


def sequence():
    f = Figure(1400, 1100, '2. From a supplier failure to a reviewed payment consequence',
               'Expected interactions. Agent reasoning is scripted locally; blue provider messages describe the future Sandbox integration.')
    xs = [110, 345, 580, 815, 1050, 1285]
    titles = [('Economy', 'code'), ('Agent team', 'agent'), ('Experiment runner', 'code'), ('Human reviewer', 'human'), ('Execution gate', 'code'), ('PayPal Sandbox', 'paypal')]
    for x, (title, kind) in zip(xs, titles):
        f.rect(x - 93, 145, 186, 48, f'{kind}_fill', kind, dash=kind == 'paypal')
        f.text(x, 175, title, 13, kind, bold=True, anchor='middle')
        f.line([(x, 193), (x, 985)], 'line', 1, dash=True)
    steps = [
        (0, 1, 235, '1  Publish disruption and permitted observations', 'code'),
        (1, 0, 290, '2  Request quote, stock, promises and prior obligations', 'agent'),
        (0, 1, 345, '3  Return current evidence or explicit missing fields', 'code'),
        (1, 2, 410, '4  Choose matched keep / release / failure experiments', 'agent'),
        (2, 1, 465, '5  Return conditional outcomes and open liabilities', 'code'),
        (1, 3, 535, '6  Submit recommendation, counterexamples and uncertainty', 'agent'),
        (3, 4, 600, '7  Approve a scoped change or keep reserve', 'human'),
        (4, 0, 665, '8  Recheck evidence version, stock, amounts and eligibility', 'code'),
        (0, 4, 720, '9  Fresh state or rejection: changed evidence stops execution', 'code'),
        (4, 0, 790, '10  Apply approved reserve change in the local simulator', 'code'),
        (4, 5, 865, '11  Submit eligible payment operation', 'paypal'),
        (5, 4, 925, '12  Return actual status; reconcile pending / unknown outcomes', 'paypal'),
        (4, 0, 980, '13  Record provider state separately from logistics and cash availability', 'code')
    ]
    for start, end, y, label, kind in steps:
        left, right = min(xs[start], xs[end]), max(xs[start], xs[end])
        # Long descriptions use the full lane space above the arrow without shrinking type.
        text_x = left + 10
        if right - left < 300: text_x = max(40, min(left - 90, 900))
        f.text(text_x, y - 12, label, 11, kind)
        f.line([(xs[start], y), (xs[end], y)], kind, 1.5, dash=kind == 'paypal', arrow=True)
    f.footer('Approval never guarantees stock or delivery. Capture is not settlement; pending is not completion; captured cancellations require refunds.', y=1052)
    f.save('02-decision-sequence', 'Aftershock expected agent and PayPal interaction sequence')


def feedback():
    f = Figure(1400, 830, '3. The hypothesis: reserve policy can change the risk it covers',
               'A causal proposal to test, not an established effect. Agents investigate mechanisms; the evaluator measures outcomes.')
    f.box(40, 330, 250, 125, 'Reserve intervention', ['Keep reserve or release $60', 'Human-reviewed local action', 'Matched starting worlds'], 'human')
    f.box(390, 190, 260, 115, 'Available operating cash', ['Release adds $60 to available cash', 'Can finance the $160 supplier lot'])
    f.box(770, 190, 260, 115, 'Feasible order recovery', ['Only if stock, terms and timing fit', 'Merchant chooses the replacement'], 'agent')
    f.box(390, 490, 260, 115, 'Retained protection', ['Release reduces reserve by $60', 'Less money remains as protection'])
    f.box(770, 490, 260, 115, 'Exposure if recovery fails', ['Prior obligations remain', 'Supplier spend may be unrecoverable'])
    f.box(1120, 330, 240, 125, 'Provider outcome', ['Unrecovered loss', 'Payment contribution', 'Review effort'], 'paypal')
    f.line([(290, 370), (335, 370), (335, 247), (390, 247)], 'human', arrow=True)
    f.text(335, 232, '+ cash', 10, 'human', anchor='middle')
    f.line([(650, 247), (770, 247)], 'agent', arrow=True)
    f.text(710, 233, 'conditional effect', 10, 'agent', anchor='middle')
    f.line([(1030, 247), (1080, 247), (1080, 365), (1120, 365)], 'agent', arrow=True)
    f.line([(290, 410), (335, 410), (335, 547), (390, 547)], 'human', arrow=True)
    f.text(335, 578, '- protection', 10, 'human', anchor='middle')
    f.line([(650, 547), (770, 547)], arrow=True)
    f.text(710, 533, 'coverage changes', 10, 'muted', anchor='middle')
    f.line([(1030, 547), (1080, 547), (1080, 420), (1120, 420)], arrow=True)
    f.line([(900, 305), (900, 490)], 'agent', arrow=True, dash=True)
    f.text(913, 373, 'Fulfillment can change', 11, 'muted')
    f.text(913, 391, 'later refund exposure.', 11, 'muted')
    f.text(913, 415, 'Direction and magnitude', 11, 'muted')
    f.text(913, 433, 'must be tested.', 11, 'muted')
    f.rect(400, 345, 370, 95, 'agent_fill', 'agent', dash=True)
    f.text(420, 373, 'WHERE THE AGENT ADDS REASONING', 11, 'agent', bold=True)
    f.text(420, 397, 'Is the constraint cash, capacity, timing, or evidence?', 11, 'muted')
    f.text(420, 416, 'Which additional test could overturn the recommendation?', 11, 'muted')
    f.line([(1240, 455), (1240, 685), (165, 685), (165, 455)], 'paypal', arrow=True, dash=True)
    f.text(700, 671, 'New observations inform the next review; spent funds cannot be restored by resetting the reserve.', 11, 'paypal', anchor='middle')
    f.text(40, 736, 'Controls: same demand, supply capacity, customer promise and information budget. Track effects on other merchants and unresolved liabilities.', 11, 'muted')
    f.footer('A reserve release is a balance reclassification. Merchant sales are not PayPal revenue; neither metric establishes provider savings.')
    f.save('03-economic-feedback', 'Economic feedback hypothesis for merchant reserve decisions')


def tradeoff():
    f = Figure(1300, 710, '4. The base case: affordability improves, retained protection falls',
               'Authored scenario arithmetic, in USD. These are conditional inputs and outcomes, not measured business results.')
    for x, title, vals, target, target_text, unit in [
        (70, 'A / Cash available before purchase', [100, 160], 160, '$160 minimum batch price', 'Available cash (USD)'),
        (730, 'B / Minimum reserve after decision', [200, 140], 140, '$120 upper exposure + $20 cushion', 'Reserve funds (USD)')
    ]:
        f.text(x, 160, title, 16, bold=True)
        ybase, top, height = 470, 210, 260
        f.line([(x + 60, top), (x + 60, ybase), (x + 490, ybase)], 'line', 1)
        for tick in [0, 50, 100, 150, 200]:
            y = ybase - tick / 220 * height
            f.line([(x + 60, y), (x + 490, y)], 'line', .6)
            f.text(x + 48, y + 4, str(tick), 10, 'muted', anchor='end')
        for j, value in enumerate(vals):
            xx = x + 130 + j * 210; hh = value / 220 * height
            f.rect(xx, ybase - hh, 105, hh, 'code' if j == 0 else 'agent', None, radius=0)
            f.text(xx + 52.5, ybase - hh - 12, f'${value}', 17, bold=True, anchor='middle')
            f.text(xx + 52.5, ybase + 26, 'Keep reserve' if j == 0 else 'Release $60', 12, anchor='middle')
        yy = ybase - target / 220 * height
        f.line([(x + 60, yy), (x + 490, yy)], 'human', 1.7, dash=True)
        f.text(x + 60, 540, target_text, 12, 'human', bold=True)
        f.text(x + 60, 562, unit, 11, 'muted')
    f.line([(650, 145), (650, 575)], 'line', 1)
    f.text(70, 607, 'Conditional recovery: 0 / 4 orders when cash stays at $100; 4 / 4 if the $160 purchase is feasible and the replacement delivers on time.', 12, 'ink')
    f.text(70, 630, 'Adverse case: if the replacement fails before capture, recovery is 0 / 4. Releasing cash does not create stock or guarantee fulfillment.', 11, 'muted')
    f.footer('The policy floor is authored for this demo. Unknown obligations require abstention. The retained reserve is not a calibrated measure of PayPal loss.', y=669)
    f.save('04-scenario-tradeoff', 'Illustrative available cash and retained reserve comparison')


if __name__ == '__main__':
    architecture(); sequence(); feedback(); tradeoff()
