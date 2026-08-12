#Requires -Version 5.1
<#
.SYNOPSIS
  Aplica migración 005_probability_engine_v2.sql (motor probabilidades v2).
  Uso: .\scripts\apply-migration-005.ps1
#>
[CmdletBinding()]
param(
  [string] $Database = 'sorteo_db',
  [string] $User = 'root'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$sqlFile = Join-Path $repoRoot 'server\sql\migrations\005_probability_engine_v2.sql'

$mysql = Get-Command mysql.exe -ErrorAction SilentlyContinue
if (-not $mysql) {
  $laragon = 'C:\laragon\bin\mysql'
  if (Test-Path $laragon) {
    $found = Get-ChildItem -Path $laragon -Recurse -Filter 'mysql.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { $mysql = $found.FullName }
  }
}
if (-not $mysql) { Write-Error 'mysql.exe no encontrado'; exit 1 }

Write-Host "Aplicando: $sqlFile" -ForegroundColor Cyan
Get-Content -Path $sqlFile -Raw -Encoding UTF8 | & $mysql -u $User --default-character-set=utf8mb4 $Database
if ($LASTEXITCODE -ne 0) { throw "mysql exit $LASTEXITCODE" }
Write-Host 'OK: migración 005 aplicada.' -ForegroundColor Green
