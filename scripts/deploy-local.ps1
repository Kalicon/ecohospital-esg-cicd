param(
    [Parameter(Mandatory)][ValidateSet('staging','production')][string]$EnvironmentName,
    [Parameter(Mandatory)][string]$Image,
    [Parameter(Mandatory)][string]$Version
)
$ErrorActionPreference = 'Stop'
if ($Image -notmatch '^ghcr\.io/[a-z0-9_./-]+@sha256:[a-f0-9]{64}$') { throw 'Imagem deve ser uma referência GHCR por digest.' }
if ($Version -notmatch '^[a-f0-9]{40}$') { throw 'Versão deve ser o SHA do commit.' }
$projectRoot = Split-Path -Parent $PSScriptRoot
$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
$dockerBin = if ($dockerCommand) { $dockerCommand.Source } else {
    $candidate = Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin/docker.exe'
    if (-not (Test-Path -LiteralPath $candidate)) { $candidate = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe' }
    if (-not (Test-Path -LiteralPath $candidate)) { throw 'Docker Desktop não está instalado ou não está no PATH.' }
    $candidate
}
$engineType = & $dockerBin info --format '{{.OSType}}'
if ($LASTEXITCODE -ne 0 -or $engineType -ne 'linux') { throw 'Inicie Docker Desktop e aguarde o engine Linux.' }
$port = if ($EnvironmentName -eq 'staging') { 8081 } else { 8082 }
# Keep deploy files outside the runner checkout so subsequent jobs cannot erase them.
$deployDir = Join-Path $env:LOCALAPPDATA "EcoHospital/deploy/$EnvironmentName"
New-Item -ItemType Directory -Force -Path $deployDir | Out-Null
$tokenFile = Join-Path $deployDir 'operator_token.txt'
if (-not [string]::IsNullOrWhiteSpace($env:APP_WRITE_TOKEN)) {
    if ($env:APP_WRITE_TOKEN.Length -lt 32) { throw 'Token de operador precisa ter pelo menos 32 caracteres.' }
    [IO.File]::WriteAllText($tokenFile, $env:APP_WRITE_TOKEN, [Text.UTF8Encoding]::new($false))
    Remove-Item Env:APP_WRITE_TOKEN
} elseif (-not (Test-Path -LiteralPath $tokenFile)) { throw 'Defina APP_WRITE_TOKEN (segredo do ambiente) antes do primeiro deploy.' }
Copy-Item -LiteralPath (Join-Path $projectRoot 'deploy/compose.yml') -Destination (Join-Path $deployDir 'compose.yml')
$env:COMPOSE_PROJECT_NAME = "ecohospital-$EnvironmentName"
$env:APP_ENV = $EnvironmentName
$env:APP_PORT = "$port"
$env:BIND_ADDRESS = '127.0.0.1'
$env:IMAGE = $Image
$env:OPERATOR_TOKEN_FILE = $tokenFile.Replace('\','/')
$configPath = Join-Path $deployDir '.env'
@("COMPOSE_PROJECT_NAME=$($env:COMPOSE_PROJECT_NAME)","APP_ENV=$EnvironmentName","APP_PORT=$port","BIND_ADDRESS=127.0.0.1","IMAGE=$Image","OPERATOR_TOKEN_FILE=$($env:OPERATOR_TOKEN_FILE)") |
    Set-Content -LiteralPath $configPath -Encoding utf8
Push-Location $deployDir
try {
    & $dockerBin compose -f compose.yml pull
    if ($LASTEXITCODE -ne 0) { throw 'Pull da imagem falhou.' }
    & $dockerBin compose -f compose.yml up -d --no-build --wait --wait-timeout 180
    if ($LASTEXITCODE -ne 0) { throw 'Container não ficou saudável.' }
    $baseUrl = "http://localhost:$port"
    $health = Invoke-RestMethod "$baseUrl/health"
    if ($health.status -ne 'UP' -or $health.environment -ne $EnvironmentName -or $health.version -ne $Version) { throw 'Health/versão/ambiente divergente.' }
    $page = Invoke-WebRequest $baseUrl -UseBasicParsing
    if ($page.StatusCode -ne 200 -or $page.Content -notmatch 'EcoHospital Smart') { throw 'Página ESG não disponível.' }
    $evidenceDir = Join-Path $projectRoot 'evidence'
    New-Item -ItemType Directory -Force -Path $evidenceDir | Out-Null
    $health | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $evidenceDir "$EnvironmentName-health.json")
    & $dockerBin compose -f compose.yml ps --format json | Set-Content -Encoding utf8 (Join-Path $evidenceDir "$EnvironmentName-containers.json")
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao registrar containers.' }
    Write-Output "Deploy local concluído: $baseUrl | $EnvironmentName | $Version"
} finally { Pop-Location }
