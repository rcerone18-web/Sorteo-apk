#Requires -Version 5.1
<#
.SYNOPSIS
  Arregla el error: "adb no se reconoce..." en PowerShell.
  - Encuentra adb.exe (Android SDK platform-tools).
  - Lo agrega al PATH SOLO para esta sesion.
  - Reinicia ADB y lista dispositivos.

  Uso:
    cd C:\Users\renec\Desktop\Sorteo-apk
    .\scripts\fix-android-adb.ps1
#>

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

function Find-Adb {
  # 1) Si ya existe en PATH
  $cmd = Get-Command adb.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  # 2) Rutas tipicas
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'),
    (Join-Path $env:USERPROFILE 'AppData\Local\Android\Sdk\platform-tools\adb.exe')
  ) | Where-Object { $_ -and (Test-Path $_) }

  if ($candidates.Count -gt 0) { return $candidates[0] }

  # 3) Buscar dentro del SDK si existe
  $sdkRoot = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
  if (Test-Path $sdkRoot) {
    $found = Get-ChildItem -Path $sdkRoot -Recurse -Filter adb.exe -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($found) { return $found.FullName }
  }

  return $null
}

$adbExe = Find-Adb
if (-not $adbExe) {
  Write-Host 'ERROR: No pude encontrar adb.exe.' -ForegroundColor Red
  Write-Host 'Instala Android SDK Platform-Tools o Android Studio.' -ForegroundColor Yellow
  Write-Host 'Luego reintenta. Ruta tipica:' -ForegroundColor Yellow
  Write-Host '  %LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe' -ForegroundColor Cyan
  exit 1
}

$adbDir = Split-Path -Parent $adbExe
if ($env:PATH -notlike "*$adbDir*") {
  $env:PATH = "$adbDir;$env:PATH"
}

Write-Host ("ADB encontrado: {0}" -f $adbExe) -ForegroundColor Green
Write-Host 'Reiniciando ADB...' -ForegroundColor DarkGray

& $adbExe kill-server | Out-Null
& $adbExe start-server | Out-Null

Write-Host 'Dispositivos ADB:' -ForegroundColor DarkGray
& $adbExe devices

Write-Host ''
Write-Host 'Si el emulador aparece como "offline":' -ForegroundColor Yellow
Write-Host '  1) Cierra el emulador.' -ForegroundColor Yellow
Write-Host '  2) Ejecuta de nuevo este script.' -ForegroundColor Yellow
Write-Host '  3) Inicia el emulador desde Android Studio > Device Manager.' -ForegroundColor Yellow

