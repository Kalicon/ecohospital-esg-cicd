$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$base = 'http://localhost:8083'
$health = Invoke-RestMethod "$base/health"
$status = Invoke-RestMethod "$base/api/status"
if ($health.status -ne 'UP' -or $health.environment -ne 'postgres-demo' -or $status.storage -ne 'PostgreSQL JSONB') {
    throw 'A porta 8083 não é o ambiente PostgreSQL esperado.'
}
$before = (Invoke-RestMethod "$base/api/kpis").totalLeiturasIot
$unauthorized = (Invoke-WebRequest "$base/api/reset" -Method Post -SkipHttpErrorCheck).StatusCode
if ($unauthorized -ne 401) { throw "Reset sem token retornou $unauthorized, esperado 401." }
docker restart ecohospital-postgres-demo-app-1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Falha ao reiniciar o app PostgreSQL.' }
$after = $null
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try { $after = (Invoke-RestMethod "$base/api/kpis").totalLeiturasIot; break }
    catch { Start-Sleep -Seconds 2 }
}
if ($after -ne $before) { throw "Contagem após reinício divergiu: $before -> $after" }
$evidence = [ordered]@{
    checkedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
    environment = $health.environment
    storage = $status.storage
    health = $health.status
    readingsBeforeRestart = $before
    unauthorizedResetHttp = $unauthorized
    readingsAfterRestart = $after
    databaseContainer = 'ecohospital-postgres-demo-db-1'
    appContainer = 'ecohospital-postgres-demo-app-1'
}
$out = Join-Path $root 'docs/evidence/v2/postgres-demo.json'
New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null
$evidence | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $out -Encoding utf8
Write-Output "PostgreSQL demonstrado; evidência: $out"
