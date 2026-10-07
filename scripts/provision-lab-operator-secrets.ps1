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
    $usersPath = Join-Path $secretDir "$environmentName-users.json"
    if (-not (Test-Path -LiteralPath $usersPath)) {
        $users = @(
            [pscustomobject]@{id="$environmentName-operator";role='OPERATOR';token=[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()},
            [pscustomobject]@{id="$environmentName-reviewer";role='REVIEWER';token=[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()},
            [pscustomobject]@{id="$environmentName-admin";role='ADMIN';token=[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()}
        )
        [IO.File]::WriteAllText($usersPath, ($users | ConvertTo-Json -Depth 4 -Compress), [Text.UTF8Encoding]::new($false))
    }
    if ($PublishToGitHub) {
        Get-Content -LiteralPath $usersPath -Raw | & gh secret set APP_USERS_JSON --env $environmentName --repo $repo
        if ($LASTEXITCODE -ne 0) { throw "Falha ao configurar APP_USERS_JSON de $environmentName no GitHub." }
        Write-Output "Segredo APP_USERS_JSON de $environmentName registrado no GitHub; valor não exibido."
    } else {
        Write-Output "Credenciais individuais de $environmentName salvas em $usersPath; valores não exibidos."
    }
}
