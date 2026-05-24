param([string]$File = "src\components\ForgottenlandGame.tsx")
$base = Join-Path $PSScriptRoot $File
if (!(Test-Path $base)) { Write-Host "File not found: $base"; exit 1 }
$backupDir = Join-Path $PSScriptRoot "backups"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$name = [System.IO.Path]::GetFileNameWithoutExtension($base)
$ext = [System.IO.Path]::GetExtension($base)
$dest = Join-Path $backupDir "${name}_${stamp}${ext}"
Copy-Item $base $dest
Write-Host "Backup saved: $dest"
