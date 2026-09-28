param(
    [ValidateSet('Prepare','Start')][string]$Mode = 'Prepare',
    [ValidateSet('staging','production')][string]$EnvironmentName = 'staging'
)
$ErrorActionPreference = 'Stop'
$repo = 'Kalicon/ecohospital-esg-cicd'
$projectRoot = Split-Path -Parent $PSScriptRoot
$toolsDir = Join-Path $projectRoot '.tools/actions-runner'
New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
if ($Mode -eq 'Prepare') {
    $releaseJson = & gh api repos/actions/runner/releases/latest
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível consultar a release oficial do runner.' }
    $release = $releaseJson | ConvertFrom-Json
    $asset = $release.assets | Where-Object name -Match '^actions-runner-win-x64-[0-9.]+\.zip$' | Select-Object -First 1
    if (-not $asset -or $asset.digest -notmatch '^sha256:[a-f0-9]{64}$') { throw 'Asset/checksum oficial ausente.' }
    $archive = Join-Path $toolsDir $asset.name
    if (-not (Test-Path -LiteralPath $archive)) { Invoke-WebRequest $asset.browser_download_url -OutFile $archive }
    $hash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    if ('sha256:' + $hash -ne $asset.digest) { throw 'Checksum inválido; runner não será executado.' }
    foreach ($name in @('staging','production')) {
        $runnerDir = Join-Path $toolsDir $name
        if (-not (Test-Path -LiteralPath (Join-Path $runnerDir 'config.cmd'))) { Expand-Archive -LiteralPath $archive -DestinationPath $runnerDir }
    }
    Write-Output "Runner oficial $($release.tag_name) preparado; SHA256=$hash"
    exit 0
}
$runnerDir = Join-Path $toolsDir $EnvironmentName
if (-not (Test-Path -LiteralPath (Join-Path $runnerDir 'config.cmd'))) { throw 'Execute -Mode Prepare primeiro.' }
if (Test-Path -LiteralPath (Join-Path $runnerDir '.runner')) { throw 'Runner já configurado: verifique seu estado antes de registrar novamente.' }
$login = & gh api user --jq .login
if ($LASTEXITCODE -ne 0 -or $login -ne 'Kalicon') { throw 'Autentique a conta Kalicon no gh; token não deve ser impresso.' }
$registrationToken = & gh api --method POST "repos/$repo/actions/runners/registration-token" --jq .token
if ($LASTEXITCODE -ne 0 -or -not $registrationToken) { throw 'Falha ao obter token temporário do runner.' }
Push-Location $runnerDir
try {
    & .\config.cmd --unattended --ephemeral --url "https://github.com/$repo" --token $registrationToken --name "ecohospital-$EnvironmentName-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())" --labels ecohospital-lab --work _work
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao registrar runner efêmero.' }
    $process = Start-Process -FilePath "$env:SystemRoot\System32\cmd.exe" -ArgumentList '/d','/c','run.cmd' -WorkingDirectory $runnerDir -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runnerDir 'run-output.log') -RedirectStandardError (Join-Path $runnerDir 'run-error.log')
    Write-Output "Runner efêmero iniciado para um job confiável; PID=$($process.Id). Logs locais em $runnerDir."
} finally { $registrationToken = $null; Pop-Location }
