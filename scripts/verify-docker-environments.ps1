param([Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{40}$')][string]$Version)
$ErrorActionPreference = 'Stop'
$evidenceDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'docs/evidence/pc'
New-Item -ItemType Directory -Force -Path $evidenceDir | Out-Null
$containers = @()
foreach ($environmentName in @('staging','production')) {
    $port = if ($environmentName -eq 'staging') { 8081 } else { 8082 }
    $health = Invoke-RestMethod "http://localhost:$port/health"
    if ($health.status -ne 'UP' -or $health.environment -ne $environmentName -or $health.version -ne $Version) { throw "Health incorreto: $environmentName" }
    $health | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $evidenceDir "$environmentName-health.json")
    $page = Invoke-WebRequest "http://localhost:$port" -UseBasicParsing
    if ($page.StatusCode -ne 200 -or $page.Content -notmatch 'EcoHospital Smart') { throw "Página indisponível: $environmentName" }
    $containerId = & docker ps --filter "label=com.docker.compose.project=ecohospital-$environmentName" --filter 'label=com.docker.compose.service=app' --format '{{.ID}}'
    if ($LASTEXITCODE -ne 0 -or @($containerId).Count -ne 1 -or -not $containerId) { throw "Container único não encontrado: $environmentName" }
    $inspectJson = & docker inspect $containerId
    if ($LASTEXITCODE -ne 0) { throw 'docker inspect falhou' }
    $container = ($inspectJson | ConvertFrom-Json)[0]
    $uid = & docker exec $containerId id -u
    if ($LASTEXITCODE -ne 0 -or $uid -ne '10001') { throw 'Container não executa com UID 10001' }
    if (-not $container.HostConfig.ReadonlyRootfs -or $container.State.Health.Status -ne 'healthy') { throw 'Hardening/healthcheck inválido' }
    $volume = @($container.Mounts | Where-Object Destination -eq '/app/data')[0]
    if ($volume.Type -ne 'volume' -or $volume.Name -ne "ecohospital-${environmentName}_esg-data") { throw 'Volume inesperado' }
    $networks = @($container.NetworkSettings.Networks.PSObject.Properties.Name)
    if ($networks -notcontains "ecohospital-${environmentName}_esg-network") { throw 'Rede inesperada' }
    $containers += [pscustomobject]@{environment=$environmentName;id=$containerId;image=$container.Config.Image;imageId=$container.Image;uid=$uid;health=$container.State.Health.Status;volume=$volume.Name;networks=$networks;port=$port}
}
if ($containers[0].image -ne $containers[1].image -or $containers[0].imageId -ne $containers[1].imageId) { throw 'Ambientes não usam a mesma imagem' }
$stagingBefore = (Invoke-RestMethod 'http://localhost:8081/api/kpis').totalLeiturasIot
$productionBefore = (Invoke-RestMethod 'http://localhost:8082/api/kpis').totalLeiturasIot
Invoke-RestMethod -Method Post 'http://localhost:8081/api/telemetria/simular' -ContentType 'application/json' -Body '{}' | Out-Null
$stagingAfter = (Invoke-RestMethod 'http://localhost:8081/api/kpis').totalLeiturasIot
$productionAfter = (Invoke-RestMethod 'http://localhost:8082/api/kpis').totalLeiturasIot
if ($stagingAfter -ne $stagingBefore + 1 -or $productionAfter -ne $productionBefore) { throw 'Isolamento de dados falhou' }
# Reinicia somente o container staging identificado, sem apagar ou restaurar seus dados.
& docker restart $containers[0].id | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Reinício de staging falhou' }
$restartHealth = $null
for ($attempt=0; $attempt -lt 60; $attempt++) {
    try { $restartHealth = Invoke-RestMethod 'http://localhost:8081/health'; break } catch { Start-Sleep -Seconds 2 }
}
if (-not $restartHealth -or $restartHealth.version -ne $Version) { throw 'Staging não voltou após reinício' }
$persistedCount = (Invoke-RestMethod 'http://localhost:8081/api/kpis').totalLeiturasIot
if ($persistedCount -ne $stagingAfter) { throw 'Persistência de staging falhou' }
$result = [pscustomobject]@{verifiedAt=[DateTimeOffset]::UtcNow.ToString('o');version=$Version;containers=$containers;stagingBefore=$stagingBefore;stagingAfter=$stagingAfter;stagingAfterRestart=$persistedCount;productionBefore=$productionBefore;productionAfter=$productionAfter;isolationVerified=$true;persistenceVerified=$true}
$result | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 (Join-Path $evidenceDir 'docker-isolation-persistence.json')
& docker ps --format '{{.Names}} | {{.Image}} | {{.Status}} | {{.Ports}}' | Set-Content -Encoding utf8 (Join-Path $evidenceDir 'docker-ps.txt')
if ($LASTEXITCODE -ne 0) { throw 'Falha ao guardar inventário Docker' }
$result | ConvertTo-Json -Depth 8
