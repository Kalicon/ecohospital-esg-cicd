param(
    [ValidateRange(1, 65535)][int]$StagingPort = 18081,
    [ValidateRange(1, 65535)][int]$ProductionPort = 18082
)

$ErrorActionPreference = 'Stop'
if ($StagingPort -eq $ProductionPort) { throw 'Staging e produção precisam de portas diferentes.' }

$projectRoot = Split-Path -Parent $PSScriptRoot
$javaBin = if ($env:JAVA_HOME) { Join-Path $env:JAVA_HOME 'bin/java.exe' } else { (Get-Command java).Source }
$jarPath = Join-Path $projectRoot 'target/esg-app.jar'
if (-not (Test-Path -LiteralPath $jarPath)) { throw 'Execute scripts/verify.ps1 antes.' }

# Cada execução usa apenas arquivos novos; snapshots e evidências anteriores nunca são restaurados ou sobrescritos.
$runId = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssfffZ') + '-' + [guid]::NewGuid().ToString('N')
$runtimeRoot = Join-Path $projectRoot '.runtime/smoke-runs'
$runDir = Join-Path $runtimeRoot $runId
$storageDir = Join-Path $runDir 'storage'
$evidenceDir = Join-Path $runDir 'evidence'
New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null
New-Item -ItemType Directory -Path $runDir, $storageDir, $evidenceDir | Out-Null

$appVersion = (Get-FileHash -LiteralPath $jarPath -Algorithm SHA256).Hash.ToLowerInvariant()

# O segredo não entra na linha de comando nem nos arquivos de evidência. Os processos Java herdam
# esta variável temporariamente; valores anteriores da sessão são restaurados no finally.
$previousEnvironment = @{}
foreach ($name in @('APP_WRITE_TOKEN', 'APP_WRITE_TOKEN_FILE', 'APP_USERS_FILE')) {
    $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
$tokenBytes = New-Object byte[] 48
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($tokenBytes) } finally { $rng.Dispose() }
$operatorToken = [Convert]::ToBase64String($tokenBytes)
[Environment]::SetEnvironmentVariable('APP_WRITE_TOKEN', $operatorToken, 'Process')
[Environment]::SetEnvironmentVariable('APP_WRITE_TOKEN_FILE', $null, 'Process')
[Environment]::SetEnvironmentVariable('APP_USERS_FILE', $null, 'Process')
$operatorHeaders = @{ 'X-Operator-Key' = $operatorToken }

function Save-Evidence([object]$Value, [string]$Name) {
    $Value | ConvertTo-Json -Depth 32 | Set-Content -LiteralPath (Join-Path $evidenceDir $Name) -Encoding utf8
}

function Get-StableKpis([object]$Kpis) {
    $stable = [ordered]@{}
    foreach ($property in $Kpis.PSObject.Properties) {
        # Tempo de processo avança sem que os dados ESG tenham mudado.
        if ($property.Name -ne 'uptimeSeconds') { $stable[$property.Name] = $property.Value }
    }
    return $stable
}

function Start-App([string]$EnvironmentName, [int]$PortNumber, [string]$RunLabel) {
    if (Get-NetTCPConnection -State Listen -LocalPort $PortNumber -ErrorAction SilentlyContinue) {
        throw "Porta ocupada: $PortNumber. Nenhum processo alheio será encerrado."
    }
    $storagePath = Join-Path $storageDir "$EnvironmentName.json"
    $argsList = @('-jar', ('"' + $jarPath + '"'), "--server.port=$PortNumber",
        "--app.environment=$EnvironmentName", "--app.version=$appVersion",
        '--app.storage=json', '--app.allow-production-reset=false',
        '--app.write-token-file=', '--app.users-file=',
        ('--app.storage-file="' + $storagePath + '"'))
    $appProcess = Start-Process -FilePath $javaBin -ArgumentList $argsList -PassThru -WindowStyle Hidden -WorkingDirectory $projectRoot `
        -RedirectStandardOutput (Join-Path $evidenceDir "$RunLabel-server.log") `
        -RedirectStandardError (Join-Path $evidenceDir "$RunLabel-server-error.log")
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if ($appProcess.HasExited) { throw "Aplicação $EnvironmentName encerrou antecipadamente; consulte $evidenceDir" }
        try {
            $response = Invoke-RestMethod "http://localhost:$PortNumber/health"
            if ($response.status -eq 'UP') { return $appProcess }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    throw "Timeout $EnvironmentName; consulte $evidenceDir"
}

function Stop-OwnedApp([int]$PortNumber) {
    $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $PortNumber -ErrorAction SilentlyContinue)
    if ($listeners.Count -eq 0) { throw "Aplicação de teste não encontrada na porta $PortNumber." }
    foreach ($listener in $listeners) {
        $candidate = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
        if ($null -eq $candidate -or $candidate.Name -ne 'java.exe' -or
            $null -eq $candidate.CommandLine -or
            $candidate.CommandLine.IndexOf($runDir, [StringComparison]::OrdinalIgnoreCase) -lt 0) {
            throw "Processo da porta $PortNumber não pertence a esta execução; não será encerrado."
        }
        Stop-Process -Id $candidate.ProcessId -ErrorAction Stop
        Wait-Process -Id $candidate.ProcessId -Timeout 10 -ErrorAction SilentlyContinue
    }
}

