param(
  [Parameter(Mandatory = $true)]
  [string]$SshHost,

  [Parameter(Mandatory = $true)]
  [string]$SshUser,

  [int]$SshPort = 22,

  [string]$KeyPath = "",

  [string]$RemoteDir = "/srv/ops-training-system",

  [string]$ServiceName = "ops-training",

  [int]$AppPort = 8000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$distIndex = Join-Path $projectRoot "frontend\dist\index.html"
$backendApp = Join-Path $projectRoot "backend\app"
$backendRequirements = Join-Path $projectRoot "backend\requirements.txt"
$releaseId = Get-Date -Format "yyyyMMdd-HHmmss"
$archiveName = "ops-training-$releaseId.tar.gz"
$archivePath = Join-Path $env:TEMP $archiveName
$stageRoot = Join-Path $env:TEMP ("ops-training-stage-" + [guid]::NewGuid().ToString("N"))
$remoteTarget = "$SshUser@$SshHost"

if (-not (Test-Path $distIndex)) {
  throw "Missing frontend/dist/index.html. Run the frontend build locally before deploying."
}

if (-not (Test-Path $backendApp)) {
  throw "Missing backend/app. The backend sources are required for deployment."
}

if (-not (Test-Path $backendRequirements)) {
  throw "Missing backend/requirements.txt. The backend dependency list is required for deployment."
}

if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
  throw "The local machine cannot find the ssh command. Install Windows OpenSSH Client first."
}

if (-not (Get-Command scp -ErrorAction SilentlyContinue)) {
  throw "The local machine cannot find the scp command. Install Windows OpenSSH Client first."
}

if (-not (Get-Command tar.exe -ErrorAction SilentlyContinue)) {
  throw "The local machine cannot find tar.exe. Install the standard Windows tar utility first."
}

$sshArgs = @("-p", $SshPort.ToString())
$scpArgs = @("-P", $SshPort.ToString())

if ($KeyPath) {
  $resolvedKey = (Resolve-Path $KeyPath).Path
  $sshArgs += @("-i", $resolvedKey)
  $scpArgs += @("-i", $resolvedKey)
}

function Invoke-RemoteCommand {
  param([string]$RemoteCommand)

  & ssh @sshArgs $remoteTarget $RemoteCommand
  if ($LASTEXITCODE -ne 0) {
    throw "The remote command failed."
  }
}

function Copy-ToRemote {
  param(
    [string]$LocalPath,
    [string]$RemotePath
  )

  & scp @scpArgs $LocalPath "${remoteTarget}:$RemotePath"
  if ($LASTEXITCODE -ne 0) {
    throw "File upload failed: $LocalPath"
  }
}

try {
  if (Test-Path $stageRoot) {
    Remove-Item -Recurse -Force $stageRoot
  }

  New-Item -ItemType Directory -Path $stageRoot | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $stageRoot "backend") | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $stageRoot "frontend") | Out-Null

  Copy-Item $backendApp (Join-Path $stageRoot "backend") -Recurse
  Copy-Item $backendRequirements (Join-Path $stageRoot "backend\requirements.txt")
  Copy-Item (Join-Path $projectRoot "frontend\dist") (Join-Path $stageRoot "frontend") -Recurse

  @"
release_id=$releaseId
generated_at=$(Get-Date -Format s)
source=windows-ssh-deploy
"@ | Set-Content -Path (Join-Path $stageRoot "RELEASE_INFO.txt") -Encoding UTF8

  if (Test-Path $archivePath) {
    Remove-Item -Force $archivePath
  }

  & tar.exe -czf $archivePath -C $stageRoot .
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create the deployment archive."
  }

  Write-Host "Uploading release package to $remoteTarget ..."
  Copy-ToRemote -LocalPath $archivePath -RemotePath "/tmp/$archiveName"

  $remoteScript = @"
set -euo pipefail

APP_ROOT="$RemoteDir"
RELEASE_ID="$releaseId"
ARCHIVE_PATH="/tmp/$archiveName"
RELEASE_PATH="$RemoteDir/releases/$releaseId"
CURRENT_LINK="$RemoteDir/current"
SERVICE_NAME="$ServiceName"
APP_PORT="$AppPort"

if ! command -v python3 >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y python3 python3-venv
fi

if ! command -v curl >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y curl
fi

mkdir -p "$APP_ROOT/releases" "$APP_ROOT/shared/data" "$APP_ROOT/shared/logs"
rm -rf "$RELEASE_PATH"
mkdir -p "$RELEASE_PATH"
tar -xzf "$ARCHIVE_PATH" -C "$RELEASE_PATH"
rm -f "$ARCHIVE_PATH"

if [ ! -d "$APP_ROOT/.venv" ]; then
  python3 -m venv "$APP_ROOT/.venv"
fi

"$APP_ROOT/.venv/bin/python" -m pip install --upgrade pip
"$APP_ROOT/.venv/bin/python" -m pip install -r "$RELEASE_PATH/backend/requirements.txt"

ln -sfn "$RELEASE_PATH" "$CURRENT_LINK"

cat > "/tmp/$ServiceName.service" <<SERVICE
[Unit]
Description=Ops Training System
After=network.target

[Service]
Type=simple
User=$SshUser
WorkingDirectory=$RemoteDir/current
Environment=OPS_TRAINING_DB_PATH=$RemoteDir/shared/data/ops_training.db
ExecStart=$RemoteDir/.venv/bin/uvicorn backend.app.main:app --host 0.0.0.0 --port $AppPort
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
SERVICE

sudo mv "/tmp/$ServiceName.service" "/etc/systemd/system/$ServiceName.service"
sudo systemctl daemon-reload
sudo systemctl enable "$ServiceName"
sudo systemctl restart "$ServiceName"
sleep 2
curl -fsS "http://127.0.0.1:$AppPort/api/health"
"@

  Write-Host "Running remote setup ..."
  Invoke-RemoteCommand -RemoteCommand $remoteScript
  Write-Host "Deployment finished successfully."
  Write-Host "Health endpoint: http://$SshHost`:$AppPort/api/health"
}
finally {
  if (Test-Path $stageRoot) {
    Remove-Item -Recurse -Force $stageRoot
  }
  if (Test-Path $archivePath) {
    Remove-Item -Force $archivePath
  }
}
