param([switch]$PublishToGitHub)
$ErrorActionPreference = 'Stop'
$repo = 'Kalicon/ecohospital-esg-cicd'
$secretDir = Join-Path $env:LOCALAPPDATA 'EcoHospital/operator-keys'
New-Item -ItemType Directory -Force -Path $secretDir | Out-Null
if ($PublishToGitHub -and -not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw 'GitHub CLI (gh) não encontrado.'
}
foreach ($environmentName in @('staging', 'production')) {
    $path = Join-Path $secretDir "$environmentName.txt"
    if (-not (Test-Path -LiteralPath $path)) {
        $token = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()
        [IO.File]::WriteAllText($path, $token, [Text.UTF8Encoding]::new($false))
    }
    if ($PublishToGitHub) {
        Get-Content -LiteralPath $path -Raw | & gh secret set APP_WRITE_TOKEN --env $environmentName --repo $repo
        if ($LASTEXITCODE -ne 0) { throw "Falha ao configurar segredo de $environmentName no GitHub." }
        Write-Output "Segredo APP_WRITE_TOKEN de $environmentName registrado no GitHub; valor não exibido."
    } else {
        Write-Output "Token de $environmentName salvo em $path; valor não exibido."
    }
}
