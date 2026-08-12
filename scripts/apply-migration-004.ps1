#Requires -Version 5.1
<#
.SYNOPSIS
  Aplica la migración 004_campanas_param_avanzados.sql en MySQL.
  - Encuentra mysql.exe (PATH o Laragon).
  - Pide la contraseña una sola vez.

  Uso (desde la raíz del repo Sorteo-apk):
    .\scripts\apply-migration-004.ps1

  Opcional:
    .\scripts\apply-migration-004.ps1 -Database otra_bd -User root
    .\scripts\apply-migration-004.ps1 -File server\sql\migrations\004_campanas_param_avanzados.sql
#>
[CmdletBinding()]
param(
  [string] $Database = 'sorteo_db',
  [string] $User = 'root',
  [string] $File = 'server\sql\migrations\004_campanas_param_avanzados.sql'
)

$ErrorActionPreference = 'Stop'
try {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
} catch { }

function Get-MysqlExe {
  $cmd = Get-Command mysql.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $laragonRoot = 'C:\laragon\bin\mysql'
  if (Test-Path $laragonRoot) {
    $found = Get-ChildItem -Path $laragonRoot -Recurse -Filter 'mysql.exe' -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($found) { return $found.FullName }
  }
  return $null
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$sqlFile = Join-Path $repoRoot $File

if (-not (Test-Path $sqlFile)) {
  Write-Error "No se encuentra: $sqlFile"
  exit 1
}

$mysql = Get-MysqlExe
if (-not $mysql) {
  Write-Host 'ERROR: mysql.exe no encontrado.' -ForegroundColor Red
  Write-Host '  - Anade MySQL al PATH, o instala Laragon (C:\laragon\bin\mysql\...).' -ForegroundColor Yellow
  Write-Host '  - O ejecuta manualmente en HeidiSQL el archivo:' -ForegroundColor Yellow
  Write-Host "    $sqlFile" -ForegroundColor Cyan
  exit 1
}

Write-Host "MySQL : $mysql" -ForegroundColor DarkGray
Write-Host "Base  : $Database" -ForegroundColor DarkGray
Write-Host "Script: $sqlFile" -ForegroundColor DarkGray
Write-Host 'Se pedira la contrasena de MySQL una vez...' -ForegroundColor Yellow
Write-Host ''

try {
  $sql = Get-Content -Path $sqlFile -Raw -Encoding UTF8
  $sql | & $mysql -u $User -p --default-character-set=utf8mb4 $Database
  if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) {
    throw "mysql salio con codigo $LASTEXITCODE"
  }
  Write-Host ''
  Write-Host 'OK: migracion 004 aplicada.' -ForegroundColor Green
  Write-Host 'Reinicia el servidor Node si estaba en marcha:' -ForegroundColor DarkGray
  Write-Host '  cd server; npm run build; npm run dev' -ForegroundColor DarkGray
  exit 0
}
catch {
  Write-Host ''
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host 'Comprueba usuario, contrasena y que la base exista.' -ForegroundColor Yellow
  Write-Host 'Alternativa: abre en HeidiSQL el archivo y ejecutalo:' -ForegroundColor Yellow
  Write-Host "  $sqlFile" -ForegroundColor Cyan
  exit 1
}
