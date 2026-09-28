param([ValidateSet('Prepare','EnableWsl','InstallDocker')][string]$Mode = 'Prepare')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$setupDir = Join-Path $projectRoot '.tools/setup'
New-Item -ItemType Directory -Force -Path $setupDir | Out-Null
$installerPath = Join-Path $setupDir 'Docker Desktop Installer.exe'
if ($Mode -eq 'Prepare') {
    if (-not (Test-Path -LiteralPath $installerPath)) {
        Invoke-WebRequest 'https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe' -OutFile $installerPath
    }
    $signature = Get-AuthenticodeSignature -LiteralPath $installerPath
    if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Docker') {
        throw 'Assinatura do instalador Docker não pôde ser validada.'
    }
    Write-Output "Instalador Docker oficial verificado: $installerPath"
    Write-Output ('SHA256=' + (Get-FileHash -LiteralPath $installerPath -Algorithm SHA256).Hash)
    exit 0
}
if ($Mode -eq 'EnableWsl') {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Execute este modo como administrador. Nenhuma reinicialização automática será feita.'
    }
    $log = Join-Path $setupDir 'enable-wsl.log'
    foreach ($feature in @('Microsoft-Windows-Subsystem-Linux','VirtualMachinePlatform')) {
        & dism.exe /online /enable-feature "/featurename:$feature" /all /norestart 2>&1 | Tee-Object -FilePath $log -Append
        if ($LASTEXITCODE -notin @(0,3010)) { throw "Falha ao habilitar $feature, código $LASTEXITCODE" }
    }
    & wsl.exe --install --no-distribution --web-download 2>&1 | Tee-Object -FilePath $log -Append
    Write-Output "Recursos preparados. Consulte $log. Se solicitado pelo Windows, reinicie manualmente antes de iniciar Docker."
    exit 0
}
if (-not (Test-Path -LiteralPath $installerPath)) { throw 'Execute -Mode Prepare primeiro.' }
$signature = Get-AuthenticodeSignature -LiteralPath $installerPath
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Docker') { throw 'Instalador sem assinatura válida.' }
$installProcess = Start-Process -FilePath $installerPath -ArgumentList 'install','--user','--quiet','--backend=wsl-2' -PassThru -Wait -WindowStyle Hidden
if ($installProcess.ExitCode -ne 0) { throw "Instalador Docker retornou $($installProcess.ExitCode)." }
Write-Output 'Docker instalado para o usuário. Abra Docker Desktop, leia/aceite os termos se concordar e conclua o WSL quando solicitado.'
