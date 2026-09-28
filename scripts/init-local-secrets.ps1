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