try {
    $stagingProcess = Start-App 'staging' $StagingPort 'staging-initial'
    $productionProcess = Start-App 'production' $ProductionPort 'production'

    foreach ($entry in @(@{ Name = 'staging'; Port = $StagingPort }, @{ Name = 'production'; Port = $ProductionPort })) {
        $baseUrl = "http://localhost:$($entry.Port)"
        $health = Invoke-RestMethod "$baseUrl/health"
        if ($health.environment -ne $entry.Name -or $health.version -ne $appVersion) { throw 'Ambiente/versão divergente.' }
        Save-Evidence $health "$($entry.Name)-health.json"
        $pageResponse = Invoke-WebRequest $baseUrl -UseBasicParsing
        if ($pageResponse.StatusCode -ne 200 -or $pageResponse.Content -notmatch 'EcoHospital Smart') { throw 'Frontend inválido.' }
        Save-Evidence (Invoke-RestMethod "$baseUrl/api/status") "$($entry.Name)-status.json"
    }

    $stagingUrl = "http://localhost:$StagingPort"
    $productionUrl = "http://localhost:$ProductionPort"
    $stagingBefore = Invoke-RestMethod "$stagingUrl/api/kpis"
    $productionBefore = Invoke-RestMethod "$productionUrl/api/kpis"

    $reading = Invoke-RestMethod "$stagingUrl/api/telemetria/simular" -Method Post -Headers $operatorHeaders `
        -ContentType 'application/json' -Body '{"codigo_fonte":"FONTE-CALD-01"}'
    $expectedReadings = [int]$stagingBefore.totalLeiturasIot + 1
    if ([int]$reading.kpisAtualizados.totalLeiturasIot -ne $expectedReadings) { throw 'Leitura de staging não criada.' }
    Save-Evidence $reading 'staging-simulation.json'

    # A requisição é intencionalmente negada. Mesmo com credencial, produção não pode restaurar o seed.
    $resetStatusCode = $null
    try {
        $null = Invoke-RestMethod "$productionUrl/api/reset" -Method Post -Headers $operatorHeaders
        throw 'Reset de produção foi aceito; a proteção falhou.'
    } catch {
        if ($null -eq $_.Exception.Response) { throw }
        $resetStatusCode = [int]$_.Exception.Response.StatusCode
    }
    if ($resetStatusCode -ne 403) { throw "Reset de produção retornou HTTP $resetStatusCode, esperado 403." }
    $productionAfter = Invoke-RestMethod "$productionUrl/api/kpis"
    $stableBefore = Get-StableKpis $productionBefore
    $stableAfter = Get-StableKpis $productionAfter
    if ((ConvertTo-Json -InputObject $stableBefore -Depth 32 -Compress) -ne
        (ConvertTo-Json -InputObject $stableAfter -Depth 32 -Compress)) {
        throw 'Estado de produção mudou após reset negado.'
    }
    Save-Evidence @{ resetStatus = $resetStatusCode; ignoredVolatileField = 'uptimeSeconds'; before = $stableBefore; after = $stableAfter } 'production-reset-denied.json'

    Stop-OwnedApp $StagingPort
    $null = Start-App 'staging' $StagingPort 'staging-restart'
    $stagingAfterRestart = Invoke-RestMethod "$stagingUrl/api/kpis"
    if ([int]$stagingAfterRestart.totalLeiturasIot -ne $expectedReadings) { throw 'Persistência de staging após reinício falhou.' }
    Save-Evidence @{ before = $stagingBefore; afterRestart = $stagingAfterRestart } 'staging-restart.json'

    $summary = "Verificado em $((Get-Date).ToString('o')): staging e produção HTTP 200 em / e /health; versão SHA256 $appVersion; staging $($stagingBefore.totalLeiturasIot)->$expectedReadings leituras e persistência após reinício; produção /api/reset HTTP 403 e estado inalterado. Demonstração Java local, sem Docker ou deploy remoto. Evidências: $evidenceDir"
    $summary | Tee-Object -FilePath (Join-Path $evidenceDir 'http-smoke.log')
} finally {
    try {
        # Start-Process pode devolver um lançador já encerrado; confirme o comando dos Java vivos.
        foreach ($candidate in @(Get-CimInstance Win32_Process -Filter "Name = 'java.exe'")) {
            if ($null -ne $candidate.CommandLine -and
                $candidate.CommandLine.IndexOf($runDir, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
                Stop-Process -Id $candidate.ProcessId -ErrorAction SilentlyContinue
                Wait-Process -Id $candidate.ProcessId -Timeout 10 -ErrorAction SilentlyContinue
            }
        }
    } finally {
        foreach ($name in $previousEnvironment.Keys) {
            [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name], 'Process')
        }
        $operatorHeaders.Clear()
        $operatorToken = $null
        [Array]::Clear($tokenBytes, 0, $tokenBytes.Length)
    }
}
