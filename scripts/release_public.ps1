param(
  [string]$SshHost = "111.229.16.93",
  [string]$SshUser = "ubuntu",
  [int]$SshPort = 22,
  [string]$PemPath = "C:\Users\Rongkang PEI\Downloads\Travelologitst (1).pem",
  [string]$AppUrl = "http://111.229.16.93:8000",
  [string]$NodeDir = "",
  [switch]$SkipLint,
  [switch]$SkipBuild,
  [switch]$SkipRegression
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$frontendRoot = Join-Path $projectRoot "frontend"
$deployScript = Join-Path $projectRoot "scripts\deploy_ubuntu.ps1"
$tempRoot = Join-Path $projectRoot ".tmp"
$tempKeyPath = Join-Path $tempRoot "deploy_key.pem"

if (-not $NodeDir) {
  $NodeDir = Join-Path $projectRoot ".tools\node-v24.13.0-win-x64"
}

$npmCmd = Join-Path $NodeDir "npm.cmd"
if (-not (Test-Path $npmCmd)) {
  throw "Missing npm.cmd at $npmCmd"
}

if (-not (Test-Path $PemPath)) {
  throw "Missing PEM file at $PemPath"
}

Write-Host "Using Node toolchain:" $NodeDir
Write-Host "Target host:" "$SshUser@$SshHost`:$SshPort"

if (-not $SkipLint) {
  Write-Host "Running frontend lint ..."
  & $npmCmd --prefix $frontendRoot run lint
  if ($LASTEXITCODE -ne 0) {
    throw "frontend lint failed."
  }
}

if (-not $SkipBuild) {
  Write-Host "Running frontend build ..."
  & $npmCmd --prefix $frontendRoot run build
  if ($LASTEXITCODE -ne 0) {
    throw "frontend build failed."
  }
}

New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
Copy-Item -Path $PemPath -Destination $tempKeyPath -Force

try {
  Write-Host "Deploying latest remote branch commit ..."
  & powershell -ExecutionPolicy Bypass -File $deployScript `
    -SshHost $SshHost `
    -SshUser $SshUser `
    -SshPort $SshPort `
    -KeyPath $tempKeyPath

  if ($LASTEXITCODE -ne 0) {
    throw "Production deploy failed."
  }

  if (-not $SkipRegression) {
    Write-Host "Running public regression against" $AppUrl "..."
    $oldAppUrl = $env:APP_URL
    try {
      $env:APP_URL = $AppUrl
      & $npmCmd --prefix $frontendRoot run regression:public
      if ($LASTEXITCODE -ne 0) {
        throw "Public regression failed."
      }
    }
    finally {
      if ($null -eq $oldAppUrl) {
        Remove-Item Env:APP_URL -ErrorAction SilentlyContinue
      }
      else {
        $env:APP_URL = $oldAppUrl
      }
    }
  }

  Write-Host "Release flow completed successfully."
}
finally {
  if (Test-Path $tempKeyPath) {
    Remove-Item -Force $tempKeyPath
  }
}
