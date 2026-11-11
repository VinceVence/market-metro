#!/usr/bin/env python3
"""Build the submission PDF from the adjacent, reviewable Markdown guide.

Uses ReportLab and Pillow. Run from any directory; no application/provider calls.
"""
from pathlib import Path
import html
import re

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Flowable, Frame, NextPageTemplate,
    PageBreak, PageTemplate, Paragraph, Preformatted, Spacer, Table, TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output/pdf/market-metro-technical-guide.pdf'
ASSETS = ROOT / 'submission-media/gallery'
SNAPSHOT = 'eb93bac5763d690e884821f19e5fe4278088aead'
REPO = f'https://github.com/VinceVence/market-metro/blob/{SNAPSHOT}/'
LIVE = 'https://market-metro-fifm2aalgq-uc.a.run.app'
INK = colors.HexColor('#142a43')
BLUE = colors.HexColor('#006bdc')
MUTED = colors.HexColor('#58677a')
LINE = colors.HexColor('#d8dfe6')
PALE = colors.HexColor('#f4f7fa')

for name, weight in [('DM', '400'), ('DM-Semi', '600'), ('DM-Bold', '700')]:
    pdfmetrics.registerFont(TTFont(name, str(ROOT / f'demo/assets/fonts/dm-sans-{weight}.ttf')))
pdfmetrics.registerFontFamily('DM', normal='DM', bold='DM-Bold', italic='DM', boldItalic='DM-Bold')

ST = {
    'body': ParagraphStyle('body', fontName='DM', fontSize=10.2, leading=14.6, textColor=INK, spaceAfter=8),
    'title': ParagraphStyle('title', fontName='DM-Bold', fontSize=24, leading=29, textColor=INK, spaceAfter=15),
    'h2': ParagraphStyle('h2', fontName='DM-Bold', fontSize=12.5, leading=17, textColor=INK, spaceBefore=10, spaceAfter=7, keepWithNext=True),
    'eyebrow': ParagraphStyle('eyebrow', fontName='DM-Semi', fontSize=8.5, leading=12, textColor=BLUE, spaceAfter=8),
    'small': ParagraphStyle('small', fontName='DM', fontSize=8.1, leading=11.3, textColor=MUTED, spaceBefore=5, spaceAfter=7),
    'cell': ParagraphStyle('cell', fontName='DM', fontSize=9.1, leading=12.4, textColor=INK),
    'th': ParagraphStyle('th', fontName='DM-Semi', fontSize=9, leading=12.2, textColor=INK),
    'bullet': ParagraphStyle('bullet', fontName='DM', fontSize=10.2, leading=14.6, textColor=INK, leftIndent=13, firstLineIndent=-10, spaceAfter=6),
    'callout': ParagraphStyle('callout', fontName='DM', fontSize=10, leading=14, textColor=INK),
    'code': ParagraphStyle('code', fontName='DM', fontSize=8.8, leading=12, textColor=INK, leftIndent=0),
}


def inline(text):
    """The guide uses only links, bold and inline code, not arbitrary HTML."""
    held = []

    def hold(value):
        held.append(value)
        return f'ZZTOKEN{len(held)-1}ZZ'

    def link(match):
        label, url = match.groups()
        if url.startswith('repo:'):
            rel = url[5:]
            assert (ROOT / rel).exists(), f'Missing evidence: {rel}'
            url = REPO + rel
        return hold(f'<link href="{html.escape(url, quote=True)}" color="#006bdc">{html.escape(label)}</link>')

    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', link, text)
    text = re.sub(r'`([^`]+)`', lambda m: hold(f'<font name="DM-Semi" size="9">{html.escape(m[1])}</font>'), text)
    text = html.escape(text)
    text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
    for i, value in enumerate(held):
        text = text.replace(f'ZZTOKEN{i}ZZ', value)
    return text


def para(text, style='body'):
    return Paragraph(inline(text), ST[style])


