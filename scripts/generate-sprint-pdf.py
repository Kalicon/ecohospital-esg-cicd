"""Generate the sprint report from real local test and container evidence."""
from pathlib import Path
from xml.etree import ElementTree
import json

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Image
from reportlab.graphics.shapes import Drawing, Rect, String, Line

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "docs/evidence/sprint-2026-10-26"
OUTPUT = ROOT / "docs/sprint-2026-10-26/EcoHospital_Sprint_Rastreabilidade.pdf"
reports = sorted((ROOT / "docs/evidence/local").glob("TEST-*.xml"))
assert reports, "Execute scripts/verify.ps1 antes de gerar o PDF"
suites = [ElementTree.parse(item).getroot() for item in reports]
totals = {key: sum(int(suite.get(key, "0")) for suite in suites)
          for key in ("tests", "failures", "errors", "skipped")}
assert totals == {"tests": 55, "failures": 0, "errors": 0, "skipped": 0}, totals
assert any(suite.get("name", "").endswith("BddTest") and suite.get("tests") == "6" for suite in suites)
health = json.loads((EVIDENCE / "isolated-health.json").read_text(encoding="utf-8"))
observed = json.loads((EVIDENCE / "inventory-summary-observed.json").read_text(encoding="utf-8"))
assert health["status"] == "UP" and health["environment"] == "sprint-validation", health
assert "0 lançamentos declarados e 1 simulações didáticas excluídas" in observed["summary"]
for name in ("cucumber-6-scenarios.png", "inventory-simulation-excluded.png",
             "github-actions-run-current.png"):
    assert (EVIDENCE / name).exists(), name
deployed = json.loads((EVIDENCE / "deployed-health-summary.json").read_text(encoding="utf-8"))
deployed_version = "871a9b66da3fea41eeb85bcef4d012a64e52a399"
assert deployed["run"] == 40319759255
for environment, readings in (("staging", 11), ("production", 10)):
    current = deployed["environments"][environment]
    assert current["health"] == {"status": "UP", "environment": environment, "version": deployed_version}
    assert current["totalLeiturasIot"] == readings
    artifact = json.loads((EVIDENCE / f"{environment}-artifact/{environment}-health.json").read_text(encoding="utf-8-sig"))
    assert artifact["version"] == deployed_version and artifact["status"] == "UP"
    assert (EVIDENCE / f"{environment}-inventory-current.png").exists()

styles = getSampleStyleSheet()
green = colors.HexColor("#075847")
styles.add(ParagraphStyle("CoverESG", parent=styles["Title"], fontSize=25, leading=30,
                          textColor=green, spaceAfter=18))
styles.add(ParagraphStyle("SectionESG", parent=styles["Heading2"], fontSize=16,
                          leading=20, textColor=green, spaceAfter=12))
styles.add(ParagraphStyle("BodyESG", parent=styles["BodyText"], fontSize=9.5,
                          leading=14, spaceAfter=9))
styles.add(ParagraphStyle("SmallESG", parent=styles["BodyText"], fontSize=8,
                          leading=11, spaceAfter=6))

def p(value, style="BodyESG"):
    from xml.sax.saxutils import escape
    return Paragraph(escape(str(value)), styles[style])

def picture(name, max_width=510, max_height=570):
    item = Image(str(EVIDENCE / name))
    scale = min(max_width / item.imageWidth, max_height / item.imageHeight)
    item.drawWidth = item.imageWidth * scale
    item.drawHeight = item.imageHeight * scale
    return item

def table(rows, widths):
    item = Table([[p(cell, "SmallESG") for cell in row] for row in rows], colWidths=widths, repeatRows=1)
    item.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e4f1ea")),
        ("GRID", (0, 0), (-1, -1), .4, colors.HexColor("#bdd6cb")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ]))
    return item

def architecture():
    drawing = Drawing(500, 160)
    boxes = [(0, 100, 145, "Navegador"), (177, 100, 145, "Spring Boot :8080"),
             (355, 100, 145, "Volume JSON"), (177, 20, 145, "Teste + CI/CD")]
    for x, y, w, title in boxes:
        drawing.add(Rect(x, y, w, 42, rx=6, fillColor=colors.HexColor("#e4f1ea"), strokeColor=green))
        drawing.add(String(x + w / 2, y + 17, title, textAnchor="middle", fontSize=9))
    for x1, y1, x2, y2 in [(145, 121, 177, 121), (322, 121, 355, 121), (249, 62, 249, 100)]:
        drawing.add(Line(x1, y1, x2, y2, strokeColor=green, strokeWidth=1.5))
    return drawing

