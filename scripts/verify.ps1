param()
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    New-Item -ItemType Directory -Force -Path 'docs/evidence/local' | Out-Null
    $evidenceDir = Join-Path $projectRoot 'docs/evidence/local'
    $commands = @(
        @{Name='legacy-runner.log'; Command={node src/test_mongodb_runner.js}},
        @{Name='frontend-syntax.log'; Command={node --check public/app.js}},
        @{Name='maven-verify.log'; Command={& .\mvnw.cmd -B -ntp verify}}
    )
    foreach ($entry in $commands) {
        & $entry.Command 2>&1 | Tee-Object -FilePath (Join-Path $evidenceDir $entry.Name)
        if ($LASTEXITCODE -ne 0) { throw "Falhou: $($entry.Name), código $LASTEXITCODE" }
    }
    Copy-Item 'target/surefire-reports/TEST-*.xml' $evidenceDir
    Write-Output 'Build e testes concluídos. Relatórios reais em docs/evidence/local.'
} finally { Pop-Location }