class Figure(Flowable):
    """Place an approved gallery region through a PDF clipping path.

    The source image is unchanged. Technical diagrams retain their approved
    black-and-white lines, with color reserved for logos and actual app footage.
    """
    def __init__(self, name, box, width, max_height):
        super().__init__()
        self.path = ASSETS / 'upload' / name
        self.box = box
        x0, y0, x1, y1 = box
        self.scale = min(width / (x1-x0), max_height / (y1-y0))
        self.view_width = (x1-x0)*self.scale
        self.width = width
        self.height = (y1-y0)*self.scale

    def draw(self):
        c = self.canv
        x0, y0, x1, y1 = self.box
        with PILImage.open(self.path) as img:
            iw, ih = img.size
        dx = (self.width-self.view_width)/2
        c.saveState()
        p = c.beginPath()
        p.rect(dx, 0, self.view_width, self.height)
        c.clipPath(p, stroke=0, fill=0)
        c.drawImage(str(self.path), dx-x0*self.scale, -(ih-y1)*self.scale,
                    width=iw*self.scale, height=ih*self.scale)
        c.restoreState()


def draw_mark(c, x, y, size=46):
    c.saveState()
    c.translate(x, y)
    c.scale(size/96, size/96)
    c.setFillColor(colors.HexColor('#0b2a4a'))
    c.roundRect(0, 0, 96, 96, 25, fill=1, stroke=0)
    c.setStrokeColor(colors.HexColor('#65d8d5'))
    c.setLineWidth(12)
    c.setLineCap(1)
    c.setLineJoin(1)
    p = c.beginPath()
    p.moveTo(22,24); p.lineTo(22,67); p.lineTo(48,41); p.lineTo(74,67); p.lineTo(74,24)
    c.drawPath(p)
    c.setStrokeColor(colors.HexColor('#1788f1'))
    c.line(22,24,22,43); c.line(74,24,74,43)
    c.setFillColor(colors.HexColor('#fff7e7')); c.circle(48,41,8,fill=1,stroke=0); c.circle(22,67,5,fill=1,stroke=0)
    c.setFillColor(colors.HexColor('#ffbd64')); c.circle(74,67,8,fill=1,stroke=0)
    c.restoreState()


class Cover(Flowable):
    def __init__(self):
        super().__init__()
        self.width, self.height = A4[0]-92, 710

    def draw(self):
        c, w = self.canv, self.width
        draw_mark(c,0,649,50)
        c.setFont('DM-Semi',9); c.setFillColor(MUTED)
        c.drawString(67,682,'PAYPAL AI HACKATHON 2026')
        c.drawString(67,665,'TECHNICAL SUBMISSION GUIDE')
        c.setFillColor(INK); c.setFont('DM-Bold',46)
        c.drawString(0,591,'Market Metro')
        c.setFont('DM',23); c.drawString(0,554,'Agentic Commerce That Learns')
        p = para('From shopper behavior to a tested campaign,\nwith ontology verification and PayPal payment evidence.')
        p.wrap(w-20,70); p.drawOn(c,0,497)
        # Actual environment image; no fabricated screenshot or generated chart.
        image = ASSETS/'assets/hires/environment.jpg'
        c.drawImage(str(image), -14,164,width=w+28,height=326,preserveAspectRatio=True,anchor='c')
        c.setStrokeColor(LINE); c.line(0,153,w,153)
        for x, val, label in [(0,'Observe','Market + warehouse'),(178,'Decide','Planner + verifier'),(356,'Trace','PayPal + Studio')]:
            c.setFillColor(INK); c.setFont('DM-Bold',15); c.drawString(x,123,val)
            c.setFillColor(MUTED); c.setFont('DM',9); c.drawString(x,104,label)
        c.setFillColor(INK); c.setFont('DM-Semi',10); c.drawString(0,57,'Lanz Vincent Vencer')
        c.setFillColor(MUTED); c.setFont('DM',9); c.drawString(0,39,'12 November 2026  /  Submission edition 1.0')
        c.setFillColor(BLUE); c.drawString(0,11,'Open the demo'); c.linkURL(LIVE+'/landing.html',(0,8,95,24))
        c.drawString(126,11,'Browse the public source'); c.linkURL('https://github.com/VinceVence/market-metro',(126,8,258,24))