story = [Spacer(1, 45), p("EcoHospital Smart", "CoverESG"),
         p("Sprint de rastreabilidade do inventário ESG", "SectionESG"),
         p("Kalicon Amorim da Cruz Souza — RM 563172"),
         p("FIAP | Projeto Java 17 + Spring Boot 3.5.16 | 26/10/2026"),
         Spacer(1, 16),
         p("Objetivo: distinguir consumo declarado de simulação didática e impedir que simulações ou anulações inflem o resumo parcial de emissões."),
         p("Limite: demonstração acadêmica. Valores de ensaio, fatores e referências não equivalem a inventário oficial, auditoria independente ou comprovação de conformidade."),
         architecture(), Spacer(1, 20),
         p("Arquitetura Docker: imagem multi-stage Maven/JDK 17 → JRE 17 não-root; porta 8080, healthcheck HTTP, volume persistente por ambiente. Compose define rede e segredos em arquivos externos. Staging e produção existentes usam projetos/volumes separados."),
         PageBreak(), p("Pipeline e testes", "SectionESG"),
         p("GitHub Actions: verify (Node + Maven/JUnit/Cucumber) → image (build Docker + smoke/backup/PostgreSQL + SBOM) → staging → production. Os jobs dependem de needs; falha de teste impede publicar imagem e executar deploy. Produção requer aprovação do GitHub Environment. A imagem é promovida pelo mesmo digest imutável."),
         table([["Suíte", "Testes", "Falhas", "Erros"]] +
               [[suite.get("name").split(".")[-1], suite.get("tests"), suite.get("failures"), suite.get("errors")]
                for suite in suites], [250, 85, 85, 80]),
         Spacer(1, 14), p(f"Resultado local real: {totals['tests']} testes, {totals['failures']} falhas, {totals['errors']} erros; 6 cenários BDD. Comando: .\\scripts\\verify.ps1. O build Docker também concluiu mvn verify com 55 testes no Java 17."),
         PageBreak(), p("Evidência: pipeline e aprovação", "SectionESG"),
         picture("github-actions-run-current.png", max_height=500),
         p("Captura real do GitHub Actions run 40319759255: verify, image, staging-pc e production-pc concluídos; o Environment de produção registra a aprovação humana. Os jobs SSH remotos ficaram skipped porque os ambientes desta demonstração são locais."),
         PageBreak(), p("Evidência: execução BDD", "SectionESG"),
         picture("cucumber-6-scenarios.png", max_height=550),
         p("Captura do relatório HTML realmente produzido pelo Maven/Cucumber em 26/10/2026. Inclui cenários positivos e negativos para inventário, telemetria, indicadores e cadeia de custódia."),
         PageBreak(), p("Container isolado e inventário", "SectionESG"),
         p(f"Health real: {json.dumps(health, ensure_ascii=False)}"),
         p("Foi criado um lançamento sintético com dataOrigin=SIMULATED e verification=SIMULADO_NAO_VERIFICADO apenas no volume de teste da porta 18084. A captura mostra zero lançamentos declarados, uma simulação excluída e ambos os métodos do escopo 2 separados."),
         picture("inventory-simulation-excluded.png", max_height=490),
         p("A captura é da interface no container isolado, não de staging ou produção. O JSON correspondente está na pasta de evidências desta sprint."),
         PageBreak(), p("Deploy atual: staging", "SectionESG"),
         p("Run 40319759255: verify, image e staging-pc aprovados. O job de staging publicou o commit 871a9b6 no Docker deste PC; health UP e 11 leituras preservadas. Captura real da interface após a promoção:"),
         picture("staging-inventory-current.png", max_height=440),
         p("Evidência adicional: staging-artifact/staging-health.json e staging-containers.json."),
         PageBreak(), p("Deploy atual: produção", "SectionESG"),
         p("No mesmo run, produção aguardou a aprovação obrigatória do Environment. Após a aprovação humana, production-pc foi aprovado. Health UP no mesmo commit 871a9b6; 10 leituras preservadas e mesma imagem Docker observada nos dois containers."),
         picture("production-inventory-current.png", max_height=440),
         p("Evidência adicional: production-artifact/production-health.json e production-containers.json. Os serviços são locais a este PC (portas 8081/8082), não hospedagem pública."),
         PageBreak(), p("Desafios, limites e checklist", "SectionESG"),
         p("Run verificável: https://github.com/Kalicon/ecohospital-esg-cicd/actions/runs/40319759255. Os jobs remotos por SSH ficaram skipped porque não há servidores externos; os jobs staging-pc e production-pc foram aprovados. As flags de deploy local voltaram a false após agendamento para evitar novas promoções automáticas."),
         p("Desafios resolvidos: dados sintéticos antes podiam ser confundidos com consumo real; a origem agora é explícita e testada no backend, contrato, BDD e resumo da UI. Registros legados continuam legíveis como declarações não verificadas. Os dois métodos do escopo 2 não são somados. Os testes e capturas usam volume isolado para não alterar staging/produção."),
         table([["Item", "Status", "Evidência"] ,
                ["Código Java Spring, Dockerfile e Compose", "OK", "Fontes e configs do ZIP"],
                ["Build e 55 testes; 6 cenários BDD", "OK", "XML, logs e captura Cucumber"],
                ["Imagem/container local da sprint", "OK", "Health e screenshot isolados"],
                ["Deploy staging/produção da sprint", "OK", "Run 40319759255; health/prints atuais"],
                ["Mesmo digest nos dois ambientes", "OK", "Artefatos e Docker inspect local"],
                ["Inventário ambiental oficial", "Não", "Dados didáticos não certificados"]],
               [250, 70, 180]),
         Spacer(1, 12), p("Arquivos: docs/evidence/sprint-2026-10-26/; documentação reproduzível: docs/sprint-2026-10-26/README.md. Dados ambientais permanecem didáticos; deploy não equivale a certificação.")]

def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(green)
    canvas.drawString(42, 25, "EcoHospital | sprint de rastreabilidade | 26/10/2026")
    canvas.drawRightString(A4[0] - 42, 25, str(doc.page))
    canvas.restoreState()

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
SimpleDocTemplate(str(OUTPUT), pagesize=A4, leftMargin=42, rightMargin=42,
                  topMargin=43, bottomMargin=45).build(story, onFirstPage=footer, onLaterPages=footer)
print(f"PDF gerado: {OUTPUT}")
