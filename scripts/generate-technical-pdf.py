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
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Image
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
    canvas.drawString(42, 24, "EcoHospital | CI/CD acadêmico | Atualização: 07/10/2026")
    canvas.drawRightString(A4[0]-42, 24, str(doc.page))
    canvas.restoreState()

story = [Spacer(1, 72), p("EcoHospital Smart", "CoverTitle"),
         p("Ciclo CI/CD com Java Spring Boot", "SectionTitle"),
         p("Kalicon Amorim da Cruz Souza — RM 563172"), p("FIAP | Atividade acadêmica | 07/10/2026"),
         Spacer(1, 25), p("Código, testes, containerização e configuração de staging/produção."),
         p("Revisão implantada f240024: 39 testes JUnit e dois deploys Docker no PC comprovados. Evolução de auditoria: 43 testes e Compose isolado aprovados localmente; SBOM e restauração aprovados no PR #5. Atestado da imagem e promoção desta evolução ainda pendentes. Evidências e limites anexados.", "Evidence"),
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
story.append(p("Os resultados acima são da primeira demonstração Java local. As próximas capturas mostram o GitHub Actions e os containers Docker reais no PC.", "Evidence"))
v2_dir = ROOT / "docs/evidence/v2"
v2_reports = sorted(v2_dir.glob("TEST-*.xml"))
if v2_reports:
    story.extend([PageBreak(), p("Anexo — evolução local verificada", "SectionTitle")])
    v2_rows = [["Suíte", "Testes", "Falhas", "Erros", "Ignorados"]]
    for report in v2_reports:
        suite = ElementTree.parse(report).getroot()
        v2_rows.append([suite.get("name").split(".")[-1], suite.get("tests"), suite.get("failures"), suite.get("errors"), suite.get("skipped")])
    v2_table = Table(v2_rows, colWidths=[175,65,65,65,85])
    v2_table.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),colors.HexColor("#075847")),
        ("TEXTCOLOR",(0,0),(-1,0),colors.white), ("GRID",(0,0),(-1,-1),.4,colors.HexColor("#c5ddd4")),
        ("TOPPADDING",(0,0),(-1,-1),9), ("BOTTOMPADDING",(0,0),(-1,-1),9)]))
    story.extend([v2_table, Spacer(1, 16)])
pg_evidence = v2_dir / "postgres-demo.json"
if pg_evidence.exists():
    data = json.loads(pg_evidence.read_text(encoding="utf-8-sig"))
    story.append(p("PostgreSQL isolado no PC: " + json.dumps(data, ensure_ascii=False), "SmallESG"))
    story.append(p("Esta prova é do ambiente postgres-demo, não da migração de staging/produção.", "Evidence"))
v3_dir = ROOT / "docs/evidence/v3"
v3_reports = sorted(v3_dir.glob("TEST-*.xml"))
if v3_reports:
    story.extend([PageBreak(), p("Anexo — revisão operacional e rastreabilidade", "SectionTitle")])
    rows = [["Suíte", "Testes", "Falhas", "Erros", "Ignorados"]]
    for report in v3_reports:
        suite = ElementTree.parse(report).getroot()
        rows.append([suite.get("name").split(".")[-1], suite.get("tests"), suite.get("failures"), suite.get("errors"), suite.get("skipped")])
    table = Table(rows, colWidths=[175,65,65,65,85])
    table.setStyle(TableStyle([("GRID", (0,0), (-1,-1), .5, colors.lightgrey), ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#e4f1ea"))]))
    story.extend([table, Spacer(1,16), p("Resultados locais desta revisão. Não constituem promoção no CI/CD nem comprovação ambiental.", "Evidence")])
    smoke = v3_dir / "journal-smoke.json"
    if smoke.exists():
        story.append(p(smoke.read_text(encoding="utf-8-sig"), "SmallESG"))
    for name in ["inventory-desktop.png", "operations-desktop.png"]:
        screenshot = v3_dir / name
        if screenshot.exists():
            picture = Image(str(screenshot))
            picture.drawHeight *= 480 / picture.drawWidth
            picture.drawWidth = 480
            story.extend([PageBreak(), p("Captura real — postgres-demo", "SectionTitle"), picture])

github_dir = ROOT / "docs/evidence/github"
for name, caption in [("03-updated-ci-success.png", "Run inicial: verify e image aprovados; naquele momento os deploys ainda estavam desabilitados."),
                      ("02-test-gate-failure.png", "PR descartável: verify falhou; image e deploys bloqueados. PR fechado sem merge.")]:
    screenshot = github_dir / name
    if screenshot.exists():
        story.extend([PageBreak(), p("Anexo — captura real do GitHub", "SectionTitle"), p(caption)])
        picture = Image(str(screenshot))
        scale = min(490 / picture.imageWidth, 590 / picture.imageHeight)
        picture.drawWidth = picture.imageWidth * scale
        picture.drawHeight = picture.imageHeight * scale
        story.append(picture)
        story.append(p(f"Origem: docs/evidence/github/{name}. Captura da página real, sem montagem de status.", "SmallESG"))
pc_dir = ROOT / "docs/evidence/pc"
for name, caption in [("github-two-deploys-approved.png", "Run final aprovado: verify, image, staging-pc e production-pc."),
                      ("github-production-approval.png", "Histórico real: Kalicon aprovou production antes do deploy."),
                      ("staging-dashboard.png", "Dashboard real de staging no container Docker deste PC, porta 8081."),
                      ("production-dashboard.png", "Dashboard real de produção no container Docker deste PC, porta 8082.")]:
    screenshot = pc_dir / name
    if screenshot.exists():
        story.extend([PageBreak(), p("Anexo — ambiente Docker no PC", "SectionTitle"), p(caption)])
        picture = Image(str(screenshot))
        scale = min(490 / picture.imageWidth, 590 / picture.imageHeight)
        picture.drawWidth = picture.imageWidth * scale
        picture.drawHeight = picture.imageHeight * scale
        story.append(picture)
        story.append(p(f"Origem: docs/evidence/pc/{name}. Captura real; URLs localhost não são servidores públicos.", "SmallESG"))
OUT.parent.mkdir(parents=True, exist_ok=True)
SimpleDocTemplate(str(OUT), pagesize=A4, rightMargin=42, leftMargin=42, topMargin=45, bottomMargin=52,
                  title="EcoHospital Smart — CI/CD", author="Kalicon Amorim da Cruz Souza").build(story, onFirstPage=footer, onLaterPages=footer)
print(f"PDF gerado: {OUT}")
