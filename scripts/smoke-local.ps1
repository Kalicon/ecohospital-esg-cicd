param([int]$StagingPort = 18081, [int]$ProductionPort = 18082)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$javaBin = if ($env:JAVA_HOME) { Join-Path $env:JAVA_HOME 'bin/java.exe' } else { (Get-Command java).Source }
$jarPath = Join-Path $projectRoot 'target/esg-app.jar'
if (-not (Test-Path -LiteralPath $jarPath)) { throw 'Execute scripts/verify.ps1 antes.' }
$evidenceDir = Join-Path $projectRoot 'docs/evidence/local'
New-Item -ItemType Directory -Force -Path $evidenceDir | Out-Null
$runtimeDir = Join-Path $projectRoot '.runtime'
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
$appVersion = (Get-FileHash -LiteralPath $jarPath -Algorithm SHA256).Hash.ToLowerInvariant()
$processes = [System.Collections.Generic.List[System.Diagnostics.Process]]::new()
function Start-App([string]$EnvironmentName, [int]$PortNumber) {
    if (Get-NetTCPConnection -State Listen -LocalPort $PortNumber -ErrorAction SilentlyContinue) {
        throw "Porta ocupada: $PortNumber"
    }
    $argsList = @('-jar', ('"' + $jarPath + '"'), "--server.port=$PortNumber",
        "--app.environment=$EnvironmentName", "--app.version=$appVersion",
        ('--app.storage-file="' + (Join-Path $runtimeDir "$EnvironmentName.json") + '"'))
    $appProcess = Start-Process -FilePath $javaBin -ArgumentList $argsList -PassThru -WindowStyle Hidden -WorkingDirectory $projectRoot `
        -RedirectStandardOutput (Join-Path $evidenceDir "$EnvironmentName-server.log") `
        -RedirectStandardError (Join-Path $evidenceDir "$EnvironmentName-server-error.log")
    $processes.Add($appProcess)
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if ($appProcess.HasExited) { throw "Aplicação $EnvironmentName encerrou antecipadamente" }
        try {
            $response = Invoke-RestMethod "http://localhost:$PortNumber/health"
            if ($response.status -eq 'UP') { return $appProcess }
        } catch { Start-Sleep -Milliseconds 500 }
    }
    throw "Timeout $EnvironmentName"
}
try {
    $stagingProcess = Start-App 'staging' $StagingPort
    $productionProcess = Start-App 'production' $ProductionPort
    foreach ($entry in @(@{Name='staging'; Port=$StagingPort}, @{Name='production'; Port=$ProductionPort})) {
        $baseUrl = "http://localhost:$($entry.Port)"
        # Somente os arquivos .runtime criados por este script são restaurados.
        Invoke-RestMethod "$baseUrl/api/reset" -Method Post | Out-Null
        $health = Invoke-RestMethod "$baseUrl/health"
        if ($health.environment -ne $entry.Name -or $health.version -ne $appVersion) { throw 'Ambiente/versão divergente' }
        $health | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $evidenceDir "$($entry.Name)-health.json")
        $pageResponse = Invoke-WebRequest $baseUrl -UseBasicParsing
        if ($pageResponse.StatusCode -ne 200 -or $pageResponse.Content -notmatch 'EcoHospital Smart') { throw 'Frontend inválido' }
        Invoke-RestMethod "$baseUrl/api/status" | ConvertTo-Json -Depth 6 | Set-Content -Encoding utf8 (Join-Path $evidenceDir "$($entry.Name)-status.json")
    }
    $stagingUrl = "http://localhost:$StagingPort"
    $productionUrl = "http://localhost:$ProductionPort"
    $reading = Invoke-RestMethod "$stagingUrl/api/telemetria/simular" -Method Post -ContentType 'application/json' -Body '{"codigo_fonte":"FONTE-CALD-01"}'
    if ($reading.kpisAtualizados.totalLeiturasIot -ne 11) { throw 'Leitura não criada' }
    if ((Invoke-RestMethod "$productionUrl/api/kpis").totalLeiturasIot -ne 10) { throw 'Produção compartilhou dados com staging' }
    Stop-Process -Id $stagingProcess.Id
    $stagingProcess.WaitForExit()
    $restartedProcess = Start-App 'staging' $StagingPort
    if ((Invoke-RestMethod "$stagingUrl/api/kpis").totalLeiturasIot -ne 11) { throw 'Persistência após reinício falhou' }
    "Verificado em $((Get-Date).ToString('o')): HTTP 200 em / e /health dos dois processos; versões SHA256 iguais; dados isolados (11/10); persistência após reinício (11). Demonstração local Java, sem Docker ou deploy remoto." |
        Tee-Object -FilePath (Join-Path $evidenceDir 'http-smoke.log')
} finally {
    foreach ($appProcess in $processes) {
        if (-not $appProcess.HasExited) { Stop-Process -Id $appProcess.Id; $appProcess.WaitForExit() }
    }
}
