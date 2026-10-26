"""Check the testing assignment ZIP, its evidence, and the internal file manifest."""
import hashlib
import json
import sys
import zipfile
from pathlib import Path, PurePosixPath

root = Path(__file__).resolve().parents[1]
path = Path(sys.argv[1]) if len(sys.argv) > 1 else root / "delivery/EcoHospital_Testes_Automatizados_2026-10-22.zip"
with zipfile.ZipFile(path) as package:
    assert package.testzip() is None, "CRC inválido"
    names = package.namelist()
    assert len(names) == len(set(names)), "Nomes duplicados"
    prefix = "EcoHospital-Testes-ESG/"
    assert all(name.startswith(prefix) for name in names), "Pasta raiz incorreta"
    required = [
        "pom.xml", "Dockerfile", "docker-compose.yml", ".env.example", "README.md",
        "src/main/java/br/com/ecohospital/EsgController.java",
        "src/test/java/br/com/ecohospital/ApiContractTest.java",
        "src/test/java/br/com/ecohospital/BddTest.java",
        "src/test/java/br/com/ecohospital/BddSteps.java",
        "src/test/resources/features/ecohospital.feature",
        "src/test/resources/api-contracts.json",
        "docs/testing/README.md", "docs/testing/EcoHospital_Testes_Automatizados.pdf",
        "docs/testing/evidence/test-summary.json", "docs/testing/evidence/cucumber-report.html",
        "docs/testing/evidence/cucumber-execucao.png", "docs/testing/evidence/gherkin-configuracao.png",
        ".github/workflows/ci-cd.yml", "scripts/collect-test-evidence.py",
    ]
    for name in required:
        assert prefix + name in names, f"Arquivo ausente: {name}"
    for name in names:
        parts = PurePosixPath(name).parts
        assert ".." not in parts and not set(parts) & {".git", "target", ".runtime", "__pycache__"}, name
        assert not parts[-1].endswith(".env") and parts[-1] != ".env", name
        assert not name.endswith((".pem", ".key", ".pfx", ".p12")), name
    manifest_name = prefix + "MANIFEST-SHA256.txt"
    checked = set()
    for line in package.read(manifest_name).decode("utf-8").splitlines():
        digest, name = line.split("  ", 1)
        assert hashlib.sha256(package.read(name)).hexdigest() == digest, name
        checked.add(name)
    assert checked == set(names) - {manifest_name}, "Manifesto inconsistente"
    summary = json.loads(package.read(prefix + "docs/testing/evidence/test-summary.json"))
    assert summary["totals"] == {"tests": 50, "failures": 0, "errors": 0, "skipped": 0}
    assert len(summary["scenarios"]) == 4 and all(item["status"] == "passed" for item in summary["scenarios"])
print(f"ZIP_OK: {path.name}; {len(checked)} arquivos; 50 testes, 4 BDD; CRC e SHA-256 válidos")
