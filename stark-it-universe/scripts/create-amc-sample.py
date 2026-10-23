"""Generate a printable, uncompleted AMC scope worksheet and inspectable renders.
Run with PYTHONPATH=.tools/pdf after installing reportlab, pypdf and pymupdf there.
"""
from pathlib import Path
import shutil
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from pypdf import PdfReader
import pymupdf

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'output/pdf/siu-amc-scope-sample.pdf'
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='TitleSIU', fontName='Helvetica-Bold', fontSize=24, leading=29, textColor=colors.HexColor('#0B1640'), spaceAfter=14))
styles.add(ParagraphStyle(name='SectionSIU', fontName='Helvetica-Bold', fontSize=12, leading=17, textColor=colors.HexColor('#0B1640'), spaceBefore=16, spaceAfter=8))
styles.add(ParagraphStyle(name='BodySIU', fontName='Helvetica', fontSize=9.5, leading=14, spaceAfter=9))
styles.add(ParagraphStyle(name='CellSIU', fontName='Helvetica', fontSize=9, leading=13))
story = []
def para(text): return Paragraph(text, styles['BodySIU'])
def heading(text): story.append(Paragraph(text, styles['SectionSIU']))
def table(rows, widths=(145, 348)):
    wrapped = [[Paragraph(str(cell), styles['CellSIU']) for cell in row] for row in rows]
    t = Table(wrapped, colWidths=widths)
    t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('BACKGROUND',(0,0),(0,-1),colors.HexColor('#EEF1FA')),('GRID',(0,0),(-1,-1),.5,colors.HexColor('#CDD5EA')),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,-1),9),('BOTTOMPADDING',(0,0),(-1,-1),9)]))
    story.append(t)
story += [Paragraph('STARK IT UNIVERSE', styles['SectionSIU']), Paragraph('School AMC<br/>scope worksheet', styles['TitleSIU']), para('SAMPLE FOR DISCUSSION - NOT AN EXECUTED CONTRACT'), para('Use this worksheet to request a proposal or compare annual maintenance scopes. All rates, visits, service levels, coverage and responsibilities require written agreement. Blank fields are not promises or default contract terms.')]
heading('1. School and service location')
table([['School / institution', 'Name: __________________________________________'], ['Campus address', 'Address and postcode: _____________________________<br/><br/>________________________________________________'], ['School contact', 'Name / role: ______________________________________<br/>Phone / email: ____________________________________'], ['Requested period', 'Start: __________________ End: _____________________']])
heading('2. Equipment to assess')
story.append(para('Attach an asset schedule listing device type, make, model, serial number, classroom, age, warranty status and existing faults. SIU and the school must accept the covered inventory after assessment.'))
table([['Assets and quantities', 'Panels: __________ Projectors: __________<br/>Computers: _______ Other: _________________________'], ['Condition / exclusions', 'Existing faults and unaccepted assets: _______________<br/><br/>________________________________________________']])
heading('3. Scope option to quote')
story.append(para('Circle or mark: Preventive care / Labour support / Parts-inclusive proposal. Define every included service and any replacement limits in the final proposal.'))
story.append(PageBreak())
story += [Paragraph('Service schedule & commercial scope', styles['TitleSIU']), para('Complete these fields with the supplier before approving the final proposal.')]
table([['Preventive visits', 'Visits per year and schedule: ________________________<br/>Inspection tasks and report: ________________________'], ['Support window', 'Days / hours / holidays: ____________________________<br/>Ticket channel: ___________________________________'], ['Acknowledgement', 'Target and measurement start: _____________________'], ['On-site response', 'By severity and travel zone: ________________________<br/>Remote triage / access conditions: __________________'], ['Resolution / updates', 'Target or next-update time: _________________________<br/>Parts lead time and other dependencies: _____________'], ['Parts and labour', 'Included items and limits: __________________________<br/>Chargeable approval process: ______________________'], ['Loaner and transport', 'Availability, model, duration and charges: ______________<br/>Workshop custody / return terms: ___________________'], ['Escalation', 'Operational contact: ______________________________<br/>Next escalation contact: ___________________________'], ['Exclusions', 'Consumables / damage / power / software / obsolete<br/>equipment / other exclusions: ______________________'], ['Price and payment', 'Rate unit and annual subtotal: ______________________<br/>Tax treatment, validity and milestones: _______________'], ['Renewal and records', 'Renewal / cancellation / exit terms: __________________<br/>Reports and records to hand over: __________________']])
story += [Spacer(1, 16), para('School responsibilities: agree site access, a nominated contact, safe power, lawful software and data backup arrangements. The signed proposal and asset schedule govern the service; this sample does not establish coverage.'), para('Discuss the completed scope with SIU:<br/>+91 73024 79231 | info@starkituniverse.in<br/>KA-215, Pratap Vihar, Sector 12, Ghaziabad, Uttar Pradesh 201009')]
def footer(canvas, doc):
    canvas.setStrokeColor(colors.HexColor('#FFB52E')); canvas.line(51, 43, 544, 43)
    canvas.setFont('Helvetica', 8); canvas.setFillColor(colors.HexColor('#39446B'))
    canvas.drawString(51, 30, 'Stark IT Universe | Sample scope for discussion')
    canvas.drawRightString(544, 30, f'{doc.page}')
doc = SimpleDocTemplate(str(OUTPUT), pagesize=A4, rightMargin=51, leftMargin=51, topMargin=38, bottomMargin=58, title='SIU School AMC Scope Worksheet', author='Stark IT Universe')
doc.build(story, onFirstPage=footer, onLaterPages=footer)
reader = PdfReader(OUTPUT)
assert len(reader.pages) == 2, f'Expected 2 pages, got {len(reader.pages)}'
assert 'NOT AN EXECUTED CONTRACT' in reader.pages[0].extract_text()
renders = ROOT / 'tmp/pdfs'; renders.mkdir(parents=True, exist_ok=True)
pdf = pymupdf.open(OUTPUT)
for i, page in enumerate(pdf):
    page.get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5)).save(str(renders / f'amc-page-{i + 1}.png'))
public = ROOT / 'public/downloads'; public.mkdir(parents=True, exist_ok=True)
shutil.copyfile(OUTPUT, public / OUTPUT.name)
text = '\n\n'.join(p.extract_text() for p in reader.pages)
(public / 'siu-amc-scope-sample.txt').write_text(text, encoding='utf-8')
print(f'Created and text-checked {len(reader.pages)} pages; renders in {renders}')
