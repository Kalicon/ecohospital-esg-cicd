$ErrorActionPreference = 'Stop'
$secretDir = Join-Path (Split-Path -Parent $PSScriptRoot) '.tools/secrets'
New-Item -ItemType Directory -Force -Path $secretDir | Out-Null
foreach ($name in @('postgres_password', 'operator_token')) {
    $path = Join-Path $secretDir "$name.txt"
    if (-not (Test-Path -LiteralPath $path)) {
        $value = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()
        [IO.File]::WriteAllText($path, $value, [Text.UTF8Encoding]::new($false))
    }
    Write-Output "$name salvo em $path (conteúdo não exibido)"
}
$usersPath = Join-Path $secretDir 'operator_users.json'
if (-not (Test-Path -LiteralPath $usersPath)) {
    $users = @(
        [pscustomobject]@{id='operador-demo';role='OPERATOR';token=[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()},
        [pscustomobject]@{id='revisor-demo';role='REVIEWER';token=[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()},
        [pscustomobject]@{id='admin-demo';role='ADMIN';token=[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()}
    )
    [IO.File]::WriteAllText($usersPath, ($users | ConvertTo-Json -Depth 4), [Text.UTF8Encoding]::new($false))
}
Write-Output "operator_users salvo em $usersPath (conteúdo não exibido)"
