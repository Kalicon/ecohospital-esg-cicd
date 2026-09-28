"""Render the editable technical document and attach real local evidence summaries.

Run: python scripts/generate-technical-pdf.py (requires reportlab 4.x).
No remote evidence or screenshot is fabricated by this generator.
"""
from pathlib import Path
from xml.etree import ElementTree
from html import escape
import json

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Polygon

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "EcoHospital_CICD.pdf"
styles = getSampleStyleSheet()
styles.add(ParagraphStyle("CoverTitle", fontSize=29, leading=35, textColor=colors.HexColor("#075847"), spaceAfter=24))
styles.add(ParagraphStyle("SectionTitle", fontSize=19, leading=24, textColor=colors.HexColor("#075847"), spaceAfter=18))
styles.add(ParagraphStyle("BodyESG", fontSize=10.5, leading=16, spaceAfter=11))
styles.add(ParagraphStyle("Evidence", fontSize=10, leading=15, textColor=colors.HexColor("#8b4a00"), backColor=colors.HexColor("#fff5e2"), borderPadding=9, spaceAfter=17))
styles.add(ParagraphStyle("SmallESG", fontSize=8.5, leading=12, spaceAfter=8))

def p(text, style="BodyESG"):
    return Paragraph(escape(text), styles[style])

def diagram():
    d = Drawing(480, 245)
    boxes = [(170, 188, 140, "Navegador / proxy"), (35, 108, 150, "Staging :8081"),
             (300, 108, 150, "Production :8082"), (35, 30, 150, "Volume JSON staging"),
             (300, 30, 150, "Volume JSON prod")]
    for x, y, w, label in boxes:
        d.add(Rect(x, y, w, 42, rx=6, fillColor=colors.HexColor("#e8f5f0"), strokeColor=colors.HexColor("#075847")))
        d.add(String(x+w/2, y+17, label, textAnchor="middle", fontName="Helvetica", fontSize=9))
    for x1, y1, x2, y2 in [(240,188,240,170), (110,170,375,170),
                          (110,170,110,150), (375,170,375,150), (110,108,110,72), (375,108,375,72)]:
        d.add(Line(x1,y1,x2,y2,strokeColor=colors.HexColor("#075847"),strokeWidth=1.3))
    d.add(String(240, 4, "Projetos, redes e volumes separados; mesma imagem por digest", textAnchor="middle", fontSize=9))
    return d

def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#c5ddd4"))
    canvas.line(42, 37, A4[0]-42, 37)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#47665d"))
    canvas.drawString(42, 24, "EcoHospital | CI/CD acadêmico | Preparação: 28/09/2026")
    canvas.drawRightString(A4[0]-42, 24, str(doc.page))
    canvas.restoreState()

story = [Spacer(1, 72), p("EcoHospital Smart", "CoverTitle"),
         p("Ciclo CI/CD com Java Spring Boot", "SectionTitle"),
         p("Kalicon Amorim da Cruz Souza — RM 563172"), p("FIAP | Atividade acadêmica | 28/09/2026"),
         Spacer(1, 25), p("Código, testes, containerização e configuração de staging/produção."),
         p("Build Java e demonstração HTTP local verificados. Docker, Actions e deploy remoto aguardam execução em infraestrutura real.", "Evidence"),
         p("Documento gerado a partir de docs/documentacao-tecnica.md. Outros integrantes: preencher se houver.", "SmallESG")]
lines = (ROOT / "docs/documentacao-tecnica.md").read_text(encoding="utf-8").splitlines()
paragraph = []
def flush():
    if paragraph:
        text = " ".join(paragraph)
        story.append(p(text, "Evidence" if text.startswith("EVIDÊNCIA PENDENTE:") else "SmallESG" if text.startswith("https://") else "BodyESG"))
        paragraph.clear()
for line in lines:
    if line.startswith("# "):
        continue
    if line.startswith("## "):
        flush()
        story.append(PageBreak())
        story.append(p(line[3:], "SectionTitle"))
        if line.startswith("## 3."):
            story.append(diagram())
            story.append(Spacer(1, 18))
    elif not line.strip():
        flush()
    else:
        paragraph.append(line.strip())
flush()
story.extend([PageBreak(), p("Anexo — resultados locais reais", "SectionTitle")])
reports = sorted((ROOT / "docs/evidence/local").glob("TEST-*.xml"))
rows = [["Suíte", "Testes", "Falhas", "Erros", "Ignorados"]]
for report in reports:
    suite = ElementTree.parse(report).getroot()
    rows.append([suite.get("name").split(".")[-1], suite.get("tests"), suite.get("failures"), suite.get("errors"), suite.get("skipped")])
if reports:
    table = Table(rows, colWidths=[175,65,65,65,85])
    table.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),colors.HexColor("#075847")),
        ("TEXTCOLOR",(0,0),(-1,0),colors.white), ("GRID",(0,0),(-1,-1),.4,colors.HexColor("#c5ddd4")),
        ("TOPPADDING",(0,0),(-1,-1),9), ("BOTTOMPADDING",(0,0),(-1,-1),9)]))
    story.extend([table, Spacer(1,20)])
else:
    story.append(p("Relatórios JUnit não encontrados. Executar scripts/verify.ps1 antes da entrega.", "Evidence"))
for env in ("staging", "production"):
    path = ROOT / "docs/evidence/local" / f"{env}-health.json"
    if path.exists():
        data = json.loads(path.read_text(encoding="utf-8-sig"))
        story.extend([p(f"HTTP local — {env}", "Heading3"), p(json.dumps(data, ensure_ascii=False), "SmallESG")])
smoke = ROOT / "docs/evidence/local/http-smoke.log"
if smoke.exists():
    story.append(p(smoke.read_text(encoding="utf-8-sig").strip()))
story.append(p("Os resultados anexados são locais. Não representam evidência de Docker ou deploy remoto.", "Evidence"))
OUT.parent.mkdir(parents=True, exist_ok=True)
SimpleDocTemplate(str(OUT), pagesize=A4, rightMargin=42, leftMargin=42, topMargin=45, bottomMargin=52,
                  title="EcoHospital Smart — CI/CD", author="Kalicon Amorim da Cruz Souza").build(story, onFirstPage=footer, onLaterPages=footer)
print(f"PDF gerado: {OUT}")
