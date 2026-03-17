param(
  [Parameter(Mandatory = $true)]
  [string]$SshHost,

  [Parameter(Mandatory = $true)]
  [string]$SshUser,

  [int]$SshPort = 22,

  [string]$KeyPath = "",

  [string]$RemoteDir = "/srv/ops-training-system",

  [string]$ServiceName = "ops-training",

  [int]$AppPort = 8000,

  [string]$Branch = "",

  [string]$RemoteName = "origin"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backendRequirements = Join-Path $projectRoot "backend\requirements.txt"
$remoteTarget = "$SshUser@$SshHost"
$releaseId = Get-Date -Format "yyyyMMdd-HHmmss"
$archivePath = Join-Path $env:TEMP "ops-training-$releaseId.tar.gz"

if (-not (Test-Path $backendRequirements)) {
  throw "Missing backend/requirements.txt. The backend dependency list is required for deployment."
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "The local machine cannot find git. Install Git for Windows first."
}

if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
  throw "The local machine cannot find the ssh command. Install Windows OpenSSH Client first."
}

if (-not (Get-Command scp -ErrorAction SilentlyContinue)) {
  throw "The local machine cannot find the scp command. Install Windows OpenSSH Client first."
}

$resolvedBranch = $Branch
if ([string]::IsNullOrWhiteSpace($resolvedBranch)) {
  $resolvedBranch = (git -C $projectRoot branch --show-current).Trim()
  if ([string]::IsNullOrWhiteSpace($resolvedBranch)) {
    $resolvedBranch = "main"
  }
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

Write-Host "Fetching latest code from $RemoteName/$resolvedBranch ..."
& git -C $projectRoot fetch $RemoteName --prune
if ($LASTEXITCODE -ne 0) {
  throw "Failed to fetch the latest code from the remote repository."
}

$remoteRef = "$RemoteName/$resolvedBranch"
$remoteCommit = (& git -C $projectRoot rev-parse $remoteRef).Trim()
if ([string]::IsNullOrWhiteSpace($remoteCommit)) {
  throw "Unable to resolve $remoteRef."
}

if (Test-Path $archivePath) {
  Remove-Item -Force $archivePath
}

Write-Host "Packaging commit $remoteCommit ..."
& git -C $projectRoot archive --format=tar.gz --output=$archivePath $remoteCommit
if ($LASTEXITCODE -ne 0) {
  throw "Failed to package the latest remote commit."
}

$shellSingleQuoteEscape = "'`"`'`"`'"
$escapedRemoteDir = $RemoteDir.Replace("'", $shellSingleQuoteEscape)
$escapedServiceName = $ServiceName.Replace("'", $shellSingleQuoteEscape)
$escapedSshUser = $SshUser.Replace("'", $shellSingleQuoteEscape)
$escapedReleaseId = $releaseId.Replace("'", $shellSingleQuoteEscape)
$escapedCommit = $remoteCommit.Replace("'", $shellSingleQuoteEscape)

$remoteScriptTemplate = @'
set -euo pipefail

APP_ROOT='__APP_ROOT__'
RELEASE_ID='__RELEASE_ID__'
COMMIT_SHA='__COMMIT_SHA__'
RELEASE_PATH="$APP_ROOT/releases/$RELEASE_ID"
CURRENT_LINK="$APP_ROOT/current"
SERVICE_NAME='__SERVICE_NAME__'
APP_PORT='__APP_PORT__'
RUN_USER='__RUN_USER__'
ARCHIVE_PATH="/tmp/ops-training-$RELEASE_ID.tar.gz"

sudo apt-get update -y
sudo apt-get install -y python3 python3-venv python3.12-venv curl
sudo mkdir -p "$APP_ROOT/releases" "$APP_ROOT/shared/data" "$APP_ROOT/shared/logs"
sudo chown -R "$RUN_USER:$RUN_USER" "$APP_ROOT"

rm -rf "$RELEASE_PATH"
mkdir -p "$RELEASE_PATH"
tar -xzf "$ARCHIVE_PATH" -C "$RELEASE_PATH"
rm -f "$ARCHIVE_PATH"

if [ ! -f "$RELEASE_PATH/frontend/dist/index.html" ]; then
  echo "frontend/dist/index.html is missing in the release package." >&2
  exit 1
fi

cat > "$RELEASE_PATH/DEPLOY_INFO.txt" <<INFO
commit=$COMMIT_SHA
release_id=$RELEASE_ID
deployed_at=$(date -Iseconds)
source=local-fetch-origin-main
INFO

if [ -d "$APP_ROOT/.venv" ] && [ ! -x "$APP_ROOT/.venv/bin/python" ]; then
  rm -rf "$APP_ROOT/.venv"
fi

if [ ! -d "$APP_ROOT/.venv" ]; then
  python3 -m venv "$APP_ROOT/.venv"
fi

"$APP_ROOT/.venv/bin/python" -m ensurepip --upgrade
"$APP_ROOT/.venv/bin/python" -m pip install --upgrade pip
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
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"
sleep 2
curl -fsS "http://127.0.0.1:$APP_PORT/api/health"
'@

$remoteScript = $remoteScriptTemplate.
  Replace('__APP_ROOT__', $escapedRemoteDir).
  Replace('__RELEASE_ID__', $escapedReleaseId).
  Replace('__COMMIT_SHA__', $escapedCommit).
  Replace('__SERVICE_NAME__', $escapedServiceName).
  Replace('__APP_PORT__', $AppPort.ToString()).
  Replace('__RUN_USER__', $escapedSshUser)

try {
  Write-Host "Uploading package to $remoteTarget ..."
  Copy-ToRemote -LocalPath $archivePath -RemotePath "/tmp/ops-training-$releaseId.tar.gz"

  Write-Host "Running remote deployment ..."
  Invoke-RemoteCommand -RemoteCommand $remoteScript

  Write-Host "Deployment finished successfully."
  Write-Host "Deployed commit: $remoteCommit"
  Write-Host "Release ID: $releaseId"
  Write-Host "Health endpoint: http://$SshHost`:$AppPort/api/health"
}
finally {
  if (Test-Path $archivePath) {
    Remove-Item -Force $archivePath
  }
}
