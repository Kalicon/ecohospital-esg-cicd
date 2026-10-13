param([string]$OutputName = 'EcoHospital_CICD.zip', [string]$RootFolder = '')
$ErrorActionPreference = 'Stop'
if ($OutputName -notmatch '^EcoHospital_CICD([a-zA-Z0-9_-]*)?\.zip$') { throw 'Nome de ZIP inválido' }
if ($RootFolder -and $RootFolder -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]*$') { throw 'Nome da pasta raiz inválido' }
$projectRoot = Split-Path -Parent $PSScriptRoot
$deliveryDir = Join-Path $projectRoot 'delivery'
New-Item -ItemType Directory -Force -Path $deliveryDir | Out-Null
$zipPath = Join-Path $deliveryDir $OutputName
if (Test-Path -LiteralPath $zipPath) { throw 'O ZIP já existe. Renomeie/mova a versão anterior antes de gerar outra.' }
$requiredFiles = @('pom.xml','Dockerfile','.dockerignore','docker-compose.yml','docker-compose.postgres.yml','deploy/compose-pc.yml','.env.example',
    'README.md','mvnw','mvnw.cmd','.gitignore','.gitattributes','docs/EcoHospital_CICD.pdf')
foreach ($relative in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot $relative))) { throw "Arquivo obrigatório ausente: $relative" }
}
$fileEntries = [System.Collections.Generic.List[System.IO.FileInfo]]::new()
foreach ($relative in @('pom.xml','Dockerfile','.dockerignore','docker-compose.yml','docker-compose.postgres.yml','.env.example','README.md','mvnw','mvnw.cmd','.gitignore','.gitattributes')) {
    $fileEntries.Add((Get-Item -LiteralPath (Join-Path $projectRoot $relative)))
}
foreach ($folder in @('.github','.mvn','src','public','data','deploy','scripts','docs')) {
    foreach ($entry in Get-ChildItem -LiteralPath (Join-Path $projectRoot $folder) -Recurse -File -Force) {
        $name = $entry.Name
        if ($name -eq '.env' -or ($name -match '\.env$') -or ($name -like '.env.*' -and $name -ne '.env.example') `
            -or $name -match '\.(pem|key|pfx|p12)$' -or $entry.FullName -match '[\\/]__pycache__[\\/]' `
            -or $entry.FullName -match '[\\/]deploy[\\/]import[\\/].*\.json$') { continue }
        $fileEntries.Add($entry)
    }
}
Add-Type -AssemblyName System.IO.Compression
$stream = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::CreateNew)
$archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create)
$manifest = [System.Collections.Generic.List[string]]::new()
try {
    foreach ($entry in ($fileEntries | Sort-Object FullName)) {
        $relative = [System.IO.Path]::GetRelativePath($projectRoot, $entry.FullName).Replace('\','/')
        $archiveName = if ($RootFolder) { "$RootFolder/$relative" } else { $relative }
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $entry.FullName, $archiveName, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
        $sha = (Get-FileHash -LiteralPath $entry.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        $manifest.Add("$sha  $archiveName")
    }
    $manifestName = if ($RootFolder) { "$RootFolder/MANIFEST-SHA256.txt" } else { 'MANIFEST-SHA256.txt' }
    $manifestEntry = $archive.CreateEntry($manifestName)
    $writer = [System.IO.StreamWriter]::new($manifestEntry.Open(), [System.Text.UTF8Encoding]::new($false))
    try { foreach ($line in $manifest) { $writer.WriteLine($line) } } finally { $writer.Dispose() }
} finally { $archive.Dispose(); $stream.Dispose() }
$manifest | Set-Content -Encoding utf8 (Join-Path $deliveryDir 'MANIFEST-SHA256.txt')
$zipHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
"$zipHash  $OutputName" | Set-Content -Encoding utf8 (Join-Path $deliveryDir "$OutputName.sha256")
Write-Output "ZIP criado: $zipPath"
Write-Output "Arquivos: $($fileEntries.Count) + manifesto; SHA256: $zipHash"
