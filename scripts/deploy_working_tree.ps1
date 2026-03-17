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
$backendRequirements = Join-Path $projectRoot "backend\requirements.txt"
$frontendDist = Join-Path $projectRoot "frontend\dist\index.html"
$remoteTarget = "$SshUser@$SshHost"
$releaseId = Get-Date -Format "yyyyMMdd-HHmmss"
$archivePath = Join-Path $env:TEMP "ops-training-working-$releaseId.tar.gz"
$stageRoot = Join-Path $env:TEMP ("ops-training-stage-" + [guid]::NewGuid().ToString("N"))

if (-not (Test-Path $backendRequirements)) {
  throw "Missing backend/requirements.txt."
}

if (-not (Test-Path $frontendDist)) {
  throw "Missing frontend/dist/index.html. Build the frontend first."
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
  New-Item -ItemType Directory -Path $stageRoot | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $stageRoot "backend") | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $stageRoot "frontend") | Out-Null

  Copy-Item (Join-Path $projectRoot "backend\app") (Join-Path $stageRoot "backend") -Recurse
  Copy-Item (Join-Path $projectRoot "backend\requirements.txt") (Join-Path $stageRoot "backend\requirements.txt")
  Copy-Item (Join-Path $projectRoot "frontend\dist") (Join-Path $stageRoot "frontend") -Recurse

  @"
release_id=$releaseId
source=local-working-tree
built_at=$(Get-Date -Format s)
"@ | Set-Content -Path (Join-Path $stageRoot "DEPLOY_INFO.txt") -Encoding UTF8

  if (Test-Path $archivePath) {
    Remove-Item -Force $archivePath
  }

  & tar.exe -czf $archivePath -C $stageRoot .
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create the working tree archive."
  }

  Copy-ToRemote -LocalPath $archivePath -RemotePath "/tmp/ops-training-working-$releaseId.tar.gz"

  $remoteScriptTemplate = @'
set -euo pipefail

APP_ROOT="__APP_ROOT__"
RELEASE_ID="__RELEASE_ID__"
RELEASE_PATH="$APP_ROOT/releases/$RELEASE_ID"
CURRENT_LINK="$APP_ROOT/current"
SERVICE_NAME="__SERVICE_NAME__"
APP_PORT="__APP_PORT__"
RUN_USER="__RUN_USER__"
ARCHIVE_PATH="/tmp/ops-training-working-$RELEASE_ID.tar.gz"

sudo mkdir -p "$APP_ROOT/releases" "$APP_ROOT/shared/data" "$APP_ROOT/shared/logs"
sudo chown -R "${RUN_USER}:${RUN_USER}" "$APP_ROOT"

rm -rf "$RELEASE_PATH"
mkdir -p "$RELEASE_PATH"
tar -xzf "$ARCHIVE_PATH" -C "$RELEASE_PATH"
rm -f "$ARCHIVE_PATH"

if [ ! -f "$RELEASE_PATH/frontend/dist/index.html" ]; then
  echo "frontend/dist/index.html is missing in the release package." >&2
  exit 1
fi

if [ -d "$APP_ROOT/.venv" ] && [ ! -x "$APP_ROOT/.venv/bin/python" ]; then
  rm -rf "$APP_ROOT/.venv"
fi

if [ ! -d "$APP_ROOT/.venv" ]; then
  python3 -m venv "$APP_ROOT/.venv"
fi

"$APP_ROOT/.venv/bin/python" -m ensurepip --upgrade
"$APP_ROOT/.venv/bin/python" -m pip install -r "$RELEASE_PATH/backend/requirements.txt"

ln -sfn "$RELEASE_PATH" "$CURRENT_LINK"

cat > "/tmp/$SERVICE_NAME.service" <<SERVICE
[Unit]
Description=Ops Training System
After=network.target

[Service]
Type=simple
User=$RUN_USER
WorkingDirectory=$CURRENT_LINK
Environment=OPS_TRAINING_DB_PATH=$APP_ROOT/shared/data/ops_training.db
ExecStart=$APP_ROOT/.venv/bin/uvicorn backend.app.main:app --host 0.0.0.0 --port $APP_PORT
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
SERVICE

sudo mv "/tmp/$SERVICE_NAME.service" "/etc/systemd/system/$SERVICE_NAME.service"
sudo systemctl daemon-reload
sudo systemctl restart "$SERVICE_NAME"
sleep 2
curl -fsS "http://127.0.0.1:$APP_PORT/api/health"
'@

  $remoteScript = $remoteScriptTemplate.
    Replace('__APP_ROOT__', $RemoteDir).
    Replace('__RELEASE_ID__', $releaseId).
    Replace('__SERVICE_NAME__', $ServiceName).
    Replace('__APP_PORT__', $AppPort.ToString()).
    Replace('__RUN_USER__', $SshUser)

  Invoke-RemoteCommand -RemoteCommand $remoteScript
  Write-Host "Deployment finished successfully."
  Write-Host "Release ID: $releaseId"
}
finally {
  if (Test-Path $stageRoot) {
    Remove-Item -Recurse -Force $stageRoot
  }
  if (Test-Path $archivePath) {
    Remove-Item -Force $archivePath
  }
}
