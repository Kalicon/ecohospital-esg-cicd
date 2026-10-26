"""Build the test-assignment PDF using only verified Maven/Cucumber outputs."""
from pathlib import Path
import json

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Image, Table, TableStyle

root = Path(__file__).resolve().parents[1]
evidence = root / "docs/testing/evidence"
summary = json.loads((evidence / "test-summary.json").read_text(encoding="utf-8"))
totals = summary["totals"]
assert totals == {"tests": 50, "failures": 0, "errors": 0, "skipped": 0}, totals
assert len(summary["scenarios"]) == 4 and all(s["status"] == "passed" for s in summary["scenarios"])
out = root / "docs/testing/EcoHospital_Testes_Automatizados.pdf"
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="TitleESG", parent=styles["Title"], fontSize=24, leading=29, textColor=colors.HexColor("#075847"), spaceAfter=20))
styles.add(ParagraphStyle(name="HeadingESG", parent=styles["Heading2"], fontSize=16, leading=20, textColor=colors.HexColor("#075847"), spaceAfter=11))
styles.add(ParagraphStyle(name="BodyESG", parent=styles["BodyText"], fontSize=9.5, leading=14, spaceAfter=9))
styles.add(ParagraphStyle(name="SmallESG", parent=styles["BodyText"], fontSize=8, leading=11, spaceAfter=5))

def p(value, style="BodyESG"):
    from xml.sax.saxutils import escape
    return Paragraph(escape(value), styles[style])

def table(rows, widths):
    t = Table([[p(str(c), "SmallESG") for c in row] for row in rows], colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e4f1ea")),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#bdd6cb")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ]))
    return t

def screenshot(filename, width=510):
    item = Image(str(evidence / filename))
    scale = min(width / item.imageWidth, 650 / item.imageHeight)
    item.drawWidth, item.drawHeight = item.imageWidth * scale, item.imageHeight * scale
    return item

story = [Spacer(1, 55), p("EcoHospital Smart", "TitleESG"), p("Testes Automatizados: BDD + contratos de API", "HeadingESG"),
         p("Kalicon Amorim da Cruz Souza — RM 563172"), p("FIAP | Atividade avaliativa | 22/10/2026"), Spacer(1, 15),
         p("Projeto ESG em Java 17 e Spring Boot 3.5.16. Execução local com Maven Wrapper; cenários BDD implementados com Cucumber e contratos HTTP/JSON Schema validados por NetworkNT. Dados de teste não são evidência de certificação ambiental."),
         p(f"Resultado observado: BUILD SUCCESS; {totals['tests']} testes, {totals['failures']} falhas, {totals['errors']} erros, {totals['skipped']} ignorados. Quatro cenários Gherkin aprovados."),
         PageBreak(), p("Cenários Gherkin", "HeadingESG"),
         table([["Cenário", "Interação e expectativa"]] + [[s["name"],
              {"Consultar indicadores iniciais do hospital":"GET /api/kpis → 200, 10 hospitais/leituras",
               "Bloquear simulação sem credencial de operador":"POST sem chave → 401, estado preservado",
               "Registrar uma leitura simulada com operador autorizado":"POST com chave fictícia → 201, 11 leituras",
               "Impedir salto de etapa na custódia de resíduos":"Avanço GERADO→DESTINADO → 400, etapa preservada"}[s["name"]]] for s in summary["scenarios"]], [225, 275]),
         Spacer(1, 12), p("Fonte: src/test/resources/features/ecohospital.feature. Passos reais em BddSteps.java; cada cenário restaura o estado didático."),
         PageBreak(), p("Print da configuração Gherkin", "HeadingESG"), screenshot("gherkin-configuracao.png"),
         p("Captura real do arquivo .feature aberto no navegador local. Não é uma imagem produzida para simular resultado.", "SmallESG"),
         PageBreak(), p("Print da execução BDD", "HeadingESG"), screenshot("cucumber-execucao.png"),
         p("Captura real do target/cucumber-report.html gerado por mvnw verify; quatro cenários exibidos como aprovados.", "SmallESG"),
         PageBreak(), p("Contratos de API e execução", "HeadingESG"),
         p("ApiContractTest.java cobre os 21 mapeamentos REST dos três controllers e /actuator/health. Cada resposta de sucesso verifica status, corpo JSON e um contrato do arquivo api-contracts.json (JSON Schema draft 2020-12). Há casos adicionais de 400/401/403/404. O teste confere campos e efeitos: total de leituras, fator revisado, inventário 100 × 0,1 = 10 kgCO2e, transição de resíduos e ações."),
         table([["Suíte", "Testes", "Falhas", "Erros"]] + [[row["name"].split(".")[-1], row["tests"], row["failures"], row["errors"]] for row in summary["suites"]], [260, 80, 80, 80]),
         Spacer(1, 12), p("Origem: relatórios XML de target/surefire-reports e JSON do Cucumber; síntese machine-readable em docs/testing/evidence/test-summary.json. Comando: .\\mvnw.cmd -B -ntp verify."),
         p("Desafio: Cucumber 7.34.9 exigia API de descoberta do JUnit posterior à versão gerenciada pelo Spring Boot 3.5. Ajustou-se Cucumber para 7.20.1, mantendo JUnit gerenciado pelo parent; em seguida a suíte completa passou."),
         PageBreak(), p("Checklist da atividade", "HeadingESG"),
         table([["Requisito", "Status", "Comprovação"],
                ["Projeto Java Spring ESG reutilizado", "OK", "Código-fonte e pom.xml"],
                ["Mínimo 3 cenários Gherkin", "OK", "4 cenários; Cucumber HTML/JSON"],
                ["Caminhos positivos e negativos", "OK", "HTTP 200/201 e 400/401"],
                ["Todas as APIs, status e corpo", "OK", "21 mapeamentos + actuator"],
                ["JSON Schema", "OK", "api-contracts.json + NetworkNT"],
                ["Execução local ou CI", "OK", "Maven verify e workflow"],
                ["ZIP e README", "OK", "Pacote da atividade"],
                ["PDF e prints reais", "OK", "Este PDF e anexos"],
               ], [250, 55, 195]),
         Spacer(1, 15), p("Limite: este PDF comprova execução local em 22/10/2026. O código novo ainda não foi publicado no GitHub; não se afirma run remoto desta revisão. Testes não certificam dados ambientais externos.")]

def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#47665d"))
    canvas.drawString(42, 25, "EcoHospital | Testes Automatizados | 22/10/2026")
    canvas.drawRightString(A4[0] - 42, 25, str(doc.page))
    canvas.restoreState()

SimpleDocTemplate(str(out), pagesize=A4, leftMargin=42, rightMargin=42, topMargin=45, bottomMargin=48).build(story, onFirstPage=footer, onLaterPages=footer)
print(f"PDF gerado: {out}")