def table(lines, width):
    rows = [[x.strip() for x in line.strip().strip('|').split('|')] for line in lines]
    rows = [r for r in rows if not all(re.fullmatch(r'[:\- ]+', x) for x in r)]
    n = len(rows[0])
    assert all(len(r)==n for r in rows), 'Malformed table'
    fractions = {2:[.30,.70],3:[.25,.35,.40],4:[.35,.22,.22,.21],5:[.38,.13,.13,.20,.16]}.get(n,[1/n]*n)
    # A numerical table needs less first-column dominance when headers are long.
    if n==3 and any('PayPal' in x for x in rows[0]): fractions=[.38,.31,.31]
    if n==4 and 'Merchant contribution' in rows[0]: fractions=[.35,.22,.27,.16]
    if n==4 and 'PayPal gain / 100 shoppers' in rows[0]: fractions=[.18,.31,.22,.29]
    data = [[para(cell,'th' if i==0 else 'cell') for cell in row] for i,row in enumerate(rows)]
    t = Table(data,colWidths=[width*f for f in fractions],hAlign='LEFT',repeatRows=1)
    t.setStyle(TableStyle([
        ('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),
        ('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),
        ('BACKGROUND',(0,0),(-1,0),PALE),('LINEBELOW',(0,0),(-1,0),.8,INK),
        ('LINEBELOW',(0,1),(-1,-1),.4,LINE),
    ]))
    return [t,Spacer(1,10)]


def blocks(markdown, width):
    lines=markdown.splitlines(); result=[]; i=0
    while i<len(lines):
        line=lines[i].strip()
        if not line:
            i+=1; continue
        if line.startswith('## '):
            result.append(para(line[3:],'h2')); i+=1
        elif line.startswith('@figure '):
            name,box,height=[v.strip() for v in line[8:].split('|')]
            result += [Spacer(1,3),Figure(name,tuple(map(int,box.split(','))),width,float(height)),Spacer(1,10)]
            i+=1
        elif line.startswith('```'):
            code=[]; i+=1
            while i<len(lines) and not lines[i].startswith('```'):
                code.append(lines[i]); i+=1
            i+=1
            p=Preformatted('\n'.join(code),ST['code'])
            box=Table([[p]],colWidths=[width],style=[('BACKGROUND',(0,0),(-1,-1),PALE),('BOX',(0,0),(-1,-1),.4,LINE),('LEFTPADDING',(0,0),(-1,-1),12),('RIGHTPADDING',(0,0),(-1,-1),12),('TOPPADDING',(0,0),(-1,-1),11),('BOTTOMPADDING',(0,0),(-1,-1),11)])
            result += [box,Spacer(1,10)]
        elif line.startswith('|'):
            group=[]
            while i<len(lines) and lines[i].strip().startswith('|'):
                group.append(lines[i]); i+=1
            result += table(group,width)
        elif line.startswith('> '):
            p=para(line[2:],'callout')
            box=Table([[p]],colWidths=[width],style=[('BACKGROUND',(0,0),(-1,-1),PALE),('LINEBEFORE',(0,0),(0,0),2,BLUE),('LEFTPADDING',(0,0),(-1,-1),12),('RIGHTPADDING',(0,0),(-1,-1),12),('TOPPADDING',(0,0),(-1,-1),11),('BOTTOMPADDING',(0,0),(-1,-1),11)])
            result += [box,Spacer(1,10)]; i+=1
        elif line.startswith('- ') or re.match(r'^\d+\. ',line):
            result.append(para(('• '+line[2:]) if line.startswith('- ') else line,'bullet')); i+=1
        else:
            group=[line]; i+=1
            while i<len(lines) and lines[i].strip() and not re.match(r'^(## |@figure|\||>|```|- |\d+\. )',lines[i]):
                group.append(lines[i].strip()); i+=1
            text=' '.join(group)
            result.append(para(text,'small' if text.startswith('Evidence:') else 'body'))
    return result


class GuideDoc(BaseDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable,'toc_title'):
            key=flowable.bookmark
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(flowable.toc_title,key,level=0,closed=False)
            self.notify('TOCEntry',(0,flowable.toc_title,self.page,key))


def page_chrome(c,doc):
    size = doc.pageTemplate.pagesize
    c.setPageSize(size)
    if doc.page==1: return
    w,h=size
    c.saveState()
    c.setFillColor(MUTED); c.setFont('DM-Semi',8)
    c.drawString(46,h-30,'MARKET METRO')
    c.setFont('DM',8); c.drawRightString(w-46,h-30,'TECHNICAL SUBMISSION GUIDE')
    c.setStrokeColor(LINE); c.setLineWidth(.5); c.line(46,39,w-46,39)
    c.setFillColor(MUTED); c.setFont('DM',7.5)
    c.drawString(46,25,'November 2026  •  Evidence snapshot eb93bac')
    c.drawRightString(w-46,25,f'{doc.page:02d}')
    c.linkURL(LIVE+'/landing.html',(46,20,140,35),relative=0)
    c.restoreState()


def main():
    text=(Path(__file__).with_name('guide.md')).read_text()
    parts=re.split(r'<!-- page(?:: (landscape))? -->',text)
    sections=[]
    orientation='portrait'
    for i in range(0,len(parts),2):
        chunk=parts[i].strip()
        title,body=chunk.split('\n',1)
        assert title.startswith('# ')
        sections.append((orientation,title[2:].strip(),body.strip()))
        if i+1<len(parts): orientation=parts[i+1] or 'portrait'

    OUT.parent.mkdir(parents=True,exist_ok=True)
    doc=GuideDoc(str(OUT),pagesize=A4,leftMargin=46,rightMargin=46,topMargin=50,bottomMargin=49,
                 title='Market Metro | Technical Submission Guide',author='Lanz Vincent Vencer',
                 subject='Architecture, ontology, AI campaigns, PayPal Sandbox and AG Studio evidence',
                 pageCompression=1)
    for name,size in [('portrait',A4),('landscape',landscape(A4))]:
        w,h=size
        frame=Frame(46,49,w-92,h-99,id=name,leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)
        doc.addPageTemplates(PageTemplate(id=name,frames=[frame],onPage=page_chrome,pagesize=size))

    story=[Cover(),PageBreak(),para('CONTENTS','eyebrow'),para('A guide to the submission','title')]
    story += [para('Start with the walkthrough. Follow the architecture into the decisions, then inspect the evidence and reproduce the checks.','small'),Spacer(1,13)]
    toc=TableOfContents()
    toc.levelStyles=[ParagraphStyle('TOC',fontName='DM',fontSize=10,leading=14.4,textColor=INK,leftIndent=0,firstLineIndent=0,spaceBefore=0)]
    story += [toc,Spacer(1,18),para('CLICKABLE NAVIGATION','eyebrow'),para('Contents, source references and product links are clickable. Landscape pages give the architecture figures enough room; the PDF outline also lists every chapter.','small')]
    expected=[]
    for index,(orientation,title,body) in enumerate(sections,1):
        story += [NextPageTemplate(orientation),PageBreak()]
        label=f'{index:02d}  {title}'
        h=para(title,'title'); h.toc_title=label; h.bookmark=f'chapter-{index}'
        story += [para(f'CHAPTER {index:02d}','eyebrow'),h]
        width=(landscape(A4) if orientation=='landscape' else A4)[0]-92
        content=blocks(body,width)
        # A one-page chapter is deliberate: fail rather than silently overflow
        # into a blank or wrongly oriented continuation page.
        total=12+8+29+15
        for flow in content:
            _,height=flow.wrap(width,10000)
            total += height+flow.getSpaceBefore()+flow.getSpaceAfter()
        page_height=(landscape(A4) if orientation=='landscape' else A4)[1]-99
        if total>page_height+4:
            print(f'LAYOUT REVIEW: chapter {index} needs {total:.1f}pt / {page_height:.1f}pt')
        story += content
        expected.append((index+2,title,orientation))
    doc.multiBuild(story)
    from pypdf import PdfReader
    reader=PdfReader(OUT)
    assert len(reader.pages)==len(sections)+2, f'Unexpected page count: {len(reader.pages)} vs {len(sections)+2}'
    for page,title,orientation in expected:
        extracted=reader.pages[page-1].extract_text()
        assert title in ' '.join(extracted.split()), f'Wrong chapter on page {page}'
        box=reader.pages[page-1].mediabox
        assert (float(box.width)>float(box.height))==(orientation=='landscape'), f'Wrong orientation on page {page}'
    print(f'Created {OUT}: {len(reader.pages)} pages, {OUT.stat().st_size:,} bytes')


if __name__=='__main__':
    main()
