"""Extract a compact, reproducible evidence summary from real Maven/Cucumber reports."""
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree
import json
import shutil

root = Path(__file__).resolve().parents[1]
reports = sorted((root / "target/surefire-reports").glob("TEST-*.xml"))
cucumber = root / "target/cucumber-report.json"
html = root / "target/cucumber-report.html"
if not reports or not cucumber.exists() or not html.exists():
    raise SystemExit("Execute mvnw verify antes de coletar as evidências")
out = root / "docs/testing/evidence"
out.mkdir(parents=True, exist_ok=True)
suites = []
for source in reports:
    element = ElementTree.parse(source).getroot()
    suites.append({
        "name": element.get("name"),
        "tests": int(element.get("tests", 0)),
        "failures": int(element.get("failures", 0)),
        "errors": int(element.get("errors", 0)),
        "skipped": int(element.get("skipped", 0)),
        "timeSeconds": float(element.get("time", 0)),
    })
features = json.loads(cucumber.read_text(encoding="utf-8"))
scenarios = []
for feature in features:
    for item in feature.get("elements", []):
        if item.get("type") != "scenario":
            continue
        statuses = [step.get("result", {}).get("status") for step in item.get("steps", [])]
        scenarios.append({"name": item["name"], "status": "passed" if statuses and all(s == "passed" for s in statuses) else "failed"})
summary = {
    "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
    "command": "mvnw.cmd -B -ntp verify",
    "source": "target/surefire-reports/TEST-*.xml and target/cucumber-report.json",
    "totals": {field: sum(row[field] for row in suites) for field in ("tests", "failures", "errors", "skipped")},
    "suites": suites,
    "scenarios": scenarios,
}
(out / "test-summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
shutil.copy2(cucumber, out / "cucumber-report.json")
shutil.copy2(html, out / "cucumber-report.html")
print(f"Evidências coletadas: {summary['totals']['tests']} testes, {len(scenarios)} cenários BDD")
