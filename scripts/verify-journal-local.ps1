param()
$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:8083'
$health = Invoke-RestMethod "$base/health"
if ($health.environment -ne 'postgres-demo') { throw 'Verificação só permitida no ambiente postgres-demo isolado.' }
$projectRoot = Split-Path -Parent $PSScriptRoot
$tokenPath = Join-Path $projectRoot '.tools/secrets/operator_token.txt'
$headers = @{'X-Operator-Key'=[System.IO.File]::ReadAllText($tokenPath).Trim()}
$suffix = [guid]::NewGuid().ToString('N')
function Write-Entry($route,$body) { Invoke-RestMethod "$base$route" -Method Post -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ($body | ConvertTo-Json -Compress) }
$before = (Invoke-RestMethod "$base/api/kpis").totalLeiturasIot
$unauthorized = 0
try { Invoke-RestMethod "$base/api/journal/inventory" -Method Post -ContentType 'application/json' -Body '{}' | Out-Null }
catch { $unauthorized = [int]$_.Exception.Response.StatusCode }
if ($unauthorized -ne 401) { throw 'Escrita sem token não foi bloqueada.' }
$inventory = Write-Entry '/api/journal/inventory' @{
    unit='UNID-HOSP-001';reference="TESTE-TECNICO-GEE-$suffix";responsible='Equipe de testes (demonstracao)';period='2026-09';scope='2';method='LOCATION';
    activity='TESTE SINTETICO - nao representa consumo hospitalar';activityUnit='kWh';quantity='1000';factor='0.123456789';
    factorSource='FATOR SINTETICO exclusivo para testar a multiplicacao, sem validade ambiental';factorVersion='Teste tecnico v1';boundary='Dados ficticios de teste, nao usar em relatorios reais'
}
if ([decimal]$inventory.kgCO2e -ne [decimal]'123.456789') { throw 'Calculo divergente.' }
$duplicate = 0
try { Write-Entry '/api/journal/inventory' @{unit='UNID-HOSP-001';reference=$inventory.reference;responsible='Equipe teste';period='2026-09';scope='2';method='LOCATION';activity='Teste';activityUnit='kWh';quantity='1';factor='1';factorSource='Sintetico';factorVersion='v1';boundary='Teste'} | Out-Null }
catch { $duplicate = [int]$_.Exception.Response.StatusCode }
if ($duplicate -ne 400) { throw 'Duplicata não rejeitada.' }
$void = Write-Entry "/api/journal/inventory/$($inventory.id)/void" @{reason='Encerramento de teste tecnico sintetico - excluir dos totais';responsible='Equipe de testes'}
$waste = Write-Entry '/api/journal/waste' @{unit='UNID-HOSP-001';reference="TESTE-TECNICO-LOTE-$suffix";responsible='Equipe de testes';date='2026-09-28';group='D';kg='12.5';sector='Setor ficticio de teste';handling='Nenhum tratamento real - teste';provider='Prestador ficticio';destination='Destino ficticio'}
if ($waste.documentation -ne 'PENDENTE_COMPROVANTE') { throw 'Pendência documental divergente.' }
Write-Entry "/api/journal/waste/$($waste.id)/void" @{reason='Encerramento de teste sintetico - nenhum residuo real movimentado';responsible='Equipe de testes'} | Out-Null
$action = Write-Entry '/api/actions' @{unit='UNID-HOSP-001';title='DEMONSTRACAO - revisar documentos ambientais e definir fatores de emissao';owner='Equipe ambiental (demonstracao)';due='2026-10-05'}
Invoke-RestMethod "$base/api/actions/$($action.id)" -Method Patch -Headers $headers -ContentType 'application/json' -Body (@{status='EM_ANDAMENTO';evidence='Registro demonstrativo: levantamento de fatores e documentos ainda nao realizado.'} | ConvertTo-Json -Compress) | Out-Null
docker compose -p ecohospital-postgres-demo -f (Join-Path $projectRoot 'docker-compose.postgres.yml') restart app | Out-Null
if ($LASTEXITCODE -ne 0) {throw 'Reinício falhou.'}
$ready = $false
for ($attempt=0;$attempt -lt 60;$attempt++) {
    try { $health = Invoke-RestMethod "$base/health"; if($health.status -eq 'UP') {$ready=$true;break} } catch {}
    Start-Sleep -Seconds 1
}
if (!$ready) {throw 'Health indisponível após reinício.'}
$inventoryRecords = Invoke-RestMethod "$base/api/journal/inventory"
$actionRecords = Invoke-RestMethod "$base/api/actions"
$persisted = $inventoryRecords | Where-Object id -EQ $inventory.id
$task = $actionRecords | Where-Object id -EQ $action.id
$after = (Invoke-RestMethod "$base/api/kpis").totalLeiturasIot
if (!$persisted.voidedAt -or $task.status -ne 'EM_ANDAMENTO' -or $before -ne $after) {throw 'Persistência ou preservação de dados divergente.'}
$result = [ordered]@{at=[DateTime]::UtcNow.ToString('o');environment=$health.environment;storage=(Invoke-RestMethod "$base/api/status").storage;unauthorized=$unauthorized;duplicate=$duplicate;syntheticCalculationKgCO2e=$inventory.kgCO2e;inventoryVoidedAndPersisted=$true;wasteMissingProofDetected=$true;wasteSyntheticVoided=$true;actionPersisted=$true;actionHistoryEntries=$task.history.Count;readingsBefore=$before;readingsAfter=$after;note='Somente teste tecnico sintetico em postgres-demo; nenhum resultado ambiental real comprovado.'}
$result | ConvertTo-Json -Depth 6 | Set-Content -Encoding utf8 (Join-Path $projectRoot 'docs/evidence/v3/journal-smoke.json')
$result | ConvertTo-Json -Depth 6
